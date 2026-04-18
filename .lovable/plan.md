
Plan: replace the static "Basico Clothes" image in the landing case study with the uploaded video (`landingasset.mp4`), keeping it responsive.

Steps:
1. Copy `user-uploads://landingasset.mp4` to `public/landingasset.mp4`.
2. In `src/pages/Landing.tsx`, locate the "CASO 01 / BASICO CLOTHES" section and replace the `<img>` with a `<video>` element.
3. Configure the video as: `autoPlay`, `muted`, `loop`, `playsInline`, `preload="metadata"`, no controls — same aspect ratio container as the current image, `w-full h-auto object-cover` for responsiveness.
4. Preserve existing layout classes/wrapper so the grid alignment with the right-side text/stats remains identical across mobile/tablet/desktop.

Out of scope: design changes, copy edits, other landing sections.
