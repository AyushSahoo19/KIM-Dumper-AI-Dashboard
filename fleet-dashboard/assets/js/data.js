/* ═══════════════════════════════════════════════════════════════
   HaulPro Fleet Command — data.js
   DataStore abstraction + deterministic demo-data generator +
   raw-CSV ingestion (45-col dumper telemetry → daily aggregates).
   Swap DataStore internals for an API later without touching views.
   ═══════════════════════════════════════════════════════════════ */

/* ── Seeded PRNG (mulberry32) + gaussian ──────────────────────── */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ── Date helpers ─────────────────────────────────────────────── */
const DAY_MS = 86400000;
function isoDate(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
function dayIdx(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date('2026-01-01T00:00:00')) / DAY_MS); }
function fmtDate(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateShort(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }

/* ═══════════════════════════════════════════════════════════════
   DEMO DATA GENERATOR — 75 days ending today, per-dumper personas
   ═══════════════════════════════════════════════════════════════ */
const DEMO_DAYS = 75;

/* Personality offsets per unit number (tuned so alerts tell a story) */
const PERSONAS = {
  27: { fuel: 1.04 },
  28: {},
  29: { fuel: 1.12, idle: 4 },
  30: { idle: 9, trips: -3 },
  35: { boostDeclineDays: 20 },                       // gradual turbo/air-filter degradation
  36: { coolantRise: 12, coolantIncident: [-9, -6] }, // creeping + incident window
  37: {},
  38: { suspEvents: [[-30, -26], [-14, -11], [-4, -1]] },
  39: { payloadBias: -4 },
  40: { operatorMult: 2.2, overspeedBase: 4 },
};

function generateDemoData() {
  const today = isoDate(new Date());
  const dates = [];
  for (let i = DEMO_DAYS - 1; i >= 0; i--) dates.push(addDays(today, -i));

  const store = {};           // store[date][dumperId] = metrics | null(maintenance)
  const meta = {};            // meta[dumperId] = Set of reporting dates

  FLEET.forEach((d, di) => {
    const p = PERSONAS[d.num] || {};
    meta[d.id] = new Set();
  });

  dates.forEach((date, ti) => {
    store[date] = {};
    const dow = new Date(date + 'T00:00:00').getDay();
    const daysFromEnd = DEMO_DAYS - 1 - ti;

    FLEET.forEach((d, di) => {
      const rnd = mulberry32(hashStr(date + '|' + d.id));
      const g = () => { // gaussian via Box-Muller
        let u = 0, v = 0;
        while (u === 0) u = rnd(); while (v === 0) v = rnd();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };
      const P = PERSONAS[d.num] || {};

      /* maintenance / no-report days: Sundays ~40% chance */
      if (dow === 0 && rnd() < 0.42) { store[date][d.id] = null; return; }

      /* occasional breakdown day (rare) */
      if (rnd() < 0.012) { store[date][d.id] = null; return; }

      const m = {};

      /* ── base signals ── */
      m.trips = Math.max(4, Math.round(18 + g() * 2.5 + (P.trips || 0) - (dow === 6 ? 2 : 0)));
      m.avg_payload = clamp(96 + g() * 3 + (P.payloadBias || 0), 80, 118);
      m.overload_events = Math.max(0, Math.round(g() * 1.5 + (m.avg_payload > 104 ? 4 : 0) + (P.payloadBias ? 0 : 1)));

      m.fuel_lph = clamp(138 * (P.fuel || 1) + g() * 7 + (m.avg_payload - 96) * 0.55, 100, 210);

      /* #36 coolant: rising trend last N days + sharp incident window */
      let coolant = 88 + g() * 2;
      if (P.coolantRise && daysFromEnd < P.coolantRise) coolant += (P.coolantRise - daysFromEnd) * 0.55;
      if (P.coolantIncident && daysFromEnd >= -P.coolantIncident[1] && daysFromEnd <= -P.coolantIncident[0]) {
        const span = P.coolantIncident[1] - P.coolantIncident[0];
        const k = 1 - Math.abs(daysFromEnd + P.coolantIncident[0] + span / 2) / (span / 2 + 1);
        coolant += 14 * Math.max(0, k);
      }
      m.coolant_max = clamp(coolant, 78, 112);

      m.eng_oil_temp_max = clamp(96 + g() * 3 + (m.coolant_max > 95 ? (m.coolant_max - 95) * 0.8 : 0), 82, 125);
      m.oil_press_min = clamp(34 - g() * 2.5 - (rnd() < 0.03 ? 10 : 0), 12, 44);

      /* #35 boost decline over last N days */
      let boost = 72 + g() * 3;
      if (P.boostDeclineDays && daysFromEnd < P.boostDeclineDays) boost -= (P.boostDeclineDays - daysFromEnd) * 1.25;
      m.boost_avg = clamp(boost, 30, 90);
      m.blowby_avg = clamp(105 + g() * 8 + (P.boostDeclineDays && daysFromEnd < P.boostDeclineDays ? (P.boostDeclineDays - daysFromEnd) * 1.1 : 0), 70, 200);
      m.exh_temp_max = clamp(495 + g() * 18 + (m.boost_avg < 60 ? (60 - m.boost_avg) * 2.2 : 0), 420, 660);

      /* brakes */
      m.brake_temp_max = clamp(87 + g() * 4 + (dow === 6 ? 2 : 0), 68, 115);
      m.retarder_pct = clamp(26 + g() * 4 - (P.operatorMult ? 4 : 0), 6, 42);

      /* suspension — #38 episodic imbalance */
      let imbalance = 6 + Math.abs(g()) * 3;
      if (P.suspEvents) {
        for (const ev of P.suspEvents) {
          if (daysFromEnd >= -ev[1] && daysFromEnd <= -ev[0]) imbalance += 16 + g() * 4;
        }
      }
      m.susp_imbalance = clamp(imbalance, 2, 38);
      m.susp_press_rr_avg = clamp(102 + g() * 6 + (imbalance > 15 ? 14 : 0), 80, 165);

      /* operator */
      const opMul = P.operatorMult || 1;
      m.harsh_brake_events = Math.max(0, Math.round(3 + g() * 2 * opMul));
      m.overspeed_events = Math.max(0, Math.round((P.overspeedBase !== undefined ? P.overspeedBase : 1.2) + g() * 1.5 * opMul));

      /* road / undulation — shared rough-road factor some days */
      const roadFactor = 1 + Math.max(0, g() * 0.35) + (ti % 11 < 2 ? 0.5 : 0);
      m.rack_red_count = Math.max(0, Math.round((2 + g() * 2) * roadFactor));
      m.bias_red_count = Math.max(0, Math.round((2 + g() * 2) * roadFactor));
      m.undulation_p95 = clamp(10.5 * roadFactor + g() * 0.8, 7, 22);

      /* derived fuel efficiency & idle */
      m.fuel_per_ton = +(m.fuel_lph / Math.max(40, m.avg_payload * m.trips / 18)).toFixed(2) * 0.92;
      m.fuel_per_ton = clamp(m.fuel_per_ton, 0.4, 1.6);
      m.idle_pct = clamp(20 + g() * 4 + (P.idle || 0) + (m.trips < 12 ? 8 : 0), 5, 55);

      store[date][d.id] = roundMetrics(m);
      meta[d.id].add(date);
    });
  });

  return { store, meta, dates, today };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function roundMetrics(m) {
  const out = {};
  for (const k in m) out[k] = typeof m[k] === 'number' ? +m[k].toFixed(2) : m[k];
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   SYNTHETIC GPS TRACK (undulation view) — lazy per dumper+date
   Corridor polyline with hotspot spikes; deterministic per key.
   ═══════════════════════════════════════════════════════════════ */
const _trackCache = new Map();

function getTrack(dumperId, date) {
  const key = dumperId + '|' + date;
  if (_trackCache.has(key)) return _trackCache.get(key);

  const rnd = mulberry32(hashStr('track' + key));
  const C = MINE_CORRIDOR;
  const pts = [];
  const N = 160;

  /* interpolate corridor with jitter */
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const lat = C.from.lat + (C.to.lat - C.from.lat) * t + (rnd() - 0.5) * 0.0012;
    const lon = C.from.lon + (C.to.lon - C.from.lon) * t + (rnd() - 0.5) * 0.0012;
    pts.push({ lat, lon });
  }

  /* assign rack/bias: baseline noise + hotspot spikes near fixed locations */
  const redTh = UND_CFG.red, greenTh = UND_CFG.green;
  pts.forEach(p => {
    let spike = 0;
    C.hotspots.forEach(h => {
      const dist = Math.hypot(p.lat - h.lat, p.lon - h.lon);
      if (dist < 0.0022) spike = Math.max(spike, (1 - dist / 0.0022) * (10 + rnd() * 16));
    });
    p.rack = clamp(-2 + (rnd() - 0.5) * 8 + spike * (0.7 + rnd() * 0.6), -26, 26);
    p.bias = clamp(1 + (rnd() - 0.5) * 8 + spike * (0.7 + rnd() * 0.6), -24, 27);
    p.intensity = Math.max(Math.abs(p.rack), Math.abs(p.bias));
  });

  const res = { points: pts };
  _trackCache.set(key, res);
  return res;
}

/* Cluster hotspots across all tracks (~30 m ≈ 0.0003° grid) */
function computeHotspots() {
  const grid = new Map();
  FLEET.forEach(d => {
    DATA.dates.forEach(date => {
      if (!DATA.store[date] || !DATA.store[date][d.id]) return;
      getTrack(d.id, date).points.forEach(p => {
        if (p.intensity <= UND_CFG.red) return;
        const k = p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
        if (!grid.has(k)) grid.set(k, { lat: 0, lon: 0, n: 0, max: 0, dumpers: new Set(), last: date });
        const c = grid.get(k);
        c.lat += p.lat; c.lon += p.lon; c.n++;
        c.max = Math.max(c.max, p.intensity);
        c.dumpers.add(d.id);
        if (date > c.last) c.last = date;
      });
    });
  });
  const out = [...grid.values()].map(c => ({
    lat: c.lat / c.n, lon: c.lon / c.n, hits: c.n, maxIntensity: +c.max.toFixed(1),
    dumpers: [...c.dumpers], lastSeen: c.last,
  })).sort((a, b) => b.hits - a.hits).slice(0, 15);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   RAW CSV INGESTION — 45-col telemetry → daily aggregate record
   ═══════════════════════════════════════════════════════════════ */
function parseCSVRaw(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const parseRow = line => {
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
      else { if (c === '"') inQ = true; else if (c === ',') { out.push(cur.trim()); cur = ''; } else cur += c; }
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseRow(l); const o = {};
    headers.forEach((h, i) => o[h] = vals[i] !== undefined ? vals[i] : '');
    return o;
  });
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

function detectDumperFromFilename(fname) {
  const m = fname.match(/HD785-7-N(\d+)/i);
  if (!m) return null;
  const serial = 'N' + m[1];
  const hit = FLEET.find(d => d.serial.toLowerCase() === serial.toLowerCase());
  return hit ? hit.id : null;
}

/* Aggregate raw rows → one daily metric record (same keys as demo data) */
function aggregateDailyRows(rows) {
  const f = [];
  rows.forEach(r => {
    const rec = {
      rpm: num(r['Eng_Speed']), fuel: num(r['Fuel_Rate_01L']),
      spd: num(r['Vehicle_Speed_S']) !== null ? num(r['Vehicle_Speed_S']) / 60 : null, // → km/h approx
      wt: num(r['Live_Weight_ton']), hoist: num(r['Hoist_Lever_Pos']), vstate: num(r['Vehicle_State']),
      fr: num(r['Sus_Press_FR_komnet']), fl: num(r['Sus_Press_FL_komnet']),
      rr: num(r['Sus_Press_RR_komnet']), rl: num(r['Sus_Press_RL_komnet']),
      fb: num(r['Foot_Brake_Pos']), ret: num(r['Retarder_Pos']),
      rft: num(r['Retarder_F_Oil_temp']), rrt: num(r['Retarder_R_Oil_temp']),
      cool: num(r['Cool_Temp']), eot: num(r['Eng_Oil_Temp']), eop: num(r['Eng_oil_press']),
      boost: num(r['Boost_press']), blow: num(r['Blowby_Press_PM']),
      e1: num(r['Exh_temp_LBF']), e2: num(r['Exh_temp_LBR']), e3: num(r['Exh_temp_RBF']), e4: num(r['Exh_temp_RBR']),
      rack: num(r['Rack']), bias: num(r['Bias']),
    };
    if (rec.rpm !== null) f.push(rec);
  });
  if (!f.length) return null;

  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = a => Math.max(...a); const mn = a => Math.min(...a);
  const col = k => f.map(r => r[k]).filter(v => v !== null);
  const moving = r => r.spd !== null && r.spd > 1;

  /* contiguous-segment counter */
  function segments(pred) {
    let count = 0, inSeg = false;
    f.forEach(r => { if (pred(r)) { if (!inSeg) { count++; inSeg = true; } } else inSeg = false; });
    return count;
  }

  const mvWt = col('wt').filter(v => v > 0);
  const m = {};
  m.fuel_lph = +mean(col('fuel')).toFixed(1);
  m.idle_pct = +(f.filter(r => r.spd !== null && r.spd < 1 && r.rpm < 700).length / f.length * 100).toFixed(1);
  m.avg_payload = mvWt.length ? +mean(mvWt).toFixed(1) : 0;
  m.overload_events = segments(r => r.wt !== null && r.wt > 110);
  m.trips = segments(r => r.hoist !== null && r.hoist > 0 && (r.vstate === 5 || r.vstate === 6));

  const imb = f.map(r => (r.fr !== null && r.fl !== null && r.rr !== null && r.rl !== null)
    ? Math.max(Math.abs(r.fr - r.fl), Math.abs(r.rr - r.rl)) : null).filter(v => v !== null);
  m.susp_imbalance = imb.length ? +mx(imb).toFixed(1) : 0;
  const rrAvg = f.map(r => (r.rr !== null && r.rl !== null) ? (r.rr + r.rl) / 2 : null).filter(v => v !== null);
  m.susp_press_rr_avg = rrAvg.length ? +mean(rrAvg).toFixed(0) : 0;

  const btemps = [...col('rft'), ...col('rrt')];
  m.brake_temp_max = btemps.length ? +mx(btemps).toFixed(1) : 0;
  m.retarder_pct = +(f.filter(r => r.ret !== null && r.ret > 10).length / f.length * 100).toFixed(1);

  m.coolant_max = mx(col('cool')); m.eng_oil_temp_max = mx(col('eot'));
  m.oil_press_min = mn(col('eop')); m.boost_avg = +mean(col('boost')).toFixed(0);
  m.blowby_avg = +mean(col('blow')).toFixed(0);
  m.exh_temp_max = mx([...col('e1'), ...col('e2'), ...col('e3'), ...col('e4')]);

  m.harsh_brake_events = segments(r => r.fb !== null && r.fb > 80);
  m.overspeed_events = segments(r => r.spd !== null && r.spd > 35);

  m.rack_red_count = f.filter(r => r.rack !== null && Math.abs(r.rack) > UND_CFG.red).length;
  m.bias_red_count = f.filter(r => r.bias !== null && Math.abs(r.bias) > UND_CFG.red).length;
  const ints = f.map(r => (r.rack !== null && r.bias !== null) ? Math.max(Math.abs(r.rack), Math.abs(r.bias)) : null).filter(v => v !== null);
  ints.sort((a, b) => a - b);
  m.undulation_p95 = ints.length ? +ints[Math.floor(ints.length * 0.95)].toFixed(1) : 0;

  const tonsHauled = mvWt.reduce((s, v) => s + v, 0);
  m.fuel_per_ton = tonsHauled > 0 ? +(m.fuel_lph * (f.length / 3600) / (tonsHauled / 1000)).toFixed(2) : 0;

  return roundMetrics(m);
}

/* ═══════════════════════════════════════════════════════════════
   DATASTORE — unified query API used by engine + views
   ═══════════════════════════════════════════════════════════════ */
const DATA = { store: {}, meta: {}, dates: [], today: null, timeseries: {} };

function initData() {
  const demo = generateDemoData();
  DATA.store = demo.store; DATA.meta = demo.meta; DATA.dates = demo.dates; DATA.today = demo.today;
}

DataStore = {
  dates() { return DATA.dates; },
  latestDate() { return DATA.dates[DATA.dates.length - 1]; },
  hasDate(d) { return !!DATA.store[d]; },
  day(d) { return DATA.store[d] || {}; },
  record(d, id) { return (DATA.store[d] || {})[id] || null; },
  reportingDumpers(d) { return FLEET.filter(x => this.record(d, x.id)).map(x => x.id); },
  series(id, key, endDate, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(endDate, -i);
      const rec = this.record(d, id);
      out.push(rec ? rec[key] : null);
    }
    return out;
  },
  /* trailing valid values (skips maintenance days) */
  validValues(id, key, endDate, n) {
    const out = [];
    let d = endDate;
    while (out.length < n) {
      const rec = this.record(d, id);
      if (rec && rec[key] !== undefined && rec[key] !== null) out.unshift(rec[key]);
      d = addDays(d, -1);
      if (d < DATA.dates[0]) break;
    }
    return out;
  },
  ingest(fileId, fname, text) {
    const rows = parseCSVRaw(text);
    if (!rows.length) return { ok: false, msg: 'No data rows found' };
    const dumperId = detectDumperFromFilename(fname);
    const firstTime = rows[0]['Time'] || '';
    const dp = firstTime.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!dp) return { ok: false, msg: 'Cannot read date from Time column' };
    const date = `${dp[3]}-${dp[2]}-${dp[1]}`;
    const agg = aggregateDailyRows(rows);
    if (!agg) return { ok: false, msg: 'Aggregation produced no usable records' };
    if (!DATA.dates.includes(date)) { DATA.dates.push(date); DATA.dates.sort(); }
    if (!DATA.store[date]) DATA.store[date] = {};
    if (!DATA.timeseries[date]) DATA.timeseries[date] = {};
    
    DATA.store[date][dumperId || '_unassigned'] = agg;
    DATA.timeseries[date][dumperId || '_unassigned'] = rows;
    if (dumperId) {
      if (!DATA.meta[dumperId]) DATA.meta[dumperId] = new Set();
      DATA.meta[dumperId].add(date);
    }
    ENGINE_CACHE.alerts = null; // invalidate
    return { ok: true, msg: `${fname}: ${rows.length} rows → ${dumperName(dumperId) || 'UNASSIGNED'} @ ${fmtDate(date)}`, dumperId, date };
  },
};
