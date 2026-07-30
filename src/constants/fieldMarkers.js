/**
 * Field marker vocabulary (SRS FR-5).
 *
 * Each field is a metadata object rather than a bare pattern list, so
 * post-processing, validation and conflict rules attach per field without the
 * pipeline needing to special-case anything.
 *
 * ── Adding support for new phrasing ─────────────────────────────────────────
 * Add a marker row here. No pipeline code should need to change.
 *
 * ── What `confidence` means ─────────────────────────────────────────────────
 * It is MARKER SPECIFICITY, not probability. Nothing here is calibrated, and
 * reading 0.95 as "95% likely correct" would be wrong. Fixed bands:
 *
 *   0.90 - 0.95   Explicit, unambiguous marker   "diagnosis is", "contact number"
 *   0.60 - 0.75   Hedged or ambiguous marker     "looks like", "probably"
 *   0.40 - 0.55   Unmarked structural fallback   bare 6-digit -> PIN
 *
 * Markers are matched longest-first at each position, so a specific phrase
 * ("patient name is") always beats a looser one ("name is").
 */

export const CONFIDENCE = {
  EXPLICIT: 0.95,
  STRONG: 0.9,
  MODERATE: 0.75,
  HEDGED: 0.65,
  WEAK: 0.6,
  FALLBACK: 0.5,
  WEAK_FALLBACK: 0.45,
};

/** Below this, the report flags the value as uncertain. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

const m = (pattern, confidence, source) => ({ pattern, confidence, source });

/**
 * Clinical conditions recognised without an explicit history marker, e.g.
 * "She is diabetic". Closed on purpose — a general rule would populate
 * medical history with any adjective following "is".
 */
export const CLINICAL_CONDITIONS =
  'diabetic|hypertensive|asthmatic|epileptic|hypothyroid|hyperthyroid|anaemic|anemic|obese|immunocompromised|arthritic|tubercular';

