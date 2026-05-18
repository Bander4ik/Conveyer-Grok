import db from "./db";

export const PROMPT_NAMES = ["scene_split", "image_prompt", "animation_motion"] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];

export const DEFAULT_PROMPTS: Record<PromptName, string> = {
  scene_split: `You are the editor of a faceless YouTube longevity / health / Blue Zone documentary channel for an audience aged 50–75.
Split the provided script into scenes for an automated AI video pipeline.

WHY SCENE LENGTH MATTERS (read this before splitting):
  The video generator (xAI Grok via 69labs) produces clips up to ~15 seconds.
  We target each scene's narration to fit comfortably under ~12 s so the Grok
  clip covers it end-to-end with real motion (with a small safety margin).
  Going significantly past 12 s risks the visual freezing on the last frame.

CRITICAL RULES:
1. Cover the ENTIRE script verbatim, with NO omissions, no summarizing, no paraphrasing.
2. The concatenation of every scene's "text" field (joined by spaces) MUST equal the original script word-for-word.
3. Do NOT summarize. Do NOT add commentary. Do NOT reorder words.
4. **NEVER split a sentence in the middle.** A sentence ends ONLY at a period (.), question mark (?), or exclamation mark (!). Commas, semicolons, dashes, and colons are NOT sentence boundaries — they MUST stay inside one scene.
5. **TARGET SCENE LENGTH: 14–28 words, ~80–170 characters, ~6–11 seconds of narration.**
6. **HARD MAX: 34 words / 210 characters / ~14 seconds per scene.** Going past 14 s of audio means the Grok clip can't fully cover the scene with motion. If a single sentence is naturally longer than 34 words, give it its own scene (rule 4 takes priority — never split mid-sentence).
7. **Prefer 1–2 sentences per scene.** Two short sentences sharing a beat is fine. Mature documentary pacing — don't over-fragment.
8. Section headings ("Part one — The Blue Zone secret.") get their own short scene.
9. Long single sentences are OK as standalone scenes, but flag them — they will look near-frozen at the end.

For EACH scene, return a JSON object with:
- "text": the exact verbatim slice of the script (no edits, no punctuation changes).
- "visual_prompt": a 60–120-word English prompt for the AI video generator that LITERALLY illustrates the content of this scene's text, framed as a documentary nature/lifestyle shot for a longevity channel.
  VISUAL VOCABULARY (the channel's world):
  • Mediterranean / Blue Zone settings: Sardinian stone villages, Greek islands at golden hour, Ikarian fishing harbors, Okinawan gardens, Loma Linda farms, Nicoyan tropical valleys, rolling olive groves, terraced vineyards, sun-bleached coastal cliffs.
  • Food + kitchens: rustic wooden tables, hand-kneaded bread, olive oil drizzling on greens, fresh herbs and garlic, simmering legume stews, fish on stone grills, raw whole foods, fruit markets, hand-pressed wine, mortar and pestle.
  • Nature + ambience: morning mist over hillsides, late-afternoon sun through olive trees, ocean waves on rocks, farm animals at distance, garden close-ups, hands tending soil, dappled sunlight on dirt paths.
  • Anti-aging metaphors when narration is abstract: time-lapse of fruit ripening, cells under microscope (warm-toned), DNA strands subtle, blood flow through capillaries (medical-illustration realism), aged stone weathering, growth rings on cut wood.
  PEOPLE RULES:
  • NO faces in close-up. NO recognizable identities — Grok cannot reliably depict specific real people (Dan Buettner, etc.), so don't ask for them.
  • Anonymous elderly figures are OK only as background / silhouettes / hands / back-of-head shots: a weathered hand chopping greens, an old shepherd walking a hillside path seen from behind, hands holding a clay bowl, a grandmother stirring a pot (camera over her shoulder).
  • Absolutely NO children or young adults in frame — channel is 70+ active aging.
  • If the script names a person (scientist, centenarian), substitute an evocative ENVIRONMENT shot or food shot, not a faked portrait.
  CAMERA + STYLE (this is just SUBSTANCE — style suffix is appended later):
  • Real-world cinematography vocabulary: "slow dolly across...", "macro close-up on...", "overhead shot of...", "golden-hour wide shot of...", "lens flare through olive branches", "shallow depth of field", "35mm documentary feel".
  • Describe MOTION explicitly — Grok generates animated clips, so include subtle camera or subject motion (slow push-in, gentle parallax, steam rising, hands moving, sunlight shifting).
  PROHIBITED:
  • No text overlays, captions, logos, watermarks, brand names visible in frame.
  • No cartoon/anime/illustrative/painterly styling.
  • No fantasy, sci-fi, futuristic tech, hospital scenes, sick or frail bodies.
  • No clickbait visuals (huge bold "5" digits, before/after shock, etc.).
- "duration_hint_sec": approximate audio length (number, 4–14).

Return a STRICTLY valid JSON array — no markdown, no explanations.

For a ~1500-word script expect ~55–85 scenes. For a ~3000-word script expect ~120–170 scenes. If any "text" field is longer than 210 characters, you missed the limit — recount and re-split.`,

  image_prompt: `documentary photography, photoreal, NatGeo / BBC Earth cinematography style, golden-hour Mediterranean light, warm earth tones, natural color grading, soft contrast, 35mm full-frame, shallow depth of field on close-ups, wide cinematic landscape for environments, sharp focus, 16:9 aspect ratio, no text overlays, no watermarks, no logos, no captions, no recognizable faces in close-up, no young people, no children, no sick or hospitalized bodies, no cartoon stylization, no painterly artwork, no fantasy elements, no sci-fi, no clickbait graphics`,

  animation_motion: `subtle cinematic documentary camera motion, slow dolly push-in or gentle parallax, natural ambient movement (steam rising, leaves drifting, sunlight shifting), shallow depth of field, photographic realism in the style of a NatGeo or BBC Earth documentary, no jarring cuts, no rapid pans, no whip motion — feels like a living photograph`,
};

