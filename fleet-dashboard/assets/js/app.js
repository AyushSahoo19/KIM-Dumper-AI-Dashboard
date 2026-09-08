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

  // 4b. Sidebar — fully collapsible (0), collapsed (72px), expanded (260px) + mobile overlay + resizable + window view
  (function(){
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse');
    const hamburger = document.getElementById('hamburger');
    const resizer = document.getElementById('sidebar-resizer');
    const overlay = document.getElementById('sidebar-overlay');
    const fab = document.getElementById('sidebar-fab');
    const LS_KEY_W = 'haulp_sidebar_w';
    const LS_KEY_C = 'haulp_sidebar_state'; // 0=expanded, 1=collapsed, 2=hidden
    const isMobile = ()=> window.innerWidth <= 768;
    // restore
    try{
      const savedW = localStorage.getItem(LS_KEY_W);
      if(savedW){ const w = parseInt(savedW,10); if(w>=160 && w<=420){ sidebar.style.width = w+'px'; } }
      const savedS = localStorage.getItem(LS_KEY_C);
      if(savedS==='1'){ sidebar.classList.add('collapsed'); if(collapseBtn) collapseBtn.textContent='›'; }
      else if(savedS==='2'){ sidebar.classList.add('hidden'); document.body.classList.add('sidebar-hidden'); if(collapseBtn) collapseBtn.textContent='‹'; }
    }catch(e){}
    function updateFab(){
      const hidden = sidebar.classList.contains('hidden');
      if(fab) fab.style.display = hidden ? 'inline-flex' : 'none';
      document.body.classList.toggle('sidebar-hidden', hidden);
    }
    updateFab();
    function setState(state){ // 0 expanded, 1 collapsed, 2 hidden
      sidebar.classList.remove('collapsed','hidden','mobile-open');
      if(overlay) overlay.classList.remove('active');
      if(state===1){ sidebar.classList.add('collapsed'); if(collapseBtn) collapseBtn.textContent='›'; }
      else if(state===2){ sidebar.classList.add('hidden'); if(collapseBtn) collapseBtn.textContent='‹'; }
      else { if(collapseBtn) collapseBtn.textContent='‹'; }
      try{ localStorage.setItem(LS_KEY_C, String(state)); }catch(e){}
      updateFab();
      setTimeout(()=>{ window.dispatchEvent(new Event('resize')); Object.values(window.CHARTS||{}).forEach(c=>{ try{c.resize();}catch(e){}}); }, 320);
    }
    function getState(){ if(sidebar.classList.contains('hidden')) return 2; if(sidebar.classList.contains('collapsed')) return 1; return 0; }
    function toggleCollapse(e){
      if(e && e.shiftKey){ // Shift+click → fully hidden (window view)
        setState(getState()===2 ? 0 : 2); return;
      }
      if(isMobile()){
        const open = sidebar.classList.contains('mobile-open');
        if(open){ sidebar.classList.remove('mobile-open'); if(overlay) overlay.classList.remove('active'); }
        else { sidebar.classList.add('mobile-open'); if(overlay) overlay.classList.add('active'); }
        return;
      }
      // desktop window view: cycle expanded → collapsed → hidden → expanded
      const s = getState();
      if(s===0) setState(1);
      else if(s===1) setState(2);
      else setState(0);
    }
    function showSidebar(){
      if(isMobile()){
        sidebar.classList.add('mobile-open'); if(overlay) overlay.classList.add('active');
      } else {
        setState(0);
      }
    }
    if(collapseBtn){
      collapseBtn.addEventListener('click', toggleCollapse);
      collapseBtn.addEventListener('dblclick', (e)=>{ e.preventDefault(); setState(getState()===2?0:2); });
      collapseBtn.title = 'Click: collapse (72px) · Shift+Click or Double-click: hide fully (0) · Ctrl+B';
    }
    if(hamburger) hamburger.addEventListener('click', toggleCollapse);
    if(overlay) overlay.addEventListener('click', ()=>{ sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); });
    if(fab) fab.addEventListener('click', showSidebar);
    // draggable resizer (desktop only)
    if(resizer){
      let dragging=false, startX=0, startW=0;
      resizer.addEventListener('mousedown', (e)=>{
        if(sidebar.classList.contains('collapsed') || sidebar.classList.contains('hidden') || isMobile()) return;
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
      // touch for mobile/tablet
      resizer.addEventListener('touchstart', (e)=>{
        if(sidebar.classList.contains('collapsed') || sidebar.classList.contains('hidden') || isMobile()) return;
        dragging=true; startX=e.touches[0].clientX; startW=sidebar.getBoundingClientRect().width;
        e.preventDefault();
      }, {passive:false});
      window.addEventListener('touchmove', (e)=>{
        if(!dragging) return;
        let newW = startW + (e.touches[0].clientX - startX);
        newW = Math.max(160, Math.min(420, newW));
        sidebar.style.width = newW+'px';
        window.dispatchEvent(new Event('resize'));
      }, {passive:false});
      window.addEventListener('touchend', ()=>{
        if(!dragging) return;
        dragging=false;
        try{ localStorage.setItem(LS_KEY_W, String(Math.round(sidebar.getBoundingClientRect().width))); }catch(e){}
        Object.values(window.CHARTS||{}).forEach(c=>{ try{c.resize();}catch(e){}});
      });
    }
    // close mobile drawer on nav click
    document.querySelectorAll('.sidebar-nav a').forEach(a=>{
      a.addEventListener('click', ()=>{
        if(isMobile()){ sidebar.classList.remove('mobile-open'); if(overlay) overlay.classList.remove('active'); }
      });
    });
    // handle resize: if switching to mobile, clear hidden/collapsed inline width
    window.addEventListener('resize', ()=>{
      updateFab();
      if(!isMobile()){
        if(overlay) overlay.classList.remove('active');
        sidebar.classList.remove('mobile-open');
      }
      Object.values(window.CHARTS||{}).forEach(c=>{ try{c.resize();}catch(e){}});
    });
    // keyboard shortcut: Ctrl+B → cycle collapsed/hidden
    window.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='b'){ e.preventDefault(); toggleCollapse(e); }});
    // expose for debugging
    window._sidebarToggle = toggleCollapse;
    window._sidebarShow = showSidebar;
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
  
  // 6. Try auto-ingest August 8 prototype CSV — single Vercel-safe URL (no 404 spam), no-space path
  const tryAutoIngestAugust = async ()=>{
    const csvUrl = new URL('data/august-8/RD20260808151024-HD785-7-N10706.csv', window.location.href).href;
    const candidates = [ csvUrl, new URL('../data/august-8/RD20260808151024-HD785-7-N10706.csv', window.location.href).href, '/data/august-8/RD20260808151024-HD785-7-N10706.csv' ];
    for(const url of candidates){
      try{
        const res = await fetch(url, {cache:'no-store'});
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
