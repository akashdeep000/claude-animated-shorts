# Mythic video templates

Two working pieces from the first mythic short. They are templates, not the
pipeline: the orchestrated versions are specified in
`../../ai-video-short/tools/CONTRACTS.md` (`clips.py`, `assemble.py`).

## ramayana-gen.mts

One shot: upload a start frame, submit a video prompt, wait, download, write
provenance.

```bash
npx tsx templates/mythic/ramayana-gen.mts \
  <frame.jpg> <outDir> <outName> <projectName> <promptFile>
```

- Depends on `/home/akash/code/vibes-ai-unofficial-api` (hardcoded import; do
  not refactor that repo).
- Auth: `autoSession()`. If you pass a raw cookie instead, it **must** be
  `VIBES_SESSION_COOKIE='meta_session=<value>'` — a bare token returns
  `401 NoToken`.
- The frame must be exactly 720x1280. Output size follows the frame.
- 70-100 s per clip. Three concurrent is the safe ceiling on one account.
- Downloads immediately and writes `<outName>.generation.json`.
- `400 CONTENT_POLICY` is moderation, not a bad frame: retry the same prompt
  once, then neutralise the vocabulary (`../../ai-video-short/PROMPTS.md`).

## kinetic.sh

Adds life to a clip that generated too static, with no quota: camera push,
handheld micro-shake, travelling god rays, two pollen layers, light breathing,
grain.

```bash
KINETIC_ASSETS=~/Videos/ramayana-kinetic/_assets \
  templates/mythic/kinetic.sh in.mp4 out.mp4 1.0 1.08 6 -4 0.18
#                                       zs   ze   xD yD rayAlpha
```

- Needs `rays.png` and `dust.png` in `$KINETIC_ASSETS` (default
  `~/Videos/ramayana-kinetic/_assets`); they are large textures, not committed.
- Output is 720x1280, 24 fps, video only (`-an`); mux audio at assembly.
- Use on at most 30 % of shots. Overused, it fights the model's own motion and
  makes every shot feel like the same template.

## Not here

The style block, character sheet and prompt algebra are docs, not scripts:
`../../ai-video-short/STYLE-LOCK.md` and `PROMPTS.md`.
