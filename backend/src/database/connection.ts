import fs from 'fs';
import path from 'path';
import pg from 'pg';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { config } from '../config/env.js';

export interface IDatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number; lastInsertRowid?: number | bigint }>;
  execScript(rawSqlScript: string): Promise<void>;
  transaction<T>(fn: (db: IDatabaseClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isPostgres(): boolean;
}

class DatabaseManager implements IDatabaseClient {
  private pgPool: pg.Pool | null = null;
  private sqlJsDb: SqlJsDatabase | null = null;
  private isPg = false;
  private dbFilePath: string;
  private isReadyPromise: Promise<void>;

  constructor() {
    const storageDir = path.resolve(config.STORAGE_DIR, '..');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.dbFilePath = path.join(storageDir, 'video_studio.sqlite');
    this.isReadyPromise = this.init();
  }

  private async init(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL || (config as any).DATABASE_URL;

    if (dbUrl && dbUrl.startsWith('postgres')) {
      try {
        this.pgPool = new pg.Pool({
          connectionString: dbUrl,
          max: 20,
          idleTimeoutMillis: 30000,
        });
        this.isPg = true;
        console.log('[Database] Connected to external PostgreSQL database.');
        return;
      } catch (err: any) {
        console.warn('[Database] PostgreSQL connection failed, falling back to local persistent SQLite:', err.message);
      }
    }

    // Default to WASM SQLite engine for zero-config local runs
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbFilePath)) {
      const buffer = fs.readFileSync(this.dbFilePath);
      this.sqlJsDb = new SQL.Database(buffer);
    } else {
      this.sqlJsDb = new SQL.Database();
      this.saveToDisk();
    }
    this.isPg = false;
    console.log(`[Database] Initialized persistent SQLite database at: ${this.dbFilePath}`);
  }

  public async ensureReady(): Promise<void> {
    await this.isReadyPromise;
  }

  public isPostgres(): boolean {
    return this.isPg;
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.ensureReady();

    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return res.rows as T[];
    } else if (this.sqlJsDb) {
      const normalizedSql = this.normalizeSql(sql);
      const stmt = this.sqlJsDb.prepare(normalizedSql);
      stmt.bind(params);

      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    }
    throw new Error('[Database] No active database connection.');
  }

  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<{ rowCount: number; lastInsertRowid?: number | bigint }> {
    await this.ensureReady();

    if (this.isPg && this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return { rowCount: res.rowCount || 0 };
    } else if (this.sqlJsDb) {
      const normalizedSql = this.normalizeSql(sql);
      this.sqlJsDb.run(normalizedSql, params);
      const changesRes = this.sqlJsDb.exec('SELECT changes() as count');
      const countVal = changesRes[0]?.values[0]?.[0];
      const rowCount = typeof countVal === 'number' ? countVal : 0;
      this.saveToDisk();
      return { rowCount };
    }
    throw new Error('[Database] No active database connection.');
  }

  public async execScript(rawSqlScript: string): Promise<void> {
    await this.ensureReady();

    if (this.isPg && this.pgPool) {
      await this.pgPool.query(rawSqlScript);
    } else if (this.sqlJsDb) {
      this.sqlJsDb.exec(rawSqlScript);
      this.saveToDisk();
    }
  }

  public async transaction<T>(fn: (db: IDatabaseClient) => Promise<T>): Promise<T> {
    await this.ensureReady();

    if (this.isPg && this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const wrapper: IDatabaseClient = {
          query: async (sql, params) => (await client.query(sql, params)).rows,
          queryOne: async (sql, params) => {
            const r = await client.query(sql, params);
            return r.rows[0] || null;
          },
          execute: async (sql, params) => {
            const r = await client.query(sql, params);
            return { rowCount: r.rowCount || 0 };
          },
          execScript: async (sql) => {
            await client.query(sql);
          },
          transaction: async (nestedFn) => nestedFn(wrapper),
          close: async () => {},
          isPostgres: () => true,
        };
        const result = await fn(wrapper);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else if (this.sqlJsDb) {
      this.sqlJsDb.exec('BEGIN TRANSACTION;');
      try {
        const result = await fn(this);
        this.sqlJsDb.exec('COMMIT;');
        this.saveToDisk();
        return result;
      } catch (err) {
        this.sqlJsDb.exec('ROLLBACK;');
        throw err;
      }
    }
    throw new Error('[Database] No active connection.');
  }

  public async close(): Promise<void> {
    if (this.pgPool) await this.pgPool.end();
    if (this.sqlJsDb) {
      this.saveToDisk();
      this.sqlJsDb.close();
    }
  }

  private saveToDisk(): void {
    if (!this.sqlJsDb) return;
    try {
      const data = this.sqlJsDb.export();
      fs.writeFileSync(this.dbFilePath, Buffer.from(data));
    } catch (err: any) {
      console.warn('[Database] Failed to persist SQLite state to disk:', err.message);
    }
  }

  private normalizeSql(sql: string): string {
    // Normalizes PostgreSQL parameter syntax ($1, $2) to standard SQLite indexed parameter syntax (?1, ?2)
    return sql.replace(/\$(\d+)/g, '?$1');
  }
}

export const db = new DatabaseManager();
