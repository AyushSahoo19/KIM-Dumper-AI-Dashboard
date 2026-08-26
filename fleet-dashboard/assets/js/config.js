/* ═══════════════════════════════════════════════════════════════
   HaulPro Fleet Command — config.js
   Dumper registry · parameter catalog · thresholds · action playbooks
   Everything data-driven: add a dumper or parameter here and the
   whole system (views, alerts, reports) picks it up automatically.
   ═══════════════════════════════════════════════════════════════ */

const APP = { version: '1.0', LS_PREFIX: 'haulp_' };

/* ── Fleet registry (10 × HD785-7, 100 t) ─────────────────────── */
const DEFAULT_FLEET = [
  { id: 'DMP-27', num: 27, model: 'HD785-7', capacity: 100, serial: 'N10706' },
  { id: 'DMP-28', num: 28, model: 'HD785-7', capacity: 100, serial: 'N10710' },
  { id: 'DMP-29', num: 29, model: 'HD785-7', capacity: 100, serial: 'N10711' },
  { id: 'DMP-30', num: 30, model: 'HD785-7', capacity: 100, serial: 'N10712' },
  { id: 'DMP-35', num: 35, model: 'HD785-7', capacity: 100, serial: 'N11266' },
  { id: 'DMP-36', num: 36, model: 'HD785-7', capacity: 100, serial: 'N11267' },
  { id: 'DMP-37', num: 37, model: 'HD785-7', capacity: 100, serial: 'N11268' },
  { id: 'DMP-38', num: 38, model: 'HD785-7', capacity: 100, serial: 'N11269' },
  { id: 'DMP-39', num: 39, model: 'HD785-7', capacity: 100, serial: 'N11270' },
  { id: 'DMP-40', num: 40, model: 'HD785-7', capacity: 100, serial: 'N11271' },
];

/* Identity colors used consistently across every chart */
const DUMPER_COLORS = ['#e94560','#f59e0b','#06d6a0','#00b4d8','#533483',
                       '#ec4899','#6366f1','#14b8a6','#f97316','#94a3b8'];

/* ── Health modules ───────────────────────────────────────────── */
const MODULES = {
  FUEL:        { label: 'Fuel',        icon: '⛽', weight: 1.0 },
  PAYLOAD:     { label: 'Payload',     icon: '⚖️', weight: 0.8 },
  SUSPENSION:  { label: 'Suspension',  icon: '🔩', weight: 1.1 },
  BRAKES:      { label: 'Brakes',      icon: '🛑', weight: 1.1 },
  ENGINE:      { label: 'Engine',      icon: '🔧', weight: 1.2 },
  OPERATOR:    { label: 'Operator',    icon: '👤', weight: 0.9 },
  ROAD:        { label: 'Road / Undulation', icon: '🛣️', weight: 1.0 },
  UTILIZATION: { label: 'Utilization', icon: '🕒', weight: 0.8 },
};

/* ── Parameter catalog (daily aggregates) ───────────────────────
   dir: 'high' = high is bad · 'low' = low is bad · 'band' = two-sided */
