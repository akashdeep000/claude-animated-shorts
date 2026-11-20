# Sound: generated music and SFX, programmatically

Short answer: **yes**, and the constraints are known rather than guessed. Music
is generated locally (numpy, deterministic, frame-accurate). SFX are generated
locally too, with the ElevenLabs anonymous sound-generation endpoint available
as an optional quality pass — but it is quota-limited, not an unlimited lane.
Everything below was measured on this machine on 2026-11-20.

## What is actually available

| lane | auth | limit | verdict |
|---|---|---|---|
| `POST https://api.elevenlabs.io/sound-generation` (web preview) | none | **quota_exceeded after 2 requests**, 4 takes each | good for 2 hero cues x 4 takes |
| `POST https://api.elevenlabs.io/v1/sound-generation` (public API) | `xi-api-key` | plan-dependent | needs auth; not used |
| `/v1/sound-generation/anonymous` | — | 404, no such route | does not exist |
| ElevenLabs Music API | `xi-api-key` | plan-dependent | not reachable anonymously; not used |
| ElevenLabs audio tags in TTS | same anonymous TTS lane | works | diegetic only, cannot be mixed |
| local numpy synthesis | none | unlimited | **primary for music, default for SFX** |

Measured SFX response, 3.0 s request, ~3.8 s latency:

```json
{ "sound_generations_with_waveforms": [
    { "sound_generation_history_item": { "text": "...", "content_type": "audio/opus",
        "generation_config": { "generation_settings": { "duration_seconds": 3.0,
          "prompt_influence": 0.3, "loop": false }, "number_of_generations": 4,
          "output_format": "opus_48000_192" } },
      "waveform_base_64": "T2dnUw..." } ] }
```

The field is named `waveform_base_64` but it is the **audio**: base64 Ogg/Opus,
48 kHz stereo, exact requested duration, 4 takes per call. Decode, `ffprobe`,
pick a take. That is a real generator, just a narrow one.

Audio tags inside the TTS (verified with `eleven_v4` + Bengali):

```
[thoughtful] হ্যাঁ।      1.31 s   tag is a direction (tag alone -> HTTP 422)
হ্যাঁ।                   0.84 s   control
[thunder rumbling] হ্যাঁ। 2.19 s   inserts ~1.35 s of real sound
```

So a tag can *perform* a single diegetic event, but the sound lands inside the
narration file where it cannot be ducked, panned or retimed. Never use tags for
ambience, music or battle sound.

Listening set from these probes (outside the repo, kept as evidence):

```
~/Videos/garuda-jatayu-v2/probe/voice/viraj-tagged.mp3        7.55 s
~/Videos/garuda-jatayu-v2/probe/voice/viraj-plain.mp3         6.92 s
~/Videos/garuda-jatayu-v2/probe/voice/viraj-diegetic-tag.mp3  2.19 s
~/Videos/garuda-jatayu-v2/probe/sfx/conch-take0..3.mp3        3.00 s each
~/Videos/garuda-jatayu-v2/probe/sfx/whoosh-take0.mp3          1.20 s
```

## Architecture

```
timeline.json ─┐
shots.json ────┼─► score/cues.json ─┬─► music.wav   (local raga engine)
script.json ───┘                    └─► sfx.wav     (local synth + hero takes)
                                             │
voice.wav ───────────────────────────────────┴─► mix.wav (-16 LUFS)
```

The cue sheet is derived, never hand-written. That is the difference between a
reusable tool and the bridge cue table (500 rows, unreusable).

```json
{ "sections": [
    { "id": "M03", "startSec": 31.04, "endSec": 44.10, "raga": "bhairavi",
      "tala": "keherwa", "bpm": 64, "levelLu": -24,
      "palette": ["tanpura", "sarangi", "bansuri"] } ],
  "events": [
    { "t": 31.04, "cue": "whoosh_flash", "gainDb": -18, "pan": 0.0 },
    { "t": 31.90, "cue": "clash_metal",  "gainDb": -14, "pan": -0.2, "take": 2 } ] }
```

