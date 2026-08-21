# Multilingual dictation pipeline — measured findings

Measured against the live Pravah service using the 280-dictation corpus in
`dictationsamples/` (20 dictation styles × 14 languages). Re-measure with
`npm run validate:dictation -- --capture`.

## Result

| Path | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| English → extraction → ADR report | 20/20 | 20/20 | 20/20 |
| Non-English → fully correct ADR report | **0/246** | 158/260 | **178/260 (68.5%)** |
| Non-English → report the doctor can file | 0 | 196/260 | **225/260 (86.5%)** |
| Translation-level failures | 14 | 0 | **0** |
| Failures that are OUR bug | 55 | 55 | **3** |

`docs/failure-matrix.md` lists every remaining failure individually with its cause.

`scripts/fixtures/dictation-baseline.json` is the frozen record of the original
0/246 and is never edited. `scripts/fixtures/dictation-current.json` holds the
achieved result; `test-dictation-pipeline.mjs` asserts against both — better than
baseline (the gain is real) and no worse than current (no regression).

---

## Cause 1 — Pravah corrupts numbers · FIXED (mitigated locally)

195 of 246 translations returned a year other than the one dictated. The pattern was
consistent: the first date survived, the second came back as 2022, 2028 or 2027, or
split as `202-6`. Decimals split too — `61.5 kg` returned as `61. 5 kgs`. Only 46 of
246 preserved the numeral sequence exactly.

**Fix.** Numbers no longer go over the wire. `src/services/pravah/protectNumerals.js`
replaces them with alphabetic sentinels before translation and restores the dictated
values afterwards, so whatever the translator does to numbers is irrelevant.

Two details, both of which cost a measurement to learn:

- **The sentinel had to be chosen empirically.** The first attempt used `XQ…QX` and
  Tamil and Urdu rewrote the `Q`. `scripts/probe-numeral-masking.mjs` compares
  candidates against the live service across ten scripts: a bracketed letter survived
  98.3% of the time, `NUMx` 96.7%, `xxAxx` 85%, and `XQ…QX` only 45%.
- **Masking everything made things worse.** A sentinel protects a value but not its
  position. Masking the day of a date let the translator move it away from its month:
  `"ପ୍ରତିକ୍ରିୟା ୧୦ ଅଗଷ୍ଟ ୨୦୨୬"` came back as *"The reaction 10 began in August
  2026"* — every digit correct and unparseable. Only years and decimals are masked
  now; days, ages and whole-number weights stay beside the month or unit that gives
  them meaning.

**Residual.** Year-first languages (Malayalam writes `2026 ഓഗസ്റ്റ് 10`) put the
protected year ahead of the month, and the translator still moves it:
*"The response 2026 began on 10 August and 2026 improved by 12 August."*
`src/services/pravah/repairDates.js` reattaches an orphaned year to a date that has
none, pairing them in reading order. It works on the English side, so it needs no
per-language month tables.

## Cause 2 — the extraction vocabulary was narrower than machine translation · FIXED

The largest single cause. `reactionStopDate` failed 235 times, and still failed 104
after force-correcting every year.

Three separate gaps, all found by reading real output rather than guessing:

1. **`response`, not `reaction`.** Pravah renders प्रतिक्रिया / ପ୍ରତିକ୍ରିୟା as
   *response* far more often than *reaction*, and `response` appeared in no marker.
   This one word accounted for most start-date failures — they fell from 90 to 7.
2. **The verb set.** One dictated clause came back as *ended, recovered, subsided,
   was cured, healed, got better, closed, ceased, abated, in remission* and a dozen
   more. Only *ended*, *stopped* and *resolved* were recognised — roughly 22% of
   observed phrasings.
3. **The coordinate clause.** *"started on the 10th **and recovered on** the 12th"*
   elides its subject, and it is the commonest shape in translated output.

