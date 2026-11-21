// Joins the rows of a multi-table dataset. Pure functions, no network access.
// A dataset with no links stacks its tables (the original behaviour).
// A dataset with links joins its tables; joined columns are named "table.column".

export const CARDINALITIES = ['1:1', '1:M', 'M:1'];
export const MAX_JOINED_ROWS = 200000;

export const sourceKey = (source) => `${source.connectionId || ''}::${source.table}`;
const sameEnd = (end, source) => sourceKey(end) === sourceKey(source);
const keyOf = (value) => (value === null || value === undefined || value === '' ? null : String(value));

// Column prefix for a source. Normally the table name; when two sources share a table name
// (e.g. "orders" from a CSV and from a saved database) the connection is added so their columns do not overwrite each other.
function aliasFor(sources) {
  const counts = {};
  sources.forEach((s) => { counts[s.table] = (counts[s.table] || 0) + 1; });
  return (source) => (counts[source.table] > 1 ? `${source.table} (${source.connectionId || 'local'})` : source.table);
}

function isUniqueOn(rows, column) {
  const seen = new Set();
  for (const row of rows) {
    const key = keyOf(row[column]);
    if (key === null) continue;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

// sources: [{connectionId, table}], links: [{left:{table,column,...}, right:{...}, cardinality}]
// rowsBySource: { [sourceKey]: rows }. Returns { rows, warnings }.
export function joinDatasetRows(sources, links, rowsBySource) {
  const warnings = [];
  if (!sources.length) return { rows: [], warnings };
  const rowsOf = (source) => rowsBySource[sourceKey(source)] || [];
  if (!links.length) return { rows: sources.flatMap(rowsOf), warnings };

  // "1" side of a link must hold unique keys: left for 1:1 and 1:M, right for 1:1 and M:1.
  for (const link of links) {
    if (link.cardinality !== 'M:1' && !isUniqueOn(rowsOf(link.left), link.left.column)) {
      warnings.push(`${link.left.table}.${link.left.column} is not unique, but the link is ${link.cardinality}.`);
    }
    if (link.cardinality !== '1:M' && !isUniqueOn(rowsOf(link.right), link.right.column)) {
      warnings.push(`${link.right.table}.${link.right.column} is not unique, but the link is ${link.cardinality}.`);
    }
  }

  const alias = aliasFor(sources);
  const prefix = (source, row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [`${alias(source)}.${k}`, v]));
  const columnsOfSource = (source) => {
    const cols = new Set();
    rowsOf(source).forEach((row) => Object.keys(row).forEach((c) => cols.add(c)));
    return [...cols];
  };

  const joined = new Set([sourceKey(sources[0])]);
  let current = rowsOf(sources[0]).map((row) => prefix(sources[0], row));
  const pending = sources.slice(1);

  while (pending.length) {
    let pick = null;
    for (const source of pending) {
      const link = links.find((l) => (joined.has(sourceKey(l.left)) && sameEnd(l.right, source))
        || (joined.has(sourceKey(l.right)) && sameEnd(l.left, source)));
      if (link) { pick = { source, link }; break; }
    }
    if (!pick) throw new Error('Every table in a joined dataset must be linked to the others.');

    const { source: next, link } = pick;
    pending.splice(pending.indexOf(next), 1);
    const newIsRight = sameEnd(link.right, next);
    const joinEnd = newIsRight ? link.left : link.right;
    const newEnd = newIsRight ? link.right : link.left;

    // Index the new table by its key; left join keeps unmatched rows with nulls.
    const index = new Map();
    for (const row of rowsOf(next)) {
      const key = keyOf(row[newEnd.column]);
      if (key === null) continue;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(prefix(next, row));
    }
    const blank = Object.fromEntries(columnsOfSource(next).map((c) => [`${alias(next)}.${c}`, null]));
    const joinColumn = `${alias(joinEnd)}.${joinEnd.column}`;

    const out = [];
    for (const row of current) {
      const matches = index.get(keyOf(row[joinColumn]));
      if (!matches) { out.push({ ...blank, ...row }); continue; }
      for (const match of matches) {
        out.push({ ...row, ...match });
        if (out.length > MAX_JOINED_ROWS) {
          throw new Error(`The joined dataset has more than ${MAX_JOINED_ROWS} rows. Use a more selective link.`);
        }
      }
    }
    current = out;
    joined.add(sourceKey(next));
  }
  return { rows: current, warnings };
}
