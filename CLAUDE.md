# CLAUDE.md — project context for Claude Code

This file is auto-loaded by Claude Code. It gives you (Claude) the full picture
of Conveyer Grok so you can confidently answer questions and make changes.

---

## What Conveyer Grok is

A **local web app** that turns a written script into a finished faceless-YouTube
MP4. The user pastes a script; the app splits it into scenes, generates a
voiceover and a short video clip per scene, and stitches everything into one
video. It runs entirely on the user's machine (Next.js dev server + local
SQLite + local FFmpeg). There is no hosted backend.

**Target users**: non-technical YouTube channel operators. UX must stay simple.
**Primary operator**: Vlad (mentor) builds/extends it; his mentees (e.g. Miguel
of Bull Network) use it and request features.

---

## Origin / history

- Forked from **Hum Conveyer** (which was itself forked from **Conveyer Isabell**).
- Hum Conveyer used **Google Veo** for video and **69labs/ElevenLabs** for TTS.
- Conveyer Grok swaps that to **xAI Grok** for video (via 69labs) and **HeyGen**
  for voiceover.
- Because of the fork lineage, some legacy names survive intentionally:
  - The DB column `prompt_presets.content` actually holds the scene_split prompt.
  - The setting key `ANIMATION_KEEP_VEO_AUDIO` applies to any model, not just Veo.
  - The `image-gen.ts` service + `IMAGE_*` settings exist but are dead (the
    pipeline is video-only). Don't delete them blindly — `IMAGE_RATIO` is still
    read as the video aspect ratio.

---

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** · **Tailwind 4**
- **better-sqlite3** — local DB at `~/.conveyer-grok/grok.db`
- **fluent-ffmpeg** — video assembly (needs system FFmpeg)
- **@anthropic-ai/sdk** — optional Claude scene-split path
- **googleapis** — Google Drive sync
- Node ≥ 20. Dev server: `npm run dev` on port 3000.

---

## Pipeline — end to end

Entry point: `POST /api/runs` → inserts a `runs` row → calls `runPipeline()` in
the background → redirects the UI to `/runs/[id]` which streams logs.

`src/lib/pipeline.ts` `runPipeline(runId, script)`:

1. **Scene split** — `splitScript()` in `services/scene-split.ts`. Sends script
   + system prompt to Gemini (default) or Claude. Returns `Scene[]`, each with
   `text`, `visual_prompt`, `duration_hint_sec`. The system prompt is the
   chosen channel profile's `scene_split`, else the global default.
2. **Per scene, in parallel** (concurrency-limited via `plimit.ts`):
   - `synthesizeScene()` (`services/tts.ts`) → narration MP3. Default provider
     HeyGen (`heygenTts`), with 69labs / ElevenLabs / OpenAI as alternatives.
   - `animateScene()` (`services/img2vid.ts`) → ~6s silent video clip via Grok
     through 69labs. OR, if the scene was marked for reuse, `downloadReusedClip()`
     pulls an existing clip from Google Drive instead.
3. **Per-scene render** — `services/video-assemble.ts` combines narration + clip
   into one MP4 per scene, matching durations (trim / stretch / pad).
4. **Final assembly** — FFmpeg xfade-concatenates all scene clips → `final.mp4`.
5. **Drive sync** (if enabled) — `services/run-upload.ts` uploads final video +
   raw clips + `clips.json` + `description.md`, then deletes local raw clips.

Every stage writes to `run_logs` via `logger.ts`; the run page streams them over
Server-Sent Events (`/api/runs/[id]/logs`).

---

## Key external services

| Service | Used for | Notes |
|---|---|---|
| **Google Gemini** | scene split | `GOOGLE_API_KEY`. Free tier fine. |
| **69labs.vip** | Grok video generation | `LABS69_API_KEY`. Multi-key supported (newline/comma separated). Each key = 5 parallel video jobs. |
| **HeyGen** | TTS voiceover | `HEYGEN_API_KEY` + `HEYGEN_VOICE_ID`. Endpoint `/v3/voices/speech`, falls back to `/v1/audio/text_to_speech`. |
| **Google Drive** | optional sync + reuse | OAuth2, callback `localhost:3000/api/gdrive/oauth/callback`. |

