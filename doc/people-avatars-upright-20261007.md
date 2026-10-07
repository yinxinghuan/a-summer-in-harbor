# Upright people portraits — local candidate

The user requested a slightly larger upright head, shoulders and upper-chest view, using Dani in the previous mixed-source people list as the reference. This supersedes the square face-window candidate 506b7e9, which remains preserved independently.

Use the unchanged unified website sources for all 22 residents. Source PNGs and provenance are identical to the previous candidate. No generation, recoloring or destructive image crop. Per-person source windows are in `src/ui/people-avatar-crops.json`: `[left, top, width, height]`, all 4:5. The list and identity panel share `PeopleAvatar`. The visible frame is 64×80 at 320px and 72×90 at 390px; text, row actions and portrait enlargement retain their original interaction.

Each window preserves the complete head silhouette, hats, glasses and shoulder/chest identity. Mira's lower braid extends beyond the chest window; the unchanged enlarged portrait remains available. Long-haired characters are not cropped across the head.

Based on camera d644495, itself based on published day/night 2e1e20e. This candidate contains no B2, animal increment, continuous outdoor map or walking-clock changes. Camera-only is published separately; the avatar change has no publication approval.

Actual Main/View/RPGJS with the original HTTP handler and synthetic in-memory SQLite passed 22 residents × two sizes × two languages = 88 detail/enlarge cases, plus the four feedback residents × two sizes = 8 cases. All 22 images decode; list/detail use identical per-person windows; browsing preserves the saved head and player coordinates. No business actions, model/media calls, production identity or original-save operations. The 8 focused camera boundary states and 2 original-HTTP round trips passed separately on the combined local build; the initial input harness attempted a hidden near-portal caption, and now uses the ordinary primary action when already near. Failure history remains in owner evidence.

11 camera/world tests and 8 relationship tests passed, as did build, credential/API-base and strict UI audits. Physical phones and AlterU MiniApp are unverified. Evidence: `/Users/yin/code/games/a-summer-in-harbor/doc/qa/camera-avatar-owner-20261007-01a10d0d/`. This is local review, not production acceptance.
