import { summaryFrom } from '../services/reportDraft';
import { getDb } from './database';

export const REPORT_STATUS = {
  DRAFT: 'draft',
  FINAL: 'final',
};

function makeId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `rpt_${Date.now().toString(36)}_${random}`;
}

function parseJson(raw, fallback, contextName) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (contextName) {
      console.error(`[reportsRepository] Failed to parse JSON for ${contextName}:`, error);
      throw new Error(`Corrupt report data: failed to parse ${contextName}`);
    }
    return fallback;
  }
}

function toSummary(row) {
  return {
    id: row.id,
    patientName: row.patient_name || '',
    diagnosis: row.diagnosis || '',
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function toReport(row) {
  return {
    ...toSummary(row),
    transcript: row.transcript || '',
    extracted: parseJson(row.extracted_json, {}, 'extracted_json'),
    edited: parseJson(row.edited_json, {}, 'edited_json'),
  };
}

export async function listReports() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT id, patient_name, diagnosis, status, created_at, updated_at
       FROM reports
      ORDER BY created_at DESC;`,
  );
  return (rows ?? []).map(toSummary);
}

export async function getReport(id) {
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM reports WHERE id = ?;', [id]);
  const row = rows?.[0];
  return row ? toReport(row) : null;
}
export async function createReport({
  transcript,
  extracted,
  edited,
  status = REPORT_STATUS.DRAFT,
}) {
  const db = getDb();
  const id = makeId();
  const now = Date.now();
  const { patientName, diagnosis } = summaryFrom(edited);

  await db.execute(
    `INSERT INTO reports (
       id, patient_name, diagnosis, transcript,
       extracted_json, edited_json, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      patientName,
      diagnosis,
      transcript ?? '',
      JSON.stringify(extracted ?? {}),
      JSON.stringify(edited ?? {}),
      status,
      now,
      now,
    ],
  );

  return id;
}

export async function updateReport(id, { edited, status }) {
  const db = getDb();
  const now = Date.now();
  const { patientName, diagnosis } = summaryFrom(edited);

  const sets = [
    'patient_name = ?',
    'diagnosis = ?',
    'edited_json = ?',
    'updated_at = ?',
  ];
  const params = [patientName, diagnosis, JSON.stringify(edited ?? {}), now];

  if (status) {
    sets.push('status = ?');
    params.push(status);
  }

  params.push(id);

  const result = await db.execute(
    `UPDATE reports SET ${sets.join(', ')} WHERE id = ?;`,
    params,
  );

  if ((result?.rowsAffected ?? 0) === 0) {
    throw new Error(`Report not found: ${id}`);
  }

  return now;
}

export async function setStatus(id, status) {
  const db = getDb();
  const now = Date.now();
  const result = await db.execute(
    'UPDATE reports SET status = ?, updated_at = ? WHERE id = ?;',
    [status, now, id],
  );
  if ((result?.rowsAffected ?? 0) === 0) {
    throw new Error(`Report not found: ${id}`);
  }
  return now;
}

export async function deleteReport(id) {
  const db = getDb();
  await db.execute('DELETE FROM reports WHERE id = ?;', [id]);
}

export async function countReports() {
  const db = getDb();
  const { rows } = await db.execute('SELECT COUNT(*) AS total FROM reports;');
  return Number(rows?.[0]?.total ?? 0);
}