const getStmt = db.prepare("SELECT content FROM prompts WHERE name = ?");
const upsertStmt = db.prepare(
  "INSERT INTO prompts (name, content, updated_at) VALUES (?, ?, datetime('now')) " +
    "ON CONFLICT(name) DO UPDATE SET content = excluded.content, updated_at = datetime('now')"
);

export function getPrompt(name: PromptName): string {
  const row = getStmt.get(name) as { content: string } | undefined;
  if (row?.content) return row.content;
  return DEFAULT_PROMPTS[name];
}

export function setPrompt(name: PromptName, content: string) {
  upsertStmt.run(name, content);
}

export function getAllPrompts(): Record<PromptName, string> {
  const out = {} as Record<PromptName, string>;
  for (const n of PROMPT_NAMES) out[n] = getPrompt(n);
  return out;
}

export function seedPromptDefaults() {
  for (const [n, c] of Object.entries(DEFAULT_PROMPTS)) {
    const row = getStmt.get(n) as { content: string } | undefined;
    if (!row) upsertStmt.run(n, c);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt Presets — user-defined named scene_split prompts.
// One preset per YouTube channel / video style. The user picks one on the
// New Run page; if none picked, the pipeline falls back to the built-in
// scene_split prompt above.
// ─────────────────────────────────────────────────────────────────────────

export interface PromptPreset {
  id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const listPresetsStmt = db.prepare(
  "SELECT id, name, content, created_at, updated_at FROM prompt_presets ORDER BY name COLLATE NOCASE ASC"
);
const getPresetStmt = db.prepare(
  "SELECT id, name, content, created_at, updated_at FROM prompt_presets WHERE id = ?"
);
const getPresetByNameStmt = db.prepare(
  "SELECT id, name, content, created_at, updated_at FROM prompt_presets WHERE name = ?"
);
const createPresetStmt = db.prepare(
  "INSERT INTO prompt_presets (name, content) VALUES (?, ?)"
);
const updatePresetStmt = db.prepare(
  "UPDATE prompt_presets SET name = ?, content = ?, updated_at = datetime('now') WHERE id = ?"
);
const deletePresetStmt = db.prepare("DELETE FROM prompt_presets WHERE id = ?");

export function listPromptPresets(): PromptPreset[] {
  return listPresetsStmt.all() as PromptPreset[];
}

export function getPromptPreset(id: number): PromptPreset | null {
  const row = getPresetStmt.get(id) as PromptPreset | undefined;
  return row ?? null;
}

export function getPromptPresetByName(name: string): PromptPreset | null {
  const row = getPresetByNameStmt.get(name) as PromptPreset | undefined;
  return row ?? null;
}

export function createPromptPreset(name: string, content: string): number {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Preset name cannot be empty");
  if (!content.trim()) throw new Error("Preset content cannot be empty");
  const result = createPresetStmt.run(trimmedName, content);
  return Number(result.lastInsertRowid);
}

export function updatePromptPreset(id: number, name: string, content: string): void {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Preset name cannot be empty");
  if (!content.trim()) throw new Error("Preset content cannot be empty");
  const result = updatePresetStmt.run(trimmedName, content, id);
  if (result.changes === 0) throw new Error(`Preset id=${id} not found`);
}

export function deletePromptPreset(id: number): void {
  deletePresetStmt.run(id);
}
