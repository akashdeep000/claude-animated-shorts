# Pilot: যিনি গরুড়, তিনিই জটায়ু!

The first target for this pipeline, kept as the acceptance test. Script is
verbatim; the brackets are emotion tags, not spoken words.

## Script (verbatim)

```
[thoughtful] যিনি গরুড়, তিনিই জটায়ু! [short pause] এমনটা যদি আপনিও ভেবে থাকেন, তাহলে ভিডিওটি আপনারই জন্য। [excited] হিন্দু পুরাণের এই দুই বিশাল দিব্যপক্ষী নিয়ে নব্বই শতাংশ মানুষের মধ্যেই রয়েছে বিশাল কনফিউশন! গরুড় হলেন মহর্ষি কশ্যপ এবং তাঁর স্ত্রী বিনতার পুত্র। বিনতার আরেক পুত্র ছিলেন অরুণ, যিনি সূর্যদেবের সারথি। গরুড়ের সৎমা কদ্রু ও তাঁর সর্পপুত্ররা অর্থাৎ নাগগণ ছলনা করে বিনতাকে দাসী বানিয়ে রেখেছিলো। [serious] মাকে দাসত্ব থেকে মুক্ত করার জন্য গরুড় স্বর্গে গিয়ে দেবরাজ ইন্দ্র ও সমস্ত দেবতাদের সাথে যুদ্ধ করে অমৃতের কলস নিয়ে আসেন। তাঁর এই অসীম শক্তি ও মাতৃভক্তিতে মুগ্ধ হয়ে ভগবান বিষ্ণু তাঁকে বর দেন যে, গরুড় অমৃত পান না করেও অমর হবেন এবং সেদিন থেকে তিনি হলেন শ্রী বিষ্ণুর বাহন। [thoughtful] অপরদিকে, জটায়ু হলেন রামায়ণের একটি অত্যন্ত গুরুত্বপূর্ণ বীর চরিত্র, যিনি মাতা সীতাকে রক্ষা করতে গিয়ে নিজের প্রাণ বিসর্জন দিয়েছিলেন। জটায়ু হলেন গরুড়ের বড় ভাই অরুণের পুত্র। [short pause] অর্থাৎ, সম্পর্কের দিক থেকে গরুড় হলেন জটায়ুর কাকা। জটায়ু ছিলেন রাজা দশরথের পরম বন্ধু। বনবাসকালে রাবণ যখন ছলনা করে মাতা সীতাকে হরণ করে পুষ্কর রথে আকাশপথে লঙ্কায় নিয়ে যাচ্ছিল, তখন তার রথের সামনে ঢাল হয়ে আবির্ভূত হন এই মহাবীর জটায়ু। আকাশপথেই রাবণের সাথে শুরু হয় এক ভয়ংকর যুদ্ধ! অনেক চেষ্টা করেন জটায়ু মাতা সীতাকে বাঁচানোর, কিন্তু শেষ পর্যন্ত রাবণ চন্দ্রহাস খড়্গ দিয়ে কেটে ফেলে জটায়ুর একটি ডানা। শেষ প্রহারে এক লাথিতে জটায়ু ছিন্ন করেন রাবণের মস্তক, কিন্তু বরপ্রাপ্ত দশাননের গজিয়ে ওঠে নতুন মস্তক, আর মাটিতে ছিটকে পড়েন আহত জটায়ু। [sad] শ্রীরামের কোলে শেষ নিঃশ্বাস ত্যাগ করার আগে জটায়ু সীতা হরণের সমস্ত বৃত্তান্ত ও রাবণের দক্ষিণ দিকে যাওয়ার খবর দেন এবং স্বয়ং শ্রীরাম পিতার মতো তাঁর অন্তিম ক্রিয়া সম্পন্ন করেন।
```

252 words. At the measured rate of 1.95-2.18 words/s that is ~116-129 s of
speech, ~136 s with the pause plan. Expect **~28 shots** (27-30 from the DP),
not the 18-20 estimated from an English words-per-second figure.

## Story spine

confusion hook -> Garuda born to Kashyapa and Vinata -> Aruna the charioteer ->
Kadru's deceit, Vinata enslaved -> the amrit war with Indra -> Vishnu's boon and
the vahana -> Jatayu introduced -> Jatayu is Aruna's son, so Garuda is his uncle
-> Dasharatha's friend -> Sita carried away in the pushpaka chariot -> Jatayu
stands in the chariot's path -> the aerial battle -> the wing -> ten heads regrow,
Jatayu falls -> death on Rama's lap, the direction of Lanka, the last rites.

## Cast and locations

Cast: GARUDA, JATAYU, RAMA, LAKSHMANA, SITA, RAVANA, VISHNU, VINATA, KADRU,
ARUNA, INDRA, DASHARATHA, KASHYAPA.

Locations: `celestial-dawn`, `kailash`, `ocean-of-milk`, `naga-realm`,
`indra-court`, `forest-clearing`, `sky-chariot`, `lanka-gate`.

## Visual rules specific to this one

- **Jatayu has one fully formed wing.** Never describe the other one as a wound,
  a stump or blood. In the still, show a short wing with a few feathers; in
  motion, show him straining, never injured.
- **Ravana's ten heads**: keep 3-4 clearly readable and the rest in shadow.
  Ten lit faces at 720p reads as a bunch of grapes.
- **Garuda and Jatayu must not read as the same bird.** Garuda is gold, upright,
  jewelled, young; Jatayu is grey-brown, hunched, aged, with a faded saffron
  thread. When both are in frame, they should be in profile or clearly separated.
- **The hook is a question to camera.** Garuda alone, direct address, negative
  space. The comparison shot (S02) is where both birds appear.
- **No on-screen text.** The title is spoken, never drawn.

## Success criteria

- 720x1280, 24 fps, -16 LUFS, duration within 0.3 s of the narration.
- Every clause illustrated; no shot stretched beyond 1.12x.
- One look across all ~28 shots; Jatayu on-model in every frame.
- `final.mp4` at `~/Videos/garuda-jatayu-v2/final.mp4`, README with the
  compromises listed.

## Known environment state at plan time

- elevellab: healthy at `127.0.0.1:8100`, solver online, `concurrency: 3`,
  `eleven_v4` default, 37 Bengali voices in the library. Locked voice:
  `3AMU7jXQuQa3oRvRqUmb` (*Viraj — Rich, Confident and Expressive*), with inline
  audio tags on `eleven_v4`.
- Helium profile: `~/.config/net.imput.helium` (cookies present). Gemini auth
  needs its CDP endpoint on `127.0.0.1:9222`.
- vibes: `~/.vibes-session.json` absent, so `autoSession()` must re-login in
  Phase 0. `autoSession()` looks in helium first, then chrome/chromium/brave/edge.
- The interrupted run's artifacts are in `~/Videos/garuda-jatayu/` (26 keyframes,
  6 clips, no final cut). Keep it as a comparison, do not overwrite.
