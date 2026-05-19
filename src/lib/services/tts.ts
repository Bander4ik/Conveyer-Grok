import fs from "node:fs";
import path from "node:path";
import { getSetting } from "../settings";
import { log } from "../logger";
import type { Scene } from "./scene-split";
import { createTtsJob, pollJob, downloadJob } from "./labs69";

export interface TtsResult {
  /** Path to the mp3 file. */
  filePath: string;
  /** Approximate duration in seconds (from file size, refined later via ffprobe). */
  durationSec: number;
}

/**
 * Synthesizes one scene. Supports HeyGen (default for Conveyer Grok), 69labs,
 * ElevenLabs (direct), OpenAI TTS. Each file is sceneN.mp3 in the scene directory.
 */
export async function synthesizeScene(
  runId: string,
  scene: Scene,
  outDir: string
): Promise<TtsResult> {
  const provider = (getSetting("TTS_PROVIDER") || "heygen").toLowerCase();
  const fileName = `scene_${String(scene.index).padStart(3, "0")}.mp3`;
  const filePath = path.join(outDir, fileName);

  log(runId, "info", `TTS scene #${scene.index} (${provider})`, {
    stage: "tts",
    data: { provider, text: scene.text.slice(0, 80) },
  });

  if (provider === "heygen") {
    await heygenTts(runId, scene.text, filePath);
  } else if (provider === "69labs") {
    await labs69Tts(runId, scene.text, filePath);
  } else if (provider === "elevenlabs") {
    await elevenLabs(scene.text, filePath);
  } else if (provider === "openai") {
    await openaiTts(scene.text, filePath);
  } else {
    throw new Error(`Unknown TTS provider: ${provider}`);
  }

  const stats = fs.statSync(filePath);
  // Rough estimate: 16 KB/s for 128kbps mp3 — good enough for assembly.
  // Real duration is read via ffprobe in video-assemble.ts.
  const durationSec = Math.max(1, stats.size / 16000);

  log(runId, "success", `TTS done: ${fileName} (~${durationSec.toFixed(1)}s)`, {
    stage: "tts",
  });
  return { filePath, durationSec };
}

async function labs69Tts(runId: string, text: string, outPath: string) {
  const voiceId = getSetting("TTS_VOICE_ID") || "en-US-GuyNeural";
  const voiceProviderRaw = (getSetting("TTS_VOICE_PROVIDER") || "edgetts").toLowerCase();
  const voiceProvider =
    voiceProviderRaw === "elevenlabs" || voiceProviderRaw === "edgetts" || voiceProviderRaw === "voice-clone"
      ? (voiceProviderRaw as "elevenlabs" | "edgetts" | "voice-clone")
      : "edgetts";
  const modelId = getSetting("TTS_MODEL") || undefined;
  const splitTypeRaw = (getSetting("TTS_SPLIT_TYPE") || "smart").toLowerCase();
  const splitType =
    splitTypeRaw === "paragraphs" || splitTypeRaw === "max_length"
      ? (splitTypeRaw as "smart" | "paragraphs" | "max_length")
      : "smart";

  // ElevenLabs-specific fine-tuning
  const voiceSettings: {
    stability?: number;
    similarityBoost?: number;
    speed?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  } = {};
  if (voiceProvider === "elevenlabs") {
    const stability = parseFloatOr(getSetting("TTS_STABILITY"), NaN);
    const similarity = parseFloatOr(getSetting("TTS_SIMILARITY_BOOST"), NaN);
    const speed = parseFloatOr(getSetting("TTS_SPEED"), NaN);
    const style = parseFloatOr(getSetting("TTS_STYLE"), NaN);
    const speakerBoost = getSetting("TTS_USE_SPEAKER_BOOST");

    if (!Number.isNaN(stability)) voiceSettings.stability = clamp(stability, 0, 1);
    if (!Number.isNaN(similarity)) voiceSettings.similarityBoost = clamp(similarity, 0, 1);
    if (!Number.isNaN(speed)) voiceSettings.speed = clamp(speed, 0.7, 1.2);
    if (!Number.isNaN(style)) voiceSettings.style = clamp(style, 0, 1);
    if (speakerBoost === "1") voiceSettings.useSpeakerBoost = true;
    else if (speakerBoost === "0") voiceSettings.useSpeakerBoost = false;
  }

  // Auto-pause — stops TTS from rushing through sentence ends
  const autoPauseEnabled = getSetting("TTS_AUTO_PAUSE") === "1";
  const autoPauseDuration = parseFloatOr(getSetting("TTS_PAUSE_DURATION"), NaN);
  const autoPauseFrequency = parseFloatOr(getSetting("TTS_PAUSE_FREQUENCY"), NaN);

  const jobId = await createTtsJob({
    text,
    voiceId,
    voiceProvider,
    modelId,
    splitType,
    voiceSettings,
    autoPauseEnabled,
    autoPauseDuration: !Number.isNaN(autoPauseDuration) ? clamp(autoPauseDuration, 0.1, 30) : undefined,
    autoPauseFrequency: !Number.isNaN(autoPauseFrequency) ? clamp(autoPauseFrequency, 1, 100) : undefined,
  });
  log(runId, "debug", `69labs TTS job ${jobId.slice(0, 8)}… (${voiceProvider}/${voiceId}, speed=${voiceSettings.speed ?? "default"}, pause=${autoPauseEnabled ? `${autoPauseDuration}s` : "off"})`, { stage: "tts" });
  await pollJob("tts", jobId, runId, "tts");
  await downloadJob("tts", jobId, outPath);
}

