import { getDb, runMigrations } from '../db/database';

/**
 * Session Persistence Service.
 *
 * Saves and restores active dictation sessions using debounced SQLite operations.
 * Avoids heavy DB operations on every speech event.
 */

let saveTimeout = null;
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
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveSessionImmediate(sessionData).catch(err => {
      console.warn('[sessionPersistenceService] Failed to save session:', err);
    });
  }, DEBOUNCE_MS);
}

export async function saveSessionImmediate({
  id,
  segments,
  liveExtractedFields,
  durationSeconds,
}) {
  if (!id) return;
  try {
    const db = openSessionDb();
    const now = Date.now();
    await db.execute(
      `INSERT INTO active_sessions (id, segments_json, live_fields_json, duration_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         segments_json = excluded.segments_json,
         live_fields_json = excluded.live_fields_json,
         duration_seconds = excluded.duration_seconds,
         updated_at = excluded.updated_at;`,
      [
        id,
        JSON.stringify(segments ?? []),
        JSON.stringify(liveExtractedFields ?? {}),
        durationSeconds ?? 0,
        now,
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
      segments: JSON.parse(row.segments_json || '[]'),
      liveExtractedFields: JSON.parse(row.live_fields_json || '{}'),
      durationSeconds: Number(row.duration_seconds || 0),
      updatedAt: Number(row.updated_at),
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
