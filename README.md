# Lofi Focus

A cozy, self-hosted pomodoro page: lofi music, ambient sounds and animated pixel-art scenes.
No accounts, no paywall, no tracking, no build step. It's just static files.

## Features

- **Pomodoro timer**: focus, short-break and long-break modes with configurable lengths, auto-start,
  a chime, optional desktop notifications and a daily session count. The timer keeps accurate
  time in background tabs and survives a page reload. Use the −/+ buttons beside the clock
  (or ↑/↓) to change a mode's length. During a session they add or remove time from just that
  session. You can drag the timer anywhere on screen.
- **Music**: YouTube (videos, 24/7 live streams, playlists) through the official embedded player, or
  plain internet-radio streams. Comes with Lofi Girl, Chillhop and a few SomaFM stations. Paste
  any link to add your own.
- **Ambient sounds**: rain, thunder, wind, ocean waves, fireplace, café, birds, crickets, and
  white, pink and brown noise. Each one is **synthesised live in the browser**, so there are no
  audio files and no loops you can hear repeating. Mix them with sliders or pick a preset.
  At night, bird sounds become owl hoots.
- **To-do lists**: as many lists as you like. Drag tasks into priority order, check them off,
  or press ◎ to send a task to the timer.
- **Habits**: a numbered list you can drag into priority order, with a checkbox for each day of
  the week, streaks, and navigation to earlier weeks.
- **Stopwatch & countdowns**: a stopwatch with laps, plus any number of named countdowns
  (presets or your own time). Each one chimes and shows a notification when it's done.
- **Journal**: dated entries that save as you type, with search. You can download it as
  Markdown or save it to **Google Drive** (see below).
- **Calendar**: a month view of focus sessions, habit check-ins, finished tasks and journal
  entries. Click a day for details, with links straight to that day's journal entries.
  Optionally shows your **Google Calendar** events, and can log finished focus sessions to it.
- **Animated scenes**: study desk, café window, fireside, park bench, campfire guitar and
  fishing dock. Each has **Morning, Afternoon, Evening and Night** lighting, or **Auto** to
  follow your clock. On a phone held upright you still see the whole scene: the wall or sky
  above and the floor below are extended to fill the screen, instead of the sides being cut off.
- **Sounds you can see** (optional): rain falls on screen or on the window, thunder flashes,
  wind blows leaves and sways trees and curtains, bird sounds bring out birds (owls at night),
  and crickets bring fireflies after dark.
- **Customize** (palette button): outfit and hair colours; headphones/hat on or off, and their
  colour; furniture and tent colours; a cat or dog; and a friend who joins you in every scene
  except the study desk.
- **Clock** with 12- or 24-hour time, which you can move anywhere on screen. It can also show
  the **local temperature** in °F, °C or both, from [Open-Meteo](https://open-meteo.com), which
  is free and needs no API key. You can use your browser location or type a city.
- Zen mode, fullscreen, an interface that fades when you're idle, and keyboard shortcuts
  (Space, R, S, ↑/↓, M, N, L, Z, F).

Everything (journal, to-do lists, habits, countdowns, focus history, stations, sound mix and
settings) is stored in the browser's `localStorage`. Use **Settings → Your data** to download
a backup file or import one. **Settings → Google** can also save to and restore from
Google Drive.

## Google setup (Drive and Calendar)

Because this is a static page with no server, Google features need an OAuth Client ID from your
own (free) Google Cloud project. It's a one-time setup:

1. Go to <https://console.cloud.google.com/>, create a project, and enable the
   **Google Drive API** and the **Google Calendar API**.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your
   email, and add yourself under **Test users**. Leave the app in *Testing*. It only works for
   the test users you list, and Google shows an "unverified app" notice you can click through.
   That's expected for a personal tool, and there's no review needed.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → *Web application*.
   Under **Authorized JavaScript origins**, add every address you'll open the page from, such as
   `http://localhost:8080` and `https://yourname.github.io`.
4. Copy the Client ID (`…apps.googleusercontent.com`) into `js/config.js` so it applies to
   everyone using your copy, or paste it into **Settings → Google → Google setup** for this
   browser only.

Sign-in happens in a Google popup and gives the page an access token that lasts about an hour.
Nothing secret is stored. After an hour, the next Drive save or **Connect** in the Calendar
signs in again, usually with one click.

**Save to Drive** creates a `Lofi Focus` folder containing:
- `lofi-focus-backup.json`: everything, used by **Restore from Drive** on another computer.
- `Journal.md`, `To-do.md` and `Habits.md`: readable copies.

With `drive.file` access the app can only see files it created itself, never the rest of your
Drive. Turn on **Keep the Drive copy up to date automatically** and it re-saves about 30 seconds
after each change while you're signed in.

**Google Calendar** uses your primary calendar with the `calendar.events` scope. Events are
fetched for the month you're viewing and kept in memory only. If you tick **Add finished focus
sessions to Google Calendar**, each finished session becomes a "🍅 Focus — your task" event
marked as *free*. Sessions that finish while you're signed out wait in a queue and are added
the next time you connect.

## Run it locally

YouTube's embedded player refuses to run from a `file://` page, so serve the folder over http:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Host it

It's plain static files. Any static host will do:

- **GitHub Pages**: push this folder to a repo, then go to Settings → Pages → Deploy from branch → `main` / root.
- **Netlify / Cloudflare Pages / Vercel**: drag and drop the folder, or connect the repo. No build command is needed and the output directory is `/`.
- **Your own server**: copy the files into any nginx, Caddy or Apache web root.

## Notes for work networks

- If YouTube is blocked on your network, the page shows a message. Switch to one of the
  **RADIO** stations (SomaFM), which are ordinary audio streams.
- Google Drive and Calendar need `accounts.google.com` and `www.googleapis.com`. If those are
  blocked, use **Download backup** instead.
- The temperature needs `api.open-meteo.com`. If that's blocked, the clock simply doesn't show it.
- Ambient sounds and scenes need nothing from the network. The only external request besides
  music is the Google Font (Nunito), and the page falls back to your system font without it.

## Customising

| What | Where |
| --- | --- |
| Default stations | `DEFAULT_STATIONS` in `js/music.js` |
| Sound recipes | `BUILD` in `js/ambient.js` |
| Scenes | One file per scene in `js/scenes/`, registered with `Lofi.scenes.register()`. Each is a `create(W, H)` that returns a `draw(ctx, t, dt, env)` function, drawn on a 270px-tall canvas. Load order (which is also the menu order) is set in `index.html` |
| Shared scene parts | `js/scenes/kit.js`: lighting `PHASES`, figures, pets, birds, flames, and `autoPhase()` (Auto's hours) |
| Sound effects in scenes | `soundFx()`, `drawRain()` and `drawWind()` in `js/app.js`, plus `env.fx` in each scene |
| Presets | `PRESETS` in `js/app.js` |
| Productivity panels | `js/todos.js`, `js/habits.js`, `js/clocks.js`, `js/journal.js`, `js/calendar.js` |
| Google sign-in, Drive, Calendar | `js/google.js`, `js/backup.js`, `js/gcal.js` (Client ID default in `js/config.js`) |
| Customization | `DEFAULT_LOOK`, `drawPet`, `perchBird` and `owl` in `js/scenes/kit.js`, swatches in `js/app.js` |
| Colours and layout | `css/style.css` |
