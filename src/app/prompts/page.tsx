"use client";
import { useEffect, useState } from "react";

interface PromptPreset {
  id: number;
  name: string;
  content: string;
  description: string | null;
  animation_motion: string | null;
  image_prompt: string | null;
  heygen_voice_id: string | null;
  created_at: string;
  updated_at: string;
}

const META: { name: string; label: string; help: string; rows: number }[] = [
  {
    name: "scene_split",
    label: "Scene Split — system prompt for Gemini",
    help:
      "The DEFAULT prompt that instructs the LLM how to slice a script into scenes. Used when a run " +
      "has no channel selected. Channel profiles above each carry their own scene_split prompt that " +
      "overrides this default. See docs/PROMPT-GUIDE.md for what a good prompt contains.",
    rows: 16,
  },
  {
    name: "animation_motion",
    label: "Animation Motion — default motion style for Grok img2vid",
    help:
      "Appended to every scene's visual_prompt before being sent to Grok. Tells the video model what " +
      "kind of motion you want. Used when a run's channel doesn't set its own Animation Motion override.",
    rows: 4,
  },
  {
    name: "image_prompt",
    label: "Image Style — (currently unused — video-only mode)",
    help:
      "Not used in Conveyer Grok — the pipeline is video-only with no image stage. Kept for a possible " +
      "future image mode. Safe to ignore.",
    rows: 3,
  },
];

