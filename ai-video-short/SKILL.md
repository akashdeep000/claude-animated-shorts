---
name: ai-video-short
description: Make a fully narrated vertical story short (60-150 s) with word-timed TTS, Gemini-generated style-locked keyframes, vibes.ai image-to-video clips, a generated raga score + SFX, and an ffmpeg assembly cut to the narration. Use when the user asks for an AI-generated animated short, a narrated mythic/history/story video, "a video like the Ramayana part 1", a Bengali/Hindi story short, or names elevellab, Gemini-API or vibes.ai.
---

# AI video short — narrated keyframes + image-to-video

Replaces the three.js renderer with a generative pipeline. The rigour of
`../SKILL.md` is kept: facts first, word timings as the single clock, one locked
look, measurements instead of adjectives, and gates that must pass before the
next spend.

Proven bar: `~/Videos/ramayana-part1/part1-startframe.jpg` (keyframe) and
`ramayana-part1-v1.mp4` (clip). Premium 2D Indian mythological comic-book
illustration, thick black ink, warm gold key, 720x1280.

Detail lives in:
- `PLAN.md` — phases, gates, risks, decisions still open
- `PIPELINE.md` — stage contracts, exact commands, state machine
- `SHOT-PLANNING.md` — timings to shots algorithm
- `STYLE-LOCK.md` — locked style block, character sheet, palette targets
- `PROMPTS.md` — prompt algebra, motion classes, moderation ladder
- `AUDIO.md` — generated raga score + synthesized SFX, levels, ducking
- `QA.md` — gate checks, thresholds, defect taxonomy
- `tools/CONTRACTS.md` — the thirteen CLIs this workflow assumes
- `missions/garuda-jatayu.md` — the pilot: verbatim script, cast, visual rules,
  acceptance criteria

## Hard rules

1. **The narration is the clock.** Every cut is derived from real word
   timestamps. No shot boundary is invented before `timeline.json` exists.
2. **Verbatim script.** `<project>/script-tagged.txt` is byte-identical to the
   user's script. `script-spoken.txt` differs only by removed `[...]` tags.
   A hash check runs in gate G0.
3. **Two prompts per shot, never one.** `keyframePrompt` describes a still.
   `videoPrompt` describes 5 seconds of motion starting from that still.
   Reusing the keyframe prompt as the video prompt is the single most common
   quality bug (it produces lifeless, drifting clips).
4. **One locked look.** Style block + character sheet are constants in
   `style-lock.json`. Prompts are *assembled* from them, never freehand.
5. **Never stretch a clip more than 1.12x.** If a beat needs more time, plan
   another shot or an extend (+4 s). Stretching was the biggest compromise in
   the first run.
6. **No unreviewed frame reaches video.** Keyframes pass a contact-sheet review
   and the text-artifact check first. Video credits are the expensive stage.
7. **Resumable by construction.** Every stage writes
   `state/<stage>.json` with an input hash. Re-running is idempotent. A run
   that dies at shot 6 of 28 must restart at shot 6.
8. **Download generated media immediately.** vibes CDN URLs expire.
9. **Music and SFX are generated, not licensed.** Local raga engine for the
   score, local synth for effects, optional quota-limited ElevenLabs hero takes.
   Levels: voice -16, music -24 ducked -3, SFX -18. Captions stay off.
10. **Report compromises, never hide them.** Every gate that was waived goes in
    the final report and in `README.md`.

## Pipeline

```
script-tagged.txt
   │ S0  parse + hash + beat map
   ▼
script.json ──► S1 TTS (elevellab) ──► tts/*.mp3 + tts/*.words.json
                                        │ S2 timeline + pause plan
                                        ▼
                                   timeline.json
                                        │ S3 shot planning
                                        ▼
                                    shots.json
                       ┌────────────────┴────────────────┐
                  S4 prompt assembly               S5 keyframes (Gemini)
                       ▼                                ▼
                  prompts/*.json                   keyframes/*.jpg
                                                        │ S6 clips (vibes.ai)
                                                        ▼
                                                   clips/*.mp4
                                                        │
              timeline.json + shots.json ──► S7 sound ───┤
                   cues -> music + sfx -> mix           │ S8 assembly (ffmpeg)
                                                        ▼
                                                   final.mp4 + QA
```

Parallelism: S1 segments at 3 concurrent (service limit). S5 at 4. S6 at 3.
S1/S2 and S4 can overlap once `script.json` exists. S7 only needs
`timeline.json` + `shots.json`, so music and SFX render while S6 is still
running; only the final mix and S8 wait for the last clip.

## Stage commands

Names are contracts from `tools/CONTRACTS.md`; implement or call them as shown.

