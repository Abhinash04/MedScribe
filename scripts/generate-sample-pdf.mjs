import { buildReportDocument } from '../src/services/reportDocument.js';

const mockDraft = {
  patientName: { value: 'Amit Kumar Singh' },
  age: { value: '35' },
  gender: { value: 'Male' },
  weight: { value: '' },
  reactionStartDate: { value: '' },
  reactionStopDate: { value: '' },
  symptoms: { value: ['Nausea', 'Vomiting', 'Dizziness'] },
};

const now = new Date(2026, 7, 16).getTime();
const doc = buildReportDocument(mockDraft, { now });

console.log('--- GENERATED AMIT KUMAR SINGH IPC ADR REPORT PAYLOAD ---');
console.log(JSON.stringify(doc, null, 2));