export default function PromptsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Channel profiles state
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [presetError, setPresetError] = useState<string | null>(null);

  // New channel form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVoiceId, setNewVoiceId] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAnimationMotion, setNewAnimationMotion] = useState("");

  // Edit channel form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVoiceId, setEditVoiceId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAnimationMotion, setEditAnimationMotion] = useState("");

  async function load() {
    const r = await fetch("/api/prompts");
    setValues(await r.json());
  }
  async function loadPresets() {
    const r = await fetch("/api/prompt-presets");
    setPresets(await r.json());
  }
  useEffect(() => {
    load();
    loadPresets();
  }, []);

  async function save() {
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function createPreset() {
    setPresetError(null);
    if (!newName.trim() || !newContent.trim()) {
      setPresetError("Channel name and Scene Split prompt are both required");
      return;
    }
    const r = await fetch("/api/prompt-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        content: newContent,
        description: newDescription.trim() || null,
        heygen_voice_id: newVoiceId.trim() || null,
        animation_motion: newAnimationMotion.trim() || null,
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setPresetError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewVoiceId("");
    setNewContent("");
    setNewAnimationMotion("");
    await loadPresets();
  }

  function startEdit(p: PromptPreset) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDescription(p.description ?? "");
    setEditVoiceId(p.heygen_voice_id ?? "");
    setEditContent(p.content);
    setEditAnimationMotion(p.animation_motion ?? "");
    setPresetError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditVoiceId("");
    setEditContent("");
    setEditAnimationMotion("");
  }

  async function saveEdit() {
    if (editingId == null) return;
    setPresetError(null);
    const r = await fetch(`/api/prompt-presets/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        content: editContent,
        description: editDescription.trim() || null,
        heygen_voice_id: editVoiceId.trim() || null,
        animation_motion: editAnimationMotion.trim() || null,
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setPresetError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    cancelEdit();
    await loadPresets();
  }

  async function deletePreset(id: number) {
    if (!confirm("Delete this channel profile? Past runs that used it keep their snapshot.")) return;
    await fetch(`/api/prompt-presets/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await loadPresets();
  }

  const labelStyle: React.CSSProperties = { marginTop: 6, marginBottom: 4 };
  const optionalNote = (text: string) => (
    <span style={{ color: "#8a8aa0", fontWeight: 400, fontSize: 12 }}>{text}</span>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Channels &amp; Prompts</h1>
      <p style={{ color: "#8a8aa0", marginBottom: 16, lineHeight: 1.6 }}>
        A <strong>channel profile</strong> bundles everything specific to one YouTube channel —
        its scene-split prompt, its HeyGen voice, its motion style. Pick a channel on the New Run
        page and all of it applies in one click. The Default prompts at the bottom are used only
        when no channel is selected.
      </p>

      {/* ── Channel profiles ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          Channels{" "}
          <span style={{ color: "#8a8aa0", fontWeight: 400, fontSize: 14 }}>({presets.length})</span>
        </h2>
        <p style={{ color: "#9090a8", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          One profile per channel. Required: name + Scene Split prompt. Optional: a HeyGen voice_id
          (overrides the global voice for runs on this channel), an Animation Motion override, and
          a description note. Empty optional fields fall back to global defaults.
        </p>

        {presetError && (
          <div
            style={{
              background: "#3a1a1a",
              border: "1px solid #6a2a2a",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 12,
              color: "#ffb0b0",
              fontSize: 13,
            }}
          >
            {presetError}
          </div>
        )}

        {presets.length === 0 && (
          <div style={{ color: "#8a8aa0", fontSize: 13, marginBottom: 14, fontStyle: "italic" }}>
            No channels yet. Add one below.
          </div>
        )}

        {presets.map((p) => (
          <div
            key={p.id}
            style={{ border: "1px solid #2a2a3a", borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            {editingId === p.id ? (
              <>
                <label className="label" style={labelStyle}>
                  Channel name <span style={{ color: "#ff6b6b" }}>*</span>
                </label>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Channel name"
                  style={{ marginBottom: 8, width: "100%" }}
                />
                <label className="label" style={labelStyle}>
                  Description {optionalNote("(optional note — for your reference)")}
                </label>
                <input
                  className="input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="e.g. Longevity / Blue Zone documentary, audience 50-75"
                  style={{ marginBottom: 8, width: "100%" }}
                />
                <label className="label" style={labelStyle}>
                  HeyGen voice_id {optionalNote("(optional — empty uses the global HEYGEN_VOICE_ID)")}
                </label>
                <input
                  className="input"
                  value={editVoiceId}
                  onChange={(e) => setEditVoiceId(e.target.value)}
                  placeholder="e.g. 1021285c663b465bb2af8b9f9c596d0c"
                  style={{ marginBottom: 8, width: "100%" }}
                />
                <label className="label" style={labelStyle}>
                  Scene Split prompt <span style={{ color: "#ff6b6b" }}>*</span>
                </label>
                <textarea
                  className="textarea"
                  rows={12}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <label className="label" style={labelStyle}>
                  Animation Motion override {optionalNote("(optional — empty uses the global default)")}
                </label>
                <textarea
                  className="textarea"
                  rows={4}
                  value={editAnimationMotion}
                  onChange={(e) => setEditAnimationMotion(e.target.value)}
                  placeholder="Leave empty to inherit the default Animation Motion prompt."
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn" onClick={cancelEdit} style={{ background: "#2a2a3a" }}>
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={() => deletePreset(p.id)}
                    style={{ background: "#5a2a2a", marginLeft: "auto" }}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  {p.heygen_voice_id && (
                    <span
                      style={{
                        padding: "2px 7px",
                        background: "#24402a",
                        color: "#90e0a0",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      title={`Custom HeyGen voice: ${p.heygen_voice_id}`}
                    >
                      voice
                    </span>
                  )}
                  {p.animation_motion && (
                    <span
                      style={{
                        padding: "2px 7px",
                        background: "#2a2440",
                        color: "#a690ff",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                      title="Custom Animation Motion override"
                    >
                      motion
                    </span>
                  )}
                  <div style={{ color: "#6a6a80", fontSize: 12, marginLeft: "auto" }}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                  <button
                    className="btn"
                    onClick={() => startEdit(p)}
                    style={{ padding: "4px 12px", fontSize: 13 }}
                  >
                    Edit
                  </button>
                </div>
                {p.description && (
                  <div style={{ color: "#b0b0c0", fontSize: 12.5, marginTop: 5 }}>{p.description}</div>
                )}
                <div style={{ color: "#9090a8", fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                  {p.content.slice(0, 150)}
                  {p.content.length > 150 ? "…" : ""}
                </div>
              </>
            )}
          </div>
        ))}

        {/* New channel form */}
        <div style={{ borderTop: "1px solid #2a2a3a", paddingTop: 14, marginTop: 14 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>Add new channel</h3>

          <label className="label" style={labelStyle}>
            Channel name <span style={{ color: "#ff6b6b" }}>*</span>
          </label>
          <input
            className="input"
            placeholder="e.g. The Blue Zone Way"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />

          <label className="label" style={labelStyle}>
            Description {optionalNote("(optional note — for your reference)")}
          </label>
          <input
            className="input"
            placeholder="e.g. Longevity / Blue Zone documentary, audience 50-75"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />

          <label className="label" style={labelStyle}>
            HeyGen voice_id {optionalNote("(optional — empty uses the global HEYGEN_VOICE_ID setting)")}
          </label>
          <input
            className="input"
            placeholder="e.g. 1021285c663b465bb2af8b9f9c596d0c"
            value={newVoiceId}
            onChange={(e) => setNewVoiceId(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />

          <label className="label" style={labelStyle}>
            Scene Split prompt <span style={{ color: "#ff6b6b" }}>*</span>
          </label>
          <textarea
            className="textarea"
            rows={9}
            placeholder="Paste this channel's scene_split system prompt here. See docs/PROMPT-GUIDE.md."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ marginBottom: 10 }}>
            <button
              className="btn"
              onClick={() => setNewContent(values.scene_split ?? "")}
              style={{ background: "#2a2a3a", padding: "4px 10px", fontSize: 12 }}
              title="Copy current default scene_split as a starting point"
            >
              ↓ Copy scene_split from default
            </button>
          </div>

          <label className="label" style={labelStyle}>
            Animation Motion override {optionalNote("(optional — empty uses the global default)")}
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Leave empty to inherit the default. Fill in for a per-channel motion style."
            value={newAnimationMotion}
            onChange={(e) => setNewAnimationMotion(e.target.value)}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <div style={{ marginBottom: 12 }}>
            <button
              className="btn"
              onClick={() => setNewAnimationMotion(values.animation_motion ?? "")}
              style={{ background: "#2a2a3a", padding: "4px 10px", fontSize: 12 }}
              title="Copy current default Animation Motion as a starting point"
            >
              ↓ Copy motion from default
            </button>
          </div>

          <button className="btn" onClick={createPreset}>
            Add channel
          </button>
        </div>
      </div>

      {/* ── Default prompts ─────────────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Default prompts</h2>
      <p style={{ color: "#9090a8", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
        Used when a run has no channel selected, or when a channel leaves a field empty. Changes
        take effect on the next run — no restart needed.
      </p>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" onClick={save}>
          {saved ? "Saved ✓" : "Save all prompts"}
        </button>
      </div>
      {META.map((m) => (
        <div key={m.name} className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 4 }}>{m.label}</h3>
          <p style={{ color: "#9090a8", fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>{m.help}</p>
          <textarea
            className="textarea"
            rows={m.rows}
            value={values[m.name] ?? ""}
            onChange={(e) => setValues({ ...values, [m.name]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
