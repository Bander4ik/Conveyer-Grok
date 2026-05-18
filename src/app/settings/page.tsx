"use client";
import { useEffect, useState } from "react";
import { MAIN_GROUPS } from "./_groups";
import { GroupCard } from "./_group-card";

interface StatsResp {
  keyCount: number;
  perKey: { image: number; tts: number; anim: number };
  total: { image: number; tts: number; anim: number };
  assembleConcurrency: number;
  xfadeChunks: number;
  animationEnabled: boolean;
  animationRatio: number;
}

type GdriveErrorKind = "api_not_enabled" | "auth_invalid" | "network" | "other";

interface GdriveStatus {
  connected: boolean;
  email?: string;
  error?: string;
  errorKind?: GdriveErrorKind;
  enableUrl?: string;
  syncEnabled: boolean;
  credentialsConfigured: boolean;
}

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [gdrive, setGdrive] = useState<GdriveStatus | null>(null);

  async function load(reveal = false) {
    const [settingsR, statsR, gdriveR] = await Promise.all([
      fetch(`/api/settings${reveal ? "?reveal=1" : ""}`).then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()).catch(() => null),
      fetch("/api/gdrive/status").then((r) => r.json()).catch(() => null),
    ]);
    setValues(settingsR);
    setStats(statsR);
    setGdrive(gdriveR);
    setRevealing(reveal);
  }

  useEffect(() => { load(false); }, []);

  // Surface OAuth callback result (?gdrive=connected / ?gdrive=error&reason=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gd = params.get("gdrive");
    if (!gd) return;
    if (gd === "connected") {
      alert("Google Drive connected ✓");
    } else if (gd === "error") {
      alert(`Drive connection failed: ${params.get("reason") || "unknown error"}`);
    }
    window.history.replaceState({}, "", "/settings");
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    // Drop fields whose value is still the masked placeholder ("AIza…XXXX").
    // Sending those back overwrites the real key in the DB with a broken
    // string containing U+2026 — which then crashes every downstream API
    // call (fetch refuses to put non-ASCII chars in headers).
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

  async function disconnectGdrive() {
    if (!confirm("Disconnect Google Drive? You'll need to re-authorize to upload again.")) return;
    await fetch("/api/gdrive/disconnect", { method: "POST" });
    load(revealing);
  }

  function connectGdrive() {
    if (!gdrive?.credentialsConfigured) {
      alert("Fill GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET, then click 'Save all changes' before connecting.");
      return;
    }
    window.location.href = "/api/gdrive/oauth/start";
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Keys &amp; Settings</h1>
      <p style={{ color: "#8a8aa0", marginBottom: 16, lineHeight: 1.6 }}>
        The keys below are the bare minimum to run the pipeline. Everything else
        (TTS voices, image/video models, concurrency, FFmpeg) lives in{" "}
        <a href="/advanced" style={{ color: "#7c5cff" }}>Advanced settings</a>.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, position: "sticky", top: 0, background: "var(--bg)", padding: "8px 0", zIndex: 10 }}>
        <button className="btn-secondary" onClick={() => load(!revealing)}>
          {revealing ? "Hide secret values" : "Reveal secret values (to edit)"}
        </button>
        <button className="btn" onClick={save}>{saved ? "Saved ✓" : "Save all changes"}</button>
      </div>

      {stats && stats.keyCount > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            background: "linear-gradient(90deg, #14141d, #1a1a28)",
            borderColor: stats.keyCount >= 2 ? "#3a5a3a" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                ⚡ Current parallel capacity
                {stats.keyCount >= 2 && (
                  <span style={{ marginLeft: 8, color: "#6dd66d", fontSize: 12 }}>
                    × {stats.keyCount} keys
                  </span>
                )}
              </div>
              <div style={{ color: "#9090a8", fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: "#e8e8f0" }}>{stats.total.image}</strong> image jobs · <strong style={{ color: "#e8e8f0" }}>{stats.total.anim}</strong> video jobs · <strong style={{ color: "#e8e8f0" }}>{stats.total.tts}</strong> TTS jobs running at once
              </div>
              {stats.keyCount === 1 && (
                <div style={{ color: "#ffce4d", fontSize: 12, marginTop: 6 }}>
                  💡 Add a second / third 69labs key in the field below to multiply parallel capacity. With 3 keys, generation time drops roughly 3×.
                </div>
              )}
              {stats.keyCount >= 2 && (
                <div style={{ color: "#6dd66d", fontSize: 12, marginTop: 6 }}>
                  ✓ Multi-key mode active — image/video generation runs ~{stats.keyCount}× faster than with one key. Heavier CPU load during the FFmpeg assembly stage on weak machines.
                </div>
              )}
            </div>
            <div style={{ color: "#5a5a70", fontSize: 11, textAlign: "right" }}>
              FFmpeg: {stats.assembleConcurrency} parallel clips<br />
              xfade chunks: {stats.xfadeChunks}
            </div>
          </div>
        </div>
      )}

      {/* ─── Required API keys (only group on this page) ───────────────── */}
      {MAIN_GROUPS.map((g) => (
        <GroupCard key={g.title} group={g} values={values} setValues={setValues} />
      ))}

      {/* ─── Google Drive Sync ─────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          marginBottom: 14,
          borderColor: "#3a5a8a",
          borderWidth: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Google Drive Sync</h3>
          <span
            style={{
              background: "#1d2a3a",
              color: "#7cb8ff",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            OPTIONAL
          </span>
        </div>
        <p style={{ color: "#8a8aa0", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          Auto-upload finished runs to your Google Drive. Final videos go to one folder, raw scene clips
          (without voiceover) plus a description blob go to another — so AI can later find relevant clips
          from past runs to reuse in new ones.
        </p>

        {/* Status banner */}
        {gdrive && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              marginBottom: 14,
              background: gdrive.connected
                ? "#1a2a1a"
                : gdrive.error
                  ? "#2a1a1a"
                  : "#1a1a28",
              border: `1px solid ${
                gdrive.connected ? "#3a5a3a" : gdrive.error ? "#5a3a3a" : "#2a2a3a"
              }`,
            }}
          >
            {gdrive.connected ? (
              <span style={{ color: "#6dd66d", fontWeight: 600, fontSize: 13 }}>
                ✓ Connected as{" "}
                <span style={{ color: "#e8e8f0" }}>{gdrive.email || "(unknown email)"}</span>
              </span>
            ) : gdrive.error ? (
              <div>
                {gdrive.errorKind === "api_not_enabled" ? (
                  <>
                    <div style={{ color: "#ff6d6d", fontWeight: 600, fontSize: 13 }}>
                      ❌ Google Drive API is not enabled in your Google Cloud project
                    </div>
                    <div style={{ color: "#cfcfdf", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                      Open the link below, click the blue <strong>Enable</strong> button, wait ~1 min, then refresh this page:
                    </div>
                    {gdrive.enableUrl && (
                      <a
                        href={gdrive.enableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#7c5cff",
                          fontSize: 12,
                          marginTop: 6,
                          display: "inline-block",
                          wordBreak: "break-all",
                        }}
                      >
                        {gdrive.enableUrl}
                      </a>
                    )}
                  </>
                ) : gdrive.errorKind === "auth_invalid" ? (
                  <div style={{ color: "#ff6d6d", fontWeight: 600, fontSize: 13 }}>
                    ❌ Token expired or revoked — click <strong>Reconnect</strong>
                  </div>
                ) : gdrive.errorKind === "network" ? (
                  <div style={{ color: "#ffce4d", fontWeight: 600, fontSize: 13 }}>
                    ⚠ Network error reaching Google — check your connection and refresh
                  </div>
                ) : (
                  <div style={{ color: "#ff6d6d", fontWeight: 600, fontSize: 13 }}>
                    ❌ Drive connection issue — see details below
                  </div>
                )}
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", color: "#9090a8", fontSize: 11 }}>
                    Raw error
                  </summary>
                  <div
                    style={{
                      color: "#9090a8",
                      fontSize: 11,
                      marginTop: 4,
                      fontFamily: "ui-monospace, monospace",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {gdrive.error}
                  </div>
                </details>
              </div>
            ) : gdrive.credentialsConfigured ? (
              <span style={{ color: "#ffce4d", fontWeight: 600, fontSize: 13 }}>
                ⚠ Not connected — click <strong>Connect Google Drive</strong> below
              </span>
            ) : (
              <span style={{ color: "#9090a8", fontWeight: 600, fontSize: 13 }}>
                ℹ Fill <code>GDRIVE_CLIENT_ID</code> + <code>GDRIVE_CLIENT_SECRET</code> below, click
                {" "}<strong>Save all changes</strong>, then come back to connect.
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {gdrive?.connected ? (
            <>
              <button className="btn-secondary" onClick={connectGdrive}>
                Reconnect (switch account)
              </button>
              <button
                className="btn-secondary"
                onClick={disconnectGdrive}
                style={{ color: "#ff8888" }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="btn"
              onClick={connectGdrive}
              disabled={!gdrive?.credentialsConfigured}
              style={{ opacity: gdrive?.credentialsConfigured ? 1 : 0.5 }}
            >
              Connect Google Drive
            </button>
          )}
        </div>

        {/* Auto-sync toggle */}
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: "#0e0e16",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={values.GDRIVE_SYNC_ENABLED === "1"}
              onChange={(e) =>
                setValues({ ...values, GDRIVE_SYNC_ENABLED: e.target.checked ? "1" : "" })
              }
              style={{ width: 16, height: 16 }}
            />
            <span>Auto-upload finished runs to Drive</span>
          </label>
          <span style={{ color: "#5a5a70", fontSize: 11 }}>
            Uploads final video + raw clips + metadata after each successful run. Toggle saves with
            <strong> Save all changes</strong>.
          </span>
        </div>

        {/* Credentials + folder inputs */}
        <div style={{ display: "grid", gap: 14 }}>
          {[
            {
              key: "GDRIVE_CLIENT_ID",
              desc: "OAuth Client ID from Google Cloud Console (Web Application type).",
              examples: "Format: 123456789-abc.apps.googleusercontent.com",
            },
            {
              key: "GDRIVE_CLIENT_SECRET",
              desc: "OAuth Client Secret from the same credential. Treated as a secret — masked after save.",
              examples: "Format: GOCSPX-xxxxxxxxxxxxxxxx",
            },
            {
              key: "GDRIVE_FINAL_VIDEOS_FOLDER_ID",
              desc: "Drive folder ID for finished videos. Leave empty to auto-create `Conveyer Grok/Final Videos/` in your Drive root on first sync.",
              examples: "From folder URL: drive.google.com/drive/folders/<THIS_PART>",
            },
            {
              key: "GDRIVE_CLIPS_LIBRARY_FOLDER_ID",
              desc: "Drive folder ID for per-run sub-folders with raw clips + clips.json + description.md. Leave empty to auto-create `Conveyer Grok/Clips Library/`.",
              examples: "Same format as above",
            },
          ].map((f) => (
            <div key={f.key}>
              <div style={{ marginBottom: 4 }}>
                <label
                  className="label"
                  style={{
                    margin: 0,
                    color: "#b8b8c8",
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: 0.3,
                  }}
                >
                  {f.key}
                </label>
              </div>
              <input
                className="input"
                value={values[f.key] ?? ""}
                placeholder={`e.g. ${f.examples}`}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
              <div style={{ color: "#9090a8", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                {f.desc}
              </div>
              <div
                style={{
                  color: "#5a5a70",
                  fontSize: 11,
                  marginTop: 4,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {f.examples}
              </div>
            </div>
          ))}
        </div>

        {/* Collapsible setup guide */}
        <details
          style={{
            marginTop: 14,
            padding: 12,
            background: "#0e0e16",
            borderRadius: 6,
            border: "1px solid #2a2a3a",
          }}
        >
          <summary
            style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#b8b8c8" }}
          >
            First-time setup (how to get Client ID / Secret)
          </summary>
          <ol
            style={{
              marginTop: 10,
              paddingLeft: 20,
              color: "#9090a8",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <li>
              Open{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#7c5cff" }}
              >
                Google Cloud Console
              </a>
            </li>
            <li>Create a new project (or reuse an existing one)</li>
            <li>
              APIs &amp; Services → Library → enable <strong>Google Drive API</strong>
            </li>
            <li>
              APIs &amp; Services → OAuth consent screen → <strong>External</strong> → add your
              Gmail to <strong>Test users</strong>
            </li>
            <li>
              APIs &amp; Services → Credentials → Create OAuth client →{" "}
              <strong>Web Application</strong>
            </li>
            <li>
              Authorized redirect URI:{" "}
              <code style={{ background: "#000", padding: "2px 6px", borderRadius: 4 }}>
                http://localhost:3000/api/gdrive/oauth/callback
              </code>
            </li>
            <li>
              Copy <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields
              above
            </li>
            <li>
              Click <strong>Save all changes</strong> at the top of the page
            </li>
            <li>
              Then click <strong>Connect Google Drive</strong> here — a browser tab will open, you
              approve access, and you'll be redirected back
            </li>
          </ol>
        </details>
      </div>
    </div>
  );
}
