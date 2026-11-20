# Plan: AI video short pipeline (v2)

Status: **plan only.** Nothing in this folder has been executed against the
current mission yet. The three external services were probed read-only and the
APIs below are copied from their source, not from memory.

Goal: turn the ad-hoc run that produced `~/Videos/garuda-jatayu/` (26 keyframes,
6 clips, no final cut) into a repeatable tool that reliably ships a
`720x1280` narrated short at the same or better quality, with no silent
compromises.

## 1. What we keep from the three.js skill

| kept | why it matters for AI video |
|---|---|
| Facts-first script with sources | the script is the product; AI only illustrates it |
| Word timings as the single clock, hand-checked | cuts must land on the narration, not on a vibe |
| One locked look, measured not described | per-shot prompting without a lock produces 26 different films |
| Reference-driven look loop: measure, build, verify with a fresh reviewer, map every fix to an owner | same loop, new renderer |
| Readability trap list | AI adds its own traps (fake text, extra limbs, character drift) |
| QA with numbers: ffprobe contract, loudness, black/frozen frames, contact sheets | unchanged, still the last line of defence |
| Deliverable layout + "save after every step" | unchanged |
| `templates/audio/` mix chain (if music is ever asked for) | still the best loudness/ducking code in the repo |
| The style bible's measured transition behaviour (hard cuts rare, 4-frame flash, continuous moves) | tells us how to join AI shots that cannot physically connect |

## 2. What we drop

- three.js / Remotion rendering as the primary path. It cost ~4 fps at 2K and
  needed a look-match loop with five parallel owners; per-shot AI video is
  cheaper in tokens and better at faces.
- `story.ts` camera keys, ink/lens/grade passes, world building. Kept on disk
  as a fallback for shots that AI cannot do (maps, diagrams, title cards).

## 3. Defects in the rough mission prompt, and the fix

These are the reasons the first run stalled and the reasons its output drifted.
Each one is addressed by a stage or a gate, not by "be careful".

| # | defect in v1 | consequence | fix |
|---|---|---|---|
| 1 | keyframe prompt reused verbatim as the video prompt | clips describe a still, motion is weak, "cinematic keyframe" leaks in | two prompts per shot: `keyframePrompt` (still) + `videoPrompt` (5 s of action) |
| 2 | long beats covered by time-stretching 5.2 s clips | slow-motion feel, dead energy on the longest lines | hard cap 1.12x; extra shot or +4 s extend instead |
| 3 | one style block, no reference images | costumes, faces and palette drift between shots | character sheet PNG passed as a `files=[...]` reference to every generation |
| 4 | every keyframe generated before any review | 26 frames of the wrong look | 3-shot look test first, then drafts -> contact sheet -> regenerate failures only |
| 5 | no text-artifact check | AI glyphs get baked into the video | OCR pass on every keyframe, regenerate on detection |
| 6 | emotion tags stripped, `[short pause]` ignored | flat delivery, no breathing room, beats feel rushed | TTS bake-off (v3 tags vs v4 prosody) + explicit pause plan in the timeline |
| 7 | no continuity between adjacent shots | cuts read as 26 unrelated images | chain last frame of clip N as start frame of N+1 inside a scene |
| 8 | moderation handled by retrying a rewritten prompt | wasted credits, inconsistent prompts | fixed ladder: same prompt twice -> lexicon neutralisation -> minimal neutral -> storyboard change, all logged |
| 9 | no state, no resume | run died at 6/26 and lost the plan | per-stage `state/*.json` with input hashes; idempotent commands |
| 10 | xfade 0.4 s on every join | dissolves smeared across scene changes and slowed the cut | transition chosen per join: dissolve inside a scene, 5-frame light bloom on scene change, hard cut on impact |
| 11 | shot prompts hand-written in a spec JSON | unmaintainable at 26 shots, typos duplicated paragraphs | prompts composed from slots; duplicate-paragraph and banned-vocabulary checks at G2 |
| 12 | assembly computed offsets by eye | drift accumulates over 26 joins | offsets derived from `timeline.json`; `sum(d) = T + (n-1)*xfade` asserted |

## 4. Decisions this plan makes

