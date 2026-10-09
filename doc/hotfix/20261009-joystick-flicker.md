# Joystick paint and camera ownership hotfix

Base: `e59b2d4ad14db0abeec54219df4ff96f2ae1be58`.

The user confirmed that the preceding motion patch removed the stutter, but reported screen flicker during joystick movement. This patch keeps the elapsed movement, corner outbox, compact authority, natural standing time, and save contract unchanged.

The installed RPGJS beta.34 character component calls `syncCameraFollowPosition` reactively when the local actor moves. That callback calls `viewport.moveCenter` directly even if the follow plugin is paused. It competed with Harbor's HUD-safe camera. The embedded sync/physics and `applyServerAck` also wrote an older local body position after Harbor's rAF projection but before Pixi painted it.

`src/engine/rpg-space.ts` reserves the non-actor camera target `harbor-safe-area-camera` through the existing `setCameraFollow` API, reclaiming it after map transfers. A single Pixi `prerender` runner reprojects the existing swept local pose and solves the same safe-area camera immediately before painting. This runner advances no motion or time. NPC interpolation, collisions, world depth, authored art and ordinary server confirmation remain unchanged. No RPGJS/Pixi dependency or shared `node_modules` file was modified.

Validation uses compiled normal Main/View/RPGJS with the original authority in an isolated SQLite/browser capability. The fixture uses its own synthetic starting save and makes no paid model calls or writes to original player saves.

- Baseline DPR3/390 video and call trace: 915 reactive default-camera calls versus 313 Harbor solves; local body deviation at paint reached 21.74 world pixels. No scene or canvas replacement, hidden actor sheet, or renderer backlog was observed.
- Continuous touchMove includes fine turns, direction changes, release/regrab, and 170–850ms varied motion receipt timing. Full WebM and extracted frame sequences are retained outside the repository. Final paint must match the installed integer body projection within **0.5 world pixels per axis**; this is a fixed rounding limit, not a frame-gap-dependent allowance. Only the safe-area solver may call the camera.
- Both 320×568 (DPR1) and 390×844 (DPR3) passed the paint gate, with no actor/canvas/scene disappearance. Same-owner menu pause/resume and reload of the confirmed head passed. The expected expired motion lease after a long menu pause follows the existing bounded recovery protocol.
- Three sizes (320,390,1280), cafe→station→cafe ordinary entrance travel, movement, menu resume and resize: 18 actual UI states passed, with the reserved camera target restored after both map transfers.
- Anti-stutter recheck: normal-network 320/390/1280 and 600ms receipt-delay 320/390 all passed. Movement mean speed 110.97–111.85 world units/sec (configured 112), no >=120ms zero-displacement runs in the sustained moving interval. Real menu pause, touch/key release, confirmed-head reload and browser lifecycle recovery passed.
- Existing motion/clock/compact-authority/camera rule regressions: 50/50 passed. TypeScript/Vite build, public secret, API-base and strict UI audits passed.

DPR3 uses Chromium SwiftShader on this Mac. Its high-resolution software-rendering frame rate is not evidence of real iPhone performance. There is no installed Playwright WebKit runtime; no new software was installed. Physical iPhone/Telegram confirmation remains pending and must not be inferred from these videos. The user's current report takes priority over prior AI visual conclusions.

Production deployment is frontend-only. ECS remains the previously verified e59 backend with the same sole writer and database; there is no backend cutover, migration, restore, new auth, media generation or budget use. Primary and Pages must receive the same frontend commit and exact static artifacts. Existing accepted deployment credential risk is not remediated by this visual patch.

Reproduce with installed Node24:

```sh
JOY_LABEL=final JOY_WIDTH=390 JOY_DPR=3 JOY_VERIFY=1 node --import tsx _qa/joystick-flicker-ui.mts
node --import tsx _qa/camera-ownership-ui.mts
SMOOTH_DIST="$PWD/dist" SMOOTH_LABEL=flicker SMOOTH_VERIFY=1 SMOOTH_DELAYS=0,600 node --import tsx _qa/motion-smoothness-ui.mts
```

Local fixed delivery and full evidence: `/Users/yin/code/games/harbor-joystick-flicker-e59-20261009/`.