function parseFloatOr(s: string, fallback: number): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * HeyGen TTS — primary provider for Conveyer Grok.
 *
 * The VA picks (or clones) a voice once in the HeyGen dashboard → gets a
 * voice_id → user pastes it into /settings (HEYGEN_VOICE_ID). For every scene
 * the pipeline calls HeyGen with text + voice_id → gets back an mp3.
 *
 * Endpoint: `POST https://api.heygen.com/v3/voices/speech` (current v3 API)
 *   Body: { voice_id, text, locale?, speed?, pitch? }
 *   Auth: X-Api-Key header
 *   Response: may return either direct audio bytes (Content-Type: audio/*) OR
 *             JSON like { data: { audio_url: "..." } } — we handle both.
 *
 * Fallback: if v3 returns 404 on the user's plan, we retry on the legacy
 * `POST /v1/audio/text_to_speech` endpoint with the same body shape.
 * (HeyGen has shuffled this across API versions; both endpoints currently exist.)
 */
async function heygenTts(runId: string, text: string, outPath: string) {
  const apiKey = getSetting("HEYGEN_API_KEY");
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not set — paste it in /settings");
  const voiceId = getSetting("HEYGEN_VOICE_ID");
  if (!voiceId)
    throw new Error(
      "HEYGEN_VOICE_ID is not set — pick a voice in HeyGen dashboard and paste the voice_id in /settings"
    );

  // Optional speed control — reuse the global TTS_SPEED setting (clamped to HeyGen's 0.5–1.5).
  const speedSetting = parseFloat(getSetting("TTS_SPEED"));
  const speed = Number.isFinite(speedSetting)
    ? Math.max(0.5, Math.min(1.5, speedSetting))
    : undefined;

  const body: Record<string, unknown> = { voice_id: voiceId, text };
  if (speed !== undefined) body.speed = speed;

  const tryEndpoint = async (url: string): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        // Hint that we'd happily take raw audio back if the server prefers streaming
        Accept: "audio/mpeg, audio/wav, application/json",
      },
      body: JSON.stringify(body),
    });

  // Primary: v3. Fall back to legacy v1 if v3 fails for any of the known
  // "voice engine mismatch" reasons:
  //   - 404 (endpoint not enabled on the user's plan)
  //   - 400 with "VoiceProvider.STARFISH" / "not supported" (the voice_id is
  //     bound to an engine that /v3/voices/speech can't serve — common for
  //     stock or cloned voices that only legacy /v1 supports)
  let resp = await tryEndpoint("https://api.heygen.com/v3/voices/speech");

  if (!resp.ok) {
    // Peek at the error message without consuming the stream
    const errBodyV3 = await resp.text();
    const shouldFallback =
      resp.status === 404 ||
      (resp.status === 400 &&
        /voiceprovider|voice engine|not supported|invalid voice/i.test(errBodyV3));
    if (shouldFallback) {
      log(
        runId,
        "debug",
        `HeyGen v3 returned ${resp.status} (${errBodyV3.slice(0, 120)}) — falling back to /v1/audio/text_to_speech`,
        { stage: "tts" }
      );
      resp = await tryEndpoint("https://api.heygen.com/v1/audio/text_to_speech");
    } else {
      throw new Error(`HeyGen TTS ${resp.status}: ${errBodyV3.slice(0, 300)}`);
    }
  }

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`HeyGen TTS ${resp.status}: ${errBody.slice(0, 300)}`);
  }

  // Two response shapes possible:
  // (a) raw audio bytes (Content-Type: audio/mpeg or audio/wav) — write to disk directly
  // (b) JSON wrapper { data: { audio_url } } — download from the URL
  const contentType = (resp.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.startsWith("audio/") || contentType === "application/octet-stream") {
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    log(runId, "debug", `HeyGen TTS (raw audio, ${buf.length} bytes, voice=${voiceId.slice(0, 8)}…)`, {
      stage: "tts",
    });
    return;
  }

  // JSON path — try common audio_url field names
  const json = (await resp.json()) as {
    data?: { audio_url?: string; url?: string; audioUrl?: string };
    audio_url?: string;
    audioUrl?: string;
    url?: string;
  };
  const audioUrl =
    json.data?.audio_url ?? json.data?.url ?? json.data?.audioUrl ?? json.audio_url ?? json.audioUrl ?? json.url;
  if (!audioUrl) {
    throw new Error(
      `HeyGen TTS returned no audio_url. Payload: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  log(runId, "debug", `HeyGen TTS audio_url ready (voice=${voiceId.slice(0, 8)}…) — downloading`, { stage: "tts" });

  const audioResp = await fetch(audioUrl);
  if (!audioResp.ok) {
    throw new Error(`Failed to download HeyGen audio: ${audioResp.status} ${audioResp.statusText}`);
  }
  fs.writeFileSync(outPath, Buffer.from(await audioResp.arrayBuffer()));
}

async function elevenLabs(text: string, outPath: string) {
  const apiKey = getSetting("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const voiceId = getSetting("TTS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";
  const model = getSetting("TTS_MODEL") || "eleven_multilingual_v2";

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: model }),
    }
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`ElevenLabs ${resp.status}: ${body.slice(0, 300)}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

async function openaiTts(text: string, outPath: string) {
  const apiKey = getSetting("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const model = getSetting("TTS_MODEL") || "gpt-4o-mini-tts";
  const voice = getSetting("TTS_VOICE_ID") || "alloy";

  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, voice, input: text, format: "mp3" }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI TTS ${resp.status}: ${body.slice(0, 300)}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}