**Fix.** `src/constants/reactionCues.js` holds composable alternation fragments —
subjects, tense gaps, verbs, date formats — which `fieldMarkers.js` assembles, the way
`ADVERB_GAP` and `MEDICATION_UNITS` already worked. Not a flat synonym list.

The false-positive control is the split between **self-sufficient** verbs (*ended,
subsided, ceased*), which may bind a date on their own, and **ambiguous** ones
(*closed, corrected, completed, in remission*), which only bind a date behind a
reaction or patient subject. *"The case was closed on 3 August"* and *"the dose was
corrected on 3 August"* are not stop dates, and `test-reaction-dates.mjs` pins that.

Paired tightening, because widening acceptance without it would be reckless: a new
`reactionDate` validator requires the two reaction dates to have parsed to
`DD/MM/YYYY`. `processors.dateString` returns its input unchanged when nothing
parses and the old `dateString` validator accepted anything eight characters long, so
a broadened marker could otherwise have filed a sentence fragment as a date.

## Cause 3 — Urdu HTTP 422 · DIAGNOSED, was misdiagnosed first

**The original conclusion in this document was wrong.** It recorded "Pravah rejects
Urdu" on the basis of 14 of 20 samples returning HTTP 422. The evidence did not
support it:

- `shouldSendFrom()` returns `false`, so every request sent `{ text, to: 'en' }` with
  no `from`. Pravah was never told the text was Urdu, so a 422 could not be a
  rejection of `ur-IN`.
- The failing sample IDs **differed between runs on identical input** — 1,2,3,4,7,8…
  on one sweep and 1,2,4,5,6,9… on another.
- The 422 carries **no error body**, which is why the first investigation had nothing
  to work with. `translationClient.js` now surfaces the upstream message (with the
  API key scrubbed) instead of discarding it.

Non-deterministic on identical input means transient, not a property of the language.
`UNSUPPORTED_LANGUAGE` was added to the retryable set — a code the service genuinely
cannot handle is already rejected by `isPravahLanguage` before any request, so this
costs a real failure two extra attempts and rescues an intermittent one.

**Urdu went from 5/20 to 16/20 clean on the retry alone.**

## Cause 4 — denied symptoms in translated word order · FIXED

*"She has no chest pain"* was blocked by a lookahead on the symptoms marker.
Translation just as readily produces *"she does **not** have chest pain"*, which puts
the negation **before** the cue word — so the captured segment begins after it and
the denial is invisible to the value-level check. A denied symptom would have been
printed on the ADR form as a finding the patient does not have.

Fixed with a lookbehind on the same marker; `test-reaction-dates.mjs` D11 covers it.

---

## What is NOT a defect

**Transliterated names.** ରିୟା returns as "Rhea", not "Riya". The IPC ADR form prints
patient **initials** (`reportDocument.js` section A), not the full name, and the
initials survive. Translated text is graded on initials, with the full spelling
recorded as a note — see `scripts/lib/dictation-grade.mjs`.

**The Nepali voice region.** `languages.js` sends `lang: ne-IN` with the voice
`ne-NP-HemkalaNeural`. `npm run probe:tts` confirms the service accepts it and
returns real audio, so the mismatch is cosmetic.

## Genuine upstream loss, not fixable here

Some symptoms are simply absent from the translation. Measured on the captured
corpus, the most-lost words are *itching* (rendered as "itchy" or folded into
"rashes"), *nausea*, *dizziness* and *swelling*. No marker can extract a word the
translator never produced. `analyze-dictation-capture.mjs` separates this from our
own gaps — it reports "present in the English but not extracted" against "never
produced by the translator".

**Gender is corrupted by translation.** Pravah flips pronoun gender mid-paragraph:
*"Sneha Gupta. **She** is 29 years old… **He** developed facial swelling."* Where the
pronouns conflict, `inferGender` correctly returns nothing and the doctor is
prompted; where the translator is uniformly wrong, the wrong gender is extracted.
Inferring gender from the name is explicitly forbidden by
`test-extraction-natural.mjs` 3.8 and was not added.

