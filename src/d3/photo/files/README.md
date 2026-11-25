# Ver 3 photo files

Ver 3 shows Direction 02's photos (`src/d2/photo/files`), which are
AI-generated concept images for the design review (see
`docs/photo-shot-list.md`); their credit lines live in `../credits.ts`.
They are shared rather than copied so the single-file Ver 3 demo stays under
its size limit.

To change a photo for Ver 3 only, drop a file here named after its slot id
(see `../catalog.ts`), for example `harvest-baler.webp`. It replaces the
Direction 02 file of the same slot in Ver 3 and leaves Direction 02 as it is.
Supported: .jpg, .jpeg, .png, .webp, .avif. Update its entry in
`../credits.ts` too. Replace every concept image with a licensed photo before
launch.

Recommended export: 1600 px on the long edge, WebP or AVIF, under 250 KB.

## Ver 3's own photos

- `kisani-field-day.webp`: a real Kisani Urjaa event photo supplied by the
  client (not AI-generated), used for the live event card and its detail page
  (event `e-baling-demo`). Credit in `../credits.ts`.
- `kisani-farmer-training.webp` (event `e-training`), `kisani-samriddhi-session.webp`
  (`e-crop-health`) and `kisani-team-award.webp` (`e-soil-camp`): real Kisani
  Urjaa event photos supplied by the client.

## Brand grade

Every Ver 3 photo and video gets the same warm tone: a CSS filter
(`--fj3-photo-grade`) plus an apricot soft-light wash (`--fj3-photo-wash`),
both in `src/d3/styles/tokens.css`. Source files stay untouched.