- **Resolution:** 720x1280 in, 720x1280 out. The start frame keys the video
  model's output size; there is no upscale step in v2. A 1080x1920 pipeline
  would need generative upscale and is out of scope.
- **Short length:** 45-120 s. This script lands near 95-105 s, which is fine.
  The 55-70 s rule in `../SKILL.md` applies to the three.js format only.
- **Shot cadence:** target 4.8 s, hard range 4.0-5.6 s. On ~100 s that is
  ~21-24 shots. Calmer than 26 cuts in 100 s, and every shot can actually move.
- **Structure:** one narration spine. No per-shot voice acting, no dialogue.
- **Sound:** narration only. No music, no SFX, unless asked. If asked, reuse
  `templates/audio/mix.py` with the bed at -24 LUFS under voice at -16.
- **Captions:** off. If asked, burn them per shot, never per word.
- **Provenance:** every generated asset keeps its request JSON
  (`*.generation.json`, `keyframes/manifest.json` with prompt + attempt).

## 5. Phases

### Phase 0 — probe and pin (30 min, no spend)

- [ ] Probe elevellab: `/health`, `/v1/config`, `/v1/voices?language=bn&free=1`.
      Confirm solver online and `concurrency`.
- [ ] Probe Gemini auth: extract `__Secure-1PSID` and `__Secure-1PSIDTS` from
      the running Helium via CDP, then one throwaway `generate_content`.
- [ ] Probe vibes auth: `autoSession()` + `auth.me()`.
- [ ] Free disk >= 15 GB, ffmpeg >= 7, Node >= 22, Python 3.11+.
- [ ] Write `state/probe.json` with every version and account identity.

Exit: all three services answer, or the blocker is named in the report.

### Phase 1 — timing spine (45 min, cheap)

- [ ] `script.json` from the verbatim script. G0 hash check.
- [ ] Bake-off: 3 segments x 2 voices x 2 models (v4 prosody vs v3 tags),
      12 short renders. Blind listen, pick one voice and one emotion strategy,
      record the choice in `qa/tts-bakeoff.md`.
- [ ] Full synthesis, pause plan, `timeline.json`. G1.

Exit: `narration.wav` exists, every word timed, duration known to 10 ms.

### Phase 2 — look lock (60 min, 4-6 images)

- [ ] Character sheet (13 characters, one grid, locked style).
- [ ] Location plates: celestial dawn, ocean of milk, Kailash, forest clearing,
      sky chariot, Lanka gate. Six plates, reused across shots.
- [ ] Three-shot look test: hook, battle, death. Compare side-by-side against
      `part1-startframe.jpg`; score colour, ink, lighting, faces, composition.
- [ ] Freeze `style-lock.json`. Any later change re-runs the test.

Exit: three keyframes at the bar, reviewed by a fresh agent or by the user.

### Phase 3 — storyboard (30 min)

- [ ] Beat map: every sentence gets `beat`, `cast`, `location`, `emotion`,
      `motionClass`.
- [ ] Shot planning from `timeline.json`. G2.
- [ ] Prompt assembly, then a duplicate-paragraph and banned-word lint.

Exit: `shots.json` covers 100 % of words; every shot has two prompts.

### Phase 4 — keyframes (60-90 min, ~26-34 images)

- [ ] Draft all keyframes, 4 concurrent, conditioned on the sheet and plate.
- [ ] Contact sheet -> review -> regenerate failures (budget 30 %).
- [ ] Text-artifact OCR, aspect fit, manifest. G3.

Exit: 26 frames, one look, zero text artifacts.

### Phase 5 — clips (90-120 min, ~26-34 clips at 3 concurrent)

- [ ] Generate 4.8 s clips. Retry ladder on moderation.
- [ ] Per-clip probe + drift/motion triage. Regenerate out-of-range clips.
- [ ] Chain finally-approved clips for in-scene continuity.

Exit: all clips 720x1280/24/125 f, motion present, pose held. G4.

### Phase 6 — assembly (45 min)

- [ ] EDL from timeline; transition per join.
- [ ] Two-pass loudnorm, AAC 192k, faststart.
- [ ] Join QA: contact sheet of every cut, no black/frozen frames. G5, G6.

