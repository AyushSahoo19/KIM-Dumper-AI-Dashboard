/* ═══════════════════════════════════════════════════════════════
   HaulPro Fleet Command — engine.js
   AI Alert Engine: Z-score anomalies & Playbook binding
   ═══════════════════════════════════════════════════════════════ */

window.ENGINE_CACHE = { alerts: null };

window.ENGINE = {
  /* Math helpers */
  mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; },
  std(arr, mu) {
    if (arr.length < 2) return 0;
    const v = arr.reduce((a,b)=>a+Math.pow(b-mu,2),0) / (arr.length-1);
    return Math.sqrt(v);
  },
  
  /* Run the analysis engine for a specific date across the fleet */
  run(date) {
    // If cached for this exact date and data hasn't changed, return it
    if (ENGINE_CACHE.alerts && ENGINE_CACHE.alerts.date === date) return ENGINE_CACHE.alerts.data;
    
    const dumpers = DataStore.reportingDumpers(date);
    const alerts = [];
    const moduleScores = {}; // dumperId -> { fuel: 100, ... }
    
    // Pre-calculate fleet peer averages for today
    const peerMeans = {};
    const peerStds = {};
    for (const key in PARAMS) {
      const vals = dumpers.map(id => {
        const rec = DataStore.record(date, id);
        return rec ? rec[key] : null;
      }).filter(v => v !== null && v !== undefined);
      
      if (vals.length > 0) {
        const mu = this.mean(vals);
        peerMeans[key] = mu;
        peerStds[key] = this.std(vals, mu);
      }
    }

    dumpers.forEach(id => {
      const rec = DataStore.record(date, id);
      moduleScores[id] = {};
      
      // Initialize module scores to 100
      for (const m in MODULES) moduleScores[id][MODULES[m].label] = 100;
      
      for (const key in PARAMS) {
        const P = PARAMS[key];
        const val = rec[key];
        if (val === undefined || val === null) continue;
        
        let severity = null; // 'critical', 'warning', 'info'
        let reason = '';
        let devFactor = 0; // how bad is it (for ranking)
        
        // 1. ABSOLUTE THRESHOLDS
        if (P.dir === 'high') {
          if (val >= P.crit) { severity = 'critical'; reason = `Critical high (${val} ${P.unit} ≥ ${P.crit})`; devFactor = (val-P.crit)/(P.crit)*10; }
          else if (val >= P.warn) { severity = 'warning'; reason = `Warning high (${val} ${P.unit} ≥ ${P.warn})`; devFactor = (val-P.warn)/(P.crit-P.warn)*5; }
        } else if (P.dir === 'low') {
          if (val <= P.crit) { severity = 'critical'; reason = `Critical low (${val} ${P.unit} ≤ ${P.crit})`; devFactor = (P.crit-val)/P.crit*10; }
          else if (val <= P.warn) { severity = 'warning'; reason = `Warning low (${val} ${P.unit} ≤ ${P.warn})`; devFactor = (P.warn-val)/(P.warn-P.crit)*5; }
        } else if (P.dir === 'band') {
          if (val >= P.critHi) { severity = 'critical'; reason = `Critical high (${val} ${P.unit} ≥ ${P.critHi})`; devFactor = (val-P.critHi)/P.critHi*10; }
          else if (val >= P.warnHi) { severity = 'warning'; reason = `Warning high (${val} ${P.unit} ≥ ${P.warnHi})`; devFactor = (val-P.warnHi)/(P.critHi-P.warnHi)*5; }
          else if (val <= P.critLo) { severity = 'critical'; reason = `Critical low (${val} ${P.unit} ≤ ${P.critLo})`; devFactor = (P.critLo-val)/P.critLo*10; }
          else if (val <= P.warnLo) { severity = 'warning'; reason = `Warning low (${val} ${P.unit} ≤ ${P.warnLo})`; devFactor = (P.warnLo-val)/(P.warnLo-P.critLo)*5; }
        }
        
        // 2. OWN BASELINE (Z-SCORE)
        const hist = DataStore.validValues(id, key, addDays(date, -1), ENGINE_CFG.baselineDays);
        let ownZ = 0;
        if (hist.length >= 3) {
          const mu = this.mean(hist);
          const sd = this.std(hist, mu) || (mu * 0.05); // fallback std to 5% of mean to avoid Infinity
          ownZ = (val - mu) / sd;
          
          // Only alert if it's in the 'bad' direction
          const isBad = (P.dir === 'high' && ownZ > 0) || (P.dir === 'low' && ownZ < 0) || (P.dir === 'band' && Math.abs(ownZ) > 0);
          if (isBad) {
            const absZ = Math.abs(ownZ);
            if (absZ >= ENGINE_CFG.baseCritZ && !severity) { severity = 'critical'; reason = `Anomaly: ${absZ.toFixed(1)}σ deviation from own 14-day baseline`; devFactor = absZ*2; }
            else if (absZ >= ENGINE_CFG.baseWarnZ && !severity) { severity = 'warning'; reason = `Anomaly: ${absZ.toFixed(1)}σ deviation from own 14-day baseline`; devFactor = absZ; }
          }
        }
        
        // 3. PEER COMPARISON (Z-SCORE)
        let peerZ = 0;
        if (peerMeans[key] !== undefined && peerStds[key] > 0) {
          peerZ = (val - peerMeans[key]) / peerStds[key];
          const isBad = (P.dir === 'high' && peerZ > 0) || (P.dir === 'low' && peerZ < 0) || (P.dir === 'band' && Math.abs(peerZ) > 0);
          if (isBad) {
            const absZ = Math.abs(peerZ);
            if (absZ >= ENGINE_CFG.peerCritZ && !severity) { severity = 'warning'; reason = `Fleet Outlier: ${absZ.toFixed(1)}σ worse than today's fleet average`; devFactor = absZ; }
            else if (absZ >= ENGINE_CFG.peerWarnZ && !severity) { severity = 'info'; reason = `Fleet Deviation: ${absZ.toFixed(1)}σ worse than today's fleet average`; }
          }
        }

        // Apply penalty to module score
        if (severity) {
          let penalty = severity === 'critical' ? 25 : (severity === 'warning' ? 10 : 3);
          penalty *= MODULES[P.module].weight;
          moduleScores[id][MODULES[P.module].label] = Math.max(0, moduleScores[id][MODULES[P.module].label] - penalty);
          
          alerts.push({
            id: `${id}-${key}-${date}`,
            dumperId: id,
            date: date,
            paramKey: key,
            paramDef: P,
            val: val,
            severity: severity,
            reason: reason,
            devFactor: devFactor || 1,
            ownZ: ownZ,
            peerZ: peerZ,
            playbook: PLAYBOOKS[key] || null
          });
        }
      }
    });

    // Calculate Composite Rankings
    const ranks = dumpers.map(id => {
      const scores = Object.values(moduleScores[id]);
      const composite = scores.reduce((a,b)=>a+b,0) / scores.length;
      return { id, score: composite };
    }).sort((a,b) => b.score - a.score);

    const result = { alerts, moduleScores, ranks };
    ENGINE_CACHE.alerts = { date, data: result };
    return result;
  }
};
