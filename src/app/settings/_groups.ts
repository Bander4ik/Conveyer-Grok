/**
 * Single source of truth for the settings form schema.
 *
 * Shared between /settings (only `MAIN_GROUPS`) and /advanced (only
 * `ADVANCED_GROUPS`). Editing a field's description here updates it on whatever
 * page renders that group.
 */

export interface Field {
  key: string;
  label?: string;
  desc: string;
  examples?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface Group {
  title: string;
  subtitle?: string;
  required?: boolean;
  fields: Field[];
}

export const ALL_GROUPS: Group[] = [
  {
    title: "Required API Keys",
    subtitle: "The bare minimum needed to run the pipeline. Without these keys, nothing works.",
    required: true,
    fields: [
      {
        key: "GOOGLE_API_KEY",
        desc: "Powers scene splitting — Gemini reads your script and breaks it into individual scenes with visual prompts.",
        examples: "Get it free at https://aistudio.google.com/app/apikey (Create API key)",
        required: true,
      },
      {
        key: "LABS69_API_KEY",
        desc: "Key for image + Grok video generation through 69labs.vip.\n\nPRO TIP: You can paste multiple keys from different 69labs accounts (one per line, or comma-separated). Each account adds another 7 parallel image jobs + 5 parallel video jobs to the pool. With 3 keys, generation is roughly 3× faster. The platform automatically balances jobs across all keys and pairs image→video chains to the same key (so img2vid still works).",
        examples: "Single key: vk_abc... · Multiple keys: paste each on its own line. Each starts with vk_",
        required: true,
        multiline: true,
      },
      {
        key: "HEYGEN_API_KEY",
        desc: "HeyGen API key — generates the voiceover (TTS) for every scene. Get yours in the HeyGen dashboard → Settings → API.",
        examples: "Sign up / log in at https://app.heygen.com/settings/api",
        required: true,
      },
      {
        key: "HEYGEN_VOICE_ID",
        desc: "Which HeyGen voice to use. Pick (or clone) a voice once in the HeyGen dashboard, then paste its voice_id here. The pipeline calls HeyGen with text + this voice_id for every scene.",
        examples: "HeyGen dashboard → Voices → click a voice → copy its ID (UUID-like string)",
        required: true,
      },
    ],
  },
  {
    title: "Storage Location",
    subtitle: "Where the generated audio, images, and final videos are saved on disk.",
    fields: [
      {
        key: "RUNS_OUTPUT_DIR",
        desc: "Absolute folder path for run outputs. Leave empty to use the default location inside your user profile. The settings database itself stays in the default location regardless of this setting.",
        examples: "Mac: /Users/you/Documents/Conveyer-Runs  ·  Windows: D:\\YouTube\\Conveyer-Runs",
      },
      {
        key: "FFMPEG_PATH",
        desc: "Absolute path to the FFmpeg binary. Only needed if FFmpeg is not in your system PATH. The platform requires FFmpeg for video assembly.",
        examples: "Mac: /opt/homebrew/bin/ffmpeg (Apple Silicon) or /usr/local/bin/ffmpeg (Intel)  ·  Windows: C:\\ffmpeg\\bin\\ffmpeg.exe  ·  Leave empty if `ffmpeg` works in your terminal",
      },
    ],
  },
  {
    title: "Script Breakdown (LLM)",
    subtitle: "How your script gets divided into scenes, and which language model does the splitting.",
    fields: [
      {
        key: "SCENE_SPLIT_PROVIDER",
        desc: "Which LLM service splits your script into scenes. Gemini is cheap and fast. Claude is more thorough but costs more.",
        examples: "google  or  anthropic",
      },
      {
        key: "SCENE_SPLIT_MODEL",
        desc: "Specific model id. For Google, the `-latest` alias auto-tracks the current stable Flash. For Anthropic use the full model id.",
        examples: "gemini-flash-latest, gemini-2.5-flash, gemini-2.5-pro, claude-sonnet-4-6",
      },
    ],
  },
  {
    title: "Voice Over (TTS)",
    subtitle: "Picks the narrator voice and which TTS service generates the audio.",
    fields: [
      {
        key: "TTS_PROVIDER",
        desc: "Which TTS service generates the voiceover. `heygen` is the default for Conveyer Grok (uses HEYGEN_API_KEY + HEYGEN_VOICE_ID above). `69labs` routes through 69labs gateway. `elevenlabs` skips 69labs and uses ElevenLabs API key directly. `openai` uses gpt-4o-mini-tts.",
        examples: "heygen  /  69labs  /  elevenlabs  /  openai",
      },
      {
        key: "TTS_VOICE_PROVIDER",
        desc: "Inside 69labs, picks which voice family to use. ElevenLabs gives best quality. Edge TTS is free (Microsoft voices). Voice-clone uses celebrity clones (Lex Fridman, Joe Rogan, etc).",
        examples: "elevenlabs  /  edgetts  /  voice-clone",
      },
      {
        key: "TTS_VOICE_ID",
        desc: "The specific voice. Format depends on the voice-provider above. For ElevenLabs: voice ID from their library. For Edge: locale + voice name. For voice-clone: UUID from 69labs library.",
        examples: "ElevenLabs Christopher: G17SuINrv2H9FC6nvetn — Edge: en-US-GuyNeural, en-GB-RyanNeural, en-US-AriaNeural",
      },
      {
        key: "TTS_MODEL",
        desc: "Optional model override. For ElevenLabs `eleven_multilingual_v2` is the high-quality default. `eleven_flash_v2_5` is faster but slightly less expressive. Leave empty to use provider default.",
        examples: "eleven_multilingual_v2, eleven_flash_v2_5, gpt-4o-mini-tts",
      },
      {
        key: "TTS_SPLIT_TYPE",
        desc: "How the TTS service chunks your text internally. `smart` splits at sentence boundaries (best for narration). `paragraphs` only at paragraph breaks. `max_length` uses fixed sizes.",
        examples: "smart  /  paragraphs  /  max_length",
      },
    ],
  },
  {
    title: "Voice Fine-Tuning (ElevenLabs voices)",
    subtitle: "Subtle voice character controls. Active when TTS_VOICE_PROVIDER = elevenlabs — works whether you reach ElevenLabs directly or through 69labs's gateway. Ignored for edgetts and voice-clone. Defaults are tuned for slower, documentary-style narration.",
    fields: [
      {
        key: "TTS_SPEED",
        desc: "Speech rate. 1.0 = neutral pace. Lower values slow the voice down. 0.93 default sounds slightly more cinematic and gives the listener more time to absorb each sentence.",
        examples: "Range 0.7–1.2  ·  default 0.93",
      },
      {
        key: "TTS_STABILITY",
        desc: "How consistent the voice sounds across the whole audio. Higher = more uniform, less variation. Lower = more expressive but can sometimes wobble.",
        examples: "Range 0–1  ·  default 0.6 (balanced for narration)",
      },
      {
        key: "TTS_SIMILARITY_BOOST",
        desc: "How closely the synthesized voice matches the source reference. Higher = more faithful to the original voice's character.",
        examples: "Range 0–1  ·  default 0.75",
      },
      {
        key: "TTS_STYLE",
        desc: "Expressiveness. 0 = calm, even delivery. Higher values inject more emotional inflection. Documentary voices usually sit around 0.1–0.2.",
        examples: "Range 0–1  ·  default 0.15",
      },
      {
        key: "TTS_USE_SPEAKER_BOOST",
        desc: "Strengthens the unique character of the speaker. Useful when you notice the voice drifting toward a generic sound. Leave at `1` unless the output sounds harsh.",
        examples: "1 = enabled  ·  0 = disabled  ·  empty = provider default",
      },
    ],
  },
  {
    title: "Sentence Pauses (ElevenLabs voices)",
    subtitle: "Inserts automatic breath pauses BETWEEN sentences within a single scene's TTS. Active for ElevenLabs voices — works through 69labs's gateway too. Note: pauses between SCENES are handled separately via SCENE_TAIL_SILENCE in Video Assembly below.",
    fields: [
      {
        key: "TTS_AUTO_PAUSE",
        desc: "Turns automatic pauses on. When off, ElevenLabs may rush through periods. Recommended on for any narration longer than 30 seconds.",
        examples: "1 = enabled  ·  empty = disabled",
      },
      {
        key: "TTS_PAUSE_DURATION",
        desc: "How long each pause is. Documentaries usually sit around 0.3–0.5s. Audiobooks can go up to 0.8s for a more reflective tempo.",
        examples: "Range 0.1–30 seconds  ·  default 0.4",
      },
      {
        key: "TTS_PAUSE_FREQUENCY",
        desc: "How often the pause is inserted. 1 = every sentence boundary. Higher numbers add the pause less often (e.g. 5 = every 5th boundary).",
        examples: "Range 1–100  ·  default 1",
      },
    ],
  },
  {
    title: "Images",
    subtitle: "Generates one still image per scene. The same image is then either used directly (Ken-Burns zoom) or as the first frame for an img2vid clip.",
    fields: [
      {
        key: "IMAGE_PROVIDER",
        desc: "Which service hosts the image model. 69labs is the default — it routes to Google, OpenAI, Black Forest, etc internally with a single key.",
        examples: "69labs  /  replicate  /  openai  /  fal",
      },
      {
        key: "IMAGE_MODEL",
        desc: "The specific model. For photorealism try `imagen-4` (Google) or `seedream-4.5`. For balance of quality and detail try `nano-banana-pro` (default). For maximum hyperreal style try `flux-2-pro` (2 credits per image).",
        examples: "nano-banana-pro, imagen-4, seedream-4.5, gpt-image-2, flux-2-pro",
      },
      {
        key: "IMAGE_RATIO",
        desc: "Aspect ratio of generated images. 16:9 for landscape YouTube videos, 9:16 for vertical Shorts/Reels, 1:1 for thumbnails.",
        examples: "16:9, 9:16, 1:1, 4:3, 3:4",
      },
      {
        key: "IMAGE_RESOLUTION",
        desc: "Output resolution where supported. 1k is fastest and costs 1 credit. 2k looks visibly sharper but costs 3 credits per image. 4k is overkill for 1080p video output.",
        examples: "1k  /  2k  /  4k",
      },
    ],
  },
  {
    title: "Animations (img2vid)",
    subtitle: "Turns selected images into short video clips with real motion. Optional — leave provider on `off` to keep everything as static Ken-Burns photos.",
    fields: [
      {
        key: "ANIMATION_PROVIDER",
        desc: "Service for img2vid. `off` skips animation entirely. `69labs` routes to xAI Grok or Google Veo. `replicate`/`fal` open the door to Kling, Luma, Runway etc.",
        examples: "off  /  69labs  /  replicate  /  fal",
      },
      {
        key: "ANIMATION_MODEL",
        desc: "Specific model id. `grok-imagine-video` (xAI Grok) is the Conveyer Grok default — that's what this fork is built around. `veo-video` (Google Veo 3.1 Fast) is the alternate 69labs option. For Replicate, use `kwaivgi/kling-v1.6-pro` for cinematic motion.",
        examples: "grok-imagine-video, veo-video, kwaivgi/kling-v1.6-standard",
      },
      {
        key: "ANIMATION_RATIO_PERCENT",
        desc: "Percentage of scenes to animate. 100 = every scene is a video clip. 50 = half. 0 = none (Ken-Burns only).",
        examples: "0–100  ·  default 50",
      },
      {
        key: "ANIMATION_DISTRIBUTION",
        desc: "Which scenes get picked when ratio < 100. `first-half` puts video clips at the start (strong hook), photos at the end. `alternating` interleaves them. `random` picks scenes with motion keywords first.",
        examples: "first-half  /  alternating  /  random  /  all",
      },
      {
        key: "ANIMATION_DURATION",
        desc: "Length of each clip in seconds. IGNORED for Grok (69labs hard-blocks the duration parameter — always returns its fixed ~6s clip) and Veo (always ~6s). Only used for other providers (Kling via Replicate/fal). Sent as `<N>s` string.",
        examples: "empty = provider default  ·  4–10 = explicit (Kling/Replicate only)",
      },
      {
        key: "ANIMATION_KEEP_VEO_AUDIO",
        desc: "Whether to keep the ambient audio the video model bakes into each clip (Grok, Veo, etc.). Default empty — we mute it so only the HeyGen TTS narration is heard. Set `1` if you want the model's atmospheric sound layered behind the narrator. (Setting key is `ANIMATION_KEEP_VEO_AUDIO` for legacy reasons — applies to any model with embedded audio.)",
        examples: "empty = mute  ·  1 = keep ambient audio",
      },
    ],
  },
  {
    title: "Video Assembly (FFmpeg)",
    subtitle: "Final stitching step. Controls output resolution, framerate, and how scenes transition into each other.",
    fields: [
      {
        key: "VIDEO_RESOLUTION",
        desc: "Final video resolution. 1920x1080 (1080p) is the YouTube standard. 1280x720 (720p) is smaller files but lower quality. AI-generated source clips are upscaled/downscaled to fit.",
        examples: "1920x1080, 1280x720, 3840x2160",
      },
      {
        key: "VIDEO_FPS",
        desc: "Frames per second. 24 is cinematic feel. 30 is YouTube standard. 60 is smoother motion but doubles render time and file size.",
        examples: "24, 30, 60",
      },
      {
        key: "SCENE_DURATION_SECONDS",
        desc: "Fallback clip duration when TTS audio length is somehow unknown. In normal operation this is never used because we measure actual audio length with ffprobe.",
        examples: "default 5",
      },
      {
        key: "TRANSITION_DURATION",
        desc: "Crossfade length between scenes in seconds. 0.5 is a gentle blend. 1.0 is more cinematic. 0 disables transitions (instant cuts — much faster to render but looks abrupt).",
        examples: "0.5 = smooth  ·  1.0 = cinematic  ·  0 = no transitions",
      },
      {
        key: "SCENE_TAIL_SILENCE",
        desc: "Silence appended to the END of every scene's audio before assembly. This is the ONLY way to get pauses BETWEEN scenes — ElevenLabs's TTS_AUTO_PAUSE only handles pauses INSIDE one TTS call (intra-scene), and since each scene is a separate TTS call, scene boundaries get no breath without this setting. Raise to 0.6–0.8 if the narration still feels rushed at sentence endings.",
        examples: "0 = no padding (back-to-back)  ·  0.4 = natural breath (default)  ·  0.8 = reflective pacing",
      },
    ],
  },
  {
    title: "Performance (Concurrency)",
    subtitle: "How many parallel API jobs and FFmpeg renders to run at once. Higher = faster but risks rate limits. Defaults are tuned for 69labs's limits.",
    fields: [
      {
        key: "IMAGE_CONCURRENCY",
        desc: "Simultaneous image jobs PER KEY. 69labs's hard limit is 7 per account. We default to 5 to leave headroom for retries. With N keys configured, the total parallel capacity = this × N. Raise to 7 for maximum speed if you don't see 403 errors.",
        examples: "default 5  ·  max 7 per 69labs account  ·  total = this × number of keys",
      },
      {
        key: "TTS_CONCURRENCY",
        desc: "Simultaneous TTS jobs PER KEY. ElevenLabs through 69labs has generous limits. With multiple keys, you also get multiple per-account character quotas. Total = this × number of keys.",
        examples: "default 3  ·  bump to 5–7 if you have a paid subscription with high quota",
      },
      {
        key: "ANIMATION_CONCURRENCY",
        desc: "Simultaneous img2vid jobs PER KEY. 69labs's hard limit is 5 per account. We default to 3 for retry headroom. Total = this × number of keys.",
        examples: "default 3  ·  max 5 per 69labs account",
      },
      {
        key: "ASSEMBLE_CONCURRENCY",
        desc: "How many FFmpeg clip renders happen in parallel. This is CPU-bound — set roughly to half your CPU core count. A 16-core machine can comfortably handle 6–8.",
        examples: "default 4  ·  raise on 8+ core CPUs",
      },
      {
        key: "ASSEMBLE_XFADE_CHUNKS",
        desc: "Splits the final crossfade pass into N chunks that run in parallel, then crossfades the chunks together. Massively speeds up assembly for long videos (100+ scenes) because FFmpeg's xfade filter is single-threaded per pair. With 4 chunks, a 100-scene xfade on an 8-core CPU drops from ~50 min to ~12-15 min. Set to 1 to disable (monolithic xfade). Auto-skipped if you have fewer than 3×chunks scenes (i.e. 12 with default 4).",
        examples: "1 = no chunking  ·  4 = default (4-8 core CPU)  ·  6-8 for 16+ core CPUs",
      },
    ],
  },
  {
    title: "Optional / Alternative Providers",
    subtitle: "You only need these if you want to bypass 69labs and call providers directly. Leave empty if you're using the default 69labs stack.",
    fields: [
      {
        key: "ELEVENLABS_API_KEY",
        desc: "Direct ElevenLabs API key. Only used when TTS_PROVIDER is set to `elevenlabs` (not `69labs`).",
        examples: "Sign up at https://elevenlabs.io → Profile → API Keys",
      },
      {
        key: "REPLICATE_API_TOKEN",
        desc: "Replicate token, for using Flux Schnell or Kling models directly without 69labs. Useful if you want pay-as-you-go pricing.",
        examples: "Sign up at https://replicate.com → Account → API Tokens",
      },
      {
        key: "FAL_API_KEY",
        desc: "fal.ai key — alternative to Replicate. Faster cold starts in some cases.",
        examples: "Sign up at https://fal.ai → API keys",
      },
      {
        key: "ANTHROPIC_API_KEY",
        desc: "Anthropic Claude key. Only used when SCENE_SPLIT_PROVIDER is `anthropic`. Claude is more thorough than Gemini Flash but costs more.",
        examples: "Sign up at https://console.anthropic.com",
      },
      {
        key: "OPENAI_API_KEY",
        desc: "OpenAI key — for backup TTS (gpt-4o-mini-tts) or gpt-image-2 images.",
        examples: "Sign up at https://platform.openai.com",
      },
    ],
  },
];

/** Groups that stay on /settings (Keys & Settings). */
export const MAIN_GROUPS: Group[] = ALL_GROUPS.filter(
  (g) => g.title === "Required API Keys"
);

/** Groups that move to /advanced. */
export const ADVANCED_GROUPS: Group[] = ALL_GROUPS.filter(
  (g) => g.title !== "Required API Keys"
);