Exit: `final.mp4` within 0.3 s of narration, -16 LUFS, no defects on the
contact sheet.

### Phase 7 — report

- [ ] `README.md`: pipeline, commands, timings, credit spend, compromises.
- [ ] Report: duration, shot count, path, what was compromised and why.

Rough wall clock: **5-7 h** unattended, dominated by generation latency. Token
cost is low; the expensive resources are video credits and patience.

## 6. Parallelism map

```
Phase 1  seg01..seg17 ── 3 at a time ──► concat
Phase 2  sheet → plates → look test (sequential, cheap)
Phase 3  shots.json (single pass)
Phase 4  keyframes ── 4 at a time ──► review -> regen failures
Phase 5  clips ── 3 at a time, dependency: keyframe + previous clip in scene
Phase 6  sequential
```

Hard constraint: vibes is one account, one session. Above 3 concurrent
generations the account sees rate limits and the run gets slower, not faster.
The first run's "4 max" was the upper bound, not the optimum.

## 7. Risks

| risk | likelihood | impact | mitigation |
|---|---|---|---|
| Gemini cookie expiry mid-run (Chromium device-bound sessions last hours) | high | keyframes stop | re-extract via CDP; keep the run resumable; do keyframes before a long break |
| vibes session missing (`~/.vibes-session.json` was absent at probe time) | high | no clips | one-time `autoSession()` re-login in Phase 0; if it needs a browser login, hand off to the user immediately |
| moderation on battle/death beats | certain | retries | lexicon ladder + mythic stylisation; budget 30 % waste |
| character sheet does not lock (Gemini edits instead of matching) | medium | drift | weight the reference instruction, regenerate the sheet until it is stable, use it as an edit source not a style hint |
| narration longer than planned | medium | shot count mismatch | plan_shots is derived, not fixed; it absorbs any duration |
| disk | low | run dies | 43 GB free; each clip ~4 MB, frames ~300 KB; keep only deliverables |
| AI invents text on frames | high | unshippable | OCR gate + negative prompt; regenerate, never crop around it |
| one clip drifts badly and cannot be fixed by prompt | medium | a bad cut | fallback: regenerate with a tighter framing; last resort: allow the drift and note it |

## 8. Open decisions (need an answer before Phase 1)

1. **Voice.** `713Bv3p3NNV0DJn7YgBo` (Valf, used in v1) vs
   `OHhJ32z5ulznaiTfV1cI` (Shadhin Bangla, warm) vs
   `VizHiwkPO7hXc967v4tE` (Rakib, deep/authoritative). Default: run the
   bake-off, pick on the recording.
2. **Emotion delivery.** v4 + prosody map (proven) vs v3 + inline `[tags]`
   (expressive, unverified for Bengali). Default: bake-off decides.
3. **Pauses.** `[short pause]` becomes real silence. Proposed: 0.9 s at tag,
   0.5 s at sentence end, 0.3 s at clause, 0.0 s elsewhere. Confirm or adjust.
4. **Music.** None (default) or a low tanpura/ambient bed at -24 LUFS.
5. **Captions.** None (default). The reference channel uses word captions;
   the repo rule is none unless asked.
6. **Reuse.** The interrupted run left 26 keyframes and 6 clips in
   `~/Videos/garuda-jatayu`. Reuse them as-is, reuse only the approved ones, or
   start clean at `garuda-jatayu-v2`? Default: start clean, keep the old folder
   untouched as a comparison.
7. **Look drift.** The reference clip's subject drifts (the vulture rises from
   Rama's lap). Match that energy or hold the pose harder? Default: hold the
   pose, move the camera.

## 9. Definition of done

Pilot specification and acceptance criteria: `missions/garuda-jatayu.md`.

- `final.mp4`: 720x1280, 24 fps, 125-frame shots, AAC, -16 LUFS +-1,
  duration within 0.3 s of the narration.
- Every word of the verbatim script is spoken and illustrated.
- No text artifacts, no extra characters, no unapproved look changes.
- All seven gates ran; every waiver is listed in `README.md` with its reason.
- Two consecutive runs from a clean checkout produce the same shot list.