const DEFAULT_PARAMS = {
  fuel_lph:          { label:'Avg Fuel Rate',        unit:'L/h', module:'FUEL',        dir:'high', warn:165, crit:185, dec:0,
                       raw:['Fuel_Rate_01L'], agg:'mean' },
  fuel_per_ton:      { label:'Fuel per Tonne',       unit:'L/t', module:'FUEL',        dir:'high', warn:0.90, crit:1.10, dec:2,
                       derived:true },
  idle_pct:          { label:'Idle Time',            unit:'%',   module:'FUEL',        dir:'high', warn:30, crit:40, dec:1,
                       derived:true },
  avg_payload:       { label:'Avg Payload',          unit:'t',   module:'PAYLOAD',     dir:'band', warnLo:85, warnHi:108, critLo:78, critHi:115, dec:1,
                       raw:['Live_Weight_ton'], agg:'meanMoving' },
  overload_events:   { label:'Overload Events',      unit:'/day',module:'PAYLOAD',     dir:'high', warn:6, crit:12, dec:0,
                       derived:true },
  susp_imbalance:    { label:'Suspension Imbalance', unit:'kPa', module:'SUSPENSION',  dir:'high', warn:15, crit:25, dec:1,
                       derived:true },
  susp_press_rr_avg: { label:'Rear Susp Press Avg',  unit:'kPa', module:'SUSPENSION',  dir:'high', warn:120, crit:150, dec:0,
                       derived:true },
  brake_temp_max:    { label:'Brake Oil Temp Max',   unit:'°C',  module:'BRAKES',      dir:'high', warn:95, crit:105, dec:1,
                       derived:true },
  retarder_pct:      { label:'Retarder Usage',       unit:'%',   module:'BRAKES',      dir:'low',  warn:18, crit:10, dec:1,
                       derived:true },
  coolant_max:       { label:'Coolant Temp Max',     unit:'°C',  module:'ENGINE',      dir:'high', warn:95, crit:102, dec:1,
                       raw:['Cool_Temp'], agg:'max' },
  eng_oil_temp_max:  { label:'Engine Oil Temp Max',  unit:'°C',  module:'ENGINE',      dir:'high', warn:105, crit:115, dec:1,
                       raw:['Eng_Oil_Temp'], agg:'max' },
  oil_press_min:     { label:'Engine Oil Press Min', unit:'kPa', module:'ENGINE',      dir:'low',  warn:25, crit:18, dec:0,
                       raw:['Eng_oil_press'], agg:'min' },
  boost_avg:         { label:'Boost Pressure Avg',   unit:'kPa', module:'ENGINE',      dir:'low',  warn:60, crit:45, dec:0,
                       raw:['Boost_press'], agg:'mean' },
  blowby_avg:        { label:'Blowby Pressure Avg',  unit:'kPa', module:'ENGINE',      dir:'high', warn:130, crit:170, dec:0,
                       raw:['Blowby_Press_PM'], agg:'mean' },
  exh_temp_max:      { label:'Exhaust Temp Max',     unit:'°C',  module:'ENGINE',      dir:'high', warn:550, crit:620, dec:0,
                       derived:true },
  harsh_brake_events:{ label:'Harsh Braking Events', unit:'/day',module:'OPERATOR',    dir:'high', warn:8, crit:15, dec:0,
                       derived:true },
  overspeed_events:  { label:'Overspeed Events',     unit:'/day',module:'OPERATOR',    dir:'high', warn:5, crit:10, dec:0,
                       derived:true },
  rack_red_count:    { label:'Rack Red Points',      unit:'/day',module:'ROAD',        dir:'high', warn:8, crit:15, dec:0,
                       derived:true },
  bias_red_count:    { label:'Bias Red Points',      unit:'/day',module:'ROAD',        dir:'high', warn:8, crit:15, dec:0,
                       derived:true },
  undulation_p95:    { label:'Undulation Intensity P95', unit:'kPa', module:'ROAD',    dir:'high', warn:14, crit:17, dec:1,
                       derived:true },
  trips:             { label:'Trips Completed',      unit:'/day',module:'UTILIZATION', dir:'low',  warn:12, crit:8, dec:0,
                       derived:true },
};

/* ── Alert-engine tuning (editable in Settings) ───────────────── */
const DEFAULT_ENGINE_CFG = {
  baselineDays: 14,     // trailing valid days for own-baseline z-score
  baseWarnZ: 2.5,       // own-baseline z → warning
  baseCritZ: 3.5,       // own-baseline z → critical
  peerWarnZ: 2.0,       // same-day fleet z → info
  peerCritZ: 3.0,       // same-day fleet z → warning
};