## Corpus fix applied

32 of 42 date mentions in the Malayalam column omitted the year entirely
(`ഓഗസ്റ്റ് 9-ന്` — "August 9"), which made a correct `reactionStartDate` impossible
regardless of translation quality. Fixed in `scripts/generate-dictation-samples.mjs`
and regenerated; no other language was affected.

## How to re-measure

```bash
npm run analyze:dictation                        # re-grade the capture, offline
npm run analyze:dictation -- --field=keywords    # why a field fails, with examples
npm run probe:masking                            # which sentinel survives, live
npm run validate:dictation -- --dry-run
npm run validate:dictation -- --lang=ur --delay=300
npm run validate:dictation -- --capture          # full sweep, re-records the capture
npm run validate:dictation -- --raw              # numerals unmasked, for comparison
npm run probe:tts -- --only=en,hi,or,ta,te,ur    # voices, live
```

---

# Phase 2

## Cause 5 — extraction vocabulary for FINDINGS · FIXED

Of 116 missing reaction keywords, 55 were present in the English and simply not
extracted. `src/constants/symptomCues.js` mirrors `reactionCues.js` with composable
fragments for the shapes translation produces:

| Shape | Was |
|---|---|
| `There was nausea and vomiting.` | no existential cue at all |
| `They had headaches, dizziness` | the whitelist was singular-only — `headaches` failed `\b` |
| `They suffered headaches` | `suffer` required `from` |
| `He had facial swelling` | no adjective slot between verb and finding |
| `Fever and itching went away after the drug` | verb-final list, Indic word order |
| `The drug is followed by fever` | only `was followed by` |
| `began on 9 August 2026 with fever` | findings trailing a date |
| `The adverse reaction seen included fever` | participle between noun and verb |
| `They came down with severe itching` | no adverb slot before the preposition |
| `…60 kg Fever Cough Itching Rashes and Weakness…` | run-on speech, no cue at all |

The last one is handled by `symptomRun`, which fires only on **two or more adjacent
terms** from the existing `SYMPTOM_TERMS` vocabulary — a single stray word cannot
trigger it — and carries lookbehinds so it does not re-fire inside a list a real cue
already introduced.

**Extraction failures fell from 55 to 3.**

## Cause 6 — a year the translator dropped entirely · FIXED

The commonest remaining stop-date failure was *"began on 9 August 2026 and ended on
11 August"*: the clinician gave the year once, both years were masked, and only one
sentinel came back. `inferMissingYears` supplies it **from the protected source
entities** — inference from what was dictated, not invention. It declines when the
dictation spans two different years. `reactionStopDate` fell from 23 to 10.

## Cause 7 — a denial that is not adjacent to its finding · FIXED

`"She has fever. She denies nausea."` merges into one symptoms segment, and
`splitFindings` marked a part negative only when the part's **start offset** fell
inside the negated range. "She denies nausea" starts at "She", before the cue — so
the report printed a finding literally called **"Denies nausea"**. Now a part counts
as denied when the negation overlaps it anywhere. Found by an adversarial test, not
by the corpus.

## The symptom lexicon — delivered, and deliberately inert

`scripts/seed-symptom-lexicon.mjs` generates a per-language clinical vocabulary, and
`src/services/extraction/reconcileSource.js` uses it to reinstate a finding the
translation lost. Six drafts exist (`as, bn, hi, ml, or, ta`).

**None of it is live.** Every draft ships `reviewed: false`, `lexiconFor` returns
`null` for an unreviewed language, and recovery is therefore a no-op. This is
deliberate:

- Machine translation is not a reliable source for this data — the whole reason the
  lexicon is needed. "itching" → Odia returns `ଖଞ୍ଜିବା`; the corpus and recogniser use
  `କୁଣ୍ଡାଇ`. 0 of 11 samples matched. Hindi `खुजली` matched 11 of 11.
