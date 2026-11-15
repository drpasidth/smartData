import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from './csv.js';

test('parses quoted commas, escaped quotes, and newlines', () => {
  const rows = parseCSV('name,notes,revenue\n"Acme, Inc.","Said ""hello""\nthen left","$1,250"\n');
  assert.deepEqual(rows, [{ name: 'Acme, Inc.', notes: 'Said "hello"\nthen left', revenue: 1250, month: 'Acme, Inc.' }]);
});

test('normalizes a BOM, duplicate headers, and date columns', () => {
  const rows = parseCSV('\uFEFFOrder Date,total,total\n2025-01-01,1,2\n');
  assert.deepEqual(rows, [{ month: '2025-01-01', total: 1, total_2: 2 }]);
});

test('retains empty values and ignores blank records', () => {
  assert.deepEqual(parseCSV('label,value\nalpha,\n\n'), [{ label: 'alpha', value: '', month: 'alpha' }]);
});

test('rejects malformed and header-only CSV input', () => {
  assert.throws(() => parseCSV('name,value\n"unfinished,1'), /unterminated quoted field/);
  assert.throws(() => parseCSV('name,value\n"quoted"oops,1'), /after a quoted CSV field/);
  assert.throws(() => parseCSV('name,value\n'), /header and at least one row/);
});
