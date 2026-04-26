# 🦈 Blocky Shark Ocean

A kid-friendly 3D Minecraft-style game where a blocky shark swims through a deep blue ocean and eats colorful fish for points.

Built with **Three.js** + **Vite**, deployable to **Netlify** straight from GitHub.

## Quick start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default http://localhost:5173) and click **PLAY**.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Forward | `W` / `↑` | Left pad ▲ |
| Backward | `S` / `↓` | Left pad ▼ |
| Strafe Left | `A` / `←` | Left pad ◀ |
| Strafe Right | `D` / `→` | Left pad ▶ |
| Swim Up | `Space` | Right pad ▲ |
| Swim Down | `Shift` | Right pad ▼ |

## Build & preview

```bash
npm run build       # outputs to ./dist
npm run preview     # serves ./dist locally
```

## Deploy to Netlify

`netlify.toml` is already configured. After pushing to GitHub:

1. Netlify → **Add new site** → **Import an existing project**
2. Pick the GitHub repo
3. Build settings auto-detect (`npm run build`, publish `dist`)
4. Click **Deploy** — every push to `main` re-deploys.

## Project layout

```
src/
  main.js     # boot + game loop
  scene.js    # Three.js scene, camera, lights, fog
  shark.js    # blocky player shark
  fish.js     # fish types, AI, eat detection, particles
  world.js    # ocean floor, decorations, ambient bubbles
  input.js    # keyboard + touch
  hud.js      # score / best / floating "+N" popups
  audio.js    # asset-free chomp via Web Audio API
  style.css
```

## Design notes

- **No fail state.** No timer, no death, no scary content.
- **Forgiving hitboxes.** Shark collision box is inflated for kid-easy eating.
- **Soft world bounds.** The shark gently bounces off invisible walls.
- **Persistent best score** via `localStorage`.
- **Audio is generated** with the Web Audio API (no binary asset dependencies).