- An earlier version also mined the parallel corpus by n-gram intersection. It was
  removed after it offered a **patient's name** as the rendering for "breathing
  difficulty".
- Anything recovered is written at `CONFIDENCE.FALLBACK`, below
  `LOW_CONFIDENCE_THRESHOLD`, and marked `origin: 'source'`, so the UI flags it rather
  than presenting it as dictated fact.

Flipping `reviewed: true` for a language is a clinical sign-off, not an engineering
one. Until then the lexicon contributes **nothing** to the measured numbers, which is
why the phase-2 score is honest.

## Known deviation from the grounding invariant

`processors.reactionManagement` prepends the marker's `source` string, because the cue
*is* the content. A dictation saying "the drug was stopped" therefore prints
"Medication was stopped" — faithful in meaning, but `medication` was not dictated.
Recorded in `test-extraction-adversarial-multilingual.mjs` M13 as an explicit
allowance rather than left to be discovered.

---

# Phase 3 — acceptance, and the seven bugs it found

Phase 3 was meant to *verify* the TTS and drawer halves of the requirement. It found
seven real defects instead, three of them silent data loss, and **most of them were in
the drawer work Phase 1 had just delivered**. The passing suite did not cover the
states they lived in. That is the finding worth recording: a green suite measured
coverage of the paths I had thought of, not of the paths a doctor can reach.

## Result

| Path | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| English → extraction → ADR report | 20/20 | 20/20 | 20/20 | **20/20** |
| Non-English → fully correct ADR report | 0/246 | 158/260 | 178/260 | **179/255 (70.2%)** |
| Non-English → report the doctor can file | 0 | 196/260 | 225/260 | **240/255 (94.1%)** |
| Translation-level failures | 14 | 0 | 0 | **0** |
| Failures that are OUR bug | 55 | 55 | 3 | **0** |
| Date-field failures | 90 | 12 | 12 | **1** |
| Age-field failures | 20 | 4 | 4 | **2** |

The Phase 3 denominator is 255, not 260: the final live capture lost five Urdu rows to
Pravah 422s, which are non-deterministic (see below). The comparison in
`test-dictation-pipeline.mjs` is rate-based for exactly this reason.

The one remaining date failure is `kn/16`, and it is upstream: Pravah truncates the
Kannada sentence after the start date, so the stop date never arrives in the English.
The source numerals are `32 60 9 2026 11 2026`; the translation carries `32 60 9 2026`.

## The seven bugs

| # | Where | Severity | Defect |
|---|---|---|---|
| B-1 | `useRecordingStore.js` | high | `selectPreferredTranscript` gated on *status*, but `anuvadini.text` survives a status change. A failed second refinement reverted the drawer to native text while `transcriptSource` was still `ANUVADINI`: the drawer showed and saved native, the report read stale AI. |
| B-2 | two screens | medium | Three predicates claimed to answer "is the AI transcript live?" and disagreed in exactly the edge cases. The drawer and the full review showed different text for one session. |
| B-3 | `OverlayReviewScreen.jsx` | high | `showingAi` omitted the *differs-from-native* condition. When the AI text equalled the native text, an edit was written to the anuvadini slice while `transcriptSource` stayed `NATIVE` — the report read the other slice and **the doctor's edit was silently discarded** after "Changes saved" appeared. |
| B-4 | `OverlayReviewScreen.jsx` | high | The resync effects pushed store values into local state unconditionally. Typing while the AI pass was in flight, then having it land, **destroyed every keystroke**, with no prompt and no undo. |
| B-5 | `OverlayReviewScreen.jsx` | medium | `chosen` was component-local and hardcoded `false`. A doctor who deliberately chose "Original" in the full review had it flipped back to AI by the drawer. |
| A-1 | `useRecordingStore.js` | high impact | `restoreSession` clobbered `language` unconditionally. Every session row written before the `language` column was added by `ALTER TABLE` has NULL, so resuming one set `state.language = null` — after which translation was skipped, `speechLanguageFor(null)` returned English, and the prompt was **spoken in English to a doctor who had dictated in Odia**, with `spoken: true` and nothing surfaced. This is precisely the failure the acceptance criterion forbids, and it was reachable and silent. |
| A-2 | `dictationBubble.js` | medium | The bubble's Play never reset a finished session, so a consultation the doctor believed was over lent its stale language and transcript to the next one. |

