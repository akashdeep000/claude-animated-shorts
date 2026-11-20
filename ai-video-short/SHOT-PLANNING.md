# Timing to shots

The shot plan is a partition of the finished narration, not a storyboard that
the narration is squeezed into.

Two constants drive everything:

- **NATIVE = 5.208 s** = 125 frames at 24 fps (the model's fixed output)
- **EXTEND = +4.000 s** = +96 frames

Everything else is a consequence.

## Constants

| name | value | why |
|---|---|---|
| `TARGET` | 4.80 s | inside the native clip with 0.4 s of headroom for trim/transition |
| `MIN` | 4.00 s | below this a 5.2 s generation has to be cut hard or padded; the eye notices |
| `MAX` | 5.60 s | at 5.6 a native clip needs 1.08x slow-down — the ceiling we accept |
| `STRETCH_MAX` | 1.12 | hard limit; beyond it motion reads as slow motion |
| `FLOOR_INSERT` | 1.60 s | only for deliberate `forceCut` impact inserts |
| `TAIL` | 0.40 s | picture held after the last word |
| `XFADE` | 0.30 s | default dissolve |

## The identity

With `n` shots, generated lengths `g_i`, and transitions `t_i`:

```
visible_i = t_in_i/2 + owned_i + t_out_i/2
sum(owned_i) = narrationDuration
sum(g_i) >= narrationDuration + sum(t_i) + TAIL
```

`plan_shots` guarantees the second line by construction. `assemble` never
rescales a clip to fix timing; if the identity fails, the plan is wrong.

## The algorithm

A global dynamic program over clause boundaries. Per-segment splitting (what v1
did) is rejected: it produced 1.2 s and 2.3 s shots at segment edges, which then
had to be stretched or padded.

### 1. Candidate boundaries

Every word end in `timeline.json` that is a real prosodic break:

| class | condition | weight |
|---|---|---|
| `S` | `sentenceEnd` | 1.00 |
| `C` | `clauseEnd` (comma, dash, `।` inside a sentence) | 0.62 |
| `P` | segment boundary with a pause tag | 0.85 |
| `X` | any other word end | rejected |

`forceCut: true` on a word marks a mandatory boundary (weight 2.0).

### 2. Feasibility

A candidate span `[b_j, b_k]` is allowed when:

- `MIN <= duration <= MAX`, or
- `duration < MIN` and `k == n` (the final shot may be short), or
- the span is a `forceCut` insert and `duration >= FLOOR_INSERT`.

### 3. Cost

```
cost(j,k) = ((dur - TARGET) / TARGET)^2 * 1.0        # length fit
          - (W[b_j] + W[b_k])                        # good boundaries
          + beatPenalty(j,k)                         # no shot straddles two beats
          + locPenalty(j,k)                          # no shot straddles two locations
          + castPenalty(j,k)                         # no shot invents a cast change
```

`beatPenalty` is 3.0 if the span crosses a beat change, 8.0 if it crosses a
location change. A shot that spans two beats is almost always a shot with two
ideas in it.

### 4. Solve

```
dp[0] = 0
for k in candidates:
    dp[k] = min over feasible j of dp[j] + cost(j,k)
```

Pick the path, then round every boundary to the nearest frame. Because costs
are quadratic in duration, the result naturally prefers ~4.8 s and uses a
longer or shorter shot only when the prose demands it.

### 5. Long-beat handling

If `beatPenalty` forces a beat longer than `MAX` into two shots, the second one
is a **B-shot**:

- same location, same cast, tighter framing (`"medium close-up"`),
- generated with the approved A-shot frame as an extra reference image,
- prompt says "the same moment, seen closer" so it does not invent a new beat.

Never solve a long beat with `extend` alone. Extend is for a *continuous camera
move* the story needs (a 9 s crane over the ocean of milk, for example), and it
costs another generation: same price as a second shot, less control.

### 6. Assign the visual

Each shot inherits from the beat it mostly covers:

```json
{ "shotId": "S07", "beat": "Garuda storms Indra's court",
  "text": "গরুড় স্বর্গে গিয়ে দেবরাজ ইন্দ্র ও সমস্ত দেবতাদের সাথে যুদ্ধ করে",
  "cast": ["GARUDA", "INDRA"], "location": "indra-court",
  "motionClass": "impact", "continuity": "chain",
  "transitionIn": "flash", "startSec": 31.04, "endSec": 35.62 }
```

If a shot's text touches two beats, the DP already penalised it; if it still
happens, the shot's `beat` is the one with more words and the other beat gets
its own shot next round.

### 7. Validate (G2)

- every word in `timeline.json` belongs to exactly one shot,
- `sum(owned) == narrationDuration` +- 1 frame,
- every shot in `[MIN, MAX]` except the last and explicit inserts,
- every cut sits on a `S`/`C`/`P` boundary, never mid-word,
- every beat has >= 1 shot,
- every shot has 1-3 characters (four or more is unreadable at 720p),
- no shot has `generatedSec < visibleSec`.

## Worked example (this mission)

The script is 17 prose segments, 252 words. At a measured Bengali narration
rate of ~3.4 words/s that is ~74 s of speech; the pause plan adds ~8 s, so
`narrationDuration ~= 82 s`.

v1 split per segment and got 26 shots, of which nine were under 3 s. The DP
returns **18-20 shots** at 4.2-5.4 s, merging the short segments:

| shots | covers | beat | note |
|---|---|---|---|
| S01 | SEG01-02 | hook: are they the same? | 4.0 s, protected, no split |
| S02 | SEG03 | the confusion is real | comparison composition |
| S03-S04 | SEG04-06 | Garuda's birth, Vinata, Aruna | two shots, one location |
| S05 | SEG07a | Kadru's deceit | 4.2 s |
| S06 | SEG07b-08a | Vinata enslaved | B-shot, tighter |
| S07-S08 | SEG08 | the amrit war, Indra | impact + aftermath |
| S09 | SEG08 tail | Vishnu's boon, the vahana | chain from S08 |
| S10 | SEG09 | Jatayu introduced | new location plate |
| S11-S12 | SEG10-12 | nephew, Dasharatha's friend | |
| S13-S14 | SEG13 | the abduction, the fight | impact pair |
| S15 | SEG14 | the wing | flash transition in |
| S16-S17 | SEG15-16 | ten heads regrow, Jatayu falls | |
| S18-S19 | SEG17 | death on Rama's lap, last rites | longest beat, 2 shots |

The exact numbers come out of `timeline.json`; the table is the shape, not a
spec. Do not hand-write boundaries.

## Beat to shot archetype

Keeps the visual literal and stops 18 clips of people standing in fields.

| beat type | archetype | motionClass |
|---|---|---|
| hook / question | one hero figure, direct address, negative space | `creep` |
| exposition / lineage | two-shot, tableau, side by side | `orbit` |
| deceit / scheming | low angle, one figure in shadow, foreground obstruction | `parallax` |
| battle / clash | diagonal composition, light vs shadow, debris in frame | `impact` |
| flight / journey | wide vista, tiny figures, layered clouds | `parallax` |
| boon / divinity | centred, radiant, symmetrical, gold bloom | `creep` |
| loss / death | close, still, hands and faces, soft light | `sway` |
| aftermath / rites | wide, empty foreground, single figure | `creep` |

## Transition selection

`transitionIn` is decided by the pair, not by taste:

```
same location and chained frame      -> "cut"
same location, different framing     -> "dissolve"
location or time change              -> "flash"
impact marked in the text            -> "cut-shake"
```

`flash` is a 5-frame white-gold bloom. It is what makes 18 unrelated
generations feel like one film, and it is measured behaviour from the reference
channel (`../references/STYLE_BIBLE.md`), not an invention.
