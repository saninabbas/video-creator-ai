import fs from 'fs';
import path from 'path';
import { db } from './connection.js';

export class MigrationRunner {
  private migrationsDir: string;

  constructor(customMigrationsDir?: string) {
    if (customMigrationsDir) {
      this.migrationsDir = customMigrationsDir;
    } else {
      // Find migrations directory reliably in src or dist
      const candidates = [
        path.resolve(process.cwd(), 'src/database/migrations'),
        path.resolve(process.cwd(), 'backend/src/database/migrations'),
        path.resolve(__dirname, 'migrations'),
        path.resolve(__dirname, '../../src/database/migrations'),
      ];

      const found = candidates.find((dir) => fs.existsSync(dir));
      this.migrationsDir = found || candidates[0];
    }
  }

  public async initMigrationTable(): Promise<void> {
    await db.execScript(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public async migrateUp(): Promise<string[]> {
    await this.initMigrationTable();

    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`[Migrations] Directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied = await db.query<{ id: string }>('SELECT id FROM _migrations');
    const appliedSet = new Set(applied.map((r) => r.id));

    const newlyApplied: string[] = [];

    for (const file of files) {
      const migrationId = path.basename(file, '.sql');
      if (!appliedSet.has(migrationId)) {
        console.log(`[Migrations] Applying migration: ${file}...`);
        const filePath = path.join(this.migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf-8');

        await db.execScript(sqlContent);
        await db.execute('INSERT INTO _migrations (id, name) VALUES ($1, $2)', [migrationId, file]);

        newlyApplied.push(migrationId);
        console.log(`[Migrations] Successfully applied: ${file}`);
      }
    }

    if (newlyApplied.length === 0) {
      console.log('[Migrations] Database schema is up to date.');
    }

    return newlyApplied;
  }

  public async getStatus(): Promise<{ applied: string[]; pending: string[] }> {
    await this.initMigrationTable();
    if (!fs.existsSync(this.migrationsDir)) {
      return { applied: [], pending: [] };
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRows = await db.query<{ id: string }>('SELECT id FROM _migrations ORDER BY applied_at ASC');
    const appliedIds = appliedRows.map((r) => r.id);
    const appliedSet = new Set(appliedIds);

    const pending = files
      .map((f) => path.basename(f, '.sql'))
      .filter((id) => !appliedSet.has(id));

    return { applied: appliedIds, pending };
  }
}

export const migrationRunner = new MigrationRunner();