## Music: a raga engine, not a loop library

One section per story beat, snapped to shot starts. A section changes only on a
cut: a tempo or raga change under a held camera reads as a mistake.

| story state | raga | tala / bpm | palette | why |
|---|---|---|---|---|
| hook, doubt, mystery | Malkauns | free, 56 | tanpura, low bansuri, one bell | dark, wondering, leaves room for the question |
| lineage, exposition | Kafi | keherwa 64 | tanpura, plucked sitar, swarmandal | warm storytelling, not sad |
| deceit, serpent, night | Malkauns | rupak 58 | low drone, sarangi, sparse damaru | unease without a horror sting |
| war, clash, storm | Bhairav | adi 104 | damaru, low strings, conch, cymbal | awe and menace; rhythm only here |
| boon, divine reveal | Yaman | free, 60 | swarmandal, bansuri, chimes, conch | radiant, ascending |
| abduction, flight | Desh | keherwa 92 | sitar tremolo, tabla, wind | urgency with longing |
| grief, death, farewell | Bhairavi | free, 52 | sarangi, tanpura, one distant bell | sorrow, almost still |
| rites, resolution | Yaman -> Bhairavi | free, 48 | bansuri, tanpura, far conch | peace after the loss |

Ragas are used for **flavour** — scale, ornament, register — not as an
authentic performance. Keep them sparse and low; the narration owns the mids.

### Generation method

1. **Tanpura drone.** Sa + Pa, five plucked strings 0.7-1.1 s apart, slight
   detune, 0.4 Hz amplitude breathing. Always on, -30 dBFS. One continuous
   render, never a looped file (loops seam).
2. **Motif bank.** 3-5 motifs per raga of 3-7 notes drawn from its
   aroha/avaroha with a declared landing note. Sequenced by a grammar:
   statement, answer a fourth up, rest, variation, cadence.
3. **Ornament.** Bansuri: meend (portamento into the note) + 5.5 Hz vibrato.
   Sarangi: gamak (heavier oscillation) + slower attack. These two functions are
   what make a synth read as Indian rather than as a pad.
4. **Space.** >= 40 % rest in every section. A wall of music under narration is
   the fastest way to make a video feel amateur.
5. **Rhythm.** Only in war and abduction: damaru in 8, accents locked to shot
   starts, last hit lands on the cut out.
6. **Cadence.** Each section ends on its landing note with a 0.6 s release,
   crossfaded into the next section's drone.

Instruments to add to `templates/audio/instruments.py`: `bansuri`, `sarangi`,
`damaru`, `conch`, `bell_temple`, `tanpura`. The existing `pluck`, `pad`,
`vibes`, `timpani`, `cymbal` already cover sitar, drone, swarmandal, war drum.

## SFX: local first, ElevenLabs for the two sounds that matter most

Every cue in the sheet has a local synth recipe, so the film never blocks on a
quota. The measured preview quota is **two requests of four takes each**, so it
buys exactly two cues. Spend it on the two sounds the audience will notice:

1. Request `conch` (shankha) and `temple bell` — four takes each, cache by
   prompt hash.
2. Pick one take per cue by ear, freeze it into `sfx/hero/<cue>.opus` + `.json`.
3. Every other cue, and every re-render, uses the local synth — or the frozen
   hero take if one exists.

If the quota is already spent (it resets on its own schedule, not on demand),
skip step 1 entirely. The run is never blocked, and the film never sounds
unfinished because of it.

