function parseRecords(text) {
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

    if (character === ',' ) {
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
  return records;
}

function normalizeHeader(header, index) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `column_${index + 1}`;
}

function parseValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const numericText = trimmed.replace(/[$,%\s,]/g, '');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) return numeric;
  }
  return trimmed;
}

export function parseCSV(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The CSV file is empty.');
  const records = parseRecords(text.replace(/^\uFEFF/, ''));
  if (records.length < 2) throw new Error('The CSV needs a header and at least one row.');

  const headers = records[0].map((header, index) => normalizeHeader(header, index));
  if (headers.every((header) => /^column_\d+$/.test(header))) throw new Error('The CSV header row is empty.');

  const dateIndex = headers.findIndex((header) => /^(date|datetime|timestamp|month|day|time)(_|$)|_(date|month|day|time)(_|$)/.test(header));
  const keys = [];
  const usedKeys = new Set();
  headers.forEach((header, index) => {
    const baseKey = index === dateIndex ? 'month' : header;
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${baseKey}_${suffix++}`;
    usedKeys.add(key);
    keys.push(key);
  });

  const rows = records.slice(1).map((cells, rowIndex) => {
    if (cells.length > headers.length && cells.slice(headers.length).some((value) => value !== '')) {
      throw new Error(`Row ${rowIndex + 2} has more values than the header row.`);
    }
    const row = {};
    keys.forEach((key, columnIndex) => {
      if (columnIndex < cells.length) row[key] = parseValue(cells[columnIndex]);
    });
    if (dateIndex < 0) row.month = cells[0]?.trim() || `Row ${rowIndex + 1}`;
    return row;
  });

  if (!rows.length) throw new Error('The CSV needs a header and at least one data row.');
  return rows;
}
