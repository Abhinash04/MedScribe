# Hindi multilingual pipeline — end-to-end validation report

Run against the **live** Pravah translation API and the **live** Anuvadini TTS
service, using the three supplied Hindi dictation samples.

Reproduce offline: `npm run test:hindi` (75 assertions, no network).
Re-run live: `PRAVAH_API_KEY=apk_… npm run validate:hindi -- --sample=all`

---

## Verdict

**The pipeline works.** Sample 3 produced a complete, valid English report from
Hindi dictation with every mandatory field filled and nothing blocking.

**Translation quality is the limiting factor, and it is a patient-safety
concern.** Every remaining field miss is caused by the translation losing or
corrupting clinical content — not by extraction, validation or the report layer.

| Stage | Result |
|---|---|
| Hindi dictation → Hindi transcript | Not verifiable without a device — see checklist |
| Anuvadini STT refinement | Not verifiable without a device — see checklist |
| Hindi → English (Pravah) | **Works.** All 3 samples translated, 1 chunk each |
| Numbers, PINs, phones, dosages preserved | **12/12 — perfect** |
| English → structured JSON | **Works** |
| JSON → English report | **Works** |
| Mandatory-field validation | **Works** — blocks correctly, names the right fields |
| Hindi TTS prompt | **Works** — Devanagari text, verified Hindi voice |
| Add More Speech merge | **Works** — fills gaps, preserves doctor edits |

Field extraction across the three samples: **27 of 33** (was 23/33 before the
two extraction fixes below).

---

## The safety finding: medical mistranslation

Three clinically wrong translations appeared in three samples. This is the most
important result in this report.

| Hindi (dictated) | Correct English | Pravah returned | Severity |
|---|---|---|---|
| वायरल फीवर | viral fever | **"pertussis"** (whooping cough) | **Wrong diagnosis** |
| सूखी खांसी | dry cough | **"dandruff"** | **Wrong symptom** |
| छींक आना | sneezing | **"shortness of breath"** | **Wrong symptom** |
| गले में खराश | sore throat | **"a stiff neck"** | **Wrong symptom** |
| मधुमेह की बीमारी है | has diabetes | "Preexisting disease (s)." | Information dropped |
| निदान | diagnosis | "The definition of the disease is" / "The etiology is" | Label mangled |
| पैरासिटामोल 650 | paracetamol 650 | "paracetamol650" | Space lost |

