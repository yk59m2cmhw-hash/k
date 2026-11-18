/*
 * Keys to Milan · DEMO-01 logic
 * Pure functions: dates, money, all-in totals and the filter rules.
 * No DOM access, so tests/logic.test.js can run them in Node.
 */
(function (root) {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DAY_MS = 86400000;

  // ---------- dates ('YYYY-MM-DD' strings, compared as UTC days) ----------

  function isISODate(s) {
    if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function toDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toISO(dt) {
    return dt.toISOString().slice(0, 10);
  }

  function addDays(s, n) {
    const dt = toDate(s);
    dt.setUTCDate(dt.getUTCDate() + n);
    return toISO(dt);
  }

  function daysBetween(a, b) {
    return Math.round((toDate(b) - toDate(a)) / DAY_MS);
  }

  function addMonths(dt, n) {
    const first = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dt.getUTCDate(), lastDay)));
  }

  // Length of a stay in months, counting the move-out day itself:
  // 1 Sep 2027 to 30 Jun 2028 is exactly 10 months.
  function stayMonths(moveIn, moveOut) {
    const start = toDate(moveIn);
    const end = toDate(addDays(moveOut, 1));
    if (end <= start) return 0;
    let whole = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    let anchor = addMonths(start, whole);
    while (anchor > end) {
      whole -= 1;
      anchor = addMonths(start, whole);
    }
    const next = addMonths(start, whole + 1);
    return whole + (end - anchor) / (next - anchor);
  }

  // ---------- formatting ----------

  function fmtDate(s) {
    if (!s) return '';
    const dt = toDate(s);
    return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();
  }

  function fmtDayMonth(s) {
    if (!s) return '';
    const dt = toDate(s);
    return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()];
  }

  function fmtMonthYear(s) {
    if (!s) return '';
    const dt = toDate(s);
    return MONTHS[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();
  }

  function groupDigits(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtMoney(n) {
    return '€' + groupDigits(n);
  }

  function fmtRange(lo, hi) {
    return lo === hi ? fmtMoney(lo) : fmtMoney(lo) + '–' + groupDigits(hi);
  }

  function fmtMonths(m) {
    const exact = Math.round(m);
    if (Math.abs(m - exact) < 0.02) return exact + (exact === 1 ? ' month' : ' months');
    return 'about ' + (Math.round(m * 2) / 2) + ' months';
  }

  function fmtMinutes(min, max) {
    return min === max ? min + ' min' : min + '–' + max + ' min';
  }

  // ---------- costs ----------

  // [low, high] per month for one cost line, or null when it is unknown.
  function costRange(c) {
    if (typeof c.amount === 'number') return [c.amount, c.amount];
    if (Array.isArray(c.range) && c.range.length === 2) return [c.range[0], c.range[1]];
    return null;
  }

  // All-in monthly total: the sum of every known line, plus the labels of unknown ones.
  function costTotals(room) {
    let lo = 0;
    let hi = 0;
    const unknown = [];
    room.costs.forEach((c) => {
      const r = costRange(c);
      if (!r) {
        unknown.push(c.label);
        return;
      }
      lo += r[0];
      hi += r[1];
    });
    return { lo, hi, unknown };
  }

  // ---------- commute ----------

  // What living there is like beats the route planner when both exist.
  function commuteRange(room) {
    const c = room.commute || {};
    if (c.lived) return { min: c.lived.min, max: c.lived.max, basis: 'lived' };
    if (c.estimate) return { min: c.estimate.minutes, max: c.estimate.minutes, basis: 'estimate' };
    return null;
  }

  // Latest sensible departure for a lecture: the slowest known trip plus a buffer,
  // rounded down to 5 minutes. '08:30', 30 min, 5 min buffer -> '7:55'.
  function leaveBy(room, lectureTime, bufferMinutes) {
    const r = commuteRange(room);
    if (!r) return null;
    const [h, m] = lectureTime.split(':').map(Number);
    let t = h * 60 + m - r.max - (bufferMinutes || 0);
    t = Math.floor(t / 5) * 5;
    const hh = Math.floor(t / 60);
    const mm = t % 60;
    return hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  // ---------- filters ----------

  // Turns raw form values into usable filters. A field with an error is left unset,
  // so a typo never hides rooms silently.
  function cleanFilters(raw, win) {
    const errors = {};
    const f = { moveIn: null, moveOut: null, limit: null };
    const moveIn = (raw.moveIn || '').trim();
    const moveOut = (raw.moveOut || '').trim();
    const limit = String(raw.limit == null ? '' : raw.limit).trim();

    if (moveIn) {
      if (!isISODate(moveIn)) errors.moveIn = 'Enter a full date.';
      else if (moveIn < win.from || moveIn > win.to) {
        errors.moveIn = 'Pick a date from ' + fmtDayMonth(win.from) + ' to ' + fmtDate(win.to) + '. The demo covers one move-in window.';
      } else f.moveIn = moveIn;
    }

    if (moveOut) {
      const after = f.moveIn || win.from;
      if (!isISODate(moveOut)) errors.moveOut = 'Enter a full date.';
      else if (moveOut <= after) errors.moveOut = f.moveIn ? 'Move-out has to be after move-in.' : 'Move-out has to be after ' + fmtDate(win.from) + '.';
      else f.moveOut = moveOut;
    }

    if (limit) {
      const digits = limit.replace(/^€\s*/, '').replace(/\s+/g, '');
      if (!/^\d{1,5}$/.test(digits) || Number(digits) === 0) {
        errors.limit = 'Enter a whole number of euros, for example 800.';
      } else f.limit = Number(digits);
    }

    return { filters: f, errors };
  }

  function hasFilters(f) {
    return Boolean(f.moveIn || f.moveOut || f.limit != null);
  }

  // Reasons hide a room. Warnings keep it in the list but flag what to check.
  function evaluate(room, f) {
    const reasons = [];
    const warnings = [];
    const d = room.dates;

    if (f.moveIn) {
      if (f.moveIn < d.from) {
        reasons.push({ code: 'starts-later', kind: 'dates', from: d.from, days: daysBetween(f.moveIn, d.from) });
      } else if (d.startBy && f.moveIn > d.startBy) {
        reasons.push({ code: 'start-by', kind: 'dates', startBy: d.startBy, days: daysBetween(d.startBy, f.moveIn) });
      }
    }
    if (f.moveOut && d.until && f.moveOut > d.until) {
      reasons.push({ code: 'ends-earlier', kind: 'dates', until: d.until });
    }
    if (f.moveIn && f.moveOut && d.minMonths) {
      const months = stayMonths(f.moveIn, f.moveOut);
      if (months < d.minMonths - 0.01) {
        reasons.push({ code: 'min-stay', kind: 'dates', minMonths: d.minMonths, months });
      }
    }

    const totals = costTotals(room);
    if (f.limit != null) {
      if (totals.lo > f.limit) {
        reasons.push({ code: 'over-limit', kind: 'cost', over: totals.lo - f.limit });
      } else if (totals.hi > f.limit) {
        warnings.push({ code: 'may-exceed', kind: 'cost', hi: totals.hi, over: totals.hi - f.limit });
      }
    }
    if (totals.unknown.length) {
      warnings.push({ code: 'unknown-costs', kind: 'cost', items: totals.unknown });
    }
    if (d.source && d.source.status !== 'stated') {
      warnings.push({ code: 'unconfirmed', kind: 'dates' });
    }

    return { match: reasons.length === 0, reasons, warnings, totals };
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  // Plain-English text for a reason or a warning.
  function describe(r) {
    switch (r.code) {
      case 'starts-later':
        return 'Free only from ' + fmtDate(r.from) + ', ' + plural(r.days, 'day', 'days') + ' after your move-in';
      case 'start-by':
        return 'Needs someone to start by ' + fmtDate(r.startBy) + ', ' + plural(r.days, 'day', 'days') + ' before your move-in';
      case 'ends-earlier':
        return 'Available only until ' + fmtDate(r.until);
      case 'min-stay':
        return 'Minimum stay ' + r.minMonths + ' months. Yours is ' + fmtMonths(r.months);
      case 'over-limit':
        return fmtMoney(r.over) + ' over your limit, even in the cheapest month';
      case 'may-exceed':
        return 'Could reach ' + fmtMoney(r.hi) + ' in some months, ' + fmtMoney(r.over) + ' over your limit';
      case 'unknown-costs':
        return 'Not known yet: ' + r.items.map((s) => s.toLowerCase()).join('; ');
      case 'unconfirmed':
        return 'Dates and terms not confirmed by the owner';
      default:
        return '';
    }
  }

  // ---------- ordering ----------

  const SORT_KEYS = {
    cost: (room) => {
      const t = costTotals(room);
      return [t.hi, t.lo];
    },
    commute: (room) => {
      const c = commuteRange(room);
      return c ? [c.max, c.min] : [Infinity, Infinity];
    },
    date: (room) => [toDate(room.dates.from).getTime()]
  };

  function sortRooms(rooms, by) {
    const key = SORT_KEYS[by] || SORT_KEYS.cost;
    return rooms
      .map((room, i) => ({ room, k: key(room), i }))
      .sort((a, b) => {
        for (let j = 0; j < a.k.length; j++) {
          if (a.k[j] !== b.k[j]) return a.k[j] < b.k[j] ? -1 : 1;
        }
        return a.i - b.i;
      })
      .map((x) => x.room);
  }

  // ---------- notes ----------

  // Years in which the room's note was written or continued, oldest first.
  function lineage(note) {
    const years = (note.history || []).map((h) => Number(h.on.slice(0, 4)));
    years.push(Number(note.on.slice(0, 4)));
    return Array.from(new Set(years)).sort((a, b) => a - b);
  }

  const api = {
    isISODate, addDays, daysBetween, stayMonths,
    fmtDate, fmtDayMonth, fmtMonthYear, fmtMoney, fmtRange, fmtMonths, fmtMinutes,
    costRange, costTotals, commuteRange, leaveBy,
    cleanFilters, hasFilters, evaluate, describe, sortRooms, lineage
  };

  root.KTM_LOGIC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
