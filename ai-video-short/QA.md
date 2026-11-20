# QA

Eight gates: G0–G6 plus the audio gate G6b. A gate is a command plus a
threshold, not an opinion. Vision review is used only where no measurement
exists, and it is done by an agent that did not write the prompt.

## G0 — script

```bash
sha256sum "$PROJ/script-tagged.txt"          # must equal state/s0_script.json
diff <(sed -E 's/\[[^]]*\]//g' script-tagged.txt | tr -s ' \n' ' ' | xargs) \
     <(tr -s ' \n' ' ' < script-spoken.txt | xargs)
```

Pass: identical; every segment has `beat`, `cast`, `location`, `motionClass`;
cast names exist in `style-lock.json`.

## G1 — timing

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 narration.wav
python - <<'PY'
# words monotonic, no negative duration, coverage == audio length
PY
```

Pass: `words[i].start <= words[i].end < words[i+1].start`; last word end within
the audio; `abs(audio_duration - timeline.durationSec) < 0.1`;
`abs(sum(segment durations + pauses) - audio_duration) < 0.02`; **no word text
matches `^\[[^\]]+\]$`** (a tag token that survived S1).

Tag checks (audio tags are the emotion lane, so they can fail silently):

```bash
# a tag must never be audible as words
python tools/qa.py "$PROJ" --gate g1 --tags
```

Pass:

- no spoken word matches a known tag (`thoughtful`, `excited`, `low`, `grave`,
  `sad`, `pause`) unless the script genuinely says that word;
- the first spoken word of a tagged segment starts **<= 0.6 s** after the
  segment head. A longer lead-in means a diegetic tag inserted a sound effect:
  allowed only when the shot plan asked for it, and logged;
- tag-only text is not a test case in the run (it returns HTTP 422 upstream);
- the tag map in `script.json` matches `PIPELINE.md` (`[serious]` ->
  `[low, grave]`, `[short pause]` -> `[pause]`).

Spot check with ears: 3 random segments, word boundaries land on the syllable,
not 200 ms early. A TTS service that reports char offsets as word offsets passes
the machine check and fails the ear. Always listen once.

## G2 — storyboard

```bash
python tools/plan_shots.py --validate "$PROJ/shots.json" "$PROJ/timeline.json"
```

Pass: every word owned exactly once; `sum(owned) == narration +- 1 frame`;
every shot in `[4.0, 5.6]` (or the final/insert exceptions); every cut on an
`S`/`C`/`P` boundary; every beat >= 1 shot; <= 3 characters per shot; every shot
has 2 prompt files whose sha matches the manifest; no duplicated paragraph; no
banned vocabulary.

## G3 — keyframes

Mechanical:

```bash
# exact size, no letterbox
python tools/qa.py "$PROJ" --gate g3 --size
# text artifacts (any confident word = reject)
tesseract keyframes/S12.jpg stdout 2>/dev/null
# palette band
ffprobe -v error -f lavfi \
  -i "movie=keyframes/S12.jpg,signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.SATAVG \
  -of default=nw=1
