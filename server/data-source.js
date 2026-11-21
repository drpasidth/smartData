import { Client } from 'pg';
import mysql from 'mysql2/promise';
import { inspectCsvTable, listCsvTables } from './csv-import.js';

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_$]{0,127}$/;

function parseConnectionUrl(type, input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Enter a valid connection URL (maximum 2048 characters).');
  let url;
  try { url = new URL(input); } catch { throw new Error('Enter a valid database connection URL.'); }
  const protocols = type === 'postgresql' ? ['postgres:', 'postgresql:'] : type === 'mysql' ? ['mysql:'] : [];
  if (!protocols.includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) {
    throw new Error(`Enter a complete ${type === 'postgresql' ? 'PostgreSQL' : 'MySQL'} URL including host, database, and username.`);
  }
  if (url.hash) throw new Error('Connection URLs must not contain a fragment.');
  return url;
}

function safeError(error, url) {
  let message = error?.message || 'Unknown database error.';
  for (const secret of [url.password, decodeURIComponent(url.password || '')]) {
    if (secret) message = message.replaceAll(secret, '••••');
  }
  return message.slice(0, 400);
}

function validateTable(table, tables) {
  if (typeof table !== 'string' || !TABLE_NAME.test(table) || !tables.includes(table)) {
    throw new Error('Choose a table from the connected database.');
  }
}

function newestDateColumn(columns) {
  const dateColumns = columns.filter((column) => /date|time|timestamp|year/i.test(column.type));
  // Prefer familiar event/update timestamps when a table has multiple date fields.
  return dateColumns.sort((a, b) => {
    const score = (name) => /updated|modified|created|timestamp|date|time/i.test(name) ? 1 : 0;
    return score(b.name) - score(a.name);
  })[0]?.name;
}

// Optional max-rows setting from the client. Returns null (no limit) or an integer 1..10000.
export function parseRowLimit(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error('Row limit must be a whole number from 1 to 10000.');
  return n;
}

export async function inspectDataSource({ type, connectionUrl, table, database, limit }) {
  const rowLimit = parseRowLimit(limit);
  const limitSql = rowLimit ? ` LIMIT ${rowLimit}` : '';
  if (type === 'csv') {
    if (!database) throw new Error('CSV data source requires a local database connection.');
    if (!table) {
      const tables = await listCsvTables(database);
      return { ok: true, message: 'CSV tables available.', tables };
    }
    if (!TABLE_NAME.test(table)) throw new Error('Invalid table name.');
    const result = await inspectCsvTable(database, table, rowLimit || 1000);
    return { ok: true, message: `CSV table "${table}" loaded.`, table, columns: result.columns, rows: result.rows };
  }

  const url = parseConnectionUrl(type, connectionUrl);
  if (type === 'postgresql') {
    const clientOptions = { connectionString: url.toString(), connectionTimeoutMillis: 10000, query_timeout: 10000, statement_timeout: 10000 };
    // Do not pass `ssl: undefined`: pg treats an explicitly supplied SSL option as
    // overriding SSL settings parsed from the URL (for example sslmode=require).
    if (url.searchParams.get('ssl') === 'true') clientOptions.ssl = { rejectUnauthorized: false };
    const client = new Client(clientOptions);
    try {
      await client.connect();
      const listing = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 200");
      const tables = listing.rows.map((row) => row.table_name).filter((name) => TABLE_NAME.test(name));
      if (!table) return { ok: true, message: 'PostgreSQL connection successful.', tables };
      validateTable(table, tables);
      const metadata = await client.query(
        'SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
        ['public', table],
      );
      const dateColumn = newestDateColumn(metadata.rows);
      // Load the complete table, with the newest records first when a date/time
      // column is available.
      const order = dateColumn ? ` ORDER BY "${dateColumn.replaceAll('"', '""')}" DESC NULLS LAST` : '';
      const result = await client.query(`SELECT * FROM public."${table}"${order}${limitSql}`);
      return { ok: true, message: 'PostgreSQL connection successful.', tables, table, columns: result.fields.map((field) => field.name), rows: result.rows };
    } catch (error) { throw new Error(`PostgreSQL connection failed: ${safeError(error, url)}`); }
    finally { await client.end().catch(() => {}); }
  }

  if (type === 'mysql') {
    const connection = await mysql.createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: url.searchParams.get('ssl') === 'true' ? {} : undefined,
      connectTimeout: 10000,
      multipleStatements: false,
      charset: 'utf8mb4',
    }).catch((error) => { throw new Error(`MySQL connection failed: ${safeError(error, url)}`); });
    try {
      const [listing] = await connection.query('SHOW TABLES');
      const tables = listing.map((row) => Object.values(row)[0]).filter((name) => typeof name === 'string' && TABLE_NAME.test(name)).slice(0, 200);
      if (!table) return { ok: true, message: 'MySQL connection successful.', tables };
      validateTable(table, tables);
      const [metadata] = await connection.query(
        'SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION',
        [table],
      );
      const dateColumn = newestDateColumn(metadata);
      const order = dateColumn ? ` ORDER BY \`${dateColumn.replaceAll('`', '``')}\` DESC` : '';
      const [rows, fields] = await connection.query(`SELECT * FROM \`${table}\`${order}${limitSql}`);
      return { ok: true, message: 'MySQL connection successful.', tables, table, columns: fields.map((field) => field.name), rows };
    } catch (error) { throw new Error(`MySQL connection failed: ${safeError(error, url)}`); }
    finally { await connection.end().catch(() => {}); }
  }
  throw new Error('Choose PostgreSQL or MySQL.');
}
