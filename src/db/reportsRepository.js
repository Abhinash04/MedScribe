import { summaryFrom } from '../services/reportDraft';
import { getDb } from './database';

/**
 * The only module in the app that writes SQL.
 *
 * Callers pass and receive plain objects — no stringified columns, no row
 * shapes, no `snake_case` leaking upward. Replacing SQLite with a cloud or EHR
 * backend later means rewriting this file and nothing else.
 */

export const REPORT_STATUS = {
  DRAFT: 'draft',
  FINAL: 'final',
};

/**
 * Report ids are generated here rather than by AUTOINCREMENT so they stay
 * unique across devices — a prerequisite for the cloud sync in SRS §8.
 * `crypto.randomUUID` is deliberately not used: it is not guaranteed on Hermes.
 */
function makeId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `rpt_${Date.now().toString(36)}_${random}`;
}

function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Row -> the summary the dashboard lists. No JSON parsing. */
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

/** Row -> the full report the report screen edits. */
function toReport(row) {
  return {
    ...toSummary(row),
    transcript: row.transcript || '',
    extracted: parseJson(row.extracted_json, {}),
    edited: parseJson(row.edited_json, {}),
  };
}

/** All saved reports, newest first. */
export async function listReports() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT id, patient_name, diagnosis, status, created_at, updated_at
       FROM reports
      ORDER BY created_at DESC;`,
  );
  return (rows ?? []).map(toSummary);
}

/** One report with its transcript and both value sets, or null. */
export async function getReport(id) {
  const db = getDb();
  const { rows } = await db.execute('SELECT * FROM reports WHERE id = ?;', [id]);
  const row = rows?.[0];
  return row ? toReport(row) : null;
}

/**
 * Insert a new report.
 *
 * @param {{transcript: string, extracted: Object, edited: Object, status?: string}} report
 * @returns {Promise<string>} the new report id
 */
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

/**
 * Update the doctor's values, and optionally the status, on an existing report.
 *
 * The extraction and the transcript are never rewritten — they are the record
 * of what was actually dictated.
 */
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

  await db.execute(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?;`, params);

  return now;
}

/** Move a report between draft and final without touching its values. */
export async function setStatus(id, status) {
  const db = getDb();
  const now = Date.now();
  await db.execute(
    'UPDATE reports SET status = ?, updated_at = ? WHERE id = ?;',
    [status, now, id],
  );
  return now;
}

export async function deleteReport(id) {
  const db = getDb();
  await db.execute('DELETE FROM reports WHERE id = ?;', [id]);
}

/** Used by the dashboard's empty state to tell "none yet" from "not loaded". */
export async function countReports() {
  const db = getDb();
  const { rows } = await db.execute('SELECT COUNT(*) AS total FROM reports;');
  return Number(rows?.[0]?.total ?? 0);
}
