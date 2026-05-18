"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

// Rough estimate: TTS narration averages ~150 words per minute
const WORDS_PER_MINUTE = 150;

// Per-job time estimates (in seconds), empirically tuned from production runs
const AVG_IMAGE_SEC = 90;      // nano-banana-pro at 1k averages ~60-120s
const AVG_GROK_VIDEO_SEC = 75;  // Grok via 69labs averages ~60-90s per clip
const AVG_TTS_SEC = 4;         // short scene narration through 69labs is ~2-6s
const AVG_CLIP_RENDER_SEC = 8; // x264 veryfast render per Ken-Burns / animated clip
const XFADE_FRAMES_PER_SEC = 1800; // approx encoding speed for xfade chain on one core

interface StatsResp {
  keyCount: number;
  perKey: { image: number; tts: number; anim: number };
  total: { image: number; tts: number; anim: number };
  assembleConcurrency: number;
  xfadeChunks: number;
  animationEnabled: boolean;
  animationRatio: number;
}

interface Scene {
  index: number;
  text: string;
  visual_prompt: string;
  duration_hint_sec: number;
}

interface ClipMatch {
  new_scene_index: number;
  drive_file_id: string;
  score: number;
  reason: string;
  source: {
    run_title: string | null;
    folder_name: string;
    drive_file_link: string;
    scene_text: string;
    visual_prompt: string;
    audio_duration_sec: number | null;
  };
}

interface GdriveStatus {
  connected: boolean;
}

