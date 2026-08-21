# Device acceptance checklist

This is the half of acceptance that no script can close.

`npm run verify:e2e` exercises the live Anuvadini STT/TTS and Pravah services and the
whole application chain, but it feeds them **synthesised audio**. Four things stay
unverified by it, and all four are things only a person with a handset can test:

1. the microphone and the audio capture path,
2. the on-device (native) recogniser,
3. real accents and speaking styles,
4. background noise.

Work through this once per language you intend to ship. A language is *accepted* only
when every step passes. Record the result in the table at the end.

---

## Before you start

- A physical Android device. An emulator will not do — its microphone is host audio and
  its speech recogniser is often absent.
- A release build: `npm run build:android`, then install
  `android/app/build/outputs/apk/release/app-release.apk`.
- Network access to both providers.
- The floating bubble enabled in Settings, and the overlay permission granted.

Use the corpus text for the language under test as your script. It is in
`dictationsamples/<code>.txt`; sample 9 deliberately leaves the reaction start date
unsaid, which is what forces the spoken prompt.

---

## The twelve steps, per language

### 1. Set the dictation language

Settings → Dictation language → the language under test. Leave the app language alone;
they are separate settings and this checklist is about the dictation one.

**Pass:** the setting shows the language you chose after leaving and re-entering
Settings.

### 2. Start a dictation from the floating bubble

Leave MedScribe, open any other app, tap the bubble, press play.

**Pass:** recording starts without opening MedScribe, and the bubble shows a recording
state.

### 3. Speak the sample, at a natural pace, in your own accent

Do not read it in a flat "computer voice". The point of this step is that the previous
verification could not.

**Pass:** the waveform or level indicator responds while you speak.

### 4. Watch the drawer while you are still speaking

**Pass:** partial text appears. At this stage it comes from the native recogniser, and
it is allowed to be poor — that is the whole reason the AI transcription exists.

### 5. Stop, and wait for the AI transcription

**Pass:** within a few seconds the drawer text is **replaced** by the Anuvadini AI
transcription. This is the acceptance requirement for the drawer: the text you end up
looking at must be the AI one, not the native one.

**How to tell them apart:** the native recogniser typically garbles names and numbers
in Indic languages; the AI transcription usually renders them correctly. If you know
they will differ, note both before and after.

**Fail** if the drawer keeps showing the native text after the AI result has arrived,
or if it flickers back to the native text.

### 6. Confirm the drawer text is in your own language and script

**Pass:** the text is in the script of the language you spoke — not transliterated into
Latin, and not translated into English.

### 7. Edit the drawer text, then let it settle

Type a word into the drawer. Wait.

**Pass:** your edit survives. Nothing overwrites it while you are typing, and the
"Changes saved" indicator only appears after you actually save.

### 8. Open the full review and check the two panes agree

**Pass:** the review screen shows the same text the drawer showed, including your edit.
The original pane is in your language; the English pane is the translation.

### 9. Generate the report

**Pass:** the report is blocked, and the missing-fields dialog names the reaction start
date (with sample 9). If your sample is complete, remove a detail and repeat — the
spoken prompt is only reached when something is missing.

### 10. **Listen to the spoken prompt.** This is the acceptance criterion.

**Pass:** the prompt is spoken **in the language you dictated in**, by that language's
voice, using that language's words. The report on screen is in English at this moment;
the speech must not be.

**Fail** if you hear English (unless you dictated in English), or if you hear your
language's words read by an obviously wrong voice.

For languages with no voice of their own — Bodo, Dogri, Konkani, Maithili, Sanskrit,
Santali, Sindhi, Kashmiri, Manipuri — the designed behaviour is a fallback: Devanagari
scripts fall back to Hindi, everything else to English. Hearing the fallback is a
**pass**, and the dialog should say so rather than staying silent.

### 11. Press "Read aloud again"

**Pass:** the same prompt replays, in the same language. Nothing switches to English on
the second play.

### 12. Repeat step 3 with noise

Play a radio, a fan, or a conversation nearby, and dictate two sentences.

**Pass:** the AI transcription still returns something usable, and — whatever the
quality — the spoken prompt is still in your language. Degraded recognition is
acceptable here; a language switch is not.

---

## Also worth doing once, in any language

**Resume an old consultation.** Open a consultation recorded before this build, add
speech, generate. The prompt must still be spoken in that consultation's language. A
session row written before the `language` column existed has no language stored, and
this is the path where the app used to fall silently back to English.

**Start a second dictation straight after finishing one.** Change the dictation
language in Settings first. The second dictation must use the new language, not inherit
the finished one's.

---

## Record the result

| Language | Device / Android | Steps 1–4 | 5–8 drawer | 9–11 spoken prompt | 12 noise | Tester | Date |
|---|---|---|---|---|---|---|---|
| Hindi | | | | | | | |
| Odia | | | | | | | |
| Bengali | | | | | | | |
| Tamil | | | | | | | |
| Telugu | | | | | | | |
| Marathi | | | | | | | |
| Gujarati | | | | | | | |
| Kannada | | | | | | | |
| Malayalam | | | | | | | |
| Punjabi | | | | | | | |
| Urdu | | | | | | | |
| Assamese | | | | | | | |
| Nepali | | | | | | | |
| English (India) | | | | | | | |

Anything that fails step 5, 6, 10 or 11 is a blocker: those are the four steps that
carry the two stated acceptance requirements — the drawer shows the AI transcription,
and the original language survives to the spoken reply.
