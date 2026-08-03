/**
 * Natural-dictation extraction matrix.
 *
 *   node scripts/test-extraction-natural.mjs
 *
 * Covers the phrasing a doctor actually uses: synonyms, pronouns, negation,
 * self-correction, chronic-vs-acute, and multi-drug prescriptions. Asserts
 * exact field values — a populated field holding another field's text is a
 * failure, not a pass.
 */
import { extractPatientFields } from '../src/services/extractionService.js';

import {
  check,
  expectFields as assertFields,
  report,
  valueOf,
} from './lib/fixture-harness.mjs';

const expectFields = (label, transcript, expected) =>
  assertFields(extractPatientFields, label, transcript, expected);

// ── 1. Template and reordering ──────────────────────────────────────────────
expectFields(
  '1.1 template',
  'Patient name is Hema Sharma. Age twenty two years. Gender female. Diagnosis is viral infection.',
  { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female', diagnosis: 'Viral infection' },
);

expectFields(
  '1.2 fully reordered',
  'Diagnosis looks like viral infection. She is a known diabetic. Start paracetamol 500 mg twice daily. Patient is Hema Sharma, twenty two years old, living in Dwarka.',
  {
    diagnosis: 'Viral infection',
    medicalHistory: 'Known diabetic',
    prescriptionNotes: ['Paracetamol 500 mg twice daily'],
    patientName: 'Hema Sharma',
    age: '22 Years',
    address: 'Dwarka',
  },
);

// ── 2. Synonym-heavy phrasing ───────────────────────────────────────────────
expectFields(
  '2.1 name synonyms',
  'This is Mr. Rahul Verma. He is 45 years of age.',
  { patientName: 'Rahul Verma', age: '45 Years', gender: 'Male' },
);

expectFields(
  '2.2 symptom synonyms',
  'The patient is experiencing severe headache and nausea.',
  { symptoms: ['Severe headache', 'Nausea'] },
);

expectFields(
  '2.3 diagnosis synonyms',
  'Findings are suggestive of dengue fever.',
  { diagnosis: 'Dengue fever' },
);

expectFields(
  '2.4 diagnosis consistent with',
  'Presentation is consistent with acute gastritis.',
  { diagnosis: 'Acute gastritis' },
);

expectFields(
  '2.5 history synonyms',
  'She was previously diagnosed with hypothyroidism.',
  { medicalHistory: 'Hypothyroidism' },
);

expectFields(
  '2.6 contact synonyms',
  'You can call at 9876543210.',
  { contactNumber: '9876543210' },
);

expectFields(
  '2.7 remarks synonyms',
  'Investigations advised: complete blood count. Return after three days.',
  { additionalRemarks: 'Complete blood count. Return after three days' },
);

// ── 2b. Natural symptom phrasing ────────────────────────────────────────────
expectFields(
  '2b.1 is having, multiple symptoms with duration',
  'He is having fever, cough, headache, and body pain for about three days.',
  {
    symptoms: ['Fever', 'Cough', 'Headache', 'Body pain for about three days'],
    medicalHistory: null,
  },
);

expectFields('2b.2 she is having', 'She is having headache and nausea.', {
  symptoms: ['Headache', 'Nausea'],
});

expectFields('2b.3 patient is having', 'Patient is having fever since yesterday.', {
  symptoms: ['Fever since yesterday'],
  medicalHistory: null,
});

expectFields('2b.4 bare having', 'Currently having body pain.', {
  symptoms: ['Body pain'],
});

expectFields('2b.5 having since', 'Having fever since yesterday.', {
  symptoms: ['Fever since yesterday'],
});

expectFields('2b.6 has got', 'He has got fever and headache.', {
  symptoms: ['Fever', 'Headache'],
});

expectFields('2b.7 dealing with', 'Dealing with cough and sore throat.', {
  symptoms: ['Cough', 'Sore throat'],
});

expectFields('2b.8 has', 'He has fever and cough.', { symptoms: ['Fever', 'Cough'] });

expectFields('2b.9 experiencing', 'She is experiencing fever and weakness.', {
  symptoms: ['Fever', 'Weakness'],
});

expectFields('2b.10 suffering from', 'He is suffering from fever and cough.', {
  symptoms: ['Fever', 'Cough'],
});

expectFields('2b.11 came with', 'Came with fever and headache.', {
  symptoms: ['Fever', 'Headache'],
});

// ── 3. Gender from pronouns ─────────────────────────────────────────────────
expectFields('3.1 single female pronoun', 'The patient is 22 years old. She has fever.', {
  gender: 'Female',
});

expectFields('3.2 single male pronoun', 'The patient is 45. His blood pressure is high.', {
  gender: 'Male',
});

expectFields(
  '3.3 explicit beats pronoun',
  'Patient is male. She has had fever since yesterday.',
  { gender: 'Male' },
);

expectFields(
  '3.4 patient noun beats pronoun',
  'This lady presented with fever. His attendant waited outside.',
  { gender: 'Female' },
);

expectFields(
  '3.5 conflicting pronouns leave it blank',
  'The patient came today. She has fever. He also reports cough.',
  { gender: null },
);

expectFields('3.6 no gender evidence', 'Patient came today with fever and cough.', {
  gender: null,
});

expectFields(
  '3.7 relative pronoun does not set patient gender',
  'Patient is Rahul Verma. Her mother is diabetic.',
  { gender: null },
);

expectFields('3.8 gender never inferred from name', 'Patient name is Hema Sharma.', {
  gender: null,
});

// ── 4. Chronic vs acute ─────────────────────────────────────────────────────
expectFields(
  '4.1 chronic condition is history, not symptom',
  'Patient has had diabetes for ten years and today presents with fever and cough. Looks like viral infection.',
  {
    medicalHistory: 'Diabetes for ten years',
    symptoms: ['Fever', 'Cough'],
    diagnosis: 'Viral infection',
  },
);

expectFields(
  '4.2 known case phrasing',
  'Known case of type 2 diabetes. Complains of burning micturition.',
  { medicalHistory: 'Type 2 diabetes', symptoms: ['Burning micturition'] },
);

expectFields(
  '4.3 acute stays a symptom',
  'She has had fever since yesterday.',
  { symptoms: ['Fever since yesterday'], medicalHistory: null },
);

// ── 5. Negation ─────────────────────────────────────────────────────────────
expectFields(
  '5.1 negated symptoms excluded',
  'Patient has fever and cough but no chest pain or breathing difficulty.',
  { symptoms: ['Fever', 'Cough'] },
);

expectFields(
  '5.2 negated symptoms recorded as a denial',
  'Patient has fever and cough but no chest pain or breathing difficulty.',
  { additionalRemarks: 'Denies: chest pain, breathing difficulty' },
);

expectFields(
  '5.3 negated history not recorded as positive',
  'No history of diabetes or hypertension. Complains of fever.',
  { medicalHistory: 'No history of diabetes or hypertension', symptoms: ['Fever'] },
);

expectFields(
  '5.4 denies phrasing',
  'Patient denies chest pain. Complains of fever.',
  { symptoms: ['Fever'], additionalRemarks: 'Denies: chest pain' },
);

// ── 6. Corrections ──────────────────────────────────────────────────────────
expectFields('6.1 sorry', 'Age 32... sorry, 22 years.', { age: '22 Years' });
expectFields('6.2 correction cue', 'Contact number 9876543211... correction, 9876543210.', {
  contactNumber: '9876543210',
});
expectFields('6.3 actually', 'Diagnosis bacterial infection... actually viral infection.', {
  diagnosis: 'Viral infection',
});
expectFields('6.4 I mean', 'Age 45 years, I mean 54 years.', { age: '54 Years' });
expectFields('6.5 no make that', 'PIN code 110077, no make that 110078.', { pinCode: '110078' });

// ── 7. Repetition ───────────────────────────────────────────────────────────
expectFields(
  '7.1 repeated identical value',
  'Patient is Hema Sharma. Patient name again, Hema Sharma.',
  { patientName: 'Hema Sharma' },
);

expectFields(
  '7.2 repeated conflicting value takes the later',
  'Age 22 years. Sorry, age 32 years.',
  { age: '32 Years' },
);

expectFields(
  '7.3 recognizer restart duplicate phrase',
  'Complains of fever and cough. Complains of fever and cough. Diagnosis is viral infection.',
  { symptoms: ['Fever', 'Cough'], diagnosis: 'Viral infection' },
);

// ── 8. Prescription vs advice ───────────────────────────────────────────────
expectFields(
  '8.1 prescription with full attributes',
  'Start paracetamol 500 mg twice daily for five days and ask her to get a CBC and return after three days.',
  {
    prescriptionNotes: ['Paracetamol 500 mg twice daily for five days'],
    additionalRemarks: 'Get a CBC and return after three days',
  },
);

expectFields(
  '8.2 multi-drug prescription',
  'Prescribed paracetamol 500 mg twice daily and azithromycin 250 mg once daily for three days.',
  {
    prescriptionNotes: [
      'Paracetamol 500 mg twice daily',
      'Azithromycin 250 mg once daily for three days',
    ],
  },
);

expectFields(
  '8.3 route and timing preserved',
  'Put her on injection ceftriaxone 1 g intravenous twice daily after food.',
  { prescriptionNotes: ['Injection ceftriaxone 1 g intravenous twice daily after food'] },
);

expectFields(
  '8.4 advice is not a prescription',
  'Advised plenty of oral fluids and complete bed rest.',
  { prescriptionNotes: null, additionalRemarks: 'Plenty of oral fluids and complete bed rest' },
);

// ── 9. Typed values in context ──────────────────────────────────────────────
expectFields(
  '9.1 dosage is not an age or a PIN',
  'Prescribed paracetamol 500 mg twice daily for five days.',
  { age: null, pinCode: null, prescriptionNotes: ['Paracetamol 500 mg twice daily for five days'] },
);

expectFields(
  '9.2 spoken digits for PIN and phone',
  'PIN code one one zero zero seven eight. Contact number nine eight seven six five four three two one zero.',
  { pinCode: '110078', contactNumber: '9876543210' },
);

expectFields('9.3 sector number is not an age', 'Address is Sector twelve Dwarka New Delhi.', {
  address: 'Sector twelve Dwarka New Delhi',
  age: null,
});

expectFields('9.4 duration is not an age', 'Fever for five days.', { age: null });

// ── 10. Messy speech ────────────────────────────────────────────────────────
expectFields(
  '10.1 filler heavy',
  'Um, so the patient is, uh, Hema Sharma, you know, and she is basically twenty two years old.',
  { patientName: 'Hema Sharma', age: '22 Years', gender: 'Female' },
);

expectFields(
  '10.2 unpunctuated fast STT',
  'patient name is hema sharma age twenty two years gender female complains of fever and cough diagnosis is viral infection',
  {
    patientName: 'Hema Sharma',
    age: '22 Years',
    gender: 'Female',
    symptoms: ['Fever', 'Cough'],
    diagnosis: 'Viral infection',
  },
);

expectFields('10.3 partial transcript keeps what it has', 'Patient name is Hema Sharma. Age tw', {
  patientName: 'Hema Sharma',
  age: null,
});

expectFields('10.4 empty transcript', '', {
  patientName: null,
  age: null,
  gender: null,
  symptoms: null,
  diagnosis: null,
});

// ── 11. Never guess ─────────────────────────────────────────────────────────
expectFields(
  '11.1 unmentioned fields stay null',
  'Complains of fever and cough.',
  {
    patientName: null,
    age: null,
    gender: null,
    address: null,
    pinCode: null,
    contactNumber: null,
    medicalHistory: null,
    diagnosis: null,
    prescriptionNotes: null,
    additionalRemarks: null,
  },
);

expectFields('11.2 no diagnosis invented from symptoms', 'Patient has fever and body ache.', {
  diagnosis: null,
});

// ── Report ──────────────────────────────────────────────────────────────────
report();
