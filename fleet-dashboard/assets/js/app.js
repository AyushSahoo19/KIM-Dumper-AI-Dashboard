/* ═══════════════════════════════════════════════════════════════
   HaulPro Fleet Command — app.js
   Initialization, Global Events, and Lifecycle Orchestration
   ═══════════════════════════════════════════════════════════════ */

function initApp() {
  // 1. Initialize Mock Data
  initData();
  
  // 2. Populate Global Selectors
  window.updateDateSelectors = function(targetDate = null) {
    const yearSel = document.getElementById('global-year');
    const monthSel = document.getElementById('global-month');
    const daySel = document.getElementById('global-day');
    
    if (DATA.dates.length === 0) return;
    const current = targetDate || DataStore.latestDate();
    const [cY, cM, cD] = current.split('-');

    // Build tree
    const tree = {};
    DATA.dates.forEach(d => {
      const [y, m, day] = d.split('-');
      if (!tree[y]) tree[y] = {};
      if (!tree[y][m]) tree[y][m] = new Set();
      tree[y][m].add(day);
    });

    // Populate Year
    const years = Object.keys(tree).sort();
    yearSel.innerHTML = '';
    years.forEach(y => yearSel.add(new Option(y, y)));
    if (years.includes(cY)) yearSel.value = cY;

    // Populate Month based on Year
    const populateMonths = () => {
      const y = yearSel.value;
      const months = Object.keys(tree[y] || {}).sort();
      monthSel.innerHTML = '';
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      months.forEach(m => monthSel.add(new Option(monthNames[parseInt(m, 10)-1], m)));
      
      let selMonth = monthSel.options[0]?.value;
      if (y === cY && months.includes(cM)) selMonth = cM;
      monthSel.value = selMonth;
    };

    // Populate Day based on Year+Month
    const populateDays = () => {
      const y = yearSel.value;
      const m = monthSel.value;
      const days = Array.from(tree[y]?.[m] || []).sort();
      daySel.innerHTML = '';
      days.forEach(d => daySel.add(new Option(d, d)));
      
      let selDay = daySel.options[0]?.value;
      if (y === cY && m === cM && days.includes(cD)) selDay = cD;
      daySel.value = selDay;
    };

    populateMonths();
    populateDays();

    yearSel.onchange = () => { populateMonths(); populateDays(); VIEWS.renderCurrent(); };
    monthSel.onchange = () => { populateDays(); VIEWS.renderCurrent(); };
    daySel.onchange = () => { VIEWS.renderCurrent(); };
  };

  updateDateSelectors();
  
  const dpSel = document.getElementById('global-dumper');
  FLEET.forEach(d => dpSel.add(new Option(dumperName(d.id), d.id)));
  
  // 3. Bind Global Events
  dpSel.addEventListener('change', () => VIEWS.renderCurrent());
  
  document.getElementById('btn-refresh').addEventListener('click', () => {
    VIEWS.toast('Fetching latest fleet telemetry...');
    setTimeout(() => VIEWS.renderCurrent(), 800);
  });
  
  // 4. Bind Navigation
  document.querySelectorAll('.sidebar-nav a').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.currentTarget.getAttribute('data-section');
      if (section && document.getElementById(`sec-${section}`)) {
        VIEWS.activeSection = section;
        VIEWS.renderCurrent();
      } else {
        VIEWS.toast('This module is under development', 'err');
      }
    });
  });

  // 4b. Sidebar collapsible + resizable
  (function(){
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse');
    const hamburger = document.getElementById('hamburger');
    const resizer = document.getElementById('sidebar-resizer');
    const LS_KEY_W = 'haulp_sidebar_w';
    const LS_KEY_C = 'haulp_sidebar_collapsed';
    // restore
    try{
      const savedW = localStorage.getItem(LS_KEY_W);
      if(savedW){ const w = parseInt(savedW,10); if(w>=160 && w<=420){ sidebar.style.width = w+'px'; } }
      if(localStorage.getItem(LS_KEY_C)==='1'){ sidebar.classList.add('collapsed'); if(collapseBtn) collapseBtn.textContent='›'; }
    }catch(e){}
    function toggleCollapse(){
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      if(collapseBtn) collapseBtn.textContent = isCollapsed ? '›' : '‹';
      try{ localStorage.setItem(LS_KEY_C, isCollapsed?'1':'0'); }catch(e){}
      // trigger chart resize after transition
      setTimeout(()=>{ window.dispatchEvent(new Event('resize')); Object.values(window.CHARTS||{}).forEach(c=>{ try{c.resize();}catch(e){}}); }, 300);
    }
    if(collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);
    if(hamburger) hamburger.addEventListener('click', toggleCollapse);
    // draggable resizer
    if(resizer){
      let dragging=false, startX=0, startW=0;
      resizer.addEventListener('mousedown', (e)=>{
        if(sidebar.classList.contains('collapsed')) return;
        dragging=true; startX=e.clientX; startW=sidebar.getBoundingClientRect().width;
        document.body.style.cursor='ew-resize'; document.body.style.userSelect='none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e)=>{
        if(!dragging) return;
        let newW = startW + (e.clientX - startX);
        newW = Math.max(160, Math.min(420, newW));
        sidebar.style.width = newW+'px';
        window.dispatchEvent(new Event('resize'));
      });
      window.addEventListener('mouseup', ()=>{
        if(!dragging) return;
        dragging=false; document.body.style.cursor=''; document.body.style.userSelect='';
        try{ localStorage.setItem(LS_KEY_W, String(Math.round(sidebar.getBoundingClientRect().width))); }catch(e){}
        Object.values(window.CHARTS||{}).forEach(c=>{ try{c.resize();}catch(e){}});
      });
    }
    // keyboard shortcut: Ctrl+B
    window.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='b'){ e.preventDefault(); toggleCollapse(); }});
  })();
  
  // 5. CSV Upload Logic
  const fileInput = document.getElementById('st-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const logDiv = document.getElementById('st-ingest-log');
      logDiv.classList.add('active');
      
      VIEWS.toast(`Processing ${files.length} file(s)...`);
      
      let lastIngestedDate = null;
      for (const file of files) {
        try {
          const text = await file.text();
          const res = DataStore.ingest(file.name, file.name, text);
          const p = document.createElement('div');
          p.className = `log-line ${res.ok ? 'log-ok' : 'log-err'}`;
          p.textContent = res.msg;
          logDiv.appendChild(p);
          if (res.ok) lastIngestedDate = res.date;
        } catch (err) {
          const p = document.createElement('div');
          p.className = 'log-line log-err';
          p.textContent = `Error reading ${file.name}: ${err.message}`;
          logDiv.appendChild(p);
        }
      }
      
      // Update global date selectors if new dates were added
      if (lastIngestedDate) {
        updateDateSelectors(lastIngestedDate);
      } else {
        updateDateSelectors();
      }
      
      VIEWS.toast(`Finished processing ${files.length} file(s)`);
      VIEWS.renderCurrent(); 
      fileInput.value = ''; // Reset
    });
  }
  
  // 6. Try auto-ingest August 8 prototype CSV — Vercel-safe (no-space path first) + legacy encoded fallback
  const tryAutoIngestAugust = async ()=>{
    const candidates = [
      'data/august-8/RD20260808151024-HD785-7-N10706.csv',
      '../data/august-8/RD20260808151024-HD785-7-N10706.csv',
      '../../data/august-8/RD20260808151024-HD785-7-N10706.csv',
      '/data/august-8/RD20260808151024-HD785-7-N10706.csv',
      '../../August%208%20data/RD20260808151024-HD785-7-N10706.csv',
      '../August%208%20data/RD20260808151024-HD785-7-N10706.csv',
      'August%208%20data/RD20260808151024-HD785-7-N10706.csv',
      '/August%208%20data/RD20260808151024-HD785-7-N10706.csv'
    ];
    for(const url of candidates){
      try{
        const res = await fetch(url);
        if(!res.ok) continue;
        const text = await res.text();
        const r = DataStore.ingest('RD20260808151024-HD785-7-N10706.csv', 'RD20260808151024-HD785-7-N10706.csv', text);
        if(r.ok){
          updateDateSelectors(r.date);
          ENGINE_CACHE.alerts=null;
          VIEWS.toast(`Prototype data loaded: ${r.msg}`, 'ok');
          VIEWS.renderCurrent();
          return;
        }
      }catch(e){ /* file:// will fail, ignore — use drag-drop */ }
    }
  };
  tryAutoIngestAugust();

  // 6b. Hide Loader and Render Initial View
  document.getElementById('loader').classList.add('hidden');
  VIEWS.renderCurrent();
  VIEWS.toast('System initialized successfully — open Analytics Lab for Diesel/Speed, RPM-Dumping & Gradient-Retarder reports');
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
