// Run with: node --test tests/
// Checks the DEMO-01 filter rules, the fictional data and the "nothing leaves the page" promise.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DEMO = path.join(__dirname, '..', 'demo');
const data = require(path.join(DEMO, 'data.js'));
const L = require(path.join(DEMO, 'logic.js'));

const room = (id) => data.rooms.find((r) => r.id === id);
const example = () => L.cleanFilters({
  moveIn: data.meta.exampleFilters.moveIn,
  moveOut: data.meta.exampleFilters.moveOut,
  limit: String(data.meta.exampleFilters.limit)
}, data.meta.window).filters;

test('data: every room has the fields the screens rely on', () => {
  const ids = new Set();
  const BY = new Set(['owner', 'manager', 'staying', 'outgoing', 'previous', 'team']);
  const STATUS = new Set(['stated', 'reported', 'experience', 'estimate']);
  const checkSource = (src, where) => {
    assert.ok(BY.has(src.by), `${where}: unknown source "${src.by}"`);
    assert.ok(STATUS.has(src.status), `${where}: unknown status "${src.status}"`);
    assert.ok(L.isISODate(src.on), `${where}: source date "${src.on}"`);
  };

  for (const r of data.rooms) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.match(r.id, /^[a-z0-9]+$/, 'ids go into the URL hash');
    for (const k of ['area', 'title', 'flat']) assert.ok(r[k], `${r.id}: missing ${k}`);
    assert.equal(r.address, undefined, `${r.id}: exact addresses are never stored`);

    assert.ok(L.isISODate(r.dates.from), `${r.id}: dates.from`);
    if (r.dates.startBy) assert.ok(r.dates.startBy >= r.dates.from, `${r.id}: startBy before from`);
    if (r.dates.until) assert.ok(r.dates.until > r.dates.from, `${r.id}: until before from`);
    checkSource(r.dates.source, `${r.id} dates`);

    assert.ok(r.costs.length > 0, `${r.id}: no costs`);
    r.costs.forEach((c, i) => {
      if (c.source) checkSource(c.source, `${r.id} cost ${i}`);
      else assert.equal(L.costRange(c), null, `${r.id} cost ${i}: a known amount needs a source`);
      if (c.range) assert.ok(c.range[0] <= c.range[1], `${r.id} cost ${i}: range order`);
    });

    const p = r.people;
    assert.ok(p.staying || p.outgoing, `${r.id}: nobody can answer a question`);
    if (p.outgoing) {
      assert.equal(p.outgoing.name, undefined, `${r.id}: outgoing tenant names stay hidden`);
      assert.ok(L.isISODate(p.outgoing.leaves), `${r.id}: outgoing.leaves`);
    }
    assert.ok(['owner', 'manager'].includes(p.decides.kind), `${r.id}: who decides`);
    if (p.decides.confirmed) assert.ok(L.isISODate(p.decides.statedOn), `${r.id}: statedOn`);

    assert.ok(L.isISODate(r.note.on), `${r.id}: note date`);
    assert.ok(r.note.text.length > 40, `${r.id}: note text`);
    for (const h of r.note.history) {
      assert.ok(L.isISODate(h.on) && h.on < r.note.on, `${r.id}: history is older than the note`);
      assert.equal(h.by, undefined, `${r.id}: previous tenants stay anonymous`);
    }
    assert.ok(r.commute.lived || r.commute.estimate, `${r.id}: commute`);
  }
});

test('dates: stay length counts the move-out day', () => {
  assert.equal(L.stayMonths('2027-09-01', '2028-06-30'), 10);
  assert.equal(L.stayMonths('2027-09-01', '2028-08-31'), 12);
  const partial = L.stayMonths('2027-09-15', '2028-06-30');
  assert.ok(partial > 9.5 && partial < 9.6, `got ${partial}`);
  assert.equal(L.fmtMonths(10), '10 months');
  assert.equal(L.fmtMonths(partial), 'about 9.5 months');
  assert.equal(L.daysBetween('2027-09-01', '2027-09-15'), 14);
});

test('formatting', () => {
  assert.equal(L.fmtDate('2027-09-01'), '1 Sep 2027');
  assert.equal(L.fmtMoney(1300), '€1,300');
  assert.equal(L.fmtRange(770, 810), '€770–810');
  assert.equal(L.fmtRange(655, 655), '€655');
  assert.equal(L.fmtMinutes(20, 30), '20–30 min');
});

test('costs: all-in totals keep ranges and unknown lines', () => {
  assert.deepEqual(L.costTotals(room('r1')), { lo: 770, hi: 810, unknown: [] });
  const r5 = L.costTotals(room('r5'));
  assert.equal(r5.lo, 655);
  assert.deepEqual(r5.unknown, ['Power, gas, water']);
});