```bash
PROJ=~/Videos/garuda-jatayu

# S0 — parse the script, keep the hash, build the beat map
python tools/parse_script.py "$PROJ/script-tagged.txt" -o "$PROJ/script.json"

# S1 — synthesize per segment (eleven_v4 + inline audio tags)
python tools/tts.py "$PROJ/script.json" --out "$PROJ/tts" \
  --url http://127.0.0.1:8100 --voice 3AMU7jXQuQa3oRvRqUmb \
  --model eleven_v4 --tags inline --concurrency 3

# S2 — measure audio, insert planned pauses, build the master clock
python tools/timeline.py "$PROJ/tts" "$PROJ/script.json" \
  -o "$PROJ/timeline.json" --pauses "$PROJ/pauses.json"

# S3 — derive shots from word boundaries (never from guesses)
python tools/plan_shots.py "$PROJ/script.json" "$PROJ/timeline.json" \
  --style "$PROJ/style-lock.json" -o "$PROJ/shots.json"

# S4 — assemble the two prompts per shot
python tools/compose_prompts.py "$PROJ/shots.json" \
  --style "$PROJ/style-lock.json" -o "$PROJ/prompts"

# S5 — keyframes, conditioned on the character sheet + location plates
python tools/keyframes.py "$PROJ/prompts/keyframe" --out "$PROJ/keyframes" \
  --sheet "$PROJ/style/character-sheet.png" --concurrency 4

# S6 — clips, 3 concurrent, resumable, moderation ladder built in
python tools/clips.py "$PROJ/shots.json" --keyframes "$PROJ/keyframes" \
  --out "$PROJ/clips" --concurrency 3

# S7 — sound: cue sheet, score, sfx, mix
python tools/cues.py "$PROJ/shots.json" "$PROJ/timeline.json" -o "$PROJ/score/cues.json"
python tools/score.py "$PROJ/score/cues.json" -o "$PROJ/score/music.wav"
python tools/sfx.py "$PROJ/score/cues.json" -o "$PROJ/score/sfx.wav"
python tools/mix.py "$PROJ/timeline.json" --voice "$PROJ/narration.wav" \
  --music "$PROJ/score/music.wav" --sfx "$PROJ/score/sfx.wav" -o "$PROJ/score/mix.wav"

# S8 — EDL, xfade/cut graph, mux with the mix
python tools/assemble.py "$PROJ/shots.json" "$PROJ/timeline.json" \
  --clips "$PROJ/clips" --audio "$PROJ/score/mix.wav" -o "$PROJ/final.mp4"

# gates
python tools/qa.py "$PROJ" --gate all
```

## Gates (no gate, no next spend)

| gate | checks | blocks |
|---|---|---|
| G0 script | verbatim hash, every sentence has a beat + cast + location | S1 |
| G1 timing | word monotonicity, coverage, concat duration == timeline end +-100 ms | S3 |
| G2 storyboard | every clause covered, durations within [4.0, 5.6] s, cuts on word ends | S5 |
| G3 keyframes | 720x1280, sheet-consistent, no text artifacts, character counts | S6 |
| G4 clips | 720x1280/24 fps/125 f, in-range drift, motion present | S7 |
| G5 assembly | duration +-0.3 s, xfade offsets, no black/frozen joins | deliver |
| G6 final | 720x1280, 24 fps, AAC present, -16 LUFS +-1, loudness true peak <= -1.0 dBTP | deliver |
| G6b audio | voice-bed margin >= 6 LU on spoken windows, duck 2.5-3.5 dB, cue edges clean, stems sum to mix | deliver |

`G3` and the visual half of `G4` need one vision review per batch. Everything
else is machine-checkable.

## Failure playbook

| symptom | cause | fix |
|---|---|---|
| TTS 503 / solver offline | decaptcha lane down | `curl 127.0.0.1:8000/health`, restart the lane, then retry |
| `CONTENT_POLICY` on submit | moderation vocabulary | same prompt twice, then neutralise the lexicon (`PROMPTS.md`), then shorten |
| clip drifts / stands up | no pose-lock sentence | add "keep their poses and positions from the first frame" |
| clip is a still image | motion paragraph missing or too weak | one explicit camera paragraph + one secondary-motion paragraph |
| characters differ per frame | no reference conditioning | pass the character sheet via `files=[...]` |
| Gemini 401 | cookie expiry | re-extract `__Secure-1PSID` + `__Secure-1PSIDTS` from Helium CDP |
| vibes 401 | cached session stale | delete `~/.vibes-session.json`, let `autoSession()` re-login |
| wrong output size | start frame not 720x1280 | rebuild the frame with `ImageOps.fit` |
| cut lands off-beat | shot timing invented | re-run S3 from `timeline.json` |
| run died mid-batch | no state | expected: re-run the same command, it resumes |
| SFX preview returns `quota_exceeded` | the anonymous ElevenLabs preview is spent (~2 requests) | expected: the local synth always rendered every cue; freeze hero takes only when the quota is fresh |

## Deliverables

```
<project>/
  final.mp4             720x1280, 24 fps, H.264/AAC, -16 LUFS
  README.md             pipeline + exact commands + compromises
  script-tagged.txt     verbatim input
  script-spoken.txt     spoken text only
  script.json           parsed segments, beats, cast, locations
  timing.json           per-segment words
  timeline.json         master clock incl. pauses
  shots.json            shot plan (the EDL)
  style-lock.json       style block + character sheet + plates
  style/                character-sheet.png, plates/*.png
  prompts/              <shot>.keyframe.txt, <shot>.video.txt
  keyframes/            <shot>.jpg + manifest.json
  clips/                <shot>.mp4 + <shot>.generation.json
  score/                cues.json, cues.md, music.wav, sfx.wav, mix.wav, stems/
  state/                <stage>.json
  qa/                   gate reports, contact sheets
```

See `PLAN.md` before starting a new video: it records the resolved decisions
(voice, emotion tags, shot cadence, sound, captions) and the phases that
enforce them.
