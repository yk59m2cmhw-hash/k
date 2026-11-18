/*
 * Keys to Milan · DEMO-01 data
 *
 * EVERYTHING IN THIS FILE IS FICTIONAL. Rooms, people, notes, prices, dates and
 * commute times were invented for a demo. Any match with a real flat or person
 * is accidental. Never put real people's data here: see docs/demo-01.md.
 *
 * Shape of a source:  { by, on, status }
 *   by:     'owner' | 'manager' | 'staying' | 'outgoing' | 'previous' | 'team'
 *   on:     'YYYY-MM-DD', the day the information was given
 *   status: 'stated'     said by the owner or manager, who decide the terms
 *           'reported'   terms passed on by a tenant, not confirmed by the owner
 *           'experience' a tenant's own experience of living there
 *           'estimate'   the team's rough calculation
 * A cost with no amount and no range is unknown.
 */
(function (root) {
  'use strict';

  var data = {
    meta: {
      name: 'Keys to Milan',
      nameStatus: 'working name',
      version: 'DEMO-01',
      campus: 'Bocconi main campus (Via Sarfatti)',
      // One notional move-in window. Move-in dates outside it are rejected.
      window: { from: '2027-08-20', to: '2027-09-20' },
      lectureTime: '08:30',
      bufferMinutes: 5,
      // Shown as example values on the start screen, clearly labelled.
      exampleFilters: { moveIn: '2027-09-01', moveOut: '2028-06-30', limit: 800 },
      maxQuestionLength: 280
    },

    rooms: [
      {
        id: 'r1',
        area: 'Porta Romana',
        title: 'Single room in a 3-bedroom flat',
        flat: '3 people · 4th floor, lift',
        dates: {
          from: '2027-09-01', startBy: '2027-09-15', until: null, minMonths: 10,
          contract: 'Student contract, 10 to 12 months',
          source: { by: 'owner', on: '2027-07-02', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 650,
            source: { by: 'owner', on: '2027-07-02', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 45,
            source: { by: 'owner', on: '2027-07-02', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze', range: [55, 95],
            note: 'Higher from December to February: central heating.',
            source: { by: 'outgoing', on: '2027-06-14', status: 'experience' } },
          { label: 'Internet, your share', amount: 10,
            source: { by: 'staying', on: '2027-07-01', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 10,
            note: 'Billed once a year and split by the flat.',
            source: { by: 'team', on: '2027-07-10', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1300, note: 'Two months of rent.',
            source: { by: 'owner', on: '2027-07-02', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 0, note: 'No agency involved.',
            source: { by: 'owner', on: '2027-07-02', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 18, how: 'Tram, then a 5-minute walk',
            source: { by: 'team', on: '2027-07-10', status: 'estimate' } },
          lived: { min: 20, max: 30,
            text: 'At 8:00 the first tram is often full, so count on waiting for the next one.',
            source: { by: 'outgoing', on: '2027-06-14', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Giulia', about: '2nd-year MSc, staying until 2029',
            lookingFor: 'Someone who keeps the kitchen usable and likes a shared dinner now and then. Quiet on weeknights.'
          },
          stayingOthers: null,
          outgoing: { leaves: '2027-08-31', about: 'Exchange year ends, leaving Milan' },
          decides: { kind: 'owner', statedOn: '2027-07-02', confirmed: true }
        },
        note: {
          by: 'outgoing', on: '2027-06-14',
          text: 'Bills were about €60 a month in spring and €95 in January. Heating is central, so the flat is warm but you don’t choose the hours. For 8:30 lectures I left at 7:55. The building is quiet, and the neighbour below will tell you if music goes past 22:00. Ask Giulia about the cleaning rota. It is the reason this flat works.',
          history: [
            { on: '2026-06-20', text: 'The window faces the tram line, so earplugs help for the first weeks. The owner answers messages within a day. Repairs take about a week.' },
            { on: '2025-07-01', text: 'First note for this room. The supermarket is three minutes away and closes at 21:00. There is a washing machine but no dryer, so the balcony does the job except in winter.' }
          ]
        },
        unchecked: []
      },

      {
        id: 'r2',
        area: 'Porta Lodovica',
        title: 'Single room in a 2-bedroom flat',
        flat: '2 people · 2nd floor, no lift',
        dates: {
          from: '2027-08-25', startBy: '2027-09-05', until: '2028-07-31', minMonths: 6,
          contract: 'Student contract until 31 Jul 2028',
          source: { by: 'manager', on: '2027-07-20', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 820,
            source: { by: 'manager', on: '2027-07-20', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 0, note: 'Included in the rent.',
            source: { by: 'manager', on: '2027-07-20', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze', range: [50, 85],
            note: 'Small flat, so bills stay low.',
            source: { by: 'staying', on: '2027-07-18', status: 'experience' } },
          { label: 'Internet, your share', amount: 15,
            source: { by: 'staying', on: '2027-07-18', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 12,
            source: { by: 'team', on: '2027-07-21', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1640, note: 'Two months of rent.',
            source: { by: 'manager', on: '2027-07-20', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 1000, note: 'About one month of rent plus VAT.',
            source: { by: 'manager', on: '2027-07-20', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 8, how: 'On foot',
            source: { by: 'team', on: '2027-07-21', status: 'estimate' } },
          lived: { min: 6, max: 8,
            text: 'I leave at 8:20 for an 8:30 lecture and I’m early.',
            source: { by: 'staying', on: '2027-07-18', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Tomás', about: '3rd-year BSc, staying until July 2028',
            lookingFor: 'Another student who likes a calm flat during the week. I’m away most weekends.'
          },
          stayingOthers: null,
          outgoing: null,
          decides: { kind: 'manager', label: 'Letting agency', statedOn: '2027-07-20', confirmed: true, authorityChecked: false }
        },
        note: {
          by: 'previous', on: '2027-06-28',
          text: 'Living five minutes from campus changes your day. I went home between lectures and slept until 8:00. It is a second floor with no lift in an old building with thin walls, so bring headphones. Bills stayed low because the flat is small. The agency was slow to reply in August.',
          history: []
        },
        unchecked: ['The agency says it acts for the owner. Nobody has checked that.']
      },

      {
        id: 'r3',
        area: 'Navigli',
        title: 'Single room in a 4-bedroom flat',
        flat: '4 people · 1st floor of a courtyard building (casa di ringhiera)',
        dates: {
          from: '2027-09-01', startBy: '2027-09-10', until: '2028-06-30', minMonths: 9,
          contract: 'Student contract until 30 Jun 2028',
          source: { by: 'owner', on: '2027-06-30', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 600,
            source: { by: 'owner', on: '2027-06-30', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 40,
            source: { by: 'owner', on: '2027-06-30', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze', range: [60, 110],
            note: 'Old windows, so winter bills run high.',
            source: { by: 'outgoing', on: '2027-06-10', status: 'experience' } },
          { label: 'Internet, your share', amount: 8,
            source: { by: 'staying', on: '2027-06-29', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 9,
            source: { by: 'team', on: '2027-07-01', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1200, note: 'Two months of rent.',
            source: { by: 'owner', on: '2027-06-30', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 0, note: 'No agency involved.',
            source: { by: 'owner', on: '2027-06-30', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 22, how: 'Tram, then an 8-minute walk',
            source: { by: 'team', on: '2027-07-01', status: 'estimate' } },
          lived: { min: 25, max: 35,
            text: 'On foot along the canal it’s 25 minutes. That is the most reliable option.',
            source: { by: 'outgoing', on: '2027-06-10', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Amara', about: 'MSc, staying two more years',
            lookingFor: 'Non-smoker, please. We keep quiet hours after 23:00 on weeknights because two of us start early.'
          },
          stayingOthers: 'Two more flatmates are staying but are not on Keys to Milan.',
          outgoing: { leaves: '2027-08-31', about: 'Graduating' },
          decides: { kind: 'owner', statedOn: '2027-06-30', confirmed: true }
        },
        note: {
          by: 'outgoing', on: '2027-06-10',
          text: 'Courtyard buildings are lovely in spring, but sound carries across the balconies. With the old windows my winter bills reached €110. Friday and Saturday nights by the canal are loud until 1 or 2. The quiet hours are taken seriously, and that is why four people get along here.',
          history: [
            { on: '2026-06-15', text: 'The cleaning rota on the fridge actually works. Bikes get stolen a lot, so keep yours inside the courtyard.' }
          ]
        },
        unchecked: []
      },

      {
        id: 'r4',
        area: 'Corvetto',
        title: 'Single room in a 3-bedroom flat',
        flat: '3 people · 6th floor, lift',
        dates: {
          from: '2027-09-15', startBy: null, until: null, minMonths: 12,
          contract: 'Not known yet',
          source: { by: 'outgoing', on: '2027-07-05', status: 'reported' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 560, note: 'What the outgoing tenant pays now. The owner may change it.',
            source: { by: 'outgoing', on: '2027-07-05', status: 'reported' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 50,
            source: { by: 'outgoing', on: '2027-07-05', status: 'reported' } },
          { label: 'Power, gas, water', it: 'utenze', range: [55, 100],
            source: { by: 'outgoing', on: '2027-07-05', status: 'experience' } },
          { label: 'Internet, your share', amount: 10,
            source: { by: 'staying', on: '2027-07-06', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 10,
            source: { by: 'team', on: '2027-07-07', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: null, note: 'Only the owner can say.' }
        ],
        commute: {
          estimate: { minutes: 28, how: 'Metro, then a bus',
            source: { by: 'team', on: '2027-07-07', status: 'estimate' } },
          lived: { min: 35, max: 45,
            text: 'The 8:00 bus is packed. Twice a week I couldn’t get on the first one.',
            source: { by: 'outgoing', on: '2027-07-05', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Luca', about: 'PhD student, staying',
            lookingFor: 'Someone who doesn’t mind that I work from home most days. I’m quiet, I just live in the kitchen a lot.'
          },
          stayingOthers: null,
          outgoing: { leaves: '2027-09-14', about: 'Moving closer to campus' },
          decides: { kind: 'owner', statedOn: null, confirmed: false }
        },
        note: {
          by: 'outgoing', on: '2027-07-05',
          text: 'Cheaper than the centre, and the flat is big. The catch is the commute: for 8:30 lectures I left at 7:45 and still had to run sometimes. Plenty of supermarkets around. I’m moving closer because I want my mornings back.',
          history: []
        },
        unchecked: ['Rent, dates and terms come from the outgoing tenant. Only the owner can confirm them.']
      },

      {
        id: 'r5',
        area: 'Città Studi',
        title: 'Single room in a 3-bedroom flat',
        flat: '3 people · 3rd floor, lift',
        dates: {
          from: '2027-08-20', startBy: '2027-09-01', until: '2028-08-31', minMonths: 10,
          contract: 'Student contract until 31 Aug 2028',
          source: { by: 'owner', on: '2027-07-12', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 590,
            source: { by: 'owner', on: '2027-07-12', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 45,
            source: { by: 'owner', on: '2027-07-12', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze',
            note: 'A flat rate in the current contract. It may change for the next one.' },
          { label: 'Internet, your share', amount: 10,
            source: { by: 'outgoing', on: '2027-06-30', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 10,
            source: { by: 'team', on: '2027-07-13', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1180, note: 'Two months of rent.',
            source: { by: 'owner', on: '2027-07-12', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 0, note: 'No agency involved.',
            source: { by: 'owner', on: '2027-07-12', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 35, how: 'Metro, change lines, then a walk',
            source: { by: 'team', on: '2027-07-13', status: 'estimate' } },
          lived: { min: 40, max: 50,
            text: 'Two lines and a change at rush hour. 45 minutes is normal.',
            source: { by: 'outgoing', on: '2027-06-30', status: 'experience' } }
        },
        people: {
          staying: null,
          stayingOthers: 'Two flatmates are staying but are not on Keys to Milan.',
          outgoing: { leaves: '2027-08-19', about: 'Moving nearer to Bocconi' },
          decides: { kind: 'owner', statedOn: '2027-07-12', confirmed: true }
        },
        note: {
          by: 'outgoing', on: '2027-06-30',
          text: 'This is the Politecnico side of town, so the flat is full of engineers. Fun, with late study nights. My bills were a flat €70 included in the rent, but the owner said the next contract may work differently, so ask. The real cost is time: about 45 minutes each way.',
          history: []
        },
        unchecked: ['Bills under the next contract are unknown.']
      },

      {
        id: 'r6',
        area: 'Bicocca',
        title: 'Single room in a 2-bedroom flat',
        flat: '2 people · 5th floor, lift',
        dates: {
          from: '2027-09-01', startBy: '2027-09-30', until: null, minMonths: 6,
          contract: 'Student contract, 6 to 12 months',
          source: { by: 'owner', on: '2027-07-01', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 520,
            source: { by: 'owner', on: '2027-07-01', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 35,
            source: { by: 'owner', on: '2027-07-01', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze', range: [50, 80],
            source: { by: 'staying', on: '2027-07-02', status: 'experience' } },
          { label: 'Internet, your share', amount: 10,
            source: { by: 'staying', on: '2027-07-02', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 9,
            source: { by: 'team', on: '2027-07-03', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1040, note: 'Two months of rent.',
            source: { by: 'owner', on: '2027-07-01', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 0, note: 'No agency involved.',
            source: { by: 'owner', on: '2027-07-01', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 45, how: 'Metro, change lines, then a tram',
            source: { by: 'team', on: '2027-07-03', status: 'estimate' } },
          lived: { min: 50, max: 60,
            text: '50 to 60 minutes door to door once you count the waiting.',
            source: { by: 'outgoing', on: '2027-06-25', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Sofia', about: 'Studies at a university nearby, staying',
            lookingFor: 'Someone fine with early mornings. My lab starts at 8:00, so I’m up at 6:30.'
          },
          stayingOthers: null,
          outgoing: { leaves: '2027-08-31', about: 'Bocconi student, moving closer' },
          decides: { kind: 'owner', statedOn: '2027-07-01', confirmed: true }
        },
        note: {
          by: 'outgoing', on: '2027-06-25',
          text: 'Good flat, great flatmate, wrong side of the city for Bocconi. It took me 50 to 60 minutes each way with the waiting, and 8:30 lectures meant leaving at 7:25. If your timetable is mostly afternoons, it is a good deal. Mine wasn’t.',
          history: []
        },
        unchecked: []
      },

      {
        id: 'r7',
        area: 'Isola',
        title: 'Single room with balcony in a 3-bedroom flat',
        flat: '3 people · 3rd floor, lift',
        dates: {
          from: '2027-09-10', startBy: '2027-09-20', until: '2028-07-31', minMonths: 10,
          contract: 'Student contract until 31 Jul 2028',
          source: { by: 'manager', on: '2027-07-15', status: 'stated' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 700,
            source: { by: 'manager', on: '2027-07-15', status: 'stated' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 60,
            source: { by: 'manager', on: '2027-07-15', status: 'stated' } },
          { label: 'Power, gas, water', it: 'utenze', range: [55, 90],
            source: { by: 'staying', on: '2027-07-16', status: 'experience' } },
          { label: 'Internet, your share', amount: 12,
            source: { by: 'staying', on: '2027-07-16', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 10,
            source: { by: 'team', on: '2027-07-16', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: 1400, note: 'Two months of rent.',
            source: { by: 'manager', on: '2027-07-15', status: 'stated' } },
          { label: 'Agency fee', it: 'provvigione', amount: 850, note: 'About one month of rent plus VAT.',
            source: { by: 'manager', on: '2027-07-15', status: 'stated' } }
        ],
        commute: {
          estimate: { minutes: 32, how: 'Metro, change lines, then a tram',
            source: { by: 'team', on: '2027-07-16', status: 'estimate' } },
          lived: { min: 35, max: 40,
            text: 'I’m at Bocconi too. 35 minutes on a good day.',
            source: { by: 'staying', on: '2027-07-16', status: 'experience' } }
        },
        people: {
          staying: {
            name: 'Jonas', about: 'Bocconi MSc, staying',
            lookingFor: 'Ideally someone at Bocconi too, so we can share the commute. Guests are fine, just tell the flat beforehand.'
          },
          stayingOthers: null,
          outgoing: { leaves: '2027-09-09', about: 'Internship abroad' },
          decides: { kind: 'manager', label: 'Letting agency', statedOn: '2027-07-15', confirmed: true, authorityChecked: false }
        },
        note: {
          by: 'outgoing', on: '2027-07-08',
          text: 'Isola is great in the evening and less great on the metro at 7:50. The balcony is the best thing about the flat. The agency handles repairs, and the boiler took three weeks to fix last winter. Jonas keeps a shared shopping list, so join it on day one.',
          history: [
            { on: '2026-07-02', text: 'I came from abroad and had never heard of TARI. It is a yearly waste tax, and the flat splits it.' }
          ]
        },
        unchecked: ['The agency says it acts for the owner. Nobody has checked that.']
      },

      {
        id: 'r8',
        area: 'Sesto San Giovanni',
        title: 'Single room in a 2-bedroom flat',
        flat: '2 people · 1st floor, no lift',
        dates: {
          from: '2027-09-01', startBy: null, until: null, minMonths: null,
          contract: 'Not known yet',
          source: { by: 'outgoing', on: '2027-07-03', status: 'reported' }
        },
        costs: [
          { label: 'Rent', it: 'affitto', amount: 470, note: 'What the outgoing tenant pays now.',
            source: { by: 'outgoing', on: '2027-07-03', status: 'reported' } },
          { label: 'Building fees', it: 'spese condominiali', amount: 30,
            source: { by: 'outgoing', on: '2027-07-03', status: 'reported' } },
          { label: 'Power, gas, water', it: 'utenze', range: [50, 90],
            source: { by: 'outgoing', on: '2027-07-03', status: 'experience' } },
          { label: 'Internet, your share', amount: 10,
            source: { by: 'outgoing', on: '2027-07-03', status: 'experience' } },
          { label: 'Waste tax, monthly share', it: 'TARI', amount: 8,
            source: { by: 'team', on: '2027-07-04', status: 'estimate' } }
        ],
        oneTime: [
          { label: 'Deposit', it: 'cauzione', amount: null, note: 'Only the owner can say.' }
        ],
        commute: {
          estimate: { minutes: 50, how: 'Metro, change lines, then a bus',
            source: { by: 'team', on: '2027-07-04', status: 'estimate' } },
          lived: { min: 60, max: 70,
            text: 'Over an hour on bad days.',
            source: { by: 'outgoing', on: '2027-07-03', status: 'experience' } }
        },
        people: {
          staying: null,
          stayingOthers: 'One flatmate is staying but is not on Keys to Milan.',
          outgoing: { leaves: '2027-08-31', about: 'Bocconi student, moving closer' },
          decides: { kind: 'owner', statedOn: null, confirmed: false }
        },
        note: {
          by: 'outgoing', on: '2027-07-03',
          text: 'The cheapest room I found, and the commute is why. Rent is €470 and bills ran from €50 to €90. The owner is kind but hasn’t decided whether to keep renting by the room, so ask before you plan around it.',
          history: []
        },
        unchecked: ['Rent, dates and terms come from the outgoing tenant. Only the owner can confirm them.']
      }
    ]
  };

  root.KTM_DATA = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof window !== 'undefined' ? window : globalThis);