### The root cause behind four of them

B-1, B-2, B-3 and most of B-5 were one defect wearing four costumes: three predicates
for one question. The fix is a single store-level selector, `selectLiveTranscript`,
that returns **both** the text and the slice it came from:

```js
selectLiveTranscript(state) -> { text, slice: 'anuvadini' | 'native', reason }
```

Display and write derive from the same value, so they cannot diverge. Both screens read
it. `selectPreferredTranscript` is now a thin wrapper over it.

### Making the silent case impossible

`speechLanguageFor` now returns `resolved: boolean`. English-because-unknown is a
different value from English-because-chosen, and `playPrompt` surfaces the former as a
visible `promptReason('language_unknown')` — *"the dictation language could not be
determined, so this was read out in English"*. The failure can still occur if the data
is genuinely absent; it can no longer occur **silently**, which was the actual defect.

`restoreSession` now merges rather than clobbers, mirroring the `COALESCE` the database
layer already used.

## Cause 8 — my own failure classifier reported my bugs as upstream · FIXED

`analyze-dictation-capture.mjs` labelled any empty date field `translationLoss` without
checking whether the date was present in the English. Six of our own extraction bugs
were reported to the user as unfixable upstream loss on that basis, and the "0
application bugs" line in the Phase 2 report was an artifact of a lenient classifier,
not a measurement. Every branch now tests presence before assigning a cause.

The corrected classifier is what produces the `0` in the table above.

## Cause 9 — Tamil "was perfect on 13 August" · FIXED

Six Tamil stop-date failures shared one clause shape: the translation rendered the
recovery as *"was perfect on 13 August"*. `STOP_STATE_ADJECTIVE` had `fine`, `better`,
`normal` and `stable`, but not `perfect` or `correct`. Added to `reactionCues.js`, where
it composes with every existing subject and tense-gap rather than being a seventh flat
synonym list.

## Cause 10 — the verb after the date · FIXED

`pa/16` and `ur/16` came back as run-ons with the verb trailing its date —
`Reaction 9 Aug 2026 Started`. A `dateThenVerb` shape covers it, guarded by a mandatory
real date so it cannot fire on prose.

## Cause 11 — an age with no preposition, and an age with no unit · FIXED

Two shapes of age went unread, and neither was a corpus artefact — both are ordinary
English that machine translation produces constantly.

- **The appositive.** `"Patient Rahul Sharma, 34 years, male"`. Every existing age
  marker needed a preposition or a hyphenated compound: `aged`, `is N years`,
  `N-year-old`, `N years of age`. A bare age between commas matched none of them. The
  new marker requires the comma before and either a comma or a gender word after,
  which is what separates it from a duration like *"for 3 years"*.
- **The missing unit.** `ta/19` says வயது 52 ஆண்டுகள் — "age 52 years" — and Pravah
  returns `"He is 52."` with the unit dropped. The new marker requires the subject to
  be the patient and the number to run to the end of its clause, so *"the reaction is
  3"* and every other loose number stay out.

Together these took age failures from 4 to 2. The two that remain are not extraction
failures at all: `mr/17` and `pa/17` come back as *"These are men in their 30s"* — the
translator converted an exact age into a decade band and pluralised the patient.
Reading `30 Years` out of that would be inventing a precision the text does not have.

## Cause 12 — a pronoun in a translation is not evidence of gender · FIXED

Ten corpus rows had the wrong gender, all on the same dictation, and the cause is
structural rather than a vocabulary gap.

