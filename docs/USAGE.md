# Usage guide — how to make videos with Conveyer Grok

This guide assumes you've already finished installation. If not, see [INSTALL.md](./INSTALL.md).

After install, you open `http://localhost:3000` in your browser and see the Conveyer Grok interface with a left sidebar. Everything happens through that interface — no editing config files, no rebuilding.

---

## Sidebar at a glance

| Page | What it does |
|---|---|
| **New run** | Where you paste a script and start making a video |
| **Run history** | All your past runs — status, final video, logs |
| **Library** | Browse clips from past runs on Google Drive (if Drive sync is on) |
| **Prompts** | Manage prompt presets (one per channel) + default prompts |
| **Keys & Settings** | API keys, Drive credentials, basic settings |
| **Advanced settings** | TTS fine-tuning, FFmpeg options, concurrency, model choice |

---

## Making your first video (3 minutes setup, 10–30 minutes generation)

### Step 1 — Paste API keys (one-time)

Go to **Keys & Settings** and fill in:

- `GOOGLE_API_KEY` — your Gemini key from [aistudio.google.com](https://aistudio.google.com/app/apikey) (free)
- `LABS69_API_KEY` — your 69labs key (starts with `vk_`)
- `HEYGEN_API_KEY` — your HeyGen key
- `HEYGEN_VOICE_ID` — voice_id of the voice you want to use (from HeyGen → Voices → click voice → copy ID)

Click **Reveal secret values** if you need to edit existing keys (they're masked by default).

Click **Save all changes**. You should see green confirmation.

### Step 2 — (Optional but recommended) Set up a prompt preset

Default prompts work, but you'll get much better, more on-brand results with a preset tuned to your channel niche.

Go to **Prompts** → **Add new preset** → name it (e.g. *"Channel Name — niche style"*) → paste your system prompt content → **Save**.

See [PROMPT-GUIDE.md](./PROMPT-GUIDE.md) for what to put in the preset and a full worked example.

### Step 3 — Paste script, run pipeline

Go to **New run**.

1. (Optional) Give the run a title — useful for finding it later in Run history
2. **Prompt preset** dropdown → pick the preset for this channel. Leave at *"Default scene_split prompt"* to use the global default
3. **Script** textarea → paste your full narrator script. Anything from 30 seconds to 30 minutes works.

Below the script box you'll see live stats: word count, estimated duration, estimated scenes, estimated total generation time.

Click **Run pipeline** — that's it. The page redirects to live logs and you can watch each scene generate in real time.

---

## What happens during a run

The pipeline runs 5 phases automatically. You don't intervene — just watch the logs.

```
[1] Scene split (Gemini)
    Your script + preset → JSON array of scenes (each with text + visual_prompt + duration)
       ↓
[2] Per scene IN PARALLEL:
       ├─ HeyGen TTS → narration MP3
       └─ Grok via 69labs → 6-second silent video clip
           (or, if you picked Library reuse: download existing clip from Drive)
       ↓
[3] Per-scene render (FFmpeg)
    Combine narration + video into one MP4 clip per scene, sync durations
       ↓
[4] Final assembly (FFmpeg)
    Crossfade all scene clips into one final.mp4
       ↓
[5] (Optional) Drive sync
    Upload raw clips + clips.json + description.md + final video to your Google Drive
    Delete local raw clips to save disk space
```

Time per video:
- **30-second test script**: 2–5 minutes
- **2–3 minute video**: 5–10 minutes
- **10-minute video**: 15–25 minutes
- **25-minute video**: 40–80 minutes

These are with ONE 69labs key. Each extra key roughly halves total time (parallel jobs).

---

## Library reuse — save credits on similar scenes

If you've connected Google Drive AND made a few runs already, the AI can browse your past clips and reuse ones that match new scenes — skipping Grok generation for those scenes entirely.

On the New Run page:

1. Paste script as usual
2. Click **Preview scenes first** (instead of Run pipeline)
3. The page shows the scene split + a button **Find existing clips from library**
4. Click it — the AI scores every scene against your Drive library and auto-checks matches at 80% confidence or higher
5. Review the checked picks — uncheck any you don't like, expand a scene to see alternative matches
6. Click **Run pipeline (reusing N clips)** — N scenes skip generation, the rest generate fresh

This pays off quickly. The more videos you make, the more matches the library finds.

---

## Prompt presets — one preset per channel

If you run multiple YouTube channels with different styles, save a preset for each:

- *"Channel A — Blue Zone documentary"* — Mediterranean visuals, dignified pacing
- *"Channel B — Tech explainer"* — futuristic visuals, kinetic motion
- *"Channel C — Cooking how-to"* — kitchen close-ups, warm food shots

Each preset can also include an **Animation Motion override** — different motion style per channel (slow contemplative vs energetic fast). Leave it empty to inherit the global default.

On the New Run page, pick which preset to use from the dropdown. The run "remembers" which preset it used (snapshot is saved on the run), so deleting a preset later doesn't break old runs.

See [PROMPT-GUIDE.md](./PROMPT-GUIDE.md) for how to write a preset.

---

## After a run finishes

On the run's detail page (under Run history) you can:

- **Play the final video** right in the browser
- **Download MP4** — to upload to YouTube or edit further
- **See Drive sync status** — link to the run's folder in your Drive
- **Open run folder** — opens the local folder with all assets (audio MP3s, individual scene MP4s, final.mp4)
- **Read full logs** — every step of the pipeline, useful for debugging

If something went wrong mid-run (a scene failed, the LLM produced bad output), the page shows which scene + what error.

---

## Where your files live

Two separate locations — code and data are kept apart so updates can never destroy your work.

**Code** (replaced on every `git pull`):
- The folder you cloned into (e.g. `~/Documents/Conveyer-Grok`)

**Data** (persistent — settings, run records, all your work):
- macOS / Linux: `~/.conveyer-grok/`
- Windows: `C:\Users\YOU\.conveyer-grok\`

Inside that folder:
- `grok.db` — your settings, API keys, prompts, presets, run history
- `runs/<run-folder>/` — per-run output (audio, animations, final.mp4)

You can change `runs/` location in **Advanced settings → RUNS_OUTPUT_DIR** if you want runs on a different disk.

> **macOS users** — the folder starts with a dot so Finder hides it. Press **⌘ + Shift + .** in Finder to show hidden folders, or **⌘ + Shift + G** and paste `~/.conveyer-grok/`.

---

## Multi-key 69labs — running faster

Each 69labs account has hard limits: 7 parallel images + 5 parallel videos. With multiple accounts you multiply parallelism — 3 keys = 21 image / 15 video slots simultaneously.

To use multiple keys:

1. Go to **Keys & Settings → LABS69_API_KEY**
2. Paste each `vk_...` key on its own line (or separate them with commas)
3. **Save all changes**

The pipeline automatically load-balances jobs across all configured keys. Each key has its own concurrency counter; the next job goes to the least-loaded account.

The header on the New Run page shows current key count and effective parallel capacity. With N keys, expect roughly N× faster generation (limited by total Grok throughput across accounts).

---

## Common questions

### How long can my video be?

No hard limit. The pipeline handles scripts from 30 seconds to 30+ minutes. Longer scripts = more scenes = more generation time + more 69labs credits used.

### How long can each clip be?

Fixed at ~6 seconds per scene (Grok via 69labs limitation — we cannot ask for longer). The scene split prompt enforces this by keeping each scene's narration ≤ 6 seconds, so the visual doesn't freeze on the last frame.

### Can I edit the final video?

Yes — download the MP4 and open in any editor. All raw scene clips are also saved on disk (and Drive if sync is on) so you can swap individual scenes manually.

### What if a scene fails?

The pipeline retries each scene up to 3 times with exponential backoff. If a scene still fails after retries, the run continues — you'll see the failed scene in the logs and final video skips that scene (or fails the whole run if too many scenes fail). For now, the easiest fix is to re-run the pipeline; **Library reuse** will pick up the scenes that succeeded last time, so only the failed ones regenerate.

### Can I use different video models (Veo / Kling) instead of Grok?

Yes — **Advanced settings → ANIMATION_MODEL**. Conveyer Grok defaults to `grok-imagine-video` because that's what this fork was built for, but you can switch to `veo-video` (Google Veo via 69labs) or other providers. Note: this is mainly for experimentation — the default prompts are tuned for Grok's 6s clip length.

### Where are my videos uploaded?

If Drive sync is on:
- Final MP4 → `Conveyer Grok/Final Videos/<run-folder>.mp4` in your Drive
- Raw clips → `Conveyer Grok/Clips Library/<run-folder>/` (scene clips + `clips.json` metadata + `description.md` human-readable summary)

The "Conveyer Grok" root folder is separate from any other forks (Hum Conveyer, Conveyer Isabell, etc.) so you can run multiple variants without collisions.
