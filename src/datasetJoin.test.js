import test from 'node:test';
import assert from 'node:assert/strict';
import { joinDatasetRows } from './datasetJoin.js';

const customers = { connectionId: '', table: 'customers' };
const orders = { connectionId: '', table: 'orders' };
const data = {
  '::customers': [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
  '::orders': [{ cid: 1, amt: 10 }, { cid: 1, amt: 5 }, { cid: 3, amt: 7 }],
};

test('1:M: one customer row matches many orders; unmatched left rows are kept', () => {
  const link = { left: { ...customers, column: 'id' }, right: { ...orders, column: 'cid' }, cardinality: '1:M' };
  const { rows, warnings } = joinDatasetRows([customers, orders], [link], data);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]['customers.name'], 'A');
  assert.equal(rows[0]['orders.amt'], 10);
  assert.equal(rows[1]['orders.amt'], 5);
  assert.equal(rows[2]['customers.name'], 'B');
  assert.equal(rows[2]['orders.amt'], null);
  assert.deepEqual(warnings, []);
});

test('M:1: many orders map to one customer when the base is the orders table', () => {
  const link = { left: { ...orders, column: 'cid' }, right: { ...customers, column: 'id' }, cardinality: 'M:1' };
  const { rows, warnings } = joinDatasetRows([orders, customers], [link], data);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]['customers.name'], 'A');
  assert.equal(rows[2]['orders.amt'], 7);
  assert.equal(rows[2]['customers.name'], null);
  assert.deepEqual(warnings, []);
});

test('warns when the one side of a 1:M link has duplicate keys', () => {
  const dup = { '::customers': [{ id: 1, name: 'A' }, { id: 1, name: 'A2' }], '::orders': data['::orders'] };
  const link = { left: { ...customers, column: 'id' }, right: { ...orders, column: 'cid' }, cardinality: '1:M' };
  const { warnings } = joinDatasetRows([customers, orders], [link], dup);
  assert.equal(warnings.length, 1);
});

test('without links the tables are stacked', () => {
  const { rows } = joinDatasetRows([customers, orders], [], data);
  assert.equal(rows.length, 5);
});

test('four tables in a chain are joined in order', () => {
  const items = { connectionId: '', table: 'items' };
  const shops = { connectionId: '', table: 'shops' };
  const tables = {
    '::customers': [{ id: 1, name: 'A' }],
    '::orders': [{ id: 50, cid: 1 }],
    '::items': [{ id: 500, oid: 50, sku: 'X' }],
    '::shops': [{ id: 9, sku: 'X', city: 'Bangkok' }],
  };
  const links = [
    { left: { ...customers, column: 'id' }, right: { ...orders, column: 'cid' }, cardinality: '1:M' },
    { left: { ...orders, column: 'id' }, right: { ...items, column: 'oid' }, cardinality: '1:M' },
    { left: { ...items, column: 'sku' }, right: { ...shops, column: 'sku' }, cardinality: 'M:1' },
  ];
  const { rows, warnings } = joinDatasetRows([customers, orders, items, shops], links, tables);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['customers.name'], 'A');
  assert.equal(rows[0]['items.sku'], 'X');
  assert.equal(rows[0]['shops.city'], 'Bangkok');
  assert.deepEqual(warnings, []);
});

test('a star of three tables around one base table', () => {
  const items = { connectionId: '', table: 'items' };
  const tables = {
    '::customers': [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    '::orders': [{ cid: 1, amt: 10 }],
    '::items': [{ cid: 2, qty: 3 }],
  };
  const links = [
    { left: { ...customers, column: 'id' }, right: { ...orders, column: 'cid' }, cardinality: '1:M' },
    { left: { ...customers, column: 'id' }, right: { ...items, column: 'cid' }, cardinality: '1:M' },
  ];
  const { rows } = joinDatasetRows([customers, orders, items], links, tables);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['orders.amt'], 10);
  assert.equal(rows[0]['items.qty'], null);
  assert.equal(rows[1]['items.qty'], 3);
});

test('tables with the same name from different connections keep separate columns', () => {
  const csvOrders = { connectionId: '', table: 'orders' };
  const dbOrders = { connectionId: 'conn1', table: 'orders' };
  const tables = {
    '::orders': [{ id: 1, total: 100 }],
    'conn1::orders': [{ id: 1, total: 999 }],
  };
  const link = { left: { ...csvOrders, column: 'id' }, right: { ...dbOrders, column: 'id' }, cardinality: '1:1' };
  const { rows } = joinDatasetRows([csvOrders, dbOrders], [link], tables);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['orders (local).total'], 100);
  assert.equal(rows[0]['orders (conn1).total'], 999);
});

test('a table without a link is rejected', () => {
  const link = { left: { ...customers, column: 'id' }, right: { ...orders, column: 'cid' }, cardinality: '1:M' };
  const third = { connectionId: '', table: 'extra' };
  assert.throws(() => joinDatasetRows([customers, orders, third], [link], data), /linked/);
});
