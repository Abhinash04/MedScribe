export const SPOKEN_FIELD_LIMIT = 4;

const SPOKEN_LABEL = {
  pinCode: 'PIN code',
  contactNumber: 'contact number',
  medicalHistory: 'medical history',
  prescriptionNotes: 'prescription notes',
  additionalRemarks: 'additional remarks',
};

const spokenLabel = field =>
  SPOKEN_LABEL[field?.key] || String(field?.label ?? '').toLowerCase();

function joinNames(names) {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function missingFieldPrompt(fields) {
  const names = (Array.isArray(fields) ? fields : [])
    .map(spokenLabel)
    .filter(Boolean);

  if (!names.length) {
    return '';
  }

  if (names.length === 1) {
    return `The ${names[0]} is still missing. Please provide this mandatory detail.`;
  }

  if (names.length <= SPOKEN_FIELD_LIMIT) {
    return `The ${joinNames(
      names,
    )} are still missing. Please provide these mandatory details.`;
  }

  const spoken = names.slice(0, SPOKEN_FIELD_LIMIT);
  const rest = names.length - SPOKEN_FIELD_LIMIT;
  const detail = rest === 1 ? 'detail' : 'details';

  return (
    `The ${spoken.join(
      ', ',
    )}, and ${rest} other mandatory ${detail} are still ` +
    'missing. Please provide the missing information.'
  );
}
