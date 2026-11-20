# Pipeline contracts

Every stage has one input, one output, one command and one state file. If a
stage is re-run with the same inputs it must produce the same output and cost
nothing. That rule is what makes a 30-shot generative run survivable.

Project layout is in `SKILL.md`; schemas are in `schemas/`.

---

## S0 — parse the script

**In** `<project>/script-tagged.txt` (verbatim).
**Out** `script.json`, `script-spoken.txt`.
**State** `state/s0_script.json` `{inputSha256, segments, beats}`.

Parsing rules:

- A segment ends at a sentence end (`.` `!` `?` `।` `||`) that is also an
  emotion boundary, or at an explicit `[short pause]` tag.
- `[tag]` is removed from the spoken text and becomes
  `emotion` on the segment that follows it.
- Nothing else changes. Whitespace collapses to single spaces; punctuation and
  conjuncts are untouched.
- `protected: true` marks a segment that must never be split across shots
  (hook lines, punchlines, the final line).

Verbatim check (G0):

```python
assert sha256(open(src).read().strip()) == state["inputSha256"]
assert strip_tags(src) == open("script-spoken.txt").read()
```

Every segment needs `beat`, `cast[]`, `location`, `motionClass`. A missing one
fails G0. This is the step that forces the storyboard to be thought through
before any money is spent.

---

## S1 — TTS with word timestamps

**Service** `http://127.0.0.1:8100` — elevellab. Source of truth:
`/home/akash/.t3/projects/elevellab` (`main.go`, `internal/api/api.go`).
There is no OpenAPI document; `/` is the React GUI.

| endpoint | use |
|---|---|
| `GET /health` | solver node count, cache, defaults |
| `GET /v1/voices?language=bn&free=1` | voice discovery (37 Bengali voices) |
| `GET /v1/models` | `eleven_v3`, `eleven_v4`, `eleven_multilingual_v2`, ... |
| `POST /v1/speech` | **JSON**: base64 audio + `words[]` |
| `POST /v1/speech/audio` | raw `audio/mpeg` (no words — do not use for S1) |

Request:

```json
{
  "text": "[thoughtful] <spoken segment>",
  "languageCode": "bn",
  "voiceId": "3AMU7jXQuQa3oRvRqUmb",
  "modelId": "eleven_v4",
  "outputFormat": "mp3_44100_128",
  "words": true,
  "stitchContext": false,
  "voiceSettings": {
    "stability": 0.55, "similarityBoost": 0.78,
    "style": 0.35, "useSpeakerBoost": true, "speed": 1.0
  }
}
```

Response fields that matter:

```
audioBase64 : string        // the whole segment, already stitched
durationSeconds : number
words[] : { text, start, end, sentenceEnd, clauseEnd, chunk, offset }
chunkCount, cachedChunks, timings
```

Rules:

- **One request per segment.** Batching segments defeats per-segment prosody
  and makes a single moderation fix cost the whole narration.
- **Concurrency 3.** It is the service's own limit (`/health` → `concurrency`)
  and there is one hCaptcha solver node.
- `stitchContext: false` — segments are independent; stitching would leak
  prosody across a pause we control ourselves.
- Normalise each segment to **-18 LUFS** before the concat. Per-segment
  loudness varies and the final pass alone will pump.
- Retry a 5xx with backoff; never retry a 4xx unchanged.
- Cache key is the whole request; identical text + settings is ~10 ms.

**Emotion strategy: `eleven_v4` + inline audio tags.** Decided; there is no
bake-off. Tags stay in the request `text` and the model performs them.

| script tag | sent as | effect |
|---|---|---|
| `[thoughtful]` | `[thoughtful]` | slower, level, a beat of lead-in |
| `[excited]` | `[excited]` | brighter, faster |
| `[serious]` | `[low, grave]` | firm and low (`[serious]` is not a valid tag) |
| `[sad]` | `[sad]` | soft, slower |
| `[short pause]` | `[pause]` | a breath from the model **and** 0.9 s of silence in S2 |
| `[neutral]` | — | no tag |

Measured on this machine: `[thoughtful] হ্যাঁ।` = 1.31 s vs `হ্যাঁ।` = 0.84 s;
a tag is direction, not speech (tag-only text returns HTTP 422);
`[thunder rumbling] হ্যাঁ।` inserts ~1.35 s of real sound. So a tag can carry
one diegetic event, but it lands inside the narration file where it cannot be
ducked or panned. Use tags for performance, not for the sound design.

Rules:

- At most one tag per segment, at the segment start. Mid-sentence tags shift
  the alignment in ways the word list does not describe.
