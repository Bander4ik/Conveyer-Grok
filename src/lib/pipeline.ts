import path from "node:path";
import fs from "node:fs";
import db from "./db";
import { log } from "./logger";
import { getSetting } from "./settings";
import { getRunDir } from "./run-paths";
import { pLimit } from "./plimit";
import { splitScript } from "./services/scene-split";
import { synthesizeScene } from "./services/tts";
import { animateScene } from "./services/img2vid";
import { assembleVideo, type AssembleInput } from "./services/video-assemble";
import { getKeyCount } from "./services/labs69";
import { syncRunToDrive } from "./services/run-upload";
import { downloadReusedClip } from "./services/reuse";

const getReuseMapStmt = db.prepare("SELECT reuse_map_json FROM runs WHERE id = ?");
const getPresetSnapshotStmt = db.prepare(
  "SELECT preset_content, preset_animation_motion, preset_voice_id FROM runs WHERE id = ?"
);
import { checkCancelled, clearCancelled, CancelledError } from "./cancellation";

const updateRun = db.prepare(
  "UPDATE runs SET status = ?, output_path = ?, updated_at = datetime('now') WHERE id = ?"
);

export async function runPipeline(runId: string, script: string) {
  const runDir = getRunDir(runId);
  const audioDir = path.join(runDir, "audio");
  const animDir = path.join(runDir, "animations");
  // No imgDir — Conveyer Grok is video-only, scenes go straight to Grok img2vid.
  for (const d of [runDir, audioDir, animDir]) fs.mkdirSync(d, { recursive: true });

  try {
    clearCancelled(runId);
    updateRun.run("running", null, runId);
    log(runId, "info", `Pipeline started · folder: ${path.basename(runDir)}`, { stage: "pipeline" });

    // 1. Split script into scenes — using a chosen channel profile if the user
    //    picked one on the New Run page (snapshot is stored on the run row).
    //    `preset_animation_motion` overrides the Animation Motion suffix and
    //    `preset_voice_id` overrides the HeyGen voice — both per channel.
    const presetRow = getPresetSnapshotStmt.get(runId) as
      | {
          preset_content: string | null;
          preset_animation_motion: string | null;
          preset_voice_id: string | null;
        }
      | undefined;
    const overridePrompt = presetRow?.preset_content ?? undefined;
    const motionOverride = presetRow?.preset_animation_motion ?? null;
    const voiceOverride = presetRow?.preset_voice_id ?? null;
    const scenes = await splitScript(runId, script, overridePrompt);
    checkCancelled(runId);
    fs.writeFileSync(path.join(runDir, "scenes.json"), JSON.stringify(scenes, null, 2), "utf-8");

    // Reuse map (set when user picked clips from the library on the New Run page).
    // Keys are scene_index as string, values are Drive file IDs.
    const reuseRow = getReuseMapStmt.get(runId) as { reuse_map_json: string | null } | undefined;
    const reuseMap: Record<string, string> = reuseRow?.reuse_map_json
      ? (JSON.parse(reuseRow.reuse_map_json) as Record<string, string>)
      : {};
    const reuseCount = Object.keys(reuseMap).length;
    if (reuseCount > 0) {
      log(
        runId,
        "info",
        `Reusing ${reuseCount} clip${reuseCount === 1 ? "" : "s"} from library — those scenes skip Grok generation`,
        { stage: "reuse", data: { reuseMap } }
      );
    }

    // 2. Per scene: TTS + Image + (Animation as soon as image is ready) — all
    //    interleaved in a single loop. No "wait for all images then start animations"
    //    phase, which saves ~30–50% of total time.
    //
    // Concurrency limits below are PER KEY. With N 69labs keys configured, the
    // effective parallel job count is (limit × N) — each key has its own 7-image
    // / 5-video cap on the 69labs side.
    // Conveyer Grok is video-only — no image stage, so no imageConcurrency.
    const keyCount = Math.max(1, getKeyCount());
    const ttsConcurrencyPerKey = Math.max(1, Number(getSetting("TTS_CONCURRENCY") || "3"));
    const animConcurrencyPerKey = Math.max(1, Number(getSetting("ANIMATION_CONCURRENCY") || "3"));
    const ttsConcurrency = ttsConcurrencyPerKey * keyCount;
    const animConcurrency = animConcurrencyPerKey * keyCount;
    const limitTts = pLimit(ttsConcurrency);
    const limitAnim = pLimit(animConcurrency);

    // Conveyer Grok is VIDEO-ONLY: every scene is a Grok text-to-video clip via 69labs.
    // No Ken-Burns photos, no image stage, no img2vid fallback. The animation
    // provider must be set and EVERY scene gets animated. If a Grok job fails,
    // the scene fails (no photo fallback to mask it).
    const animProvider = (getSetting("ANIMATION_PROVIDER") || "69labs").toLowerCase();
    if (animProvider === "off") {
      throw new Error(
        "Conveyer Grok is video-only: ANIMATION_PROVIDER cannot be 'off'. Set it to '69labs' in /settings."
      );
    }

    log(
      runId,
      "info",
      `Generating ${scenes.length} scenes (video-only). Keys: ${keyCount} · Concurrency (per key × keys): TTS=${ttsConcurrencyPerKey}×${keyCount}=${ttsConcurrency}, video=${animConcurrencyPerKey}×${keyCount}=${animConcurrency}. Provider: ${animProvider}`,
      { stage: "pipeline" }
    );

    type SceneResult = (AssembleInput & {
      _imgProviderJobId?: string;
      _imgProvider?: string;
    }) | null;

    const settled: SceneResult[] = await Promise.all(
      scenes.map(async (scene): Promise<SceneResult> => {
        try {
          checkCancelled(runId);
          // Video-only mode: TTS + Grok text-to-video run in parallel. NO image
          // generation step. Grok gets just the scene's visual_prompt — no
          // keyframe — and generates the clip from scratch.
          //
          // If this scene has a reuse mapping (user picked a clip from the
          // library), skip Grok entirely and download the existing clip from
          // Drive in parallel with TTS — no quota consumed, much faster.
          const reuseFileId = reuseMap[String(scene.index)];
          const [audio, videoPath] = await Promise.all([
            limitTts(() => synthesizeScene(runId, scene, audioDir, { voiceOverride })),
            reuseFileId
              ? downloadReusedClip(runId, scene, reuseFileId, animDir)
              : limitAnim(() => animateScene(runId, scene, null, animDir, { motionOverride })),
          ]);

          if (!videoPath) {
            throw new Error(`Scene #${scene.index} produced no video clip`);
          }

          return {
            scene,
            // imagePath is irrelevant in video-only mode but the AssembleInput
            // shape still requires a string. video-assemble uses videoPath if
            // it's set, so this value is never actually read.
            imagePath: videoPath,
            videoPath,
            audio,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log(runId, "error", `Scene #${scene.index} failed: ${msg.slice(0, 200)}`, { stage: "pipeline" });
          return null;
        }
      })
    );

    const sceneAssets = settled.filter((x): x is NonNullable<SceneResult> => x !== null);
    const failedCount = scenes.length - sceneAssets.length;

    if (failedCount > 0) {
      const failedPct = (failedCount / scenes.length) * 100;
      // Abort threshold is configurable (Advanced settings). On unreliable
      // nights raise it so a partial run survives and can be Resumed instead
      // of being thrown away.
      const failureThreshold = Math.max(
        0,
        Math.min(100, Number(getSetting("FAILURE_THRESHOLD_PERCENT") || "25"))
      );
      const over = failedPct > failureThreshold;
      log(
        runId,
        over ? "error" : "warn",
        `${failedCount}/${scenes.length} scenes failed (${failedPct.toFixed(0)}%) · abort threshold ${failureThreshold}%`,
        { stage: "pipeline" }
      );
      if (over) {
        throw new Error(
          `Too many scenes failed: ${failedCount}/${scenes.length} (${failedPct.toFixed(0)}% over the ${failureThreshold}% threshold). The partial assets are kept — use Resume on the run page to regenerate only the missing scenes.`
        );
      }
    }
    if (sceneAssets.length === 0) throw new Error("No scenes succeeded");

    checkCancelled(runId);

    // 3. Assemble final video
    const finalPath = await assembleVideo(runId, sceneAssets, runDir);

    // 4. Google Drive sync (best-effort). The run is already "done" the moment
    //    final.mp4 exists on disk — Drive upload failures must not roll back a
    //    successful generation. We catch internally and log the warning.
    try {
      await syncRunToDrive(runId, sceneAssets, runDir, finalPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(runId, "warn", `Drive sync failed (local files preserved): ${msg}`, { stage: "gdrive" });
    }

    updateRun.run("done", finalPath, runId);
    log(runId, "success", "Pipeline complete", { stage: "pipeline", data: { finalPath } });
  } catch (e) {
    if (e instanceof CancelledError) {
      log(runId, "warn", "Pipeline cancelled by user", { stage: "pipeline" });
      // status 'cancelled' was already set by the API endpoint, don't overwrite
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      log(runId, "error", `Pipeline crashed: ${msg}`, { stage: "pipeline" });
      updateRun.run("error", null, runId);
    }
  }
}
