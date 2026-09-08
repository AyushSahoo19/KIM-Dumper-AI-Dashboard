/* ═══════════════════════════════════════════════════════════════
   HaulPro Fleet Command — views.js
   DOM manipulation, Chart.js wrappers, and UI state
   ═══════════════════════════════════════════════════════════════ */

// Initialize Chart defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#1e293b';
Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
Chart.defaults.plugins.tooltip.borderColor = '#334155';
Chart.defaults.plugins.tooltip.borderWidth = 1;

window.CHARTS = {};

window.VIEWS = {
  activeSection: 'command',
  currentDate: null,
  currentDumper: null,

  toast(msg, type='ok') {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = type==='ok' ? `<span>✅</span> ${msg}` : `<span>⚠️</span> ${msg}`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  },

  destroyChart(id) {
    if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
  },

  renderCurrent() {
    const y = document.getElementById('global-year')?.value;
    const m = document.getElementById('global-month')?.value;
    const d = document.getElementById('global-day')?.value;
    
    if (y && m && d) {
      this.currentDate = `${y}-${m}-${d}`;
    } else {
      this.currentDate = DataStore.latestDate();
    }
    const dp = document.getElementById('global-dumper').value;
    this.currentDumper = dp === "" ? null : dp;
    
    // Update active UI
    document.querySelectorAll('.sidebar-nav a').forEach(el => el.classList.remove('active'));
    document.querySelector(`.sidebar-nav a[data-section="${this.activeSection}"]`).classList.add('active');
    
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(`sec-${this.activeSection}`).classList.add('active');
    
    // Generate Engine Data
    const engineData = window.ENGINE.run(this.currentDate);
    
    // Update Badge
    const alertCount = engineData.alerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length;
    document.getElementById('nav-alert-badge').textContent = alertCount;
    document.getElementById('nav-alert-badge').style.display = alertCount > 0 ? 'inline-block' : 'none';

    // Page title
    const titles={command:'Command Center', dumper:'Dumper 360', compare:'Fleet Comparison', undulation:'Undulation Monitor', settings:'Settings & Data', alerts:'Alerts & Actions', analytics:'Analytics Lab', monthly:'Monthly Reports', gmap:'Google Map Track', 'gradient-kml':'Gradient KML Map'};
    const titleEl=document.getElementById('page-title'); if(titleEl) titleEl.textContent=titles[this.activeSection]|| this.activeSection;
    // Route to renderer
    if (this.activeSection === 'command') this.renderCommand(engineData);
    else if (this.activeSection === 'dumper') this.renderDumper(engineData);
    else if (this.activeSection === 'compare') this.renderCompare(engineData);
    else if (this.activeSection === 'undulation') this.renderUndulation();
    else if (this.activeSection === 'settings') this.renderSettings();
    else if (this.activeSection === 'alerts') this.renderAlerts(engineData);
    else if (this.activeSection === 'analytics') this.renderAnalytics();
    else if (this.activeSection === 'gmap') this.renderGmap();
    else if (this.activeSection === 'gradient-kml') this.renderGradientKml();
    else if (this.activeSection === 'monthly') { const b=document.getElementById('mo-body'); if(b) b.innerHTML='<div style="color:var(--text-sec);padding:40px;text-align:center">Monthly roll-ups — available after 30-day aggregation. Use Analytics Lab for August 8 deep-dive.</div>'; }
  },

  /* ── 1.25. ALERTS & ACTIONS ── */
  renderAlerts(engine) {
    const list = document.getElementById('al-list');
    const stats = document.getElementById('al-stats');
    
    // Sort alerts by severity (critical first)
    const sortedAlerts = [...engine.alerts].sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.devFactor - a.devFactor;
    });

    const critCount = sortedAlerts.filter(a => a.severity === 'critical').length;
    const warnCount = sortedAlerts.filter(a => a.severity === 'warning').length;
    
    stats.innerHTML = `
      <div style="display:flex; gap:16px; margin-bottom:16px;">
        <div style="background:rgba(239, 68, 68, 0.1); color:#ef4444; padding:8px 16px; border-radius:6px; font-weight:600;">🚨 ${critCount} Critical</div>
        <div style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; padding:8px 16px; border-radius:6px; font-weight:600;">⚠️ ${warnCount} Warning</div>
      </div>
    `;
    
    if (sortedAlerts.length === 0) {
      list.innerHTML = '<div style="color:var(--text-sec);text-align:center;padding:40px;">No alerts detected for the selected date. Fleet is operating within normal parameters.</div>';
      return;
    }
    
    let html = '';
    sortedAlerts.forEach(a => {
      const isCrit = a.severity === 'critical';
      const color = isCrit ? '#ef4444' : '#f59e0b';
      const bg = isCrit ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)';
      const border = isCrit ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';
      const icon = isCrit ? '🚨' : '⚠️';
      
      let playbookHtml = '';
      if (a.playbook) {
        const p = a.playbook;
        const renderList = (items) => items.map(i => `<li>${i}</li>`).join('');
        
        playbookHtml = `
          <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
            <div>
              <h4 style="color:var(--text-sec); font-size:0.85rem; margin-bottom:8px;">🔍 Possible Causes</h4>
              <ul style="margin:0; padding-left:16px; font-size:0.85rem; color:var(--text-main);">${renderList(p.causes)}</ul>
            </div>
            <div>
              <h4 style="color:var(--text-sec); font-size:0.85rem; margin-bottom:8px;">👷 Operations Actions</h4>
              <ul style="margin:0; padding-left:16px; font-size:0.85rem; color:var(--text-main);">${renderList(p.ops)}</ul>
            </div>
            <div>
              <h4 style="color:var(--text-sec); font-size:0.85rem; margin-bottom:8px;">🔧 Maintenance Actions</h4>
              <ul style="margin:0; padding-left:16px; font-size:0.85rem; color:var(--text-main);">${renderList(p.maint)}</ul>
            </div>
          </div>
        `;
      }
      
      html += `
        <div style="background:${bg}; border:1px solid ${border}; border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:600; color:${color}; margin-bottom:4px; font-size:1.1rem;">
                ${icon} ${dumperName(a.dumperId)} — ${a.paramDef.label}
              </div>
              <div style="color:var(--text-sec); font-size:0.9rem;">
                Recorded Value: <strong>${a.val.toFixed(a.paramDef.dec)} ${a.paramDef.unit}</strong> · ${a.reason}
              </div>
            </div>
            <div style="background:var(--bg-elevated); padding:4px 12px; border-radius:4px; font-size:0.8rem; color:var(--text-sec); border: 1px solid var(--border-color);">
              ${a.paramDef.module}
            </div>
          </div>
          ${playbookHtml}
        </div>
      `;
    });
    
    list.innerHTML = html;
  },

  /* ── 1.5. DUMPER 360 ── */
  renderDumper(engine) {
    const sel = document.getElementById('d360-select');
    if (!sel.options.length) {
      sel.add(new Option('Select Dumper...', ''));
      FLEET.forEach(d => sel.add(new Option(dumperName(d.id), d.id)));
      sel.onchange = () => {
        document.getElementById('global-dumper').value = sel.value;
        VIEWS.renderCurrent();
      };
    }
    
    // Sync select value
    sel.value = this.currentDumper || '';
    
    const body = document.getElementById('d360-body');
    
    if (!this.currentDumper) {
      body.innerHTML = '<div style="color:var(--text-sec);text-align:center;padding:40px;">Please select a dumper from the top right or the dropdown above to view its detailed timeline.</div>';
      return;
    }
    
    const tsData = (DATA.timeseries[this.currentDate] && DATA.timeseries[this.currentDate][this.currentDumper]) ? DATA.timeseries[this.currentDate][this.currentDumper] : null;
    
    if (!tsData || tsData.length === 0) {
      body.innerHTML = `<div style="color:var(--text-sec);text-align:center;padding:40px;">No raw time-series data available for ${dumperName(this.currentDumper)} on ${fmtDate(this.currentDate)}.<br><br><small>To view these charts, upload the raw CSV file for this session in the Settings tab.</small></div>`;
      return;
    }

    body.innerHTML = `
      <div class="grid grid-2">
        <div class="card"><h3>Fuel Rate & Altitude</h3><p class="sub">Fuel consumption vs elevation over time</p><div class="chart-wrap tall"><canvas id="ch-d360-fuel"></canvas></div></div>
        <div class="card"><h3>Suspension Pressures</h3><p class="sub">FL, FR, RL, RR cylinders</p><div class="chart-wrap tall"><canvas id="ch-d360-susp"></canvas></div></div>
      </div>
      <div class="grid grid-2">
        <div class="card"><h3>Live Weight</h3><p class="sub">Payload timeline</p><div class="chart-wrap tall"><canvas id="ch-d360-weight"></canvas></div></div>
        <div class="card"><h3>Brake Usage & Temps</h3><p class="sub">Retarder, foot brake, and retarder oil temps</p><div class="chart-wrap tall"><canvas id="ch-d360-brake"></canvas></div></div>
      </div>
      <div class="grid grid-1">
        <div class="card"><h3>Rack & Bias</h3><p class="sub">Suspension articulation intensity</p><div class="chart-wrap sm"><canvas id="ch-d360-rack"></canvas></div></div>
      </div>
    `;

    // Data parsing helpers
    const extract = (key) => tsData.map(r => r[key] !== undefined && r[key] !== '' ? parseFloat(r[key]) : null);
    const times = extract('Time') || tsData.map((_, i) => i);
    // Since 'Time' is a string in CSV, we map it to string directly:
    const labels = tsData.map((r, i) => r.Time ? r.Time.split(' ')[1] : i); // Just keep HH:MM if possible

    const num = (k) => extract(k);

    const makeLineChart = (id, datasets, options = {}) => {
      this.destroyChart(id);
      const ctx = document.getElementById(id).getContext('2d');
      CHARTS[id] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          elements: { point: { radius: 0 } },
          interaction: { mode: 'index', intersect: false },
          scales: { x: { ticks: { maxTicksLimit: 10 } } },
          ...options
        }
      });
    };

    // 1. Fuel & Altitude
    makeLineChart('ch-d360-fuel', [
      { label: 'Fuel Rate (L/h)', data: num('Fuel_Rate_01L'), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, yAxisID: 'y' },
      { label: 'Altitude (m)', data: num('GPS_Altitude'), borderColor: '#94a3b8', borderDash: [5, 5], yAxisID: 'y1' }
    ], {
      scales: { y: { type: 'linear', position: 'left' }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } } }
    });

    // 2. Suspension Pressures
    makeLineChart('ch-d360-susp', [
      { label: 'FL', data: num('Sus_Press_FL_komnet'), borderColor: '#3b82f6' },
      { label: 'FR', data: num('Sus_Press_FR_komnet'), borderColor: '#0ea5e9' },
      { label: 'RL', data: num('Sus_Press_RL_komnet'), borderColor: '#f59e0b' },
      { label: 'RR', data: num('Sus_Press_RR_komnet'), borderColor: '#eab308' }
    ]);

    // 3. Live Weight
    makeLineChart('ch-d360-weight', [
      { label: 'Weight (t)', data: num('Live_Weight_ton'), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }
    ]);

    // 4. Brakes & Temps
    makeLineChart('ch-d360-brake', [
      { label: 'Retarder Pos (%)', data: num('Retarder_Pos'), borderColor: '#3b82f6', fill: true, backgroundColor: 'rgba(59, 130, 246, 0.2)', yAxisID: 'y' },
      { label: 'Foot Brake (%)', data: num('Foot_Brake_Pos'), borderColor: '#ef4444', fill: true, backgroundColor: 'rgba(239, 68, 68, 0.2)', yAxisID: 'y' },
      { label: 'Retarder Temp (°C)', data: num('Retarder_R_Oil_temp'), borderColor: '#f59e0b', yAxisID: 'y1' }
    ], {
      scales: { y: { type: 'linear', position: 'left', min: 0, max: 100 }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } } }
    });

    // 5. Rack & Bias
    makeLineChart('ch-d360-rack', [
      { label: 'Rack', data: num('Rack'), borderColor: '#eab308', borderWidth: 1 },
      { label: 'Bias', data: num('Bias'), borderColor: '#0ea5e9', borderWidth: 1 }
    ]);
  },

  /* ── 2. COMMAND CENTER ── */
  renderCommand(engine) {
    const dumpers = DataStore.reportingDumpers(this.currentDate);
    
    // 1. KPIs
    const kpis = document.getElementById('cmd-kpis');
    let avgFuel = 0, avgPayload = 0, idleTot = 0, tripsTot = 0;
    dumpers.forEach(id => {
      const r = DataStore.record(this.currentDate, id);
      avgFuel += r.fuel_lph || 0; avgPayload += r.avg_payload || 0;
      idleTot += r.idle_pct || 0; tripsTot += r.trips || 0;
    });
    const N = dumpers.length || 1;
    
    kpis.innerHTML = `
      <div class="kpi">
        <div class="l">Active Fleet</div>
        <div class="v">${dumpers.length}<span class="u">/ ${FLEET.length}</span></div>
      </div>
      <div class="kpi">
        <div class="l">Fleet Avg Payload</div>
        <div class="v">${(avgPayload/N).toFixed(1)}<span class="u">t</span></div>
      </div>
      <div class="kpi">
        <div class="l">Fleet Avg Fuel</div>
        <div class="v">${(avgFuel/N).toFixed(1)}<span class="u">L/h</span></div>
      </div>
      <div class="kpi">
        <div class="l">Total Trips</div>
        <div class="v">${tripsTot}</div>
      </div>
    `;

    // 2. Health Matrix
    const matrix = document.getElementById('cmd-matrix');
    const modules = Object.values(MODULES);
    let html = `<div class="matrix-header">Unit</div>`;
    modules.forEach(m => html += `<div class="matrix-header" title="${m.label}">${m.icon}</div>`);
    
    dumpers.forEach(id => {
      html += `<div class="matrix-label">${dumperName(id)}</div>`;
      modules.forEach(m => {
        const score = engine.moduleScores[id][m.label];
        let color = '#10b981'; // green
        if (score < 60) color = '#ef4444'; // red
        else if (score < 90) color = '#f59e0b'; // orange
        
        html += `<div class="matrix-cell" style="color: ${color};" title="${m.label}: ${score}">${score}</div>`;
      });
    });
    matrix.innerHTML = html;

    // 3. Insights List
    const insights = document.getElementById('cmd-insights');
    if (engine.alerts.length === 0) {
      insights.innerHTML = `<div class="insight-item info">✅ No active alerts for ${fmtDateShort(this.currentDate)}.</div>`;
    } else {
      // Sort: critical first, then devFactor
      const sorted = engine.alerts.sort((a,b) => {
        const w = { critical: 3, warning: 2, info: 1 };
        if (w[a.severity] !== w[b.severity]) return w[b.severity] - w[a.severity];
        return b.devFactor - a.devFactor;
      }).slice(0, 10);
      
      let alertsHtml = '';
      sorted.forEach(a => {
        let acts = '';
        if (a.playbook) {
          acts += `<strong>Ops:</strong> ${a.playbook.ops[0]}<br>`;
          acts += `<strong>Maint:</strong> ${a.playbook.maint[0]}`;
        }
        alertsHtml += `
          <div class="insight-item ${a.severity}">
            <div class="insight-head">
              <span class="insight-unit">${a.paramDef.module ? MODULES[a.paramDef.module].icon : ''} ${dumperName(a.dumperId)}</span>
              <span class="insight-time">${a.paramDef.label}</span>
            </div>
            <div class="insight-title">${a.reason}</div>
            <div class="insight-actions">${acts}</div>
          </div>
        `;
      });
      insights.innerHTML = alertsHtml;
    }

    // 4. Charts
    this.renderSeverityChart(engine.alerts);
    this.renderRankChart(engine.ranks);
  },

  renderSeverityChart(alerts) {
    this.destroyChart('ch-sev-donut');
    const counts = { critical: 0, warning: 0, info: 0 };
    alerts.forEach(a => counts[a.severity]++);
    
    const ctx = document.getElementById('ch-sev-donut').getContext('2d');
    CHARTS['ch-sev-donut'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Warning', 'Info'],
        datasets: [{
          data: [counts.critical, counts.warning, counts.info],
          backgroundColor: ['#ef4444', '#f59e0b', '#0ea5e9'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
    });
  },

  renderRankChart(ranks) {
    this.destroyChart('ch-rank-bar');
    const ctx = document.getElementById('ch-rank-bar').getContext('2d');
    CHARTS['ch-rank-bar'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ranks.map(r => r.id),
        datasets: [{
          label: 'Composite Score',
          data: ranks.map(r => r.score),
          backgroundColor: ranks.map(r => r.score < 75 ? '#ef4444' : (r.score < 90 ? '#f59e0b' : '#10b981')),
          borderRadius: 4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });
  },

  /* ── 2. FLEET COMPARISON ── */
  renderCompare(engine) {
    const sel = document.getElementById('cmp-param');
    if (!sel.options.length) {
      for (const k in PARAMS) sel.add(new Option(PARAMS[k].label, k));
      sel.onchange = () => this.renderCompare(window.ENGINE.run(this.currentDate));
    }
    const paramKey = sel.value;
    const P = PARAMS[paramKey];
    const dumpers = DataStore.reportingDumpers(this.currentDate);
    
    const dataVals = dumpers.map(id => DataStore.record(this.currentDate, id)[paramKey]);

    this.destroyChart('ch-cmp-bar');
    const ctx = document.getElementById('ch-cmp-bar').getContext('2d');
    CHARTS['ch-cmp-bar'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dumpers,
        datasets: [{
          label: `${P.label} (${P.unit})`,
          data: dataVals,
          backgroundColor: dumpers.map(id => dumperColor(id)),
          borderRadius: 4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  },

  /* ── 3. UNDULATION ── */
  renderUndulation() {
    const mapEl = document.getElementById('un-map');
    const dumpers = DataStore.reportingDumpers(this.currentDate);
    if (!dumpers.length) { mapEl.innerHTML = '<div style="color:#94a3b8;padding:20px;">No tracks available for this date.</div>'; return; }
    
    // Simple HTML visualizer since we can't load Google Maps easily in offline prototype
    const track = getTrack(dumpers[0], this.currentDate);
    let mapHtml = '';
    
    track.points.forEach(p => {
      // normalize lat/lon to 0-100% for plotting
      const latPct = (p.lat - 21.938) / (21.954 - 21.938) * 100;
      const lonPct = (p.lon - 85.378) / (85.388 - 85.378) * 100;
      
      let color = '#334155';
      let size = 3;
      if (p.intensity >= UND_CFG.red) { color = '#ef4444'; size = 8; }
      else if (p.intensity >= UND_CFG.green) { color = '#10b981'; size = 5; }
      
      mapHtml += `<div style="position:absolute; bottom:${latPct}%; left:${lonPct}%; width:${size}px; height:${size}px; background:${color}; border-radius:50%; transform:translate(-50%,50%);"></div>`;
    });
    
    mapEl.innerHTML = mapHtml;
    
    // Render Hotspots table
    const hotspots = computeHotspots();
    const tbody = document.getElementById('un-hotspots');
    tbody.innerHTML = `<tr><th>Coordinates</th><th>Hits (All Time)</th><th>Max Intensity</th><th>Last Seen</th></tr>` + 
      hotspots.map(h => `<tr>
        <td>${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}</td>
        <td>${h.hits}</td>
        <td style="color:var(--danger);font-weight:bold;">${h.maxIntensity} kPa</td>
        <td>${fmtDateShort(h.lastSeen)}</td>
      </tr>`).join('');
  },

  /* ── 4. SETTINGS ── */
  renderSettings() {
    const reg = document.getElementById('st-registry');
    reg.innerHTML = `<tr><th>Unit</th><th>Model</th><th>Capacity</th><th>Serial</th></tr>` + 
      FLEET.map(d => `<tr><td>${d.id}</td><td>${d.model}</td><td>${d.capacity}t</td><td>${d.serial}</td></tr>`).join('');
      
    const th = document.getElementById('st-thresholds');
    let thHtml = `<tr><th>Parameter</th><th>Warning</th><th>Critical</th></tr>`;
    for (const k in PARAMS) {
      const P = PARAMS[k];
      let valW = P.dir === 'band' ? `${P.warnLo} - ${P.warnHi}` : P.warn;
      let valC = P.dir === 'band' ? `${P.critLo} - ${P.critHi}` : P.crit;
      thHtml += `<tr><td>${P.label} (${P.unit})</td><td style="color:var(--warning)">${valW}</td><td style="color:var(--danger)">${valC}</td></tr>`;
    }
    th.innerHTML = thHtml;
  },

  /* ═══════════════════════════════════════════════════════════════
     5. ANALYTICS LAB — Fuel vs Speed Heatmap · RPM Dumping · Gradient-Retarder
     ═══════════════════════════════════════════════════════════════ */
  renderAnalytics(){
    const sel = document.getElementById('an-dumper');
    if(!sel.options.length){
      sel.add(new Option('All Dumpers (aggregate)', ''));
      FLEET.forEach(d=> sel.add(new Option(dumperName(d.id), d.id)));
      sel.value = this.currentDumper || '';
      sel.onchange = ()=>{ document.getElementById('global-dumper').value = sel.value; VIEWS.renderCurrent(); };
    } else {
      sel.value = this.currentDumper || '';
    }
    document.getElementById('an-analyse').onclick = ()=> VIEWS.renderCurrent();
    // collect rows
    const rows = this._getAnalyticsRows(this.currentDate, this.currentDumper);
    const meta = document.getElementById('an-meta');
    meta.textContent = rows.length ? `${rows.length} telemetry points · ${fmtDate(this.currentDate)} · ${this.currentDumper ? dumperName(this.currentDumper) : 'fleet aggregate'}` : `No raw telemetry for ${fmtDate(this.currentDate)} — showing synthetic demo ( August 8 profile )`;
    // Use synthetic fallback if empty
    const effRows = rows.length ? rows : this._syntheticAugustRows();
    this._renderFuelSpeedHeatmap(effRows);
    this._renderRouteHeatmap(effRows);
    this._renderRPMDumping(effRows);
    this._renderDumpingCycles(effRows);
    this._renderLocationWiseDumping(effRows);
    this._renderGradientRetarder(effRows);
    this._renderAnalyticsInsights(effRows);
  },

  renderGmap(){
    const sel = document.getElementById('gm-dumper');
    if(sel && !sel.options.length){
      sel.add(new Option('All Dumpers (aggregate)', ''));
      FLEET.forEach(d=> sel.add(new Option(dumperName(d.id), d.id)));
      sel.value = this.currentDumper || '';
      sel.onchange = ()=>{ document.getElementById('global-dumper').value = sel.value; VIEWS.renderCurrent(); };
    } else if(sel) sel.value = this.currentDumper || '';
    const modeSel = document.getElementById('gm-mode');
    const baseSel = document.getElementById('gm-basemap');
    const fitBtn = document.getElementById('gm-fit');
    const playBtn = document.getElementById('gm-play');
    const heatChk = document.getElementById('gm-heat');
    const metaEl = document.getElementById('gm-meta');
    const rows = this._getAnalyticsRows(this.currentDate, this.currentDumper);
    const effRows = rows.length ? rows : this._syntheticAugustRows();
    const mode = (modeSel && modeSel.value) || 'fuel';
    const valid = effRows.filter(r=> r.lat!=null && r.lon!=null && isFinite(r.lat) && isFinite(r.lon));
    window._gmapLastValid = valid; window._gmapLastDate = this.currentDate; window._gmapLastDumper = this.currentDumper;
    // integrated dumping vs RPM filter like fuel/speed — when mode is dump*, path shows only dumping points
    let _gmapDisplayValid = valid;
    let _gmapDumpPoints = valid.filter(r=> parseFloat(r.hoist)>0.5);
    if(mode==='dumpRpm') _gmapDisplayValid = _gmapDumpPoints.length? _gmapDumpPoints : valid;
    else if(mode==='dumpAbove'){ const f=_gmapDumpPoints.filter(r=> (r.rpm||0)>700); _gmapDisplayValid = f.length? f : _gmapDumpPoints; }
    else if(mode==='dumpBelow'){ const f=_gmapDumpPoints.filter(r=> (r.rpm||0)<=700); _gmapDisplayValid = f.length? f : _gmapDumpPoints; }
    if(metaEl) metaEl.textContent = valid.length ? `${valid.length} GPS points · ${fmtDate(this.currentDate)} · ${this.currentDumper? dumperName(this.currentDumper):'fleet aggregate'}` : `No GPS points for ${fmtDate(this.currentDate)} — showing synthetic corridor`;
    if(typeof L==='undefined'){
      document.getElementById('gmap').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-sec);padding:40px;text-align:center">Leaflet failed to load (offline). Check CDN <code>unpkg.com/leaflet</code> is reachable.</div>';
      return;
    }
    // init map once
    if(!window._gmap){
      window._gmap = L.map('gmap', { zoomControl:true, attributionControl:true }).setView([MINE_CORRIDOR.center.lat, MINE_CORRIDOR.center.lon], 15);
      window._gmapLayers = { tile:null, segments:[], markers:[], heat:[] };
    }
    const map = window._gmap;
    // tile layer switch
    const base = (baseSel && baseSel.value) || 'roadmap';
    const tileUrls = {
      roadmap: 'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      satellite: 'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      hybrid: 'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      terrain: 'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
    };
    const tileInfo = document.getElementById('gm-tile-info');
    if(tileInfo) tileInfo.textContent = base + ' — ' + (tileUrls[base]||tileUrls.roadmap);
    if(window._gmapLayers.tile) map.removeLayer(window._gmapLayers.tile);
    window._gmapLayers.tile = L.tileLayer(tileUrls[base] || tileUrls.roadmap, { maxZoom:20, subdomains:['mt0','mt1','mt2','mt3'], attribution:'© Google &bull; HaulPro' });
    window._gmapLayers.tile.addTo(map);
    // clear old
    window._gmapLayers.segments.forEach(l=> map.removeLayer(l)); window._gmapLayers.segments=[];
    window._gmapLayers.markers.forEach(m=> map.removeLayer(m)); window._gmapLayers.markers=[];
    window._gmapLayers.heat.forEach(m=> map.removeLayer(m)); window._gmapLayers.heat=[];
    if(!valid.length){
      document.getElementById('gm-legend').innerHTML='';
      document.getElementById('gm-stats').innerHTML='<span style="color:var(--warning)">No valid Lat/Long points.</span>';
      return;
    }
    // mode already defined above
    const fuelToColor = (f)=>{ // actual L/h
      if(f<30) return '#10b981'; if(f<60) return '#84cc16'; if(f<90) return '#f59e0b'; if(f<120) return '#f97316'; if(f<160) return '#ef4444'; return '#7f1d1d';
    };
    const speedToColor = (s)=>{ if(s<5) return '#38bdf8'; if(s<12) return '#f59e0b'; return '#10b981'; };
    // draw segments — EXCLUSIVE per View (no overlap)
    let _pathValidG = valid;
    if(mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow') _pathValidG = _gmapDisplayValid;
    else if(mode==='und' || mode==='undRed'){
      const _undForPath = valid.filter(r=> {
        const it=Math.max(Math.abs(parseFloat(r.Rack ?? r.rack ?? 0)), Math.abs(parseFloat(r.Bias ?? r.bias ?? 0)));
        if(mode==='undRed') return it>=16.1;
        return it>=12.0;
      });
      _pathValidG = _undForPath.length ? _undForPath : [];
    }
    for(let i=1;i<_pathValidG.length;i++){
      const a=_pathValidG[i-1], b=_pathValidG[i];
      const fuelAct = ((a.fuel||0)/10 + (b.fuel||0)/10)/2;
      const spd = ((a.gps||0)+(b.gps||0))/2;
      const col = mode==='speed' ? speedToColor(spd) : fuelToColor(fuelAct);
      const w = mode==='speed' ? Math.max(3, Math.min(7, 3+spd/8)) : Math.max(3, Math.min(7, 3+fuelAct/40));
      const seg = L.polyline([[a.lat,a.lon],[b.lat,b.lon]], { color:col, weight:w, opacity:0.92, lineCap:'round', lineJoin:'round' });
      seg.bindPopup(`<div style="font:12px Inter,sans-serif"><b>${a.time||''} → ${b.time||''}</b><br>Fuel ${(fuelAct).toFixed(1)} L/h (raw ${((a.fuel+b.fuel)/2).toFixed(0)})<br>Speed ${spd.toFixed(1)} km/h<br>Grad ${(a.grad||0).toFixed(1)}° · Ret ${a.ret||0}<br><span style="color:#64748b">${a.lat.toFixed(5)},${a.lon.toFixed(5)} → ${b.lat.toFixed(5)},${b.lon.toFixed(5)}</span></div>`);
      seg.addTo(map); window._gmapLayers.segments.push(seg);
    }
    // heat dots — respect dumping filter when in dumping mode (show only dumping dots)
    const _isUndModeForDots = mode==='und' || mode==='undRed';
    const _dotsValidG = (mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow') ? _gmapDisplayValid : (_isUndModeForDots ? [] : valid);
    if(!_isUndModeForDots && heatChk && heatChk.checked){
      _dotsValidG.forEach(r=>{
        const fuelAct=(r.fuel||0)/10, spd=r.gps||0;
        const col = mode==='speed' ? speedToColor(spd) : fuelToColor(fuelAct);
        const rad = Math.max(3, Math.min(7, 3+spd/6));
        const c = L.circleMarker([r.lat,r.lon], { radius:rad, fillColor:col, color:'#0f172a', weight:1, opacity:1, fillOpacity:0.92 });
        c.bindTooltip(`${fuelAct.toFixed(0)} L/h @ ${spd.toFixed(1)} km/h<br><span style="color:#64748b">${r.lat.toFixed(4)},${r.lon.toFixed(4)}</span>`, { direction:'top' });
        c.addTo(map); window._gmapLayers.heat.push(c);
      });
    }
    // dumping RPM markers — EXCLUSIVE: only when View is Dumping (separate view, no overlap)
    const _isDumpModeG3 = mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow';
    const showDump = _isDumpModeG3;
    const dumpFilterG = mode;
    let dumpAbove=0, dumpTotal=0;
    let _dumpShown=0, _dumpShownAbove=0;
    if(showDump){
      // build cycle index for tooltip cycle # (consecutive hoist>0)
      const dumpCyclesTmp=[]; let curTmp=null;
      effRows.forEach(r=>{
        const isDump = parseFloat(r.hoist)>0.5;
        if(isDump){ if(!curTmp) curTmp={rows:[]}; curTmp.rows.push(r); }
        else if(curTmp){ dumpCyclesTmp.push(curTmp); curTmp=null; }
      });
      if(curTmp) dumpCyclesTmp.push(curTmp);
      // map row object to cycle number via reference equality
      const rowToCycle = new Map();
      dumpCyclesTmp.forEach((c,ci)=> c.rows.forEach(r=> rowToCycle.set(r, ci+1)));
      valid.forEach(r=>{
        if(parseFloat(r.hoist)>0.5){
          // apply dumping vs RPM filter like fuel/speed
          const _isAboveTmp = (r.rpm||0) > 700;
          if(mode==='dumpAbove' && !_isAboveTmp) return;
          if(mode==='dumpBelow' && _isAboveTmp) return;
          dumpTotal++;
          const isAbove = _isAboveTmp;
          if(isAbove) dumpAbove++;
          const col = isAbove ? '#ef4444' : '#10b981';
          const cycleNum = rowToCycle.get(effRows.find(er=> er.lat===r.lat && er.lon===r.lon && er.time===r.time)) || rowToCycle.get(r) || 0;
          // use diamond via divIcon for dumping to stand out over heat dots
          const iconHtml = `<div style="background:${col}; width:14px; height:14px; transform:rotate(45deg); border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center"><span style="transform:rotate(-45deg); font:700 7px Inter; color:#fff">${r.rpm>999? Math.round(r.rpm/100): r.rpm>700?'!':''}</span></div>`;
          const dIcon = L.divIcon({ className:'', html: iconHtml, iconSize:[14,14], iconAnchor:[7,7] });
          const m = L.marker([r.lat,r.lon], {icon:dIcon, zIndexOffset: 400});
          m.bindPopup(`<div style="font:12px Inter,sans-serif"><b style="color:${col}">Dumping ${cycleNum? '#'+cycleNum:''} — ${r.rpm} RPM ${isAbove?'🔴 >700':'🟢 ≤700'}</b><br>Fuel ${(r.fuel/10).toFixed(1)} L/h · Speed ${r.gps.toFixed(1)} km/h<br>Time ${r.time||''}<br><span style="color:#64748b">${r.lat.toFixed(5)},${r.lon.toFixed(5)} · Hoist ${r.hoist} VS ${r.vs}</span><br><span style="font-size:11px; color:${isAbove?'#ef4444':'#10b981'}">${isAbove? 'Above 700 RPM — monitor tipping revs':'Within 700 RPM spec'}</span></div>`);
          m.bindTooltip(`DUMP ${cycleNum||''} · ${r.rpm} RPM ${isAbove?'🔴':''}`, {direction:'top', offset:[0,-8]});
          m.addTo(map); window._gmapLayers.markers.push(m);
        }
      });
      window._gmapDumpStats = {dumpTotal, dumpAbove, dumpBelow: dumpTotal-dumpAbove};
    }
    // undulation dots — via View filter (exclusive, no overlap) — only when View is Undulation
    const isUndMode = mode==='und' || mode==='undRed';
    if(isUndMode){
      const allUndPoints = valid.filter(r=>{
        const rack = parseFloat(r.Rack ?? r.rack ?? r['Rack'] ?? 0);
        const bias = parseFloat(r.Bias ?? r.bias ?? r['Bias'] ?? 0);
        const intensity = Math.max(Math.abs(rack), Math.abs(bias));
        return intensity >= 12.0;
      });
      let undPoints = allUndPoints;
      if(mode==='undRed') undPoints = allUndPoints.filter(r=> Math.max(Math.abs(parseFloat(r.Rack ?? r.rack ?? 0)), Math.abs(parseFloat(r.Bias ?? r.bias ?? 0))) >= 16.1);
      undPoints.forEach(r=>{
        const rack = parseFloat(r.Rack ?? r.rack ?? 0);
        const bias = parseFloat(r.Bias ?? r.bias ?? 0);
        const intensity = Math.max(Math.abs(rack), Math.abs(bias));
        const col = intensity >= 16.1 ? '#ef4444' : '#10b981';
        const rad = intensity >= 16.1 ? 6 : 4;
        const c = L.circleMarker([r.lat, r.lon], { radius: rad, fillColor: col, color: '#fff', weight: 1.5, fillOpacity: 0.88 });
        c.bindPopup(`<div style="font:12px Inter"><b style="color:${col}">Undulation ${intensity.toFixed(2)} ${intensity>=16.1?'🔴 Red ≥16.1':'🟢 Green ≥12.0'}</b><br>Rack ${rack.toFixed(2)} · Bias ${bias.toFixed(2)}<br>Time ${r.time||''}<br><span style="color:#64748b">${r.lat.toFixed(5)},${r.lon.toFixed(5)}</span></div>`);
        c.bindTooltip(`${intensity.toFixed(1)} ${intensity>=16.1?'🔴':''}`, {direction:'top'});
        c.addTo(map); window._gmapLayers.markers.push(c);
      });
      window._gmapUndStats = {total: undPoints.length, red: undPoints.filter(r=> Math.max(Math.abs(parseFloat(r.Rack ?? r.rack ?? 0)), Math.abs(parseFloat(r.Bias ?? r.bias ?? 0)))>=16.1).length, green: undPoints.filter(r=> {const it=Math.max(Math.abs(parseFloat(r.Rack||0)),Math.abs(parseFloat(r.Bias||0))); return it>=12 && it<16.1;}).length};
    } else {
      window._gmapUndStats = {total:0, red:0, green:0};
    }
    // start/end
    const start = valid[0], end = valid[valid.length-1];
    const sM = L.divIcon({ className:'', html:'<div style="background:#10b981;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px Inter;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4)">S</div>', iconSize:[22,22], iconAnchor:[11,11] });
    const eM = L.divIcon({ className:'', html:'<div style="background:#3b82f6;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px Inter;border:2px solid #0f172a;box-shadow:0 2px 8px rgba(0,0,0,0.4)">E</div>', iconSize:[22,22], iconAnchor:[11,11] });
    const mS = L.marker([start.lat,start.lon], {icon:sM}).bindPopup(`Start<br>${start.lat.toFixed(5)},${start.lon.toFixed(5)}<br>${start.time||''}`); mS.addTo(map); window._gmapLayers.markers.push(mS);
    const mE = L.marker([end.lat,end.lon], {icon:eM}).bindPopup(`End<br>${end.lat.toFixed(5)},${end.lon.toFixed(5)}<br>${end.time||''}`); mE.addTo(map); window._gmapLayers.markers.push(mE);
    // hotspot markers for high burn >120 L/h
    const hotspots = valid.filter(r=> (r.fuel||0)/10 > 120).slice(0,6);
    hotspots.forEach(r=>{
      const hm = L.circleMarker([r.lat,r.lon], { radius:9, fillColor:'#ef4444', color:'#fff', weight:2, fillOpacity:0.18 });
      hm.bindPopup(`<b style="color:#ef4444">High burn ${(r.fuel/10).toFixed(0)} L/h</b><br>Speed ${r.gps.toFixed(1)} km/h<br>${r.lat.toFixed(5)},${r.lon.toFixed(5)}<br>${r.time||''}`);
      hm.addTo(map); window._gmapLayers.markers.push(hm);
    });
    // fit bounds
    const bounds = L.latLngBounds(valid.map(r=>[r.lat,r.lon]));
    map.fitBounds(bounds.pad(0.12));
    setTimeout(()=> map.invalidateSize(), 120);
    // legend + stats
    const legendEl = document.getElementById('gm-legend');
    // EXCLUSIVE legend per View (no overlap)
    if(mode==='fuel'){
      legendEl.innerHTML=`<span class="legend-item"><span class="legend-box" style="background:#10b981"></span> &lt;30</span><span class="legend-item"><span class="legend-box" style="background:#84cc16"></span> 30-60</span><span class="legend-item"><span class="legend-box" style="background:#f59e0b"></span> 60-90</span><span class="legend-item"><span class="legend-box" style="background:#f97316"></span> 90-120</span><span class="legend-item"><span class="legend-box" style="background:#ef4444"></span> 120-160</span><span class="legend-item"><span class="legend-box" style="background:#7f1d1d"></span> &gt;160 L/h</span>`;
    } else if(mode==='speed'){
      legendEl.innerHTML=`<span class="legend-item"><span class="legend-box" style="background:#38bdf8"></span> &lt;5 km/h</span><span class="legend-item"><span class="legend-box" style="background:#f59e0b"></span> 5-12</span><span class="legend-item"><span class="legend-box" style="background:#10b981"></span> &gt;12 km/h</span>`;
    } else if(mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow'){
      legendEl.innerHTML=`<span class="legend-item"><span style="width:12px;height:12px;background:#10b981; border:1px solid #fff; transform:rotate(45deg); display:inline-block"></span> Dump ≤700</span><span class="legend-item"><span style="width:12px;height:12px;background:#ef4444; border:1px solid #fff; transform:rotate(45deg); display:inline-block"></span> Dump >700</span>`;
    } else if(mode==='und' || mode==='undRed'){
      legendEl.innerHTML=`<span class="legend-item"><span style="width:10px;height:10px;background:#10b981; border:1px solid #fff; border-radius:50%; display:inline-block"></span> Und Green ≥12.0</span><span class="legend-item"><span style="width:10px;height:10px;background:#ef4444; border:1px solid #fff; border-radius:50%; display:inline-block"></span> Und Red ≥16.1</span>`;
    } else {
      legendEl.innerHTML=`<span class="legend-item"><span class="legend-box" style="background:#10b981"></span> &lt;30</span>`;
    }
    // EXCLUSIVE stats per View (no overlap)
    let statsHtml = '';
    if(mode==='und' || mode==='undRed'){
      const undTotal2 = (typeof window._gmapUndStats!=='undefined' && window._gmapUndStats) ? window._gmapUndStats.total : 0;
      const undRed2 = (typeof window._gmapUndStats!=='undefined' && window._gmapUndStats) ? window._gmapUndStats.red : 0;
      const undGreen = undTotal2 - undRed2;
      statsHtml = `Undulation <b>${undTotal2}</b> pts (<span style="color:#10b981">${undGreen} Green ≥12.0</span> · <span style="color:#ef4444">${undRed2} Red ≥16.1</span> ${undRed2? `— <b style="color:#ef4444">${(undRed2/undTotal2*100).toFixed(1)}% red` : ''}</span>) · GPS points <b>${valid.length}</b>`;
    } else if(mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow'){
      const dumpInfo2 = (typeof dumpTotal!=='undefined' && dumpTotal>0) ? `Dumping <b>${dumpTotal}</b> pts (<span style="color:#10b981">${dumpTotal-dumpAbove} ≤700</span> · <span style="color:#ef4444">${dumpAbove} >700</span> ${dumpAbove? `— <b style="color:#ef4444">${(dumpAbove/dumpTotal*100).toFixed(1)}% over` : ''}</span>)` : `Dumping <b>0</b> pts`;
      statsHtml = `${dumpInfo2} · GPS points <b>${valid.length}</b>`;
    } else {
      const avgFuel = valid.reduce((s,r)=>s+(r.fuel||0)/10,0)/valid.length;
      const maxFuel = Math.max(...valid.map(r=> (r.fuel||0)/10));
      const avgSpd = valid.reduce((s,r)=>s+(r.gps||0),0)/valid.length;
      statsHtml = `GPS points <b>${valid.length}</b> · Avg fuel <b>${avgFuel.toFixed(1)} L/h</b> · Max <b style="color:${maxFuel>160?'var(--danger)':''}">${maxFuel.toFixed(1)} L/h</b> · Avg speed <b>${avgSpd.toFixed(1)} km/h</b> · Hotspots &gt;120 L/h: <b>${hotspots.length}</b>`;
    }
    document.getElementById('gm-stats').innerHTML=statsHtml;
    // controls bind once
    if(!this._gmapBound){
      this._gmapBound=true;
      if(modeSel) modeSel.addEventListener('change', ()=> this.renderGmap());
      if(baseSel) baseSel.addEventListener('change', ()=> this.renderGmap());
      if(heatChk) heatChk.addEventListener('change', ()=> this.renderGmap());
      const undChk2 = document.getElementById('gm-und');
      if(undChk2 && !undChk2._bound){ undChk2._bound=true; undChk2.addEventListener('change', ()=> this.renderGmap()); }
      // dumping via main View filter (no checkbox) — mode change already triggers renderGmap
      if(fitBtn) fitBtn.addEventListener('click', ()=>{ map.fitBounds(bounds.pad(0.12)); });
      if(playBtn) playBtn.addEventListener('click', ()=>{
        let idx=0; const total=valid.length; playBtn.disabled=true; playBtn.textContent='⏳ Playing...';
        const poly = L.polyline([], {color:'#f59e0b', weight:4, opacity:0.9}).addTo(map); window._gmapLayers.segments.push(poly);
        const marker = L.circleMarker([valid[0].lat,valid[0].lon], {radius:8, fillColor:'#fff', color:'#f59e0b', weight:3, fillOpacity:1}).addTo(map); window._gmapLayers.markers.push(marker);
        const step=()=>{ if(idx>=total){ playBtn.disabled=false; playBtn.textContent='▶ Play trace'; return; } const r=valid[idx]; poly.addLatLng([r.lat,r.lon]); marker.setLatLng([r.lat,r.lon]); map.panTo([r.lat,r.lon], {animate:true, duration:0.18}); idx+= Math.max(1, Math.floor(total/280)); setTimeout(step, 32); };
        step();
      });
      // Earth 3D + KML handlers (bind once)
      const earthToggle = document.getElementById('gm-earth-toggle');
      const earthFrame = document.getElementById('earth-frame');
      const gmapDiv = document.getElementById('gmap');
      const kmlBtn = document.getElementById('gm-kml');
      const kmlBtn2 = document.getElementById('gm-kml2');
      const earthOpen = document.getElementById('gm-earth-open');
      const earthFallback = document.getElementById('earth-fallback');
      const buildKml = ()=>{
        const curValid = (window._gmapLastValid && window._gmapLastValid.length ? window._gmapLastValid : valid);
        const curDate = window._gmapLastDate || this.currentDate;
        const curDumper = window._gmapLastDumper || this.currentDumper;
        const esc = s=> String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const centerLat = (Math.min(...curValid.map(r=>r.lat))+Math.max(...curValid.map(r=>r.lat)))/2;
        const centerLon = (Math.min(...curValid.map(r=>r.lon))+Math.max(...curValid.map(r=>r.lon)))/2;
        let kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>HaulPro — ${fmtDate(curDate)} ${curDumper||'fleet'}</name><description>Diesel vs Speed route — ${curValid.length} pts — avg ${(curValid.reduce((s,r)=>s+(r.fuel||0)/10,0)/curValid.length).toFixed(1)} L/h</description><Style id="highFuel"><IconStyle><color>ff1d4eed</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-stars.png</href></Icon></IconStyle><LineStyle><color>ff1d4eed</color><width>4</width></LineStyle></Style><Style id="pathStyle"><LineStyle><color>ff00aaff</color><width>4</width></LineStyle><PolyStyle><color>4000aaff</color></PolyStyle></Style><Placemark><name>Haul Path — fuel coloured</name><styleUrl>#pathStyle</styleUrl><LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${curValid.map(r=> `${r.lon.toFixed(6)},${r.lat.toFixed(6)},0`).join(' ')}</coordinates></LineString></Placemark>`;
        curValid.filter(r=> (r.fuel||0)/10 > 120).slice(0,12).forEach((r,i)=>{
          kml += `<Placemark><name>High burn #${i+1} ${(r.fuel/10).toFixed(0)} L/h</name><description><![CDATA[Fuel ${(r.fuel/10).toFixed(1)} L/h<br>Speed ${r.gps.toFixed(1)} km/h<br>Time ${esc(r.time||'')}<br>Grad ${r.grad}° Ret ${r.ret}<br>${r.lat.toFixed(6)},${r.lon.toFixed(6)}]]></description><styleUrl>#highFuel</styleUrl><Point><coordinates>${r.lon.toFixed(6)},${r.lat.toFixed(6)},0</coordinates></Point></Placemark>`;
        });
        kml += `<Placemark><name>START</name><Point><coordinates>${curValid[0].lon.toFixed(6)},${curValid[0].lat.toFixed(6)},0</coordinates></Point></Placemark><Placemark><name>END</name><Point><coordinates>${curValid[curValid.length-1].lon.toFixed(6)},${curValid[curValid.length-1].lat.toFixed(6)},0</coordinates></Point></Placemark>`;
        kml += `<LookAt><longitude>${centerLon.toFixed(6)}</longitude><latitude>${centerLat.toFixed(6)}</latitude><altitude>0</altitude><range>8000</range><tilt>60</tilt><heading>0</heading><altitudeMode>relativeToGround</altitudeMode></LookAt></Document></kml>`;
        return kml;
      };
      const downloadKml = ()=>{
        const curDate = window._gmapLastDate || this.currentDate;
        const curDumper = window._gmapLastDumper || this.currentDumper;
        const kml = buildKml();
        const blob = new Blob([kml], {type:'application/vnd.google-earth.kml+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download=`HaulPro_${curDate}_${curDumper||'fleet'}.kml`; document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
        VIEWS.toast('KML downloaded — open in Google Earth Pro Desktop for 3D terrain','ok');
      };
      if(kmlBtn && !kmlBtn._bound){ kmlBtn._bound=true; kmlBtn.addEventListener('click', downloadKml); }
      if(kmlBtn2 && !kmlBtn2._bound){ kmlBtn2._bound=true; kmlBtn2.addEventListener('click', downloadKml); }
      const getEarthWebUrl = ()=>{
        const curV = (window._gmapLastValid && window._gmapLastValid.length ? window._gmapLastValid : valid);
        const cLat = (Math.min(...curV.map(r=>r.lat))+Math.max(...curV.map(r=>r.lat)))/2;
        const cLon = (Math.min(...curV.map(r=>r.lon))+Math.max(...curV.map(r=>r.lon)))/2;
        return `https://earth.google.com/web/@${cLat.toFixed(6)},${cLon.toFixed(6)},1200a,6500d,35y,0h,60t,0r`;
      };
      const getMapEmbedUrl = ()=>{
        const curV = (window._gmapLastValid && window._gmapLastValid.length ? window._gmapLastValid : valid);
        const cLat = (Math.min(...curV.map(r=>r.lat))+Math.max(...curV.map(r=>r.lat)))/2;
        const cLon = (Math.min(...curV.map(r=>r.lon))+Math.max(...curV.map(r=>r.lon)))/2;
        // Google Maps satellite embed — allowed in iframe (unlike earth.google.com which blocks X-Frame with 403)
        return `https://maps.google.com/maps?q=${cLat.toFixed(6)},${cLon.toFixed(6)}&hl=en&z=16&t=k&output=embed`;
      };
      if(earthToggle && !earthToggle._bound){
        earthToggle._bound=true;
        earthToggle.addEventListener('click', ()=>{
          const isEarth = earthFrame.style.display !== 'none';
          if(isEarth){
            earthFrame.style.display='none'; if(earthFallback) earthFallback.style.display='none'; gmapDiv.style.display='block'; earthToggle.textContent='🌍 Earth 3D'; setTimeout(()=> map.invalidateSize(), 160);
          } else {
            // FIX 403: earth.google.com blocks iframe (X-Frame-Options: sameorigin). Use Google Maps satellite embed which allows iframe, plus offer KML for true Earth Pro.
            const url = getMapEmbedUrl();
            earthFrame.src = url;
            gmapDiv.style.display='none'; earthFrame.style.display='block'; if(earthFallback) earthFallback.style.display='none';
            earthToggle.textContent='🗺️ 2D Map';
            VIEWS.toast('Showing satellite 3D-like view via Maps embed (Earth web blocks iframe with 403). Use “Open in earth.google.com” or KML for full Earth Pro Desktop 3D.','ok');
          }
        });
      }
      if(earthOpen && !earthOpen._bound){
        earthOpen._bound=true;
        earthOpen.addEventListener('click', ()=>{
          const url = getEarthWebUrl();
          window.open(url, '_blank');
        });
      }
    }
  },

  async renderGradientKml(){
    const mapEl = document.getElementById('gk-map');
    const metaEl = document.getElementById('gk-meta');
    const statsEl = document.getElementById('gk-stats');
    const basemapSel = document.getElementById('gk-basemap');
    const fitBtn = document.getElementById('gk-fit');
    const loadBtn = document.getElementById('gk-load');
    const dlLink = document.getElementById('gk-download');
    if(!mapEl) return;
    if(typeof L==='undefined'){
      mapEl.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-sec);padding:40px;text-align:center">Leaflet failed to load.</div>';
      return;
    }
    if(!window._gkMap){
      window._gkMap = L.map('gk-map', { zoomControl:true }).setView([21.946,85.383], 14);
      window._gkLayers = { tile:null, kml:[] };
    } else {
      setTimeout(()=> window._gkMap.invalidateSize(), 180);
    }
    const map = window._gkMap;
    const base = (basemapSel && basemapSel.value) || 'satellite';
    const tileUrls = {
      roadmap: 'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      satellite: 'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      hybrid: 'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      terrain: 'https://mt0.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
    };
    if(window._gkLayers.tile) map.removeLayer(window._gkLayers.tile);
    window._gkLayers.tile = L.tileLayer(tileUrls[base] || tileUrls.satellite, { maxZoom:20, subdomains:['mt0','mt1','mt2','mt3'], attribution:'© Google' }).addTo(map);
    // clear previous KML
    window._gkLayers.kml.forEach(l=> map.removeLayer(l)); window._gkLayers.kml=[];
    
    // Vercel-safe single URL (no 404 spam) — data is now duplicated at fleet-dashboard/data/august-8/ for both Root=fleet-dashboard and Root=.
    let kmlText=null, kmlUrl=null;
    const kmlSingleUrl = new URL('data/august-8/KIM_August8_Gradient_08_08_2026.kml', window.location.href).href;
    const kmlCandidates = [
      kmlSingleUrl,
      new URL('../data/august-8/KIM_August8_Gradient_08_08_2026.kml', window.location.href).href,
      new URL('/data/august-8/KIM_August8_Gradient_08_08_2026.kml', window.location.origin + '/').href,
      'KIM_Export_Bundle Gradient Analysis/Output_August8/KIM_August8_Gradient_08_08_2026.kml'
    ];
    for(const url of kmlCandidates){
      try{
        const res = await fetch(url, {cache:'no-store'});
        if(!res.ok) continue;
        const txt = await res.text();
        if(txt && txt.includes('<kml')){
          kmlText=txt; kmlUrl=url; break;
        }
      }catch(e){}
    }
    if(!kmlText){
      if(metaEl) metaEl.textContent='KML not found — run kim_august8_gradient.py to generate';
      if(statsEl) statsEl.innerHTML='<span style="color:var(--warning)">No KML found at expected paths. Generate with <code>python kim_august8_gradient.py</code></span>';
      if(dlLink){ dlLink.href='#'; dlLink.onclick=(e)=>{e.preventDefault(); VIEWS.toast('KML not found — generate first','err');}; }
      return;
    }
    if(metaEl) metaEl.textContent=`Loaded ${kmlUrl} — ${kmlText.length} chars`;
    if(dlLink){ dlLink.href = kmlUrl; dlLink.download = 'KIM_August8_Gradient_08_08_2026.kml'; }
    // Parse KML: extract Placemarks with LineString coordinates and style
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = doc.querySelectorAll('Placemark');
    let totalDist=0, climbCount=0, flatCount=0, bumpCount=0;
    const allCoords=[];
    const styleMap = {
      'green': '#10b981',
      'yellow': '#f59e0b',
      'red': '#ef4444'
    };
    placemarks.forEach(pm=>{
      const name = (pm.querySelector('name')?.textContent||'').trim();
      const folder = pm.parentNode?.parentNode?.querySelector('name')?.textContent || '';
      const coordsEl = pm.querySelector('coordinates');
      if(!coordsEl) return;
      const coordsText = coordsEl.textContent.trim();
      const coords = coordsText.split(/\s+/).map(s=>{
        const [lon,lat,alt] = s.split(',').map(Number);
        if(isFinite(lat) && isFinite(lon)) { allCoords.push([lat,lon]); return [lat,lon]; }
        return null;
      }).filter(c=>c);
      if(coords.length<2) return;
      // Determine color by folder/style or name
      let color='#10b981';
      const styleUrl = pm.querySelector('styleUrl')?.textContent||'';
      const desc = pm.querySelector('description')?.textContent||'';
      if(name.includes('Climb') || folder.includes('Elevations')){
        if(desc.includes('Gradient:') ){
          const m = desc.match(/Gradient:\s*([\d.]+)/);
          const grad = m ? parseFloat(m[1]) : 0;
          if(grad>10) color='#ef4444';
          else if(grad>6.25) color='#f59e0b';
          else color='#10b981';
        } else {
          color='#10b981';
        }
        climbCount++;
      } else if(name.includes('BUMP') || folder.includes('Bumps')){
        color='#10b981'; bumpCount++;
      } else {
        color='#10b981'; flatCount++;
      }
      // Check styleUrl for color hint
      if(styleUrl.includes('red')) color='#ef4444';
      else if(styleUrl.includes('yellow')) color='#f59e0b';
      else if(styleUrl.includes('green')) color='#10b981';

      const poly = L.polyline(coords, { color:color, weight:4, opacity:0.92 });
      poly.bindPopup(`<b>${name}</b><br><span style="color:var(--text-sec)">${folder}</span><br>${desc.replace(/\n/g,'<br>')}`);
      poly.addTo(map); window._gkLayers.kml.push(poly);
      // accumulate distance for stats if needed
      for(let i=1;i<coords.length;i++){
        const d = (()=>{
          const R=6371000, p1=coords[i-1], p2=coords[i];
          const phi1=p1[0]*Math.PI/180, phi2=p2[0]*Math.PI/180;
          const dphi=(p2[0]-p1[0])*Math.PI/180, dl=(p2[1]-p1[1])*Math.PI/180;
          const a=Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)**2;
          return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        })();
        totalDist+=d;
      }
    });
    if(allCoords.length){
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds.pad(0.12));
      setTimeout(()=> map.invalidateSize(), 150);
    }
    if(statsEl){
      statsEl.innerHTML=`Segments: <b>${climbCount} climbs</b> · <b>${flatCount} flats</b> · <b>${bumpCount} bumps</b> · Total length ~<b>${(totalDist/1000).toFixed(2)} km</b> · Points: ${allCoords.length}`;
    }
    // also render undulation (Rack/Bias) in same section — same date/dumper
    try{
      const _rows = this._getAnalyticsRows(this.currentDate, this.currentDumper);
      const _effRows = _rows.length ? _rows : this._syntheticAugustRows();
      this.renderGkUndulation(_effRows);
    }catch(e){ console.warn('renderGkUndulation failed', e); }
    // bind controls once
    if(!this._gkBound){
      this._gkBound=true;
      if(basemapSel) basemapSel.addEventListener('change', ()=> this.renderGradientKml());
      if(fitBtn) fitBtn.addEventListener('click', ()=>{
        if(allCoords.length){
          const b = L.latLngBounds(allCoords);
          map.fitBounds(b.pad(0.12));
        }
      });
      if(loadBtn) loadBtn.addEventListener('click', ()=> this.renderGradientKml());
    }
  },

  renderGkUndulation(rows){
    const canvas = document.getElementById('gk-und-canvas');
    const wrap = document.getElementById('gk-und-map');
    const emptyEl = document.getElementById('gk-und-empty');
    const tableEl = document.getElementById('gk-und-table');
    const statsEl = document.getElementById('gk-und-stats');
    const metaEl = document.getElementById('gk-und-meta');
    if(!canvas || !wrap) return;
    // filter rows with valid Rack/Bias and GPS
    const pts = rows.map(r=>{
      const rack = parseFloat(r['Rack'] ?? r['rack'] ?? r['Rack'] ?? 0);
      const bias = parseFloat(r['Bias'] ?? r['bias'] ?? 0);
      const lat = r.lat, lon = r.lon;
      const intensity = Math.max(Math.abs(rack), Math.abs(bias));
      return {rack, bias, intensity, lat, lon, time:r.time||'', raw:r};
    }).filter(p=> isFinite(p.intensity) && p.lat!=null && p.lon!=null && isFinite(p.lat) && isFinite(p.lon));
    if(!pts.length){
      if(emptyEl){ emptyEl.style.display='flex'; emptyEl.textContent='No undulation GPS points.'; }
      if(tableEl) tableEl.innerHTML='';
      if(statsEl) statsEl.textContent='';
      if(metaEl) metaEl.textContent='';
      return;
    }
    // stats
    const redPts = pts.filter(p=> p.intensity >= 16.1);
    const greenPts = pts.filter(p=> p.intensity >= 12.0 && p.intensity < 16.1);
    if(metaEl) metaEl.textContent = `${pts.length} pts · Red ≥16.1: ${redPts.length} · Green 12.0–16.1: ${greenPts.length}`;
    // canvas setup
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(320, Math.floor(rect.width));
    const H = 420;
    canvas.width = W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    // bounds
    let minLat=Math.min(...pts.map(p=>p.lat)), maxLat=Math.max(...pts.map(p=>p.lat));
    let minLon=Math.min(...pts.map(p=>p.lon)), maxLon=Math.max(...pts.map(p=>p.lon));
    const padLat=(maxLat-minLat)*0.08||0.001, padLon=(maxLon-minLon)*0.08||0.001;
    minLat-=padLat; maxLat+=padLat; minLon-=padLon; maxLon+=padLon;
    const latSpan=maxLat-minLat, lonSpan=maxLon-minLon;
    const padL=48, padR=12, padT=12, padB=28;
    const plotW=W-padL-padR, plotH=H-padT-padB;
    ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#0f1a2e'; ctx.fillRect(padL,padT,plotW,plotH);
    ctx.strokeStyle='rgba(51,65,85,0.22)'; ctx.lineWidth=1;
    for(let i=1;i<4;i++){ const gx=padL+plotW*i/4, gy=padT+plotH*i/4; ctx.beginPath(); ctx.moveTo(gx,padT); ctx.lineTo(gx,padT+plotH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(padL,gy); ctx.lineTo(padL+plotW,gy); ctx.stroke(); }
    ctx.strokeStyle='#334155'; ctx.lineWidth=1.2; ctx.strokeRect(padL,padT,plotW,plotH);
    const project=(lat,lon)=>[padL+(lon-minLon)/lonSpan*plotW, padT+plotH-(lat-minLat)/latSpan*plotH];
    // draw all points faint, then red on top, then green
    pts.forEach(p=>{
      const [x,y]=project(p.lat,p.lon);
      let col='#1e293b';
      if(p.intensity >= 16.1) col='#ef4444';
      else if(p.intensity >= 12.0) col='#10b981';
      else col='rgba(51,65,85,0.55)';
      const r = p.intensity >=16.1 ? 4.5 : p.intensity>=12.0 ? 3.5 : 2.2;
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      if(p.intensity>=12.0){ ctx.strokeStyle='rgba(15,23,42,0.9)'; ctx.lineWidth=1; ctx.stroke(); }
    });
    // axes
    ctx.fillStyle='#94a3b8'; ctx.font='11px Inter, system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
    for(let i=0;i<5;i++){ const t=i/4, lon=minLon+lonSpan*t, x=padL+plotW*t; ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(x,padT+plotH); ctx.lineTo(x,padT+plotH+5); ctx.stroke(); ctx.fillText(lon.toFixed(4), x, padT+plotH+8); }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<5;i++){ const t=i/4, lat=minLat+latSpan*t, y=padT+plotH-plotH*t; ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(padL-5,y); ctx.lineTo(padL,y); ctx.stroke(); ctx.fillText(lat.toFixed(4), padL-8, y); }
    ctx.fillStyle='#e2e8f0'; ctx.font='600 11px Inter'; ctx.textAlign='center'; ctx.fillText('Longitude (°E)', padL+plotW/2, H-12);
    ctx.save(); ctx.translate(14, padT+plotH/2); ctx.rotate(-Math.PI/2); ctx.fillText('Latitude (°N)',0,0); ctx.restore();
    if(emptyEl) emptyEl.style.display='none';
    // table only red
    const redSorted = [...redPts].sort((a,b)=> b.intensity - a.intensity).slice(0,100);
    if(tableEl){
      if(!redSorted.length){
        tableEl.innerHTML='<tr><td style="color:var(--text-muted); padding:16px; text-align:center">No red undulation points (≥16.1) — road is within spec.</td></tr>';
      } else {
        tableEl.innerHTML='<tr><th>#</th><th>Lat</th><th>Lon</th><th>Rack</th><th>Bias</th><th>Intensity max(|R|,|B|)</th><th>Time</th></tr>' +
          redSorted.map((p,i)=> `<tr style="background:rgba(239,68,68,0.06)"><td>${i+1}</td><td>${p.lat.toFixed(5)}</td><td>${p.lon.toFixed(5)}</td><td>${p.rack.toFixed(2)}</td><td>${p.bias.toFixed(2)}</td><td><b style="color:#ef4444">${p.intensity.toFixed(2)}</b></td><td style="font-size:11px; white-space:nowrap">${p.time||''}</td></tr>`).join('');
      }
    }
    if(statsEl){
      statsEl.innerHTML=`Red ≥16.1: <b style="color:#ef4444">${redPts.length}</b> / ${pts.length} pts (${(redPts.length/pts.length*100).toFixed(1)}%) · Green 12.0–16.1: <b style="color:#10b981">${greenPts.length}</b> · Max intensity <b>${Math.max(...pts.map(p=>p.intensity)).toFixed(2)}</b>`;
    }
    // tooltip
    const ptsProjected = pts.map(p=>{ const [x,y]=project(p.lat,p.lon); return {x,y,p}; });
    const tooltip = document.getElementById('an-route-tooltip') || document.createElement('div');
    // reuse route tooltip is inside an-route-map, create one for undulation if needed
    let undTip = document.getElementById('gk-und-tooltip');
    if(!undTip){
      undTip = document.createElement('div');
      undTip.id='gk-und-tooltip';
      undTip.style.cssText='position:absolute; pointer-events:none; background:#0f172a; color:#f8fafc; border:1px solid #334155; border-radius:8px; padding:8px 10px; font-size:12px; line-height:1.4; display:none; max-width:260px; box-shadow:0 8px 24px rgba(0,0,0,0.45); z-index:2';
      wrap.appendChild(undTip);
    }
    canvas.onmousemove=(ev)=>{
      const rect2=canvas.getBoundingClientRect();
      const mx=ev.clientX-rect2.left, my=ev.clientY-rect2.top;
      let best=null, bestD=12;
      for(const o of ptsProjected){ const d=Math.hypot(o.x-mx, o.y-my); if(d<bestD){bestD=d; best=o;} }
      if(best){
        undTip.style.display='block';
        undTip.style.left=Math.min(W-270, Math.max(8, best.x+14))+'px';
        undTip.style.top=Math.max(8, best.y-56)+'px';
        undTip.innerHTML=`<div style="font-weight:700">${best.p.lat.toFixed(5)}, ${best.p.lon.toFixed(5)}</div><div>Rack <b>${best.p.rack.toFixed(2)}</b> · Bias <b>${best.p.bias.toFixed(2)}</b> · Intensity <b style="color:${best.p.intensity>=16.1?'#ef4444': best.p.intensity>=12.0?'#10b981':'#94a3b8'}">${best.p.intensity.toFixed(2)}</b></div><div style="color:#94a3b8; font-size:11px">${best.p.time||''} · ${best.p.intensity>=16.1?'🔴 Red ≥16.1': best.p.intensity>=12.0?'🟢 Green ≥12.0':'Normal'}</div>`;
      } else undTip.style.display='none';
    };
    canvas.onmouseleave=()=> undTip.style.display='none';
  },

  _parseCoord(s){
    if(!s || typeof s!=='string') return null;
    s=s.trim(); if(!s) return null;
    const dir=s[0]; const v=s.slice(1);
    const num=parseFloat(v); if(isNaN(num)) return null;
    const dot=v.indexOf('.'); if(dot===-1) return null;
    const intPart=v.slice(0,dot);
    if(intPart.length<3){ const minutes=parseFloat(v); const deg=0; let dec=deg+minutes/60; if(dir==='S'||dir==='W') dec=-dec; return dec; }
    const minsStr=intPart.slice(-2)+v.slice(dot);
    const degStr=intPart.slice(0,-2);
    const deg=parseFloat(degStr), mins=parseFloat(minsStr);
    if(isNaN(deg)||isNaN(mins)) return null;
    let dec=deg+mins/60; if(dir==='S'||dir==='W') dec=-dec; return dec;
  },
  _getAnalyticsRows(date, dumperId){
    const out=[];
    const self=this;
    const pushFrom = (arr)=>{
      if(!arr) return;
      arr.forEach(r=>{
        const fuel = parseFloat(r['Fuel_Rate_01L'] ?? r['fuel']);
        const gps = parseFloat(r['GPS_Speed'] ?? r['gps_speed']);
        const vSpd = parseFloat(r['Vehicle_Speed_S'] ?? r['vehicle_speed']);
        const rpm = parseFloat(r['Eng_Speed'] ?? r['eng_speed']);
        const grad = parseFloat(r['Gradient_deg'] ?? r['gradient']);
        const ret = parseFloat(r['Retarder_Pos'] ?? r['retarder_pos']);
        const vs = String(r['Vehicle_State'] ?? r['vstate'] ?? '');
        const hoist = String(r['Hoist_Lever_Pos'] ?? r['hoist_lever'] ?? '0');
        const weight = parseFloat(r['Live_Weight_ton'] ?? r['live_weight'] ?? 0);
        const time = r['Time'] ?? r['time'] ?? '';
        const rack = parseFloat(r['Rack'] ?? r['rack'] ?? r['Rack'] ?? 0);
        const bias = parseFloat(r['Bias'] ?? r['bias'] ?? 0);
        let lat = r['GPS_Latitude'] ? self._parseCoord(String(r['GPS_Latitude'])) : (r['lat'] ?? r['gps_lat'] ?? null);
        let lon = r['GPS_Longitude'] ? self._parseCoord(String(r['GPS_Longitude'])) : (r['lon'] ?? r['gps_lon'] ?? null);
        if(lat!==null && typeof lat==='string') lat=parseFloat(lat);
        if(lon!==null && typeof lon==='string') lon=parseFloat(lon);
        if(isNaN(lat)) lat=null; if(isNaN(lon)) lon=null;
        if(!isNaN(fuel) && !isNaN(rpm)) out.push({fuel, gps: isNaN(gps)? (isNaN(vSpd)?0:vSpd/100) : gps, rpm, grad: isNaN(grad)?0:grad, ret: isNaN(ret)?0:ret, vs, hoist, weight, lat, lon, time, Rack: isNaN(rack)?0:rack, Bias: isNaN(bias)?0:bias, rack: isNaN(rack)?0:rack, bias: isNaN(bias)?0:bias});
      });
    };
    if(DATA.timeseries && DATA.timeseries[date]){
      if(dumperId && DATA.timeseries[date][dumperId]) pushFrom(DATA.timeseries[date][dumperId]);
      else if(!dumperId){ Object.values(DATA.timeseries[date]).forEach(arr=> pushFrom(arr)); }
      else {
        // fallback any dumper that has data this date
        const any = Object.values(DATA.timeseries[date])[0];
        pushFrom(any);
      }
    }
    return out;
  },

  _syntheticAugustRows(){
    const rnd = mulberry32(hashStr('aug8synthetic'+this.currentDate));
    const rows=[];
    const C = (typeof MINE_CORRIDOR!=='undefined'? MINE_CORRIDOR : {from:{lat:21.9386,lon:85.3786}, to:{lat:21.9534,lon:85.3875}, hotspots:[]});
    const latSpan = C.to.lat - C.from.lat, lonSpan = C.to.lon - C.from.lon;
    for(let i=0;i<900;i++){
      const speedCat = rnd();
      let gps, fuel;
      if(speedCat<0.51){ gps = rnd()*5; fuel = 120 + rnd()*600 + (rnd()<0.04? 1200:0); }
      else if(speedCat<0.66){ gps = 5+rnd()*5; fuel = 900 + rnd()*900; }
      else if(speedCat<0.84){ gps = 10+rnd()*5; fuel = 700 + rnd()*800; }
      else { gps = 15+rnd()*6; fuel = 300 + rnd()*700; }
      const rpm = 650 + rnd()*1200;
      const grad = (rnd()-0.5)*16;
      const ret = grad < -5 ? (rnd()<0.65 ? 10+rnd()*45 : 0) : (rnd()<0.06 ? rnd()*40 : 0);
      const vsPick = ['1','2','3','4','5','6'][Math.floor(rnd()*6)];
      const hoist = rnd()<0.02 ? '4' : '0';
      const t = Math.max(0,Math.min(1, i/900 + (rnd()-0.5)*0.08));
      const lat = C.from.lat + latSpan*t + (rnd()-0.5)*0.001;
      const lon = C.from.lon + lonSpan*t + (rnd()-0.5)*0.001;
      // Rack/Bias for undulation: mostly normal, occasional red spikes near hotspots
      let rack = (rnd()-0.5)*6, bias=(rnd()-0.5)*6;
      if(rnd()<0.04) { rack = (rnd()<0.5? -1:1)*(16.5 + rnd()*6); bias=(rnd()-0.5)*4; }
      else if(rnd()<0.12) { rack=(rnd()-0.5)*8; bias=(rnd()<0.5? -1:1)*(12.5 + rnd()*3); }
      if(rnd()<0.02) bias = (rnd()<0.5? -1:1)*(17 + rnd()*5);
      rows.push({fuel, gps, rpm, grad, ret, vs:vsPick, hoist, weight: rnd()*100, lat, lon, time:`syn-${i}`, Rack:rack, Bias:bias, rack, bias});
    }
    for(let i=0;i<24;i++) rows.push({fuel:600+rnd()*400, gps:1+rnd()*2, rpm:1650+rnd()*350, grad: (rnd()-0.5)*2, ret:0, vs:'5', hoist:'4', weight: 30+rnd()*10, lat:C.from.lat+latSpan*0.62+(rnd()-0.5)*0.0006, lon:C.from.lon+lonSpan*0.62+(rnd()-0.5)*0.0006, time:`syn-dump5-${i}`, Rack:(rnd()-0.5)*5, Bias:(rnd()-0.5)*5, rack:(rnd()-0.5)*5, bias:(rnd()-0.5)*5});
    for(let i=0;i<18;i++) rows.push({fuel: 140+rnd()*120, gps: rnd()*3, rpm: 640+rnd()*60, grad: (rnd()-0.5)*3, ret:0, vs:'1', hoist:'0', weight: rnd()*4, lat:C.from.lat+latSpan*0.635+(rnd()-0.5)*0.0005, lon:C.from.lon+lonSpan*0.635+(rnd()-0.5)*0.0005, time:`syn-gap-${i}`, Rack:(rnd()-0.5)*4, Bias:(rnd()-0.5)*4, rack:(rnd()-0.5)*4, bias:(rnd()-0.5)*4});
    for(let i=0;i<29;i++) rows.push({fuel:400+rnd()*400, gps:0.5+rnd()*1.5, rpm:680+rnd()*420, grad: (rnd()-0.5)*2, ret:0, vs:'6', hoist:'4', weight: 55+rnd()*15, lat:C.from.lat+latSpan*0.65+(rnd()-0.5)*0.0006, lon:C.from.lon+lonSpan*0.65+(rnd()-0.5)*0.0006, time:`syn-dump6-${i}`, Rack:(rnd()-0.5)*6, Bias:(rnd()-0.5)*6, rack:(rnd()-0.5)*6, bias:(rnd()-0.5)*6});
    return rows;
  },

  _renderFuelSpeedHeatmap(rows){
    // bins: raw Fuel_Rate_01L (0-2000) → actual L/h = raw/10
    // Display labels in actual L/h for operator clarity; calculation stays in raw
    const speedBins = [[0,5],[5,10],[10,15],[15,22],[22,40]];
    const fuelBins = [[0,200],[200,400],[400,600],[600,900],[900,1200],[1200,1500],[1500,2500]];
    const speedLabels = ['0–5','5–10','10–15','15–22','22+'];
    const fuelLabelsRaw = ['0–200','200–400','400–600','600–900','900–1200','1200–1500','1500+'];
    const fuelLabels = ['0–20','20–40','40–60','60–90','90–120','120–150','150+']; // actual L/h
    // build matrix fuelRows x speedCols
    const maxCount = {v:0};
    const mat = fuelBins.map(()=> speedBins.map(()=> ({n:0,sum:0,max:0})));
    rows.forEach(r=>{
      const s = r.gps;
      const f = r.fuel;
      let si = speedBins.findIndex(b=> s>=b[0] && s<b[1]); if(si<0) si=speedBins.length-1;
      let fi = fuelBins.findIndex(b=> f>=b[0] && f<b[1]); if(fi<0) fi=fuelBins.length-1;
      mat[fi][si].n++; mat[fi][si].sum+=f; mat[fi][si].max=Math.max(mat[fi][si].max,f);
      if(mat[fi][si].n > maxCount.v) maxCount.v = mat[fi][si].n;
    });
    const wrap = document.getElementById('an-heatmap');
    let html = `<div class="hm-col-labels"><span></span>`+speedLabels.map(l=>`<span>${l} km/h</span>`).join('')+`</div>`;
    for(let fi=fuelBins.length-1; fi>=0; fi--){
      html += `<div class="hm-row"><div class="hm-label" title="Fuel_Rate_01L ${fuelLabelsRaw[fi]} → ${fuelLabels[fi]} L/h actual">${fuelLabels[fi]} L/h</div>`;
      for(let si=0; si<speedBins.length; si++){
        const c = mat[fi][si];
        if(c.n===0){
          html += `<div class="hm-cell empty" title="No points: ${fuelLabels[fi]} L/h at ${speedLabels[si]} km/h">—</div>`;
        } else {
          const intensity = c.n / maxCount.v; // 0-1 density
          const avgRaw = c.sum/c.n;
          const avgAct = avgRaw/10;
          const maxAct = c.max/10;
          // anomaly: high burn at low speed OR any cell avg >150 raw (150 L/h actual is high, but raw 1500)
          const isAnom = (si===0 && avgRaw>900) || (si===1 && avgRaw>1300) || avgRaw>1500;
          // Rectified solid palette — density scale, high contrast on dark #1e293b, no alpha wash
          let bg, txt='#fff', border='rgba(255,255,255,0.12)';
          if(intensity < 0.12){ bg='#334155'; txt='#e2e8f0'; border='rgba(255,255,255,0.10)'; } // sparse — visible slate
          else if(intensity < 0.28){ bg='#164e63'; } // cyan-900
          else if(intensity < 0.45){ bg='#065f46'; } // emerald-800
          else if(intensity < 0.62){ bg='#92400e'; } // amber-800
          else if(intensity < 0.80){ bg='#9a3412'; } // orange-800
          else if(intensity < 0.92){ bg='#b91c1c'; } // red-700
          else { bg='#7f1d1d'; } // red-900 peak
          // bump anomaly intensity visually even if low density but high avg
          if(isAnom && intensity < 0.28){ bg='#7f1d1d'; }
          html += `<div class="hm-cell ${isAnom?'anom':''}" style="background:${bg}; color:${txt}; border-color:${border}" title="Speed ${speedLabels[si]} km/h · Fuel ${fuelLabels[fi]} L/h actual (${fuelLabelsRaw[fi]} raw) — n=${c.n} · avg ${avgAct.toFixed(1)} L/h (raw ${avgRaw.toFixed(0)}) · max ${maxAct.toFixed(1)} L/h">${c.n}<span style="font-size:9px; font-weight:700; opacity:0.92; letter-spacing:0.2px; margin-top:1px">${avgAct.toFixed(0)} L/h</span></div>`;
        }
      }
      html += `</div>`;
    }
    wrap.innerHTML = html;
    document.getElementById('an-heatmap-legend').innerHTML = `
      <span class="legend-item"><span class="legend-box" style="background:#164e63; border:1px solid rgba(255,255,255,0.1)"></span> Low</span>
      <span class="legend-item"><span class="legend-box" style="background:#065f46"></span> Moderate</span>
      <span class="legend-item"><span class="legend-box" style="background:#92400e"></span> High</span>
      <span class="legend-item"><span class="legend-box" style="background:#b91c1c"></span> Very high</span>
      <span class="legend-item"><span class="legend-box" style="background:#7f1d1d"></span> Peak</span>
      <span class="legend-item" style="margin-left:12px; color:var(--text-sec)"><span style="display:inline-block;width:12px;height:12px;border:2px solid #ef4444;border-radius:3px;vertical-align:-2px"></span> High-burn anomaly (avg >90 L/h at &lt;5 km/h or >150 L/h any speed)</span>
      <span class="legend-item" style="margin-left:8px; color:var(--text-muted); font-size:10px">Fuel labels in actual L/h (raw/10) · colour = point density (n / max)</span>`;
    // stats — show both raw and actual for engineering clarity
    const lowSpeedHighFuel = mat.slice(4).reduce((s,row)=> s+row[0].n,0); // fuel >=900 raw (90 actual) at 0-5 km/h
    const total = rows.length;
    const pct = ((lowSpeedHighFuel/total)*100).toFixed(1);
    const avgRawAll = rows.reduce((s,r)=>s+r.fuel,0)/total;
    const avgActAll = avgRawAll/10;
    const maxRaw = Math.max(...rows.map(r=>r.fuel));
    const maxAct = maxRaw/10;
    const midHigh = rows.filter(r=> r.gps>=5 && r.gps<15 && r.fuel>1500).length;
    document.getElementById('an-heatmap-stats').innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center">
        <span>Total <b>${total}</b> pts</span>
        <span>· Avg <b>${avgActAll.toFixed(1)} L/h</b> <span style="color:var(--text-muted)">(raw ${avgRawAll.toFixed(0)})</span></span>
        <span>· Max <b>${maxAct.toFixed(1)} L/h</b> <span style="color:var(--text-muted)">(raw ${maxRaw.toFixed(0)})</span></span>
        <span>· Low-speed high-burn 0–5 km/h ≥90 L/h: <b>${lowSpeedHighFuel} pts (${pct}%)</b></span>
        <span>· Mid-speed spikes 5–15 km/h >150 L/h: <b>${midHigh}</b></span>
      </div>
      <div style="margin-top:6px; font-weight:600; color:${pct>8?'var(--danger)': pct>4?'var(--warning)':'var(--success)'}">${pct>8?'⛽ Critical: frequent high burn at crawl — check injectors / idling': pct>4?'⚠️ Moderate low-speed over-fuel — review idle discipline':'✅ Fuel–speed profile nominal'}</div>
      <div style="margin-top:4px; color:var(--text-muted); font-size:11px">Colour = density per cell (darker/red = more points in that speed×fuel bucket). Anomaly outline = fuel intensity abnormal for that speed.</div>`;
  },

  _renderRouteHeatmap(rows){
    const canvas = document.getElementById('an-route-canvas');
    const wrap = document.getElementById('an-route-map');
    const tooltip = document.getElementById('an-route-tooltip');
    const emptyEl = document.getElementById('an-route-empty');
    const legendEl = document.getElementById('an-route-legend');
    const statsEl = document.getElementById('an-route-stats');
    const modeSel = document.getElementById('an-route-mode');
    const fitBtn = document.getElementById('an-route-fit');
    const mode = (modeSel && modeSel.value) || 'fuel';
    if(!canvas || !wrap) return;
    const valid = rows.filter(r=> r.lat!=null && r.lon!=null && isFinite(r.lat) && isFinite(r.lon));
    // dumping vs RPM filter (like fuel/speed) — controls what is drawn — separate view, no overlap
    let displayValid = valid;
    let dumpPointsForMap = valid.filter(r=> parseFloat(r.hoist)>0.5);
    const _modeIsDump = mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow';
    if(mode==='dumpRpm') displayValid = dumpPointsForMap.length? dumpPointsForMap : valid;
    else if(mode==='dumpAbove') { const f=dumpPointsForMap.filter(r=> (r.rpm||0)>700); displayValid = f.length? f : dumpPointsForMap; dumpPointsForMap = f; }
    else if(mode==='dumpBelow') { const f=dumpPointsForMap.filter(r=> (r.rpm||0)<=700); displayValid = f.length? f : dumpPointsForMap; dumpPointsForMap = f; }
    // use displayValid for bounds/path when filtering to dumping only
    const validForBounds = (mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow') ? displayValid : valid;
    if(!validForBounds.length){
      canvas.style.display='none';
      if(emptyEl){ emptyEl.style.display='flex'; emptyEl.textContent='No points for selected Dumping filter — try All.'; }
      if(legendEl) legendEl.innerHTML='';
      if(statsEl) statsEl.innerHTML='';
      return;
    }
    if(!valid.length){
      canvas.style.display='none';
      if(emptyEl){ emptyEl.style.display='flex'; emptyEl.textContent='No GPS points with valid Lat/Long for this date/dumper — ingest August 8 CSV or switch to All Dumpers.'; }
      if(legendEl) legendEl.innerHTML='';
      if(statsEl) statsEl.innerHTML='';
      return;
    }
    if(emptyEl) emptyEl.style.display='none';
    canvas.style.display='block';
    // bounds with 6% padding — use filtered bounds when dumping filter active
    const _bValid = (typeof validForBounds !== 'undefined' && validForBounds.length ? validForBounds : valid);
    let minLat=Math.min(..._bValid.map(r=>r.lat)), maxLat=Math.max(..._bValid.map(r=>r.lat));
    let minLon=Math.min(..._bValid.map(r=>r.lon)), maxLon=Math.max(..._bValid.map(r=>r.lon));
    const padLat=(maxLat-minLat)*0.07 || 0.001, padLon=(maxLon-minLon)*0.07 || 0.001;
    minLat-=padLat; maxLat+=padLat; minLon-=padLon; maxLon+=padLon;
    const latSpan=maxLat-minLat, lonSpan=maxLon-minLon;
    // helpers (mode already defined above)
    const fuelToColor = (fuelAct)=>{
      // actual L/h scale 0-200
      if(fuelAct < 30) return '#10b981';
      if(fuelAct < 60) return '#84cc16';
      if(fuelAct < 90) return '#f59e0b';
      if(fuelAct < 120) return '#f97316';
      if(fuelAct < 160) return '#ef4444';
      return '#7f1d1d';
    };
    const speedToColor = (spd)=>{
      if(spd < 5) return '#38bdf8';
      if(spd < 12) return '#f59e0b';
      return '#10b981';
    };
    const fuelToWidth = (fuelAct)=> Math.max(1.5, Math.min(6, 1.5 + fuelAct/45));
    // prepare canvas DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(320, Math.floor(rect.width));
    const H = 520;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    // layout with axes — reserve space for X (lon) bottom and Y (lat) left
    const padL=62, padR=14, padT=14, padB=36;
    const plotW = Math.max(60, W - padL - padR);
    const plotH = Math.max(60, H - padT - padB);
    // background
    ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#0f1a2e'; ctx.fillRect(padL, padT, plotW, plotH);
    // interior grid (3×3)
    ctx.strokeStyle='rgba(51,65,85,0.22)'; ctx.lineWidth=1;
    for(let i=1;i<4;i++){
      const gx = padL + plotW*i/4, gy = padT + plotH*i/4;
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, padT+plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL+plotW, gy); ctx.stroke();
    }
    // axes box
    ctx.strokeStyle='#334155'; ctx.lineWidth=1.2;
    ctx.strokeRect(padL, padT, plotW, plotH);
    const project = (lat,lon)=>{ const x=padL + (lon-minLon)/lonSpan*plotW; const y=padT + plotH - (lat-minLat)/latSpan*plotH; return [x,y]; };
    // X/Y axis ticks + labels (5 ticks each, lat/lon to 4dp)
    ctx.fillStyle='#94a3b8'; ctx.font='11px Inter, system-ui, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    const xTicks=5, yTicks=5;
    for(let i=0;i<xTicks;i++){
      const t=i/(xTicks-1), lon=minLon+lonSpan*t, x=padL+plotW*t;
      ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(x, padT+plotH); ctx.lineTo(x, padT+plotH+5); ctx.stroke();
      ctx.fillText(lon.toFixed(4), x, padT+plotH+8);
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<yTicks;i++){
      const t=i/(yTicks-1), lat=minLat+latSpan*t, y=padT+plotH - plotH*t;
      ctx.strokeStyle='#475569'; ctx.beginPath(); ctx.moveTo(padL-5, y); ctx.lineTo(padL, y); ctx.stroke();
      ctx.fillText(lat.toFixed(4), padL-8, y);
    }
    // axis titles
    ctx.fillStyle='#e2e8f0'; ctx.font='600 11px Inter, system-ui, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('Longitude (°E)', padL+plotW/2, H-12);
    ctx.save(); ctx.translate(14, padT+plotH/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('Latitude (°N)', 0, 0); ctx.restore();
    // corner labels
    ctx.fillStyle='#64748b'; ctx.font='10px Inter, system-ui, sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(`N`, padL+4, padT+4);
    ctx.textAlign='right'; ctx.fillText(`${valid.length} pts`, padL+plotW-4, padT+4);
    // draw path segments — EXCLUSIVE: dumping view shows only dumping path, fuel/speed shows only all points
    const _pathValid = (mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow') ? displayValid : valid;
    ctx.lineCap='round'; ctx.lineJoin='round';
    for(let i=1;i<_pathValid.length;i++){
      const a=_pathValid[i-1], b=_pathValid[i];
      const [x1,y1]=project(a.lat,a.lon), [x2,y2]=project(b.lat,b.lon);
      const fuelAct = ((a.fuel||0)/10 + (b.fuel||0)/10)/2;
      const spd = ((a.gps||0)+(b.gps||0))/2;
      let col = '#64748b';
      if(mode==='fuel') col=fuelToColor(fuelAct);
      else if(mode==='speed') col=speedToColor(spd);
      else { // both: hue by fuel, alpha by speed (faster = more opaque wider)
        col=fuelToColor(fuelAct);
      }
      ctx.strokeStyle=col;
      ctx.lineWidth = mode==='both' ? Math.max(2, Math.min(7, 2 + spd/6)) : fuelToWidth(fuelAct);
      ctx.globalAlpha = mode==='fuel' ? 0.92 : 0.88;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    ctx.globalAlpha=1;
    // draw dots — EXCLUSIVE: dumping view shows only dumping dots
    const _dotsValid = (mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow') ? displayValid : valid;
    _dotsValid.forEach(r=>{
      const [x,y]=project(r.lat,r.lon);
      const fuelAct=(r.fuel||0)/10;
      const spd=r.gps||0;
      let col = mode==='speed' ? speedToColor(spd) : fuelToColor(fuelAct);
      const rad = Math.max(2.5, Math.min(7, 2.5 + spd/7));
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(15,23,42,0.85)'; ctx.lineWidth=1; ctx.stroke();
      // highlight high-burn: outline red
      if(fuelAct>120){ ctx.strokeStyle='#ef4444'; ctx.lineWidth=1.4; ctx.stroke(); }
    });
    // dumping RPM overlay — EXCLUSIVE: only in Dumping view (no overlap with fuel/speed)
    let dumpPoints = [];
    if(mode==='dumpRpm' || mode==='dumpAbove' || mode==='dumpBelow'){
      dumpPoints = dumpPointsForMap; // already filtered to dumping per mode
    } else {
      dumpPoints = []; // hide in fuel/speed view
    }
    dumpPoints.forEach(r=>{
      const [x,y]=project(r.lat,r.lon);
      const isAbove = (r.rpm||0) > 700;
      ctx.fillStyle = isAbove ? '#ef4444' : '#10b981';
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.8;
      const s=8;
      ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4); ctx.fillRect(-s/2,-s/2,s,s); ctx.strokeRect(-s/2,-s/2,s,s); ctx.restore();
      ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
    });
    // start/end markers
    if(valid.length){
      const [sx,sy]=project(valid[0].lat,valid[0].lon); const [ex,ey]=project(valid[valid.length-1].lat,valid[valid.length-1].lon);
      ctx.fillStyle='#10b981'; ctx.beginPath(); ctx.arc(sx,sy,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='bold 9px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('S',sx,sy);
      ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText('E',ex,ey);
    }
    // hit-test for tooltip
    const pts = valid.map(r=>{ const [x,y]=project(r.lat,r.lon); return {x,y,r}; });
    const onMove = (ev)=>{
      const rect2=canvas.getBoundingClientRect();
      const mx=ev.clientX-rect2.left, my=ev.clientY-rect2.top;
      let best=null, bestD=14;
      for(const p of pts){ const d=Math.hypot(p.x-mx,p.y-my); if(d<bestD){bestD=d; best=p;} }
      if(best){
        const fuelAct=(best.r.fuel||0)/10;
        const spd=best.r.gps||0;
        tooltip.style.display='block';
        tooltip.style.left=(Math.min(W-270, Math.max(8, best.x+14)))+'px';
        tooltip.style.top=(Math.max(8, best.y-56))+'px';
        tooltip.innerHTML=`
          <div style="font-weight:700; color:#f8fafc; margin-bottom:4px">${best.r.time || ''} · ${best.r.lat.toFixed(5)}, ${best.r.lon.toFixed(5)}</div>
          <div>Fuel <b style="color:${fuelToColor(fuelAct)}">${fuelAct.toFixed(1)} L/h</b> <span style="color:#64748b">(raw ${(best.r.fuel||0).toFixed(0)})</span> · Speed <b>${spd.toFixed(1)} km/h</b></div>
          <div style="color:#94a3b8">Grad ${ (best.r.grad||0).toFixed(1)}° · Retarder ${ (best.r.ret||0).toFixed(0)} · RPM ${(best.r.rpm||0).toFixed(0)}</div>
          <div style="color:#64748b; font-size:11px; margin-top:3px">VS ${best.r.vs} · Hoist ${best.r.hoist} · ${best.r.weight? best.r.weight.toFixed(1)+' t':''}</div>`;
      } else { tooltip.style.display='none'; }
    };
    const onLeave=()=> tooltip.style.display='none';
    canvas.onmousemove=onMove; canvas.onmouseleave=onLeave;
    // legend
    if(mode==='fuel'){
      legendEl.innerHTML=`
        <span class="legend-item"><span class="legend-box" style="background:#10b981"></span> &lt;30 L/h</span>
        <span class="legend-item"><span class="legend-box" style="background:#84cc16"></span> 30-60</span>
        <span class="legend-item"><span class="legend-box" style="background:#f59e0b"></span> 60-90</span>
        <span class="legend-item"><span class="legend-box" style="background:#f97316"></span> 90-120</span>
        <span class="legend-item"><span class="legend-box" style="background:#ef4444"></span> 120-160</span>
        <span class="legend-item"><span class="legend-box" style="background:#7f1d1d"></span> &gt;160</span>
        <span class="legend-item" style="color:var(--text-muted)">Line width ∝ fuel · dot size ∝ speed · S=start E=end</span>`;
    } else if(mode==='speed'){
      legendEl.innerHTML=`
        <span class="legend-item"><span class="legend-box" style="background:#38bdf8"></span> &lt;5 km/h crawl</span>
        <span class="legend-item"><span class="legend-box" style="background:#f59e0b"></span> 5-12 km/h</span>
        <span class="legend-item"><span class="legend-box" style="background:#10b981"></span> &gt;12 km/h haul</span>
        <span class="legend-item" style="color:var(--text-muted)">Dot size ∝ speed · S/E markers</span>`;
    } else {
      legendEl.innerHTML=`
        <span class="legend-item"><span class="legend-box" style="background:#ef4444"></span> High fuel</span>
        <span class="legend-item"><span class="legend-box" style="background:#f59e0b"></span> Mid fuel</span>
        <span class="legend-item"><span class="legend-box" style="background:#10b981"></span> Low fuel</span>
        <span class="legend-item" style="color:var(--text-muted)">Width/opacity modulated by speed · hover for details</span>`;
    }
    // append dumping RPM legend (always visible)
    const _dumpCntRoute = valid.filter(r=> parseFloat(r.hoist)>0.5).length;
    const _dumpAboveRoute = valid.filter(r=> parseFloat(r.hoist)>0.5 && (r.rpm||0)>700).length;
    legendEl.innerHTML += `<span class="legend-item" style="margin-left:10px; border-left:1px solid var(--card-border); padding-left:10px"><span style="width:10px;height:10px;background:#10b981; border:1px solid #fff; transform:rotate(45deg); display:inline-block"></span> Dump ≤700 (${_dumpCntRoute-_dumpAboveRoute})</span><span class="legend-item"><span style="width:10px;height:10px;background:#ef4444; border:1px solid #fff; transform:rotate(45deg); display:inline-block"></span> Dump >700 (${_dumpAboveRoute})</span>`;
    // stats: hotspot analysis (high fuel locations)
    const hot = [...valid].filter(r=> (r.fuel||0)/10 > 120).slice(0,5);
    const totalFuel = valid.reduce((s,r)=>s+(r.fuel||0)/10,0);
    const avgFuel = totalFuel/valid.length;
    const maxFuel = Math.max(...valid.map(r=> (r.fuel||0)/10));
    const avgSpd = valid.reduce((s,r)=>s+(r.gps||0),0)/valid.length;
    statsEl.innerHTML=`
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center">
        <span>GPS points <b>${valid.length}</b> / ${rows.length} has fix</span>
        <span>· Avg fuel <b>${avgFuel.toFixed(1)} L/h</b> · Max <b style="color:${maxFuel>160?'var(--danger)':''}">${maxFuel.toFixed(1)} L/h</b></span>
        <span>· Avg speed <b>${avgSpd.toFixed(1)} km/h</b></span>
        <span>· Bounds <span style="color:var(--text-muted)">${minLat.toFixed(4)}–${maxLat.toFixed(4)} lat, ${minLon.toFixed(4)}–${maxLon.toFixed(4)} lon</span></span>
      </div>
      ${hot.length? `<div style="margin-top:8px; color:var(--warning); font-weight:600">🔥 High-burn hotspots (&gt;120 L/h): ${hot.map(h=> `${h.lat.toFixed(4)},${h.lon.toFixed(4)} (${(h.fuel/10).toFixed(0)} L/h @ ${h.gps.toFixed(1)} km/h)`).join(' · ')}</div>`: `<div style="margin-top:8px; color:var(--success)">No sustained &gt;120 L/h hotspots on this path.</div>`}
      <div style="margin-top:8px; font-weight:600; color:${_dumpAboveRoute>0?'#ef4444':'#10b981'}">Dumping RPM — ${_dumpCntRoute} dumping pts on map: <span style="color:#10b981">${_dumpCntRoute-_dumpAboveRoute} ≤700 (green diamonds)</span> · <span style="color:#ef4444">${_dumpAboveRoute} >700 (red diamonds)${_dumpAboveRoute? ` — ${( _dumpAboveRoute/_dumpCntRoute*100).toFixed(1)}% over`:''}</span> — see diamonds on path</div>
      <div style="margin-top:6px; color:var(--text-muted); font-size:11px">Path drawn in trace order (Time). Diamonds = dumping (Hoist>0) coloured by 700 RPM threshold. Zoom is auto-fit; use browser zoom or drag map container to inspect.</div>`;
    // bind controls once
    if(modeSel && !modeSel._bound){ modeSel._bound=true; modeSel.addEventListener('change', ()=> this._renderRouteHeatmap(rows)); }
    if(fitBtn && !fitBtn._bound){ fitBtn._bound=true; fitBtn.addEventListener('click', ()=>{ wrap.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=> this._renderRouteHeatmap(rows), 250); }); }
    // handle resize
    if(!this._routeResizeBound){ this._routeResizeBound=true; window.addEventListener('resize', ()=>{ if(document.getElementById('sec-analytics').classList.contains('active')){ clearTimeout(this._routeResizeTimer); this._routeResizeTimer=setTimeout(()=> this._renderRouteHeatmap(rows), 180); } }); }
  },

  _renderRPMDumping(rows){
    // group by vs+hoist label
    const groups = {};
    const labelFor = (r)=>{
      const hoistActive = parseFloat(r.hoist) > 0;
      if(hoistActive) return `VS ${r.vs} · HOIST ${r.hoist} (DUMP)`;
      return `VS ${r.vs} · Hoist 0`;
    };
    rows.forEach(r=>{
      const lbl = labelFor(r);
      if(!groups[lbl]) groups[lbl]=[];
      groups[lbl].push(r.rpm);
    });
    // order: hoist dumping first
    const labels = Object.keys(groups).sort((a,b)=>{
      const da = a.includes('DUMP') ? 0 : 1;
      const db = b.includes('DUMP') ? 0 : 1;
      return da-db || a.localeCompare(b);
    });
    // table stats
    const stats = labels.map(l=>{
      const a = groups[l].slice().sort((x,y)=>x-y);
      const mean = a.reduce((s,v)=>s+v,0)/a.length;
      const med = a[Math.floor(a.length/2)];
      const min = Math.min(...a), max=Math.max(...a);
      const p95 = a[Math.floor(a.length*0.95)];
      const over = a.filter(v=> v>1950).length;
      const under = a.filter(v=> v<600).length;
      const isDump = l.includes('DUMP');
      const status = isDump ? (over>0 ? 'OVER-REV' : (mean>1750?'HIGH':'OK')) : '—';
      return {l,n:a.length,mean,med,min,max,p95,over,under,status,isDump, raw:a};
    });
    const tbl = document.getElementById('an-rpm-table');
    tbl.innerHTML = `<tr><th>State</th><th>n</th><th>Mean RPM</th><th>Median</th><th>Min–Max</th><th>P95</th><th>&gt;1950</th><th>Status</th></tr>` +
      stats.map(s=> `<tr style="${s.isDump && s.status!=='OK' ? 'background:rgba(239,68,68,0.08)' : ''}"><td>${s.l}</td><td>${s.n}</td><td><b>${s.mean.toFixed(0)}</b></td><td>${s.med.toFixed(0)}</td><td>${s.min.toFixed(0)}–${s.max.toFixed(0)}</td><td>${s.p95.toFixed(0)}</td><td style="color:${s.over?'var(--danger)':'var(--text-sec)'}">${s.over}</td><td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${s.status==='OVER-REV'?'rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.3)': s.status==='HIGH'?'rgba(245,158,11,0.18);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)':'rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25)'}">${s.status}</span></td></tr>`).join('');

    // chart: bar mean+ error (min-max) + box-like using Chart.js bar + scatter for outliers
    this.destroyChart('ch-an-rpm');
    const ctx = document.getElementById('ch-an-rpm').getContext('2d');
    const means = stats.map(s=> s.mean);
    const mins = stats.map(s=> s.min);
    const maxs = stats.map(s=> s.max);
    const bg = stats.map(s=> s.isDump ? (s.status!=='OK' ? '#ef4444' : '#8b5cf6') : '#334155');
    CHARTS['ch-an-rpm'] = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Mean RPM', data: means, backgroundColor: bg, borderRadius:4 }, { label:'Max RPM', data: maxs, type:'line', borderColor:'#f59e0b', backgroundColor:'transparent', pointRadius:3, borderWidth:1, borderDash:[4,3] }, { label:'Min RPM', data: mins, type:'line', borderColor:'#10b981', backgroundColor:'transparent', pointRadius:3, borderWidth:1, borderDash:[4,3] }] },
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{ min:0, max:2500, grid:{color:'#1e293b'}, ticks:{ color:'#94a3b8'}}, y:{ ticks:{ color:'#94a3b8', font:{size:10}} }}, plugins:{ legend:{ labels:{ color:'#94a3b8'}}, tooltip:{ callbacks:{ afterBody:(items)=>{ const i=items[0].dataIndex; return `n=${stats[i].n}  P95=${stats[i].p95.toFixed(0)}  >1950=${stats[i].over}`; } } } } }
    });
  },

  _renderDumpingCycles(rows){
    const THRESH = 700;
    const chartEl = document.getElementById('ch-an-dump-cycle');
    const tableEl = document.getElementById('an-dump-cycle-table');
    const summaryEl = document.getElementById('dump-cycle-summary');
    const insightsEl = document.getElementById('an-dump-cycle-insights');
    const mapWrap = document.getElementById('an-dump-cycle-map');
    const mapCanvas = document.getElementById('an-dump-cycle-map-canvas');
    const mapEmpty = document.getElementById('an-dump-cycle-map-empty');
    // identify per-cycle dumping segments (consecutive hoist>0)
    const cycles=[];
    let cur=null;
    rows.forEach((r,idx)=>{
      const isDump = parseFloat(r.hoist)>0.5;
      if(isDump){
        if(!cur) cur={ startIdx:idx, rows:[] };
        cur.rows.push({r, idx, seq:cur.rows.length});
      } else {
        if(cur){ cur.endIdx=idx-1; cycles.push(cur); cur=null; }
      }
    });
    if(cur){ cur.endIdx=rows.length-1; cycles.push(cur); }
    // also filter out tiny cycles (<3 points) as noise
    const filtered = cycles.filter(c=> c.rows.length>=3);
    const useCycles = filtered.length ? filtered : cycles;
    if(!useCycles.length){
      if(summaryEl) summaryEl.textContent='No dumping cycles detected (Hoist >0 never active) — ingest August 8 CSV with hoist data.';
      if(tableEl) tableEl.innerHTML='<tr><td style="color:var(--text-muted); padding:20px; text-align:center">No dumping cycles in this window.</td></tr>';
      if(chartEl){ this.destroyChart('ch-an-dump-cycle'); const ctx=chartEl.getContext('2d'); if(ctx) ctx.clearRect(0,0,chartEl.width,chartEl.height); }
      if(insightsEl) insightsEl.innerHTML='';
      if(mapWrap) mapWrap.style.display='none';
      return;
    }
    // build global timeline for chart
    let globalIdx=0;
    const allPoints=[]; // {x, y, cycleId, time, lat, lon, above}
    const cycleMeta = useCycles.map((c, ci)=>{
      const rpms = c.rows.map(o=> o.r.rpm);
      const avg = rpms.reduce((s,v)=>s+v,0)/rpms.length;
      const max = Math.max(...rpms), min=Math.min(...rpms);
      const above = rpms.filter(v=> v>THRESH).length;
      const below = rpms.length - above;
      const pctAbove = (above/rpms.length*100);
      const maxIdx = rpms.indexOf(max);
      const maxRow = c.rows[maxIdx].r;
      const startTime = c.rows[0].r.time || `idx ${c.startIdx}`;
      const endTime = c.rows[c.rows.length-1].r.time || `idx ${c.endIdx}`;
      const dur = c.rows.length; // approx seconds (1 Hz)
      // location of worst point
      const worstLat = maxRow.lat, worstLon = maxRow.lon;
      // push points to global
      c.rows.forEach(o=>{
        allPoints.push({x:globalIdx++, y:o.r.rpm, cycle:ci+1, time:o.r.time||`#${o.idx}`, lat:o.r.lat, lon:o.r.lon, fuel:o.r.fuel, gps:o.r.gps, above:o.r.rpm>THRESH, seq:o.seq});
      });
      // add a gap of 1 null to separate cycles visually (break line)
      if(ci < useCycles.length-1){ allPoints.push({x:globalIdx++, y:null, cycle:null, gap:true}); }
      return {ci:ci+1, n:c.rows.length, avg, max, min, above, below, pctAbove, startTime, endTime, dur, worstLat, worstLon, maxRow};
    });
    // summary
    const totalDumpPts = useCycles.reduce((s,c)=> s+c.rows.length,0);
    const totalAbove = cycleMeta.reduce((s,m)=> s+m.above,0);
    const totalPct = (totalAbove/totalDumpPts*100).toFixed(1);
    const worstCycle = cycleMeta.reduce((a,b)=> a.pctAbove > b.pctAbove ? a : b);
    if(summaryEl) summaryEl.innerHTML = `Cycles <b>${useCycles.length}</b> · Dumping points <b>${totalDumpPts}</b> · Above 700 RPM <b style="color:${totalAbove?'#ef4444':'#10b981'}">${totalAbove} pts (${totalPct}%)</b> · Worst: Cycle ${worstCycle.ci} (${worstCycle.pctAbove.toFixed(1)}% above)`;
    // table
    if(tableEl){
      tableEl.innerHTML = `<tr><th>Cycle</th><th>Start → End (time / idx)</th><th>Duration</th><th>Avg RPM</th><th>Max RPM</th><th>≤700 (green)</th><th>&gt;700 (red)</th><th>% &gt;700</th><th>Worst loc (lat,lon)</th><th>Status</th></tr>` +
        cycleMeta.map(m=>{
          const status = m.pctAbove===0 ? 'OK' : (m.pctAbove>50 ? 'CRITICAL' : 'WARN');
          const bg = status==='OK' ? 'rgba(16,185,129,0.12);color:#10b981' : status==='WARN' ? 'rgba(245,158,11,0.18);color:#f59e0b' : 'rgba(239,68,68,0.18);color:#ef4444';
          const worstLoc = (m.worstLat!=null && m.worstLon!=null) ? `${m.worstLat.toFixed(4)},${m.worstLon.toFixed(4)}` : '—';
          return `<tr style="${status!=='OK'?'background:rgba(239,68,68,0.06)':''}"><td><b>#${m.ci}</b></td><td style="font-size:11px; white-space:nowrap">${String(m.startTime).slice(0,16)} → ${String(m.endTime).slice(0,16)}<br><span style="color:var(--text-muted)">idx ${useCycles[m.ci-1].startIdx}-${useCycles[m.ci-1].endIdx}</span></td><td>${m.dur}s</td><td><b>${m.avg.toFixed(0)}</b></td><td style="color:${m.max>THRESH?'var(--danger)':''}"><b>${m.max.toFixed(0)}</b></td><td style="color:#10b981">${m.below}</td><td style="color:#ef4444"><b>${m.above}</b></td><td><b style="color:${m.pctAbove>0?'#ef4444':'#10b981'}">${m.pctAbove.toFixed(1)}%</b></td><td style="font-size:11px">${worstLoc}</td><td><span style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; background:${bg}; border:1px solid currentColor">${status}</span></td></tr>`;
        }).join('');
    }
    // chart — per-cycle datasets with segment green/red, plus threshold line at 700
    this.destroyChart('ch-an-dump-cycle');
    const ctx = document.getElementById('ch-an-dump-cycle').getContext('2d');
    // build datasets: one per cycle (to keep gaps), plus threshold line
    const datasets=[];
    let offset=0;
    useCycles.forEach((c, ci)=>{
      const pts = c.rows.map((o, j)=> ({x: offset+j, y:o.r.rpm, time:o.r.time, lat:o.r.lat, lon:o.r.lon}));
      offset += c.rows.length + 1; // +1 gap
      const col = cycleMeta[ci].pctAbove>50 ? '#ef4444' : cycleMeta[ci].pctAbove>0 ? '#f59e0b' : '#10b981';
      datasets.push({
        label:`Cycle ${ci+1} (${c.rows.length}pts)`,
        data: pts,
        borderColor: col,
        backgroundColor: 'transparent',
        pointRadius: 3,
        pointHoverRadius:5,
        pointBackgroundColor: pts.map(p=> p.y>THRESH ? '#ef4444' : '#10b981'),
        pointBorderColor:'#0f172a',
        pointBorderWidth:1,
        tension:0.18,
        spanGaps:false,
        segment:{ borderColor: seg=> (seg.p0.parsed.y>THRESH || seg.p1.parsed.y>THRESH) ? '#ef4444' : '#10b981' }
      });
    });
    // threshold line dataset
    const totalX = allPoints.filter(p=>!p.gap).length + useCycles.length;
    datasets.push({
      label:'700 RPM threshold (spec)',
      data:[{x:0,y:THRESH},{x: totalX, y:THRESH}],
      borderColor:'#f59e0b',
      backgroundColor:'transparent',
      borderWidth:2,
      borderDash:[6,4],
      pointRadius:0,
      tension:0,
      fill:false
    });
    // green/red background via plugin? use afterDraw to shade
    const dumpThresholdPlugin = {
      id:'dumpThresholdShade',
      beforeDatasetsDraw(chart){
        const {ctx, chartArea, scales:{y}} = chart;
        if(!chartArea) return;
        const yTop = y.getPixelForValue(THRESH);
        // green zone below 700
        ctx.save();
        ctx.fillStyle='rgba(16,185,129,0.07)';
        ctx.fillRect(chartArea.left, yTop, chartArea.right-chartArea.left, chartArea.bottom - yTop);
        // red zone above 700
        ctx.fillStyle='rgba(239,68,68,0.07)';
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.right-chartArea.left, yTop - chartArea.top);
        ctx.restore();
        // cycle dividers
        ctx.save(); ctx.strokeStyle='rgba(100,116,139,0.55)'; ctx.setLineDash([4,4]); ctx.lineWidth=1;
        let acc=0;
        useCycles.forEach(c=>{
          acc += c.rows.length;
          const x = chart.scales.x.getPixelForValue(acc - 0.5);
          if(acc < totalX){ ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke(); }
          acc +=1;
        });
        ctx.restore();
      }
    };
    CHARTS['ch-an-dump-cycle'] = new Chart(ctx, {
      type:'line',
      data:{ datasets: datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'nearest', intersect:false },
        parsing:false,
        scales:{
          x:{ type:'linear', title:{display:true, text:'Dumping Position → (sequential dumping points, gaps = cycle boundaries)', color:'#94a3b8', font:{size:11}}, grid:{color:'rgba(51,65,85,0.22)'}, ticks:{color:'#94a3b8', maxTicksLimit:12, callback:(v)=> Number.isInteger(v)? String(v):''} },
          y:{ title:{display:true, text:'RPM', color:'#94a3b8'}, min:400, max:2200, grid:{color:'rgba(51,65,85,0.18)'}, ticks:{color:'#94a3b8'} }
        },
        plugins:{
          legend:{ labels:{color:'#94a3b8', usePointStyle:true, boxWidth:10, font:{size:11}} },
          tooltip:{
            callbacks:{
              title:(items)=> items.length? `Cycle ${allPoints[items[0].dataIndex]?.cycle||'?'} · Dumping pt ${items[0].parsed.x}` : '',
              label:(item)=>{
                const p=item.raw;
                const above = p.y>THRESH ? '🔴 ABOVE 700' : '🟢 OK ≤700';
                return `${p.y.toFixed(0)} RPM — ${above} · ${p.time||''} ${p.lat!=null? `(${p.lat.toFixed(4)},${p.lon.toFixed(4)})`:''}`;
              }
            }
          }
        }
      },
      plugins:[dumpThresholdPlugin]
    });
    // insights
    if(insightsEl){
      const worst = worstCycle;
      const totalCyclesAbove = cycleMeta.filter(m=> m.above>0).length;
      let html='';
      if(totalAbove===0){
        html = `<div class="anomaly-badge ok">✅ All dumping cycles within spec — every point ≤700 RPM</div><div style="font-size:12px; color:var(--text-sec); margin-top:8px">Monitor weekly; no action.</div>`;
      } else {
        const worstPct = worst.pctAbove.toFixed(1);
        html = `
          <div class="anomaly-badge ${totalPct>30?'crit':'warn'}">${totalPct>30?'🔴':'🟠'} ${totalAbove}/${totalDumpPts} dumping points (${totalPct}%) above 700 RPM — ${totalCyclesAbove}/${useCycles.length} cycles affected</div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:12px">
            <div class="insight-box"><h4>📍 Where & Frequency</h4><ul>
              <li>Worst cycle #${worst.ci}: ${worst.above}/${worst.n} pts (${worstPct}%) above — max ${worst.max.toFixed(0)} RPM at ${worst.worstLat!=null? worst.worstLat.toFixed(4)+','+worst.worstLon.toFixed(4):'no GPS'}</li>
              <li>High-burn dump locations cluster near hoist-active GPS — see mini-map below (red dots = >700)</li>
              <li>Check cycle dividers on chart: red segments = over-spec revving during tipping</li>
            </ul></div>
            <div class="insight-box"><h4>👷 Operations — 3-Step Check</h4><ul>
              <li><b>1. Check overloading frequency:</b> Heavy load needs more torque to tip — review Live_Weight_ton, overload_events (>110t) and payload histogram for this dumper/date. If frequent overload (>30% cycles), cap passes at 100t and re-brief excavator operator.</li>
              <li><b>2. If not overloaded → operator behavior:</b> GPS replay per cycle #${worst.ci} — check throttle + hoist overlap. Give targeted training: throttle to idle before hoist, no accel during tipping.</li>
              <li><b>3. If operator trained &amp; compliant →</b> escalate to Maintenance (see next).</li>
            </ul></div>
            <div class="insight-box"><h4>🔧 Maintenance — If Operator OK</h4><ul>
              <li>Inspect hoist hydraulics for lag/pressure loss forcing rev — check pump pressure vs RPM, cylinder seals, relief valve.</li>
              <li>Check engine health affecting torque: Boost_press (turbo), Blowby_Press_PM, Eng_oil_press, Cool_Temp, fuel system (injectors, Fuel_Rate_01L stability).</li>
              <li>Verify engine protection limiter 1950 RPM, idle calibration 650-700, and transmission/retarder drag.</li>
              <li>Trend per-cycle % >700 — alert if >20% for 2 shifts; correlate with payload & road gradient at dump spot.</li>
            </ul></div>
          </div>`;
      }
      insightsEl.innerHTML = html;
    }
    // mini map for dumping cycles — canvas coloured by threshold (green/red)
    if(mapWrap && mapCanvas){
      const dumpValid = useCycles.flatMap(c=> c.rows.map(o=> o.r)).filter(r=> r.lat!=null && r.lon!=null);
      if(!dumpValid.length){
        mapWrap.style.display='none';
        if(mapEmpty) mapEmpty.style.display='flex';
        return;
      }
      mapWrap.style.display='block';
      if(mapEmpty) mapEmpty.style.display='none';
      const dpr = window.devicePixelRatio||1;
      const rect = mapWrap.getBoundingClientRect();
      const W = Math.max(320, Math.floor(rect.width));
      const H = 360;
      mapCanvas.width = W*dpr; mapCanvas.height=H*dpr; mapCanvas.style.width=W+'px'; mapCanvas.style.height=H+'px';
      const ctx2 = mapCanvas.getContext('2d');
      ctx2.setTransform(dpr,0,0,dpr,0,0); ctx2.clearRect(0,0,W,H);
      ctx2.fillStyle='#0b1220'; ctx2.fillRect(0,0,W,H);
      // bounds with pad
      let minLat=Math.min(...dumpValid.map(r=>r.lat)), maxLat=Math.max(...dumpValid.map(r=>r.lat));
      let minLon=Math.min(...dumpValid.map(r=>r.lon)), maxLon=Math.max(...dumpValid.map(r=>r.lon));
      const padLat=(maxLat-minLat)*0.18||0.001, padLon=(maxLon-minLon)*0.18||0.001; minLat-=padLat; maxLat+=padLat; minLon-=padLon; maxLon+=padLon;
      const latSpan=maxLat-minLat, lonSpan=maxLon-minLon;
      const padL=36, padR=12, padT=12, padB=28;
      const plotW=W-padL-padR, plotH=H-padT-padB;
      ctx2.fillStyle='#0f1a2e'; ctx2.fillRect(padL,padT,plotW,plotH);
      ctx2.strokeStyle='#334155'; ctx2.strokeRect(padL,padT,plotW,plotH);
      const proj=(lat,lon)=>[padL+(lon-minLon)/lonSpan*plotW, padT+plotH-(lat-minLat)/latSpan*plotH];
      // draw all dumping points faint, then highlight above-threshold
      dumpValid.forEach(r=>{
        const [x,y]=proj(r.lat,r.lon);
        const isAbove=r.rpm>THRESH;
        ctx2.fillStyle = isAbove ? '#ef4444' : '#10b981';
        const rad = isAbove ? 5 : 3.5;
        ctx2.beginPath(); ctx2.arc(x,y,rad,0,Math.PI*2); ctx2.fill();
        ctx2.strokeStyle='rgba(15,23,42,0.9)'; ctx2.lineWidth=1; ctx2.stroke();
      });
      // connect per cycle with faint line
      useCycles.forEach(c=>{
        const pts=c.rows.map(o=> proj(o.r.lat,o.r.lon)).filter(p=> isFinite(p[0])&&isFinite(p[1]));
        if(pts.length<2) return;
        ctx2.strokeStyle='rgba(148,163,184,0.35)'; ctx2.lineWidth=1.2; ctx2.beginPath(); ctx2.moveTo(pts[0][0],pts[0][1]); pts.slice(1).forEach(p=> ctx2.lineTo(p[0],p[1])); ctx2.stroke();
      });
      // axes ticks (2)
      ctx2.fillStyle='#94a3b8'; ctx2.font='10px Inter'; ctx2.textAlign='center';
      [minLon, (minLon+maxLon)/2, maxLon].forEach(lon=>{
        const x=padL+(lon-minLon)/lonSpan*plotW;
        ctx2.fillText(lon.toFixed(4), x, H-8);
      });
      ctx2.textAlign='right'; [minLat, (minLat+maxLat)/2, maxLat].forEach(lat=>{
        const y=padT+plotH-(lat-minLat)/latSpan*plotH;
        ctx2.fillText(lat.toFixed(4), padL-6, y+3);
      });
      ctx2.fillStyle='#e2e8f0'; ctx2.font='600 10px Inter'; ctx2.textAlign='center'; ctx2.fillText('Longitude', padL+plotW/2, H-2);
      ctx2.save(); ctx2.translate(10, padT+plotH/2); ctx2.rotate(-Math.PI/2); ctx2.fillText('Latitude',0,0); ctx2.restore();
    }
  },

  _renderLocationWiseDumping(rows){
    const THRESH=700;
    const chartEl=document.getElementById('ch-an-loc-dump');
    const tableEl=document.getElementById('an-loc-dump-table');
    const summaryEl=document.getElementById('loc-dump-summary');
    const insightsEl=document.getElementById('an-loc-dump-insights');
    const dumpRows=rows.filter(r=> parseFloat(r.hoist)>0.5 && r.lat!=null && r.lon!=null && isFinite(r.lat) && isFinite(r.lon));
    if(!dumpRows.length){
      if(summaryEl) summaryEl.textContent='No dumping GPS points for location comparison — ingest August 8 CSV.';
      if(tableEl) tableEl.innerHTML='<tr><td style="color:var(--text-muted); padding:20px; text-align:center">No dumping GPS points.</td></tr>';
      this.destroyChart('ch-an-loc-dump');
      if(insightsEl) insightsEl.innerHTML='';
      return;
    }
    // build cycles for cycle count per location
    const cycles=[]; let cur=null;
    rows.forEach(r=>{
      const isDump=parseFloat(r.hoist)>0.5;
      if(isDump){ if(!cur) cur={rows:[]}; cur.rows.push(r); }
      else if(cur){ cycles.push(cur); cur=null; }
    });
    if(cur) cycles.push(cur);
    const rowToCycle=new Map();
    cycles.forEach((c,ci)=> c.rows.forEach(r=> rowToCycle.set(r, ci+1)));
    const grid=0.0003;
    const clusters=new Map();
    dumpRows.forEach(r=>{
      const keyLat=(Math.round(r.lat/grid)*grid).toFixed(4);
      const keyLon=(Math.round(r.lon/grid)*grid).toFixed(4);
      const key=keyLat+','+keyLon;
      if(!clusters.has(key)) clusters.set(key,{key, lat:0, lon:0, rpms:[], rows:[], cycles:new Set()});
      const cl=clusters.get(key);
      cl.lat+=r.lat; cl.lon+=r.lon; cl.rpms.push(r.rpm); cl.rows.push(r);
      const cyc=rowToCycle.get(r);
      if(cyc) cl.cycles.add(cyc);
      else cl.cycles.add(0);
    });
    let locs=[...clusters.values()].map(c=>{
      const n=c.rpms.length;
      const avg=c.rpms.reduce((s,v)=>s+v,0)/n;
      const max=Math.max(...c.rpms), min=Math.min(...c.rpms);
      const above=c.rpms.filter(v=>v>THRESH).length;
      const pct=above/n*100;
      const std=n>1? Math.sqrt(c.rpms.reduce((s,v)=>s+Math.pow(v-avg,2),0)/(n-1)):0;
      return {key:c.key, lat:c.lat/n, lon:c.lon/n, n, cycles:c.cycles.size, avg, max, min, std, above, pct, rpms:c.rpms, rows:c.rows};
    }).filter(c=> c.n>=2).sort((a,b)=> b.pct - a.pct || b.n - a.n).slice(0,14);
    if(!locs.length){
      locs=[...clusters.values()].map(c=>{
        const n=c.rpms.length; const avg=c.rpms.reduce((s,v)=>s+v,0)/n;
        const max=Math.max(...c.rpms), min=Math.min(...c.rpms);
        const above=c.rpms.filter(v=>v>THRESH).length;
        return {key:c.key, lat:c.lat/n, lon:c.lon/n, n, cycles:c.cycles.size, avg, max, min, std:0, above, pct:above/n*100, rpms:c.rpms, rows:c.rows};
      }).sort((a,b)=> b.n - a.n).slice(0,10);
    }
    if(summaryEl){ const _worstPct = locs[0] ? locs[0].pct.toFixed(1)+'%' : ''; const _worstCol = locs[0]&&locs[0].pct>0?'#ef4444':'#10b981'; summaryEl.innerHTML = dumpRows.length+' dumping GPS pts in '+clusters.size+' 30m cells · <b>'+locs.length+' cells ≥2 hits</b> compared · worst same-spot <b style="color:'+_worstCol+'">'+_worstPct+(_worstPct?' >700':'')+'</b>'; }
    if(tableEl){
      tableEl.innerHTML='<tr><th>Location ~30m (lat,lon)</th><th>Hits</th><th>Cycles</th><th>Avg RPM</th><th>Max</th><th>Min</th><th>Std</th><th>>700</th><th>% >700</th><th>Compare</th></tr>'+
        locs.map(l=> '<tr style="'+(l.pct>50?'background:rgba(239,68,68,0.08)': l.pct>0?'background:rgba(245,158,11,0.06)':'')+'"><td style="font-size:11px">'+l.lat.toFixed(4)+','+l.lon.toFixed(4)+'<br><span style="color:var(--text-muted)">'+l.key+'</span></td><td>'+l.n+'</td><td>'+l.cycles+'</td><td><b>'+l.avg.toFixed(0)+'</b></td><td style="color:'+(l.max>THRESH?'#ef4444':'')+'">'+l.max.toFixed(0)+'</td><td>'+l.min.toFixed(0)+'</td><td>'+l.std.toFixed(0)+'</td><td style="color:#ef4444">'+l.above+'</td><td><b style="color:'+(l.pct>50?'#ef4444': l.pct>0?'#f59e0b':'#10b981')+'">'+l.pct.toFixed(1)+'%</b></td><td style="font-size:11px">'+(l.cycles>1? "Across "+l.cycles+" cycles":'Single cycle')+'</td></tr>').join('');
    }
    this.destroyChart('ch-an-loc-dump');
    const ctx=document.getElementById('ch-an-loc-dump').getContext('2d');
    const labels=locs.map(l=> `${l.lat.toFixed(3)},${l.lon.toFixed(3)} (${l.n}×)`);
    const avgs=locs.map(l=> l.avg);
    const bgs=locs.map(l=> l.pct>50?'#ef4444': l.pct>0?'#f59e0b':'#10b981');
    CHARTS['ch-an-loc-dump']=new Chart(ctx,{
      type:'bar',
      data:{labels:labels, datasets:[
        {label:'Min RPM', data:locs.map(l=>l.min), backgroundColor:'#0ea5e9', borderColor:'rgba(15,23,42,0.9)', borderWidth:1, borderRadius:6, barThickness:14},
        {label:'Avg RPM', data:avgs, backgroundColor:bgs, borderColor:'rgba(15,23,42,0.9)', borderWidth:1, borderRadius:6, barThickness:18},
        {label:'Max RPM', data:locs.map(l=>l.max), backgroundColor:'#f59e0b', borderColor:'rgba(15,23,42,0.9)', borderWidth:1, borderRadius:6, barThickness:14}
      ]},
      options:{
        indexAxis:'x', responsive:true, maintainAspectRatio:false,
        scales:{
          x:{ title:{display:true, text:'Dumping Position (lat,lon ~30m cluster)', color:'#94a3b8'}, grid:{color:'rgba(51,65,85,0.18)'}, ticks:{color:'#94a3b8', maxRotation:32, minRotation:18, font:{size:10}} },
          y:{ title:{display:true, text:'RPM', color:'#94a3b8'}, min:400, max:2200, grid:{color:'rgba(51,65,85,0.22)'}, ticks:{color:'#94a3b8'} }
        },
        plugins:{
          legend:{ labels:{color:'#94a3b8'}},
          tooltip:{ callbacks:{ afterBody:(items)=>{ const i=items[0].dataIndex; const l=locs[i]; return `Hits ${l.n} · Cycles ${l.cycles} · Std ${l.std.toFixed(0)} · ${l.above}/${l.n} >700`; } } }
        }
      }
    });
    // --- Time-wise view for 2c: X=time, Y=RPM, colour=location cluster ---
    const timeChartEl = document.getElementById('ch-an-loc-dump-time');
    const timeTableEl = document.getElementById('an-loc-dump-time-table');
    if(timeChartEl){
      // Build global dump index -> time mapping (dumpRows is time-ordered)
      const dumpRowToIdx = new Map();
      dumpRows.forEach((r,i)=> dumpRowToIdx.set(r, i));
      const locColors = ['#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#6366f1','#14b8a6','#e11d48'];
      const timeDatasets = locs.map((loc, idx)=>{
        const pts = (loc.rows||[]).map(r=> ({x: dumpRowToIdx.get(r), y: r.rpm, time:r.time||'', lat:r.lat, lon:r.lon, locKey:loc.key}));
        const col = loc.pct>50 ? '#ef4444' : loc.pct>0 ? '#f59e0b' : locColors[idx % locColors.length];
        return {
          label: `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)} (${loc.n}×)`,
          data: pts,
          borderColor: col,
          backgroundColor: col,
          pointRadius: 4, pointHoverRadius:6,
          pointBackgroundColor: pts.map(p=> p.y>THRESH ? '#ef4444' : col),
          showLine:false, spanGaps:false
        };
      });
      // threshold line
      timeDatasets.push({label:'700 RPM threshold', data:[{x:0,y:THRESH},{x:dumpRows.length,y:THRESH}], borderColor:'#f59e0b', backgroundColor:'transparent', borderWidth:1.5, borderDash:[6,4], pointRadius:0, showLine:true, fill:false, tension:0});
      this.destroyChart('ch-an-loc-dump-time');
      const ctx2 = document.getElementById('ch-an-loc-dump-time').getContext('2d');
      CHARTS['ch-an-loc-dump-time'] = new Chart(ctx2, {
        type:'scatter',
        data:{ datasets: timeDatasets },
        options:{
          responsive:true, maintainAspectRatio:false,
          scales:{
            x:{ type:'linear', title:{display:true, text:'Time → (dump sequence order, 1Hz)', color:'#94a3b8'}, grid:{color:'rgba(51,65,85,0.18)'}, ticks:{color:'#94a3b8'} },
            y:{ title:{display:true, text:'RPM', color:'#94a3b8'}, min:400, max:2200, grid:{color:'rgba(51,65,85,0.22)'}, ticks:{color:'#94a3b8'} }
          },
          plugins:{
            legend:{ labels:{color:'#94a3b8', usePointStyle:true, boxWidth:10, font:{size:10}} },
            tooltip:{ callbacks:{
              title:(items)=> items.length? `Time #${items[0].parsed.x} — ${items[0].raw.time||''}` : '',
              label:(item)=> {
                const p=item.raw;
                const locStr = p.locKey || `${p.lat?.toFixed(4)},${p.lon?.toFixed(4)}`;
                return `${locStr}: ${p.y.toFixed(0)} RPM ${p.y>THRESH?'🔴 >700':'🟢 ≤700'}`;
              }
            }}
          }
        }
      });
    }
    if(timeTableEl){
      // time-ordered table: each dumping point with location and timestamp
      const sortedByTime = [...dumpRows].sort((a,b)=> (a.time||'').localeCompare(b.time||''));
      // limit to 80 rows for readability
      const rowsToShow = sortedByTime.slice(0,80);
      timeTableEl.innerHTML = `<tr><th>#</th><th>Time</th><th>Location ~30m</th><th>RPM</th><th>Status</th><th>Fuel (L/h)</th></tr>` +
        rowsToShow.map((r,i)=>{
          const keyLat=(Math.round(r.lat/grid)*grid).toFixed(4);
          const keyLon=(Math.round(r.lon/grid)*grid).toFixed(4);
          const isAbove=r.rpm>THRESH;
          return `<tr style="${isAbove?'background:rgba(239,68,68,0.06)':''}"><td>${i+1}</td><td style="font-size:11px; white-space:nowrap">${r.time||''}</td><td style="font-size:11px">${keyLat},${keyLon}</td><td><b style="color:${isAbove?'#ef4444':'#10b981'}">${r.rpm.toFixed(0)}</b></td><td><span style="padding:2px 6px; border-radius:8px; font-size:11px; font-weight:700; background:${isAbove?'rgba(239,68,68,0.14);color:#ef4444':'rgba(16,185,129,0.12);color:#10b981'}">${isAbove?'>700':'≤700'}</span></td><td>${(r.fuel/10).toFixed(1)}</td></tr>`;
        }).join('') + (sortedByTime.length>80? `<tr><td colspan="6" style="color:var(--text-muted); text-align:center; font-size:11px">… ${sortedByTime.length-80} more dumping points not shown (change filter or zoom map)</td></tr>`:'');
    }
    if(insightsEl){
      const worst=locs[0];
      if(!worst || worst.pct===0){
        insightsEl.innerHTML=`<div class="anomaly-badge ok">✅ Same-location RPM consistent — no spot with >700 pattern</div><div style="font-size:12px; color:var(--text-sec); margin-top:8px">All compared locations stayed ≤700 on repeat visits. Keep monitoring.</div>`;
      } else {
        const highLocs=locs.filter(l=> l.pct>30);
        insightsEl.innerHTML=`<div class="anomaly-badge ${worst.pct>50?'crit':'warn'}">${worst.pct>50?'🔴':'🟠'} Location ${worst.lat.toFixed(4)},${worst.lon.toFixed(4)}: ${worst.above}/${worst.n} pts (${worst.pct.toFixed(1)}%) >700 RPM — same spot across ${worst.cycles} cycles</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:12px"><div class="insight-box"><h4>📍 Why same-location matters</h4><ul><li>Same dump spot should have similar RPM if ground level and procedure consistent.</li><li>High variance at same spot → uneven/soft ground, side-tilt, or operator throttle habit.</li><li>${highLocs.length} location(s) >30% over — prioritize grading.</li></ul></div><div class="insight-box"><h4>👷 Operations — 3-Step Check</h4><ul><li><b>1. Overloading:</b> Heavy load needs extra torque — check Live_Weight_ton & overload frequency at this spot. If frequent, cap at 100t.</li><li><b>2. If not overloaded → operator:</b> Replay at ${worst.lat.toFixed(4)},${worst.lon.toFixed(4)} — train throttle-idle before hoist.</li><li><b>3. If trained &amp; compliant →</b> Maintenance (next).</li></ul></div><div class="insight-box"><h4>🔧 Maintenance — If Operator OK</h4><ul><li>Check hoist hydraulics, pump pressure, and engine params (Boost, Blowby, Oil Press, Coolant, Fuel Rate) that affect torque during dumping.</li><li>Inspect dump approach rut/tilt at hotspot and verify idle/limiter calibration.</li><li>Trend per-location % >700 weekly.</li></ul></div></div>`;
      }
    }
  },

  _renderGradientRetarder(rows){
    // scatter data
    const scatterPts = rows.filter(r=> r.ret>0).map(r=> ({x:r.grad, y:r.ret, speed:r.gps}));
    // gradient bins
    const bins = [[-15,-10],[-10,-7],[-7,-5],[-5,-3],[-3,0],[0,3],[3,6],[6,15]];
    const binLabels = bins.map(b=> `${b[0]} to ${b[1]}°`);
    const tableRows = bins.map(b=>{
      const inBin = rows.filter(r=> r.grad>=b[0] && r.grad<b[1]);
      const tot = inBin.length;
      const retActive = inBin.filter(r=> r.ret>10).length;
      const pct = tot? (retActive/tot*100):0;
      const avgRet = inBin.filter(r=> r.ret>0).reduce((s,r)=>s+r.ret,0)/Math.max(1,inBin.filter(r=>r.ret>0).length);
      return {label:`${b[0]}–${b[1]}°`, tot, retActive, pct, avgRet: isFinite(avgRet)?avgRet:0};
    });
    // table
    const tbl = document.getElementById('an-grad-table');
    tbl.innerHTML = `<tr><th>Gradient</th><th>n</th><th>Retarder &gt;10% (n)</th><th>% Active</th><th>Avg Intensity</th><th>Risk</th></tr>` +
      tableRows.map(r=>{
        let risk='OK', col='var(--success)';
        if(r.label.includes('-15')||r.label.includes('-10')||r.label.includes('-7')){
          if(r.pct<60){ risk='CRITICAL'; col='var(--danger)'; } else if(r.pct<80){ risk='WARN'; col='var(--warning)'; }
        } else if(r.label.startsWith('-5')||r.label.startsWith('-3')){
          if(r.pct<30 && r.tot>20){ risk='WARN'; col='var(--warning)'; }
        }
        return `<tr style="${risk!=='OK'?'background:rgba(239,68,68,0.06)':''}"><td>${r.label}</td><td>${r.tot}</td><td>${r.retActive}</td><td><b style="color:${col}">${r.pct.toFixed(1)}%</b></td><td>${r.avgRet? r.avgRet.toFixed(1):'—'}</td><td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${risk==='CRITICAL'?'rgba(239,68,68,0.18)': risk==='WARN'?'rgba(245,158,11,0.18)':'rgba(16,185,129,0.12)'};color:${col};border:1px solid ${col}">${risk}</span></td></tr>`;
      }).join('');

    // charts
    this.destroyChart('ch-an-grad-scatter');
    const ctx = document.getElementById('ch-an-grad-scatter').getContext('2d');
    CHARTS['ch-an-grad-scatter'] = new Chart(ctx, {
      type:'scatter',
      data:{ datasets:[{ label:'Retarder events', data: scatterPts, backgroundColor: scatterPts.map(p=> p.speed<5 ? '#ef4444' : p.speed<12 ? '#f59e0b' : '#10b981'), pointRadius: 4, pointHoverRadius:6 }]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ x:{ title:{display:true,text:'Gradient (°) — negative = downhill', color:'#94a3b8'}, grid:{color:'#1e293b'}, ticks:{color:'#94a3b8'}}, y:{ title:{display:true,text:'Retarder Position', color:'#94a3b8'}, min:0, max:90, grid:{color:'#1e293b'}, ticks:{color:'#94a3b8'}}}, plugins:{ tooltip:{ callbacks:{ label:(c)=> `Grad ${c.parsed.x.toFixed(1)}° · Ret ${c.parsed.y} · Speed ${c.raw.speed.toFixed(1)} km/h`} }, legend:{display:false}} }
    });
    this.destroyChart('ch-an-grad-bar');
    const ctx2 = document.getElementById('ch-an-grad-bar').getContext('2d');
    CHARTS['ch-an-grad-bar'] = new Chart(ctx2, {
      type:'bar',
      data:{ labels: binLabels, datasets:[{ label:'% Retarder active (>10)', data: tableRows.map(r=> r.pct), backgroundColor: tableRows.map(r=> r.pct<60 && r.label.includes('-') ? '#ef4444' : '#3b82f6'), borderRadius:4 }]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:0, max:100, grid:{color:'#1e293b'}, ticks:{color:'#94a3b8', callback:v=> v+'%'}}, x:{ ticks:{color:'#94a3b8', maxRotation:45, minRotation:20}}}, plugins:{ legend:{display:false}, annotation:{} } }
    });
    // anomaly callout
    const steep = tableRows.filter(r=> ['-15–-10°','-10–-7°','-7–-5°'].includes(r.label));
    const badSteep = steep.filter(r=> r.pct<60);
    const anEl = document.getElementById('an-grad-anomaly');
    if(badSteep.length){
      anEl.innerHTML = `<div class="anomaly-badge crit">🚨 ${badSteep.length} steep downhill band(s) with retarder under-use (&lt;60%) — foot-brake riding risk</div><div style="font-size:12px;color:var(--text-sec);margin-top:8px">${badSteep.map(r=> `${r.label}: ${r.pct.toFixed(1)}% active (n=${r.tot})`).join(' · ')}</div>`;
    } else {
      anEl.innerHTML = `<div class="anomaly-badge ok">✅ Retarder discipline nominal on steep descents</div>`;
    }
  },

  _renderAnalyticsInsights(rows){
    const insights=[];
    // 1 Fuel-speed
    const lowSpeedHighFuel = rows.filter(r=> r.gps<5 && r.fuel>900);
    const pctLow = lowSpeedHighFuel.length/rows.length*100;
    if(pctLow>8){
      insights.push({sev:'critical', icon:'⛽', title:`High diesel burn at low speed — ${pctLow.toFixed(1)}% of points (fuel &gt;900 L/h while &lt;5 km/h)`, cause:'Injector dribble / air-filter clog / prolonged idling with engine on.', ops:['Enforce engine-off for waits &gt;5 min; audit queue time at shovel/crusher','Cross-check payload — overloaded body raises fuel even at crawl'], maint:['Pop-test injectors; replace air-filter element & inspect turbo hoses','Calibrate fuel rail pressure sensor; sample fuel for contamination']});
    } else if(pctLow>4){
      insights.push({sev:'warning', icon:'⛽', title:`Moderate low-speed over-fuel — ${pctLow.toFixed(1)}%`, cause:'Early injector wear or idle discipline slipping.', ops:['Brief operators on idle policy; review dispatch los'], maint:['Schedule injector health check within 48 h']});
    }
    const highFuelMid = rows.filter(r=> r.gps>=5 && r.gps<15 && r.fuel>1500);
    if(highFuelMid.length>12){
      insights.push({sev:'warning', icon:'🔥', title:`Peak fuel spikes at 5-15 km/h — ${highFuelMid.length} events &gt;1500 L/h`, cause:'Overload or road drag (under-inflated tyres, rough road) or turbo under-boost.', ops:['Verify payload distribution — cap passes at 100 t','Flag road segments where spikes cluster for grading'], maint:['Check tyre pressures (all 6); inspect brakes for dragging (heat scan)','Turbo boost test & charge-air leak smoke test']});
    }
    // 2 RPM dumping
    const dumpRows = rows.filter(r=> parseFloat(r.hoist)>0);
    if(dumpRows.length){
      const overRev = dumpRows.filter(r=> r.rpm>1950);
      const lug = dumpRows.filter(r=> r.rpm<600);
      const avgDumpRPM = dumpRows.reduce((s,r)=>s+r.rpm,0)/dumpRows.length;
      if(overRev.length>0){
        insights.push({sev:'critical', icon:'🔧', title:`Over-rev during dumping — ${overRev.length}/${dumpRows.length} events &gt;1950 RPM (max ${Math.max(...dumpRows.map(r=>r.rpm)).toFixed(0)})`, cause:'Operator holding throttle during hoist / hoist-lever + accel pedal overlap.', ops:['Immediate toolbox talk: throttle to idle before hoist; GPS replay coaching','If repeat next shift → reassign operator'], maint:['Inspect hoist hydraulics for lag causing operator to rev; check eng protection limiter config']});
      }
      if(lug.length>0){
        insights.push({sev:'warning', icon:'⚠️', title:`Lugging during dump — ${lug.length} events &lt;600 RPM (stall risk)`, cause:'Engine lugging under hydraulic load / low idle setting.', ops:['Instruct operator to maintain ~700-800 RPM during hoist'], maint:['Verify idle speed calibration; check fuel supply pressure under load']});
      }
      if(avgDumpRPM>1650){
        insights.push({sev:'warning', icon:'📈', title:`Elevated mean dumping RPM ${avgDumpRPM.toFixed(0)} RPM`, cause:'Systematic over-throttle habit during tipping.', ops:['Add dumping RPM to weekly operator scorecard'], maint:['Trend hoist pump pressure vs RPM — pump wear raises required revs']});
      }
    } else {
      insights.push({sev:'info', icon:'ℹ️', title:'No hoist-active dumping points in selected window', cause:'Filter returned zero hoist&gt;0 records — ingest full August 8 shift CSV to see dumping phase.', ops:['Use Dumper 360 timeline to locate dump timestamps'], maint:['None — informational']});
    }
    // 3 Gradient-retarder
    const steepRows = rows.filter(r=> r.grad < -5);
    const steepActive = steepRows.filter(r=> r.ret>10);
    const steepPct = steepRows.length ? steepActive.length/steepRows.length*100 : 100;
    if(steepRows.length>10 && steepPct<60){
      insights.push({sev:'critical', icon:'🛑', title:`Retarder under-use on steep downhill — only ${steepPct.toFixed(1)}% active on grades &lt;-5° (n=${steepRows.length})`, cause:'Operator riding foot-brake / retarder lever fault / low retarder oil.', ops:['Retraining: retarder-first on Ramp 2 descent; enforce cool-down stop at ramp base','Install advisory retarder prompt on in-cab display'], maint:['Verify retarder lever position sensor & oil level/temp; bench-test retarder response','Inspect brake oil for overheating — replace if boiling point degraded']});
    } else if(steepRows.length>10 && steepPct<80){
      insights.push({sev:'warning', icon:'🛑', title:`Retarder discipline gap — ${steepPct.toFixed(1)}% on grades &lt;-5°`, cause:'Inconsistent retarder habits.', ops:['Monitor next 3 days; coach with GPS event replay'], maint:['Check retarder calibration']});
    }
    const shallowHighRet = rows.filter(r=> r.grad> -2 && r.grad <2 && r.ret>40);
    if(shallowHighRet.length>15){
      insights.push({sev:'info', icon:'ℹ️', title:`High retarder on flat (${shallowHighRet.length} events &gt;40 on -2 to 2°)`, cause:'Unnecessary retarder drag — wastes fuel & heats oil.', ops:['Coaching: release retarder on flat'], maint:['Verify retarder auto-release logic']});
    }

    const container = document.getElementById('an-insights');
    if(!insights.length){
      container.innerHTML = `<h3 style="color:var(--success)">✅ No actionable anomalies — profile nominal</h3><p class="sub">All three analyses within spec. Continue routine monitoring.</p>`;
      container.style.borderLeftColor = '#10b981';
      container.style.background = 'rgba(16,185,129,0.06)';
      return;
    }
    const sevOrder={critical:0,warning:1,info:2};
    insights.sort((a,b)=> sevOrder[a.sev]-sevOrder[b.sev]);
    const maxSev = insights[0].sev;
    container.style.borderLeftColor = maxSev==='critical' ? '#ef4444' : maxSev==='warning' ? '#f59e0b' : '#0ea5e9';
    container.style.background = maxSev==='critical' ? 'rgba(239,68,68,0.06)' : maxSev==='warning' ? 'rgba(245,158,11,0.06)' : 'rgba(14,165,233,0.06)';
    container.innerHTML = `<h3>${maxSev==='critical'?'🚨': maxSev==='warning'?'⚠️':'ℹ️'} Actionable Insights — ${insights.length} finding(s) · worst: ${maxSev.toUpperCase()}</h3><p class="sub" style="margin-bottom:0">Auto-generated from the three lab analyses; playbooks for Ops & Maintenance.</p>` +
      insights.map(it=>{
        const bg = it.sev==='critical'?'rgba(239,68,68,0.05)': it.sev==='warning'?'rgba(245,158,11,0.05)':'rgba(14,165,233,0.05)';
        const bd = it.sev==='critical'?'rgba(239,68,68,0.2)': it.sev==='warning'?'rgba(245,158,11,0.2)':'rgba(14,165,233,0.2)';
        const badge = it.sev==='critical'?'#ef4444': it.sev==='warning'?'#f59e0b':'#0ea5e9';
        return `<div style="margin-top:16px;background:${bg};border:1px solid ${bd};border-radius:8px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-weight:700;color:${badge}">${it.icon} ${it.title}</div>
            <span style="font-size:11px;padding:3px 8px;border-radius:10px;background:${badge};color:#fff;font-weight:700">${it.sev.toUpperCase()}</span>
          </div>
          <div style="font-size:12px;color:var(--text-sec);margin-bottom:10px"><b style="color:var(--text)">Root cause:</b> ${it.cause}</div>
          <div class="insight-grid">
            <div class="insight-box"><h4>👷 Operations</h4><ul>${it.ops.map(x=>`<li>${x}</li>`).join('')}</ul></div>
            <div class="insight-box"><h4>🔧 Maintenance</h4><ul>${it.maint.map(x=>`<li>${x}</li>`).join('')}</ul></div>
            <div class="insight-box"><h4>📋 Next step</h4><ul><li>Assign owner & due date in shift log</li><li>Re-measure after next shift to close loop</li><li>Escalate if persists &gt;2 shifts</li></ul></div>
          </div>
        </div>`;
      }).join('');
  },
};