- Diegetic tags only where the sound must come from the voice take itself.
- Never `[...]` around ordinary words; the model may read them.

**Alignment hygiene.** The service's `words[]` includes the tag token (for
example `[thoughtful]`) as a word with a short span. Before S2:

```python
TAG = re.compile(r"^\[[^\]]+\]$")
words = [w for w in words if not TAG.match(w.text)]
```

Drop the tag's silent span from the segment's first word start, and assert the
concatenated character spans still cover the spoken text.

**Output** `tts/SEG01.mp3`, `tts/SEG01.words.json`, `tts/SEG01.request.json`.

Under the hood: elevellab posts each chunk to the anonymous
`/v1/text-to-speech/{voice}/stream/with-timestamps/anonymous` endpoint with a
single-use hCaptcha ticket. The upstream model default is `eleven_v3`, the
chunk ceiling is 1000 characters, and chunks are synthesised standalone (no
previous/next stitching). `/v1/speech` is the interface; do not call the
upstream endpoint directly from the pipeline.

---

## S2 — master timeline

**In** `tts/*.mp3`, `tts/*.words.json`, `script.json`, `pauses.json`.
**Out** `timeline.json`, `narration.wav`.
**State** `state/s2_timeline.json`.

`pauses.json` is the pause plan (defaults, per segment id):

```json
{ "defaults": { "tag": 0.90, "sentence": 0.50, "clause": 0.30 },
  "overrides": { "SEG03": 0.70, "SEG11": 1.20 } }
```

Algorithm:

1. Decode each mp3 to 48 kHz mono float, measure real duration.
2. Read `words[]` with tag tokens already stripped (S1). A `[pause]` tag leaves
   a short lead-in silence at the head of the segment; keep it, it is
   performance, and account for it in the word offsets.
3. Place segments end to end with the pause plan's gap after each.
4. Shift every word time by its segment offset **plus** the accumulated gaps.
5. Write one `narration.wav` (48 kHz, 24-bit) with the same gaps.
6. Assert: last word end <= audio length, and audio length - last pause ==
   timeline end. Assert no word text matches `^\[.*\]$`.

`timeline.json`:

```json
{ "audio": "narration.wav", "durationSec": 136.02, "sampleRate": 48000,
  "segments": [{ "id": "SEG01", "startSec": 0.0, "endSec": 3.91,
                 "words": [{ "text": "যিনি", "start": 0.12, "end": 0.44,
                             "clauseEnd": false, "sentenceEnd": false }] }],
  "pauses": [{ "afterSegment": "SEG01", "startSec": 3.91, "durSec": 0.9 }],
  "words": [ /* flattened, global, the only clock downstream stages read */ ] }
```

The flattened `words[]` is what S3 and S7 read. Nothing downstream opens an
mp3 to find a time.

---

## S3 — shot plan

See `SHOT-PLANNING.md` for the algorithm. Output is `shots.json` and it is the
EDL: the assembly stage does not make timing decisions of its own.

---

## S4 — prompt assembly

**In** `shots.json`, `style-lock.json`.
**Out** `prompts/<shot>.keyframe.txt`, `prompts/<shot>.video.txt`,
`prompts/manifest.json`.
**State** `state/s4_prompts.json` `{shots, totalChars, lint:{banned:[], dupParas:[]}}`.

Two different documents from the same slots:

| | keyframe prompt | video prompt |
|---|---|---|
| tense | present, static | present progressive, 5 s |
| subject | who is where, full composition | who moves, what changes |
| camera | framing only ("low angle, waist-up") | one explicit move, one secondary motion |
| length | 60-110 words | 70-130 words |
| banned | — | "cinematic keyframe", "illustration", "poster" |

Lint before spending:

- no paragraph repeated twice (a real bug in v1),
- no banned vocabulary from `PROMPTS.md`,
- no character mentioned that is not in `cast`,
- every prompt ends with the negative lock sentence,
- the keyframe prompt names every character in `cast` in the same words as
  `style-lock.json`.

---

## S5 — keyframes

**In** `prompts/*.keyframe.txt`, `style/character-sheet.png`, `style/plates/*.png`.
**Out** `keyframes/<shot>.jpg` (exactly 720x1280), `keyframes/manifest.json`.
**State** `state/s5_keyframes.json` per shot: `{promptSha, attempt, accepted, ocr}`.

Library: `HanaokaYuzu/Gemini-API` (`gemini-webapi`). Auth from the running
Helium browser over CDP (`127.0.0.1:9222`), reading the `__Secure-1PSID` and
`__Secure-1PSIDTS` cookies via `Storage.getCookies`. Never write cookie values
to a file in the repo; keep them in the process environment only.

