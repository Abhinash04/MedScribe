import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'medscribe.db';

let handle = null;
let migrated = false;
export function getDb() {
  if (!handle) {
    handle = open({ name: DB_NAME });
  }
  return handle;
}
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
  db => {
    const columns = [
      "draft_json        TEXT",
      "native_json       TEXT",
      "anuvadini_json    TEXT",
      "transcript_source TEXT NOT NULL DEFAULT 'native'",
      "stage             TEXT NOT NULL DEFAULT 'recording'",
      'created_at        INTEGER',
    ];
    for (const column of columns) {
      db.executeSync(`ALTER TABLE active_sessions ADD COLUMN ${column};`);
    }
  },
  db => {
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    const sessionColumns = ['language TEXT', 'translation_json TEXT'];
    for (const column of sessionColumns) {
      db.executeSync(`ALTER TABLE active_sessions ADD COLUMN ${column};`);
    }

    const reportColumns = ['language TEXT', 'transcript_source_text TEXT'];
    for (const column of reportColumns) {
      db.executeSync(`ALTER TABLE reports ADD COLUMN ${column};`);
    }
  },
];

export function runMigrations() {
  if (migrated) {
    return MIGRATIONS.length;
  }

  const db = getDb();
  db.executeSync('PRAGMA journal_mode = WAL;');

  const result = db.executeSync('PRAGMA user_version;');
  const current = Number(result?.rows?.[0]?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    db.executeSync('BEGIN TRANSACTION;');
    try {
      MIGRATIONS[version](db);
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

export function closeDb() {
  if (handle) {
    handle.close();
    handle = null;
  }
  migrated = false;
}
