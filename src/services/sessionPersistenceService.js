import { getDb, runMigrations } from '../db/database';

/**
 * Session Persistence Service.
 *
 * Saves and restores the active consultation using debounced SQLite writes.
 * A partial speech result never reaches this module — only a finalised
 * utterance, a committed transcript edit or a report-draft change does — so the
 * debounce below is the only write throttling the app needs.
 */

let saveTimeout = null;
let pending = null;
const DEBOUNCE_MS = 2000;

/**
 * `active_sessions` arrives in migration 2, and dictation can be the first
 * thing that touches the database on a fresh install. `runMigrations` latches
 * internally, so calling it per query costs nothing after the first.
 */
function openSessionDb() {
  runMigrations();
  return getDb();
}

export async function saveSessionDebounced(sessionData) {
  pending = sessionData;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    const data = pending;
    pending = null;
    saveSessionImmediate(data).catch(err => {
      console.warn('[sessionPersistenceService] Failed to save session:', err);
    });
  }, DEBOUNCE_MS);
}

/**
 * Writes whatever the debounce is still holding.
 *
 * Called when the app goes to the background: a two-second window is exactly
 * long enough to lose the last edit to a process the OS decides to kill.
 */
export async function flushPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  const data = pending;
  pending = null;
  if (data) {
    await saveSessionImmediate(data);
  }
}

export async function saveSessionImmediate({
  id,
  segments,
  liveExtractedFields,
  durationSeconds,
  draft,
  nativeTranscript,
  anuvadiniTranscript,
  transcriptSource,
  stage,
  createdAt,
}) {
  if (!id) return;
  try {
    const db = openSessionDb();
    const now = Date.now();
    await db.execute(
      `INSERT INTO active_sessions (
         id, segments_json, live_fields_json, duration_seconds, updated_at,
         draft_json, native_json, anuvadini_json, transcript_source, stage, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         segments_json = excluded.segments_json,
         live_fields_json = excluded.live_fields_json,
         duration_seconds = excluded.duration_seconds,
         updated_at = excluded.updated_at,
         draft_json = excluded.draft_json,
         native_json = excluded.native_json,
         anuvadini_json = excluded.anuvadini_json,
         transcript_source = excluded.transcript_source,
         stage = excluded.stage,
         created_at = COALESCE(active_sessions.created_at, excluded.created_at);`,
      [
        id,
        JSON.stringify(segments ?? []),
        JSON.stringify(liveExtractedFields ?? {}),
        durationSeconds ?? 0,
        now,
        draft ? JSON.stringify(draft) : null,
        nativeTranscript ? JSON.stringify(nativeTranscript) : null,
        anuvadiniTranscript ? JSON.stringify(anuvadiniTranscript) : null,
        transcriptSource || 'native',
        stage || 'recording',
        createdAt ?? now,
      ],
    );

    // Only the live session may exist. Without this, a session that was never
    // cleared (a crash the doctor then discarded from a different device state)
    // could outlive its successor and be offered for recovery later.
    await db.execute('DELETE FROM active_sessions WHERE id <> ?;', [id]);
  } catch (error) {
    console.warn('[sessionPersistenceService] Save error:', error);
  }
}

const parse = (raw, fallback) => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export async function getActiveSession() {
  try {
    const db = openSessionDb();
    const { rows } = await db.execute(
      `SELECT * FROM active_sessions ORDER BY updated_at DESC LIMIT 1;`,
    );
    const row = rows?.[0];
    if (!row) return null;

    return {
      id: row.id,
      segments: parse(row.segments_json, []),
      liveExtractedFields: parse(row.live_fields_json, {}),
      durationSeconds: Number(row.duration_seconds || 0),
      updatedAt: Number(row.updated_at),
      createdAt: Number(row.created_at || row.updated_at),
      draft: parse(row.draft_json, null),
      nativeTranscript: parse(row.native_json, null),
      anuvadiniTranscript: parse(row.anuvadini_json, null),
      transcriptSource: row.transcript_source || 'native',
      stage: row.stage || 'recording',
    };
  } catch (error) {
    console.warn('[sessionPersistenceService] Load error:', error);
    return null;
  }
}

export async function clearActiveSession(id) {
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    pending = null;
    const db = openSessionDb();
    if (id) {
      await db.execute(`DELETE FROM active_sessions WHERE id = ?;`, [id]);
    } else {
      await db.execute(`DELETE FROM active_sessions;`);
    }
  } catch (error) {
    console.warn('[sessionPersistenceService] Clear error:', error);
  }
}