Request shape:

```python
client = GeminiClient(psid, psidts)
r = await client.generate_content(
    prompt, temporary=True, files=[sheet_png, plate_png],
)
for img in r.images:
    if isinstance(img, GeneratedImage):   # not WebImage
        await img.save(path=..., filename=f"{shot}.png")
```

Rules:

- `files=[...]` is the consistency mechanism. Instruction, not decoration:
  *"Match the character designs, faces, costumes and palette of the reference
  sheet exactly. Do not redesign them."*
- Request portrait, then `ImageOps.fit((720,1280), centering=(0.5, y))`.
  `y` comes from the shot's `crop` (`top|center|bottom`).
- Reject a result if: not a `GeneratedImage`, aspect outside 0.5-0.65 before
  crop, OCR finds >= 4 confident characters, or the character count is wrong.
- Regenerate with a *changed* variable each time: composition first, then
  lighting, then wording. Never re-roll the same seed blindly.
- Budget 30 % regeneration.

---

## S6 — clips

**In** `keyframes/<shot>.jpg`, `prompts/<shot>.video.txt`, `shots.json`.
**Out** `clips/<shot>.mp4`, `clips/<shot>.generation.json`.
**State** `state/s6_clips.json` per shot: `{keyframeSha, promptSha, attempts,
policyHits, mediaEntId, accepted, drift, motion}`.

Library: `/home/akash/code/vibes-ai-unofficial-api` (do not refactor). Node 22+.

Auth is one session on one account:

- `new VibesClient({ session: autoSession() })` is the normal path; the cached
  `~/.vibes-session.json` is reused.
- If you pass a raw cookie instead, it **must** be
  `VIBES_SESSION_COOKIE='meta_session=<value>'`. A bare token returns
  `401 NoToken`, which looks like an auth failure but is a formatting one.
- One-shot command: `templates/mythic/ramayana-gen.mts` (upload, submit, wait,
  download, provenance). The orchestrated version is `clips.py`.

```ts
const client = new VibesClient({ session: autoSession() });
const project = await client.projects.create(`GJ-${shotId}`);
const { upload, attach } = await client.media.uploadToProject(
  project.project.id, bytes, { filename: `${shotId}.jpg` },
);
const { videos } = await client.videos.generateAndWait({
  projectId: project.project.id,
  prompt,
  startFrame: {
    imageUrl: upload.cdnUrl, imageEntId: upload.mediaEntId,
    contentItemId: attach.contentItems[0]!.id, dimensions: upload.dimensions,
  },
  aspectRatio: "9:16",
  variations: 1,
}, { timeoutMs: 12 * 60_000, intervalMs: 5_000 });
```

Facts, measured:

- output is **720x1280, 24 fps, 125 frames, 5.208 s** — keyed by the start
  frame's dimensions, not by `aspectRatio`;
- extend adds **+4 s** (96 frames);
- 70-100 s latency per clip; 3 concurrent is the safe ceiling;
- a rejected submit is `400 {code:"CONTENT_POLICY", errorCategory:"safety"}`;
- download the mp4 immediately, the CDN URL is signed and short-lived.

Pose-lock, motion paragraph and moderation ladder: `PROMPTS.md`.

Continuity chaining (inside one scene, when the action is literally continuous):

```bash
ffmpeg -sseof -0.05 -i clips/S09.mp4 -frames:v 1 -q:v 2 keyframes/S10.start.jpg
```

Use the extracted frame as S10's start frame only when the shot plan says
`continuity: chain`. It trades a slightly softer frame for a real match cut.
Never chain across a scene change: the new scene needs its own plate.

---

## S7 — sound: cues, score, SFX, mix

**In** `timeline.json`, `shots.json`, `narration.wav`.
**Out** `score/cues.json`, `score/music.wav`, `score/sfx.wav`, `score/mix.wav`,
`score/cues.md`, `score/stems/`.
**State** `state/s7_sound.json` `{cuesSha, sections, events, lufs, margins}`.

Design and level targets: `AUDIO.md`. The contract here is only the shape.

1. **Derive the cue sheet.** Sections from shot boundaries and story beats
   (raga, tala, bpm, level, palette). Events from three maps: narration
   keywords -> cue, transition per join -> cue, motion class -> bed. Snap every
   event to a word boundary or a cut frame, within one frame.
2. **Music.** `score.py` renders the raga sections as one continuous file.
   Tempo/raga changes only on shot starts. No loops.
