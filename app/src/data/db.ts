/**
 * Local-first persistence (SQLite via expo-sqlite).
 * All learner data stays on the device. Migrations run in order and are
 * tracked with PRAGMA user_version.
 */

import * as SQLite from "expo-sqlite";

export type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

interface Migration {
  version: number;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL DEFAULT '',
        native_language TEXT NOT NULL DEFAULT '',
        goals_json TEXT NOT NULL DEFAULT '[]',
        daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
        cefr_level TEXT NOT NULL DEFAULT 'A1',
        target_level TEXT NOT NULL DEFAULT 'B2',
        skill_scores_json TEXT NOT NULL DEFAULT '{}',
        onboarded INTEGER NOT NULL DEFAULT 0,
        diagnostic_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mistakes (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        original TEXT NOT NULL,
        corrected TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        context TEXT NOT NULL DEFAULT '',
        frequency INTEGER NOT NULL DEFAULT 1,
        correct_count INTEGER NOT NULL DEFAULT 0,
        confidence INTEGER NOT NULL DEFAULT 60,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        srs_json TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS vocabulary (
        word TEXT PRIMARY KEY,
        meaning TEXT NOT NULL,
        part_of_speech TEXT,
        pronunciation TEXT,
        example TEXT,
        synonyms_json TEXT NOT NULL DEFAULT '[]',
        difficulty TEXT,
        first_seen INTEGER NOT NULL,
        last_reviewed INTEGER,
        review_count INTEGER NOT NULL DEFAULT 0,
        mastery REAL NOT NULL DEFAULT 0,
        srs_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'conversation'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        scenario_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        summary_json TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user','tutor')),
        content TEXT NOT NULL,
        corrections_json TEXT NOT NULL DEFAULT '[]',
        vocabulary_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, id);

      CREATE TABLE IF NOT EXISTS exercise_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        ref_id TEXT NOT NULL DEFAULT '',
        topic_id TEXT NOT NULL DEFAULT '',
        correct INTEGER NOT NULL,
        quality REAL NOT NULL,
        difficulty TEXT NOT NULL,
        skill TEXT NOT NULL DEFAULT 'grammar',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_results_time ON exercise_results (created_at);

      CREATE TABLE IF NOT EXISTS mission_log (
        date_key TEXT PRIMARY KEY,
        plan_json TEXT NOT NULL,
        completed_json TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
    `,
  },
];

export async function openDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("english_tutor.db");
      await db.execAsync("PRAGMA journal_mode = WAL");
      await db.execAsync("PRAGMA foreign_keys = ON");
      const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      let version = row?.user_version ?? 0;
      for (const migration of MIGRATIONS) {
        if (migration.version > version) {
          await db.withExclusiveTransactionAsync(async (tx) => {
            await tx.execAsync(migration.up);
            await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
          });
          version = migration.version;
        }
      }
      return db;
    })();
  }
  return dbPromise;
}

/** Delete every learner record (user-controlled data deletion). */
export async function wipeAllData(): Promise<void> {
  const db = await openDb();
  await db.execAsync(`
    DELETE FROM profile; DELETE FROM mistakes; DELETE FROM vocabulary;
    DELETE FROM messages; DELETE FROM sessions; DELETE FROM exercise_results;
    DELETE FROM mission_log;
  `);
}
