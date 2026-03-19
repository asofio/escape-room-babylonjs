# Escape Room — A GitHub Copilot CLI Experiment

> **For demonstration purposes only.** This project exists to explore what it looks like to build a non-trivial, interactive 3D application entirely through conversation with the [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli).

---

## What this is

This is a browser-based first-person escape room game built on [Babylon.js](https://www.babylonjs.com/). The player is locked inside a furnished room and must find three hidden numbers to unlock the exit door. Every line of code — the 3D scene, game logic, UI, textures, furniture layout, and mini-games — was generated iteratively through natural-language prompts to the GitHub Copilot CLI, with no manual coding by the developer.

The goal was not simply to ship a game, but to **stress-test the Copilot CLI** on a problem with real spatial reasoning, state management, cross-system integration, and incremental refinement across dozens of conversation turns.

---

## The experiment

Starting from an empty repository, the Copilot CLI was asked to:

1. Scaffold a first-person 3D room with textured walls, floor, and ceiling
2. Populate it with loaded `.glb` furniture models and procedural props
3. Implement a proximity-based interaction system (clues, door keypad)
4. Add wall posters, a working outdoor scene beyond the exit door, and a hidden postcard clue behind a swinging poster
5. Build a fully playable **Snake mini-game** embedded inside a 3D arcade cabinet — winning the game reveals a combination clue

---

## Challenges encountered

These are real issues that surfaced during the conversation and required follow-up prompts to resolve:

### ES module / import map resolution
Babylon.js 7 ships as bare ES module specifiers (`@babylonjs/core`). Browsers can't resolve those without an import map. The initial scaffold produced a black screen because the import map was either absent or placed *after* the `<script type="module">` tag — causing all loader imports to silently fail.

### Pointer lock and raycasting
Under pointer lock, `scene.onPointerObservable` with `POINTERPICK` does not reliably fire because absolute mouse coordinates are zeroed. The fix was to use `window.addEventListener('click')` and manually call `scene.pick(renderWidth/2, renderHeight/2)` to cast from screen center — but this required diagnosing a subtle silent failure first.

### Furniture and prop placement
3D spatial reasoning in text is hard. Multiple passes were needed to:
- Separate a chair that was embedded inside a countertop
- Rotate dining chairs that faced outward instead of inward toward the table
- Move a floating lamp off the floor and mount it on a wall
- Pull a coffee table away from the sofa it was clipping through

### Texture loading and UV direction
Textures from Poly Haven CDN were loaded with `invertY: false` — which flipped images upside-down. Poster images on the east and west walls initially faced inward (into the wall geometry) rather than into the room because the rotation direction for `CreatePlane` normals is non-obvious and easy to get backwards.

### Outdoor ground collision
After implementing the outdoor scene (sky, grass, trees), the player fell through the ground when walking outside. The mesh was created and visually correct but `checkCollisions = true` was not set on the outdoor ground mesh.

### King Kong poster hinge
One clue is hidden behind a swinging poster. Parenting the poster frame and image plane to a `TransformNode` hinge (rather than placing them at absolute world coordinates) required careful coordinate offset math. The initial attempt put the hinge at the poster *center* instead of its *edge*, so the poster rotated through the wall rather than swinging into the room.

### Integrated Snake game keyboard conflicts
The Snake mini-game uses `W`/`A`/`S`/`D` and arrow keys for movement — the same keys the Babylon.js `UniversalCamera` listens to. Simply calling `camera.detachControl()` before launching the overlay was required to prevent the camera from moving while the player was trying to steer the snake.

---

## How to run

The project uses native ES modules and loads Babylon.js from a CDN. It **must** be served over HTTP — opening `index.html` directly as a `file://` URL will not work.

**Option 1 — Python (no install required):**
```bash
python3 -m http.server 8081
```
Then open: **http://localhost:8081**

**Option 2 — Node.js (npx):**
```bash
npx serve .
```
Then open the URL printed in your terminal.

**Option 3 — VS Code Live Server extension:**
Right-click `index.html` → *Open with Live Server*.

---

## How to play

| Action | Control |
|--------|---------|
| Move | `W` `A` `S` `D` |
| Look around | Mouse |
| Interact with door / arcade machine | `I` (when close enough) |
| Inspect a clue object | Click (aim crosshair at it) |
| Close a panel / cancel | `ESC` or Cancel button |

**Find the three combination numbers:**

1. 🕐 **Alarm clock** on the dining table — click it
2. 🕹️ **Arcade machine** against the east wall — press `I` to play Snake, score 10 to reveal a winner's ticket on the joystick
3. 🎬 **King Kong poster** on the north wall — click it to swing it open, then click the postcard pinned to the back

Once you have all three numbers, walk up to the door and press `I` to enter the combination. The numbers can be entered in any order. Escape through the open door to win.

---

## Screenshots

![Screenshot 1](screenshots/screenshot-1.png)

![Screenshot 2](screenshots/screenshot-2.png)

---

## Tech stack

- **[Babylon.js 7.48](https://www.babylonjs.com/)** — 3D engine (ES modules via jsDelivr CDN)
- **[Babylon.js Loaders](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF)** — glTF/GLB model loading
- **Vanilla HTML/CSS/JS** — no build tool, no framework
- **[Poly Haven](https://polyhaven.com/)** — CC0 PBR textures (floor, walls)
- **[Wikimedia Commons](https://commons.wikimedia.org/)** — public domain poster images (Nosferatu, King Kong, Pac-Man, Tetris)
- **[Babylon.js sample assets CDN](https://assets.babylonjs.com/meshes/)** — SheenChair GLB models

---

## Attribution

- Poly Haven textures: CC0 public domain
- Khronos glTF Sample Assets furniture models: CC BY 4.0 (credits embedded in model metadata)
- Poster images: public domain via Wikimedia Commons

Model load failures are handled gracefully — if a CDN asset is unreachable, a placeholder mesh is substituted so gameplay remains fully functional.
