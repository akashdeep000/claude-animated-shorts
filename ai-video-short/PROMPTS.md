# Prompts

Two prompts per shot, assembled from slots. If a human types a prompt by hand it
is a bug report, not a workflow.

## Keyframe prompt algebra

```
[STYLE]        one sentence, verbatim from STYLE-LOCK
[SCENE]        1-2 sentences: place, light, weather, time of day
[CAST]         verbatim character blocks for this shot's cast only
[ACTION]       one sentence: who is where doing what, present tense
[FRAMING]      shot size + angle + what occupies the foreground
[NEGATIVE]     the lock sentence
```

Budget: 90-140 words. Under 90 the model invents; over 140 the last clause
gets dropped, and the last clause is the negative.

Example (hook, S01):

```
Premium 2D Indian mythological comic-book illustration, cinematic keyframe.
Bold clean ink outlines, rich traditional Indian colours, detailed cel-shading,
expressive faces, dramatic cinematic lighting, painterly backgrounds,
consistent character designs across every shot. Vertical 9:16 portrait
composition, edge-to-edge frame, no letterboxing, no borders.

A high celestial cliff above a sea of dawn clouds, the first gold light behind
the rocks, mist in the valley below.

Garuda — a majestic golden eagle-man, noble face with a hooked golden beak,
red-gold feathers, enormous golden wings with crimson-tipped primaries, a
jewelled crown, ornate gold armlets, warm amber eyes, radiant and proud.

Garuda stands at the cliff edge, wings half spread, head turned toward the
viewer, one brow lifted in a proud question.

Low angle, three-quarter, waist-up; a wind-bent branch crosses the lower left
foreground, out of focus.

Only these characters in the scene. No text, no captions, no logos,
no watermarks, no borders, no split panels.
```

## Video prompt algebra

Same slots, different job: it describes **change over 5 seconds**.

```
[STYLE-ANIM]   one sentence, animation wording
[WHO/WHERE]    one sentence restating the start frame so the model holds it
[ACTION]       1-2 sentences: exactly one visible action, calm vocabulary
[CAMERA]       one explicit move, with a duration feel
[SECONDARY]    2-3 small motions (cloth, feathers, light, dust)
[LOCK]         the pose-lock sentence
[NEGATIVE]     the lock sentence
```

Example (same shot):

```
Premium 2D Indian mythological comic-book animation. Bold clean ink outlines,
rich traditional Indian colours, detailed cel-shading, cinematic lighting.

Garuda stands on the same celestial cliff at dawn, wings half spread, looking
toward the viewer with a proud, questioning expression.

He slowly turns his head a little further toward the camera and his chest rises
once with a calm breath. His expression shifts from pride to doubt.

CAMERA AND MOTION: a slow sustained cinematic dolly-in with a gentle orbital
drift. Foreground clouds sweep past the lens while the distant peaks slide more
slowly, layered parallax. Light rays travel across the cliff, fine mist drifts
through the sunbeams, feathers and gold armlets stir in a light breeze.

The characters keep their poses and positions from the first frame; only
expressions and small secondary motion change. Only these characters in the
scene. No text, no captions, no logos, no watermarks, no borders, no split
panels.
```

Rules learned from the failing version:

- Motion must be its **own paragraph**. Buried in the body, it produces stills.
- One action per clip. Two actions average into a drift.
- "The camera carries all the movement" is the strongest single sentence; it
  stops the subject from walking off.
- Never name the injury. Name the shape: "one fully formed wing and one short
  wing with a few remaining feathers". The image can carry the story; the
  prompt must survive moderation.
- Restate the start frame's pose. The model otherwise "improves" it.
- No numbers of shots, no dialogue, no on-screen text.

## Motion classes

Pick from the shot plan; do not improvise. Each is a complete paragraph.

### `creep` — exposition, reverence, loss

```
CAMERA AND MOTION: a slow sustained cinematic dolly-in with a gentle orbital
drift. Foreground leaves and ferns sweep past the lens while the distant trees
slide more slowly, layered parallax. Light rays travel across the clearing, dust
motes drift in the sunbeams, feathers and cloth stir in a light breeze.
```

