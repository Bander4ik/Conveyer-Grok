"use client";
import { useEffect, useState } from "react";

interface PromptPreset {
  id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const META: { name: string; label: string; help: string; rows: number }[] = [
  {
    name: "scene_split",
    label: "Scene Split — system prompt for Gemini",
    help:
      "This prompt instructs the LLM how to slice your script into individual scenes. The model must " +
      "return a JSON array. Each scene has `text` (verbatim slice of the script), `visual_prompt` " +
      "(English description of the shot for the image generator), and `duration_hint_sec`. " +
      "Modify this to change the visual style direction or to adjust how aggressively the script is split. " +
      "This is the DEFAULT prompt — saved presets below can override it per run.",
    rows: 18,
  },
  {
    name: "image_prompt",
    label: "Image Style — suffix appended to every image prompt",
    help:
      "Pure style instructions (no subject matter) appended to every scene's visual_prompt before being " +
      "sent to the image model. Defines the look-and-feel of the entire channel — e.g. \"documentary " +
      "photography, photoreal, no people\" vs \"painterly artwork, dreamy lighting\". The actual subject of " +
      "each shot comes from Gemini's per-scene visual_prompt.",
    rows: 5,
  },
  {
    name: "animation_motion",
    label: "Animation Motion — motion style for img2vid (Grok)",
    help:
      "Appended to every scene's visual_prompt when img2vid is enabled. Tells the video model what kind " +
      "of motion you want — subtle parallax for living-photo feel, vs aggressive movement for dramatic " +
      "B-roll.",
    rows: 4,
  },
];

export default function PromptsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Presets state
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [presetError, setPresetError] = useState<string | null>(null);

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
      setPresetError("Both name and content are required");
      return;
    }
    const r = await fetch("/api/prompt-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, content: newContent }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setPresetError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    setNewName("");
    setNewContent("");
    await loadPresets();
  }

  function startEdit(p: PromptPreset) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditContent(p.content);
    setPresetError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditContent("");
  }

  async function saveEdit() {
    if (editingId == null) return;
    setPresetError(null);
    const r = await fetch(`/api/prompt-presets/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, content: editContent }),
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
    if (!confirm("Delete this preset? Past runs that used it keep their snapshot.")) return;
    await fetch(`/api/prompt-presets/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await loadPresets();
  }

  function copyFromDefault() {
    setNewContent(values.scene_split ?? "");
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Prompts</h1>
      <p style={{ color: "#8a8aa0", marginBottom: 16, lineHeight: 1.6 }}>
        Default system prompts below drive the pipeline. <strong>Presets</strong> let you keep
        different scene-split prompts (e.g. one per YouTube channel) and pick one on each run.
      </p>

      {/* ── Presets section ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          Scene-split presets <span style={{ color: "#8a8aa0", fontWeight: 400, fontSize: 14 }}>
            ({presets.length})
          </span>
        </h2>
        <p style={{ color: "#9090a8", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          Save a different scene_split prompt per channel. On the New Run page you'll see a
          dropdown to pick which preset to use. If nothing is picked, the default scene_split
          prompt below is used.
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
            No presets yet. Add one below.
          </div>
        )}

        {presets.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
            }}
          >
            {editingId === p.id ? (
              <>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Preset name"
                  style={{ marginBottom: 8, width: "100%" }}
                />
                <textarea
                  className="textarea"
                  rows={12}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{p.name}</div>
                  <div style={{ color: "#6a6a80", fontSize: 12 }}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                  <button className="btn" onClick={() => startEdit(p)} style={{ padding: "4px 12px", fontSize: 13 }}>
                    Edit
                  </button>
                </div>
                <div style={{ color: "#9090a8", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                  {p.content.slice(0, 160)}
                  {p.content.length > 160 ? "…" : ""}
                </div>
              </>
            )}
          </div>
        ))}

        {/* New preset form */}
        <div style={{ borderTop: "1px solid #2a2a3a", paddingTop: 14, marginTop: 14 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>Add new preset</h3>
          <input
            className="input"
            placeholder="Preset name (e.g. 'Channel A — facts style')"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />
          <textarea
            className="textarea"
            rows={10}
            placeholder="Paste your scene_split system prompt here..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={createPreset}>
              Add preset
            </button>
            <button
              className="btn"
              onClick={copyFromDefault}
              style={{ background: "#2a2a3a" }}
              title="Copy current default scene_split as a starting point"
            >
              Copy from default
            </button>
          </div>
        </div>
      </div>

      {/* ── Default prompts section ─────────────────────────────────── */}
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Default prompts</h2>
      <p style={{ color: "#9090a8", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
        Used when no preset is selected on a run. Changes take effect on the next run — no restart needed.
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