test('filters: input checks never hide rooms by mistake', () => {
  const win = data.meta.window;
  let res = L.cleanFilters({ moveIn: '2027-10-01', moveOut: '', limit: '' }, win);
  assert.equal(res.filters.moveIn, null);
  assert.match(res.errors.moveIn, /20 Aug to 20 Sep 2027/);

  res = L.cleanFilters({ moveIn: '2027-09-01', moveOut: '2027-08-30', limit: '' }, win);
  assert.equal(res.filters.moveOut, null);
  assert.ok(res.errors.moveOut);

  assert.equal(L.cleanFilters({ limit: '€ 800' }, win).filters.limit, 800);
  assert.ok(L.cleanFilters({ limit: 'abc' }, win).errors.limit);
  assert.ok(L.cleanFilters({ limit: '0' }, win).errors.limit);
  assert.ok(L.cleanFilters({ limit: '800,50' }, win).errors.limit);
  assert.equal(L.hasFilters(L.cleanFilters({}, win).filters), false);
});

test('filters: the example search gives 5 of 8 with reasons for the rest', () => {
  const f = example();
  const results = Object.fromEntries(data.rooms.map((r) => [r.id, L.evaluate(r, f)]));
  const matching = data.rooms.filter((r) => results[r.id].match).map((r) => r.id);
  assert.deepEqual(matching, ['r1', 'r3', 'r5', 'r6', 'r8']);

  const codes = (id, key) => results[id][key].map((x) => x.code);
  assert.deepEqual(codes('r1', 'warnings'), ['may-exceed']);
  assert.equal(L.describe(results.r1.warnings[0]), 'Could reach €810 in some months, €10 over your limit');
  assert.deepEqual(codes('r2', 'reasons'), ['over-limit']);
  assert.equal(results.r2.reasons[0].over, 97);
  assert.deepEqual(codes('r4', 'reasons'), ['starts-later', 'min-stay']);
  assert.equal(L.describe(results.r4.reasons[0]), 'Free only from 15 Sep 2027, 14 days after your move-in');
  assert.deepEqual(codes('r5', 'warnings'), ['unknown-costs']);
  assert.deepEqual(codes('r7', 'reasons'), ['starts-later', 'over-limit']);
  assert.deepEqual(codes('r8', 'warnings'), ['unconfirmed']);
});

test('filters: with nothing set every room is shown', () => {
  const f = L.cleanFilters({}, data.meta.window).filters;
  assert.ok(data.rooms.every((r) => L.evaluate(r, f).match));
});

test('filters: a late move-in is caught by the latest start date', () => {
  const f = L.cleanFilters({ moveIn: '2027-09-12' }, data.meta.window).filters;
  const ev = L.evaluate(room('r2'), f);
  assert.deepEqual(ev.reasons.map((x) => x.code), ['start-by']);
  assert.equal(L.describe(ev.reasons[0]), 'Needs someone to start by 5 Sep 2027, 7 days before your move-in');
});

test('commute: leave-by time for an 8:30 lecture', () => {
  const { lectureTime, bufferMinutes } = data.meta;
  assert.equal(L.leaveBy(room('r1'), lectureTime, bufferMinutes), '7:55');
  assert.equal(L.leaveBy(room('r6'), lectureTime, bufferMinutes), '7:25');
  assert.equal(L.leaveBy(room('r2'), lectureTime, bufferMinutes), '8:15');
});

test('sorting', () => {
  const ids = (by) => L.sortRooms(data.rooms, by).map((r) => r.id);
  assert.equal(ids('cost')[0], 'r8');
  assert.equal(ids('commute')[0], 'r2');
  assert.equal(ids('date')[0], 'r5');
  assert.equal(data.rooms[0].id, 'r1', 'sorting returns a copy');
});

test('notes: lineage lists the years the note was passed on', () => {
  assert.deepEqual(L.lineage(room('r1').note), [2025, 2026, 2027]);
  assert.deepEqual(L.lineage(room('r6').note), [2027]);
});

test('privacy: the demo sends, stores and loads nothing', () => {
  const app = fs.readFileSync(path.join(DEMO, 'app.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource']) {
    assert.ok(!app.includes(api), `app.js must not use ${api}`);
  }
  const html = fs.readFileSync(path.join(DEMO, 'index.html'), 'utf8');
  assert.ok(!/(?:src|href)="(?:https?:)?\/\//.test(html), 'index.html loads nothing from other sites');
  assert.match(html, /name="robots" content="noindex/);
  const css = fs.readFileSync(path.join(DEMO, 'styles.css'), 'utf8');
  assert.ok(!/@import|url\(/.test(css), 'styles.css loads no fonts or images');
});
