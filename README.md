# Lofi Focus

A cozy, self-hosted pomodoro page: lofi music, ambient sounds and animated pixel-art scenes.
No accounts, no paywall, no tracking, no build step. It's just static files.

## Features

- **Pomodoro timer**: focus, short-break and long-break modes with configurable lengths, auto-start,
  a chime, optional desktop notifications and a daily session count. The timer keeps accurate
  time in background tabs and survives a page reload.
- **Music**: YouTube (videos, 24/7 live streams, playlists) through the official embedded player, or
  plain internet-radio streams. Comes with Lofi Girl, Chillhop and a few SomaFM stations. Paste
  any link to add your own.
- **Ambient sounds**: rain, thunder, wind, ocean waves, fireplace, café, birds, crickets, and
  white, pink and brown noise. Each one is **synthesised live in the browser**, so there are no
  audio files and no loops you can hear repeating. Mix them with sliders or pick a preset.
- **Animated scenes**: late-night study, park bench, campfire guitar and sunset dock.
  They react to your sounds: turning on rain makes it rain, and thunder brings lightning.
- Zen mode, fullscreen, an interface that fades when you're idle, and keyboard shortcuts
  (Space, R, S, M, N, Z, F).

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
- Ambient sounds and scenes need nothing from the network. The only external request besides
  music is the Google Font (Nunito), and the page falls back to your system font without it.

## Customising

| What | Where |
| --- | --- |
| Default stations | `DEFAULT_STATIONS` in `js/music.js` |
| Sound recipes | `BUILD` in `js/ambient.js` |
| Scenes | `js/scenes.js`. Each scene is a `create(W, H)` that returns a `draw(ctx, t, dt, env)` function, drawn on a 270px-tall canvas |
| Presets | `PRESETS` in `js/app.js` |
| Colours and layout | `css/style.css` |