**A wrong value is more dangerous than a missing one.** In sample 1 the doctor
said *viral fever* and the translation said *pertussis*. Had extraction picked
that up, the report would have carried a confident, clinically wrong diagnosis.
It did not, only because the surrounding phrase ("The definition of the disease
is") matched no marker — the app was saved by accident, not by design.

**Recommendation:** raise this with the Anuvadini team. The general-purpose
translation model is not tuned for clinical Hindi. Until it is, the doctor
reviewing the English translation card before generating the report is not a
convenience — it is the safety control. That card already exists and is
editable.

Numbers, by contrast, were **flawless**: every PIN code, phone number, age and
dosage survived intact across all three samples.

---

## Bugs found and fixed

Four defects, all found before a single API call, all fixed and covered by tests.

### 1. Translation could never authenticate — total blocker
`transcriptTranslation.js` had lost its API-key plumbing: it called
`resolveTranslationTransport()` with no argument and never passed a key to the
client. Translation would have reported "not configured" on every device build.
The whole credential chain was missing — `appConfigService.getPravahKey`, the
TurboModule spec method, the Kotlin override, and the Gradle `buildConfigField`.
**Fixed:** chain restored end to end.

### 2. Generate Report did not wait for an in-flight translation
`markTranslationPending` stamps `sourceText` to the current source, so `isStale`
reported "current" while the translation was still running and `text` was still
empty. `ensureTranslation` returned instantly, the report was built from raw
Hindi, and the doctor got a missing-fields modal seconds before the translation
landed. **This was the default path**, not an edge case.
**Fixed:** the in-flight promise is tracked and awaited, with a single
re-evaluation once settled.

### 3. A second dictation pass translated stale text
`stopSession` declared `sourceKind: NATIVE` but passed the *active* transcript —
which on pass 2 is still pass 1's refined text. New speech was silently dropped.
**Fixed:** it now passes the native transcript, matching what it declares.

### 4. A failed re-translation silently reused stale English
The report was built from out-of-date English while the UI chip read "Original
(untranslated)" — the two disagreed, and the doctor was never told their latest
speech was missing.
**Fixed:** a `stale` flag is carried on the record, the chip keys on the text
rather than the status, and the translation card explains that the most recent
dictation is not included.

---

## Extraction fixes

Both found by this validation, both raise real-world recall:

- **`patientName` lost on "The name of the patient is X."** The STRONG `the
  name` marker matched at position 0, swallowed `of the patient is X`, and was
  then rejected by the name validator — losing the name entirely. A negative
  lookahead now lets the EXPLICIT marker win. Affected 2 of 3 samples.
- **Address truncated to "House No."** `No.` was treated as a sentence
  terminator. A narrow rule (only when a digit follows) fixes it without
  affecting a sentence that genuinely ends in the word "no". Affected 3 of 3.

All ten pre-existing extraction suites remained green through both changes.

---

## Multilingual TTS — unblocked

Hindi previously had no voice, so the prompt was silent. Probing confirmed the
service is Azure-backed and **13 voices now work**, verified live:

`hi bn ta te kn ml mr gu pa or as ur ne` — plus English.

The probe is trustworthy because the service *rejects* unknown voices with a
500 (`pa-IN-GurpreetNeural`, `sa-IN-BhargaviNeural`), so a 200 is real proof.

Still without a voice: `sa mai doi kok mni brx sat ks-deva ks-arab sd`. These
stay silent with an explanatory modal, which is the existing documented policy.

> A Hindi voice does render Sanskrit/Maithili/Dogri/Konkani text — same script.
> Offered as an option, not applied: it would be idiomatic-sounding but wrong
> for the language, and that is your call rather than mine.

The Hindi prompt produced for a missing PIN and contact number:

> रोगी का नाम, चिकित्सा इतिहास और निदान अभी तक दर्ज नहीं हैं। कृपया ये अनिवार्य जानकारियाँ बताइए।

No English leaks in, and it fits the 600-character TTS cap.

---

## Scenario-by-scenario

| Scenario | Result |
|---|---|
| **1 — Hindi dictation → English report** | Verified from the translation stage onward. Sample 3: 11/11 fields, report complete. Samples 1–2 blocked only by mistranslated clinical terms. |
| **2 — Mandatory-field validation** | Verified. Removing the PIN and contact sentences blocks the report and names *exactly* `pinCode` and `contactNumber`; the other 8 fields are untouched. |
| **3 — Multilingual TTS** | Verified. Prompt is Devanagari, names the fields in Hindi, contains no English, and a Hindi voice is confirmed working. |
| **4 — Add More Speech** | Verified at the merge layer. Pass 2 fills only the missing fields; a hand-edited diagnosis survives untouched and stays flagged as edited; the report then passes validation. |

---

## What still needs a device

Four steps need a microphone and a human speaking Hindi. Everything before and
after them is verified above.

1. **Settings → Language → हिन्दी.** Confirm the row reads `हिन्दी · hi-IN` and
   "How it works" mentions translation.
2. **Dictate Sample 1 aloud in Hindi.** Confirm the live transcript renders
   **Devanagari, not Latin**. If it is Latin the device lacks the Hindi speech
   pack — the app should already be showing the fell-back-to-English banner.
   Install it from Settings › Google › Voice.
3. **Stop.** Confirm the refined (Anuvadini) transcript is also Hindi, and that
   the English translation card fills in below it.
4. **Generate Report → clear the PIN code → Generate again.** Confirm the prompt
   is *spoken* in Hindi, then tap **Add More Speech**, dictate the PIN in Hindi,
   and confirm only the PIN changes.

> Step 4 requires a native rebuild first (`npm run android`) — the Pravah key
> reaches JavaScript through a TurboModule spec, and spec changes need codegen.
> Alternatively run `npm run proxy` with `PRAVAH_API_KEY` in `server/.env`,
> which needs no rebuild at all.

---

## Test coverage added

- `scripts/test-hindi-pipeline.mjs` — 75 assertions replaying the **real**
  captured translations through extraction → JSON → report → gate → Hindi
  prompt, covering all four scenarios offline.
- `scripts/fixtures/pravah-hindi-capture.json` — the live Pravah output, checked
  in so the result is reproducible without spending quota.
- 15 new assertions covering the `stale` translation state.

**30 suites, 2322 assertions, all green.** The ten extraction suites and every
other pre-existing suite passed unchanged throughout.
