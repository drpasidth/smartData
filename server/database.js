import { createRequire } from 'node:module';
import { readFile, rename, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const sqlWasmDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.js'));
const engines = new Set(['sqlite', 'mysql', 'postgresql']);

export function normalizeDatabaseConfig(input = {}, baseDir = process.cwd()) {
  const type = input.type === 'sqlite3' ? 'sqlite' : input.type;
  if (!engines.has(type)) throw new Error('Choose SQLite3, MySQL, or PostgreSQL.');
  if (type === 'sqlite') {
    const filename = typeof input.filename === 'string' && input.filename.trim() ? input.filename.trim() : 'app.db';
    if (filename.length > 250) throw new Error('SQLite file path must be under 250 characters.');
    return { type, filename: path.isAbsolute(filename) ? filename : path.resolve(baseDir, filename) };
  }
  const host = typeof input.host === 'string' ? input.host.trim() : '';
  const database = typeof input.database === 'string' ? input.database.trim() : '';
  const user = typeof input.user === 'string' ? input.user.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const port = Number(input.port || (type === 'mysql' ? 3306 : 5432));
  if (!host || host.length > 253 || !database || database.length > 128 || !user || user.length > 128) throw new Error('Enter the database host, database name, and username.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Enter a valid database port.');
  if (password.length > 1000) throw new Error('Database password is too long.');
  return { type, host, port, database, user, password, ssl: input.ssl === true };
}

export async function createDatabase(config) {
  if (config.type === 'sqlite') {
    const SQL = await initSqlJs({ locateFile: (file) => path.join(sqlWasmDir, file) });
    let db;
    try { db = new SQL.Database(new Uint8Array(await readFile(config.filename))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; db = new SQL.Database(); }
    db.run('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)');
    let flushTimer;
    const persist = async () => {
      await mkdir(path.dirname(config.filename), { recursive: true });
      const temp = `${config.filename}.tmp`;
      await writeFile(temp, Buffer.from(db.export()), { mode: 0o600 });
      await rename(temp, config.filename);
    };
    return {
      async load() {
        const result = db.exec('SELECT payload FROM app_state WHERE id = 1');
        return result[0]?.values?.[0]?.[0] ? JSON.parse(result[0].values[0][0]) : null;
      },
      async save(value) {
        db.run('INSERT OR REPLACE INTO app_state (id, payload) VALUES (1, ?)', [JSON.stringify(value)]);
        await mkdir(path.dirname(config.filename), { recursive: true });
        const temp = `${config.filename}.tmp`;
        await writeFile(temp, Buffer.from(db.export()), { mode: 0o600 });
        await rename(temp, config.filename);
      },
      async close() { db.close(); },
      async runSql(sql, params = []) {
        const stmt = db.prepare(sql);
        let columns = [];
        const values = [];
        try {
          stmt.bind(params);
          while (stmt.step()) values.push(stmt.get());
          columns = stmt.getColumnNames();
        } finally { stmt.free(); }
        if (!/^\s*(SELECT|PRAGMA)/i.test(sql)) {
          clearTimeout(flushTimer);
          flushTimer = setTimeout(() => { persist().catch(() => {}); }, 300);
        }
        return columns.length ? [{ columns, values }] : [];
      },
    };
  }

  if (config.type === 'mysql') {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({ host: config.host, port: config.port, database: config.database, user: config.user, password: config.password, ssl: config.ssl ? {} : undefined, connectTimeout: 10000, charset: 'utf8mb4' });
    try {
      await connection.execute('CREATE TABLE IF NOT EXISTS app_state (id TINYINT PRIMARY KEY, payload LONGTEXT NOT NULL)');
    } catch (error) { await connection.end(); throw error; }
    return {
      async load() { const [rows] = await connection.execute('SELECT payload FROM app_state WHERE id = 1'); return rows.length ? JSON.parse(rows[0].payload) : null; },
      async save(value) { await connection.execute('INSERT INTO app_state (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)', [JSON.stringify(value)]); },
      async close() { await connection.end(); },
    };
  }

  const { Pool } = require('pg');
  const pool = new Pool({ host: config.host, port: config.port, database: config.database, user: config.user, password: config.password, ssl: config.ssl ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 10000, max: 5 });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS app_state (id SMALLINT PRIMARY KEY, payload JSONB NOT NULL)');
  } catch (error) { await pool.end(); throw error; }
  return {
    async load() { const result = await pool.query('SELECT payload FROM app_state WHERE id = 1'); return result.rows[0]?.payload ?? null; },
    async save(value) { await pool.query('INSERT INTO app_state (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload', [JSON.stringify(value)]); },
    async close() { await pool.end(); },
  };
}
