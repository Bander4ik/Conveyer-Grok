"use client";
import type { Group } from "./_groups";

interface GroupCardProps {
  group: Group;
  values: Record<string, string>;
  setValues: (next: Record<string, string>) => void;
  /** Tighter spacing + smaller fonts for /advanced. */
  compact?: boolean;
}

/**
 * Renders one settings group as a single card with all its fields.
 * Shared between /settings (regular) and /advanced (compact).
 */
export function GroupCard({ group, values, setValues, compact = false }: GroupCardProps) {
  const cardPad = compact ? "10px 12px" : undefined;
  const cardMb = compact ? 8 : 14;
  const titleSize = compact ? 14 : 16;
  const subtitleMb = compact ? 10 : 14;
  const fieldGap = compact ? 10 : 14;
  const labelSize = compact ? 11 : 12;
  const descSize = compact ? 11 : 12;
  const exampleSize = compact ? 10 : 11;
  const descMt = compact ? 4 : 6;

  return (
    <div
      className="card"
      style={{
        marginBottom: cardMb,
        padding: cardPad,
        borderColor: group.required ? "#ff6d6d" : undefined,
        borderWidth: group.required ? 2 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontWeight: 700, fontSize: titleSize }}>{group.title}</h3>
        {group.required && (
          <span
            style={{
              background: "#3a1d1d",
              color: "#ff6d6d",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            REQUIRED
          </span>
        )}
      </div>
      {group.subtitle && (
        <p
          style={{
            color: "#8a8aa0",
            fontSize: compact ? 12 : 13,
            marginBottom: subtitleMb,
            lineHeight: 1.5,
          }}
        >
          {group.subtitle}
        </p>
      )}
      <div style={{ display: "grid", gap: fieldGap }}>
        {group.fields.map((f) => (
          <div key={f.key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <label
                className="label"
                style={{
                  margin: 0,
                  color: f.required ? "#ff8888" : "#b8b8c8",
                  fontWeight: 600,
                  fontSize: labelSize,
                  letterSpacing: 0.3,
                }}
              >
                {f.key}
              </label>
              {f.required && (
                <span style={{ color: "#ff6d6d", fontSize: 10, fontWeight: 700 }}>required</span>
              )}
            </div>
            {f.multiline ? (
              <textarea
                className="textarea"
                value={values[f.key] ?? ""}
                placeholder={f.examples ? `e.g. ${f.examples}` : ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                rows={Math.max(2, Math.min(6, (values[f.key] ?? "").split(/\n/).length + 1))}
                style={{
                  borderColor: f.required && !values[f.key] ? "#ff6d6d" : undefined,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 13,
                  padding: compact ? "6px 8px" : undefined,
                }}
              />
            ) : (
              <input
                className="input"
                value={values[f.key] ?? ""}
                placeholder={f.examples ? `e.g. ${f.examples}` : ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                style={{
                  borderColor: f.required && !values[f.key] ? "#ff6d6d" : undefined,
                  padding: compact ? "6px 8px" : undefined,
                  fontSize: compact ? 13 : undefined,
                }}
              />
            )}
            {f.key === "LABS69_API_KEY" && values[f.key] && (
              <div style={{ color: "#7c5cff", fontSize: 12, marginTop: 6 }}>
                🔑 Detected{" "}
                <strong>
                  {values[f.key]
                    .split(/[\n,;]+/)
                    .map((k) => k.trim())
                    .filter(Boolean).length}
                </strong>
                {" "}key
                {values[f.key].split(/[\n,;]+/).map((k) => k.trim()).filter(Boolean).length === 1
                  ? ""
                  : "s"}
              </div>
            )}
            <div
              style={{
                color: "#9090a8",
                fontSize: descSize,
                marginTop: descMt,
                lineHeight: 1.5,
                whiteSpace: "pre-line",
              }}
            >
              {f.desc}
            </div>
            {f.examples && (
              <div
                style={{
                  color: "#5a5a70",
                  fontSize: exampleSize,
                  marginTop: 4,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {f.examples}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