```

Pass: 720x1280 exactly; OCR returns nothing above 3 characters of confidence;
`YAVG 100-118`, `SATAVG 22-30`; manifest prompt sha matches the file used.

Visual (one review per batch, fresh agent):

| check | fail |
|---|---|
| cast count | any character not in `cast`, or a cast member missing |
| on-model | crown/plumage/costume differs from the sheet |
| anatomy | extra wing, extra arm, fused hands, floating ornament |
| readability | subject merges into background; the eye cannot find the face |
| emotion | reads as the wrong beat (a grief shot that looks angry) |
| adjacency | SSIM > 0.95 against a neighbour (the cut will be invisible) |
| artefacts | pseudo-Devanagari/Bengali glyphs, watermark, panel border, UI |

Adversarial frame QC (same as the three.js skill, still true here):

- a single wing drawn behind a body reads as a **hanging** — check silhouette;
- anything red and star-shaped reads as a flag — check ornaments;
- foreground props cut by the frame edge read as blobs — delete or reframe;
- a hand near a face reads as a wound at 720p — pull the framing back;
- "ten heads" reads as a bunch of grapes unless 3-4 are clearly faces — keep the
  rest in shadow and say so in the prompt.

Every fail gets a numbered fix and an owner:

| owner | owns |
|---|---|
| `style` | `style-lock.json` style block, palette, ink |
| `cast` | character blocks, sheet, reference instruction |
| `composition` | `[SCENE]` + `[FRAMING]` slots |
| `motion` | motion class, action sentence |
| `plan` | shot boundaries, beat assignment |

## G4 — clips

```bash
for f in clips/*.mp4; do
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,nb_frames \
    -of csv=p=0 "$f"
done
```

Pass, per clip: `720,1280,24/1,125` (or 221 after one extend); no `CONTENT_POLICY`
in the generation log; download size > 1 MB.

Drift and motion triage:

```bash
# first vs last frame: 0.55-0.92 is "moved but held"
ffmpeg -v error -sseof -0.05 -i clips/S12.mp4 -frames:v 1 -y /tmp/last.png
ffmpeg -v error -i keyframes/S12.jpg -i /tmp/last.png \
  -lavfi "[0:v]scale=720:1280[a];[1:v]scale=720:1280[b];[a][b]ssim" \
  -f null - 2>&1 | grep All

# motion energy: mean abs frame difference, expect >= 0.8 on 0-255 Y
ffmpeg -v error -i clips/S12.mp4 -vf \
  "format=gray,tblend=all_mode=difference,signalstats,metadata=print:file=-" \
  -f null - | grep YAVG
```

Interpretation:

| SSIM | motion | reading | action |
|---|---|---|---|
| > 0.95 | < 0.8 | still image with a twitch | regenerate, stronger motion class |
| 0.75-0.95 | ok | intended | accept |
| 0.55-0.75 | ok | energetic or fast camera | accept if the pose is held on screen |
| < 0.55 | any | subject drifted / changed | regenerate, add pose lock, calm the action |

This is triage, not truth: a deliberately fast `impact` shot can sit at 0.5 and
be correct. Look at the four flagged frames before regenerating.

## G5 — assembly

```bash
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate \
  -show_entries format=duration -of json final.mp4

ffmpeg -v error -i final.mp4 -vf blackdetect=d=0.02:pix_th=0.10 -f null -
ffmpeg -v error -i final.mp4 -vf freezedetect=n=0.003:d=0.50 -f null -
```

Pass: 720x1280, 24 fps, h264 + aac; `|duration - narration| < 0.3`; no black
segment; no frozen span >= 0.5 s; every EDL offset within 1 frame of
`timeline.json`.

Reuse the frame-by-frame QA from the three.js skill. It is frame-based, so it
works at 24 fps; only its "2 s per sheet" label assumes 30 fps.

```bash
# qa/cuts.json = [{"id":1,"a":0,"b":125}, ...] plus {"planned":[[f,f], ...]}
python templates/scripts/short_qa.py final.mp4 qa/frames qa/cuts.json
```

It reports specs, loudness, per-frame luma/saturation/motion, black/white/frozen
frames, per-shot colour stats, and contact sheets with frame numbers. Read the
sheets as a film, not as a grid: the question is whether cut 7 makes sense after
cut 6.

## G6 — final

```bash
ffmpeg -v error -i final.mp4 -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json \
  -f null - 2>&1 | tail -20
```

Pass: integrated -16 +-1 LUFS; true peak <= -1.0 dBTP; LRA 6-14; no inter-sample
clipping; first frame is keyframe S01 (no black lead-in); last frame holds 0.4 s
past the last word.

Mux check: `-map 0:v:0 -map 1:a:0` was used, not a silent track from the video
source. Confirm the audio stream has a real bitrate.

## G6b — audio

```bash
ffmpeg -v error -i score/mix.wav -af ebur128=peak=true -f null - 2>&1 | tail -12
python tools/qa.py "$PROJ" --gate audio
```

Pass:

| check | threshold |
|---|---|
| integrated loudness | -16 +-1 LUFS |
| true peak | <= -1.0 dBTP |
| loudness range | 6-14 LU |
| voice-minus-bed margin | >= 6 LU on every spoken window |
| duck depth | 2.5-3.5 dB between speech and gaps |
| cue placement | no cue before 0 or after narration; every cue within 1 frame of its word or cut |
| cue edges | 5 ms fade in/out; no click (sample delta < 0.1 FS at the boundary) |
| drone | one continuous render; no loop seam |
| stems | `voice.wav`, `music.wav`, `sfx.wav` all present and sum to `mix.wav` within 0.1 dB |

The margin is measured on the **spoken windows**, not on the file average. A mix
can be -16 LUFS overall and still bury the voice under a loud battle section.

Diegetic audio tags are checked twice: once here (the event is audible) and once
in G1 (the tag was not spoken). A tag that is spoken and a tag that is silent are
both defects.

## Defect ledger

Every rejection is logged with the shot, the gate, the cause and the fix. The
ledger is the only thing that stops the same defect being paid for twice.

```json
{ "shot": "S12", "gate": "G4", "defect": "drift",
  "detail": "vulture stood up", "fix": "pose lock + calm action",
  "cost": 1 }
```

At the end, aggregate it into `README.md`: attempts per shot, policy hits,
regenerations, and the three defects that cost the most.

## Ship checklist

- [ ] G0–G6b all pass, or the waiver is written down with a reason
- [ ] `README.md` has pipeline, commands, timings, credit spend, compromises
- [ ] `state/` is complete enough that a re-run costs nothing
- [ ] the 6 best frames are in `qa/stills/` for the thumbnail choice
- [ ] the final file plays start to finish with sound on a phone-sized window