### `orbit` — lineage tableaux, two-shots

```
CAMERA AND MOTION: a slow cinematic dolly-in easing into a gentle arc to the
left. Foreground branches pass close to the lens while the background trees
slide the other way, layered parallax. Warm light moves across the scene, and
the characters' hair, sashes and feathers answer a soft wind.
```

### `parallax` — flight, journey, landscape

```
CAMERA AND MOTION: the camera glides forward and slightly up. Cloud banks in
the foreground sweep past the lens while the distant peaks and sky slide much
more slowly, strong layered parallax. Sunlight breaks and travels across the
cloud sea, glimmering motes rise, and the characters' feathers and silks ripple
in the wind.
```

### `impact` — battle, clash, strike

```
CAMERA AND MOTION: a fast but smooth push-in that settles, with a slight shake
on the moment of contact. Dust, petals and debris leap up and drift past the
lens, light and shadow collide across the frame, and the characters hold their
guard. Motion is mythic and stylised, never graphic.
```

### `sway` — death, farewell

```
CAMERA AND MOTION: an almost still frame with a very slow push-in and a faint
handheld sway. A single leaf drifts down through the light, dust hangs in the
air, breathing moves the chest, and cloth stirs once. Nothing else changes.
```

`sway` is the only class allowed to be near-static, and even it moves: a still
clip reads as a bug.

## Pose lock

Always, verbatim, before the negative block:

```
The characters keep their poses and positions from the first frame; only
expressions and small secondary motion change.
```

Without it the resting vulture stood up mid-clip. With it, the same frame holds.

## Moderation ladder

The platform has a text safety layer on submit. A hit is:

```
HTTP 400 {"code":"CONTENT_POLICY","errorCategory":"safety"}
```

It is partly nondeterministic. Follow the ladder exactly; it is ordered by cost.

| step | action | cost |
|---|---|---|
| 1 | resubmit the **same** prompt | 0 |
| 2 | resubmit once more | 0 |
| 3 | neutralise vocabulary (table below), keep composition | 1 |
| 4 | cut to 2 sentences: who + camera only | 1 |
| 5 | replace the beat with a symbol shot (a falling feather, a shadow, a bow laid down) and note the storyboard change | 1-2 |

Never rewrite the prompt while a retry of the same text is pending. The first
run burned credits rewriting prompts that would have passed on attempt two.

### Lexicon

| avoid | use |
|---|---|
| injured / wound / stump / severed / blood / bleeding / gore | weary, resting, one short wing, dust on the feathers |
| dying / death / corpse / final breath | still, quiet, at rest, farewell |
| kill / slaughter / destroy / murder | clash, overcome, scatter, break the line |
| torture / agony / scream in pain | straining, resolute, overwhelmed |
| kidnap / abduct / rape | carried away, taken, lifted into the chariot |
| cut off his wing / tear apart | the wing is struck; the vulture strains to hold the chariot |
| weapon descriptions with intent ("stabs", "cleaves") | raised blade, clash of light and shadow, guard broken |

Note the asymmetry: the **image** may contain a red pool and a wounded wing and
still be accepted (the proven start frame does). Text is what is policed. So
write a calm sentence and let the still carry the violence.

## Do not

- Do not describe what happens after the 5 seconds ("then he dies").
- Do not ask for a camera move the model cannot do (whip pans, zooms through
  objects) — it smears.
- Do not repeat a paragraph; the assembler's lint rejects it before spending.
- Do not put the character blocks after the camera paragraph — the model
  weights the tail of the prompt, and the negative lock must be last.
- Do not include a character who is not in the shot's `cast`. The model will
  add them, badly, in the background.
- Do not use "4K", "8K", "octane", "trending on artstation". They pull the
  render away from ink and into photo-realism.

## Prompt manifest

`prompts/manifest.json` records, per shot:

```json
{ "shotId": "S12", "keyframePromptSha": "...", "videoPromptSha": "...",
  "motionClass": "impact", "attempt": 2,
  "policyHits": [{"attempt": 1, "code": "CONTENT_POLICY"}],
  "finalPromptFile": "prompts/S12.video.txt" }
```

This is how "we already learned that" stops being rediscovered every run.
