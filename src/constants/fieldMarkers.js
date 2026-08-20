import { ADVERB_GAP, MEDICATION_UNITS } from './clinicalCues.js';

export const CONFIDENCE = {
  EXPLICIT: 0.95,
  STRONG: 0.9,
  MODERATE: 0.75,
  HEDGED: 0.65,
  WEAK: 0.6,
  FALLBACK: 0.5,
  WEAK_FALLBACK: 0.45,
  PRONOUN: 0.45,
};

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const ABSENCE_MARKER_SOURCES = new Set([
  'no significant history',
  'nothing significant in the history',
  'no known condition',
  'no medication',
  'advice only',
]);

export const HISTORY_QUALIFIER = 'significant|known|previous|prior|past';

export const CONDITION_NOUN =
  'disease|disorder|illness|condition|ailment|surgery|surgeries|operation|procedure|complication';

const m = (pattern, confidence, source) => ({ pattern, confidence, source });

export const CLINICAL_CONDITIONS =
  'diabetic|hypertensive|asthmatic|epileptic|hypothyroid|hyperthyroid|anaemic|anemic|obese|immunocompromised|arthritic|tubercular';

export const FIELD_MARKERS = {
  caseType: {
    priority: 10,
    postProcessor: 'caseType',
    validator: 'caseType',
    markers: [
      m(/\b(?:this\s+is\s+(?:an?\s+)?)?initial\s+(?:case|report|adr\s+report)\b/i, CONFIDENCE.EXPLICIT, 'initial case'),
      m(/\b(?:first|first-time|new|primary|index|baseline|fresh)\s+(?:report|adr\s+report|case|time)\b/i, CONFIDENCE.STRONG, 'first report'),
      m(/\bfirst\s+time\b/i, CONFIDENCE.STRONG, 'first time'),
      m(/\b(?:newly\s+reported|freshly\s+reported)\s+(?:case|adr|report)\b/i, CONFIDENCE.STRONG, 'fresh report'),
      m(/\b(?:this\s+is\s+a\s+)?follow[- ]up\s+(?:case|report|adr\s+report)\b/i, CONFIDENCE.EXPLICIT, 'follow-up case'),
      m(/\bpatient\s+is\s+here\s+for\s+(?:a\s+)?follow[- ]up\b/i, CONFIDENCE.STRONG, 'follow-up patient'),
      m(/\b(?:subsequent|review|repeat|secondary|re-evaluation|progress)\s+(?:report|case|adr\s+report)\b/i, CONFIDENCE.STRONG, 'review report'),
      m(/\binitial(?:\s+case)?\b/i, CONFIDENCE.EXPLICIT, 'initial case'),
      m(/\bfollow[\s-]*up(?:\s+case)?\b/i, CONFIDENCE.EXPLICIT, 'follow-up case'),
    ],
  },
  patientName: {
    priority: 10,
    postProcessor: 'name',
    validator: 'personName',
    markers: [
      m(/\bpatient(?:'s|s)?\s+initials?\s+(?:are|is)?\s*/i, CONFIDENCE.EXPLICIT, "patient's initials are"),
      m(/\binitials\s+(?:are|is)\s*/i, CONFIDENCE.EXPLICIT, 'initials are'),
      m(/\bpatient(?:'s|s)?\s+name\s+(?:is[\s,]+)?/i, CONFIDENCE.EXPLICIT, "patient's name is"),
      m(/\bname\s+of\s+the\s+patient\s+(?:is[\s,]+)?/i, CONFIDENCE.EXPLICIT, 'name of the patient is'),
      m(
        /\b(?:her|his|the)\s+name\s+(?!of\s+the\s+patient)(?:is[\s,]+)?/i,
        CONFIDENCE.STRONG,
        'name is',
      ),
      m(/\bname\s+is[\s,]+/i, CONFIDENCE.STRONG, 'name is'),
      m(/\bthe\s+patient\s+is[\s,]+/i, CONFIDENCE.MODERATE, 'the patient is'),
      m(/\bpatient\s+is[\s,]+/i, CONFIDENCE.MODERATE, 'patient is'),
      m(/\bpatient\s+named[\s,]+/i, CONFIDENCE.EXPLICIT, 'patient named'),
      m(/\bpatient\s+called[\s,]+/i, CONFIDENCE.MODERATE, 'patient called'),
      m(/\bthis\s+is\s+(?:mr|mrs|ms|miss|master)\.?[\s,]+/i, CONFIDENCE.STRONG, 'this is Mr/Mrs'),
      m(/\bthis\s+is[\s,]+/i, CONFIDENCE.MODERATE, 'this is'),
      m(/\bpatient\s+identified\s+as[\s,]+/i, CONFIDENCE.EXPLICIT, 'patient identified as'),
      m(/\b(?:registered|recorded)\s+as[\s,]+/i, CONFIDENCE.STRONG, 'registered as'),
      m(/\bpatient(?:'s)?\s+identity\s+(?:is|recorded\s+as)[\s,]+/i, CONFIDENCE.EXPLICIT, 'patient identity'),
      m(/\bidentified\s+as[\s,]+/i, CONFIDENCE.STRONG, 'identified as'),
      m(/\b(?:patient\s+)?ka\s+naam[\s,]+/i, CONFIDENCE.EXPLICIT, 'ka naam'),
    ],
  },

  age: {
    priority: 9,
    postProcessor: 'age',
    validator: 'age',
    markers: [
      m(/\bage(?:d)?\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'age'),
      m(/\b(?=\d{1,3}[\s-]*(?:years?|yrs?)[\s-]*old\b)/i, CONFIDENCE.STRONG, 'N-year-old'),
      m(/\b(?=\d{1,3}[\s-]*(?:years?|yrs?)\s+of\s+age\b)/i, CONFIDENCE.STRONG, 'N years of age'),
      m(/\bis\s+(?=\d{1,3}[\s-]*(?:years?|yrs?)\b)/i, CONFIDENCE.STRONG, 'is N years'),
      m(/\b(?:age\s+recorded\s+as|current\s+age\s+is)\s+/i, CONFIDENCE.EXPLICIT, 'current age is'),
      m(/\b(?=(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](?:one|two|three|four|five|six|seven|eight|nine)\b)/i, CONFIDENCE.HEDGED, 'spoken age'),
    ],
  },

  gender: {
    priority: 8,
    postProcessor: 'gender',
    validator: 'gender',
    markers: [
      m(/\b(?:gender|sex|biological\s+sex|gender\s+identity)\s+(?:is|recorded\s+as)?\s*/i, CONFIDENCE.EXPLICIT, 'gender'),
      m(/\btransgender(?:\s+(?:individual|patient|person))?\b/i, CONFIDENCE.EXPLICIT, 'transgender'),
    ],
  },

  dateOfBirth: {
    priority: 9,
    postProcessor: 'dateString',
    validator: 'dateString',
    markers: [
      m(/\b(?:date\s+of\s+birth|dob|birth\s*date|birthdate)\s+(?:is|recorded\s+as)?\s*/i, CONFIDENCE.EXPLICIT, 'date of birth'),
      m(/\bborn\s+on\s+/i, CONFIDENCE.EXPLICIT, 'born on'),
      m(/\bborn\s+(?=\d{1,2}(?:st|nd|rd|th)?[\s/-])/i, CONFIDENCE.STRONG, 'born date'),
      m(/\bpatient\s+was\s+born\s+on\s+/i, CONFIDENCE.EXPLICIT, 'patient was born on'),
    ],
  },

  weight: {
    priority: 8,
    postProcessor: 'weight',
    validator: 'weightNumber',
    markers: [
      m(/\b(?:weight|wt\.?|body\s+weight|measured\s+weight|recorded\s+weight)\s+(?:is|measures)?\s*/i, CONFIDENCE.EXPLICIT, 'weight is'),
      m(/\bpatient\s+weighs\s+/i, CONFIDENCE.EXPLICIT, 'patient weighs'),
      m(/\b(?:weighs|weighing)\s+(?:about\s+)?/i, CONFIDENCE.EXPLICIT, 'weighing'),
      m(/\bwith\s+a\s+weight\s+of\s+/i, CONFIDENCE.EXPLICIT, 'with a weight of'),
      m(/\baround\s+(?=\d{2,3}\s*(?:kg|kilograms|kilos|kg\.?)\b)/i, CONFIDENCE.STRONG, 'around N kg'),
      m(/\bweight\s+is\s+around\s+/i, CONFIDENCE.STRONG, 'weight is around'),
    ],
  },

  reactionManagement: {
    priority: 8,
    postProcessor: 'reactionManagement',
    validator: 'nonEmptyText',
    combine: 'sentences',
    markers: [
      m(/\btreatment\s+was\s+given\b/i, CONFIDENCE.EXPLICIT, 'treatment was given'),
      m(/\bsymptoms?\s+(?:improved|subsided|resolved|settled)\b/i, CONFIDENCE.STRONG, 'symptoms improved'),
      m(/\btreatment\s+(?:was\s+)?given\s+and\s+(?:the\s+)?symptoms?\s+(?:improved|settled|subsided)\b/i, CONFIDENCE.EXPLICIT, 'treatment given and symptoms improved'),
      m(/\b(?:suspected\s+)?(?:medication|drug|medicine)\s+was\s+(?:stopped|withdrawn|discontinued|de-challenged|halted)\b/i, CONFIDENCE.EXPLICIT, 'medication was stopped'),
      m(/\b(?:suspected\s+)?(?:medication|drug|medicine)\s+(?:discontinued|stopped|withdrawn|dechallenged)\b/i, CONFIDENCE.EXPLICIT, 'medication discontinued'),
      m(/\b(?:de-?challenge\s+positive|positive\s+de-?challenge)\b/i, CONFIDENCE.STRONG, 'dechallenge positive'),
      m(/\btreated\s+with\b/i, CONFIDENCE.STRONG, 'treated with'),
      m(/\badministered\b/i, CONFIDENCE.STRONG, 'administered'),
      m(/\bgiven\s+(?:iv\s+|supportive\s+)?(?:fluids|treatment|care|medication|therapy)\b/i, CONFIDENCE.STRONG, 'given treatment'),
      m(/\bkept\s+under\s+observation\b/i, CONFIDENCE.STRONG, 'kept under observation'),
      m(/\b(?:admitted|retained)\s+for\s+observation\b/i, CONFIDENCE.STRONG, 'admitted for observation'),
      m(/\bmonitored\s+until\s+(?:improved|recovery)\b/i, CONFIDENCE.STRONG, 'monitored until improved'),
      m(/\bsymptoms?\s+improved\s+after\s+treatment\b/i, CONFIDENCE.STRONG, 'symptoms improved'),
      m(/\btreated\s+(?:symptomatically|conservatively)\b/i, CONFIDENCE.STRONG, 'treated symptomatically'),
      m(/\b(?:symptomatic\s+relief|supportive\s+care)\s+(?:was\s+)?provided\b/i, CONFIDENCE.STRONG, 'supportive care provided'),
      m(/\bmanaged\s+with\s+/i, CONFIDENCE.STRONG, 'managed with'),
    ],
  },

  reactionStartDate: {
    priority: 8,
    postProcessor: 'dateString',
    validator: 'dateString',
    markers: [
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+start\s+date\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'reaction start date'),
      m(/\b(?:event|reaction|adverse\s+event|adverse\s+reaction|symptoms?)\s+(?:had\s+)?commenced\s+(?:on\s+)?/i, CONFIDENCE.EXPLICIT, 'reaction commenced on'),
      m(/\b(?:event|reaction|adverse\s+event|adverse\s+reaction|symptoms?)\s+(?:had\s+)?start(?:ed|ing)?\s+(?:on\s+)?/i, CONFIDENCE.EXPLICIT, 'reaction started on'),
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+began\s+(?:on\s+)?/i, CONFIDENCE.STRONG, 'reaction began on'),
      m(/\b(?:reaction|event|adverse\s+event|adverse\s+reaction)\s+(?:triggered|originated|manifested|first\s+noticed)\s+(?:on\s+)?/i, CONFIDENCE.STRONG, 'reaction triggered on'),
      m(/\bcommenced\s+on\s+/i, CONFIDENCE.STRONG, 'commenced on'),
      m(/\bhad\s+started\s+on\s+/i, CONFIDENCE.STRONG, 'had started on'),
      m(/\bstarted\s+on\s+(?=\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b)/i, CONFIDENCE.STRONG, 'started on date'),
      m(/\breaction\s+date\s+is\s+/i, CONFIDENCE.STRONG, 'reaction date is'),
      m(/\b(?:reaction\s+)?onset\s+(?:of\s+(?:the\s+)?(?:symptoms|reaction|event|adverse\s+reaction)\s+)?(?:date\s+)?(?:was|is)\s+/i, CONFIDENCE.EXPLICIT, 'onset of reaction'),
      m(/\bonset\s+date\s+(?:was|is)\s+/i, CONFIDENCE.EXPLICIT, 'onset date'),
    ],
  },

  reactionStopDate: {
    priority: 8,
    postProcessor: 'dateString',
    validator: 'dateString',
    markers: [
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+stop\s+date\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'reaction stop date'),
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+stopped\s+(?:on\s+)?/i, CONFIDENCE.EXPLICIT, 'reaction stopped on'),
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+ended\s+(?:on\s+)?/i, CONFIDENCE.STRONG, 'reaction ended on'),
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+resolved\s+(?:on\s+)?/i, CONFIDENCE.STRONG, 'reaction resolved on'),
      m(/\b(?:event|reaction|adverse\s+reaction|adverse\s+event|symptoms?)\s+(?:settled|subsided|abated|disappeared|cleared)\s+(?:by|on)\s+/i, CONFIDENCE.STRONG, 'reaction settled by'),
      m(/\bby\s+(?=\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b)/i, CONFIDENCE.STRONG, 'by date'),
      m(/\b(?:resolved|ended|stopped|settled|subsided|abated|cleared)\s+(?:on\s+)?(?=\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b)/i, CONFIDENCE.STRONG, 'resolved date'),
      m(/\b(?:subsided|settled|abated|cleared)\s+(?:on|by)\s+/i, CONFIDENCE.STRONG, 'subsided on'),
      m(/\b(?:reaction\s+)?(?:cessation|resolution|outcome)\s+date\s+(?:was|is)\s+/i, CONFIDENCE.STRONG, 'cessation date'),
      m(/\b(?:resolved|ended|stopped)\s+on\s+/i, CONFIDENCE.STRONG, 'resolved on'),
    ],
  },

  address: {
    priority: 6,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:residential\s+|postal\s+|home\s+)?address\s*(?:is\s*|:\s*)?/i, CONFIDENCE.EXPLICIT, 'address is'),
      m(/\b(?:resides?|residing|staying|stays)\s+(?:at|in)\s+/i, CONFIDENCE.STRONG, 'resides at'),
      m(/\bliv(?:es?|ing)\s+(?:at|in)\s+/i, CONFIDENCE.STRONG, 'lives in'),
      m(/\b(?:hails\s+from|native\s+of)\s+/i, CONFIDENCE.MODERATE, 'hails from'),
      m(/\blocated\s+(?:at|in)\s+/i, CONFIDENCE.STRONG, 'located at'),
    ],
  },

  pinCode: {
    priority: 7,
    postProcessor: 'pinCode',
    validator: 'pinCode',
    markers: [
      m(/\b(?:pin\s*code|pincode|postal\s*code|postal\s*pin|zip\s*code|zip)\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'pin code'),
    ],
    fallbacks: [m(/\b(\d{6})\b/, CONFIDENCE.WEAK_FALLBACK, 'bare 6-digit')],
  },

  contactNumber: {
    priority: 7,
    postProcessor: 'phone',
    validator: 'phone',
    markers: [
      m(/\b(?:contact|phone|mobile|cell|telephone)\s*(?:number|no\.?|info)?\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'contact number'),
      m(/\b(?:can\s+be\s+)?reach(?:able|ed|es)?\s+(?:at|on)\s+/i, CONFIDENCE.STRONG, 'reachable at'),
      m(/\bnumber\s+is\s+/i, CONFIDENCE.MODERATE, 'number is'),
    ],
    fallbacks: [m(/\b((?:\+91[\s-]?)?[6-9]\d{9})\b/, CONFIDENCE.FALLBACK, 'bare 10-digit')],
  },

  symptoms: {
    priority: 5,
    postProcessor: 'symptomList',
    validator: 'nonEmptyList',
    markers: [
      m(
        new RegExp(`\\bcomplain(?:s|ing|ed)?${ADVERB_GAP}\\s+of\\s+`, 'i'),
        CONFIDENCE.EXPLICIT,
        'complains of',
      ),
      m(/\bc\/o\s+/i, CONFIDENCE.EXPLICIT, 'c/o'),
      m(/\bsymptoms?\s+(?:are|is|include[s]?)\s+/i, CONFIDENCE.EXPLICIT, 'symptoms are'),
      m(/\b(?:suspected\s+)?reaction\s+(?:is|was|includes?)\s+/i, CONFIDENCE.EXPLICIT, 'reaction is'),
      m(/\bpresenting\s+(?:complaints?|symptoms?)\s+(?:are|include[s]?)?\s*/i, CONFIDENCE.EXPLICIT, 'presenting complaints'),
      m(/\badverse\s+(?:reaction|event)\s+(?:includes?|presented\s+as|manifested\s+as|is|was)\s*/i, CONFIDENCE.EXPLICIT, 'adverse reaction includes'),
      m(
        new RegExp(`\\bsuffering${ADVERB_GAP}\\s+from\\s+`, 'i'),
        CONFIDENCE.STRONG,
        'suffering from',
      ),
      m(
        new RegExp(`\\bpresent(?:s|ing|ed)?${ADVERB_GAP}\\s+with\\s+`, 'i'),
        CONFIDENCE.STRONG,
        'presents with',
      ),
      m(/\breport(?:s|ing|ed)?\s+/i, CONFIDENCE.MODERATE, 'reports'),
      m(/\b(?:has|have|'s|s)\s*been\s+having\s+/i, CONFIDENCE.MODERATE, 'been having'),
      m(/\bcomplaints?\s+(?:are|of)?\s*/i, CONFIDENCE.EXPLICIT, 'complaints of'),
      m(
        new RegExp(`\\bcame${ADVERB_GAP}\\s+(?:in${ADVERB_GAP}\\s+)?with\\s+`, 'i'),
        CONFIDENCE.MODERATE,
        'came with',
      ),
      m(/\bexperienc(?:es|ing|ed)\s+/i, CONFIDENCE.STRONG, 'experiencing'),
      m(/\bpresenting\s+complaint\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'presenting complaint'),
      m(/\b(?:has|have|had)\s+had\s+/i, CONFIDENCE.MODERATE, 'has had'),
      m(/\b(?:patient\s+)?(?:has|have)\s+(?!had\b|been\b|no\b)(?:got\s+)?/i, CONFIDENCE.WEAK, 'has'),
      m(/\b(?:she|he|they|patient)?\s*had\s+(?=(?:fever|vomiting|itching|rash|edema|nausea|cough|pain|swelling|hives|headache|dizziness|urticaria|dyspnea)\b)/i, CONFIDENCE.STRONG, 'had'),
      m(/\b(?:is|are|was|were)\s+having\s+/i, CONFIDENCE.STRONG, 'is having'),
      m(/\bhaving\s+/i, CONFIDENCE.MODERATE, 'having'),
      m(/\bdealing\s+with\s+/i, CONFIDENCE.STRONG, 'dealing with'),
      m(/\btroubled\s+(?:by|with)\s+/i, CONFIDENCE.STRONG, 'troubled by'),
      m(/\bbothered\s+(?:by|with)\s+/i, CONFIDENCE.STRONG, 'bothered by'),
      m(/\b(?:is|was)\s+down\s+with\s+/i, CONFIDENCE.STRONG, 'down with'),
      m(/\b(?=denies\s+)/i, CONFIDENCE.STRONG, 'denies'),
      m(/\bdevelop(?:s|ed|ing)\s+/i, CONFIDENCE.STRONG, 'developed'),
      m(/\bnow\s+has\s+/i, CONFIDENCE.STRONG, 'now has'),
      m(/\b(?:has|have|'s)\s*been\s+running\s+a\s+/i, CONFIDENCE.MODERATE, 'running a fever'),
      m(/\b(?:manifested|developed\s+signs\s+of|developed\s+symptoms\s+of)\s+/i, CONFIDENCE.STRONG, 'manifested signs'),
    ],
  },

  medicalHistory: {
    priority: 5,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    combine: 'sentences',
    markers: [
      m(
        /\b(?=(?:has\s+)?no\s+(?:significant\s+|known\s+|previous\s+|prior\s+|past\s+|other\s+)*(?:(?:medical\s+|surgical\s+)?history|(?:medical\s+)?conditions?))/i,
        CONFIDENCE.EXPLICIT,
        'no significant history',
      ),
      m(
        /\b(?=nothing\s+significant\s+in\s+(?:the\s+)?(?:past\s+|medical\s+)*history)/i,
        CONFIDENCE.EXPLICIT,
        'nothing significant in the history',
      ),
      m(
        new RegExp(
          `\\b(?=(?:has\\s+)?no\\s+(?:${HISTORY_QUALIFIER})\\s+(?:\\w+\\s+){0,3}?(?:${CONDITION_NOUN})s?\\b)`,
          'i',
        ),
        CONFIDENCE.EXPLICIT,
        'no known condition',
      ),
      m(/\b(?:past\s+medical\s+history|pre-existing\s+history|past\s+clinical\s+history)\s+(?:significant\s+for|of|includes?)?\s*/i, CONFIDENCE.EXPLICIT, 'past medical history significant for'),
      m(/\b(?:medical|past)\s+history\s+(?:of|is|includes?|significant\s+for)?\s*/i, CONFIDENCE.EXPLICIT, 'medical history of'),
      m(/\bh\/o\s+/i, CONFIDENCE.EXPLICIT, 'h/o'),
      m(/\b(?:history|known\s+history)\s+(?:of|is|includes?)?\s*/i, CONFIDENCE.STRONG, 'history of'),
      m(/\bknown\s+case\s+of\s+/i, CONFIDENCE.STRONG, 'known case of'),
      m(/\bbackground\s+of\s+/i, CONFIDENCE.STRONG, 'background of'),
      m(/\bpreviously\s+treated\s+for\s+/i, CONFIDENCE.STRONG, 'previously treated for'),
      m(/\bknown\s+to\s+have\s+/i, CONFIDENCE.STRONG, 'known to have'),
      m(/\bcarries\s+a\s+diagnosis\s+of\s+/i, CONFIDENCE.STRONG, 'carries a diagnosis of'),
      m(/\bpreviously\s+diagnosed\s+with\s+/i, CONFIDENCE.EXPLICIT, 'previously diagnosed with'),
      m(/\bsuffers\s+from\s+/i, CONFIDENCE.MODERATE, 'suffers from'),
      m(/\b(?=known\s+(?:diabetic|hypertensive|asthmatic|epileptic))/i, CONFIDENCE.MODERATE, 'known diabetic'),
      m(/\b(?:comorbidities|underlying\s+conditions)\s+(?:are|include[s]?)?\s*/i, CONFIDENCE.MODERATE, 'comorbidities'),
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
    postProcessor: 'diagnosis',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:provisional\s+|final\s+|working\s+|differential\s+)?diagnosis\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'diagnosis is'),
      m(/\bdiagnosed\s+(?:with|as)\s+/i, CONFIDENCE.EXPLICIT, 'diagnosed with'),
      m(/\b(?:clinical\s+)?impression\s+(?:is\s+|suggests\s+)?/i, CONFIDENCE.EXPLICIT, 'impression'),
      m(/\bappears\s+to\s+be\s+/i, CONFIDENCE.HEDGED, 'appears to be'),
      m(/\bseems\s+to\s+be\s+/i, CONFIDENCE.HEDGED, 'seems to be'),
      m(/\b(?:looks|seems|sounds)\s+like\s+/i, CONFIDENCE.HEDGED, 'looks like'),
      m(/\bi\s+think\s+this\s+is\s+/i, CONFIDENCE.HEDGED, 'I think this is'),
      m(/\b(?=[\w\s-]{3,40}?\s+appears\s+likely\b)/i, CONFIDENCE.HEDGED, 'appears likely'),
      m(/\b(?:probably|most\s+likely|likely)\s+/i, CONFIDENCE.WEAK, 'probably'),
      m(/\b(?:findings?\s+(?:are|is)\s+)?suggestive\s+of\s+/i, CONFIDENCE.STRONG, 'suggestive of'),
      m(/\b(?:presentation\s+(?:is\s+)?)?consistent\s+with\s+/i, CONFIDENCE.STRONG, 'consistent with'),
      m(/\b(?:evaluating\s+for|suspected\s+case\s+of)\s+/i, CONFIDENCE.HEDGED, 'evaluating for'),
      m(/\bsuspected\s+/i, CONFIDENCE.HEDGED, 'suspected'),
      m(/\bworking\s+diagnosis\s+(?:is\s+)?/i, CONFIDENCE.EXPLICIT, 'working diagnosis'),
      m(/\bdiagnosis\s+(?=[\w\s]+lag\s+raha\s+hai)/i, CONFIDENCE.EXPLICIT, 'lag raha hai'),
    ],
  },

  prescriptionNotes: {
    priority: 4,
    postProcessor: 'medicationList',
    validator: 'nonEmptyList',
    fallbacks: [
      m(
        new RegExp(
          `\\b[A-Za-z][A-Za-z-]{2,}\\s+\\d+(?:\\.\\d+)?\\s*(?:${MEDICATION_UNITS})\\b[^.;]*`,
          'i',
        ),
        CONFIDENCE.FALLBACK,
        'bare drug and dose',
      ),
    ],
    markers: [
      m(
        /\b(?=no\s+(?:medications?|medicines?|meds|drugs?|prescriptions?)\b)/i,
        CONFIDENCE.EXPLICIT,
        'no medication',
      ),
      m(/\b(?=advice\s+only\b)/i, CONFIDENCE.EXPLICIT, 'advice only'),
      m(/\b(?:prescription\s+notes?|pharmacotherapy|medication\s+regimen)\s*(?:include[s]?|are|is|:)?\s*/i, CONFIDENCE.EXPLICIT, 'prescription notes'),
      m(/\bprescri(?:bed|bing|be|ption)\s+(?:is|with)?\s*/i, CONFIDENCE.EXPLICIT, 'prescribed'),
      m(/\brx\s+/i, CONFIDENCE.EXPLICIT, 'Rx'),
      m(/\b(?:medications?|drugs?)\s+prescribed\s+(?:includes?|are|is)\s+/i, CONFIDENCE.EXPLICIT, 'medication prescribed includes'),
      m(/\bmedications?\s+(?:are|is)?\s*/i, CONFIDENCE.STRONG, 'medication'),
      m(/\b(?:put|putting|start(?:ed|ing)?)\s+(?:her|him|them|the\s+patient)\s*on\s+/i, CONFIDENCE.STRONG, 'started on'),
      m(/\b(?:start|give|administer|prescribe)\s+(?:her|him|them\s+)?(?=[\w-]+\s+\d+\s*(?:milligrams?|millilitres?|milliliters?|mg|ml|mcg|g)\b)/i, CONFIDENCE.STRONG, 'start <drug> <dose>'),
      m(/\bgive\s+(?:her|him|them)\s+/i, CONFIDENCE.STRONG, 'give her'),
      m(/\btreatment\s+(?:is\s+)?/i, CONFIDENCE.MODERATE, 'treatment'),
      m(/\bi'?ll\s+prescribe\s+/i, CONFIDENCE.EXPLICIT, "I'll prescribe"),
      m(/\badvis(?:ed|e|ing)\s+/i, CONFIDENCE.WEAK, 'advised'),
    ],
  },

  additionalRemarks: {
    priority: 3,
    postProcessor: 'text',
    validator: 'nonEmptyText',
    markers: [
      m(/\b(?:additional\s+)?(?:remarks?|notes|advice|clinical\s+notes)\s*(?:are|is|:)?\s*/i, CONFIDENCE.EXPLICIT, 'remarks'),
      m(/\bobservations?\s*(?:are|is)?\s*/i, CONFIDENCE.STRONG, 'observation'),
      m(/\bnotes?\s*(?:are|is|:)?\s*/i, CONFIDENCE.MODERATE, 'note'),
      m(/\badvice\s*(?::|is)?\s*(?:to\s+)?/i, CONFIDENCE.EXPLICIT, 'advice is to'),
      m(/\btell\s+(?:her|him|them)\s+to\s+/i, CONFIDENCE.STRONG, 'tell her to'),
      m(/\b(?:she|he|they|patient)\s+should\s+/i, CONFIDENCE.MODERATE, 'she should'),
      m(/\bask\s+(?:her|him|them)\s+to\s+/i, CONFIDENCE.STRONG, 'ask her to'),
      m(/\b(?:i\s+would\s+)?advise\s+(?:the\s+patient|her|him|them)?\s*to\s+/i, CONFIDENCE.STRONG, 'advise to'),
      m(/\b(?=follow[\s-]*up\b)/i, CONFIDENCE.MODERATE, 'follow up'),
      m(/\b(?=come\s+back\s+(?:for\s+review|after)\b)/i, CONFIDENCE.MODERATE, 'come back for review'),
      m(/\b(?=review\s+after\b)/i, CONFIDENCE.MODERATE, 'review after'),
      m(/\binvestigations?\s+advised\s*:?\s*/i, CONFIDENCE.EXPLICIT, 'investigations advised'),
      m(/\b(?:recommendations?|special\s+instructions)\s*(?:are|is|:)?\s*/i, CONFIDENCE.STRONG, 'recommendation'),
      m(/\b(?=return\s+after\b)/i, CONFIDENCE.MODERATE, 'return after'),
    ],
  },
};

export const FILLER_PATTERN =
  /\b(?:um+|uh+|er+|ah+|hmm+|okay|ok|so|well|actually|basically|you\s+know|i\s+mean|like\s+i\s+said|let\s+me\s+see|right)\b/gi;

export const LEADING_TRIM_PATTERN =
  /^(?:is|are|was|were|has|have|had|of|the|a|an|with|for|to|her|his|their|and|that|it|she|he)\b[\s,]*/i;

export const DIAGNOSIS_HEDGE_PATTERN =
  /^(?:it\s+)?(?:looks\s+like|appears\s+to\s+be|appears|seems\s+to\s+be|seems\s+like|seems|sounds\s+like|suggestive\s+of|consistent\s+with|most\s+likely|probably|possibly|likely|examination\s+suggests?|findings?\s+suggests?|clinically(?:\s+this\s+is)?|assessment\s+is|impression\s+is|points?\s+to(?:wards?)?|provisionally|i\s+would\s+call\s+this|this\s+is|(?:a\s+)?case\s+of)\b[\s,]*/i;

export const TRAILING_TRIM_PATTERN =
  /[\s,]*\b(?:to\s+me|and|but|with|for|to|then|also|plus|today|now|currently)\b[\s,]*$/i;

export const TRAILING_LEAD_IN_PATTERN =
  /[\s,]*\b(?:she|he|they|the\s+patient|patient|my|our|her|his|their)(?:\s+(?:is|was|are|were|has|have|had))?(?:\s+(?:a|an|the))?[\s,]*$/i;

export const RESTATED_LABEL_PATTERN =
  /^(?:the\s+)?(?:provisional\s+|final\s+|clinical\s+)?(?:diagnosis|impression|age|gender|sex|patient\s+name|name|contact\s+number|phone\s+number|mobile\s+number|pin\s*code|postal\s*code|address|medical\s+history|prescription\s+notes?|symptoms?)\s*(?:is|are|:)?\s*/i;