export const FIELD_MARKERS = {
  patientName: {
    priority: 10,
    postProcessor: 'name',
    validator: 'personName',
    markers: [
      m(/\bpatient(?:'s|s)?\s+name\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, "patient's name is"),
      m(/\bname\s+of\s+the\s+patient\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'name of the patient is'),
      m(/\b(?:her|his|the)\s+name\s+(?:is\s+)?/i, CONFIDENCE.STRONG, 'name is'),
      m(/\bname\s+is\s+/i, CONFIDENCE.STRONG, 'name is'),
      m(/\bthe\s+patient\s+is\s+/i, CONFIDENCE.MODERATE, 'the patient is'),
      m(/\bpatient\s+called\s+/i, CONFIDENCE.MODERATE, 'patient called'),
      m(/\bthis\s+is\s+(?:mr|mrs|ms|miss|master)\.?\s+/i, CONFIDENCE.STRONG, 'this is Mr/Mrs'),
      m(/\bthis\s+is\s+/i, CONFIDENCE.MODERATE, 'this is'),
      m(/\bpatient\s+identified\s+as\s+/i, CONFIDENCE.EXPLICIT, 'patient identified as'),
      m(/\bidentified\s+as\s+/i, CONFIDENCE.STRONG, 'identified as'),
      // Hinglish: "patient ka naam Hema Sharma hai"
      m(/\b(?:patient\s+)?ka\s+naam\s+/i, CONFIDENCE.EXPLICIT, 'ka naam'),
    ],
  },

  age: {
    priority: 9,
    postProcessor: 'age',
    validator: 'age',
    markers: [
      m(/\bage(?:d)?\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'age'),
      // "22-year-old" and "22 years old" — hyphens and the singular "year"
      // are both common and were previously unmatched.
      m(/\b(?=\d{1,3}[\s-]*(?:years?|yrs?)[\s-]*old\b)/i, CONFIDENCE.STRONG, 'N-year-old'),
      m(/\b(?=\d{1,3}[\s-]*(?:years?|yrs?)\s+of\s+age\b)/i, CONFIDENCE.STRONG, 'N years of age'),
      m(/\bis\s+(?=\d{1,3}[\s-]*(?:years?|yrs?)\b)/i, CONFIDENCE.STRONG, 'is N years'),
      // Spoken age with no "years": "she's only twenty-two".
      // Teens are deliberately excluded — "Sector Twelve" was being read as
      // age 12. A wrong value in a patient record is worse than a blank one.
      m(/\b(?=(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](?:one|two|three|four|five|six|seven|eight|nine)\b)/i, CONFIDENCE.HEDGED, 'spoken age'),
    ],
  },

  gender: {
    priority: 8,
    postProcessor: 'gender',
    validator: 'gender',
    markers: [
      m(/\b(?:gender|sex)\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'gender'),
    ],
    // Applied only to text no marker claimed.
    fallbacks: [
      m(/\b(male|female|transgender)\b/i, CONFIDENCE.FALLBACK, 'bare gender word'),
      m(/\b(woman|lady|girl)\b/i, CONFIDENCE.WEAK_FALLBACK, 'woman/lady'),
      m(/\b(man|gentleman|boy)\b/i, CONFIDENCE.WEAK_FALLBACK, 'man/gentleman'),
    ],
  },

  address: {
    priority: 6,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:residential\s+|postal\s+|home\s+)?address\s*(?:is\s*|:\s*)?/i, CONFIDENCE.EXPLICIT, 'address is'),
      m(/\b(?:resides?|residing|staying|stays)\s+(?:at|in)\s+/i, CONFIDENCE.STRONG, 'resides at'),
      m(/\blives?\s+(?:at|in)\s+/i, CONFIDENCE.STRONG, 'lives in'),
      m(/\bhails\s+from\s+/i, CONFIDENCE.MODERATE, 'hails from'),
    ],
  },

  pinCode: {
    priority: 7,
    postProcessor: 'pinCode',
    validator: 'pinCode',
    markers: [
      m(/\b(?:pin\s*code|pincode|postal\s*code|zip\s*code|zip)\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'pin code'),
    ],
    fallbacks: [m(/\b(\d{6})\b/, CONFIDENCE.WEAK_FALLBACK, 'bare 6-digit')],
  },

  contactNumber: {
    priority: 7,
    postProcessor: 'phone',
    validator: 'phone',
    markers: [
      m(/\b(?:contact|phone|mobile|cell)\s*(?:number|no\.?)?\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'contact number'),
      m(/\breachable\s+(?:at|on)\s+/i, CONFIDENCE.STRONG, 'reachable at'),
      m(/\bnumber\s+is\s+/i, CONFIDENCE.MODERATE, 'number is'),
    ],
    fallbacks: [m(/\b((?:\+91[\s-]?)?[6-9]\d{9})\b/, CONFIDENCE.FALLBACK, 'bare 10-digit')],
  },

  symptoms: {
    priority: 5,
    postProcessor: 'symptomList',
    validator: 'nonEmptyList',
    markers: [
      m(/\bcomplain(?:s|ing|ed)?\s+of\s+/i, CONFIDENCE.EXPLICIT, 'complains of'),
      m(/\bc\/o\s+/i, CONFIDENCE.EXPLICIT, 'c/o'),
      // "symptoms" must be followed by a copula. A bare match fires inside
      // "if symptoms persist" (a remark) and pollutes the field with "Persist".
      m(/\bsymptoms?\s+(?:are|is|include[s]?)\s+/i, CONFIDENCE.EXPLICIT, 'symptoms are'),
      m(/\bpresenting\s+complaints?\s+(?:are|include[s]?)?\s*/i, CONFIDENCE.EXPLICIT, 'presenting complaints'),
      m(/\bsuffering\s+from\s+/i, CONFIDENCE.STRONG, 'suffering from'),
      m(/\bpresent(?:s|ing|ed)?\s+with\s+/i, CONFIDENCE.STRONG, 'presents with'),
      m(/\breport(?:s|ing|ed)?\s+/i, CONFIDENCE.MODERATE, 'reports'),
      // Contraction-aware: "she's been having" as well as "has been having".
      m(/\b(?:has|have|'s|s)\s*been\s+having\s+/i, CONFIDENCE.MODERATE, 'been having'),
      m(/\bcomplaints?\s+(?:are|of)?\s*/i, CONFIDENCE.EXPLICIT, 'complaints of'),
      m(/\bcame\s+in\s+with\s+/i, CONFIDENCE.MODERATE, 'came in with'),
      m(/\b(?:has|have|had)\s+had\s+/i, CONFIDENCE.MODERATE, 'has had'),
      m(/\b(?:has|have|'s)\s*been\s+running\s+a\s+/i, CONFIDENCE.MODERATE, 'running a fever'),
    ],
  },

  medicalHistory: {
    priority: 5,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      // Negation first — "no significant medical history" is information the
      // doctor stated, clinically different from never mentioning it. Matched
      // ahead of the generic marker so the value keeps the "no".
      m(/\b(?=(?:has\s+)?no\s+(?:significant\s+)?(?:medical\s+|past\s+)?history)/i, CONFIDENCE.EXPLICIT, 'no significant history'),
      m(/\bpast\s+medical\s+history\s+significant\s+for\s+/i, CONFIDENCE.EXPLICIT, 'past medical history significant for'),
      m(/\b(?:medical|past)\s+history\s+(?:of|is|includes?|significant\s+for)?\s*/i, CONFIDENCE.EXPLICIT, 'medical history of'),
      m(/\bh\/o\s+/i, CONFIDENCE.EXPLICIT, 'h/o'),
      m(/\bhistory\s+(?:of|is|includes?)?\s*/i, CONFIDENCE.STRONG, 'history of'),
      m(/\bknown\s+case\s+of\s+/i, CONFIDENCE.STRONG, 'known case of'),
      m(/\b(?=known\s+(?:diabetic|hypertensive|asthmatic|epileptic))/i, CONFIDENCE.MODERATE, 'known diabetic'),
      m(/\bcomorbid(?:ities)?\s+(?:are|include[s]?)?\s*/i, CONFIDENCE.MODERATE, 'comorbidities'),
      // Bare clinical conditions: "She is diabetic", "known diabetic on
      // regular medication". A CLOSED list, deliberately — a general
      // "adjective after is" rule would fill this field with noise.
      m(
        new RegExp(
          `\\b(?:is|a)?\\s*(?=(?:known\\s+)?(?:${CLINICAL_CONDITIONS})\\b)`,
          'i',
        ),
        CONFIDENCE.MODERATE,
        'bare condition',
      ),
    ],
  },

  diagnosis: {
    priority: 8,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:provisional\s+|final\s+)?diagnosis\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'diagnosis is'),
      m(/\bdiagnosed\s+(?:with|as)\s+/i, CONFIDENCE.EXPLICIT, 'diagnosed with'),
      m(/\b(?:clinical\s+)?impression\s+(?:is\s+|suggests\s+)?/i, CONFIDENCE.EXPLICIT, 'impression'),
      m(/\bappears\s+to\s+be\s+/i, CONFIDENCE.HEDGED, 'appears to be'),
      m(/\b(?:looks|seems|sounds)\s+like\s+/i, CONFIDENCE.HEDGED, 'looks like'),
      m(/\bi\s+think\s+this\s+is\s+/i, CONFIDENCE.HEDGED, 'I think this is'),
      // Reversed phrasing: "Viral fever appears likely."
      m(/\b(?=[\w\s-]{3,40}?\s+appears\s+likely\b)/i, CONFIDENCE.HEDGED, 'appears likely'),
      m(/\b(?:probably|most\s+likely|likely)\s+/i, CONFIDENCE.WEAK, 'probably'),
      // Hinglish: "diagnosis viral infection lag raha hai"
      m(/\bdiagnosis\s+(?=[\w\s]+lag\s+raha\s+hai)/i, CONFIDENCE.EXPLICIT, 'lag raha hai'),
    ],
  },

  prescriptionNotes: {
    priority: 4,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\bprescri(?:bed|bing|be|ption)\s+(?:is|with)?\s*/i, CONFIDENCE.EXPLICIT, 'prescribed'),
      m(/\brx\s+/i, CONFIDENCE.EXPLICIT, 'Rx'),
      m(/\bmedication\s+prescribed\s+includes?\s+/i, CONFIDENCE.EXPLICIT, 'medication prescribed includes'),
      m(/\bmedications?\s+(?:are|is)?\s*/i, CONFIDENCE.STRONG, 'medication'),
      m(/\b(?:put|putting|start(?:ed|ing)?)\s+(?:her|him|them|the\s+patient)\s*on\s+/i, CONFIDENCE.STRONG, 'started on'),
      // Bare imperative openings — "Start Cefixime 200 mg", "Give her
      // Paracetamol". Require a capitalised or dosage-like token so this
      // cannot swallow "start to feel better".
      // Anchored on a dosage so it cannot swallow "start to feel better".
      m(/\b(?:start|give|administer|prescribe)\s+(?:her|him|them\s+)?(?=[\w-]+\s+\d+\s*(?:mg|ml|mcg|g)\b)/i, CONFIDENCE.STRONG, 'start <drug> <dose>'),
      // "Give her Paracetamol twice daily" — no dosage, but the pronoun makes
      // the intent unambiguous.
      m(/\bgive\s+(?:her|him|them)\s+/i, CONFIDENCE.STRONG, 'give her'),
      m(/\btreatment\s+(?:is\s+)?/i, CONFIDENCE.MODERATE, 'treatment'),
      m(/\bi'?ll\s+prescribe\s+/i, CONFIDENCE.EXPLICIT, "I'll prescribe"),
      // "advised" is genuinely ambiguous — "advised paracetamol" is a
      // prescription, "advised blood tests" is a remark. Kept weak so
      // suppressWeakInsideStrong keeps it out of a marked remarks value.
      m(/\badvis(?:ed|e|ing)\s+/i, CONFIDENCE.WEAK, 'advised'),
    ],
  },

  additionalRemarks: {
    priority: 3,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:additional\s+)?remarks?\s*(?:are|is|:)?\s*/i, CONFIDENCE.EXPLICIT, 'remarks'),
      m(/\bobservations?\s*(?:are|is)?\s*/i, CONFIDENCE.STRONG, 'observation'),
      m(/\bnotes?\s*(?:are|is|:)?\s*/i, CONFIDENCE.MODERATE, 'note'),
      m(/\badvice\s*:\s*/i, CONFIDENCE.EXPLICIT, 'advice:'),
      m(/\btell\s+(?:her|him|them)\s+to\s+/i, CONFIDENCE.STRONG, 'tell her to'),
      m(/\b(?:she|he|they|patient)\s+should\s+/i, CONFIDENCE.MODERATE, 'she should'),
      m(/\bask\s+(?:her|him|them)\s+to\s+/i, CONFIDENCE.STRONG, 'ask her to'),
      m(/\bfollow[\s-]*up\s+/i, CONFIDENCE.MODERATE, 'follow up'),
      m(/\breview\s+after\s+/i, CONFIDENCE.MODERATE, 'review after'),
    ],
  },
};

/** Filler words removed before matching so they never pollute a value. */
export const FILLER_PATTERN =
  /\b(?:um+|uh+|er+|ah+|hmm+|okay|ok|so|well|actually|basically|you\s+know|i\s+mean|like\s+i\s+said|let\s+me\s+see|right)\b/gi;

/** Leading connectives trimmed from the front of a captured value. */
export const LEADING_TRIM_PATTERN =
  /^(?:most\s+likely|probably|possibly|likely|is|are|was|were|has|have|had|of|the|a|an|with|for|to|her|his|their|and|that|it|she|he)\b[\s,]*/i;