### Hard external constraints (don't fight these)

- **Grok via 69labs returns a fixed ~6s clip.** 69labs runtime-blocks the
  `duration` parameter for Grok — sending it (any format) returns HTTP 400.
  So scene-split prompts MUST keep each scene ≤ ~6s of narration.
- **HeyGen STARFISH voices** (avatar/streaming engine) do NOT work for standalone
  TTS. Users must pick an ElevenLabs- or Panda-engine voice. `tts.ts` detects
  the STARFISH error and throws a clear diagnostic.
- **Windows Defender** truncates native `.node` binaries on `npm install`.
  `scripts/fix-native-binaries.mjs` (postinstall) restores them from a sibling
  project on Windows; it no-ops on macOS/Linux.

---

## File map

```
src/
├── app/
│   ├── layout.tsx              Root layout — renders <Sidebar/> + content
│   ├── _sidebar.tsx            Client sidebar, active-route highlighting
│   ├── globals.css             Premium design system (tokens + component classes)
│   ├── page.tsx                New Run page
│   ├── runs/page.tsx           Run history list
│   ├── runs/[id]/page.tsx      Run detail — logs (SSE), final video, assets
│   ├── library/page.tsx        Drive library browser
│   ├── prompts/page.tsx        Channels & Prompts (channel profiles + defaults)
│   ├── settings/page.tsx       Keys & Settings (required keys + Drive)
│   ├── settings/_groups.ts     Settings form schema (single source of truth)
│   ├── settings/_group-card.tsx  Renders one settings group
│   ├── advanced/page.tsx       Advanced settings
│   └── api/
│       ├── runs/route.ts             POST create run, GET list
│       ├── runs/[id]/route.ts        GET one run
│       ├── runs/[id]/logs/route.ts   SSE log stream
│       ├── runs/[id]/assets/route.ts GET scene assets on disk
│       ├── runs/[id]/cancel/route.ts POST cancel
│       ├── runs/[id]/drive/route.ts  GET/POST Drive sync for a run
│       ├── runs/[id]/file/route.ts   GET serve a run file
│       ├── runs/[id]/open-folder/route.ts  POST open run folder in OS
│       ├── runs/[id]/reassemble/route.ts   DISABLED (returns 410)
│       ├── prompts/route.ts          GET/POST default prompts
│       ├── prompt-presets/route.ts   GET list / POST create channel profile
│       ├── prompt-presets/[id]/route.ts  GET/PUT/DELETE channel profile
│       ├── preview/scenes/route.ts   POST scene-split preview (no run created)
│       ├── library/runs/route.ts     GET Drive library listing
│       ├── library/find-similar/route.ts  POST AI clip matching
│       ├── settings/route.ts         GET/POST settings
│       ├── stats/route.ts            GET concurrency capacity
│       └── gdrive/*                  OAuth start/callback, status, disconnect
└── lib/
    ├── db.ts                   SQLite open + schema + migrations
    ├── settings.ts             SETTING_KEYS, DEFAULTS, get/set helpers
    ├── prompts.ts              DEFAULT_PROMPTS + channel-profile CRUD
    ├── pipeline.ts             runPipeline orchestrator
    ├── run-paths.ts            DATA_DIR + per-run folder paths
    ├── logger.ts               writes run_logs
    ├── plimit.ts               tiny concurrency limiter
    ├── cancellation.ts         cooperative run cancellation
    ├── init.ts                 ensureInit — seeds defaults
    └── services/
        ├── scene-split.ts      script → Scene[] via Gemini/Claude
        ├── tts.ts              HeyGen / 69labs / ElevenLabs / OpenAI TTS
        ├── img2vid.ts          Grok / Veo / Kling video generation
        ├── labs69.ts           69labs client + multi-key pool
        ├── video-assemble.ts   FFmpeg per-scene render + final xfade
        ├── gdrive.ts           Google Drive client
        ├── run-upload.ts       upload a finished run to Drive
        ├── library.ts          AI clip-matching for reuse
        ├── reuse.ts            download a reused clip from Drive
        └── image-gen.ts        DEAD (video-only) — kept for legacy safety
docs/                           INSTALL.md, USAGE.md, PROMPT-GUIDE.md
scripts/
├── fix-native-binaries.mjs     postinstall — restore .node on Windows
└── reassemble.mjs              DISABLED stub
```

