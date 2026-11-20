# Tool contracts

Seven CLIs. Not implemented yet — this file is the specification Phase 1 builds
against. Keep them boring: Python 3.11, stdlib + `Pillow` + `requests`, no
framework. Each one takes explicit paths, prints one JSON summary line on
stdout, and writes its state file.

Shared flags on every tool:

| flag | meaning |
|---|---|
| `--dry-run` | resolve inputs, validate, print the plan, spend nothing |
| `--resume` | default; skip items whose input hash is unchanged |
| `--force <item>` | redo one item even if the hash matches |
| `--concurrency N` | per-tool default below; never above the service limit |
| `--json` | machine summary on stdout, human progress on stderr |

Exit codes: `0` done, `2` contract violation (schema/lint), `3` external
service failure, `4` partial (some items failed, state written, safe to re-run).

---

## parse_script.py

```
parse_script.py <script-tagged.txt> -o script.json
                [--language bn] [--title "..."] [--beats beats.yaml]
```

Splits at sentence ends and `[tag]` boundaries, strips tags from the spoken
text, writes `script-spoken.txt` next to the output, records both hashes.
`beats.yaml` supplies `beat`/`cast`/`location`/`motionClass` per segment by
index; without it the output fails G0 on purpose.

## tts.py

```
tts.py script.json --out tts/ --url http://127.0.0.1:8100
       --voice <id> --model eleven_v4 [--concurrency 3] [--bakeoff]
```

One `POST /v1/speech` per segment with `words:true`. Writes
`SEG01.mp3`, `SEG01.words.json`, `SEG01.request.json`, and normalises each mp3
to `SEG01.norm.wav` at -18 LUFS. `--bakeoff` renders the first three segments
with every candidate voice/model into `tts/bakeoff/` and stops.

Retries: 5xx and network -> exponential backoff, 4 attempts. 4xx -> fail the
item, never the batch. Reads `concurrency` from `/health` and refuses to exceed
it.

## timeline.py

```
timeline.py tts/ script.json -o timeline.json --pauses pauses.json
            [--out-audio narration.wav]
```

Measures each normalised segment, inserts the pause plan, writes
`timeline.json` + `narration.wav`. Validates monotonicity and the
`sum(segments + pauses) == audio` identity before writing.

## plan_shots.py

```
plan_shots.py script.json timing.json --style style-lock.json -o shots.json
             [--target 4.8] [--min 4.0] [--max 5.6] [--validate]
```

The DP from `SHOT-PLANNING.md`. Assigns `transitionIn`, `continuity` and the
crop. `--validate` runs G2 against an existing `shots.json` and exits 2 on
failure.

## compose_prompts.py

```
compose_prompts.py shots.json --style style-lock.json -o prompts/
```

Writes `<shot>.keyframe.txt` and `<shot>.video.txt`, plus `manifest.json` with
both shas. Lints before writing: duplicate paragraphs, banned vocabulary, cast
not in the sheet, missing negative block, keyframe prompt over 140 words.

## keyframes.py

```
keyframes.py prompts/keyframe/ --out keyframes/
             --sheet style/character-sheet.png --plates style/plates
             [--concurrency 4] [--ocr] [--review qa/contact-keyframes.jpg]
```

Reads Gemini cookies from `GEMINI_PSID` / `GEMINI_PSIDTS` in the environment
(never from a file in the repo). One `generate_content(..., files=[...])` per
shot. Fits to 720x1280 with `ImageOps.fit` using the shot's crop. Rejects:
`WebImage`, wrong aspect, OCR text, character-count mismatch. `--review` writes
a contact sheet for the human/agent pass; without an approved manifest entry the
shot is not considered accepted.

## clips.py

```
clips.py shots.json --keyframes keyframes/ --out clips/ [--concurrency 3]
```

Wraps the existing `ramayana-gen.mts` pattern against
`/home/akash/code/vibes-ai-unofficial-api` — do not refactor that repo. Creates
one project per shot, uploads the 720x1280 frame, submits with the video prompt,
downloads immediately, writes `<shot>.generation.json`.

Implements the moderation ladder and the drift/motion triage from `QA.md`.
Chained shots extract the previous clip's last frame first. Refuses to run a
shot whose keyframe is not accepted.

## assemble.py

```
assemble.py shots.json timeline.json --clips clips/ -o final.mp4
            [--xfade 0.30] [--tail 0.4] [--crf 17]
```

Builds `qa/edl.json`, one `filter_complex`, two-pass loudnorm, muxes AAC 192k.
Asserts the duration identity, that every clip is long enough after trimming,
and that no shot is stretched past `stretchMax`.

## qa.py

```
qa.py <project-dir> --gate all|g0|g1|g2|g3|g4|g5|g6 [--json qa/report.json]
```

Runs the machine checks from `QA.md` and prints a table. Never mutates project
files. Exit 2 on any failure.

---

## Non-goals

- No web UI. The project folder is the interface.
- No database. JSON state files.
- No hidden global config. Every default is a flag with a visible value.
- No retry of a 4xx. Ever. 4xx means the request is wrong, and retrying a
  moderated prompt unchanged is free but retrying a 400 loop is not.