/* ── Action playbooks: what each abnormality means & who does what ── */
const PLAYBOOKS = {
  fuel_lph: {
    causes: ['Injector nozzle wear / dribble','Air-filter clog choking intake','Fuel leak on high-pressure line','Excessive idling between shifts','Turbo under-boosting'],
    ops: ['Audit idle logs with operator; coach on engine-off waits','Verify route gradient profile hasn\'t changed (longer loaded pull)','Check if payload creep is driving burn — cross-check avg_payload'],
    maint: ['Sample injectors — pop-test & clean nozzles','Replace air filter element, inspect ducting for leaks','Calibrate fuel rail pressure sensor','Turbo: check shaft play & boost hoses'],
  },
  fuel_per_ton: {
    causes: ['Payload down while fuel flat (haul efficiency loss)','Road deterioration raising rolling resistance','Tyre under-inflation increasing drag'],
    ops: ['Compare haul-cycle times vs last week — spot slow segments','Review road grading schedule for the assigned pit face'],
    maint: ['Check tyre pressures & tread across all 6 wheels','Inspect brakes for dragging (heat scan after cycle)'],
  },
  idle_pct: {
    causes: ['Excessive queue time at shovel / crusher','Operator leaving engine idling during waits','Shift-change overlap with engine running'],
    ops: ['Analyse dispatch/queue data for the loading face','Enforce engine-off policy for waits > 5 min','Stagger shift change to cut idle overlap'],
    maint: ['None specific — operational issue; verify no drivetrain fault forcing stops'],
  },
  avg_payload: {
    causes: ['Shopper (shovel) over-loading the pass','Weighbridge / body sensor drift','Assigned to short-haul light-duty cycle'],
    ops: ['Brief shovel operator on target 96–100 t passes','Re-validate body payload calibration against weighbridge'],
    maint: ['Verify Live_Weight sensor calibration & suspension reference height'],
  },
  overload_events: {
    causes: ['Repeated double-pass loading at shovel','Deliberate overloading to meet tonnage targets'],
    ops: ['Immediate: cap passes at rated 100 t — frame & suspension fatigue risk','Escalate to production head if pattern persists > 2 days'],
    maint: ['Inspect suspension cylinders & frame welds for stress signs after overload spells'],
  },
  susp_imbalance: {
    causes: ['Uneven road crown / potholes on one side','Suspension cylinder nitrogen charge loss on one corner','Uneven load distribution in body'],
    ops: ['Flag road segment for grading — note km post / landmark','Instruct operator to report ride harshness location'],
    maint: ['Nitrogen recharge test on all 4 struts — compare FR vs FL, RR vs RL','Inspect cylinder rod seals for oil weeping','Check body liner shift causing off-center load'],
  },
  susp_press_rr_avg: {
    causes: ['Chronic rear overloading','Rear strut charging degradation','Rough dump-yard approach pounding'],
    ops: ['Reduce rear-body loading bias; review dump approach speed ≤ 15 km/h'],
    maint: ['Recharge rear struts to spec; inspect rebound bushes','Measure suspension ride height vs OEM minimum'],
  },
  brake_temp_max: {
    causes: ['Long downhill with foot-brake riding instead of retarder','Dragging brake caliper / retarded release','Brake oil degradation losing cooling'],
    ops: ['Coach: retarder-first braking on Ramp 2 descent','Enforce cool-down stop at ramp base before dump'],
    maint: ['Scan all wheels after cycle for dragging caliper','Test brake oil quality (boiling point); replace if degraded','Inspect retarder heat exchanger for plugging'],
  },
  retarder_pct: {
    causes: ['Operator using foot brake / downshift instead of retarder','Retarder lever fault or low retarder oil'],
    ops: ['Retraining session: retarder-first technique on grades','Monitor next 3 days for behavior change'],
    maint: ['Verify retarder lever position sensor & oil level/temperature'],
  },
  coolant_max: {
    causes: ['Radiator fins choked with dust / debris','Coolant level low or slow leak','Fan belt slip / fan clutch fault','Thermostat stuck partially closed','Sustained overload + high ambient'],
    ops: ['Cap payload ~10% until cleared','Enforce mid-shift cool-down in hot window','Move to cooler haul assignment if available'],
    maint: ['TODAY: blow-clean radiator core & check coolant level/leaks','Pressure-test cooling system; verify thermostat opening temp','Check fan belt tension & hub clutch operation'],
  },
  eng_oil_temp_max: {
    causes: ['Oil cooler plugging','Heavy lugging at low gear / high load factor','Oil past change interval losing viscosity'],
    ops: ['Avoid sustained full-throttle climbs; use gear discipline'],
    maint: ['Clean/flush oil cooler matrix','Verify oil grade & hours since last change — sample lab test'],
  },
  oil_press_min: {
    causes: ['Oil level low / pump suction issue','Bearing wear dropping pressure','Pressure relief valve sticking','Sensor fault'],
    ops: ['Restrict from heavy haul until cleared — bearing seizure risk'],
    maint: ['URGENT: verify with mechanical gauge before next start','Top up to correct level; inspect for leaks','If confirmed low: plan immediate inspection — do not defer'],
  },
  boost_avg: {
    causes: ['Air filter clogging progressively','Turbo hose leak / intercooler boot split','Turbo wheel wear / shaft play','Altitude + ambient derate'],
    ops: ['Note rising trend — schedule inspection within 48 h','Avoid max-throttle operation meanwhile'],
    maint: ['Replace air filter; smoke-test charge-air circuit for leaks','Inspect turbo: shaft play, oil traces at compressor inlet','Verify boost pressure sensor against gauge'],
  },
  blowby_avg: {
    causes: ['Piston ring / liner wear (rising trend)','Crankcase breather clogged','Over-fueling at high load factor'],
    ops: ['Track trend — escalate if 3-day rise continues'],
    maint: ['Clean crankcase breather assembly','If trend persists: compression test & plan top-end overhaul window'],
  },
  exh_temp_max: {
    causes: ['Over-fueling / injector drip','Aftercooler fouling','Air restriction (filter)','Timing advance fault'],
    ops: ['Watch alongside boost & fuel trends'],
    maint: ['Pull injector samples for spray pattern test','Clean charge-air cooler; replace air filter if ΔP high'],
  },
  harsh_brake_events: {
    causes: ['Late braking at junctions / dump edge','Speed too high into restricted zones','Brake response fade prompting harder stabs'],
    ops: ['One-on-one coaching with GPS event replay','Refresh speed-board signage at flagged segments'],
    maint: ['Check pedal valve response & brake adjustment'],
  },
  overspeed_events: {
    causes: ['Habitual speeding on straight haul segment','Schedule pressure pushing pace','Speed limiter set too high / disabled'],
    ops: ['Coaching + acknowledge sheet; repeat offense → reassignment','Review cycle time allocation — unrealistic targets cause rushing'],
    maint: ['Verify speed limiter configuration & GPS speed calibration'],
  },
  rack_red_count: {
    causes: ['New potholes / corrugation forming on route','Spill material not cleared after blast','Drainage washout softening shoulder'],
    ops: ['Mark segment for grader pass — share KML hotspot coordinates','Divert traffic lane around hotspot where safe'],
    maint: ['Deploy road maintenance crew with graders to flagged chainage'],
  },
  bias_red_count: {
    causes: ['Road camber broken on one side','Edge drop-off forcing one-wheel tracking','Settled patch after water-line leak'],
    ops: ['Keep dumpers centered; avoid edge tracking at flagged curve'],
    maint: ['Grade for correct camber; repair shoulder edge'],
  },
  undulation_p95: {
    causes: ['Overall road roughness rising on primary haul','Increased loaded-speed amplifying impacts'],
    ops: ['Consider advisory speed limit reduction on worst segment'],
    maint: ['Full-length road condition survey; prioritize grading queue'],
  },
  trips: {
    causes: ['Extended downtime / breakdown','Shovel availability limiting loading','Operator shortage / shift gap'],
    ops: ['Cross-check dispatch log for queue & downtime reasons','Balance assignments across available units'],
    maint: ['Review breakdown orders for this unit — recurring faults?'],
  },
};

