# Mythic style bar

The look every `ai-video-short` run has to match. Unlike `references/` (private
study material from another channel), **everything here is our own generated
output** and can be published.

| file | what it is |
|---|---|
| `part1-startframe.jpg` | the keyframe that set the bar: 720x1280 |
| `ramayana-part1-v1.mp4` | the working clip generated from it |
| `p1-prompt.txt` | the video prompt for the death scene (passing version) |
| `p2-prompt-v3.txt` | the next shot, adding the pose-lock sentence |
| `generation.json` | the full vibes.ai request, IDs and the prompt that produced `v1` |

## Measured, not described

| property | value |
|---|---|
| keyframe | 720x1280 |
| clip | 720x1280, h264, 24 fps, 125 frames, 5.208 s |
| luma | YAVG 107.9 |
| saturation | SATAVG 25.7 |
| hue | HUEAVG 136.6 |

The output size is keyed to the start frame, not to `aspectRatio`. Feed exactly
720x1280 or the clip comes back at another size.

## The style sentence

> Premium 2D Indian mythological comic-book illustration, bold clean ink
> outlines, rich traditional colours, detailed cel-shading, expressive faces,
> cinematic lighting, consistent character designs.

Per-character blocks and the palette targets are in
`../../ai-video-short/STYLE-LOCK.md`. This folder holds the evidence; the
locked text lives in the docs so there is one source of truth.

## Prompt shape that passes

1. Style paragraph (the sentence above, plus the scene's light).
2. Who is where, what they are doing — calm verbs: `rests`, `kneels`,
   `watching`, `straining`.
3. `CAMERA AND MOTION:` one camera move + named secondary motion (rays, dust,
   ferns, feathers, cloth).
4. Pose lock: *"The characters keep their poses and positions from the first
   frame; only expressions and small secondary motion change."*
5. Style lock again + *"Only these characters in the scene. No text, no
   captions, no logos, no watermarks."*

Moderation is partly nondeterministic. `generation.json` proves it: its prompt
contains `severely exhausted`, `injured wing stump` and `red stylised pigment`,
yet it generated. Retry the **same** prompt once before rewriting it; the image
is almost never the cause.

## Using it

- Compare a look test side by side with `part1-startframe.jpg` before spending
  video credits.
- Copy the prompt shape, not the words: every shot gets its own scene and
  motion paragraph, composed from slots (`ai-video-short/PROMPTS.md`).
- Never reuse this footage as content for another story; it is a look
  reference.