| cue | local recipe | hero candidate |
|---|---|---|
| `conch` (shankha) | filtered saw + formant + breath swell | yes — first request |
| `bell_temple` | 5-partial modal bank, 6 s decay | yes — second request |
| `wingbeat` | noise whoosh, 3 pulses 90 ms apart | next window |
| `chariot` | 40 Hz rumble + wheel ticks + air | next window |
| `clash` | metal modal + 2 ms transient | no |
| `thunder` | brown noise + sub boom + tail | no |
| `fire` | crackle train + low roar | no |
| `whoosh_flash` | reverse swell + low whoomp | no |
| `feather_fall` | noise tick + soft thump | no |
| `crowd` | 12-24 formant voices (`vox()` exists) | no |
| `ocean` | filtered noise bed + slow swell | no |
| `wind` | band-passed noise, slow LFO | no |
| `heartbeat` | 2 low sine pulses, 0.9 s apart | no |

### Placement rules

1. **Keyword map**: Bengali/transliterated keywords per cue (`যুদ্ধ` -> clash,
   `ডানা` -> wingbeat, `রথ` -> chariot, `অমৃত` -> conch, `অন্তিম` ->
   bell_temple). Match places a cue on the nearest word start.
2. **Transition map**: `flash` -> `whoosh_flash` on the cut frame; `dissolve`
   -> air swell at -24; `cut` -> nothing.
3. **Motion map**: `impact` -> low boom on the shot's first frame; `parallax`
   -> wind bed for the shot; `sway` -> room tone only.
4. **Density cap**: <= 1 SFX per 2.5 s, <= 1 music event per 1.5 s. When in
   doubt, cut the SFX. Nothing dates a generated video faster than an effect on
   every cut.
5. **Never mid-word**: every cue lands on a word boundary or a cut frame within
   one frame (41.7 ms at 24 fps).

## Levels

| stem | target | note |
|---|---|---|
| voice | -16 LUFS integrated | gain only, no processing |
| music | -24 LUFS, ducked -3 dB under speech | 70 ms attack, 450 ms release, key from **words**, not audio |
| sfx | -18 LUFS momentary peak | per-cue gain from the sheet |
| mix | -16 LUFS, TP <= -1.5 dBTP, LRA 6-14 | limiter, no clipping |

Ducking is keyed from `timeline.json` word spans (merged with 0.3 s gaps), so a
breath between sentences still gets the bed back. Reuse
`templates/audio/mix.py:duck_db` verbatim.

## Verification (gate G6b)

```bash
ffmpeg -i mix.wav -af ebur128=peak=true -f null -
python tools/qa.py "$PROJ" --gate audio
```

Pass:

- integrated -16 +-1 LUFS, true peak <= -1.0 dBTP, LRA 6-14;
- voice-minus-bed margin >= 6 LU on every spoken window (the bridge table is the
  model: 8-18 LU, median ~9);
- duck depth 2.5-3.5 dB between speech and gaps;
- no cue starts before 0 or ends after the narration;
- no click at a cue edge (5 ms fade in/out on every event);
- no loop seam in the drone (one continuous render, verified by a spectral
  discontinuity check or by ear).

## Failure modes

| symptom | cause | fix |
|---|---|---|
| voice sounds muffled | drone or low strings in 120-250 Hz | high-pass music at 90 Hz, drop drone 4 dB |
| narration hard to follow | melody in 1-3 kHz | keep melody < 1.5 kHz or -4 dB in the speech band |
| score feels Western | equal-tempered chords | drone + single line, no triads, no progressions |
| cuts feel stitched | tempo changes mid-shot | section changes only on shot starts |
| effects feel cheap | too many at full level | density cap, -18 LUFS, more silence |
| mix pumps | limiter doing 6 dB | lower music and SFX 2 dB, re-run |
| SFX generation 401 `quota_exceeded` | preview lane spent | fall back to local synth; the run must never block |

## Build order

1. `score/cues.json` derivation — review the sheet like `shots.json`, no audio.
2. Instrument additions: `bansuri`, `sarangi`, `damaru`, `conch`, `bell_temple`,
   `tanpura`.
3. `score.py` renders `music.wav`; `sfx.py` renders `sfx.wav` (local + frozen
   hero takes).
4. `mix.py` — duck, limit, meter, stems, `cues.md`.
5. Listen once end to end **before** the picture render. If the score does not
   work alone, it will not work under narration.
