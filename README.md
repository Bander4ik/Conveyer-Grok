# Conveyer Grok

**An AI pipeline for making faceless YouTube videos automatically — powered by Grok video and HeyGen voiceover.**

Paste a script. The system splits it into scenes, generates voiceover for each scene (HeyGen TTS), generates a video clip for each scene (xAI Grok via 69labs), and stitches everything into a single MP4 ready to upload to YouTube.

Everything runs locally on your computer through a simple web interface. Finished runs auto-upload to your Google Drive (optional), and the AI can reuse clips from past runs when scenes look similar — so the more videos you make, the cheaper and faster each new one becomes.

Channel profiles supported — save a per-channel bundle (scene-split prompt, HeyGen voice, motion style) and switch between them in one click on each run.

---

## Documentation

| Doc | What's in it |
|---|---|
| **[INSTALL.md](./docs/INSTALL.md)** | Step-by-step install for Windows + macOS — for users with zero programming experience |
| **[USAGE.md](./docs/USAGE.md)** | How to use the platform — making videos, library reuse, multi-key setup |
| **[PROMPT-GUIDE.md](./docs/PROMPT-GUIDE.md)** | How to write a Prompt Preset for your YouTube niche, with a full worked example |

---

## Quick start (if you already have Git, Node 20+, FFmpeg)

```bash
git clone https://github.com/Bander4ik/Conveyer-Grok.git
cd Conveyer-Grok
npm install
npm run dev
```

Open http://localhost:3000 → **Keys & Settings** → paste your `GOOGLE_API_KEY`, `LABS69_API_KEY`, `HEYGEN_API_KEY`, `HEYGEN_VOICE_ID` → Save.

Then **New run** → paste script → **Run pipeline**. First video done in 5–10 minutes.

For full onboarding (installing prerequisites, getting API keys, Drive setup), see [INSTALL.md](./docs/INSTALL.md).

---

## What's the stack

- **Next.js 16** (Turbopack) + **React 19** + **TypeScript** + **Tailwind 4**
- **Gemini Flash** — script → scene split (cheap, free tier OK for tests)
- **HeyGen TTS** — voiceover per scene (`/v3/voices/speech`, falls back to `/v1/audio/text_to_speech`)
- **xAI Grok via 69labs** — text-to-video, ~6-second clips per scene
- **FFmpeg** — per-scene render + crossfade assembly
- **better-sqlite3** — local DB at `~/.conveyer-grok/grok.db`
- **Google Drive** — optional auto-upload + AI-search reuse across past runs

---

## How it works under the hood

```
script
  │
  ▼
[1] Scene split (Gemini) → JSON array of {text, visual_prompt, duration_hint_sec}
  │
  ▼
[2] Per scene IN PARALLEL:
       ├─ HeyGen TTS    → narration MP3
       └─ Grok via 69labs → 6-second silent video clip
                            (or download existing clip from Drive if reusing from library)
  │
  ▼
[3] Per-scene render (FFmpeg) → MP4 with audio + video synced
  │
  ▼
[4] Final assembly (FFmpeg) → crossfade all clips into final.mp4
  │
  ▼
[5] (Optional) Drive sync → upload final.mp4 + raw clips + metadata
```

Concurrency: up to 3 TTS + 3 video jobs in flight per 69labs key. With 3 keys configured, 9 video jobs run in parallel.

---

## Where files live

- **Code** (replaced on `git pull`) — wherever you cloned (e.g. `~/Documents/Conveyer-Grok`)
- **Data** (persistent, never wiped by updates):
  - macOS / Linux: `~/.conveyer-grok/`
  - Windows: `C:\Users\YOU\.conveyer-grok\`

Data folder contains `grok.db` (SQLite — your settings, prompts, run history) and `runs/<folder>/` (per-run audio + video + final.mp4).

---

## License

MIT — see [LICENSE](./LICENSE).
