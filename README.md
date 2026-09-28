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
- **Customize** (palette button): outfit and hair colours; headphones, a hat or neither, and its
  colour (your friend wears the same kind, in their own colours); furniture and tent colours;
  a cat or dog; and a friend who joins you in every scene except the study desk.
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

This is a static page with no server, so the Google features need an **OAuth Client ID** from
your own (free) Google Cloud project. It's a one-time setup, but Google's console has quite a
few steps. The screens below are from the 2026 **Google Auth Platform** layout: *Branding*,
*Audience*, *Data Access* and *Clients*. Older guides call the same things "OAuth consent
screen" and "Credentials".

You don't need a client secret. Never put one in this page, because everything here is public.

### 1. Create the project and turn on the APIs

1. Open <https://console.cloud.google.com/> and create a project (for example "Lofi Focus").
2. **APIs & Services → Library**: enable the **Google Drive API** and the **Google Calendar API**.

### 2. Google Auth Platform → Branding

Fill this in completely and click **Save** at the very bottom. Publishing fails with "you must
complete your configuration on the Branding page" if anything is missing.

| Field | What to enter |
| --- | --- |
| App name | Anything without "Google" in it, e.g. `Lofi Focus` |
| User support email | Pick your address from the dropdown |
| App logo | **Leave empty.** Uploading a logo means Google has to review the app before it can be published. |
| Application home page | Your site, e.g. `https://lofi.example.com` |
| Application privacy policy link | `https://lofi.example.com/privacy.html`. This page ships with the app, see `privacy.html` |
| Application terms of service link | Leave empty |
| Authorized domains | Your registrable domain without `https://`, e.g. `example.com` or `yourname.github.io`. Press Enter so it turns into a chip. |
| Developer contact information | Your email address |

### 3. Google Auth Platform → Audience

- **User type: External.** If your project belongs to a Google Workspace or school
  organisation, choose External anyway. With *Internal*, personal `@gmail.com` accounts are
  rejected and show "Ineligible accounts not added".
- Then choose who can sign in:
  - **Just you (and a few people): stay in *Testing*** and add each person's Google address
    under **Test users**, typed in lowercase. There's a limit of 100.
  - **Friends, without adding each address: click *Publish app*.** Anyone with a Google account
    can then sign in. Because Calendar's scope is "sensitive" and the app isn't verified by
    Google, people see a **"Google hasn't verified this app"** screen. They click **Advanced →
    Go to *your site* (unsafe)** to continue, and an unverified app is limited to 100 users.
    Removing that warning requires Google's formal verification (domain proof, a privacy
    policy, a demo video), which isn't worth it for a personal tool.

### 4. Google Auth Platform → Data Access

Click **Add or remove scopes** and add exactly these two, which are all the app ever asks for:

- `https://www.googleapis.com/auth/drive.file`: only files this app creates (non-sensitive).
- `https://www.googleapis.com/auth/calendar.events`: read and add events on your calendars
  (sensitive, which is why the warning above appears).

### 5. Google Auth Platform → Clients

1. **Create client → Web application**, and give it any name.
2. Under **Authorized JavaScript origins**, add every address you open the page from, **exactly**
   as your browser shows it. To be sure, run `location.origin` in the browser's console.
   - Include `http://` or `https://`, and the port if there is one: `http://localhost:8080`.
   - No trailing slash, no path, no wildcards.
   - `http://localhost:8080` and `http://127.0.0.1:8080` are *different* origins.
   - If you use a custom domain (GitHub Pages `CNAME`), add that domain, e.g.
     `https://lofi.example.com`, as well as or instead of `https://yourname.github.io`.
3. Leave **Authorized redirect URIs** empty. The app uses Google's popup sign-in.
4. **Create**, then copy the **Client ID** (`123…-abc….apps.googleusercontent.com`).
   - Put it in `js/config.js` (`googleClientId: '…'`) so it works for everyone using your copy, or
   - paste it into **Settings → Google → Google setup** for just this browser.

Changes in the console can take **up to 5 minutes** to take effect.

### How sign-in works

Signing in opens a Google popup and gives the page an access token that lasts about an hour.
It's kept in memory only, never saved. After an hour, the next Drive save or **Connect** in
the Calendar asks again, usually with one click. You can remove the app's access any time at
<https://myaccount.google.com/permissions>.

### Troubleshooting

| What you see | Cause and fix |
| --- | --- |
| `Error 401: invalid_client`, "no registered origin" | The page's exact address isn't in **Authorized JavaScript origins** (check http vs https, the port, a trailing slash, localhost vs 127.0.0.1). Or the Client ID was pasted wrong: no quotes or spaces, and it has to be the Client ID, not the secret. |
| `Error 403: access_denied`, "has not completed the Google verification process" | The app is in *Testing* and this Google account isn't a **Test user**. Add it, or publish the app (step 3). |
| "Google hasn't verified this app" | Expected for a personal app. Click **Advanced → Go to … (unsafe)**. |
| "Ineligible accounts not added" when adding a test user | The audience is *Internal* (switch to External), the address has a typo or a trailing space, or it's a group, alias or child account. |
| Nothing happens when clicking Save or Connect | The popup was blocked (allow popups for the site), or an ad blocker (uBlock, AdGuard, Privacy Badger, Brave Shields) is blocking `accounts.google.com`. In the console this shows as `net::ERR_BLOCKED_BY_CLIENT`. Allow the site in the blocker, or try a private window. |
| "you must complete your configuration on the Branding page" | A required Branding field is empty (often the privacy policy link), a logo is uploaded, or the page wasn't saved at the bottom. |

Console messages you can ignore: blocked `doubleclick.net` / `googleads` requests (ads inside the
YouTube player, blocked by an ad blocker), and "The AudioContext was not allowed to start".
Browsers only allow sound after your first click; the app starts audio on that click.

### What gets saved where

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
| Privacy policy (linked from Google's consent screen) | `privacy.html` |
| Colours and layout | `css/style.css` |