3. **SFX.** `sfx.py` renders every event locally. If
   `sfx/hero/<cue>.opus` exists (a frozen ElevenLabs preview take), use it
   instead. The renderer never blocks on the preview quota.
4. **Mix.** `mix.py` ducks the bed from the merged word spans (70 ms attack,
   450 ms release), applies per-cue gain/pan, then meters to -16 LUFS with true
   peak <= -1.0 dBTP. Never duck from the audio envelope; silence in the
   narration is not a gap in the story.

```bash
python tools/cues.py "$PROJ/shots.json" "$PROJ/timeline.json" -o "$PROJ/score/cues.json"
python tools/score.py "$PROJ/score/cues.json" -o "$PROJ/score/music.wav"
python tools/sfx.py   "$PROJ/score/cues.json" -o "$PROJ/score/sfx.wav"
python tools/mix.py   "$PROJ/timeline.json" --voice "$PROJ/narration.wav" \
  --music "$PROJ/score/music.wav" --sfx "$PROJ/score/sfx.wav" \
  -o "$PROJ/score/mix.wav" --stems "$PROJ/score/stems"
```

Gate G6b: -16 +-1 LUFS, TP <= -1.0 dBTP, LRA 6-14, voice-minus-bed margin
>= 6 LU on every spoken window, duck depth 2.5-3.5 dB.

---

## S8 — assembly

**In** `clips/*.mp4`, `shots.json`, `timeline.json`, `score/mix.wav`.
**Out** `final.mp4`, `qa/edl.json`.

### The duration identity

Crossfades consume time. With `n` shots of generated length `d_i` and a
transition of length `t_i` at each join:

```
sum(d_i) - sum(t_i) = narrationDuration + tail
```

`plan_shots` solves this before generation, so assembly never trims a shot to
make the maths work. `tail` is 0.4 s of picture after the last word.

Per shot, define:

- `visibleSec` — the time this shot owns on the narration clock
- `generatedSec` — 5.208 s native, or +4 s per extend
- `trimIn` — 0.0 unless the clip has a slow start

Then `d_i = visibleSec + t_in/2 + t_out/2`, which must be <= `generatedSec`.
If it is not, the shot plan is wrong: regenerate or split, do not stretch.

### Transition policy

| join | transition | why |
|---|---|---|
| same scene, continuous action | 0 (hard cut) | a dissolve would show the model's drift |
| same scene, new framing | `xfade=fade` 0.30 s | hides a small pose change |
| new location / time jump | 5-frame white-gold `fade` bloom | reads as a mythic cut, matches the measured reference |
| impact beat (arrow hits, wing cut) | 0 + 2-frame shake | the cut is the hit |

### Graph

One `filter_complex`, not one intermediate file per shot:

```
[0:v]trim=start=0:end=5.208,setpts=PTS-STARTPTS,fps=24,scale=720:1280,setsar=1[v0];
...
[v0][v1]xfade=transition=fade:duration=0.30:offset=4.90[x1];
[x1][v2]xfade=...:offset=... [x2];
...
[x24]fade=t=out:st=<T-0.35>:d=0.35[vout]
```

Audio: take `score/mix.wav` as a second input. It is already metered and
ducked; assembly does not re-process it. A safety limiter is allowed, never a
second `loudnorm` — re-normalising a finished mix is how the voice margin gets
eaten.

```
ffmpeg -i picture.mp4 -i score/mix.wav \
  -map 0:v -map 1:a -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p \
  -profile:v high -movflags +faststart -c:a aac -b:a 192k \
  -shortest final.mp4
```

If the mix is missing, assembly fails. It never silently falls back to the
narration alone — that would ship a film with no score and no error.

### Optional life pass

For a shot that generated too static (`motion` below threshold but accepted),
apply `/tmp/opencode/kinetic.sh`-style camera push + god rays + pollen. Cap it
at 30 % of shots: it is a garnish, and it fights the model's own motion when
overused. Log every shot that got it in the EDL.

---

## State machine

```json
{ "stage": "s6_clips", "inputHash": "sha256:...", "status": "partial",
  "startedAt": "...", "finishedAt": null,
  "items": { "S09": { "status": "done", "attempts": 2 },
             "S10": { "status": "failed", "attempts": 3, "error": "CONTENT_POLICY" } },
  "artifacts": ["clips/S09.mp4", "clips/S09.generation.json"] }
```

`status` is `pending | partial | done | failed`. A stage is re-entered by
comparing `inputHash`; unchanged input + `done` = no-op. Changing one prompt
invalidates only that item, not the stage.
