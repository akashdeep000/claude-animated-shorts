# Style lock

One look, one sheet, no per-shot additions. Everything here is a constant in
`style-lock.json`; prompts are assembled from it and the lint rejects a prompt
that paraphrases it (paraphrase is how looks drift).

## The style block (verbatim)

```
Premium 2D Indian mythological comic-book illustration, cinematic keyframe.
Bold clean ink outlines, rich traditional Indian colours, detailed cel-shading,
expressive faces, dramatic cinematic lighting, painterly backgrounds,
consistent character designs across every shot.
Vertical 9:16 portrait composition, edge-to-edge frame, no letterboxing,
no borders.
```

For a **video prompt** the first line changes and only that line:

```
Premium 2D Indian mythological comic-book animation.
```

Never put "keyframe", "illustration" or "poster" in a video prompt. It
describes a still and the model hears it.

## Measured targets

From `~/Videos/ramayana-part1/part1-startframe.jpg`, 720x1280, ffmpeg
`signalstats`:

| metric | measured | target band |
|---|---|---|
| luma mean (YAVG, 0-255) | 107.9 | 100-118 |
| luma low (YLOW) | 37 | 30-45, no crushed blacks |
| luma high (YHIGH) | 202 | 190-212, no blown gold |
| chroma mean (SATAVG) | 25.7 | 22-30 |
| chroma max (SATMAX) | 93 | 85-105 |
| hue mean (HUEAVG) | 136.6 | 125-145 (green-gold, not orange) |

Use these as an automated look check on keyframes: a frame outside the band is
a prompt problem, not a taste problem.

Palette, by area:

| role | colour | note |
|---|---|---|
| ink | `#0a0a0a`, plum-shadowed `#241726` on skin | thick, variable width, never blue-black |
| key light | warm gold `#ffcf9e` -> `#ffb36b` | always from above, always through leaves or clouds |
| rim | pale gold, inner edge only | no offset outer copy (hats become picture frames) |
| forest shade | olive-grey `#3f4a34` to `#6b7355` | desaturate, never emerald |
| sky | `#3e7fd2` top -> `#b8d0ec` horizon | celestial scenes may push to violet |
| Rama skin | `#2f6fb5` mid, `#1d4f8a` shade | never cyan |
| Jatayu plumage | `#6b5f52` / `#8c8175`, beak `#d8c9a8` | old, dusty, never black |
| Garuda plumage | `#c8862f` / `#8f3b1f` | gold and crimson, jewelled gold crown |
| divinity glow | `#ffe6a8` at 20-35 % opacity | bloom, not a hard halo |

## Character sheet (verbatim, from the proven run)

```
Garuda — a majestic golden eagle-man, noble face with a hooked golden beak, red-gold feathers, enormous golden wings with crimson-tipped primaries, a jewelled crown, ornate gold armlets, warm amber eyes, radiant and proud.
Jatayu — an elderly grey-brown vulture with a hooked pale beak, wise gentle eyes, weathered grey-brown plumage, broad feathered wings, a faded saffron thread at his neck, dignified and serene.
Lord Rama — blue skin, saffron forest clothing, matted dark hair, a golden bow and quiver, calm compassionate expression.
Lakshmana — fair-skinned archer, dark green forest tunic, bow and quiver, loyal and alert.
Mother Sita — warm golden-brown skin, red and gold sari, lotus-like eyes, graceful, a faint golden aura.
Ravana — ten-headed demon king, dark emerald skin, many crowns, heavy gold ornaments, tall regal and fierce.
Lord Vishnu — blue skin, four arms, golden crown, yellow silk dhoti, conch, discus, mace and lotus, serene and radiant.
Vinata — graceful celestial woman, warm brown skin, flowing teal and gold robes, gentle eyes.
Kadru — regal serpent queen, dark green-gold skin, coiled serpent ornaments, cool composed expression.
Aruna — dawn-red eagle-man, red-gold feathers, luminous, holding golden chariot reins.
Indra — celestial king in golden crown and armour, holding a thunderbolt, enthroned among bright clouds.
King Dasharatha — aged human king, white beard, royal saffron and gold robes, kindly eyes.
Maharshi Kashyapa — ancient sage, matted hair, saffron robe, calm wise face.
```

Rules for using it:

- A prompt includes **only** the characters in that shot's `cast`, copied
  character-for-character. Re-describing a character in fresh words is how a
  crown becomes a helmet.
- Characters never appear off-model for a beat ("angry Garuda", "young Jatayu").
  Emotion goes in the scene sentence and the face, not the design.
- Cast changes are separate shots. Never add a character to an existing frame
  with a video prompt; the model will delete or duplicate someone.

## Reference images (the consistency mechanism)

Generate once, pass to every keyframe request via `files=[...]`:

1. `style/character-sheet.png` — 3x3 grid, the 13 characters above, full body,
   neutral pose, same lighting, locked style. The sheet itself is generated
   with the style block and checked by hand before it is used.
2. `style/leads/<NAME>.png` — crop of the sheet, upscaled, for the four leads
   (Garuda, Jatayu, Rama, Ravana) when a shot is a close-up.
3. `style/plates/<location>.png` — one landscape-ish plate per location:
   `celestial-dawn`, `ocean-of-milk`, `kailash`, `naga-realm`, `indra-court`,
   `forest-clearing`, `sky-chariot`, `lanka-gate`. These lock architecture,
   weather and light so shots in the same place cut together.

Instruction that goes with the files:

```
Match the character designs, faces, costumes, plumage and palette of the
reference images exactly. Do not redesign them. Keep the same ink weight and
the same lighting direction as the scene.
```

## Negative block (last line of every prompt)

```
Only these characters in the scene. No text, no captions, no logos,
no watermarks, no borders, no split panels.
```

For video prompts, add:

```
The characters keep their poses and positions from the first frame; only
expressions and small secondary motion change.
```

## Look test (before any batch)

Three shots that stress the look differently: the hook (one hero, sky, gold),
the battle (two figures, diagonal, debris), the death (close, hands, soft
light).

Procedure:

1. Generate the three keyframes.
2. Render a side-by-side with `part1-startframe.jpg`
   (`../templates/scripts/sbs_sheet.py`).
3. Score each 0-10: colour, ink, lighting, faces, composition, "same film".
4. Any score under 6 -> change one slot only (style block OR reference
   instruction OR composition), regenerate, rescore.
5. Freeze `style-lock.json` only when all three pass.

The first run skipped this and generated 26 frames before anyone looked. Three
images here cost minutes and protect the whole batch.

## What "on-model" means at 720x1280

- Head is 1/7 to 1/6 of frame height in a medium shot; eyes are readable at
  arm's length.
- Ink lines are 3-5 px at 720 wide, constant, not scaled by depth.
- No more than three characters; four becomes a crowd of silhouettes.
- The subject is lit from one side with a warm key and a cool shade; flat
  frontal lighting kills the ink.
- Foreground is occupied in ~1/3 of shots (a leaf, a spear, a shoulder) — it is
  what makes a generated frame feel filmed rather than drawn.