export default function NewRunPage() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [drive, setDrive] = useState<GdriveStatus | null>(null);

  // Library preview state
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [matches, setMatches] = useState<ClipMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  /** scene_index → drive_file_id. Empty when user hasn't picked any reuse. */
  const [reuseMap, setReuseMap] = useState<Record<number, string>>({});
  /** scene_index → true means suggestions panel is expanded for that scene. */
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Prompt Presets — list + currently selected. selectedPresetId === null means
  // "use the default scene_split prompt from /prompts".
  const [presets, setPresets] = useState<{ id: number; name: string }[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);

  /** Confidence threshold (%) for automatic picking. User can still un-tick or pick others manually. */
  const AUTO_PICK_THRESHOLD = 80;

  const router = useRouter();

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    fetch("/api/gdrive/status")
      .then((r) => r.json())
      .then(setDrive)
      .catch(() => setDrive(null));
    fetch("/api/prompt-presets")
      .then((r) => r.json())
      .then((rows: { id: number; name: string }[]) => setPresets(rows))
      .catch(() => setPresets([]));
  }, []);

  const scriptStats = useMemo(() => {
    const text = script.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const seconds = (words / WORDS_PER_MINUTE) * 60;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return {
      words,
      chars,
      duration: words === 0 ? "—" : (m > 0 ? `~${m} min ${s} s` : `~${s} s`),
      scenes: Math.max(1, Math.round(seconds / 5)),
      narrationSeconds: seconds,
    };
  }, [script]);

  const timeEstimate = useMemo(() => {
    if (!stats || scriptStats.scenes === 0) return null;
    const N = scriptStats.scenes;
    const imageMin = (Math.ceil(N / stats.total.image) * AVG_IMAGE_SEC) / 60;
    const animScenes = stats.animationEnabled ? Math.ceil(N * (stats.animationRatio / 100)) : 0;
    const animMin =
      animScenes > 0 ? (Math.ceil(animScenes / stats.total.anim) * AVG_GROK_VIDEO_SEC) / 60 : 0;
    const ttsMin = (Math.ceil(N / stats.total.tts) * AVG_TTS_SEC) / 60;
    const phase1 = Math.max(imageMin, animMin, ttsMin);
    const phase2 = (Math.ceil(N / stats.assembleConcurrency) * AVG_CLIP_RENDER_SEC) / 60;
    const totalFrames = scriptStats.narrationSeconds * 30;
    const chunks = stats.xfadeChunks;
    const phase3 = (totalFrames / chunks / XFADE_FRAMES_PER_SEC) / 60;
    const total = phase1 + phase2 + phase3;
    return { total, phase1, phase2, phase3, imageMin, animMin, ttsMin, animScenes };
  }, [stats, scriptStats]);

  /** Group matches by new_scene_index, sorted by score descending. */
  const matchesByScene = useMemo(() => {
    const m = new Map<number, ClipMatch[]>();
    for (const x of matches ?? []) {
      const list = m.get(x.new_scene_index) ?? [];
      list.push(x);
      m.set(x.new_scene_index, list);
    }
    for (const list of m.values()) list.sort((a, b) => b.score - a.score);
    return m;
  }, [matches]);

  /**
   * Auto-pick rule: whenever a new set of matches arrives, automatically tick
   * the top match for every scene whose best score is >= 80%. The user can
   * still un-tick or switch to a lower-confidence match manually by expanding
   * the panel. Below the threshold we leave the scene unchecked — the AI
   * isn't confident enough to swap a generated clip without human review.
   */
  useEffect(() => {
    if (!matches || matches.length === 0) return;
    const auto: Record<number, string> = {};
    for (const [sceneIdx, list] of matchesByScene.entries()) {
      const best = list[0]; // already sorted desc
      if (best && best.score >= AUTO_PICK_THRESHOLD) {
        auto[sceneIdx] = best.drive_file_id;
      }
    }
    setReuseMap(auto);
    setExpanded({}); // collapse all on fresh load
  }, [matches, matchesByScene]);

  const reuseCount = Object.keys(reuseMap).length;

  async function previewScenes() {
    if (!script.trim()) return;
    setPreviewing(true);
    setMatches(null);
    setReuseMap({});
    try {
      const r = await fetch("/api/preview/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, presetId: selectedPresetId }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(`Couldn't split scenes:\n\n${j.error || r.statusText}`);
        return;
      }
      setScenes(j.scenes as Scene[]);
    } finally {
      setPreviewing(false);
    }
  }

  async function findClips() {
    if (!scenes) return;
    setSearching(true);
    try {
      const r = await fetch("/api/library/find-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(`Couldn't search library:\n\n${j.error || r.statusText}`);
        return;
      }
      setMatches(j.matches as ClipMatch[]);
    } finally {
      setSearching(false);
    }
  }

  function toggleReuse(sceneIndex: number, fileId: string) {
    setReuseMap((prev) => {
      const copy = { ...prev };
      if (copy[sceneIndex] === fileId) delete copy[sceneIndex];
      else copy[sceneIndex] = fileId;
      return copy;
    });
  }

  async function start() {
    setBusy(true);
    try {
      const body: {
        title?: string;
        script: string;
        reuseMap?: Record<number, string>;
        presetId?: number | null;
      } = {
        title,
        script,
      };
      if (reuseCount > 0) body.reuseMap = reuseMap;
      if (selectedPresetId != null) body.presetId = selectedPresetId;
      const r = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        alert(`Error: ${await r.text()}`);
        return;
      }
      const data = (await r.json()) as { id: string };
      router.push(`/runs/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>New run</h1>
      <p style={{ color: "#8a8aa0", marginBottom: 16 }}>
        Paste a script — the system splits it into scenes, generates voiceover and imagery, then
        assembles the final video. Optional: preview scenes first and reuse clips from past runs.
      </p>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div>
          <label className="label">Title (optional)</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Solar Storm Test 1"
          />
        </div>
        <div>
          <label className="label">
            Prompt preset {" "}
            <span style={{ color: "#8a8aa0", fontWeight: 400, fontSize: 12 }}>
              (which scene-split prompt to use — manage on /prompts)
            </span>
          </label>
          <select
            className="input"
            value={selectedPresetId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedPresetId(v === "" ? null : Number(v));
              setScenes(null);
              setMatches(null);
            }}
            style={{ width: "100%" }}
          >
            <option value="">Default scene_split prompt</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Script</label>
          <textarea
            className="textarea"
            rows={14}
            value={script}
            onChange={(e) => {
              setScript(e.target.value);
              setScenes(null);
              setMatches(null);
              setReuseMap({});
            }}
            placeholder="Paste the full script here..."
          />
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: "#8a8aa0", flexWrap: "wrap" }}>
            <span><strong style={{ color: "#e8e8f0" }}>{scriptStats.words}</strong> words</span>
            <span><strong style={{ color: "#e8e8f0" }}>{scriptStats.chars}</strong> chars</span>
            <span>≈ <strong style={{ color: "#7c5cff" }}>{scriptStats.duration}</strong> of final video</span>
            <span>≈ <strong style={{ color: "#e8e8f0" }}>{scriptStats.scenes}</strong> scenes</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={start} disabled={busy || !script.trim()}>
            {busy
              ? "Starting..."
              : reuseCount > 0
                ? `Run pipeline (reusing ${reuseCount} clip${reuseCount === 1 ? "" : "s"})`
                : "Run pipeline"}
          </button>
          <button
            className="btn-secondary"
            onClick={previewScenes}
            disabled={previewing || !script.trim()}
            title="See the scenes before running. Lets you pick reusable clips from past runs."
          >
            {previewing ? "Splitting…" : scenes ? "Re-split scenes" : "👁 Preview scenes first"}
          </button>
        </div>
      </div>

      {/* ─── Scene preview + library suggestions ──────────────────────────── */}
      {scenes && scenes.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: 16,
            borderColor: "#3a5a8a",
            borderWidth: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Scene preview ({scenes.length})</h3>
              <div style={{ color: "#8a8aa0", fontSize: 12 }}>
                Reuse clips from past runs to skip generation for those scenes — saves time and
                credits.
              </div>
            </div>
            <div>
              {drive?.connected ? (
                <button
                  className="btn-secondary"
                  onClick={findClips}
                  disabled={searching}
                >
                  {searching
                    ? "Searching library…"
                    : matches
                      ? "🔁 Search again"
                      : "🔍 Find existing clips from library"}
                </button>
              ) : (
                <a
                  className="btn-secondary"
                  href="/settings"
                  title="Connect Google Drive to enable library search"
                >
                  Connect Drive to enable search
                </a>
              )}
            </div>
          </div>

          {matches !== null && matches.length === 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: "#1a1a28",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                color: "#9090a8",
                fontSize: 12,
              }}
            >
              No similar clips found in your library — every scene will be generated from scratch.
            </div>
          )}

          {matches !== null && matches.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: reuseCount > 0 ? "#1a2a1a" : "#1a1a28",
                border: `1px solid ${reuseCount > 0 ? "#3a5a3a" : "#2a2a3a"}`,
                borderRadius: 6,
                fontSize: 13,
                color: reuseCount > 0 ? "#6dd66d" : "#9090a8",
              }}
            >
              {reuseCount > 0 ? (
                <>
                  ✓ Auto-picked {reuseCount} clip{reuseCount === 1 ? "" : "s"} at ≥{AUTO_PICK_THRESHOLD}% confidence.
                  Other scenes will be generated fresh. Click any scene below to inspect, change the pick,
                  or browse lower-confidence options.
                </>
              ) : (
                <>
                  👀 Found {matches.length} suggestion{matches.length === 1 ? "" : "s"} across{" "}
                  {matchesByScene.size} scene{matchesByScene.size === 1 ? "" : "s"}, but none passed the{" "}
                  {AUTO_PICK_THRESHOLD}% confidence threshold for auto-pick. Click a scene to review and
                  pick manually, or leave all to generate fresh.
                </>
              )}
              <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<number, boolean> = {};
                    for (const idx of matchesByScene.keys()) all[idx] = true;
                    setExpanded(all);
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid #3a3a4a",
                    color: "#b8b8c8",
                    padding: "3px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded({})}
                  style={{
                    background: "transparent",
                    border: "1px solid #3a3a4a",
                    color: "#b8b8c8",
                    padding: "3px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Collapse all
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 6 }}>
            {scenes.map((scene) => {
              const sceneMatches = matchesByScene.get(scene.index) ?? [];
              const picked = reuseMap[scene.index];
              const pickedMatch = picked ? sceneMatches.find((m) => m.drive_file_id === picked) : null;
              const bestScore = sceneMatches[0]?.score ?? 0;
              const isExpanded = !!expanded[scene.index];

              // Decide the status badge in the compact header
              let statusBadge: React.ReactNode = null;
              if (pickedMatch) {
                statusBadge = (
                  <span
                    style={{
                      color: "#6dd66d",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#1a2a1a",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    ✓ Reusing {pickedMatch.score}% match
                  </span>
                );
              } else if (sceneMatches.length > 0 && bestScore >= AUTO_PICK_THRESHOLD) {
                // Auto-pick was applied but user un-ticked it
                statusBadge = (
                  <span
                    style={{
                      color: "#ffce4d",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#2a2010",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    ○ Will generate new (suggestion was unchecked)
                  </span>
                );
              } else if (sceneMatches.length > 0) {
                statusBadge = (
                  <span
                    style={{
                      color: "#8a8aa0",
                      fontSize: 11,
                      background: "#14141d",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {sceneMatches.length} low-confidence suggestion
                    {sceneMatches.length === 1 ? "" : "s"} (&lt;{AUTO_PICK_THRESHOLD}%)
                  </span>
                );
              }

              return (
                <div
                  key={scene.index}
                  style={{
                    background: "#0f0f17",
                    border: `1px solid ${pickedMatch ? "#3a5a3a" : "#232334"}`,
                    borderRadius: 8,
                  }}
                >
                  {/* Compact header — always visible */}
                  <div
                    style={{
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: sceneMatches.length > 0 ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (sceneMatches.length === 0) return;
                      setExpanded((prev) => ({ ...prev, [scene.index]: !prev[scene.index] }));
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13, minWidth: 70 }}>
                      Scene {scene.index + 1}
                    </span>
                    <span
                      style={{
                        color: "#b8b8c8",
                        fontSize: 12,
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={scene.text}
                    >
                      {scene.text}
                    </span>
                    {statusBadge}
                    {sceneMatches.length > 0 && (
                      <span
                        style={{
                          color: "#8a8aa0",
                          fontSize: 11,
                          width: 14,
                          textAlign: "center",
                        }}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </span>
                    )}
                  </div>

                  {/* Expanded body — visual prompt + match picker */}
                  {isExpanded && (
                    <div style={{ padding: "0 10px 10px 10px", borderTop: "1px solid #1a1a28" }}>
                      <div
                        style={{
                          color: "#b8b8c8",
                          fontSize: 12,
                          lineHeight: 1.5,
                          marginTop: 8,
                          marginBottom: 4,
                        }}
                      >
                        {scene.text}
                      </div>
                      <div
                        style={{
                          color: "#7c5cff",
                          fontSize: 11,
                          fontFamily: "ui-monospace, monospace",
                          lineHeight: 1.4,
                          marginBottom: 10,
                        }}
                      >
                        {scene.visual_prompt}
                      </div>
                      {sceneMatches.length > 0 && (
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 11, color: "#8a8aa0", fontWeight: 600 }}>
                            Suggestions (sorted by confidence):
                          </div>
                          {sceneMatches.map((m) => {
                            const isPicked = picked === m.drive_file_id;
                            return (
                              <label
                                key={m.drive_file_id}
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  padding: 8,
                                  background: isPicked ? "#1a2a1a" : "#14141d",
                                  border: `1px solid ${isPicked ? "#3a5a3a" : "#232334"}`,
                                  borderRadius: 6,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isPicked}
                                  onChange={() => toggleReuse(scene.index, m.drive_file_id)}
                                  style={{ marginTop: 3 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "baseline",
                                      flexWrap: "wrap",
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color:
                                          m.score >= AUTO_PICK_THRESHOLD ? "#6dd66d" : "#ffce4d",
                                      }}
                                    >
                                      {m.score}% match
                                      {m.score >= AUTO_PICK_THRESHOLD ? " (auto-pick)" : ""}
                                    </span>
                                    <span style={{ fontSize: 11, color: "#8a8aa0" }}>
                                      from &quot;{m.source.run_title || m.source.folder_name}&quot;
                                    </span>
                                    <a
                                      href={m.source.drive_file_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ fontSize: 11, color: "#7c5cff", marginLeft: "auto" }}
                                    >
                                      Preview ↗
                                    </a>
                                  </div>
                                  <div style={{ fontSize: 11, color: "#cfcfdf", marginBottom: 4 }}>
                                    {m.reason}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: "#8a8aa0",
                                      fontFamily: "ui-monospace, monospace",
                                      lineHeight: 1.4,
                                      maxHeight: 40,
                                      overflow: "auto",
                                    }}
                                  >
                                    {m.source.visual_prompt}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {reuseCount > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "#1a2a1a",
                border: "1px solid #3a5a3a",
                borderRadius: 6,
                fontSize: 13,
                color: "#6dd66d",
              }}
            >
              ✓ {reuseCount} clip{reuseCount === 1 ? "" : "s"} marked for reuse. Click{" "}
              <strong>Run pipeline</strong> at the top — those scenes will skip generation and
              be downloaded from Drive instead.
            </div>
          )}
        </div>
      )}

      {timeEstimate && stats && scriptStats.words > 0 && (
        <div
          className="card"
          style={{
            marginTop: 16,
            background: "linear-gradient(90deg, #14141d, #1a1a28)",
            borderColor: stats.keyCount >= 2 ? "#3a5a3a" : undefined,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            ⏱️ Estimated generation time
            <span style={{ color: "#7c5cff", fontSize: 18 }}>
              ~{timeEstimate.total < 1 ? "<1" : Math.round(timeEstimate.total)} min
            </span>
          </div>
          <div style={{ color: "#9090a8", fontSize: 13, lineHeight: 1.7 }}>
            <div>
              <strong style={{ color: "#e8e8f0" }}>Parallel generation</strong> (TTS + images
              {stats.animationEnabled ? ` + ${timeEstimate.animScenes} video clips` : ""}):
              ~{Math.round(timeEstimate.phase1)} min
              <span style={{ color: "#5a5a70", marginLeft: 8 }}>
                with {stats.keyCount} {stats.keyCount === 1 ? "key" : "keys"} ({stats.total.image} img / {stats.total.anim} vid / {stats.total.tts} TTS in parallel)
              </span>
            </div>
            <div>
              <strong style={{ color: "#e8e8f0" }}>FFmpeg clip render</strong>:
              ~{Math.round(timeEstimate.phase2 * 10) / 10} min
              <span style={{ color: "#5a5a70", marginLeft: 8 }}>
                {stats.assembleConcurrency} clips at once
              </span>
            </div>
            <div>
              <strong style={{ color: "#e8e8f0" }}>Final xfade assembly</strong>:
              ~{Math.round(timeEstimate.phase3 * 10) / 10} min
              <span style={{ color: "#5a5a70", marginLeft: 8 }}>
                {stats.xfadeChunks} parallel chunks
              </span>
            </div>
          </div>
          {stats.keyCount === 1 && scriptStats.scenes > 30 && (
            <div style={{ color: "#ffce4d", fontSize: 12, marginTop: 10, padding: 8, background: "#2a2010", borderRadius: 6 }}>
              💡 You're running on a single 69labs key. Adding a 2nd key would cut the generation
              phase roughly in half (estimated ~{Math.round(timeEstimate.total / 2)} min instead of ~{Math.round(timeEstimate.total)} min).
              Paste extra keys in <a href="/settings" style={{ color: "#7c5cff" }}>Keys &amp; Settings</a> → Required API Keys.
            </div>
          )}
          <div style={{ color: "#5a5a70", fontSize: 11, marginTop: 8 }}>
            Numbers are rough — real runs are usually 10–30% faster. Heavy CPU usage during the
            assembly phase; weak machines may want to lower ASSEMBLE_CONCURRENCY or
            ASSEMBLE_XFADE_CHUNKS in Advanced settings.
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>What happens next</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Gemini splits the script into scenes (with visual prompts per scene).</li>
          <li>For each scene, HeyGen TTS narration and a Grok video clip are generated in parallel.</li>
          <li>FFmpeg stitches all clips together with crossfade transitions.</li>
          <li>If Drive sync is on, the finished run is uploaded automatically.</li>
        </ol>
        <p style={{ color: "#8a8aa0", fontSize: 13, marginTop: 8 }}>
          Live logs for every stage stream into the run page in real time.
        </p>
      </div>
    </div>
  );
}
