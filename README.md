# Claude Animated Shorts

Two ways to make a vertical story short, same standard of proof, different
renderer.

| | `SKILL.md` | `ai-video-short/SKILL.md` |
|---|---|---|
| look | 2D characters in a painted 3D world | premium 2D Indian mythological comic-book illustration |
| renderer | three.js inside Remotion, on your PC | Gemini keyframes -> vibes.ai image-to-video |
| clock | `words.json` word timings | `timeline.json` word timings incl. pauses |
| output | 1440x2560, 55-70 s, music + SFX | 720x1280, 60-150 s, generated score + SFX |
| cost | GPU time, no credits | video credits, no GPU |
| best for | crowds, architecture, camera language you control exactly | faces, painted mythic scenes, one hero figure |

Both keep the same spine: facts first, one locked look, measurements instead of
adjectives, and gates that must pass before the next spend.

## The original: three.js + Remotion

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## The new one: word-timed TTS + keyframes + image-to-video

`ai-video-short/` replaces the renderer with a generative pipeline:

```
script (verbatim)
  -> elevellab TTS, per-segment word timestamps
  -> timeline with an explicit pause plan
  -> shot plan solved from the real word boundaries
  -> Gemini keyframes, one character sheet, one look
  -> vibes.ai 9:16 clips, 720x1280, pose-locked
  -> generated raga score + synthesized SFX, ducked under the voice
  -> ffmpeg EDL cut to the narration, -16 LUFS
```

Read `ai-video-short/PLAN.md` first: it lists what was kept from the three.js
skill, the twelve defects in the first ad-hoc run (stretched clips, keyframe
prompts reused as video prompts, no resume, no reference conditioning), and the
eight gates that prevent them.

## The mythic style bar

The new format has its own look, and its own evidence:

- `references/mythic/part1-startframe.jpg` — the keyframe that set the bar
  (720x1280).
- `references/mythic/ramayana-part1-v1.mp4` — a working clip: 720x1280, 24 fps,
  125 frames, 5.208 s, YAVG 107.9 / SATAVG 25.7 / HUEAVG 136.6.
- `references/mythic/p1-prompt.txt` and `p2-prompt-v3.txt` — the passing prompt
  shape, including the pose-lock sentence.
- `ai-video-short/STYLE-LOCK.md` — the locked style block, the 13-character
  sheet and the palette targets. One source of truth; the reference folder is
  evidence, not a second copy.

The two generic helpers from that run are in `templates/mythic/`:
`ramayana-gen.mts` (one shot end to end) and `kinetic.sh` (camera/god-ray life
pass for static clips).

`references/` (the top-level folder) remains the private study material for the
three.js format. `references/mythic/` is our own generated work and can be
published; keep the two separate.

Status: **plan + contracts.** Stage CLIs are specified in
`ai-video-short/tools/CONTRACTS.md`; no pipeline code has been written yet.

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | three.js skill: the full pipeline, every rule, every fix, and the final look values |
| `ai-video-short/SKILL.md` | AI-video skill: the operational pipeline an agent follows |
| `ai-video-short/PLAN.md` | phases, gates, risks, open decisions |
| `ai-video-short/PIPELINE.md` | stage contracts, exact API requests, state machine |
| `ai-video-short/SHOT-PLANNING.md` | word timings -> shots: constants, DP, worked example |
| `ai-video-short/STYLE-LOCK.md` | locked style block, character sheet, measured palette |
| `ai-video-short/PROMPTS.md` | prompt algebra, motion classes, moderation ladder |
| `ai-video-short/AUDIO.md` | generated raga score + synthesized SFX, cue sheet, levels, ducking |
| `ai-video-short/QA.md` | gates G0–G6b, thresholds, defect ledger, ship checklist |
| `ai-video-short/schemas/` | JSON Schemas for script, timing, shots, state |
| `ai-video-short/tools/CONTRACTS.md` | the thirteen CLIs, their I/O and exit codes |
| `ai-video-short/missions/garuda-jatayu.md` | the pilot script, cast, visual rules and acceptance criteria |
| `templates/bridge/` | the full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/mythic/` | one-shot vibes generator + kinetic life pass from the mythic run |
| `templates/audio/` | the synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `references/STYLE_BIBLE.md` | The script and visual formula measured from 20 reference shorts |
| `references/mythic/` | our own mythic style bar: start frame, working clip, passing prompts, measured palette |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |
| `references/frames/` | 38 full-size reference frames (540x960) to compare your frames against |
| `references/sheets/` | 20 contact sheets, one per reference short, 60 frames each (1,200 frames) |

## Install
1. Copy the skill folder you want to your skills directory, e.g.
   `~/.claude/skills/cartoon-3d-short/` (this folder) or
   `~/.claude/skills/ai-video-short/` (`ai-video-short/`).
2. For three.js: [Remotion](https://www.remotion.dev/) with `@remotion/three`,
   plus Node, Python 3 and ffmpeg.
   For AI video: Node 22+, Python 3.11+ with `gemini-webapi`, `numpy`
   (`scipy` only if needed), ffmpeg 7+, a running elevellab (`127.0.0.1:8100`)
   and a vibes.ai account.
3. In Claude Code: *"Use the cartoon short skill and make a short about …"* or
   *"Use the ai-video-short skill and make this script: …"*.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- The AI-video path needs no such temp folder, but it does burn video credits:
  every rejected clip is money. That is why keyframes are reviewed before
  generation and why the plan reconciles shot durations before any spend.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
