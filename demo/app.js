/*
 * Keys to Milan · DEMO-01 app
 *
 * Renders the views and keeps all state in this page's memory.
 * Nothing is sent, stored or loaded from elsewhere: no fetch, no cookies,
 * no localStorage, no analytics. Reloading the page resets everything.
 */
(() => {
  'use strict';

  const D = window.KTM_DATA;
  const L = window.KTM_LOGIC;
  const META = D.meta;
  const WIN = META.window;
  const ROOMS = D.rooms;
  const ROOM_BY_ID = new Map(ROOMS.map((r) => [r.id, r]));
  const MAX_Q = META.maxQuestionLength;

  const view = document.getElementById('view');
  const live = document.getElementById('live');
  const fmt = L.fmtDate;

  // ---------- state: this page's memory only ----------

  const state = {
    raw: {
      moveIn: META.exampleFilters.moveIn,
      moveOut: META.exampleFilters.moveOut,
      limit: String(META.exampleFilters.limit)
    },
    usingExample: true,
    filtersOpen: false,
    sort: 'cost',
    showOthers: false,
    openHistory: new Set(),
    requests: new Map(), // roomId -> { to, topic, text, dates, savedAt }
    editing: new Set(),  // roomIds whose saved request is open in the form
    drafts: new Map(),   // roomId -> unsaved form values
    armedDelete: null,
    armedTimer: 0
  };

  // ---------- small helpers ----------

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const ICONS = {
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M17 6l2.5 2.5M14.5 8.5 17 11"/>',
    home: '<path d="M3.5 11.5 12 4.5l8.5 7"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    exit: '<path d="M13 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H13"/><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M5 12.5 10 17.5 19 7"/>',
    dash: '<path d="M7 12h10"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 4.5 3 19.5h18L12 4.5z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.7M12 17.2h.01"/>',
    note: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M9 12h7M9 15.5h7"/>'
  };

  const icon = (name, cls) => (
    `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`
  );

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  let announceTimer = 0;
  function announce(msg, delay) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      live.textContent = '';
      requestAnimationFrame(() => { live.textContent = msg; });
    }, delay || 0);
  }

  // ---------- roles and sources ----------

  const ROLES = [
    { cls: 'staying', icon: 'home', title: 'Staying tenant',
      text: 'Lives in the flat and stays on. Looking for a flatmate, so they care who moves in.' },
    { cls: 'outgoing', icon: 'exit', title: 'Outgoing tenant',
      text: 'Is leaving the room. Can leave a note and answer one question. Doesn’t decide who gets the room or on what terms.' },
    { cls: 'owner', icon: 'key', title: 'Owner or authorized manager',
      text: 'Decides availability and terms: who gets the room, from when and for how much.' },
    { cls: 'team', icon: 'calc', title: 'Team estimate',
      text: 'Our rough numbers, like route-planner times. A starting point, not a promise.' }
  ];

  const SOURCE_STYLE = {
    owner: ['owner', 'key'], manager: ['owner', 'key'],
    staying: ['staying', 'home'],
    outgoing: ['outgoing', 'exit'], previous: ['outgoing', 'exit'],
    team: ['team', 'calc']
  };

  const SOURCE_STATUS = {
    stated: 'stated',
    reported: 'not confirmed by the owner',
    experience: 'from experience',
    estimate: 'rough estimate'
  };

  function sourceWho(by, room) {
    const p = room.people;
    switch (by) {
      case 'owner': return 'Owner';
      case 'manager': return p.decides.label || 'Manager';
      case 'staying': return p.staying ? p.staying.name + ', staying' : 'Staying tenant';
      case 'outgoing': return 'Outgoing tenant';
      case 'previous': return 'Previous tenant';
      case 'team': return 'Team estimate';
      default: return 'Unknown';
    }
  }

  function sourceTag(src, room) {
    if (!src) {
      return `<span class="src src-unknown">${icon('help')}<span>No source yet. Worth asking.</span></span>`;
    }
    const [cls, ic] = SOURCE_STYLE[src.by] || ['team', 'info'];
    const status = src.by === 'team' ? '' : ` · <span class="src-status">${esc(SOURCE_STATUS[src.status] || src.status)}</span>`;
    return `<span class="src src-${cls}${src.status === 'reported' ? ' src-reported' : ''}">${icon(ic)}`
      + `<span><span class="src-who">${esc(sourceWho(src.by, room))}</span> · ${esc(fmt(src.on))}${status}</span></span>`;
  }

  // ---------- filters ----------

  const currentFilters = () => L.cleanFilters(state.raw, WIN);
  const countMatches = (f) => ROOMS.filter((r) => L.evaluate(r, f).match).length;

  function matchLabel(n, f) {
    if (!L.hasFilters(f)) return `Show all ${ROOMS.length} rooms`;
    if (n === 0) return 'No room matches. See why';
    return `Show ${plural(n, 'matching room', 'matching rooms')}`;
  }

  function summaryText(f) {
    const parts = [];
    if (f.moveIn && f.moveOut) parts.push(`${fmt(f.moveIn)} to ${fmt(f.moveOut)}`);
    else if (f.moveIn) parts.push(`Moving in ${fmt(f.moveIn)}`);
    else if (f.moveOut) parts.push(`Moving out ${fmt(f.moveOut)}`);
    if (f.limit != null) parts.push(`up to ${L.fmtMoney(f.limit)} a month, all-in`);
    return parts.length ? parts.join(' · ') : 'No dates or limit set';
  }

  function filterFields(errors) {
    const moveOutMin = L.isISODate(state.raw.moveIn) ? L.addDays(state.raw.moveIn, 1) : L.addDays(WIN.from, 1);
    const aria = (id, err) => `aria-describedby="f-${id}-hint f-${id}-err"${err ? ' aria-invalid="true"' : ''}`;
    const field = (id, label, input, hint, err) => `
      <div class="field">
        <label for="f-${id}">${label}</label>
        ${input}
        <p class="hint" id="f-${id}-hint">${hint}</p>
        <p class="error" id="f-${id}-err"${err ? '' : ' hidden'}>${icon('alert')}<span>${esc(err || '')}</span></p>
      </div>`;
    return `
      <div class="field-row">
        ${field('moveIn', 'Move in',
          `<input id="f-moveIn" name="moveIn" type="date" min="${WIN.from}" max="${WIN.to}" value="${esc(state.raw.moveIn)}" ${aria('moveIn', errors.moveIn)}>`,
          `${L.fmtDayMonth(WIN.from)} to ${fmt(WIN.to)}`, errors.moveIn)}
        ${field('moveOut', 'Move out',
          `<input id="f-moveOut" name="moveOut" type="date" min="${moveOutMin}" value="${esc(state.raw.moveOut)}" ${aria('moveOut', errors.moveOut)}>`,
          'The day you leave', errors.moveOut)}
      </div>
      ${field('limit', 'Monthly limit, all-in',
        `<div class="money"><span class="money-sign" aria-hidden="true">€</span><input id="f-limit" name="limit" type="text" inputmode="numeric" autocomplete="off" value="${esc(state.raw.limit)}" ${aria('limit', errors.limit)}></div>`,
        'Rent, building fees, bills, internet and waste tax together', errors.limit)}`;
  }

  function setFieldError(id, msg) {
    const input = document.getElementById('f-' + id);
    const err = document.getElementById('f-' + id + '-err');
    if (!input || !err) return;
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      err.querySelector('span').textContent = msg;
      err.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      err.hidden = true;
    }
  }

  // Updates everything that depends on the filters, without redrawing the inputs.
  function afterFiltersChanged() {
    const { filters, errors } = currentFilters();
    ['moveIn', 'moveOut', 'limit'].forEach((k) => setFieldError(k, errors[k]));
    const out = document.getElementById('f-moveOut');
    if (out) out.min = filters.moveIn ? L.addDays(filters.moveIn, 1) : L.addDays(WIN.from, 1);
    const flag = document.getElementById('exampleFlag');
    if (flag) flag.hidden = !state.usingExample;
    const label = document.getElementById('matchLabel');
    if (label) label.textContent = matchLabel(countMatches(filters), filters);
    const summary = document.getElementById('filterSummary');
    if (summary) summary.textContent = summaryText(filters);
    const box = document.getElementById('results');
    if (box) {
      const r = resultsHTML(filters);
      box.innerHTML = r.html;
      announce(r.countText, 700);
    }
  }

  function clearFilters() {
    state.raw = { moveIn: '', moveOut: '', limit: '' };
    state.usingExample = false;
    ['moveIn', 'moveOut', 'limit'].forEach((k) => {
      const el = document.getElementById('f-' + k);
      if (el) el.value = '';
    });
    afterFiltersChanged();
    announce(`Filters cleared. All ${ROOMS.length} rooms shown.`);
  }

  // ---------- shared bits ----------

  function costText(t) {
    const base = L.fmtRange(t.lo, t.hi);
    return t.unknown.length ? base + ' + ?' : base;
  }

  function commuteText(room) {
    const c = L.commuteRange(room);
    return c ? L.fmtMinutes(c.min, c.max) : 'Not known';
  }

  function flagList(items, tone) {
    if (!items.length) return '';
    const ic = tone === 'bad' ? 'x' : 'alert';
    return `<ul class="flags">${items.map((r) => (
      `<li class="flag flag-${tone}">${icon(ic)}<span>${esc(L.describe(r))}</span></li>`
    )).join('')}</ul>`;
  }

  function peopleChips(room) {
    const p = room.people;
    const chips = [];
    if (p.staying) chips.push(`<li class="chip chip-staying">${icon('home')}${esc(p.staying.name)}, staying</li>`);
    if (p.outgoing) chips.push(`<li class="chip chip-outgoing">${icon('exit')}Outgoing tenant</li>`);
    const who = p.decides.kind === 'manager' ? 'Agency' : 'Owner';
    chips.push(p.decides.confirmed
      ? `<li class="chip chip-owner">${icon('key')}${who} stated terms</li>`
      : `<li class="chip chip-owner chip-dashed">${icon('key')}${who} hasn’t confirmed</li>`);
    return chips.join('');
  }

  function snippet(s, n) {
    if (s.length <= n) return s;
    const cut = s.lastIndexOf(' ', n);
    return s.slice(0, cut > 0 ? cut : n).replace(/[.,;:]$/, '') + '…';
  }

  function crumb(href, label) {
    return `<nav class="crumbs" aria-label="Back"><a class="back" href="${href}">${icon('back')}<span>${esc(label)}</span></a></nav>`;
  }

  // ---------- view: start ----------

  function rolesLegend() {
    return `
      <section class="block" aria-labelledby="roles-h">
        <h2 id="roles-h">Who’s who in a room</h2>
        <ul class="intercom">
          ${ROLES.map((r) => `
            <li class="plate plate-${r.cls}">
              <span class="bell" aria-hidden="true">${icon(r.icon)}</span>
              <div class="plate-body">
                <p class="plate-role">${esc(r.title)}</p>
                <p class="plate-does">${esc(r.text)}</p>
              </div>
            </li>`).join('')}
        </ul>
      </section>`;
  }

  function demoLimits() {
    const items = [
      'Check people, rooms or facts. All of it is made up.',
      'Book or hold a room.',
      'Send your question. It stays in this tab.',
      'Arrange a viewing or a move-in.'
    ];
    return `
      <section class="block" aria-labelledby="limits-h">
        <h2 id="limits-h">What this demo doesn’t do</h2>
        <ul class="nots">${items.map((t) => `<li>${icon('x')}<span>${esc(t)}</span></li>`).join('')}</ul>
        <p><a href="#about">More about this demo</a></p>
      </section>`;
  }

  function viewStart() {
    const { filters, errors } = currentFilters();
    return `
      <div class="view view-start">
        <header class="hero">
          <p class="eyebrow">${esc(META.version)} · ${esc(META.campus)}</p>
          <h1 tabindex="-1">Find a room near Bocconi. Ask someone who lives there.</h1>
          <p class="lede">Private rooms for one notional move-in window, ${L.fmtDayMonth(WIN.from)} to ${fmt(WIN.to)}. Every room, person and note here is made up.</p>
        </header>
        <form class="panel" id="filtersForm" novalidate>
          <h2 class="panel-title">Your dates and limit</h2>
          ${filterFields(errors)}
          <p class="example-flag" id="exampleFlag"${state.usingExample ? '' : ' hidden'}>${icon('info')}<span>Example values. Change them to yours.</span></p>
          <div class="stack">
            <button class="btn btn-primary btn-block" type="submit"><span id="matchLabel">${esc(matchLabel(countMatches(filters), filters))}</span></button>
            <button class="btn btn-quiet btn-block" type="button" data-action="clear-filters">Clear and show all ${ROOMS.length}</button>
          </div>
        </form>
        ${rolesLegend()}
        ${demoLimits()}
      </div>`;
  }

  // ---------- view: rooms ----------

  function roomCard(room, ev, isOut) {
    const t = ev.totals;
    const req = state.requests.get(room.id);
    return `
      <li>
        <article class="room-card${isOut ? ' is-out' : ''}">
          <div class="rc-top">
            <div class="rc-place">
              <h3 class="rc-area"><a class="rc-link" href="#room-${room.id}">${esc(room.area)}</a></h3>
              <p class="rc-title">${esc(room.title)}</p>
            </div>
            <p class="rc-price"><span class="rc-amount">${costText(t)}</span><span class="rc-per">${t.unknown.length ? 'a month, some costs unknown' : 'a month, all-in'}</span></p>
          </div>
          <dl class="rc-facts">
            <div><dt>Free from</dt><dd>${fmt(room.dates.from)}</dd></div>
            <div><dt>To campus</dt><dd>${commuteText(room)}</dd></div>
          </dl>
          <ul class="chips" aria-label="People">${peopleChips(room)}</ul>
          ${isOut ? flagList(ev.reasons, 'bad') : flagList(ev.warnings, 'warn')}
          ${isOut ? '' : `<p class="rc-note">“${esc(snippet(room.note.text, 105))}” <span class="rc-note-meta">Note, ${L.fmtMonthYear(room.note.on)}</span></p>`}
          ${req ? `<p class="rc-req">${icon('mail')}<span>Your question is saved here. Not sent.</span></p>` : ''}
        </article>
      </li>`;
  }

  function resultsHTML(f) {
    const active = L.hasFilters(f);
    const rows = L.sortRooms(ROOMS, state.sort).map((room) => ({ room, ev: L.evaluate(room, f) }));
    const fit = rows.filter((x) => x.ev.match);
    const out = rows.filter((x) => !x.ev.match);
    const countText = active
      ? `${fit.length} of ${plural(ROOMS.length, 'room', 'rooms')} ${fit.length === 1 ? 'matches' : 'match'}`
      : `All ${ROOMS.length} rooms, no filters set`;
    let html = `<h2 class="count">${esc(countText)}</h2>`;
    if (fit.length) {
      html += `<ul class="room-list">${fit.map((x) => roomCard(x.room, x.ev, false)).join('')}</ul>`;
    } else {
      html += `<div class="callout callout-info">${icon('info')}<p>No room matches all of it. The rooms below miss on dates or cost, and each one says why.</p></div>`;
    }
    if (out.length) {
      const open = state.showOthers || fit.length === 0;
      html += `
        <section class="others">
          <h2 class="others-h">
            <button class="others-toggle" type="button" data-action="toggle-others" aria-expanded="${open}" aria-controls="othersList">
              <span>Don’t match your filters (${out.length})</span>${icon('chevron', 'chev')}
            </button>
          </h2>
          <ul class="room-list" id="othersList"${open ? '' : ' hidden'}>${out.map((x) => roomCard(x.room, x.ev, true)).join('')}</ul>
        </section>`;
    }
    return { html, countText };
  }

  function viewRooms() {
    const { filters, errors } = currentFilters();
    const open = state.filtersOpen || Object.keys(errors).length > 0;
    return `
      <div class="view view-rooms">
        ${crumb('#start', 'Start')}
        <header class="page-head">
          <h1 tabindex="-1">Rooms near Bocconi</h1>
          <p class="lede" id="filterSummary">${esc(summaryText(filters))}</p>
        </header>
        <div class="panel panel-tight">
          <button class="disclosure" type="button" data-action="toggle-filters" aria-expanded="${open}" aria-controls="filtersForm">
            <span>Change dates or limit</span>${icon('chevron', 'chev')}
          </button>
          <form id="filtersForm" class="filters-box stack" novalidate${open ? '' : ' hidden'}>
            ${filterFields(errors)}
            <button class="btn btn-quiet" type="button" data-action="clear-filters">Clear filters</button>
          </form>
        </div>
        <div class="sort-row">
          <label for="sortBy">Sort by</label>
          <select id="sortBy">
            <option value="cost"${state.sort === 'cost' ? ' selected' : ''}>Lowest all-in cost</option>
            <option value="commute"${state.sort === 'commute' ? ' selected' : ''}>Shortest commute</option>
            <option value="date"${state.sort === 'date' ? ' selected' : ''}>Earliest move-in</option>
          </select>
        </div>
        <div id="results">${resultsHTML(filters).html}</div>
      </div>`;
  }

  // ---------- view: room ----------

  function fitBox(ev, f) {
    const list = (items) => `<ul class="callout-list">${items.map((r) => `<li>${esc(L.describe(r))}</li>`).join('')}</ul>`;
    if (!L.hasFilters(f)) {
      if (!ev.warnings.length) return '';
      return `<div class="callout callout-warn">${icon('alert')}<div><p class="callout-title">Things to check</p>${list(ev.warnings)}</div></div>`;
    }
    if (!ev.match) {
      return `<div class="callout callout-bad">${icon('x')}<div><p class="callout-title">Doesn’t match your filters</p>${list(ev.reasons.concat(ev.warnings))}</div></div>`;
    }
    if (ev.warnings.length) {
      return `<div class="callout callout-warn">${icon('alert')}<div><p class="callout-title">Matches, with things to check</p>${list(ev.warnings)}</div></div>`;
    }
    return `<div class="callout callout-ok">${icon('check')}<div><p class="callout-title">Matches your dates and limit</p></div></div>`;
  }

  function plate(cls, ic, role, name, sub, does, extra) {
    return `
      <li class="plate plate-${cls}">
        <span class="bell" aria-hidden="true">${icon(ic)}</span>
        <div class="plate-body">
          <p class="plate-role">${role}</p>
          ${name ? `<p class="plate-name">${name}</p>` : ''}
          ${sub ? `<p class="plate-sub">${sub}</p>` : ''}
          <p class="plate-does">${does}</p>
          ${extra || ''}
        </div>
      </li>`;
  }

  function whoSection(room) {
    const p = room.people;
    const items = [];
    if (p.staying) {
      items.push(plate('staying', 'home', 'Staying tenant', esc(p.staying.name), esc(p.staying.about),
        'Will live with whoever moves in, so they care who it is. Can answer one question.',
        `<p class="plate-quote"><span class="plate-quote-label">Hopes for</span> “${esc(p.staying.lookingFor)}”</p>`));
    }
    if (p.stayingOthers) {
      items.push(plate('muted', 'home', p.staying ? 'Other flatmates' : 'Flatmates who stay', '', '',
        esc(p.stayingOthers) + ' You can’t ask them here.'));
    }
    if (p.outgoing) {
      items.push(plate('outgoing', 'exit', 'Outgoing tenant', 'Name hidden',
        `Moves out ${fmt(p.outgoing.leaves)} · ${esc(p.outgoing.about)}`,
        'Can leave a note and answer one question. Doesn’t decide who gets the room or on what terms.'));
    }
    const d = p.decides;
    const isMgr = d.kind === 'manager';
    const status = d.confirmed
      ? `Stated the dates and terms on ${fmt(d.statedOn)}.`
      : 'Hasn’t confirmed dates, rent or terms yet.';
    items.push(plate('owner', 'key', isMgr ? 'Manager' : 'Owner', isMgr ? esc(d.label || 'Manager') : '',
      status + (isMgr ? ' Says it acts for the owner. Nobody has checked.' : ''),
      'Decides availability and terms: who gets the room, from when and for how much.'));
    return `
      <section class="block" aria-labelledby="who-h">
        <h2 id="who-h">Who’s who</h2>
        <ul class="intercom">${items.join('')}</ul>
      </section>`;
  }

  function noteSection(room) {
    const n = room.note;
    const author = n.by === 'outgoing' ? 'the outgoing tenant'
      : n.by === 'staying' && room.people.staying ? room.people.staying.name
        : 'the previous tenant';
    const years = L.lineage(n);
    const open = state.openHistory.has(room.id);
    const history = n.history || [];
    const lineage = years.length > 1
      ? `<p class="lineage">${icon('note')}<span>Kept going since ${years[0]}: ${years.join(' → ')}. Each year the next tenant added to it.</span></p>
         <button class="link-btn" type="button" data-action="toggle-history" data-room="${room.id}" aria-expanded="${open}" aria-controls="hist-${room.id}">
           ${open ? 'Hide' : 'Show'} earlier ${history.length === 1 ? 'note' : 'notes'} (${history.length})
         </button>
         <ol class="history" id="hist-${room.id}"${open ? '' : ' hidden'}>
           ${history.map((h) => `<li><p class="history-meta">${fmt(h.on)} · previous tenant, name hidden</p><p class="history-text">${esc(h.text)}</p></li>`).join('')}
         </ol>`
      : `<p class="lineage">${icon('note')}<span>First note for this room. When the next tenant moves out, they can update it.</span></p>`;
    return `
      <section class="block" aria-labelledby="note-h">
        <h2 id="note-h">Note for the next student</h2>
        <figure class="paper">
          <blockquote><p>${esc(n.text)}</p></blockquote>
          <figcaption>Written ${fmt(n.on)} by ${author}. Name hidden. Shared with the author’s consent.</figcaption>
        </figure>
        ${lineage}
      </section>`;
  }

  function ledgerRow(c, room) {
    const r = L.costRange(c);
    return `
      <li class="ledger-row${r ? '' : ' is-unknown'}">
        <div class="lr-line">
          <span class="lr-label">${esc(c.label)}${c.it ? ` <i lang="it">${esc(c.it)}</i>` : ''}</span>
          <span class="lr-amt">${r ? L.fmtRange(r[0], r[1]) : 'Not known'}</span>
        </div>
        ${c.note ? `<p class="lr-note">${esc(c.note)}</p>` : ''}
        <p class="lr-src">${sourceTag(c.source, room)}</p>
      </li>`;
  }

  function costSection(room, t) {
    const once = room.oneTime || [];
    return `
      <section class="block" aria-labelledby="cost-h">
        <h2 id="cost-h">Monthly cost, all-in</h2>
        <ul class="ledger">
          ${room.costs.map((c) => ledgerRow(c, room)).join('')}
          <li class="ledger-total"><span>All-in per month</span><span>${costText(t)}</span></li>
        </ul>
        <p class="fine">A range means the cost changes with the season. The filter hides a room only when even its cheapest month is over your limit.</p>
        ${once.length ? `<h3 class="h3">Paid once</h3><ul class="ledger">${once.map((c) => ledgerRow(c, room)).join('')}</ul>` : ''}
      </section>`;
  }

  function commuteSection(room) {
    const cm = room.commute || {};
    const leave = L.leaveBy(room, META.lectureTime, META.bufferMinutes);
    const c = L.commuteRange(room);
    const SCALE = 75;
    const pct = (m) => Math.min(100, (m / SCALE) * 100).toFixed(1) + '%';
    const cards = [];
    if (cm.estimate) {
      cards.push(`
        <div class="cmp">
          <p class="cmp-label">Route planner</p>
          <p class="cmp-num">${cm.estimate.minutes} min</p>
          <p class="cmp-how">${esc(cm.estimate.how)}</p>
          <p class="cmp-src">${sourceTag(cm.estimate.source, room)}</p>
        </div>`);
    }
    if (cm.lived) {
      cards.push(`
        <div class="cmp cmp-lived">
          <p class="cmp-label">Living there</p>
          <p class="cmp-num">${L.fmtMinutes(cm.lived.min, cm.lived.max)}</p>
          <p class="cmp-how">“${esc(cm.lived.text)}”</p>
          <p class="cmp-src">${sourceTag(cm.lived.source, room)}</p>
        </div>`);
    }
    const scale = `
      <div class="scale" aria-hidden="true">
        <div class="scale-track">
          ${cm.lived ? `<span class="scale-range" data-from="${pct(cm.lived.min)}" data-to="${pct(cm.lived.max)}"></span>` : ''}
          ${cm.estimate ? `<span class="scale-dot" data-at="${pct(cm.estimate.minutes)}"></span>` : ''}
        </div>
        <div class="scale-ticks">${[0, 15, 30, 45, 60, 75].map((m) => `<span data-at="${pct(m)}">${m}</span>`).join('')}</div>
        <p class="scale-legend"><span class="lg-dot"></span>Route planner <span class="lg-bar"></span>Living there <span class="lg-unit">minutes, door to door</span></p>
      </div>`;
    return `
      <section class="block" aria-labelledby="commute-h">
        <h2 id="commute-h">Getting to campus</h2>
        <div class="compare">${cards.join('')}</div>
        ${scale}
        ${leave ? `<p class="leave">${icon('clock')}<span>For an ${esc(META.lectureTime.replace(/^0/, ''))} lecture, leave around <strong>${leave}</strong>. That is ${c.max} minutes from the slowest trip above plus ${META.bufferMinutes} to spare.</span></p>` : ''}
        <p class="fine">Door to door, to ${esc(META.campus)}.</p>
      </section>`;
  }

  function datesSection(room) {
    const d = room.dates;
    const reported = d.source && d.source.status !== 'stated';
    return `
      <section class="block" aria-labelledby="dates-h">
        <h2 id="dates-h">Dates and contract</h2>
        <dl class="facts">
          <div><dt>Free from</dt><dd>${fmt(d.from)}</dd></div>
          <div><dt>Latest start</dt><dd>${d.startBy ? fmt(d.startBy) : 'Flexible'}</dd></div>
          <div><dt>Until</dt><dd>${d.until ? fmt(d.until) : 'Open-ended'}</dd></div>
          <div><dt>Minimum stay</dt><dd>${d.minMonths ? d.minMonths + ' months' : 'Not known'}</dd></div>
          <div><dt>Contract</dt><dd>${esc(d.contract)}</dd></div>
        </dl>
        <p class="lr-src">${sourceTag(d.source, room)}</p>
        ${reported ? `<div class="callout callout-warn">${icon('alert')}<p>These come from the outgoing tenant. Only the owner can confirm availability and terms.</p></div>` : ''}
      </section>`;
  }

  const UNCHECKED = [
    'Who these people are. A university email would only show that someone can open that inbox.',
    'Whether the owner or manager has the right to rent out this room.',
    'Whether the note, the numbers and the times are true.'
  ];

  function uncheckedSection(room) {
    return `
      <section class="block" aria-labelledby="unchecked-h">
        <h2 id="unchecked-h">Not checked</h2>
        <p class="muted">This demo checks nothing. A real service would need separate grounds for each of these.</p>
        <ul class="bullets">${(room.unchecked || []).concat(UNCHECKED).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>`;
  }

  function ctaBar(room) {
    const req = state.requests.get(room.id);
    if (!askable(room).length) return '';
    if (req) {
      return `
        <div class="cta-bar">
          <p class="cta-state">${icon('mail')}<span><strong>Your question is saved here.</strong> Not sent.</span></p>
          <a class="btn btn-secondary" href="#ask-${room.id}">View or edit</a>
        </div>`;
    }
    return `
      <div class="cta-bar cta-stack">
        <a class="btn btn-primary btn-block" href="#ask-${room.id}">Ask one question</a>
        <p class="cta-note">Demo: nothing is sent. It stays on this device.</p>
      </div>`;
  }

  function viewRoom(id) {
    const room = ROOM_BY_ID.get(id);
    if (!room) return viewNotFound();
    const { filters } = currentFilters();
    const ev = L.evaluate(room, filters);
    return `
      <div class="view view-room">
        ${crumb('#rooms', 'All rooms')}
        <header class="room-head">
          <p class="eyebrow">${esc(room.area)} · exact address hidden</p>
          <h1 tabindex="-1">${esc(room.title)}</h1>
          <p class="muted">${esc(room.flat)}</p>
          <dl class="keyfacts">
            <div><dt>All-in a month</dt><dd>${costText(ev.totals)}</dd></div>
            <div><dt>To campus</dt><dd>${commuteText(room)}</dd></div>
            <div><dt>Free from</dt><dd>${fmt(room.dates.from)}</dd></div>
          </dl>
          ${fitBox(ev, filters)}
        </header>
        ${whoSection(room)}
        ${noteSection(room)}
        ${costSection(room, ev.totals)}
        ${commuteSection(room)}
        ${datesSection(room)}
        ${uncheckedSection(room)}
        ${ctaBar(room)}
      </div>`;
  }

  // ---------- view: ask one question ----------

  const TOPICS = [
    { key: 'costs', label: 'Costs', ideas: [
      'What were the bills in the coldest month?',
      'Is anything paid once a year, like the waste tax?',
      'How did the deposit work when you moved in?'
    ] },
    { key: 'commute', label: 'Commute', ideas: [
      'How early do you leave for an 8:30 lecture?',
      'How long do you usually wait at the stop in the morning?'
    ] },
    { key: 'life', label: 'Daily life', ideas: [
      'How do you split the cleaning?',
      'How are guests handled in the flat?',
      'Is it quiet enough to study at home?'
    ] },
    { key: 'other', label: 'Something else', ideas: [] }
  ];

  const topicLabel = (key) => (TOPICS.find((t) => t.key === key) || TOPICS[TOPICS.length - 1]).label;

  function askable(room) {
    const p = room.people;
    const list = [];
    if (p.staying) {
      list.push({ key: 'staying', name: p.staying.name, role: 'staying tenant',
        good: 'daily life, the flatmates and the flat as it is now' });
    }
    if (p.outgoing) {
      list.push({ key: 'outgoing', name: 'Outgoing tenant', role: 'name hidden',
        good: 'the room itself, the bills and the commute from here' });
    }
    return list;
  }

  function recipientName(room, key) {
    if (key === 'staying' && room.people.staying) return room.people.staying.name;
    if (key === 'outgoing') return 'the outgoing tenant';
    return 'the tenant';
  }

  function getDraft(room) {
    let d = state.drafts.get(room.id);
    if (!d) {
      const saved = state.requests.get(room.id);
      const people = askable(room);
      d = saved
        ? { to: saved.to, topic: saved.topic, text: saved.text, shareDates: Boolean(saved.dates) }
        : { to: people[0] ? people[0].key : null, topic: 'costs', text: '', shareDates: true };
      state.drafts.set(room.id, d);
    }
    return d;
  }

  function sharedDates() {
    const { filters } = currentFilters();
    return filters.moveIn && filters.moveOut ? { moveIn: filters.moveIn, moveOut: filters.moveOut } : null;
  }

  function qHint(text) {
    const marks = (text.match(/\?/g) || []).length;
    return marks > 1 ? 'Looks like more than one question. One is quicker to answer.' : 'Keep it to one question.';
  }

  function ideasHTML(key) {
    const t = TOPICS.find((x) => x.key === key);
    if (!t || !t.ideas.length) return '';
    return `
      <p class="ideas-label">Ideas. Tap one to use it.</p>
      <div class="ideas">${t.ideas.map((s) => `<button type="button" class="idea" data-action="use-idea" data-text="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  }

  function previewHTML(room, d) {
    const dates = sharedDates();
    const text = d.text.trim();
    return `
      <p class="preview-label">What ${esc(recipientName(room, d.to))} would see</p>
      <div class="preview-card">
        <p class="pv-line"><span class="pv-k">From</span><span class="pv-v">A student looking for a room</span></p>
        <p class="pv-line"><span class="pv-k">Room</span><span class="pv-v">${esc(room.area)} · ${esc(room.title)}</span></p>
        <p class="pv-line"><span class="pv-k">Topic</span><span class="pv-v">${esc(topicLabel(d.topic))}</span></p>
        ${dates && d.shareDates ? `<p class="pv-line"><span class="pv-k">Dates</span><span class="pv-v">${fmt(dates.moveIn)} to ${fmt(dates.moveOut)}</span></p>` : ''}
        <p class="pv-q">${text ? esc(text) : '<span class="pv-empty">Your question will appear here.</span>'}</p>
      </div>
      <p class="fine">No name, email or phone number goes with it. Swapping contacts would need both sides to agree, and that isn’t part of this demo.</p>`;
  }

  function askForm(room) {
    const people = askable(room);
    const saved = state.requests.get(room.id);
    const decider = room.people.decides.kind === 'manager' ? 'manager' : 'owner';
    if (!people.length) {
      return `
        <div class="view">
          ${crumb('#room-' + room.id, room.area)}
          <header class="page-head"><h1 tabindex="-1">Nobody to ask here yet</h1>
          <p class="lede">No tenant of this room is on Keys to Milan.</p></header>
        </div>`;
    }
    const d = getDraft(room);
    const dates = sharedDates();
    return `
      <div class="view view-ask">
        ${crumb('#room-' + room.id, room.area)}
        <header class="page-head">
          <p class="eyebrow">${esc(room.title)}</p>
          <h1 tabindex="-1">${saved ? 'Edit your question' : 'Ask one question'}</h1>
          <p class="lede">Tenants can tell you what living there is like. Only the ${decider} can say whether the room is yours and on what terms.</p>
        </header>
        <form id="askForm" class="ask" data-room="${room.id}" novalidate>
          <fieldset class="group">
            <legend>Who should answer?</legend>
            <div class="choices">
              ${people.map((p) => `
                <label class="choice">
                  <input type="radio" name="to" value="${p.key}"${d.to === p.key ? ' checked' : ''}>
                  <span class="choice-body">
                    <span class="choice-title">${esc(p.name)} <span class="choice-role">${esc(p.role)}</span></span>
                    <span class="choice-good">Good for ${esc(p.good)}</span>
                  </span>
                </label>`).join('')}
            </div>
            ${room.people.stayingOthers ? `<p class="hint">${esc(room.people.stayingOthers)}</p>` : ''}
          </fieldset>
          <fieldset class="group">
            <legend>What is it about?</legend>
            <div class="topics">
              ${TOPICS.map((t) => `<label class="topic"><input type="radio" name="topic" value="${t.key}"${d.topic === t.key ? ' checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}
            </div>
            <div id="ideas" class="stack-sm">${ideasHTML(d.topic)}</div>
          </fieldset>
          <div class="field">
            <label for="q">Your question</label>
            <textarea id="q" name="text" rows="4" maxlength="${MAX_Q}" placeholder="One short question" aria-describedby="q-hint q-count q-err">${esc(d.text)}</textarea>
            <div class="q-meta">
              <p class="hint" id="q-hint">${esc(qHint(d.text))}</p>
              <p class="q-count" id="q-count">${d.text.length}/${MAX_Q}</p>
            </div>
            <p class="error" id="q-err" hidden>${icon('alert')}<span></span></p>
          </div>
          ${dates
            ? `<label class="check"><input type="checkbox" id="shareDates" name="shareDates"${d.shareDates ? ' checked' : ''}><span>Include my dates: ${fmt(dates.moveIn)} to ${fmt(dates.moveOut)}</span></label>`
            : '<p class="hint">Your dates aren’t set, so none will be included.</p>'}
          <div class="preview" id="preview">${previewHTML(room, d)}</div>
          <div class="stack">
            <button class="btn btn-primary btn-block" type="submit">${saved ? 'Save changes on this device' : 'Save on this device'}</button>
            ${saved ? `<button class="btn btn-quiet btn-block" type="button" data-action="cancel-edit" data-room="${room.id}">Cancel</button>` : ''}
          </div>
          <p class="fine fine-center">Demo: the request is not sent. It stays in this tab’s memory, and reloading or closing the page deletes it.</p>
        </form>
      </div>`;
  }

  function requestCard(room, req) {
    const to = recipientName(room, req.to);
    const armed = state.armedDelete === room.id;
    const time = req.savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <article class="req">
        <header class="req-head">
          <p class="req-to">To ${esc(to)}${req.to === 'staying' ? ', staying tenant' : ''}</p>
          <p class="req-room"><a href="#room-${room.id}">${esc(room.area)}</a> · ${esc(room.title)}</p>
        </header>
        <p class="req-q">${esc(req.text)}</p>
        <p class="req-meta">${esc(topicLabel(req.topic))} · ${req.dates ? `dates included: ${fmt(req.dates.moveIn)} to ${fmt(req.dates.moveOut)}` : 'no dates included'} · saved at ${esc(time)}</p>
        <ol class="track" aria-label="Sending status">
          <li class="is-done">${icon('check')}<span>Saved on this device</span></li>
          <li class="is-off">${icon('dash')}<span>Sent to ${esc(to)}<em>Not in this demo</em></span></li>
          <li class="is-off">${icon('dash')}<span>Answered<em>Not in this demo</em></span></li>
        </ol>
        <div class="req-actions">
          <button class="btn btn-secondary" type="button" data-action="edit-request" data-room="${room.id}">Edit</button>
          <button class="btn ${armed ? 'btn-danger' : 'btn-quiet'}" type="button" data-action="delete-request" data-room="${room.id}">${armed ? 'Tap again to delete' : 'Delete'}</button>
        </div>
      </article>`;
  }

  function askSaved(room, req) {
    return `
      <div class="view view-saved">
        ${crumb('#room-' + room.id, room.area)}
        <header class="page-head">
          <p class="eyebrow eyebrow-ok">${icon('check')}<span>Saved on this device</span></p>
          <h1 tabindex="-1">Saved here. Not sent.</h1>
          <p class="lede">Nobody has received your question. In this demo it stays in this tab’s memory and disappears when you reload or close the page.</p>
        </header>
        ${requestCard(room, req)}
        <div class="stack">
          <a class="btn btn-secondary btn-block" href="#room-${room.id}">Back to the room</a>
          <a class="btn btn-quiet btn-block" href="#rooms">See other rooms</a>
        </div>
      </div>`;
  }

  function viewAsk(id) {
    const room = ROOM_BY_ID.get(id);
    if (!room) return viewNotFound();
    const req = state.requests.get(id);
    return req && !state.editing.has(id) ? askSaved(room, req) : askForm(room);
  }

  function refreshAsk(form, opts) {
    const room = ROOM_BY_ID.get(form.dataset.room);
    const d = getDraft(room);
    if (opts && opts.ideas) document.getElementById('ideas').innerHTML = ideasHTML(d.topic);
    document.getElementById('q-count').textContent = `${d.text.length}/${MAX_Q}`;
    document.getElementById('q-hint').textContent = qHint(d.text);
    document.getElementById('preview').innerHTML = previewHTML(room, d);
  }

  function showQError(msg) {
    const err = document.getElementById('q-err');
    const q = document.getElementById('q');
    if (!err || !q) return;
    if (msg) {
      err.querySelector('span').textContent = msg;
      err.hidden = false;
      q.setAttribute('aria-invalid', 'true');
    } else {
      err.hidden = true;
      q.removeAttribute('aria-invalid');
    }
  }

  function saveRequest(form) {
    const id = form.dataset.room;
    const room = ROOM_BY_ID.get(id);
    const d = getDraft(room);
    const text = d.text.trim();
    if (!text) {
      showQError('Write your question first.');
      document.getElementById('q').focus();
      return;
    }
    const dates = d.shareDates ? sharedDates() : null;
    const existed = state.requests.has(id);
    state.requests.set(id, { to: d.to, topic: d.topic, text, dates, savedAt: new Date() });
    state.editing.delete(id);
    state.drafts.delete(id);
    render({ focus: true });
    announce(existed ? 'Changes saved on this device. Not sent.' : 'Request saved on this device. Not sent.', 50);
  }

  // ---------- view: your requests ----------

  function viewRequests() {
    const list = Array.from(state.requests.entries());
    return `
      <div class="view view-requests">
        ${crumb('#rooms', 'Rooms')}
        <header class="page-head">
          <h1 tabindex="-1">Your requests</h1>
          <p class="lede">${list.length ? 'Kept in this tab only. Nothing has been sent.' : 'Nothing saved yet, and nothing sent.'}</p>
        </header>
        ${list.length
          ? `<ul class="req-list">${list.map(([id, req]) => `<li>${requestCard(ROOM_BY_ID.get(id), req)}</li>`).join('')}</ul>`
          : `<div class="panel empty">
              <p>Open a room and ask one question. It will wait here, unsent.</p>
              <a class="btn btn-primary" href="#rooms">Browse rooms</a>
            </div>`}
        <section class="block" aria-labelledby="status-h">
          <h2 id="status-h">What “not sent” means</h2>
          <p class="muted">In this demo a request goes no further than this page. Nobody is notified, nothing reaches a server, and closing or reloading the page deletes every request.</p>
        </section>
      </div>`;
  }

  // ---------- view: about ----------

  function viewAbout() {
    const block = (id, title, items) => `
      <section class="block" aria-labelledby="${id}">
        <h2 id="${id}">${title}</h2>
        <ul class="bullets">${items.map((t) => `<li>${t}</li>`).join('')}</ul>
      </section>`;
    return `
      <div class="view view-about">
        ${crumb('#start', 'Start')}
        <header class="page-head">
          <p class="eyebrow">${esc(META.version)}</p>
          <h1 tabindex="-1">About this demo</h1>
          <p class="lede">${esc(META.name)} is a ${esc(META.nameStatus)} for an independent student initiative. There is no partnership with Bocconi University.</p>
        </header>
        ${block('try-h', 'What you can try', [
          'Filter fictional private rooms by your dates and an all-in monthly limit.',
          'Open a room to see who stays, who leaves, who decides, and where each fact comes from.',
          'Read the note the last tenant left for the next student.',
          'Write one question to a tenant. It stays on your device.'
        ])}
        ${block('not-h', 'What it doesn’t do', [
          'Check anyone or anything. People, rooms and facts are invented and unverified.',
          'Book a room, arrange a viewing or a move-in.',
          'Send or deliver your question.',
          'List university residences. Private rooms only.'
        ])}
        ${block('data-h', 'Your data on this page', [
          'No account, no cookies, no analytics, no browser storage.',
          'The page loads nothing from other websites.',
          'Your dates, limit and questions live in this tab’s memory. Reloading or closing the page deletes them.'
        ])}
        ${block('fiction-h', 'The data', [
          'Every room, person, note, price, date and commute time is invented. Any match with a real flat or person is accidental.',
          'Areas are real Milan neighbourhoods. Exact addresses are never shown.',
          'Names of previous tenants are hidden by default.'
        ])}
      </div>`;
  }

  function viewNotFound() {
    return `
      <div class="view">
        <header class="page-head">
          <h1 tabindex="-1">This page isn’t in the demo</h1>
          <p class="lede">The link may be old or mistyped.</p>
        </header>
        <a class="btn btn-primary" href="#rooms">Go to the rooms</a>
      </div>`;
  }

  // ---------- routing and rendering ----------

  function parseRoute() {
    const h = location.hash.replace(/^#/, '');
    if (!h || h === 'start') return { name: 'start' };
    if (h === 'rooms' || h === 'requests' || h === 'about') return { name: h };
    let m = /^room-([a-z0-9]+)$/.exec(h);
    if (m) return { name: 'room', id: m[1] };
    m = /^ask-([a-z0-9]+)$/.exec(h);
    if (m) return { name: 'ask', id: m[1] };
    return { name: 'notfound' };
  }

  function pageTitle(r) {
    const room = r.id && ROOM_BY_ID.get(r.id);
    const names = {
      start: '', rooms: 'Rooms', requests: 'Your requests', about: 'About',
      room: room ? room.area : 'Not found', ask: room ? 'Ask · ' + room.area : 'Not found', notfound: 'Not found'
    };
    return (names[r.name] ? names[r.name] + ' · ' : '') + 'Keys to Milan Demo';
  }

  function renderStatus() {
    const n = state.requests.size;
    const pill = document.getElementById('sendPill');
    if (!pill) return;
    pill.querySelector('.pill-text').textContent = n ? `${n} not sent` : 'Nothing sent';
    pill.classList.toggle('has', n > 0);
    pill.setAttribute('aria-label', n
      ? `${plural(n, 'request', 'requests')} saved on this device, not sent. Open your requests.`
      : 'Nothing sent. Open your requests.');
  }

  // Positions for the commute scale, set through the CSSOM rather than inline style attributes.
  function applyPositions() {
    view.querySelectorAll('[data-at]').forEach((el) => el.style.setProperty('--at', el.dataset.at));
    view.querySelectorAll('[data-from]').forEach((el) => {
      el.style.setProperty('--from', el.dataset.from);
      el.style.setProperty('--to', el.dataset.to);
    });
  }

  function render(opts) {
    const o = opts || {};
    const r = parseRoute();
    clearTimeout(state.armedTimer);
    state.armedDelete = null;
    let html;
    switch (r.name) {
      case 'start': html = viewStart(); break;
      case 'rooms': html = viewRooms(); break;
      case 'room': html = viewRoom(r.id); break;
      case 'ask': html = viewAsk(r.id); break;
      case 'requests': html = viewRequests(); break;
      case 'about': html = viewAbout(); break;
      default: html = viewNotFound();
    }
    view.innerHTML = html;
    applyPositions();
    renderStatus();
    document.title = pageTitle(r);
    if (!o.keepScroll) window.scrollTo(0, 0);
    if (o.focus) {
      const h1 = view.querySelector('h1');
      if (h1) h1.focus({ preventScroll: true });
    }
  }

  // ---------- events ----------

  const FILTER_IDS = ['f-moveIn', 'f-moveOut', 'f-limit'];

  function onFieldChange(e) {
    const t = e.target;
    if (FILTER_IDS.includes(t.id)) {
      if (state.raw[t.name] === t.value) return;
      state.raw[t.name] = t.value;
      state.usingExample = false;
      afterFiltersChanged();
      return;
    }
    if (t.id === 'sortBy') {
      state.sort = t.value;
      afterFiltersChanged();
      return;
    }
    const form = t.form;
    if (form && form.id === 'askForm') {
      const d = getDraft(ROOM_BY_ID.get(form.dataset.room));
      if (t.name === 'to') d.to = t.value;
      else if (t.name === 'topic') d.topic = t.value;
      else if (t.name === 'shareDates') d.shareDates = t.checked;
      else if (t.name === 'text') {
        d.text = t.value;
        if (d.text.trim()) showQError('');
      }
      refreshAsk(form, { ideas: t.name === 'topic' });
    }
  }

  document.addEventListener('input', onFieldChange);
  document.addEventListener('change', onFieldChange);

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'askForm') saveRequest(form);
    else if (form.id === 'filtersForm' && parseRoute().name === 'start') location.hash = 'rooms';
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const id = el.dataset.room;
    switch (el.dataset.action) {
      case 'skip': {
        e.preventDefault();
        view.focus();
        break;
      }
      case 'clear-filters':
        clearFilters();
        break;
      case 'toggle-filters': {
        state.filtersOpen = !state.filtersOpen;
        el.setAttribute('aria-expanded', String(state.filtersOpen));
        document.getElementById('filtersForm').hidden = !state.filtersOpen;
        break;
      }
      case 'toggle-others': {
        state.showOthers = el.getAttribute('aria-expanded') !== 'true';
        el.setAttribute('aria-expanded', String(state.showOthers));
        document.getElementById('othersList').hidden = !state.showOthers;
        break;
      }
      case 'toggle-history': {
        const open = !state.openHistory.has(id);
        if (open) state.openHistory.add(id); else state.openHistory.delete(id);
        const n = ROOM_BY_ID.get(id).note.history.length;
        el.setAttribute('aria-expanded', String(open));
        el.textContent = `${open ? 'Hide' : 'Show'} earlier ${n === 1 ? 'note' : 'notes'} (${n})`;
        document.getElementById('hist-' + id).hidden = !open;
        break;
      }
      case 'use-idea': {
        const form = el.closest('form');
        const d = getDraft(ROOM_BY_ID.get(form.dataset.room));
        d.text = el.dataset.text;
        const q = document.getElementById('q');
        q.value = d.text;
        showQError('');
        refreshAsk(form);
        q.focus();
        break;
      }
      case 'edit-request': {
        state.editing.add(id);
        state.drafts.delete(id);
        if (location.hash === '#ask-' + id) render({ focus: true });
        else location.hash = 'ask-' + id;
        break;
      }
      case 'cancel-edit': {
        state.editing.delete(id);
        state.drafts.delete(id);
        render({ focus: true });
        break;
      }
      case 'delete-request': {
        if (state.armedDelete === id) {
          state.requests.delete(id);
          state.editing.delete(id);
          state.drafts.delete(id);
          render({ keepScroll: true, focus: true });
          announce('Request deleted.', 50);
        } else {
          state.armedDelete = id;
          el.textContent = 'Tap again to delete';
          el.classList.replace('btn-quiet', 'btn-danger');
          clearTimeout(state.armedTimer);
          state.armedTimer = setTimeout(() => {
            state.armedDelete = null;
            if (el.isConnected) {
              el.textContent = 'Delete';
              el.classList.replace('btn-danger', 'btn-quiet');
            }
          }, 4000);
        }
        break;
      }
      default:
        break;
    }
  });

  window.addEventListener('hashchange', () => render({ focus: true }));
  render();
})();
