import { open } from '@op-engineering/op-sqlite';

/**
 * The single SQLite connection and its schema migrations.
 *
 * Only this file and `reportsRepository.js` know that persistence is SQL —
 * the same isolation rule `speechService` applies to the speech vendor.
 * Everything above the repository sees plain JavaScript objects.
 *
 * The handle is opened once and reused. op-sqlite is JSI-backed, so opening
 * per call would be both wasteful and a source of lock contention.
 */

const DB_NAME = 'medscribe.db';

let handle = null;
let migrated = false;

/** Lazily opened, memoized connection. */
export function getDb() {
  if (!handle) {
    handle = open({ name: DB_NAME });
  }
  return handle;
}

/**
 * Schema versions, in order. Index 0 takes the database to `user_version` 1.
 *
 * Never edit a migration that has shipped — append a new one. `user_version`
 * is how an already-installed app knows which ones it still needs.
 */
const MIGRATIONS = [
  db => {
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS reports (
        id             TEXT PRIMARY KEY,
        patient_name   TEXT,
        diagnosis      TEXT,
        transcript     TEXT NOT NULL,
        extracted_json TEXT NOT NULL,
        edited_json    TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'draft',
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      );
    `);
    db.executeSync(
      'CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);',
    );
  },
  db => {
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id               TEXT PRIMARY KEY,
        segments_json    TEXT NOT NULL,
        live_fields_json TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        updated_at       INTEGER NOT NULL
      );
    `);
  },
];

/**
 * Bring the schema up to date. Safe to call more than once.
 *
 * Runs before the first query of the session; a failure here must surface to
 * the user rather than leaving the dashboard silently empty, which would read
 * as "you have no reports" when the truth is "the database did not open".
 */
export function runMigrations() {
  if (migrated) {
    return MIGRATIONS.length;
  }

  const db = getDb();

  // WAL keeps a crash mid-write from taking the whole file with it, and lets a
  // read (the dashboard list) proceed while a save is in flight.
  db.executeSync('PRAGMA journal_mode = WAL;');

  const result = db.executeSync('PRAGMA user_version;');
  const current = Number(result?.rows?.[0]?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    db.executeSync('BEGIN TRANSACTION;');
    try {
      MIGRATIONS[version](db);
      // PRAGMA cannot be parameterized; the value is a loop counter, never input.
      db.executeSync(`PRAGMA user_version = ${version + 1};`);
      db.executeSync('COMMIT;');
    } catch (error) {
      db.executeSync('ROLLBACK;');
      throw error;
    }
  }

  migrated = true;
  return MIGRATIONS.length;
}

/** Test/teardown hook. The app itself keeps the connection for its lifetime. */
export function closeDb() {
  if (handle) {
    handle.close();
    handle = null;
  }
  migrated = false;
}