---

## Data model (`grok.db`)

- **settings** — `key` → `value`. All config. See `SETTING_KEYS` in `settings.ts`.
- **prompts** — the 3 default prompts (`scene_split`, `image_prompt`,
  `animation_motion`).
- **prompt_presets** — channel profiles. Columns: `id`, `name`, `content`
  (= scene_split prompt), `description`, `animation_motion`, `image_prompt`,
  `heygen_voice_id`, timestamps. Optional columns NULL = inherit global default.
- **runs** — one row per run. Includes `preset_*` snapshot columns (the chosen
  channel profile is copied onto the run so deleting the profile later doesn't
  break old runs) and `reuse_map_json` (scene → Drive file id).
- **run_logs** — append-only log lines streamed to the run page.

The DB lives **outside** the project tree (`~/.conveyer-grok/`) so `git pull`
updates never touch user data. Schema changes use `tryAddColumn()` in `db.ts`
(SQLite has no `ADD COLUMN IF NOT EXISTS`).

---

## Core concepts

- **Channel profile** — a per-channel bundle: scene_split prompt + optional
  HeyGen voice_id + optional animation-motion override + description. Picked on
  the New Run page. UI label "Channels"; DB table `prompt_presets`.
- **Library reuse** — after Drive sync, the AI can match new scenes against past
  uploaded clips and skip generation for high-confidence matches.
- **Multi-key 69labs** — `LABS69_API_KEY` accepts several `vk_` keys; `labs69.ts`
  load-balances jobs across them via a key pool, binding each job to its key.

---

## Conventions & gotchas

- **Don't change pipeline logic for a UI request** and vice versa — keep them separate.
- TypeScript must stay clean: run `npx tsc --noEmit` before committing.
- Settings form is schema-driven — add a field by editing `_groups.ts`, and add
  the key to `SETTING_KEYS` + `DEFAULTS` in `settings.ts`.
- Adding a channel-profile field: one column in `db.ts` (`tryAddColumn`), update
  `PromptPreset` + CRUD in `prompts.ts`, the two `/api/prompt-presets` routes,
  and the `/prompts` page form. Snapshot it onto `runs` if the pipeline needs it.
- UI uses the design tokens / component classes in `globals.css` — prefer
  `var(--…)` and `.btn` / `.card` / `.input` over hardcoded colors.
- The project path can contain spaces (`Conveyer Grok`) — always use `path.join`.
- Secrets in settings are masked with `…` when sent to the UI; the save handler
  skips any value still containing `…` so it doesn't overwrite the real key.

---

## How to verify a change

1. `npx tsc --noEmit` — must be 0 errors.
2. `npm run dev`, open `http://localhost:3000`, exercise the changed page.
3. For pipeline changes, run a short (~30s) script end-to-end and watch the logs.

---

## Out of scope (deliberately not built)

- **Avatar video assembly** — Bull Network has a separate avatar auto-editor;
  Conveyer Grok is text-to-AI-video only. Don't merge the two.
- **Auto-overlay** (arrows / text / infographics) — kept as a manual editor step.
- **Reassemble-from-disk** — the old Isabell route is disabled; re-running the
  pipeline with library reuse covers the same need.

See also: `docs/INSTALL.md`, `docs/USAGE.md`, `docs/PROMPT-GUIDE.md`, `README.md`.
