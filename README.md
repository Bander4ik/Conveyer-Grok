# Conveyer Grok

**An AI pipeline for making faceless YouTube videos automatically — powered by Grok video and HeyGen voiceover.**

Paste a script. The system splits it into scenes, generates voiceover for each scene (HeyGen TTS), generates a video clip for each scene (using xAI's Grok models via 69labs), and stitches everything together with smooth transitions into a single MP4 ready to upload.

Everything runs locally on your computer through a simple web interface. Finished runs auto-upload to your Google Drive (optional), and the AI can reuse clips from past runs when scenes look similar — so the more videos you make, the cheaper and faster each new one becomes.

Multiple prompt presets are supported — save a different system prompt per channel and switch between them on each run.

---

## Table of contents

- [What you need before starting](#what-you-need-before-starting)
- [Part 1 — Install required programs](#part-1--install-required-programs)
  - [1.1 Install Git](#11-install-git)
  - [1.2 Install Node.js](#12-install-nodejs)
  - [1.3 Install FFmpeg](#13-install-ffmpeg)
- [Part 2 — Download and install Conveyer Grok](#part-2--download-and-install-hum-conveyer)
- [Part 3 — Get the API keys](#part-3--get-the-api-keys)
- [Part 4 — First launch and configuration](#part-4--first-launch-and-configuration)
- [Part 5 — (Optional) Connect Google Drive](#part-5--optional-connect-google-drive)
- [Part 6 — Make your first video](#part-6--make-your-first-video)
- [Updating to the latest version](#updating-to-the-latest-version)
- [Common problems and fixes](#common-problems-and-fixes)
- [How it works under the hood](#how-it-works-under-the-hood)
- [Where files are stored on disk](#where-files-are-stored-on-disk)
- [License](#license)

---

## What you need before starting

- **A computer running Windows 10/11 or macOS** (Linux also works but isn't covered in this guide)
- **About 5 GB free disk space**
- **A stable internet connection** (the first install downloads ~600 MB)
- **A Google account** (free — used for both the Gemini API key and Google Drive sync)
- **A 69labs account** (paid subscription — covers voice, images, and video generation through one key)
- **About 30 minutes** for the first-time setup

You don't need any prior programming experience. Every command in this guide can be copy-pasted exactly as shown.

> **Word of warning:** the steps below ask you to use the **command line**. On Windows it's called **Command Prompt** or **PowerShell**. On macOS it's called **Terminal**. Don't worry — you'll just paste commands and press Enter. You won't need to understand them.

---

## Part 1 — Install required programs

These three programs need to be installed **once** on your computer. After that, you only ever touch Conveyer Grok itself.

### 1.1 Install Git

**Git** is what lets you download the project and pull updates later.

#### On Windows

1. Open https://git-scm.com/download/win in your browser.
2. The download should start automatically. If not, click the **Click here to download** link.
3. Open the downloaded file (it will be called something like `Git-2.43.0-64-bit.exe`).
4. A setup wizard opens. **Click Next on every screen** — the defaults are fine. The wizard has about 15 screens, just keep clicking Next, then Install at the end.
5. When it finishes, click **Finish**.

To confirm it worked:
1. Press the **Windows key**, type `cmd`, press Enter. A black window (Command Prompt) opens.
2. Paste this and press Enter:
   ```
   git --version
   ```
3. You should see something like `git version 2.43.0.windows.1`. If yes, Git is installed.

#### On macOS

1. Open the **Terminal** app. To find it: press **⌘ + Space**, type `terminal`, press Enter.
2. Paste this and press Enter:
   ```
   xcode-select --install
   ```
3. A pop-up window appears asking to install **Command Line Developer Tools**. Click **Install** and accept the license. Wait a few minutes for it to finish.

To confirm it worked, in Terminal type:
```
git --version
```
You should see something like `git version 2.39.3 (Apple Git-145)`.

---

### 1.2 Install Node.js

**Node.js** is the engine that runs the Conveyer Grok code.

1. Open https://nodejs.org/ in your browser.
2. On the homepage you'll see two big green buttons. Click the one on the **left** labeled **"LTS"** (Recommended For Most Users). It will say something like `20.10.0 LTS` or higher.
3. The download starts — `.msi` file on Windows, `.pkg` file on macOS.
4. Open the downloaded file and click **Next / Continue** on every screen. Accept the license. Click **Install**. You may need to enter your computer password.
5. When it finishes, click **Close** / **Finish**.

To confirm it worked, **close any open Command Prompt / Terminal windows and open a fresh one** (this is important — Node isn't visible to windows opened before installation). Then:

```
node --version
```

You should see something like `v20.10.0`. If yes, Node is installed.

---

### 1.3 Install FFmpeg

**FFmpeg** is what stitches your clips into the final video.

#### On Windows

1. Open **Command Prompt as administrator**:
   - Press the **Windows key**
   - Type `cmd`
   - **Right-click** on "Command Prompt" → **Run as administrator**
   - Confirm the UAC prompt
2. Paste this and press Enter:
   ```
   winget install Gyan.FFmpeg
   ```
3. Wait a minute for it to download and install. You'll see a progress bar.
4. **Close this Command Prompt window and open a new one** (FFmpeg won't be visible in old windows).
5. Type:
   ```
   ffmpeg -version
   ```
   You should see text starting with `ffmpeg version 6.x.x`. If yes, FFmpeg is installed.

#### On macOS

1. First install **Homebrew** if you don't have it. Open https://brew.sh in your browser. Copy the long command from that page (starts with `/bin/bash -c "$(curl ...`). Paste it into Terminal, press Enter. Follow the prompts. This takes 5–10 minutes.
2. Once Homebrew is installed, in Terminal type:
   ```
   brew install ffmpeg
   ```
3. Wait a few minutes for it to download.
4. Confirm:
   ```
   ffmpeg -version
   ```
   You should see `ffmpeg version 6.x.x`.

---

## Part 2 — Download and install Conveyer Grok

Now that the three required programs are in place, let's get Conveyer Grok itself.

### Step 1. Choose a folder

You're going to download the project into a folder on your computer. Pick somewhere easy to find — `Documents` works fine.

- **Windows:** open Command Prompt, type:
  ```
  cd %USERPROFILE%\Documents
  ```
- **macOS:** open Terminal, type:
  ```
  cd ~/Documents
  ```

### Step 2. Download the project

Paste this exactly into your Command Prompt / Terminal and press Enter:

```
git clone https://github.com/Bander4ik/Hum-Conveyer.git
```

It will download for 10–30 seconds. You should see something like:
```
Cloning into 'Hum-Conveyer'...
remote: Enumerating objects: ...
Receiving objects: 100% ...
```

### Step 3. Enter the project folder

```
cd Hum-Conveyer
```

Now your terminal is inside the project folder. Don't close the window.

### Step 4. Install dependencies

```
npm install
```

This downloads all the libraries the project needs (~600 MB total). It takes **3–8 minutes** depending on your internet speed. You'll see lots of text scrolling. **This is normal** — wait for it to finish.

When done, you'll see something like:
```
added 412 packages, and audited 413 packages in 4m
```

> ⚠️ **Windows antivirus warning:** Windows Defender sometimes corrupts native code files during `npm install`, which breaks the project. If you later see errors mentioning `swc-win32-x64-msvc` or `better_sqlite3.node` being "not a valid Win32 application", that's what happened.
>
> **Prevention** — before running `npm install`, add the project folder to Windows Defender exclusions:
> 1. Open **Windows Security** (Start → type "Windows Security" → Enter)
> 2. Click **Virus & threat protection**
> 3. Click **Manage settings** under "Virus & threat protection settings"
> 4. Scroll down to **Exclusions** → click **Add or remove exclusions**
> 5. Click **Add an exclusion** → **Folder** → pick the `Hum-Conveyer` folder
> 6. Re-run `npm install` if you'd already had it fail

---

## Part 3 — Get the API keys

You need **two** keys. Both go into the app's Settings page in Part 4.

### Key 1 — Google API key (for splitting scripts into scenes)

1. Open https://aistudio.google.com/app/apikey in your browser.
2. Sign in with your Google account.
3. Click the blue **Create API key** button.
4. A new key appears, starting with `AIza...`. Click the copy icon next to it.
5. Save it somewhere safe (a sticky note, password manager, anywhere) — you'll paste it into the app shortly.

This key is **free** for the usage levels you'll need. No payment info required.

### Key 2 — 69labs API key (for voice + images + video generation)

1. Open https://69labs.vip in your browser.
2. Sign up / sign in.
3. Pick a subscription plan that fits your usage.
4. In your account dashboard, find the **API Keys** section.
5. Copy your key — it starts with `vk_...`.

> 💡 **Pro tip:** you can use multiple 69labs accounts simultaneously. Each adds another **7 parallel image jobs + 5 parallel video jobs** to your generation pool. With 2 keys, the platform runs roughly 2× faster. Just paste each key on its own line in Settings.

---

## Part 4 — First launch and configuration

### Step 1. Start the app

In your Command Prompt / Terminal window (still inside the `Hum-Conveyer` folder), run:

```
npm run dev
```

After 1–2 seconds, you should see:
```
▲ Next.js 16.x.x (Turbopack)
- Local:    http://localhost:3000
✓ Ready in 1300ms
```

**Don't close this window** — that's the running server. Whenever you want to use the app, this window must stay open. To stop the app, press **Ctrl+C** in this window.

#### Shortcut for next time (optional)

For your convenience, the project includes one-click launch files. After installation:

- **Windows:** double-click `start.bat` in the `Hum-Conveyer` folder
- **macOS:** double-click `start.command` in the Hum-Conveyer folder. The first time, macOS may block it — right-click → Open → confirm.

These do the same thing as `npm run dev` and open the browser automatically.

### Step 2. Open the app in your browser

Open any browser (Chrome / Edge / Safari / Firefox). In the address bar type:

```
http://localhost:3000
```

You should see the **Conveyer Grok** interface with a sidebar (New run / Run history / Library / Prompts / Keys & Settings / Advanced settings).

### Step 3. Paste your API keys

1. In the sidebar, click **Keys & Settings**.
2. You'll see two red-bordered fields under **Required API Keys**:
   - `GOOGLE_API_KEY` — paste the key from Part 3, Key 1 (starts with `AIza...`)
   - `LABS69_API_KEY` — paste the key from Part 3, Key 2 (starts with `vk_...`). If you have multiple 69labs accounts, paste each key on its own line.
3. Scroll to the top of the page. Click the purple **Save all changes** button.
4. If everything is correct, you'll see a green **Saved ✓** confirmation.

The platform is now ready to make videos.

---

## Part 5 — (Optional) Connect Google Drive

This step is **optional**, but strongly recommended. With Drive connected:

- Every finished run auto-uploads to your Google Drive
- Raw video clips go to a "Clips Library" folder, final videos go to "Final Videos"
- When you start a new run, the AI searches your library and suggests reusing clips from past runs that match the new scenes — saving generation time and 69labs credits

### Step 1. Create a Google Cloud project

1. Open https://console.cloud.google.com/ in your browser.
2. Sign in with the same Google account you want to use for storing clips.
3. At the top of the page, next to the Google Cloud logo, there's a **project selector** (initially says "Select a project"). Click it.
4. In the pop-up, click **New project**.
5. Give it any name you like (e.g. "Conveyer Grok"). Click **Create**.
6. Wait a few seconds. The page refreshes. Click the project selector again and pick your new project.

### Step 2. Enable Google Drive API

1. In the search bar at the top of the page, type `Google Drive API` and press Enter.
2. Click on **Google Drive API** in the results.
3. Click the blue **Enable** button.
4. Wait a few seconds for it to enable.

### Step 3. Set up OAuth consent screen

1. Top-left, click the hamburger menu (three lines) → **APIs & Services** → **OAuth consent screen**.
2. Choose **External**, click **Create**.
3. Fill in **App name** (anything — e.g. "Conveyer Grok") and **User support email** (your email).
4. Scroll down. Under **Developer contact information**, put your email again.
5. Click **Save and Continue**.
6. On the **Scopes** screen, click **Save and Continue** without changes.
7. On the **Test users** screen, click **Add users**. Add the same Google email you use. Click **Save and Continue**.
8. Click **Back to Dashboard**.

### Step 4. Create OAuth credentials

1. In the left sidebar, click **Credentials**.
2. At the top, click **+ Create Credentials** → **OAuth client ID**.
3. **Application type:** select **Web application**.
4. **Name:** anything (e.g. "Conveyer Grok Local").
5. Scroll down to **Authorized redirect URIs**. Click **+ Add URI**. Paste:
   ```
   http://localhost:3000/api/gdrive/oauth/callback
   ```
6. Click **Create**.
7. A pop-up shows your **Client ID** and **Client secret**. Copy both — you'll need them in a moment.

### Step 5. Paste credentials into Conveyer Grok

1. Back in the app (http://localhost:3000), go to **Keys & Settings**.
2. Scroll down to the blue-bordered **Google Drive Sync** section.
3. Paste your `Client ID` into the `GDRIVE_CLIENT_ID` field.
4. Paste your `Client secret` into the `GDRIVE_CLIENT_SECRET` field.
5. Leave the two folder ID fields **empty** — the app will auto-create folders on first sync.
6. Tick the checkbox **Auto-upload finished runs to Drive**.
7. Scroll up. Click **Save all changes**.

### Step 6. Authorize the app

1. The blue Google Drive section status banner should now say **"⚠ Not connected"**.
2. Click the purple **Connect Google Drive** button.
3. Your browser redirects to Google's sign-in page. Sign in with the Google account you added as a test user.
4. Google shows a warning **"Google hasn't verified this app"** — this is normal because the app is yours, not published publicly. Click **Advanced** → **Go to [App Name] (unsafe)**.
5. Approve the requested permissions ("See, edit, create, and delete only the specific Google Drive files you use with this app").
6. You're redirected back to Conveyer Grok. You should see a pop-up "Google Drive connected ✓".
7. The status banner now shows **"✓ Connected as your@gmail.com"**.

Drive is now ready. Finished runs will auto-upload.

> If you see **"Token expired or revoked"** — actually that wording is misleading; usually it means the Drive API isn't enabled yet. Read the raw error message — it will give you a direct link to enable the API for your project. Click it, press **Enable**, wait one minute, refresh the Settings page.

---

## Part 6 — Make your first video

1. In the sidebar, click **New run**.
2. (Optional) Give it a title — e.g. `Test video 1`.
3. Paste your script into the big text box. Anything goes — a story, a documentary script, a YouTube essay. ~300 words gives you a ~2-minute video.
4. **The simplest path** — just click **Run pipeline**. Watch the live logs on the next page. After 5–15 minutes, you'll have a downloadable MP4.
5. **With library search** (only useful once you have past runs in Drive):
   - Click **👁 Preview scenes first** — see how the script gets split into scenes
   - Click **🔍 Find existing clips from library** — the AI scans your Drive and suggests reusable clips at 80% confidence or higher
   - High-confidence matches are auto-checked. Click any scene to expand and review/change picks
   - Click **Run pipeline (reusing N clips)** — the marked scenes skip video generation entirely, the rest generate fresh

The pipeline takes:
- **Short videos (1–3 min)**: ~5–10 minutes total
- **Medium videos (5–10 min)**: ~15–30 minutes
- **Long videos (15+ min)**: ~30–60 minutes

These numbers are with one 69labs key. Adding a second key roughly halves all of them.

While the pipeline runs, you can:
- Watch the live log stream
- See per-scene progress
- Cancel anytime
- Open the run folder on disk
- Once finished — play the video right in the browser, download as MP4, see Drive sync status

---

## Updating to the latest version

When a new version of Conveyer Grok is released:

1. Open Command Prompt / Terminal.
2. Go into the project folder:
   ```
   cd ~/Documents/Hum-Conveyer        # macOS
   cd %USERPROFILE%\Documents\Hum-Conveyer   # Windows
   ```
3. Stop the running app if it's running (press **Ctrl+C** in the server window).
4. Pull the latest code:
   ```
   git pull
   ```
5. Re-install dependencies (only takes ~30 seconds if nothing major changed):
   ```
   npm install
   ```
6. Start the app again:
   ```
   npm run dev
   ```

**Your API keys, prompts, and run history are NOT affected.** They live in a separate folder (`~/.conveyer-isabell/`) outside the project tree, so updates can never delete them.

---

## Common problems and fixes

### "is not a valid Win32 application" or `next-swc.win32-x64-msvc.node` errors (Windows)
Windows Defender truncated a downloaded binary during `npm install`. Add the project folder to Defender exclusions (see warning box at the end of Part 2), then delete `node_modules` and re-run `npm install`:
```
rmdir /s /q node_modules
npm install
```

### `npm install` fails with permissions errors (macOS)
Try with sudo:
```
sudo npm install
```
If sudo is also failing, your Node install is probably broken — reinstall Node from https://nodejs.org/.

### Port 3000 is already in use
Another app is using port 3000. Either close that app, or run on a different port:
```
PORT=3001 npm run dev
```
Then open http://localhost:3001 instead.

> Note: the Google Drive OAuth callback is hardcoded to port 3000. If you want Drive sync on a different port, also edit the `Authorized redirect URI` in your Google Cloud OAuth credentials.

### "Save failed: Internal Server Error" on Settings page
The SQLite database is locked or the better-sqlite3 native module didn't install correctly. Try:
```
npm rebuild better-sqlite3
```
If that doesn't fix it, see the antivirus warning in Part 2 and reinstall.

### "Token expired or revoked" in Drive section
Misleading message — usually means Google Drive API isn't enabled for your Google Cloud project yet. Expand the "Raw error" details in the banner, click the link to the Google Cloud console, click **Enable**, wait 1 minute, refresh Settings.

### Pipeline crashed mid-run, but I have files on disk
On the run page, if the pipeline failed but most scenes finished, you'll see a **"Reassemble from existing assets"** button. Click it — it stitches the saved scenes into a final video without re-generating anything.

### Final video has scenes running too fast / out of sync
Open **Advanced settings** → **Voice fine-tuning** → lower `TTS_SPEED` to e.g. `0.90` (slower speech). Also try raising `SCENE_TAIL_SILENCE` to `0.6` for more breathing room between scenes.

---

## How it works under the hood

For the curious:

```
your script
    │
    ▼
[1] Scene split (Gemini)
    "Break the script into 5-second narration chunks with a visual prompt per chunk"
    │
    ▼
[2] For each scene IN PARALLEL:
       ├─ TTS (69labs → ElevenLabs / Edge / voice clones) — narration MP3
       └─ Veo text-to-video (69labs) — 6-second silent clip
          OR if marked for reuse: download from Drive instead
    │
    ▼
[3] FFmpeg per-scene render
    Combine narration + video into one MP4 clip,
    stretching / freezing / trimming so durations match
    │
    ▼
[4] FFmpeg final assembly
    Crossfade all clips into one final.mp4
    │
    ▼
[5] Drive sync (if enabled)
    Upload raw clips + clips.json + description.md + final video to Google Drive,
    delete local raw clips to keep disk usage minimal
```

Every stage logs in real time to the run page so you see what's happening.

---

## Where files are stored on disk

The application **separates** code from data so updates can never destroy your work.

**Code** (replaced on every `git pull`):
- Whatever folder you cloned into (e.g. `~/Documents/Hum-Conveyer`)

**Data** (persistent across updates):
- **Database** (settings, API keys, run records, logs):
  - macOS / Linux: `~/.conveyer-isabell/isabell.db`
  - Windows: `C:\Users\YOU\.conveyer-isabell\isabell.db`
- **Run outputs** (audio, video clips, final.mp4):
  - default: `~/.conveyer-isabell/runs/<run-folder>/`
  - configurable via **Advanced settings → RUNS_OUTPUT_DIR**

When Google Drive sync is on, raw clips are uploaded then **deleted locally** to save space. The final video and audio files stay on disk.

> **macOS users:** the folder starts with a dot, so Finder hides it. To see it, press **⌘ + Shift + .** (period) in Finder, or **⌘ + Shift + G** and paste `~/.conveyer-isabell/`.

---

## License

MIT — see [LICENSE](./LICENSE).