Odia ସେ, Hindi वह, Gujarati તે and Urdu وہ do not mark gender. The translator has to
choose an English pronoun, and it chooses *he* — for a patient the dictation names
Sneha. The English that comes back carries no hedge at all: `"The patient's name is
Sneha Gupta. He is 29 years old…"`. Extraction, reading only that English, inferred
Male at `CONFIDENCE.STRONG` and filed it.

The four rows where the translation contradicts itself — `"She is 29 … He developed …"`
in `hi/6`, `gu/6`, `ml/6`, `pa/6` — were already safe: conflicting pronouns yield
nothing. The dangerous ones were the five where the translation is uniformly and
confidently wrong.

Extraction cannot tell a translation from a dictation by reading it, so the caller now
says: `extractForReport(text, { translated })`, sourced from
`selectExtractionOptions(state)`, which derives it from `selectReportSourceKind` rather
than guessing. When the text is a translation and gender rests on nothing but a
pronoun, the value is **kept** — dropping it would lose a required field for the
majority of cases where the translator guessed right — but its confidence falls to
`CONFIDENCE.PRONOUN` (0.45), below `LOW_CONFIDENCE_THRESHOLD`. That is the rule
`ReportField` uses to draw the **UNCERTAIN** badge, so the doctor is the one who
confirms it, with the field's `source` reading *"pronoun in a translation"*.

An explicitly stated gender is unaffected: it is evidence in its own right, and
translation does not weaken it, or every translated report would arrive covered in
warnings. `test-extraction-safety.mjs` S10.1–S10.12 pins all of this down.

**This does not improve the score.** The ten rows still count as failures, because the
expected value is Female and the value is still Male. It converts a silently wrong
field into a visibly uncertain one, which is the difference that matters on a form
that goes to a regulator.

## What the live acceptance run measures

`npm run verify:e2e` performs, per language, a real round trip: Anuvadini TTS →
real audio → Anuvadini STT → Pravah → extraction → completeness → the production
`speakMissingFields` call, **with the HTTP body captured**. The locale and voice in
`docs/tts-language-matrix.md` are the bytes that went to the provider, not values
re-derived from the code.

The point of the last step is the acceptance criterion: at the moment the prompt is
spoken, the report on screen is in English and the dictation was not. The request must
still name the dictated language.

**It does not exercise the microphone, the on-device recogniser, accents or background
noise**, because the audio is synthesised. `docs/device-acceptance-checklist.md` covers
those rows with twelve steps per language for a person holding a handset. Those rows
are not claimed as verified here.

## Two provider limitations, measured not assumed

- **Nepali STT.** Anuvadini TTS synthesises Nepali correctly, but sending that audio to
  Anuvadini STT returns HTTP 500 — five attempts out of five, repeatable across runs and
  across days. Nepali TTS works; Nepali STT does not. This is a provider limitation,
  not an application defect, and it is the one language where the AI transcription
  cannot be offered at all.
- **Urdu 422 is non-deterministic, and Urdu is supported.** Pravah returns 422 for
  byte-identical Urdu input intermittently — measured as fail / ok / fail across three
  consecutive attempts on the same string. `classifyStatus` maps 422 to
  `unsupported_language`, which reads like a permanent verdict but is not one. The
  production path already treats it as retryable (`transcriptTranslation.js` RETRYABLE,
  600 ms and 1800 ms backoff). The live verifier now mirrors that, because a harness
  that did not would report a language as unsupported that the app itself recovers.

## The lexicon, revisited

`docs/lexicon-readiness.md` reports what a native speaker would be signing off, measured
by running the real matcher against the real corpus with the lexicon marked reviewed
**in memory only**. The headline number is attestation: of roughly 40 native forms per
language, only 7 to 15 appear anywhere in that language's dictations. The rest were
written from a dictionary and have never matched real speech.

Every lexicon still ships `reviewed: false`, recovery is still inert, and
`test-source-reconciliation.mjs` R6.1 holds it that way. The flag was not flipped.
