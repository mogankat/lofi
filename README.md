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
- **Animated scenes**: study desk, park bench, campfire guitar and fishing dock, each with
  **Morning, Afternoon, Evening and Night** lighting, or **Auto** to follow your clock.
  They react to your sounds: turning on rain makes it rain, and thunder brings lightning.
- **Local temperature** under the clock in °F, °C or both. It's optional and off by default.
  Data comes from [Open-Meteo](https://open-meteo.com), which is free and needs no API key.
  You can use your browser location or type a city.
- Zen mode, fullscreen, an interface that fades when you're idle, and keyboard shortcuts
  (Space, R, S, ↑/↓, M, N, L, Z, F).

Settings, stations and your sound mix are stored in the browser's `localStorage`.

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
- The temperature needs `api.open-meteo.com`. If that's blocked, the clock simply doesn't show it.
- Ambient sounds and scenes need nothing from the network. The only external request besides
  music is the Google Font (Nunito), and the page falls back to your system font without it.

## Customising

| What | Where |
| --- | --- |
| Default stations | `DEFAULT_STATIONS` in `js/music.js` |
| Sound recipes | `BUILD` in `js/ambient.js` |
| Scenes | `js/scenes.js`. Each scene is a `create(W, H)` that returns a `draw(ctx, t, dt, env)` function, drawn on a 270px-tall canvas |
| Lighting | `PHASES` (sky, tint and light level for each time of day) plus each scene's palette (`ROOM`, `PARK`, `CAMP`, `SEA`) in `js/scenes.js`. Auto's hours are in `autoPhase()` |
| Presets | `PRESETS` in `js/app.js` |
| Colours and layout | `css/style.css` |