/* ── Undulation thresholds (KML parity) ───────────────────────── */
const DEFAULT_UNDULATION = { green: 12.0, red: 16.1 };

/* Synthetic mine corridor for demo track map */
const MINE_CORRIDOR = {
  center: { lat: 21.9460, lon: 85.3830 },
  from: { lat: 21.9386, lon: 85.3786 },
  to:   { lat: 21.9534, lon: 85.3875 },
  hotspots: [
    { lat: 21.94720, lon: 85.38010, name: 'Ramp 2 Curve' },
    { lat: 21.95100, lon: 85.38520, name: 'Pit Road K3' },
    { lat: 21.94300, lon: 85.38680, name: 'Dump Yard Approach' },
  ],
};

/* ── localStorage helpers (registry/thresholds/engine cfg persist) ── */
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(APP.LS_PREFIX + key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(APP.LS_PREFIX + key, JSON.stringify(val)); } catch (e) {}
}

/* Effective runtime config = defaults overridden by saved edits */
let FLEET        = lsGet('fleet', null) || JSON.parse(JSON.stringify(DEFAULT_FLEET));
let PARAMS       = Object.assign(JSON.parse(JSON.stringify(DEFAULT_PARAMS)), lsGet('paramOverrides', {}));
let ENGINE_CFG   = Object.assign({}, DEFAULT_ENGINE_CFG, lsGet('engineCfg', {}));
let UND_CFG      = Object.assign({}, DEFAULT_UNDULATION, lsGet('undCfg', {}));

function dumperColor(id) {
  const i = FLEET.findIndex(d => d.id === id);
  return DUMPER_COLORS[(i < 0 ? 0 : i) % DUMPER_COLORS.length];
}
function dumperName(id) {
  const d = FLEET.find(x => x.id === id);
  return d ? `HD785-7 · #${d.num}` : id;
}
