import { readFile } from 'node:fs/promises';

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_$]{0,127}$/;

// Tables created by older imports have an auto-increment primary key named "id".
// Only that internal key is hidden; a CSV column named "id" is ordinary data.
const isInternalId = (col) => col.pk && col.name === 'id';

function normalizeTableName(filename) {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base || !TABLE_NAME.test(base)) return 'csv_import';
  return `csv_${base}`;
}

function normalizeColumnName(header, index) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `column_${index + 1}`;
}

function inferSqlType(values) {
  let allInteger = true;
  let allNumeric = true;
  let allDate = true;

  for (const value of values) {
    if (value === '' || value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;

    if (!/^[+-]?\d+$/.test(text)) allInteger = false;
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text.replace(/[$,%]/g, ''))) allNumeric = false;

    const date = new Date(text);
    if (isNaN(date.getTime()) || !/\d{4}/.test(text)) allDate = false;
  }

  if (allDate) return 'TEXT';
  if (allInteger) return 'INTEGER';
  if (allNumeric) return 'REAL';
  return 'TEXT';
}

function parseCsvText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The CSV file is empty.');

  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === ',') {
      record.push(field.trim());
      field = '';
      quoteClosed = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field.trim());
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
      field = '';
      quoteClosed = false;
    } else if (character === '"') {
      if (field.trim() || quoteClosed) throw new Error('Unexpected quote in an unquoted CSV field.');
      field = '';
      quoted = true;
    } else {
      if (quoteClosed && !/\s/.test(character)) throw new Error('Unexpected text after a quoted CSV field.');
      if (!quoteClosed) field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
  record.push(field.trim());
  if (record.some((value) => value !== '')) records.push(record);

  if (records.length < 2) throw new Error('The CSV needs a header and at least one row.');

  const headers = records[0].map((header, index) => normalizeColumnName(header, index));
  if (headers.every((header) => /^column_\d+$/.test(header))) throw new Error('The CSV header row is empty.');

  // Deduplicate headers
  const keys = [];
  const usedKeys = new Set();
  headers.forEach((header, index) => {
    let key = header;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${header}_${suffix++}`;
    usedKeys.add(key);
    keys.push(key);
  });

  const rows = records.slice(1).map((cells) => {
    const row = {};
    keys.forEach((key, columnIndex) => {
      if (columnIndex < cells.length) row[key] = cells[columnIndex] !== undefined ? cells[columnIndex] : '';
    });
    return row;
  });

  return { columns: keys, rows };
}

export async function importCsvToDatabase(database, filename, fileBuffer) {
  const text = Buffer.from(fileBuffer).toString('utf8').replace(/^\uFEFF/, '');
  const { columns, rows } = parseCsvText(text);
  const tableName = normalizeTableName(filename);

  // Build column type definitions by sampling values
  const columnDefs = [];
  for (const column of columns) {
    const sampleValues = rows.map((row) => row[column]).filter((v) => v !== '' && v !== null && v !== undefined).slice(0, 100);
    const sqlType = inferSqlType(sampleValues);
    columnDefs.push(`"${column}" ${sqlType}`);
  }

  // Drop existing table if it exists, then create fresh
  await database.runSql(`DROP TABLE IF EXISTS "${tableName}"`);
  // No extra key column: SQLite's implicit rowid keeps the row order.
  await database.runSql(`CREATE TABLE "${tableName}" (${columnDefs.join(', ')})`);

  // Insert rows
  for (const row of rows) {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const quotedKeys = keys.map((k) => `"${k}"`).join(', ');
    const values = keys.map((k) => {
      const v = row[k];
      if (v === '' || v === null || v === undefined) return null;
      return v;
    });
    await database.runSql(`INSERT INTO "${tableName}" (${quotedKeys}) VALUES (${placeholders})`, values);
  }

  // Verify row count
  const countResult = await database.runSql(`SELECT COUNT(*) AS cnt FROM "${tableName}"`);
  const rowCount = countResult[0]?.values?.[0]?.[0] ?? rows.length;

  return {
    table: tableName,
    columns,
    rowCount,
    message: `Imported ${rowCount} rows from ${filename} into table "${tableName}".`,
  };
}

export async function listCsvTables(database) {
  try {
    const result = await database.runSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'csv_%' ORDER BY name",
    );
    const tables = (result[0]?.values || []).map((row) => row[0]);
    return tables;
  } catch {
    return [];
  }
}

export async function listDatabaseTables(database) {
  try {
    const result = await database.runSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'csv\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name <> 'app_state' ORDER BY name",
    );
    return (result[0]?.values || []).map((row) => row[0]);
  } catch {
    return [];
  }
}

export async function deleteStoredTable(database, tableName) {
  if (!TABLE_NAME.test(tableName)) throw new Error('Invalid table name.');
  const allowed = [...(await listCsvTables(database)), ...(await listDatabaseTables(database))];
  if (!allowed.includes(tableName)) throw new Error('Table not found.');
  await database.runSql(`DROP TABLE IF EXISTS "${tableName}"`);
  return { table: tableName, message: `Deleted table "${tableName}".` };
}

export async function inspectCsvTable(database, tableName, limit = 1000) {
  if (!TABLE_NAME.test(tableName)) throw new Error('Invalid table name.');

  const columnsResult = await database.runSql(`PRAGMA table_info("${tableName}")`);
  const allColumns = (columnsResult[0]?.values || []).map((row) => ({ name: row[1], type: row[2], pk: row[5] }));
  const columns = allColumns.filter((col) => !isInternalId(col));

  // `limit` is validated as an integer by the caller (see parseRowLimit).
  const rowsResult = await database.runSql(`SELECT * FROM "${tableName}" ORDER BY rowid ASC LIMIT ${Number(limit)}`);
  const rows = (rowsResult[0]?.values || []).map((row) => {
    const obj = {};
    allColumns.forEach((col, index) => { if (!isInternalId(col)) obj[col.name] = row[index]; });
    return obj;
  });

  const countResult = await database.runSql(`SELECT COUNT(*) AS cnt FROM "${tableName}"`);
  const rowCount = countResult[0]?.values?.[0]?.[0] ?? rows.length;

  return { table: tableName, columns: columns.map((c) => c.name), rows, rowCount };
}

export async function convertCsvTableToDatabase(database, sourceTable, targetTableName) {
  if (!TABLE_NAME.test(sourceTable)) throw new Error('Invalid source table name.');
  if (!TABLE_NAME.test(targetTableName)) throw new Error('Invalid target table name.');
  if (targetTableName.toLowerCase().startsWith('csv_')) throw new Error('Target table name must not start with "csv_".');

  // Check source table exists
  const columnsResult = await database.runSql(`PRAGMA table_info("${sourceTable}")`);
  const columns = (columnsResult[0]?.values || []).map((row) => ({ name: row[1], type: row[2], pk: row[5] }));
  if (!columns.length) throw new Error('Source table not found.');

  // Get column definitions (skip the internal auto-increment id of older imports)
  const columnDefs = columns
    .filter((col) => !isInternalId(col))
    .map((col) => `"${col.name}" ${col.type || 'TEXT'}`)
    .join(', ');

  if (!columnDefs) throw new Error('Source table has no columns to convert.');

  // Drop existing target if present, then create fresh
  await database.runSql(`DROP TABLE IF EXISTS "${targetTableName}"`);
  await database.runSql(`CREATE TABLE "${targetTableName}" (${columnDefs})`);

  // Copy data (skip id column)
  const columnNames = columns.filter((col) => !isInternalId(col)).map((col) => `"${col.name}"`).join(', ');
  const placeholders = columns.filter((col) => !isInternalId(col)).map(() => '?').join(', ');
  const rowsResult = await database.runSql(`SELECT ${columnNames} FROM "${sourceTable}"`);
  const rows = rowsResult[0]?.values || [];

  for (const row of rows) {
    await database.runSql(`INSERT INTO "${targetTableName}" (${columnNames}) VALUES (${placeholders})`, row);
  }

  const countResult = await database.runSql(`SELECT COUNT(*) AS cnt FROM "${targetTableName}"`);
  const rowCount = countResult[0]?.values?.[0]?.[0] ?? rows.length;

  return {
    table: targetTableName,
    sourceTable,
    columns: columns.filter((col) => !isInternalId(col)).map((col) => col.name),
    rowCount,
    message: `Converted ${rowCount} rows from "${sourceTable}" to table "${targetTableName}".`,
  };
}
