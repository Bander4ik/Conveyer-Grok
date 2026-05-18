import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import db from "@/lib/db";
import { ensureInit } from "@/lib/init";
import { runPipeline } from "@/lib/pipeline";
import { sanitizeFolderName, pickAvailableFolderName } from "@/lib/run-paths";
import { getPromptPreset } from "@/lib/prompts";

const insertRun = db.prepare(
  "INSERT INTO runs (id, title, folder_name, status, script, config_json) VALUES (?, ?, ?, 'pending', ?, ?)"
);
const setReuseMap = db.prepare(
  "UPDATE runs SET reuse_map_json = ? WHERE id = ?"
);
const setPresetSnapshot = db.prepare(
  "UPDATE runs SET preset_id = ?, preset_name = ?, preset_content = ? WHERE id = ?"
);
const listRuns = db.prepare(
  "SELECT id, title, folder_name, status, created_at, updated_at, output_path FROM runs ORDER BY created_at DESC LIMIT 50"
);

export async function GET() {
  ensureInit();
  return NextResponse.json(listRuns.all());
}

export async function POST(req: Request) {
  ensureInit();
  const body = (await req.json()) as {
    title?: string;
    script?: string;
    /** Optional: scene_index → drive_file_id. Pipeline downloads those instead of generating. */
    reuseMap?: Record<string, string>;
    /** Optional: Prompt Preset id (from /prompts presets). Snapshot is stored on the run. */
    presetId?: number | null;
  };
  const script = (body.script ?? "").trim();
  if (!script) {
    return NextResponse.json({ error: "script is empty" }, { status: 400 });
  }

  const id = randomUUID();
  const baseFolderName = sanitizeFolderName(body.title ?? "", id.slice(0, 8));
  const folderName = pickAvailableFolderName(baseFolderName);

  insertRun.run(id, body.title ?? null, folderName, script, JSON.stringify({}));

  // Persist reuseMap so the pipeline can read it without callers passing options.
  // Keys are normalized to strings — they already are in JSON, but TS allowed
  // Record<number, string> in some call sites.
  if (body.reuseMap && typeof body.reuseMap === "object") {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.reuseMap)) {
      if (typeof v === "string" && v.length > 0) normalized[String(k)] = v;
    }
    if (Object.keys(normalized).length > 0) {
      setReuseMap.run(JSON.stringify(normalized), id);
    }
  }

  // Snapshot the chosen prompt preset (if any) onto the run row. We store the
  // content too, not just the id, so deleting the preset later doesn't break
  // re-runs / diagnostics.
  if (typeof body.presetId === "number" && body.presetId > 0) {
    const preset = getPromptPreset(body.presetId);
    if (preset) {
      setPresetSnapshot.run(preset.id, preset.name, preset.content, id);
    }
  }

  // Запускаємо пайплайн у фоні. На локалі цього досить.
  runPipeline(id, script).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("pipeline crash", e);
  });

  return NextResponse.json({ id, folderName });
}
