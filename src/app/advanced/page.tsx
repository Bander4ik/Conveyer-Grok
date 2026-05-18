"use client";
import { useEffect, useState } from "react";
import { ADVANCED_GROUPS } from "../settings/_groups";
import { GroupCard } from "../settings/_group-card";

/**
 * Advanced settings page. Everything that was previously crowded into the main
 * /settings page lives here in a compact layout: storage, LLM provider, TTS,
 * images, animations, video assembly, concurrency, alt providers.
 *
 * Reads and writes the same /api/settings endpoint as /settings — fields are
 * just regrouped, no separate persistence.
 */
export default function AdvancedSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [revealing, setRevealing] = useState(false);

  async function load(reveal = false) {
    const data = await fetch(`/api/settings${reveal ? "?reveal=1" : ""}`).then((r) => r.json());
    setValues(data);
    setRevealing(reveal);
  }
  useEffect(() => { load(false); }, []);

  async function save() {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      const isSecret = k.includes("KEY") || k.includes("TOKEN") || k.includes("SECRET");
      if (isSecret && typeof v === "string" && v.includes("…")) continue;
      cleaned[k] = v;
    }
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleaned),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({} as { error?: string }));
      alert(`Save failed: ${j.error || r.statusText}`);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    load(revealing);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Advanced settings</h1>
      <p style={{ color: "#8a8aa0", marginBottom: 12, lineHeight: 1.5, fontSize: 13 }}>
        Pipeline behavior — TTS voice, image/video models, FFmpeg, concurrency. Main API keys live
        in <a href="/settings" style={{ color: "#7c5cff" }}>Keys &amp; Settings</a>.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          padding: "6px 0",
          zIndex: 10,
        }}
      >
        <button className="btn-secondary" onClick={() => load(!revealing)}>
          {revealing ? "Hide secret values" : "Reveal secret values (to edit)"}
        </button>
        <button className="btn" onClick={save}>{saved ? "Saved ✓" : "Save all changes"}</button>
      </div>

      {ADVANCED_GROUPS.map((g) => (
        <GroupCard key={g.title} group={g} values={values} setValues={setValues} compact />
      ))}
    </div>
  );
}
