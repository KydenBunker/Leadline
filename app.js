
/* Leadline v4 — two role workspaces, appointments + designer timesheets, optional Supabase sync.
   No third-party scripts, analytics, secret keys, or paid services are necessary. */
(() => {
  'use strict';
  const demoMode = new URLSearchParams(location.search).get('demo') === '1';
  const ALERT_KEY = 'leadline-v4-7-local-alerts';
  const ALERT_PREF_KEY = 'leadline-v4-7-alert-enabled';
  const DATA_KEY = 'leadline-v2-data';
  const CLOUD_KEY = 'leadline-v2-cloud';
  const AUTH_KEY = 'leadline-v2-auth';
  const TIMER_KEY = 'leadline-v3-active-timer';
  const TIMER_NOTIFY_KEY = 'leadline-v4-8-timer-notify';
  const PENDING_KEY='leadline-v5.4-pending-sync';
  const TYPES = ['Phone / video', 'In person'];
  const ACCENTS=['purple','blue','green','red','gold','gray','white'];
  const SOURCES = ['Website', 'Instagram', 'Phone call', 'Walk-in', 'Referral', 'Other'];
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').trim();
  const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => {const d = new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const iso = () => new Date().toISOString();
  const makeUUID = () => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); if (crypto?.getRandomValues) crypto.getRandomValues(b); else for(let i=0;i<16;i++) b[i]=Math.floor(Math.random()*256);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const x = Array.from(b, n => n.toString(16).padStart(2,'0')).join('');
    return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;
  };
  const weekday = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {weekday:'short'});
  const niceDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}) : 'Unknown';
  const startWeek = () => {const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return localYMD(d);};
  const localYMD = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const thisMonth = () => today().slice(0,7);
  function loadJSON(key, fallback) {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
  const initial = loadJSON(DATA_KEY, {});
  let state = { records: Array.isArray(initial.records) ? initial.records : [], goal: Math.max(1, Math.min(1000, Number(initial.goal) || 25)), goalUpdatedAt: initial.goalUpdatedAt || '2020-01-01T00:00:00.000Z', hours: Array.isArray(initial.hours) ? initial.hours : [], designerPrefs: {rate: initial.designerPrefs?.rate ?? null, threshold: initial.designerPrefs?.threshold ?? 40, multiplier: initial.designerPrefs?.multiplier ?? 1.5}, prefsUpdatedAt: initial.prefsUpdatedAt || '2020-01-01T00:00:00.000Z', sales:Array.isArray(initial.sales)?initial.sales:[], commissionRate:Math.max(0,Math.min(100,Number(initial.commissionRate??2)||0)),appearance:{theme:['dark','light'].includes(initial.appearance?.theme)?initial.appearance.theme:'dark',accent:ACCENTS.includes(initial.appearance?.accent)?initial.appearance.accent:'purple'},v5:initial.v5||{} };
  let cloud = demoMode ? {url:'', key:''} : loadJSON(CLOUD_KEY, {url:'', key:''});
  let session = demoMode ? null : loadJSON(AUTH_KEY, null);
  let activePage = 'dashboard';
  let activeRole = 'sdr';
  let timerState = demoMode ? null : loadJSON(TIMER_KEY, null);
  let syncBusy = false, queuedSync = false, syncTimer, toastTimer, installPrompt = null, lastSync = null;
  let localRevision=0;
  let pendingSync = !demoMode && localStorage.getItem(PENDING_KEY)==='yes';
  let lastAutoSyncAttempt=0;
  const trendRanges = {sdr:30, designer:30};
  let winsRange=30,winSelected=null,salesCloudReady=true;
  let alertEnabled=!demoMode && localStorage.getItem(ALERT_PREF_KEY)==='yes';
  let timerNotifications=!demoMode && localStorage.getItem(TIMER_NOTIFY_KEY)==='yes';
  let lastTimerNoticeMinute=-1;
  let importedResults=[];
  let importedImageURL=null,importedImageFile=null;

  let alerts=demoMode?[]:loadJSON(ALERT_KEY,[]).slice(0,30);
  const trendSelected = {sdr:null, designer:null};

  if(demoMode){
    state.records=[]; state.hours=[];
    const past=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return localYMD(d);};
    for(let i=0;i<30;i++){
      const num=([1,3,2,4,0,1,3,2,5,1,2,3,0,4,2,1,4,3,0,2,1,5,2,3,2,4,0,3,1,2])[i];
      for(let j=0;j<num;j++)state.records.push({id:`demo-appointment-${i}-${j}`,dateSet:past(i),label:['20×24 pavilion · Idaho','Pergola · Utah','Gazebo · Colorado','Timber frame · Arizona'][j%4],meetingType:j%3===0?'In person':'Phone / video',projectType:['Pavilion','Pergola','Gazebo','Timber trusses'][j%4],source:['Website','Instagram','Referral','Walk-in'][j%4],notes:'Preview data only',createdAt:iso(),updatedAt:iso(),deleted:false});
      if(i<20 && i%6!==4){const d=new Date(`${past(i)}T08:00:00`);const hrs=[3,5,4.5,6.2,2.5,7][i%6];state.hours.push({id:`demo-hour-${i}`,project:['Cedar pavilion drawings','Pergola 3D model','Timber truss revisions'][i%3],task:'3D modeling',startedAt:d.toISOString(),endedAt:new Date(d.getTime()+hrs*3600000).toISOString(),breakMinutes:0,notes:'Preview only',createdAt:iso(),updatedAt:iso(),deleted:false});}
    }
    state.designerPrefs={rate:20,threshold:40,multiplier:1.5};
    state.sales=[{id:makeUUID(),customer:'Jordan Example',amount:28000,project:'Cedar pergola',dateSet:past(3),sourceText:'Jordan Example signed for $28k. Cedar pergola.',appointmentId:state.records[4]?.id||'',createdAt:iso(),updatedAt:iso(),deleted:false},{id:makeUUID(),customer:'',amount:31000,project:'Redwood pergola',dateSet:past(1),sourceText:'Redwood pergola. 31k. Out of state.',appointmentId:'',createdAt:iso(),updatedAt:iso(),deleted:false}];
  }
  function normalizedSale(entry){return {id:safe(entry.id)||makeUUID(),customer:safe(entry.customer).slice(0,100),amount:entry.amount===''||entry.amount==null?null:Math.max(0,Math.min(1e9,Number(entry.amount)||0)),project:safe(entry.project).slice(0,120),dateSet:/^\d{4}-\d{2}-\d{2}$/.test(safe(entry.dateSet))?entry.dateSet:today(),sourceText:safe(entry.sourceText).slice(0,2500),appointmentId:safe(entry.appointmentId).slice(0,100),createdAt:safe(entry.createdAt)||iso(),updatedAt:safe(entry.updatedAt)||iso(),deleted:!!entry.deleted};}
  state.sales=state.sales.filter(x=>x&&typeof x==='object').map(normalizedSale);
  function liveSales(){return state.sales.filter(x=>!x.deleted);}
  function linkedSales(){const set=new Set(live().map(x=>x.id));return liveSales().filter(x=>set.has(x.appointmentId));}
  function applyAppearance(){document.documentElement.dataset.theme=state.appearance.theme;document.documentElement.dataset.accent=state.appearance.accent;const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=state.appearance.theme==='dark'?getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#0a0811':'#f8faf9';}
  applyAppearance();
  function normalized(entry) {
    return { id: safe(entry.id) || makeUUID(), dateSet: /^\d{4}-\d{2}-\d{2}$/.test(safe(entry.dateSet)) ? entry.dateSet : today(), meetingType: TYPES.includes(entry.meetingType) ? entry.meetingType : TYPES[0], projectType: safe(entry.projectType).slice(0,80), source: safe(entry.source).slice(0,80), label: safe(entry.label).slice(0,150), notes: safe(entry.notes).slice(0,3000), createdAt: safe(entry.createdAt) || iso(), updatedAt: safe(entry.updatedAt) || iso(), deleted: !!entry.deleted };
  }
  state.records = state.records.filter(x=>x && typeof x==='object').map(normalized);
  const validDt = v => Number.isFinite(Date.parse(v));
  function normalizedHour(x){return {id: safe(x.id) || makeUUID(), project:safe(x.project).slice(0,100), task:safe(x.task).slice(0,70)||'Other', startedAt:safe(x.startedAt), endedAt:safe(x.endedAt), breakMinutes: Math.max(0,Math.min(1440,Math.round(Number(x.breakMinutes)||0))), notes:safe(x.notes).slice(0,1000), createdAt:safe(x.createdAt)||iso(), updatedAt:safe(x.updatedAt)||iso(), deleted:!!x.deleted};}
  state.hours=state.hours.filter(x=>x && typeof x==='object').map(normalizedHour).filter(x=>x.deleted || (validDt(x.startedAt)&&validDt(x.endedAt)&&Date.parse(x.endedAt)>Date.parse(x.startedAt)));
  function liveHours(){return state.hours.filter(x=>!x.deleted && validDt(x.startedAt) && validDt(x.endedAt));}
  function persist(fromSync=false) {
    if(demoMode)return true;
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(state));
      if(!fromSync){localRevision++;pendingSync=true;localStorage.setItem(PENDING_KEY,'yes');}
      updateV54SyncMessage();
      return true;
    }catch{alert('Could not save locally. Check browser storage and export a backup.');return false;}
  }
  function updateV54SyncMessage(){
    const el=$('v54-sync-info');if(!el)return;
    const ready=!!(cloud.url && cloud.key && session?.access_token);
    const status=syncBusy?'Syncing your changes…':!navigator.onLine?(pendingSync?'Saved on this device · Waiting for internet':'Offline · Saved on this device'):!ready?'Saved on this device · Cloud not connected':pendingSync?'Saved locally · Waiting to sync':lastSync?'All changes synced · '+lastSync.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Connected · Checking cloud';
    el.textContent=status;el.dataset.state=syncBusy?'busy':pendingSync?'pending':lastSync?'synced':'local';
  }
  function saveCloud() {if(!demoMode)localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));}
  function saveSession() {if(demoMode)return;if(session)localStorage.setItem(AUTH_KEY, JSON.stringify(session));else localStorage.removeItem(AUTH_KEY);}
  function live() {return state.records.filter(x=>!x.deleted);}
  function selected(range, d) { return range==='all'||range==='today'&&d===today()||range==='week'&&d>=startWeek()&&d<=today()||range==='month'&&d.slice(0,7)===thisMonth(); }
  const count = (range) => live().filter(x=>selected(range, x.dateSet)).length;
  function toast(msg) {const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}
  function renderAlerts(){
    const button=$('enable-alerts'),status=$('alert-status'),inbox=$('alert-inbox');
    if(!button||!status||!inbox)return;
    button.textContent=alertEnabled?'Turn off notifications':'Enable app notifications';
    status.textContent=demoMode?'Preview: notifications are simulated; no browser permission requested.'
      :typeof Notification==='undefined'?'Android system notifications are not available here. In-app alerts still work.'
      :Notification.permission==='denied'?'Notifications blocked by Android or Chrome. Enable Leadline notifications in your phone app/site settings, then try again.'
      :alertEnabled && Notification.permission==='granted'?'Android permission granted. Sales alerts work while Leadline is open and a new unmatched win is imported.'
      :Notification.permission==='default'?'Notification permission has not been granted. Tap Enable or Send test notification.'
      :'Sales notifications are off. Tap Enable to get alerts while Leadline is open.';
    inbox.innerHTML=alerts.length?alerts.slice(0,6).map(x=>`<div class="alert-example">🔔 ${h(x.text)} <small>· ${h(new Date(x.when).toLocaleString())}</small></div>`).join(''):'<p class="help">No alerts yet. Save an unmatched Sales Win to see one here.</p>';
  }
  function winAlert(){
    const alert={id:makeUUID(),text:'New Sales Win needs confirmation — review unmatched sales.',when:iso()};
    alerts.unshift(alert);alerts=alerts.slice(0,30);
    if(!demoMode)try{localStorage.setItem(ALERT_KEY,JSON.stringify(alerts));}catch{}
    renderAlerts();
    if(alertEnabled && !demoMode && typeof Notification!=='undefined'&& Notification.permission==='granted'){
      appNotification('Leadline · Sales Win needs confirmation','Review an unmatched sales announcement in Leadline.','leadline-sales-review');
    }
  }
  async function toggleAlerts(){
    if(!alertEnabled && !demoMode){
      if(typeof Notification==='undefined'){toast('System notifications are not available here');renderAlerts();return;}
      if(Notification.permission==='default')try{await Notification.requestPermission();}catch{}
      if(Notification.permission!=='granted'){
        alertEnabled=false;
        toast('Android notification permission is needed. Check phone notification settings.');
        renderAlerts();return;
      }
    }
    alertEnabled=!alertEnabled;
    if(!demoMode)localStorage.setItem(ALERT_PREF_KEY,alertEnabled?'yes':'no');
    renderAlerts();
    toast(alertEnabled?'Sales Wins alerts enabled while the app is open':'Sales Wins alerts disabled');
  }
  async function appNotification(title,body,tag,{silent=false}={}){
    if(demoMode || typeof Notification==='undefined' || Notification.permission!=='granted')return false;
    try{
      // Android Chrome needs showNotification via the active service worker.
      if('serviceWorker' in navigator){
        let reg=await navigator.serviceWorker.getRegistration('./');
        if(!reg)reg=await navigator.serviceWorker.register('./sw.js');
        if(!reg.active){
          const ready=await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(()=>resolve(null),7000))]);
          if(ready)reg=ready;
        }
        if(!reg.active || typeof reg.showNotification!=='function')return false;
        await reg.showNotification(title,{body,tag,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',silent,data:{source:'leadline'}});
        return true;
      }
      new Notification(title,{body,tag,silent});return true;
    }catch(error){console.warn('Notification not available',error);return false;}
  }
  async function testSystemNotification(){
    if(demoMode){winAlert();toast('Preview: system notifications are disabled in demo mode');return;}
    if(typeof Notification==='undefined'){toast('This browser cannot show app notifications');renderAlerts();return;}
    if(Notification.permission==='default')try{await Notification.requestPermission();}catch{}
    if(Notification.permission!=='granted'){
      toast('Notification permission blocked. Allow notifications in your phone settings.');renderAlerts();return;
    }
    const ok=await appNotification('Leadline test','Notifications are working on this device.','leadline-test-'+Date.now());
    toast(ok?'Test notification sent. Check your notification shade.':'Test failed. Check Chrome/Android notifications and reopen Leadline.');
    renderAlerts();
  }
  async function closeTimerNotification(){
    if(demoMode||!('serviceWorker' in navigator))return;
    try{const reg=await navigator.serviceWorker.ready;const list=await reg.getNotifications({tag:'leadline-designer-timer'});list.forEach(n=>n.close());}catch{}
  }
  function timerElapsedMs(){if(!timerState)return 0;const end=timerState.pausedAt?Date.parse(timerState.pausedAt):Date.now();return Math.max(0,end-Date.parse(timerState.startAt)-Math.max(0,Number(timerState.breakMs)||0));}
  function timerHuman(ms){const minutes=Math.floor(ms/60000);return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`;}
  async function refreshTimerNotice(force=false){
    const status=$('timer-notification-status');const shade=$('timer-shade-status');
    if(shade)shade.textContent=timerState?`${timerHuman(timerElapsedMs())} · ${timerState.pausedAt?'On break':'Working'} · ${timerState.project}`:'Not clocked in · no timer notification';
    if(status)status.textContent=!timerNotifications?'Off':demoMode?'Preview only; no real notification sent.':typeof Notification==='undefined'?'Browser notifications unavailable.':Notification.permission!=='granted'?'Permission required: enable notifications in Settings.':timerState?'Enabled · tap Refresh to update the Android notification.':'Enabled · the next clock-in will show a notification.';
    if(!timerNotifications || !timerState){if(force)await closeTimerNotification();return;}
    const currentMinute=Math.floor(timerElapsedMs()/60000);
    if(!force && (currentMinute===lastTimerNoticeMinute || document.hidden))return;
    lastTimerNoticeMinute=currentMinute;
    const info=`${timerState.project} · ${timerState.pausedAt?'ON BREAK':'Clocked in'} · ${timerHuman(timerElapsedMs())} elapsed · started ${fmtTime(timerState.startAt)}`;
    await appNotification('Leadline · Project Designer',info,'leadline-designer-timer',{silent:true});
  }
  async function toggleTimerNotifications(){
    const wanted=$('timer-notification-enabled').checked;
    if(wanted&&!demoMode){if(typeof Notification==='undefined'){toast('Notifications not supported on this browser');$('timer-notification-enabled').checked=false;return;}
      if(Notification.permission==='default')try{await Notification.requestPermission();}catch{}
      if(Notification.permission!=='granted'){toast('Allow notifications in Android/Chrome settings first');$('timer-notification-enabled').checked=false;return;}}
    timerNotifications=wanted;
    if(!demoMode)localStorage.setItem(TIMER_NOTIFY_KEY,wanted?'yes':'no');
    lastTimerNoticeMinute=-1;
    if(!wanted)await closeTimerNotification();else await refreshTimerNotice(true);
    renderTimerSettings();
  }
  function renderTimerSettings(){if($('timer-notification-enabled'))$('timer-notification-enabled').checked=timerNotifications;const shade=$('timer-shade-status');if(shade&&!timerState)shade.textContent=timerNotifications?'On · start the clock to see a notification':'Off · enable in Settings to show elapsed time while clocked in.';}

  function patchEntry(entry) {const index=state.records.findIndex(x=>x.id===entry.id);if(index<0) state.records.push(entry);else state.records[index]=entry;if(persist()){render(); scheduleSync();}}
  function setRole(role){
    if(!['sdr','designer'].includes(role))return;
    activeRole=role;
    document.querySelectorAll('[data-role]').forEach(el=>{const on=el.dataset.role===role;el.classList.toggle('selected',on);el.setAttribute('aria-selected',String(on));});
    document.querySelectorAll('.role-sdr,[data-sdr-only]').forEach(el=>el.classList.toggle('hidden',role!=='sdr'));
    document.querySelectorAll('.role-designer,[data-designer-only]').forEach(el=>el.classList.toggle('hidden',role!=='designer'));
    $('sidebar-role').textContent=role==='designer'?'PROJECT DESIGNER':'SALES DEVELOPMENT';
    const action=$('main-action');action.textContent=role==='designer'?'+ Add work hours':'+ Log appointment';
    action.toggleAttribute('data-add',role==='sdr');action.toggleAttribute('data-hours-add',role==='designer');
    try{localStorage.setItem('leadline-v3-role',role);}catch{}
    setPage(role==='designer'?'designer':'dashboard');
  }
  function setPage(p) {
    if(!['dashboard','appointments','formatter','sales','designer','hours','settings','insights','income','goals','productivity','invoices'].includes(p)) return;
    if(['designer','hours','productivity','invoices'].includes(p)&&activeRole!=='designer'){setRole('designer');if(p==='designer')return;}
    if(['dashboard','appointments','formatter','sales','goals'].includes(p)&&activeRole!=='sdr'){setRole('sdr');if(p==='dashboard')return;}
    activePage=p;
    document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!==`page-${p}`));
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===p));
    $('location-title').textContent=({dashboard:'Dashboard',appointments:'Appointments',formatter:'Formatter',sales:'Sales Wins',designer:'Designer overview',hours:'Time entries',settings:'Settings & sync',insights:'Statistics Lab',income:'Income',goals:'Goals & records',productivity:'Productivity',invoices:'Timesheets & invoices'})[p];
    window.scrollTo(0,0);
    if(typeof renderV5==='function')renderV5();
  }
  function dateSeries(days){return Array.from({length:days},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(days-1-i));return localYMD(d);});}
  function renderTrend(role, lookup, sumLabel){
    const days=trendRanges[role], dates=dateSeries(days), values=dates.map(day=>Math.max(0,lookup(day)));
    const total=values.reduce((a,b)=>a+b,0), selectedDate=dates.includes(trendSelected[role])?trendSelected[role]:dates.at(-1);
    trendSelected[role]=selectedDate;
    const isHours=role==='designer';
    const maxRaw=Math.max(1,...values),max=isHours?Math.ceil(maxRaw*1.2):Math.max(2,Math.ceil(maxRaw*1.2));
    const width=780,height=256,left=38,right=14,top=19,bottom=40,plotW=width-left-right,plotH=height-top-bottom;
    const x=i=>left+i/(days-1)*plotW,y=v=>top+(1-v/max)*plotH;
    const coords=values.map((v,i)=>[x(i),y(v)]),points=coords.map(p=>p.join(',')).join(' ');
    const area=`M ${x(0)} ${top+plotH} L `+coords.map(([a,b])=>`${a} ${b}`).join(' L ')+` L ${x(days-1)} ${top+plotH} Z`;
    const index=dates.indexOf(selectedDate),selectX=x(index),selectY=y(values[index]);
    const marks=[0,.25,.5,.75,1].map(t=>{const yy=y(max*t);return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" class="grid-line"/><text class="axis-tick" x="${left-8}" y="${yy+4}" text-anchor="end">${isHours?Number((max*t).toFixed(1)):Math.round(max*t)}</text>`;}).join('');
    const labelEvery=days===7?1:days===30?5:days===90?15:60;
    const labs=dates.map((day,i)=>i%labelEvery===0||i===days-1?`<text class="axis-tick" x="${x(i)}" y="${height-11}" text-anchor="middle">${new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text>`:'').join('');
    const dots=coords.map(([px,py],i)=>`<circle class="chart-point ${dates[i]===selectedDate?'picked':''}" cx="${px}" cy="${py}" r="${dates[i]===selectedDate?5.6:days<=30?2.8:1.1}"/><rect data-trend-day="${role}" data-date="${dates[i]}" x="${px-plotW/days/2}" y="${top}" width="${Math.max(3,plotW/days)}" height="${plotH+6}" fill="transparent"><title>${dates[i]}: ${isHours?values[i].toFixed(2)+' hours':values[i]+' appointments'}</title></rect>`).join('');
    const chartId=role==='sdr'?'weekly-chart':'designer-weekly-chart';
    $(chartId).innerHTML=`<svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="${isHours?'Paid hours':'Appointments'} by day, last ${days} days"><defs><linearGradient id="fill-${role}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${marks}<path d="${area}" fill="url(#fill-${role})"/><polyline points="${points}" class="trend-line"/><line x1="${selectX}" x2="${selectX}" y1="${top}" y2="${top+plotH}" class="selected-line"/>${labs}${dots}<circle cx="${selectX}" cy="${selectY}" r="4.3" fill="#ffffff"/></svg>`;
    const value=values[index];
    $(role==='sdr'?'sdr-trend-detail':'designer-trend-detail').innerHTML=`<b>${h(niceDate(selectedDate))}</b><span>${isHours?fmtHours(value):value+' '+(value===1?'appointment':'appointments')}</span><small>${isHours?'Paid hours logged that day':'Appointments set that day'}</small>`;
    $(role==='sdr'?'seven-total':'designer-seven-total').textContent=isHours?fmtHours(total)+' total':sumLabel(total);
    $(chartId).setAttribute('aria-label',dates.map((d,i)=>`${d}: ${values[i]}${isHours?' hours':' appointments'}`).join('; '));
  }
  function renderDashboard() {
    $('stat-today').textContent=count('today');$('stat-week').textContent=count('week');$('stat-month').textContent=count('month');$('stat-total').textContent=count('all');
    $('date-today').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    const appts=new Map();for(const x of live())appts.set(x.dateSet,(appts.get(x.dateSet)||0)+1);
    renderTrend('sdr', d=>appts.get(d)||0, n=>`${n} appointments`);
    const week = count('week'), goal = state.goal;
    $('goal-progress').textContent=week;$('goal-target').textContent=`/ ${goal} appointments`;$('goal-bar').style.width=`${Math.min(100,Math.round(week/goal*100))}%`;
    $('goal-message').textContent=week>=goal ? `Goal reached! ${week-goal} above target.` : `${goal-week} more to hit your weekly goal.`;
    const progress = Math.min(100, Math.round((week / Math.max(1, goal)) * 100));
    if ($('focus-ring')) {
      $('focus-ring').style.setProperty('--progress', progress);
      $('focus-ring').setAttribute('aria-valuenow', String(progress));
      $('focus-percent').textContent = progress + '%';
      $('focus-hero-summary').textContent = `${week} of ${goal} appointments this week`;
    }

    const bySource = SOURCES.map(src=>({name:src,count:live().filter(x=>x.source===src).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
    const unspec = live().filter(x=>!SOURCES.includes(x.source)).length;if(unspec)bySource.push({name:'Not specified',count:unspec});
    const max=Math.max(1,...bySource.map(x=>x.count));
    $('source-breakdown').innerHTML=bySource.length ? bySource.map(x=>`<div class="source-row"><div><span>${h(x.name)}</span><b>${x.count}</b></div><div class="source-track"><span style="width:${(x.count/max*100).toFixed(2)}%"></span></div></div>`).join('') : '<div class="quiet-empty">Your lead-source breakdown appears here as you log appointments.</div>';
    $('teaser-wins').textContent=linkedSales().length; $('teaser-commission').textContent=money(linkedSales().reduce((s,w)=>s+(w.amount||0),0)*state.commissionRate/100);
    const recent=[...live()].sort((a,b)=>b.dateSet.localeCompare(a.dateSet)||b.createdAt.localeCompare(a.createdAt)).slice(0,5);
    $('recent-appointments').innerHTML=recent.length ? recent.map(x=>`<button class="recent-item" data-edit="${h(x.id)}"><span class="recent-avatar">${x.meetingType==='In person'?'↗':'◫'}</span><span class="recent-copy"><b>${h(x.label||x.projectType||'Appointment set')}</b><small>${h(niceDate(x.dateSet))} · ${h(x.meetingType)}</small></span><span class="recent-chevron">›</span></button>`).join('') : '<div class="quiet-empty">No appointments recorded yet. Start with your first one!</div>';
  }
  function renderAppointments() {
    const records=live(), sr=safe($('entry-search').value).toLowerCase(), r=$('entry-range').value, type=$('entry-type').value;
    const filtered=records.filter(x=>selected(r,x.dateSet)&&(type==='all'||x.meetingType===type)&&[x.label,x.projectType,x.source,x.notes].join(' ').toLowerCase().includes(sr))
      .sort((a,b)=>b.dateSet.localeCompare(a.dateSet)||b.createdAt.localeCompare(a.createdAt));
    $('nav-count').textContent=records.length;$('list-all').textContent=records.length;$('list-phone').textContent=records.filter(x=>x.meetingType==='Phone / video').length;$('list-inperson').textContent=records.filter(x=>x.meetingType==='In person').length;
    $('entries-count').textContent=`${filtered.length} ${filtered.length===1?'entry':'entries'}${filtered.length!==records.length?' shown':''}`;
    $('entries-body').innerHTML=filtered.map(x=>`<tr data-edit="${h(x.id)}" tabindex="0"><td>${h(niceDate(x.dateSet))}</td><td><b>${h(x.label||x.projectType||'Appointment set')}</b><small>${h(x.projectType||'Project not specified')}</small></td><td><span class="type-pill">${h(x.meetingType)}</span></td><td>${h(x.source||'—')}</td><td class="chevron">›</td></tr>`).join('');
    $('entries-empty').classList.toggle('hidden',filtered.length>0);
    if(!filtered.length && records.length) {$('entries-empty').querySelector('h3').textContent='Nothing matches';$('entries-empty').querySelector('p').textContent='Try another search or filter.';}else{$('entries-empty').querySelector('h3').textContent='No appointments yet';$('entries-empty').querySelector('p').textContent='Click “Log appointment” after you book one at work.';}
  }
  function renderSyncUi(){
    const connected=!!(cloud.url && cloud.key); const loggedIn=connected && !!session?.access_token;
    $('cloud-status').textContent=loggedIn?(syncBusy?'Syncing…':lastSync?'Synced':'Connected'):connected?'Not signed in':'Not connected';
    $('signed-in').classList.toggle('hidden',!loggedIn);$('login-form').classList.toggle('hidden',loggedIn);
    $('signed-email').textContent=session?.email||'your account';
    $('cloud-url').value=cloud.url||'';$('cloud-key').value=cloud.key||'';
    $('sidebar-sync-label').textContent=loggedIn?syncBusy?'Syncing…':pendingSync?'Saved locally · pending cloud':lastSync?'Cloud synced':'Cloud sync ready':'Saved on this device';
    $('sidebar-sync-light').classList.toggle('is-cloud',loggedIn);
    $('sync-chip').textContent=loggedIn?syncBusy?'◌ Syncing…':pendingSync?'● Pending sync':lastSync?'● Cloud synced':'● Cloud enabled':'● Offline-ready';
    updateV54SyncMessage();
    $('weekly-goal').value=state.goal;
    $('sdr-commission-rate').value=state.commissionRate;
    $('appearance-theme').value=state.appearance.theme;
    document.querySelectorAll('[data-accent]').forEach(btn=>{const active=btn.dataset.accent===state.appearance.accent;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});
    if(document.activeElement?.id!=='designer-rate') $('designer-rate').value=state.designerPrefs.rate ?? '';
    if(document.activeElement?.id!=='designer-threshold') $('designer-threshold').value=state.designerPrefs.threshold;
    if(document.activeElement?.id!=='designer-multiplier') $('designer-multiplier').value=state.designerPrefs.multiplier;
  }
  function render() {renderDashboard();renderAppointments();renderDesigner();renderHours();renderSales();renderSyncUi();renderV5();}
  function newEntry(id) {
    const old=id ? state.records.find(x=>x.id===id&&!x.deleted) : null;
    const form=$('appointment-form');form.reset();form.elements.id.value=old?.id||'';
    for(const key of ['dateSet','meetingType','projectType','source','label','notes']){form.elements[key].value=old?.[key]??(key==='dateSet'?today():key==='meetingType'?TYPES[0]:'');}
    $('dialog-title').textContent=old?'Edit appointment':'Log appointment';$('delete-entry').classList.toggle('hidden',!old);
    $('appointment-dialog').showModal();
  }
  function saveEntry(e) {
    e.preventDefault();const form=$('appointment-form');if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form).entries());const old=state.records.find(x=>x.id===data.id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.dateSet)||!TYPES.includes(data.meetingType)){toast('Check the date and meeting type');return;}
    const ent=normalized({...old,...data,id:old?.id||makeUUID(),createdAt:old?.createdAt||iso(),updatedAt:iso(),deleted:false});
    patchEntry(ent);$('appointment-dialog').close();toast(old?'Appointment updated':'Appointment added (+1)');
  }
  function deleteEntry() {
    const id=$('appointment-form').elements.id.value;const old=state.records.find(x=>x.id===id);if(!old)return;
    if(!confirm('Delete this appointment? It will also disappear from your cloud account when synced.'))return;
    patchEntry({...old,deleted:true,updatedAt:iso()});$('appointment-dialog').close();toast('Appointment deleted');
  }
  // Current Mountain date is the default for relative words (today, tomorrow, Monday).
  // Manual selection remains available for notes written on a different day.
  function formatterToday(){return window.LeadFormatter.utahToday();}
  function resetFormatter(){
    $('raw-input').value='';$('format-output').value='';
    $('formatter-note-date').value=formatterToday();$('formatter-note-date').dataset.userEdited='';
    $('formatter-meeting-type').value='Not specified';
    $('formatter-customer-zone').value='auto';
    $('formatter-period').value='';
    $('formatter-routing-mode').value='auto';
    $('formatter-routing-designer').value='';
    $('formatter-routing-reason').value='';
    $('formatter-confirmed-free').checked=false;
    document.querySelector('.routing-options').open=false;
    $('format-insights').textContent='Format a lead to see extracted details and routing checks.';
    $('format-check').className='validation-card validation-wait';
    $('format-check').textContent='✦ Format a lead to see whether its card is ready.';
  }
  function parseRaw(raw){if(!$('formatter-note-date').dataset.userEdited)$('formatter-note-date').value=formatterToday();return window.LeadFormatter.format(v5ApplyRules(raw),{notesDate:$('formatter-note-date').value,meetingType:$('formatter-meeting-type').value,timePeriod:$('formatter-period').value,routingMode:$('formatter-routing-mode').value,routingDesigner:$('formatter-routing-designer').value,routingReason:$('formatter-routing-reason').value,confirmedFree:$('formatter-confirmed-free').checked,customerZone:$('formatter-customer-zone').value});}
  function showCardStatus(report){
    const status=$('format-check');
    status.className='validation-card '+(report.ready?'validation-ready':'validation-blocked');
    status.innerHTML=report.ready?(report.warnings?.length?'<strong>✓ Ready to copy · '+report.warnings.length+' concern(s) to review.</strong><ul>'+report.warnings.slice(0,5).map(s=>'<li>'+h(s)+'</li>').join('')+'</ul>':'<strong>✓ Required card structure passed checks.</strong>Review the source notes and appointment time before posting.'):'<strong>⚠ Missing essential schedule or card details · '+report.errors.length+' required correction(s)</strong><ul>'+report.errors.slice(0,7).map(s=>'<li>'+h(s)+'</li>').join('')+'</ul>';
  }
  function smartFormat(){
    const result=parseRaw($('raw-input').value);
    if(!result.text){toast('Paste some lead details first');return;}
    $('format-output').value=result.text;
    const details=Object.entries(result.fields).filter(([key,val])=>key!=='uncertain'&&val).map(([key,val])=>`<span class="insight-pill"><b>${h(key.replace(/([A-Z])/g,' $1'))}</b>${h(String(val))}</span>`).join('');
    const items=[...result.warnings,...result.questions];
    const questions=items.length?`<h4 class="insight-section-title">Review these details</h4><ul>${items.slice(0,10).map(s=>`<li>${h(s)}</li>`).join('')}</ul>`:'';
    const zoneSummary=result.timezoneInfo?.customer&&result.timezoneInfo?.utah?
      `<div class="zone-summary"><b>Customer: ${h(result.timezoneInfo.customer.date)} · ${h(result.timezoneInfo.customer.time)} ${h(result.timezoneInfo.customer.abbr)}</b><span>Utah: ${h(result.timezoneInfo.utah.date)} · ${h(result.timezoneInfo.utah.time)} ${h(result.timezoneInfo.utah.abbr)}</span><small>The company card uses Utah time; customer time is shown here for your reference only.</small></div>` :
      `<div class="zone-summary"><b>Customer time zone needs confirmation.</b><span>Provide the customer's state/city or choose a zone before copying a card.</span></div>`;
    $('format-insights').innerHTML=`<div class="insight-count">${result.detected.length} facts extracted · ${result.errors.length} required fixes · ${items.length} notes</div><div class="insight-tags">${details||'<span class="small-muted">No recognizable structured details</span>'}</div>${zoneSummary}${questions}<p class="help">The company guide still requires full names and emails for dependable booking and notifications; Leadline lists missing ones as concerns, not copy blockers. Review all concerns before posting. Check the NAME reply in your company's chat after posting.</p>`;
    showCardStatus(result);
    toast(result.ready?'Card generated — review before posting':'Card generated — required fields need attention');
  }
  function validateFormat(){
    if(!safe($('format-output').value)){toast('Format a lead first');return {ready:false,errors:[],warnings:[]};}
    const result=window.LeadFormatter.validateCard($('format-output').value);
    showCardStatus(result);
    const summary=$('format-insights').querySelector('.insight-count');if(summary)summary.textContent=summary.textContent.replace(/\d+ required fixes/,result.errors.length+' required fixes');
    if(result.warnings.length){$('format-insights').insertAdjacentHTML('beforeend',`<p class="help"><b>Latest validation notes:</b> ${result.warnings.map(h).join(' · ')}</p>`);}
    toast(result.ready?'Card passes required structure checks':'Fix the marked fields before copying');
    return result;
  }
  async function copyResult(){
    const t=$('format-output').value;if(!safe(t)){toast('Format something first');return;}
    const test=validateFormat();if(!test.ready){$('format-output').focus();return;}
    try{await navigator.clipboard.writeText(t);toast('Card copied — check posted NAME reply');}
    catch{$('format-output').focus();$('format-output').select();toast('Select text and use Copy');}
  }
  function exportText(filename, text, mime) {
    const blob=new Blob([text],{type:mime}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function exportJSON() {exportText(`leadline-full-backup-${today()}.json`,JSON.stringify({app:'Leadline',version:5,exportedAt:iso(),...state},null,2),'application/json');toast('All workspaces backed up');}
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
  function exportCSV(){const headers=['dateSet','meetingType','projectType','source','label','notes','id','createdAt','updatedAt'];const rows=live().map(x=>headers.map(k=>csvCell(x[k])).join(','));exportText(`leadline-appointments-${today()}.csv`,'\uFEFF'+[headers.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');toast('CSV downloaded');}
  function csvRows(text){const result=[];let row=[],word='',quote=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){word+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(word);word='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(word);if(row.some(x=>x.trim()))result.push(row);row=[];word='';}else word+=c;}row.push(word);if(row.some(x=>x.trim()))result.push(row);return result;}
  async function importBackup(file){
    if(!file)return;
    if(file.size>8*1024*1024){alert('File is too large (8 MB max).');return;}
    try {
      const text=await file.text();let records=[], restoredGoal=null, restoredHours=[], restoredPrefs=null,restoredSales=[],restoredRate=null,restoredAppearance=null,restoredV5=null,isNewBackup=false;
      if(file.name.toLowerCase().endsWith('.json')) {
        const parsed=JSON.parse(text);if(Array.isArray(parsed.records)){records=parsed.records.map(normalized);restoredGoal=parsed.goal;restoredHours=Array.isArray(parsed.hours)?parsed.hours.map(normalizedHour).filter(x=>x.deleted||(validDt(x.startedAt)&&validDt(x.endedAt)&&Date.parse(x.endedAt)>Date.parse(x.startedAt))):[];restoredPrefs=parsed.designerPrefs||null;restoredSales=Array.isArray(parsed.sales)?parsed.sales.map(normalizedSale):[];restoredRate=parsed.commissionRate??null;restoredAppearance=parsed.appearance||null;restoredV5=parsed.v5||null;isNewBackup=true;}
        else if(Array.isArray(parsed.leads)){
          const relevant=parsed.leads.filter(x=>x.appointmentSet||x.appointmentDate||['Appointment Scheduled','Sold'].includes(x.status));
          records=relevant.map(x=>normalized({id:makeUUID(),dateSet:/^\d{4}-\d{2}-\d{2}/.test(x.createdAt||'')?x.createdAt.slice(0,10):today(),meetingType:'Phone / video',projectType:x.projectType,source:x.source,label:x.name||x.size,notes:x.notes}));
          if(relevant.length)alert('Older Leadline file detected. These are imported as appointment records using lead creation dates where available. Review each entry afterward.');
        }else throw Error('Not a supported Leadline backup.');
      }else{
        const rows=csvRows(text);if(rows.length<2)throw Error('CSV needs a header and a data row.');const keys=rows.shift().map(x=>x.trim().toLowerCase().replace(/[^a-z]/g,''));
        const cell=(r,...names)=>{const i=keys.findIndex(k=>names.includes(k));return i>=0?safe(r[i]):'';};
        records=rows.map(r=>normalized({id:makeUUID(),dateSet:cell(r,'dateset','date','bookeddate')||today(),meetingType:cell(r,'meetingtype','meeting')||'Phone / video',projectType:cell(r,'projecttype','project'),source:cell(r,'source','leadsource'),label:cell(r,'label','name','projectlabel'),notes:cell(r,'notes')}));
      }
      if(!records.length&&!restoredHours.length&&!restoredSales.length&&!restoredV5?.payments?.length&&!restoredV5?.rules?.length)throw Error('No records to import.');
      if(!confirm(`Import ${records.filter(x=>!x.deleted).length} appointments and ${restoredHours.filter(x=>!x.deleted).length} time entries and ${restoredSales.length} sales wins? Existing matching IDs are updated when the imported copy is newer.`))return;
      for(const entry of records){const i=state.records.findIndex(x=>x.id===entry.id);if(i<0)state.records.push(entry);else if(entry.updatedAt>state.records[i].updatedAt)state.records[i]=entry;}
      for(const entry of restoredSales){const i=state.sales.findIndex(x=>x.id===entry.id);if(i<0)state.sales.push(entry);else if(entry.updatedAt>state.sales[i].updatedAt)state.sales[i]=entry;}
      for(const entry of restoredHours){const i=state.hours.findIndex(x=>x.id===entry.id);if(i<0)state.hours.push(entry);else if(entry.updatedAt>state.hours[i].updatedAt)state.hours[i]=entry;}
      if(isNewBackup && confirm('Restore goals and designer pay settings from this backup too?')){if(restoredGoal>=1&&restoredGoal<=1000){state.goal=Math.floor(restoredGoal);state.goalUpdatedAt=iso();}if(restoredPrefs){state.designerPrefs={...state.designerPrefs,...restoredPrefs};state.prefsUpdatedAt=iso();}if(restoredRate!==null)state.commissionRate=Math.max(0,Math.min(100,Number(restoredRate)||0));if(restoredAppearance){state.appearance={theme:['dark','light'].includes(restoredAppearance.theme)?restoredAppearance.theme:'dark',accent:ACCENTS.includes(restoredAppearance.accent)?restoredAppearance.accent:'purple'};applyAppearance();}if(restoredV5){const imported=v5Sanitize(restoredV5);state.v5.designerGoal=imported.designerGoal;for(const item of imported.payments){if(!state.v5.payments.some(x=>x.id===item.id))state.v5.payments.push(item);}for(const rule of imported.rules){if(!state.v5.rules.some(x=>x.id===rule.id))state.v5.rules.push(rule);}}state.prefsUpdatedAt=iso();}
      persist();render();scheduleSync();toast('Import complete');
    }catch(err){alert('Could not import: '+err.message);}finally{$('import-file').value='';}
  }
  function validConfig(url,key){
    try {const u=new URL(url);if(u.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/i.test(u.hostname)||u.pathname!=='/') throw 0; }catch{throw Error('Use the https://xxxxx.supabase.co project URL.');}
    if(key.startsWith('sb_secret_')||key.startsWith('sbp_'))throw Error('Never use a Supabase secret or service_role key in a browser app.');
    if(key.startsWith('eyJ')){try {const data=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(data.role!=='anon')throw 0;}catch{throw Error('This does not appear to be an anon key. Use your publishable key.');}}
    else if(!key.startsWith('sb_publishable_')) throw Error('Use a publishable (sb_publishable_...) or legacy anon key.');
  }
  function changeStatus(msg,level='') { $('sync-message').textContent=msg;$('sync-message').dataset.level=level; }
  async function api(url, opts={}){
    if(!navigator.onLine)throw Error('You are offline. Changes will sync later.');
    const response=await fetch(cloud.url.replace(/\/+$/,'')+url, { ...opts, headers:{'apikey':cloud.key,'Content-Type':'application/json',...(session?.access_token?{'Authorization':`Bearer ${session.access_token}`} : {}),...(opts.headers||{})} });
    let data=null; const raw=await response.text();if(raw){try{data=JSON.parse(raw);}catch{data=raw;}}
    if(!response.ok)throw Error(safe(data?.msg||data?.message||data?.error_description||data?.error||raw).slice(0,400)||`Request failed (${response.status})`);
    return data;
  }
  function setAuth(info){
    if(!info?.access_token||!info?.refresh_token||!info?.user?.id)throw Error('No active session returned. Check your email if confirmation is required.');
    session={access_token:info.access_token,refresh_token:info.refresh_token,user_id:info.user.id,email:info.user.email||'',expiresAt:Date.now()+((info.expires_in||3600)*1000)-60000};saveSession();lastSync=null;renderSyncUi();
  }
  async function authAction(kind){
    if(!cloud.url||!cloud.key){toast('Save the cloud project settings first');return;}
    const email=safe($('auth-email').value), password=$('auth-password').value;
    if(!email||password.length<6){toast('Enter your email and password (6+ characters)');return;}
    changeStatus(kind==='sign-up'?'Creating account…':'Signing in…');
    try{
      const endpoint=kind==='sign-up'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
      const result=await api(endpoint,{method:'POST',body:JSON.stringify({email,password})});
      if(!result.access_token){changeStatus('Check your email for confirmation, then sign in.');toast('Check your email');return;}
      setAuth(result);$('auth-password').value='';changeStatus('Signed in. Syncing your appointments…');await sync();
    }catch(e){changeStatus('Sign-in error: '+e.message,'error');}
  }
  async function refreshSession(){
    if(!session?.refresh_token)return false;
    if(session.expiresAt && Date.now()<session.expiresAt-20000)return true;
    try {const fresh=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});setAuth(fresh);return true;}
    catch(e){changeStatus('Session expired. Please sign in again. '+e.message,'error');session=null;saveSession();renderSyncUi();return false;}
  }
  async function getRemote(table){
    const all=[];const pageSize=500;
    for(let start=0;start<20000;start+=pageSize){
      const rows=await api(`/rest/v1/${table}?select=id,payload,updated_at,deleted&user_id=eq.${encodeURIComponent(session.user_id)}&order=id.asc&limit=${pageSize}&offset=${start}`);
      if(!Array.isArray(rows))throw Error('Unexpected database response');all.push(...rows);if(rows.length<pageSize)return all;
    }
    throw Error('Too many records for this sync version. Export a backup and contact support.');
  }
  async function pushRemote(table,rows){
    const payload=rows.map(x=>({id:x.id,user_id:session.user_id,updated_at:x.updatedAt,payload:x,deleted:!!x.deleted}));
    for(let i=0;i<payload.length;i+=100)await api(`/rest/v1/${table}?on_conflict=id`, {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload.slice(i,i+100))});
  }
  async function syncCollection(table, localRecords, clean){
    const remote=await getRemote(table), remoteMap=new Map(remote.map(r=>[r.id,r]));
    const push=[];
    for(const entry of localRecords){const r=remoteMap.get(entry.id);if(!r||Date.parse(entry.updatedAt)>Date.parse(r.updated_at))push.push(entry);}
    if(push.length)await pushRemote(table,push);
    for(const r of remote){const existing=localRecords.find(x=>x.id===r.id);const incoming=clean({...r.payload,id:r.id,updatedAt:r.updated_at,deleted:r.deleted});
      if(!existing)localRecords.push(incoming);else if(Date.parse(r.updated_at)>Date.parse(existing.updatedAt))localRecords[localRecords.indexOf(existing)]=incoming;
    }
  }
  async function syncPrefs(){
    const remote=await api(`/rest/v1/leadline_preferences?select=payload,updated_at&user_id=eq.${encodeURIComponent(session.user_id)}&limit=1`);
    const r=remote?.[0]; const localTime=Date.parse(state.prefsUpdatedAt)||0;
    if(!r||localTime>Date.parse(r.updated_at)){
      await api('/rest/v1/leadline_preferences?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{user_id:session.user_id,payload:{designerPrefs:state.designerPrefs,goal:state.goal,commissionRate:state.commissionRate,appearance:state.appearance,v5:state.v5},updated_at:state.prefsUpdatedAt}])});
    } else if(Date.parse(r.updated_at)>localTime){
      const prefs=r.payload||{};
      const rate=prefs.designerPrefs?.rate;const th=Number(prefs.designerPrefs?.threshold);const mul=Number(prefs.designerPrefs?.multiplier);
      state.designerPrefs={rate:(rate===null||rate===''||!Number.isFinite(Number(rate)))?null:Math.max(0,Number(rate)),threshold:th>=1&&th<=168?th:40,multiplier:mul>=1&&mul<=5?mul:1.5};
      if(Number.isFinite(Number(prefs.goal))&&Number(prefs.goal)>=1&&Number(prefs.goal)<=1000)state.goal=Math.floor(Number(prefs.goal));
      state.commissionRate=Math.max(0,Math.min(100,Number(prefs.commissionRate??state.commissionRate)||0));
      if(prefs.appearance){state.appearance={theme:['dark','light'].includes(prefs.appearance.theme)?prefs.appearance.theme:'dark',accent:ACCENTS.includes(prefs.appearance.accent)?prefs.appearance.accent:'purple'};applyAppearance();}
      if(prefs.v5)state.v5=v5Sanitize(prefs.v5);
      state.prefsUpdatedAt=r.updated_at;
    }
  }
  async function sync(){
    if(demoMode)return;
    if(!session?.access_token||!cloud.url||!cloud.key)return;
    if(syncBusy){queuedSync=true;return;}
    syncBusy=true;const syncRevision=localRevision;renderSyncUi();
    try {
      if(!await refreshSession())return;
      await syncCollection('leadline_appointments',state.records,normalized);
      await syncCollection('leadline_hours',state.hours,normalizedHour);
      let salesSyncWarning='';
      const previousWinIds=new Set(liveSales().map(x=>x.id));
      const shouldNotifyFromCloud=lastSync!==null;
      try{await syncCollection('leadline_sales',state.sales,normalizedSale);salesCloudReady=true;
        if(shouldNotifyFromCloud && liveSales().some(x=>!previousWinIds.has(x.id)&&!x.appointmentId))winAlert();
      }
      catch(e){salesCloudReady=false;salesSyncWarning=' Sales Wins not synced: run the V4.6 SQL upgrade.';}
      await syncPrefs();
      persist(true);
      if(!salesSyncWarning && syncRevision===localRevision){pendingSync=false;localStorage.removeItem(PENDING_KEY);}
      else if(syncRevision!==localRevision)queuedSync=true;
      lastSync=new Date();changeStatus(`Synced appointments and hours at ${lastSync.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.${salesSyncWarning||' Sales Wins synced too.'}`,salesSyncWarning?'error':'ok');render();
    }catch(e){changeStatus('Sync not completed: '+e.message,'error');$('cloud-status').textContent='Needs sync';$('sync-chip').textContent='● Saved locally';pendingSync=true;try{localStorage.setItem(PENDING_KEY,'yes');}catch{}}
    finally{syncBusy=false;renderSyncUi();if(queuedSync){queuedSync=false;setTimeout(sync,300);}}
  }
  function scheduleSync(){
    if(demoMode || !session?.access_token)return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{if(navigator.onLine)sync();else updateV54SyncMessage();},1000);
  }
  function autoSync(reason='resume'){
    if(demoMode||!cloud.url||!cloud.key||!session?.access_token||!navigator.onLine || document.visibilityState==='hidden')return;
    if(Date.now()-lastAutoSyncAttempt<12000 && !pendingSync)return;
    lastAutoSyncAttempt=Date.now();
    if(syncBusy){queuedSync=true;return;}
    changeStatus(reason==='online'?'Connected again · syncing offline changes…':'Checking for new cloud changes…');
    void sync();
  }
  function bindAutoSync(){
    window.addEventListener('online',()=>autoSync('online'));
    window.addEventListener('offline',()=>{renderSyncUi();changeStatus('Offline · saved changes will sync when connected');});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoSync('resume');});
    window.addEventListener('pageshow',()=>autoSync('resume'));
    window.addEventListener('focus',()=>autoSync('resume'));
    setInterval(()=>{if(!document.hidden)autoSync('periodic');},120000);
  }
  async function signOut(){
    if(!confirm('Sign out of cloud sync? Appointments remain on this device until you clear them.'))return;
    session=null;saveSession();lastSync=null;renderSyncUi();changeStatus('Signed out. Data remains saved on this device.');
  }
  function clearLocal(){
    if(!confirm('Clear appointments, sales wins, hours, and the active timer from THIS device? This does not delete cloud records. Download a backup first.'))return;
    state.records=[];state.hours=[];state.sales=[];timerState=null;localStorage.removeItem(TIMER_KEY);persist();render();tickTimer();toast('Local data cleared.');
  }
  function setCloudConfig(e){
    e.preventDefault();let url=safe($('cloud-url').value).replace(/\/+$/,''), key=safe($('cloud-key').value);
    try {validConfig(url,key);}catch(err){changeStatus(err.message,'error');return;}
    if((cloud.url!==url||cloud.key!==key)&&session){session=null;saveSession();lastSync=null;}
    cloud={url,key};saveCloud();renderSyncUi();changeStatus('Connection saved. Now sign in or create an account.');toast('Cloud settings saved');
  }
  function registerPWA(){
    if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-info').textContent='Ready to install with a real home-screen icon. Click “Install app.”';});
    window.addEventListener('appinstalled',()=>{$('install-info').textContent='Leadline was installed! Find its icon in your apps.';installPrompt=null;});
  }
  // Project Designer: time tracking is local-first, completed time entries cloud-sync.
  const fmtHours = value => `${(Number(value)||0).toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits: value>=10?1:0})}h`;
  const money = value => value == null ? '—' : new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
  const fmtClock = ms => {const secs=Math.max(0,Math.floor(ms/1000));return [Math.floor(secs/3600),Math.floor(secs%3600/60),secs%60].map(x=>String(x).padStart(2,'0')).join(':');};
  const fmtLocalInput = date => `${localYMD(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const fmtTime = isoString => new Date(isoString).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const dateOf = ms => localYMD(new Date(ms));
  function weekFor(day){const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()-(d.getDay()+6)%7);return localYMD(d);}
  function paidHours(entry){return Math.max(0,(Date.parse(entry.endedAt)-Date.parse(entry.startedAt))/3600000-entry.breakMinutes/60);}
  function segmentsFor(entry){
    const start=Date.parse(entry.startedAt),end=Date.parse(entry.endedAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
    const segments=[];let pos=start;
    while(pos<end){const d=new Date(pos);const next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();const stop=Math.min(next,end);segments.push({start:pos,day:dateOf(pos),ms:stop-pos});pos=stop;}
    let breaks=(Number(entry.breakMinutes)||0)*60000;
    // A manually entered break has a duration, not a position in the shift.
    // For entries that span midnight, allocate it to the end for day/week estimates.
    for(let i=segments.length-1;i>=0&&breaks>0;i--){const cut=Math.min(breaks,segments[i].ms);segments[i].ms-=cut;breaks-=cut;}
    return segments.filter(x=>x.ms>0);
  }
  function designerNumbers(){
    const entries=liveHours();const segments=entries.flatMap(segmentsFor).sort((a,b)=>a.start-b.start);
    const days=new Map(),weeks=new Map(),projects=new Map();let totalMs=0,monthMs=0,monthOt=0,monthPay=0;
    const rate=state.designerPrefs.rate;const thresholdMs=Number(state.designerPrefs.threshold)*3600000;const mult=Number(state.designerPrefs.multiplier);
    const wk=weekFor(today()),month=thisMonth();
    for(const segment of segments){
      const {day,ms}=segment;const key=weekFor(day);const existing=weeks.get(key)||{ms:0,ot:0,pay:0};
      const regular=Math.max(0,Math.min(ms,thresholdMs-existing.ms));const overtime=ms-regular;
      existing.ms+=ms;existing.ot+=overtime;existing.pay+=rate==null?0:(regular+overtime*mult)/3600000*Number(rate);weeks.set(key,existing);
      days.set(day,(days.get(day)||0)+ms);totalMs+=ms;
      if(day.startsWith(month)){monthMs+=ms;monthOt+=overtime;if(rate!=null)monthPay+=(regular+overtime*mult)/3600000*Number(rate);}
    }
    for(const entry of entries){const ms=segmentsFor(entry).filter(s=>s.day.startsWith(month)).reduce((n,s)=>n+s.ms,0);if(ms)projects.set(entry.project||'Unlabeled project',(projects.get(entry.project||'Unlabeled project')||0)+ms);}
    return {entries,days,weeks,projects,totalMs,monthMs,monthOt,monthPay,week:weeks.get(wk)||{ms:0,ot:0,pay:0},rate};
  }
  function renderDesigner(){
    const n=designerNumbers();const todayMs=n.days.get(today())||0;const threshold=Number(state.designerPrefs.threshold);
    $('hours-today').textContent=fmtHours(todayMs/3600000);
    $('hours-week').textContent=fmtHours(n.week.ms/3600000);
    $('hours-overtime').textContent=fmtHours(n.week.ot/3600000);
    $('ot-threshold-caption').textContent=`After ${threshold}h / week (estimate)`;
    $('hours-estimated-pay').textContent=n.rate==null?'—':money(n.week.pay);
    $('hours-month').textContent=fmtHours(n.monthMs/3600000);
    $('ot-month').textContent=fmtHours(n.monthOt/3600000);
    $('pay-month').textContent=n.rate==null?'Set rate in settings':money(n.monthPay);
    $('designer-date').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    renderTrend('designer',day=>(n.days.get(day)||0)/3600000);
    const top=[...n.projects.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);const projectMax=Math.max(1,...top.map(x=>x[1]));
    $('designer-project-breakdown').innerHTML=top.length?top.map(([project,ms])=>`<div class="source-row"><div><span>${h(project)}</span><b>${fmtHours(ms/3600000)}</b></div><div class="source-track"><span style="width:${ms/projectMax*100}%"></span></div></div>`).join(''):'<div class="quiet-empty">Your hours by project will appear here.</div>';
    const recent=[...n.entries].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,5);
    $('designer-recent').innerHTML=recent.length?recent.map(x=>`<button class="recent-item" data-hours-edit="${h(x.id)}"><span class="recent-avatar">◷</span><span class="recent-copy"><b>${h(x.project||'Work session')}</b><small>${h(niceDate(dateOf(Date.parse(x.startedAt))))} · ${h(x.task)}</small></span><span class="recent-hours">${fmtHours(paidHours(x))}</span></button>`).join(''):'<div class="quiet-empty">Your latest completed sessions will appear here.</div>';
    $('hours-nav-count').textContent=n.entries.length;
  }
  function renderHours(){
    const all=liveHours();const query=safe($('hours-search').value).toLowerCase();const range=$('hours-range').value;
    const shown=all.filter(x=>selected(range,dateOf(Date.parse(x.startedAt)))&&[x.project,x.task,x.notes].join(' ').toLowerCase().includes(query)).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    $('hours-list-count').textContent=all.length;$('hours-list-all').textContent=fmtHours(all.reduce((t,x)=>t+paidHours(x),0));
    $('hours-list-week').textContent=fmtHours(designerNumbers().week.ms/3600000);
    $('hours-count-caption').textContent=`${shown.length} ${shown.length===1?'entry':'entries'}${shown.length!==all.length?' shown':''}`;
    $('hours-body').innerHTML=shown.map(x=>`<tr data-hours-edit="${h(x.id)}" tabindex="0"><td>${h(niceDate(dateOf(Date.parse(x.startedAt))))}</td><td><b>${h(x.project||'Untitled project')}</b><small>${h(x.task)}</small></td><td>${h(fmtTime(x.startedAt))} – ${h(fmtTime(x.endedAt))}</td><td>${x.breakMinutes}m</td><td><span class="type-pill">${fmtHours(paidHours(x))}</span></td><td class="chevron">›</td></tr>`).join('');
    $('hours-empty').classList.toggle('hidden',shown.length>0);
    const empty=$('hours-empty');empty.querySelector('h3').textContent=all.length?'No matching time entries':'No time entries yet';empty.querySelector('p').textContent=all.length?'Try another filter or search.':'Use Start timer or add work manually.';
  }
  function newHourEntry(id){
    const old=id?state.hours.find(x=>x.id===id&&!x.deleted):null;
    const form=$('hours-form');form.reset();form.elements.id.value=old?.id||'';
    const end=new Date(),start=new Date(end.getTime()-3600000);
    form.elements.project.value=old?.project||'';
    form.elements.task.value=old?.task||'3D modeling';
    form.elements.startedAt.value=old?fmtLocalInput(new Date(old.startedAt)):fmtLocalInput(start);
    form.elements.endedAt.value=old?fmtLocalInput(new Date(old.endedAt)):fmtLocalInput(end);
    form.elements.breakMinutes.value=old?.breakMinutes??0;
    form.elements.notes.value=old?.notes||'';
    $('hours-dialog-title').textContent=old?'Edit time entry':'Add work hours';$('hours-delete').classList.toggle('hidden',!old);
    updateHourPreview();$('hours-dialog').showModal();
  }
  function updateHourPreview(){
    const form=$('hours-form'),start=Date.parse(form.elements.startedAt.value),end=Date.parse(form.elements.endedAt.value),breakMin=Number(form.elements.breakMinutes.value);
    let msg='Enter valid times to calculate paid hours.';
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&breakMin>=0){
      const duration=(end-start)/60000;
      msg=duration>36*60?'One session cannot exceed 36 hours.':breakMin>=duration?'Unpaid break must be shorter than the session.':`Paid time: ${fmtHours((duration-breakMin)/60)} • Total elapsed: ${fmtHours(duration/60)}`;
    }
    $('hours-form-summary').textContent=msg;
  }
  function overlapsOther(id,start,end){return liveHours().some(x=>x.id!==id && start<Date.parse(x.endedAt)&&end>Date.parse(x.startedAt));}
  function saveHourEntry(e){
    e.preventDefault();const f=$('hours-form');if(!f.reportValidity())return;
    const data=Object.fromEntries(new FormData(f).entries());const start=Date.parse(data.startedAt),end=Date.parse(data.endedAt),br=Number(data.breakMinutes);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>36*3600000||br<0||!Number.isInteger(br)||br*60000>=end-start){toast('Check the time range and break length');return;}
    if(overlapsOther(data.id,start,end)){toast('This session overlaps another saved entry');return;}
    const old=state.hours.find(x=>x.id===data.id);
    const ent=normalizedHour({...old,id:old?.id||makeUUID(),project:data.project,task:data.task,startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString(),breakMinutes:br,notes:data.notes,createdAt:old?.createdAt||iso(),updatedAt:iso(),deleted:false});
    patchHour(ent);$('hours-dialog').close();toast(old?'Time entry updated':'Work hours saved');
  }
  function patchHour(entry){const index=state.hours.findIndex(x=>x.id===entry.id);if(index<0)state.hours.push(entry);else state.hours[index]=entry;if(persist()){render();scheduleSync();}}
  function deleteHourEntry(){const id=$('hours-form').elements.id.value;const old=state.hours.find(x=>x.id===id);if(!old||!confirm('Delete this work session? This will also sync the deletion.'))return;patchHour({...old,deleted:true,updatedAt:iso()});$('hours-dialog').close();toast('Time entry deleted');}
  function saveDesignerPrefs(){
    const str=safe($('designer-rate').value);const rate=str===''?null:Number(str),threshold=Number($('designer-threshold').value),multiplier=Number($('designer-multiplier').value);
    if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>10000)){toast('Enter a valid hourly rate (or leave blank)');return;}
    if(!Number.isFinite(threshold)||threshold<1||threshold>168||!Number.isFinite(multiplier)||multiplier<1||multiplier>5){toast('Check the overtime threshold and multiplier');return;}
    state.designerPrefs={rate,threshold,multiplier};state.prefsUpdatedAt=iso();persist();render();scheduleSync();toast('Designer settings saved');
  }
  function exportHoursCSV(){
    const columns=['project','task','startedAt','endedAt','breakMinutes','paidHours','notes','id'];
    const rows=liveHours().map(x=>columns.map(col=>csvCell(col==='paidHours'?paidHours(x).toFixed(3):x[col])).join(','));
    exportText(`leadline-hours-${today()}.csv`,'\uFEFF'+[columns.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');toast('Timesheet exported');
  }
  function saveTimer(){if(demoMode)return;try{if(timerState)localStorage.setItem(TIMER_KEY,JSON.stringify(timerState));else localStorage.removeItem(TIMER_KEY);}catch{toast('Could not save timer on this device');}}
  function startTimer(){
    if(timerState)return;
    const project=safe($('timer-project').value),task=safe($('timer-task').value);
    if(!project){$('timer-project').focus();toast('Enter a project label before starting');return;}
    timerState={startAt:iso(),project,task,breakMs:0,pausedAt:null};saveTimer();lastTimerNoticeMinute=-1;tickTimer();refreshTimerNotice(true);toast('Clock started');
  }
  function togglePause(){
    if(!timerState)return;
    if(timerState.pausedAt){timerState.breakMs+=Math.max(0,Date.now()-Date.parse(timerState.pausedAt));timerState.pausedAt=null;toast('Back on the clock');}
    else{timerState.pausedAt=iso();toast('Break started');}
    saveTimer();tickTimer();refreshTimerNotice(true);
  }
  function stopTimer(){
    if(!timerState)return;
    const end=Date.now(),start=Date.parse(timerState.startAt);
    const pauseMs=timerState.breakMs+(timerState.pausedAt?Math.max(0,end-Date.parse(timerState.pausedAt)):0);
    const breakMinutes=Math.round(pauseMs/60000);const paidMin=(end-start)/60000-breakMinutes;
    if(end<=start||paidMin<1){toast('Timer needs at least one paid minute before saving');return;}
    if(end-start>36*3600000){toast('This session is over 36h. Add the hours manually.');return;}
    if(overlapsOther('',start,end)){toast('Timer overlaps a saved entry. Edit that entry first.');return;}
    const entry=normalizedHour({id:makeUUID(),project:timerState.project,task:timerState.task,startedAt:timerState.startAt,endedAt:new Date(end).toISOString(),breakMinutes,notes:'',createdAt:iso(),updatedAt:iso()});
    if(!confirm(`Save ${fmtHours(paidHours(entry))} to ${timerState.project}?`))return;
    timerState=null;saveTimer();closeTimerNotification();patchHour(entry);tickTimer();toast('Session saved to Project Designer');
  }
  function tickTimer(){
    const running=!!timerState,paused=!!timerState?.pausedAt;const start=running?Date.parse(timerState.startAt):0;
    const end=paused?Date.parse(timerState.pausedAt):Date.now();
    const elapsed=running?Math.max(0,end-start-Math.max(0,Number(timerState.breakMs)||0)):0;
    $('timer-display').textContent=fmtClock(elapsed);
    $('timer-status').textContent=!running?'READY TO TRACK':paused?'ON BREAK':'CLOCKED IN';
    $('timer-status-light').classList.toggle('active',running&&!paused);
    $('timer-status-light').classList.toggle('paused',paused);
    $('timer-since').textContent=running?`Started ${fmtTime(timerState.startAt)} · ${timerState.project}`:'Not clocked in';
    $('timer-start').classList.toggle('hidden',running);
    $('timer-pause').classList.toggle('hidden',!running);
    $('timer-stop').classList.toggle('hidden',!running);
    $('timer-pause').textContent=paused?'▶ Resume work':'Ⅱ Take break';
    $('timer-project').disabled=running;$('timer-task').disabled=running;
    if(running){$('timer-project').value=timerState.project;$('timer-task').value=timerState.task;}
    $('timer-break-label').textContent=running?'Active timer stays on this device; saved sessions sync':'Breaks are excluded from paid time';
    const ts=$('timer-shade-status');if(ts)ts.textContent=running?`${timerHuman(timerElapsedMs())} · ${paused?'On break':'Working'} · ${timerState.project}`:timerNotifications?'On · start timer to show a notification':'Off · enable in Settings to show elapsed time while clocked in.';
  }


  // Uploaded sales files stay local until the user deliberately saves parsed sale records.
  function updatePrefs(){state.prefsUpdatedAt=iso();applyAppearance();persist();render();scheduleSync();}
  function fileFeedback(text){const el=$('sales-file-feedback');if(el)el.textContent=text;}
  function csvRows(text){
    // RFC4180-style quoted fields and commas, including embedded newlines.
    const rows=[];let row=[],cell='',quoted=false;
    const str=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<str.length;i++){
      const c=str[i];
      if(c==='"'){if(quoted&&str[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===','&&!quoted){row.push(cell.trim());cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&str[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)throw Error('The CSV contains an unclosed quoted field.');
    row.push(cell.trim());if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function plainAmount(value){
    const raw=safe(value);if(!raw)return null;
    const stripped=raw.replace(/[$,\s]/g,'');
    if(/^\d+(?:\.\d+)?$/i.test(stripped))return Number(stripped);
    return window.LeadlineSales.amountFrom(raw);
  }
  function prepareSale(item){
    const raw=safe(item.sourceText||item.source_text||item.notes||item.message||'');
    const found=window.LeadlineSales.parse(raw);
    const enteredAmount=item.amount??item.price??item.sale_amount??item.contract_value??item.value;
    const amount=enteredAmount!==undefined&&safe(enteredAmount)!==''?plainAmount(enteredAmount):found.amount;
    const customer=safe(item.customer??item.customer_name??item.client??item.name??found.customer);
    const project=safe(item.project??item.project_type??item.description??found.project);
    const suppliedDate=safe(item.dateSet??item.date_set??item.date??'');
    const date=/^\d{4}-\d{2}-\d{2}$/.test(suppliedDate)?suppliedDate:today();
    // Never import an unnamed numeric-only message or a random CSV row.
    if((amount==null||!Number.isFinite(amount)||amount<0||amount>1e9)&&!customer&&!project)return null;
    return {customer,amount:Number.isFinite(amount)&&amount>=0&&amount<=1e9?amount:null,project,dateSet:date,sourceText:[customer,project,amount!=null?'$'+amount:'',date,raw].filter(Boolean).join(' — ').slice(0,2500)};
  }
  function batchFromCSV(text){
    const rows=csvRows(text);if(rows.length<2)throw Error('CSV needs a header row and at least one result.');
    const keys=rows[0].map(k=>k.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
    if(!keys.some(k=>['customer','customer_name','client','name','amount','price','sale_amount','contract_value','value','notes','message','source_text'].includes(k)))throw Error('No recognized columns. Try customer, amount, project, date, notes.');
    return rows.slice(1).map(row=>{const item={};keys.forEach((key,i)=>item[key]=row[i]||'');return prepareSale(item);}).filter(Boolean);
  }
  function stageResults(items,source){
    importedResults=items.slice(0,200);
    const panel=$('sales-batch-panel');panel.classList.toggle('hidden',!importedResults.length);
    $('sales-batch-summary').textContent=`${importedResults.length} candidate(s) from ${source}. Select the results you want to save.`;
    $('sales-batch-rows').innerHTML=importedResults.map((win,i)=>`<label class="sales-batch-row"><input type="checkbox" data-import-index="${i}" checked/><span><strong>${h(win.customer||win.project||'Unidentified sale')}</strong><small>${h(win.project||'Project unspecified')} · ${h(win.dateSet)}</small><small>${win.amount==null?'Price missing':money(win.amount)} · ${h(win.sourceText.slice(0,140))}</small></span></label>`).join('');
    fileFeedback(`${importedResults.length} potential results found. Review below before importing.`);
  }
  function resetSalesImage(){
    if(importedImageURL)URL.revokeObjectURL(importedImageURL);
    importedImageURL=null;importedImageFile=null;
    $('sales-image-preview').removeAttribute('src');$('sales-image-panel').classList.add('hidden');
    $('sales-file-input').value='';
  }
  function showSalesImage(file){
    resetSalesImage();importedImageFile=file;importedImageURL=URL.createObjectURL(file);
    $('sales-image-preview').src=importedImageURL;
    $('sales-image-panel').classList.remove('hidden');
    fileFeedback(`Screenshot selected: ${file.name}. Choose “Read screenshot text” or manually type the announcement below. Your image isn't uploaded.`);
  }
  async function salesFileSelected(file){
    if(!file)return;
    if(file.size>8*1024*1024){fileFeedback('File is over 8 MB. Choose a smaller screenshot or export.');return;}
    $('sales-file-input').value='';
    if(/^image\/(png|jpeg|webp)$/i.test(file.type)||/\.(png|jpe?g|webp)$/i.test(file.name)){showSalesImage(file);return;}
    resetSalesImage();
    try{
      const data=await file.text();if(data.length>1500000)throw Error('Too much text. Split this file into smaller batches.');
      const ext=file.name.toLowerCase().split('.').pop();
      let items=[];
      if(ext==='csv')items=batchFromCSV(data);
      else if(ext==='json'){
        const json=JSON.parse(data);
        const list=Array.isArray(json)?json:Array.isArray(json.sales)?json.sales:null;
        if(!list)throw Error('JSON must contain a list of sales or a “sales” array.');
        items=list.map(prepareSale).filter(Boolean);
      }else if(ext==='txt'||file.type.startsWith('text/')){
        const blocks=data.replace(/\r\n/g,'\n').split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);
        if(blocks.length<=1){$('wins-raw').value=data;analyzeWin();fileFeedback('Text loaded into the win editor below. Review and save it when ready.');return;}
        items=blocks.map(text=>prepareSale({sourceText:text})).filter(win=>win&&(win.amount!==null||/\b(?:won|sold|signed|closed|deal|contract)\b/i.test(win.sourceText)));
      }else throw Error('Use a PNG/JPG/WEBP screenshot, or TXT, CSV or JSON file.');
      if(!items.length){fileFeedback('No recognizable results found in this file. Try copying one announcement into the editor below.');return;}
      stageResults(items,file.name);
    }catch(e){fileFeedback(`Could not read ${file.name}: ${e.message}`);}
  }
  let ocrPromise=null;
  async function loadTesseract(){
    if(window.Tesseract)return window.Tesseract;
    if(!ocrPromise)ocrPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR library did not load.'));
      script.onerror=()=>reject(Error('Could not download OCR library. Check your connection.'));
      document.head.appendChild(script);
    }).catch(e=>{ocrPromise=null;throw e;});
    return ocrPromise;
  }
  async function readSalesScreenshot(){
    if(!importedImageFile)return;
    if(demoMode){fileFeedback('Reading the sample screenshot on this device… (internet required for OCR library).');}
    const button=$('sales-ocr');button.disabled=true;button.textContent='Reading screenshot…';
    fileFeedback('Downloading free OCR components if needed, then recognizing image text locally. Please wait.');
    try{
      const T=await loadTesseract();
      const result=await T.recognize(importedImageFile,'eng');
      const words=safe(result.data?.text);
      if(!words)throw Error('No text found. Try a clearer cropped screenshot or paste the announcement.');
      $('wins-raw').value=words.slice(0,8000);
      analyzeWin();
      fileFeedback('Text recognized and placed in the editor. IMPORTANT: A chat screenshot may contain multiple messages. Remove unrelated messages, verify the price, then save ONE win.');
    }catch(e){fileFeedback(`Screenshot reading unavailable: ${e.message} You can still type or paste the result below.`);}
    finally{button.disabled=false;button.textContent='Read screenshot text (optional)';}
  }
  function importSelectedSales(){
    const selected=[...document.querySelectorAll('[data-import-index]:checked')].map(el=>importedResults[Number(el.dataset.importIndex)]).filter(Boolean);
    if(!selected.length){toast('Select at least one result');return;}
    const existing=new Set(liveSales().map(x=>safe(x.sourceText).toLowerCase()));
    let added=0,skipped=0;
    for(const sale of selected){
      const text=safe(sale.sourceText).toLowerCase();
      if(text&&existing.has(text)){skipped++;continue;}
      const obj=normalizedSale({id:makeUUID(),...sale,appointmentId:'',createdAt:iso(),updatedAt:iso()});
      state.sales.push(obj);if(text)existing.add(text);added++;
    }
    if(added){persist();render();scheduleSync();winAlert();}
    importedResults=[];$('sales-batch-panel').classList.add('hidden');
    fileFeedback(`${added} result(s) added to your unmatched review queue. ${skipped?`${skipped} duplicate(s) skipped. `:''}Match only your confirmed sales.`);
    toast(`${added} unmatched sales imported`);
  }
  function bindSalesUploads(){
    const drop=$('sales-file-drop'),input=$('sales-file-input');
    $('sales-file-pick').addEventListener('click',e=>{e.stopPropagation();input.click();});
    drop.addEventListener('click',e=>{if(e.target.closest('button'))return;input.click();});
    drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();input.click();}});
    input.addEventListener('change',e=>salesFileSelected(e.target.files?.[0]));
    drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-dragover');});
    drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragover'));
    drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-dragover');salesFileSelected(e.dataTransfer.files?.[0]);});
    $('sales-ocr').addEventListener('click',readSalesScreenshot);
    $('sales-image-clear').addEventListener('click',()=>{resetSalesImage();fileFeedback('Screenshot removed from preview.');});
    $('sales-batch-import').addEventListener('click',importSelectedSales);
    $('sales-batch-clear').addEventListener('click',()=>{importedResults=[];$('sales-batch-panel').classList.add('hidden');fileFeedback('Import discarded.');});
  }

  function analyzeWin(){
    const raw=safe($('wins-raw').value);if(!raw){toast('Paste a Sales Wins message first');return;}
    const result=window.LeadlineSales.parse(raw);
    $('wins-customer').value=result.customer;
    $('wins-amount').value=result.amount??'';
    $('wins-project').value=result.project;
    if(!$('wins-date').value)$('wins-date').value=today();
    const suggestions=window.LeadlineSales.suggestions(result,live());
    $('wins-link').value='';
    $('wins-parse-notes').textContent=[...result.warnings,...(suggestions.length?[`Possible match found in appointment log — choose it manually if it's correct.`]:[])].join(' ')||'Customer and amount identified. Choose a matching appointment only if it is truly yours.';
    toast('Win message analyzed; review before saving');
  }
  function saveWin(){
    const amountText=$('wins-amount').value;
    const val=amountText===''?null:Number(amountText);
    if(val!==null&&(!Number.isFinite(val)||val<0||val>1000000000)){toast('Enter a valid project value');return;}
    const date=$('wins-date').value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('Choose a sale date');return;}
    const enteredRaw=safe($('wins-raw').value);
    if(enteredRaw && liveSales().some(x=>safe(x.sourceText).toLowerCase()===enteredRaw.toLowerCase())){toast('This exact win announcement was already saved. Check the review queue.');return;}
    const appointmentId=safe($('wins-link').value);
    if(appointmentId&&liveSales().some(x=>x.appointmentId===appointmentId)&&!confirm('Another win is already linked to this appointment. Confirm this is a separate sale.'))return;
    if(appointmentId&&!live().some(x=>x.id===appointmentId)){toast('Choose a valid appointment match');return;}
    const win=normalizedSale({id:makeUUID(),customer:$('wins-customer').value,amount:val,project:$('wins-project').value,dateSet:date,sourceText:$('wins-raw').value,appointmentId,createdAt:iso(),updatedAt:iso()});
    state.sales.push(win);persist();render();scheduleSync();
    $('wins-raw').value='';$('wins-customer').value='';$('wins-amount').value='';$('wins-project').value='';$('wins-link').value='';$('wins-date').value=today();$('wins-parse-notes').textContent='Saved. Paste another announcement to continue.';
    if(!appointmentId)winAlert();
    toast(appointmentId?'Win confirmed and matched':'Win saved for matching — not counted as your sale yet');
  }
  function renderSales(){
    const all=liveSales(),matched=linkedSales(),sum=matched.reduce((a,x)=>a+(x.amount||0),0);
    $('wins-nav-count').textContent=all.length;
    $('wins-matched').textContent=matched.length;
    $('wins-value').textContent=money(sum);
    $('wins-commission').textContent=money(sum*state.commissionRate/100);
    $('wins-pending').textContent=all.length-matched.length;
    const options=['<option value="">Not matched / needs verification</option>',...live().sort((a,b)=>b.dateSet.localeCompare(a.dateSet)).map(a=>`<option value="${h(a.id)}">${h(a.label||a.projectType||'Appointment')} · ${h(niceDate(a.dateSet))}</option>`)].join('');
    const picker=$('wins-link'),old=picker.value;picker.innerHTML=options;picker.value=old;
    $('wins-queue').innerHTML=all.length?[...all].sort((a,b)=>b.dateSet.localeCompare(a.dateSet)).map(x=>{
      const linked=matched.some(w=>w.id===x.id);
      return `<div class="win-item"><div class="win-heading"><div><strong>${h(x.customer||x.project||'Unidentified sale')}</strong><small>${h(niceDate(x.dateSet))} · ${h(x.project||'Project unspecified')}</small></div><b>${x.amount==null?'Amount unknown':money(x.amount)}</b></div><span class="win-status ${linked?'win-matched':'win-unmatched'}">${linked?'✓ Matched to your appointment':'◌ Needs match'}</span><div class="win-actions"><select data-sales-select="${h(x.id)}" aria-label="Appointment match for win"><option value="">Unmatched</option>${live().map(a=>`<option value="${h(a.id)}" ${x.appointmentId===a.id?'selected':''}>${h(a.label||a.projectType||'Appointment')} · ${h(niceDate(a.dateSet))}</option>`).join('')}</select><button type="button" class="btn btn-outline" data-sales-match="${h(x.id)}">Save match</button><button type="button" class="small-delete" data-sales-delete="${h(x.id)}" aria-label="Delete sales win">×</button></div></div>`;
    }).join(''):'<div class="quiet-empty">No sales results yet. Upload a screenshot, import a file, or paste an announcement.</div>';
    renderSalesChart();
  }
  function renderSalesChart(){
    const records=linkedSales(),dates=dateSeries(winsRange),buckets=new Map();records.forEach(x=>{buckets.set(x.dateSet,(buckets.get(x.dateSet)||0)+(x.amount||0));});
    const values=dates.map(x=>buckets.get(x)||0),sum=values.reduce((a,b)=>a+b,0);
    $('wins-period-total').textContent=money(sum)+' total';
    const w=770,hh=250,l=58,r=10,t=14,b=43,plotW=w-l-r,plotH=hh-t-b,max=Math.max(1,Math.ceil(Math.max(...values,0)/5000)*5000),x=i=>l+i/(dates.length-1)*plotW,y=n=>t+(1-n/max)*plotH;
    const coords=values.map((v,i)=>[x(i),y(v)]), poly=coords.map(z=>z.join(',')).join(' '),area=`M${l},${hh-b} L${coords.map(z=>z.join(',')).join(' L')} L${w-r},${hh-b} Z`;
    const marks=[0,.25,.5,.75,1].map(q=>{const yy=y(max*q);return `<line class="grid-line" x1="${l}" y1="${yy}" x2="${w-r}" y2="${yy}"/><text class="axis-tick" x="${l-8}" y="${yy+4}" text-anchor="end">${Math.round(max*q/1000)}k</text>`;}).join('');
    if(!dates.includes(winSelected))winSelected=dates.at(-1);
    $('wins-chart').innerHTML=`<svg class="trend-svg" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Daily matched sales revenue line chart"><defs><linearGradient id="wins-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".27"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${marks}<path d="${area}" fill="url(#wins-fill)"/><polyline points="${poly}" class="trend-line"/>${dates.map((d,i)=>`<circle class="chart-point${d===winSelected?' picked':''}" cx="${x(i)}" cy="${y(values[i])}" r="${d===winSelected?5:3}"/><rect data-sales-point="${d}" x="${x(i)-Math.max(4,plotW/dates.length/2)}" y="${t}" width="${Math.max(8,plotW/dates.length)}" height="${plotH}" fill="transparent"><title>${h(d)}: ${money(values[i])}</title></rect>`).join('')}<text class="axis-tick" x="${l}" y="${hh-14}">${h(niceDate(dates[0]))}</text><text class="axis-tick" x="${w-r}" y="${hh-14}" text-anchor="end">${h(niceDate(dates.at(-1)))}</text></svg>`;
    const i=dates.indexOf(winSelected);$('wins-chart-selection').innerHTML=`<b>${h(niceDate(winSelected))}</b><span>${money(values[i])}</span><small>Confirmed project value (not your commission)</small>`;
    $('wins-chart').setAttribute('aria-label',dates.map((d,i)=>d+': '+money(values[i])).join('; '));
  }

  // V5: all analytics derive from existing local-first appointments, hours and matched sales.
  // Personalization and received payments share the existing encrypted-transport, RLS-protected preference record.
  function v5Sanitize(x){
    const ob=x&&typeof x==='object'?x:{};
    return {
      designerGoal:Math.max(1,Math.min(60,Math.round(Number(ob.designerGoal)||20))),
      payments:Array.isArray(ob.payments)?ob.payments.slice(0,1000).filter(e=>e && /^(SDR|Designer)$/.test(e.job)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&Number(e.amount)>0).map(e=>({id:safe(e.id)||makeUUID(),job:e.job,date:e.date,amount:Math.min(1e8,Number(e.amount)),note:safe(e.note).slice(0,100)})):[],
      rules:Array.isArray(ob.rules)?ob.rules.slice(0,30).filter(r=>r&&safe(r.from)&&safe(r.to)).map(r=>({id:safe(r.id)||makeUUID(),from:safe(r.from).slice(0,90),to:safe(r.to).slice(0,150)})):[]
    };
  }
  state.v5=v5Sanitize(state.v5);
  const v5Pick=(id)=>$(id);
  const v5Dates=(a,b)=>{const dates=[];let d=new Date(a+'T12:00:00'),to=new Date(b+'T12:00:00');if(!Number.isFinite(+d)||!Number.isFinite(+to)||d>to)return dates;for(let n=0;d<=to&&n<400;n++,d.setDate(d.getDate()+1))dates.push(localYMD(d));return dates;};
  const v5Shift=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return localYMD(d);};
  function v5ApplyRules(raw){return state.v5.rules.reduce((text,r)=>{
    const needle=r.from.trim(); if(!needle || needle.length>90)return text;
    return text.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),()=>r.to);
  },raw);}
  function v5MetricMaps(){
    const metrics={appointments:new Map(),hours:new Map(),sales:new Map(),commissions:new Map(),earnings:new Map(),wins:new Map()};
    const add=(key,day,n)=>metrics[key].set(day,(metrics[key].get(day)||0)+n);
    live().forEach(x=>add('appointments',x.dateSet,1));
    linkedSales().forEach(x=>{add('sales',x.dateSet,x.amount||0);add('commissions',x.dateSet,(x.amount||0)*state.commissionRate/100);add('wins',x.dateSet,1);});
    let w=state.designerPrefs.threshold*3600000;const weeks=new Map();
    const segments=liveHours().flatMap(segmentsFor).sort((a,b)=>a.start-b.start);
    segments.forEach(x=>{add('hours',x.day,x.ms/3600000);
      if(state.designerPrefs.rate!=null){const week=weekFor(x.day),soFar=weeks.get(week)||0;
        const reg=Math.max(0,Math.min(x.ms,w-soFar)),ot=x.ms-reg;
        add('earnings',x.day,(reg+ot*Number(state.designerPrefs.multiplier))/3600000*Number(state.designerPrefs.rate));weeks.set(week,soFar+x.ms);
      }
    });
    return metrics;
  }
  const v5Labels={appointments:'Appointments',hours:'Hours',sales:'Project value',commissions:'Est. SDR commission',earnings:'Est. Designer wages',wins:'Projects sold'};
  const v5Value=(key,n)=>['sales','commissions','earnings'].includes(key)?money(n):key==='hours'?`${n.toFixed(2)}h`:String(Math.round(n));
  const v5MetricSum=(map,dates)=>dates.reduce((s,d)=>s+(map?.get(d)||0),0);
  const v5Card=(name,number,note)=>`<div class="v5-metric"><small>${h(name)}</small><strong>${h(number)}</strong><span>${h(note||'')}</span></div>`;
  function v5SvgChart(el,dates,map,secondary=null,secondaryDates=null,labels={}){
    if(!el)return;
    const list=dates.map(d=>map?.get(d)||0),others=secondary ? (secondaryDates||dates).map(d=>secondary.get(d)||0) : [];
    if(!dates.length){el.innerHTML='<p class="quiet-empty">Select a valid range under 400 days.</p>';return;}
    const width=900,height=275,l=60,r=16,t=25,b=45,uw=width-l-r,uh=height-t-b;
    const top=Math.max(1,...list),secondTop=Math.max(1,...others);
    const x=i=>l+(dates.length===1?0.5:i/(dates.length-1))*uw;
    const y=(n,max)=>t+uh*(1-n/max);
    const line=arr=>arr.map((v,i)=>`${i===0?'M':'L'}${x(i).toFixed(2)},${y(v,arr===list?top:secondTop).toFixed(2)}`).join(' ');
    const main=line(list),base=t+uh;
    const fill=`${main} L${x(dates.length-1)},${base} L${x(0)},${base} Z`;
    const tick=(max,frac)=>Math.round(max*frac*100)/100;
    let grid=[0,.25,.5,.75,1].map(z=>{const yy=y(top*z,top);return `<line x1="${l}" x2="${width-r}" y1="${yy}" y2="${yy}" class="v5-grid-line"/><text class="v5-axis" x="${l-12}" y="${yy+4}" text-anchor="end">${h(String(tick(top,z)))}</text>`}).join('');
    const ticks=[0,.25,.5,.75,1].map(frac=>{const i=Math.round(frac*(dates.length-1));return `<text class="v5-axis" x="${x(i)}" y="${height-16}" text-anchor="${frac===0?'start':frac===1?'end':'middle'}">${h(dates[i].slice(5))}</text>`}).join('');
    const hotspots=dates.map((d,i)=>`<rect class="v5-point-target" data-v5-chart-day="${d}" data-v5-chart-index="${i}" x="${x(i)-Math.max(4,uw/dates.length/2)}" y="${t}" width="${Math.max(8,uw/dates.length)}" height="${uh}" fill="transparent" tabindex="0" aria-label="${d}: ${v5Value(labels.metric||'appointments',list[i])}"><title>${d} — ${v5Value(labels.metric||'appointments',list[i])}</title></rect>`).join('');
    el.innerHTML=`<svg class="v5-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily line graph"><defs><linearGradient id="v5chartfill-${el.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${fill}" fill="url(#v5chartfill-${el.id})"/><path d="${main}" stroke="var(--accent)" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${secondary?`<path d="${line(others)}" stroke="var(--v5-secondary)" fill="none" stroke-width="2.5" stroke-dasharray="7 6" stroke-linejoin="round"/>`:''}${ticks}${hotspots}</svg>`;
    el.dataset.dates=JSON.stringify(dates);el.dataset.primary=JSON.stringify(list);el.dataset.secondary=JSON.stringify(others);
  }
  function v5GraphRange(){const kind=v5Pick('v5-range').value;let end=today(),start=v5Shift(end,-(Number(kind)||30)+1);
    if(kind==='custom'){start=v5Pick('v5-start').value;end=v5Pick('v5-end').value;}
    return v5Dates(start,end);
  }
  function v5Graph(){
    const maps=v5MetricMaps(),metric=v5Pick('v5-metric').value,compare=v5Pick('v5-compare').value,dates=v5GraphRange();
    const prevDates=dates.map(d=>v5Shift(d,-dates.length));
    const other=compare==='none'?null:compare==='previous'?maps[metric]:maps[compare];
    v5SvgChart(v5Pick('v5-graph'),dates,maps[metric],other,compare==='previous'?prevDates:dates,{metric});
    if(dates.length){const total=v5MetricSum(maps[metric],dates);const compared=compare==='previous'?v5MetricSum(maps[metric],prevDates):compare!=='none'?v5MetricSum(maps[compare],dates):null;
      v5Pick('v5-graph-detail').innerHTML=`<strong>${h(v5Labels[metric])}: ${h(v5Value(metric,total))}</strong>${compared!=null?`<span>${compare==='previous'?'Previous period':v5Labels[compare]}: ${h(v5Value(compare==='previous'?metric:compare,compared))}</span>`:''}`;
    }
    const maxDate=dates.at(-1)||today(), current=v5Dates(v5Shift(maxDate,-6),maxDate);
    v5Pick('v5-lab-kpis').innerHTML=v5Card('Last 7 days · appointments',v5Value('appointments',v5MetricSum(maps.appointments,current)),'When you set them')+v5Card('Designer hours',v5Value('hours',v5MetricSum(maps.hours,current)),'Paid work sessions')+v5Card('Matched sales',v5Value('wins',v5MetricSum(maps.wins,current)),'Confirmed matches')+v5Card('Project value',v5Value('sales',v5MetricSum(maps.sales,current)),'Not your commission');
  }
  function v5Heatmap(){
    const heat=v5Pick('v5-heatmap'),key=v5Pick('v5-heat-type').value,maps=v5MetricMaps(),end=today(),start=v5Shift(end,-363),days=v5Dates(start,end),max=Math.max(1,...days.map(d=>maps[key].get(d)||0));
    const first=new Date(start+'T12:00:00').getDay(),cells=[];
    for(let i=0;i<first;i++)cells.push('<span class="v5-heat-blank" aria-hidden="true"></span>');
    for(const day of days){const v=maps[key].get(day)||0,level=v===0?0:Math.max(1,Math.min(4,Math.ceil(v/max*4)));
      cells.push(`<button type="button" class="v5-heat-cell v5-level-${level}" data-v5-heat-day="${day}" title="${h(niceDate(day))}: ${h(v5Value(key,v))}" aria-label="${h(niceDate(day))}: ${h(v5Value(key,v))}"></button>`);
    }heat.innerHTML=cells.join('');
  }
  function v5Conversion(){
    const appts=live(),wins=linkedSales(),byType=['Phone / video','In person'].map(k=>({key:k,appts:appts.filter(x=>x.meetingType===k),wins:wins.filter(w=>appts.some(a=>a.id===w.appointmentId && a.meetingType===k))}));
    const sources=[...new Set(appts.map(x=>x.source||'Not specified'))].sort();
    const categories=[...new Set(appts.map(x=>x.projectType||'Not specified'))].sort();
    const rows=[...byType.map(x=>({name:x.key,count:x.appts.length,sold:x.wins.length})),...sources.map(src=>({name:'Source: '+src,count:appts.filter(x=>(x.source||'Not specified')===src).length,sold:wins.filter(w=>appts.some(a=>a.id===w.appointmentId&&(a.source||'Not specified')===src)).length})),...categories.map(cat=>({name:'Project: '+cat,count:appts.filter(x=>(x.projectType||'Not specified')===cat).length,sold:wins.filter(w=>appts.some(a=>a.id===w.appointmentId&&(a.projectType||'Not specified')===cat)).length}))];
    v5Pick('v5-conversion').innerHTML=`<div class="v5-conversion-total">${v5Card('Appointments',String(appts.length),'All recorded')}${v5Card('Matched wins',String(wins.length),'Manually confirmed')}${v5Card('Conversion',appts.length?((wins.length/appts.length)*100).toFixed(1)+'%':'—','Historical, not a forecast')}</div><div class="v5-breakdown">${rows.map(x=>`<div class="v5-breakdown-row"><div><b>${h(x.name)}</b><small>${x.sold}/${x.count} sold · ${x.count?(x.sold/x.count*100).toFixed(1)+'%':'—'}</small></div><div class="v5-bar"><span style="width:${x.count?Math.min(100,x.sold/x.count*100):0}%"></span></div></div>`).join('')}</div><p class="v5-help">Only manually matched wins are included. This is descriptive tracking; the actual close rate can change as appointments are still pending.</p>`;
  }
  function v5Income(){
    const maps=v5MetricMaps(),dates=v5Dates(v5Shift(today(),-29),today()),monthlyDesigner=v5MetricSum(maps.earnings,dates),monthlySDR=v5MetricSum(maps.commissions,dates),paid=state.v5.payments.reduce((sum,x)=>sum+x.amount,0);
    const allEstimated=[...maps.earnings.values()].reduce((a,b)=>a+b,0)+[...maps.commissions.values()].reduce((a,b)=>a+b,0);
    v5Pick('v5-income-kpis').innerHTML=v5Card('Designer · 30 days',state.designerPrefs.rate==null?'Set hourly rate':money(monthlyDesigner),'Gross estimate')+v5Card('SDR · 30 days',money(monthlySDR),'Matched wins only')+v5Card('Total est. · 30 days',state.designerPrefs.rate==null?'Incomplete':money(monthlyDesigner+monthlySDR),'Gross, before taxes')+v5Card('Payments recorded',money(paid),'All time · entered manually');
    const weekly=new Map();
    for(const d of v5Dates(v5Shift(today(),-83),today())){
      const wk=weekFor(d),entry=weekly.get(wk)||{sdr:0,designer:0,combined:0};
      entry.sdr+=maps.commissions.get(d)||0;
      entry.designer+=maps.earnings.get(d)||0;
      entry.combined=entry.sdr+entry.designer;
      weekly.set(wk,entry);
    }
    renderV54IncomeGraph(weekly);
    const list=v5Pick('v5-payment-list');list.innerHTML=`<h4>Payments received</h4>${state.v5.payments.length?[...state.v5.payments].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="v5-payment"><div><b>${money(x.amount)}</b><span>${h(x.job)} · ${h(niceDate(x.date))}${x.note?' · '+h(x.note):''}</span></div><button data-v5-remove-payment="${h(x.id)}" class="v5-text-button" aria-label="Remove payment" title="Delete entry">×</button></div>`).join(''):'<p class="v5-help">No payments recorded yet. Do not mark estimates as received until you actually get paid.</p>'}`;
  }
  const v54IncomeVisible={sdr:true,designer:true,combined:true};
  function renderV54IncomeGraph(weekly){
    const element=$('v5-income-chart'),entries=[...weekly.entries()].sort((a,b)=>a[0].localeCompare(b[0])),weeks=entries.map(x=>x[0]);
    if(!weeks.length){element.innerHTML='<p class="v5-help">No income to graph yet.</p>';return;}
    const series=['sdr','designer','combined'].filter(x=>v54IncomeVisible[x]);
    const w=780,hh=310,left=67,right=15,top=23,bottom=55,W=w-left-right,H=hh-top-bottom;
    const max=Math.max(10,...entries.flatMap(x=>series.map(k=>x[1][k])))*1.12;
    const X=i=>left+(entries.length===1?W/2:W*i/(entries.length-1));
    const Y=v=>top+H-H*v/max;
    const css={sdr:'#ac92ff',designer:'#39c9b6',combined:'#f0b965'};
    const line=series.map(k=>{
      const pts=entries.map((x,i)=>[X(i),Y(x[1][k])]);
      return `<polyline points="${pts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${css[k]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="${k} income"/>${pts.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="3.1" fill="${css[k]}" aria-hidden="true"/>`).join('')}`;
    }).join('');
    const grid=[0,.25,.5,.75,1].map(q=>{const y=Y(max*q);return `<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" class="v5-grid-line"/><text x="${left-10}" y="${y+4}" text-anchor="end" class="v5-axis">${money(max*q).replace(/\.00$/,'')}</text>`}).join('');
    const labels=entries.map(([week],i)=>i%Math.max(1,Math.ceil(entries.length/5))===0||i===entries.length-1?`<text x="${X(i)}" y="${hh-20}" class="v5-axis" text-anchor="middle">${h(week.slice(5))}</text>`:'').join('');
    const taps=entries.map(([week],i)=>`<rect data-v54-income-week="${h(week)}" x="${X(i)-W/(entries.length*2)}" y="${top}" width="${W/entries.length}" height="${H}" fill="transparent" tabindex="0" role="button" aria-label="Show income for week of ${h(week)}"/>`).join('');
    element.innerHTML=`<svg class="v54-income-svg" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Weekly SDR, Designer, and combined estimated income. Three colored lines.">${grid}${labels}${line}${taps}</svg>`;
    element.dataset.v54Weeks=JSON.stringify(entries);
    showV54IncomeDetail(weeks.at(-1),entries);
  }
  function showV54IncomeDetail(week,entries){
    const entry=entries.find(x=>x[0]===week);if(!entry)return;
    $('v54-income-detail').innerHTML=`<strong>Week of ${h(niceDate(week))}</strong><span class="v54-income-sdr">SDR ${money(entry[1].sdr)}</span><span class="v54-income-designer">Designer ${money(entry[1].designer)}</span><span class="v54-income-combined">Combined ${money(entry[1].combined)}</span>`;
  }
  function v5Goals(){
    const appts=live(),dayCounts=new Map();appts.forEach(x=>dayCounts.set(x.dateSet,(dayCounts.get(x.dateSet)||0)+1));
    const months=new Map();appts.forEach(x=>{const mo=x.dateSet.slice(0,7);months.set(mo,(months.get(mo)||0)+1);});
    const sortedDays=[...dayCounts.entries()].sort((a,b)=>b[1]-a[1]),sortedMonths=[...months.entries()].sort((a,b)=>b[1]-a[1]);
    const wk=count('week'),goal=state.goal,amount=Math.round(wk/goal*100);
    let currentStreak=0,bestStreak=0,run=0;const allDays=[...dayCounts.keys()].sort();const allDaySet=new Set(allDays);
    const streakStart=allDaySet.has(today())?today():v5Shift(today(),-1);for(let i=0;i<3650&&allDaySet.has(v5Shift(streakStart,-i));i++)currentStreak++;
    for(let i=0;i<allDays.length;i++){run=(i>0&&v5Shift(allDays[i-1],1)===allDays[i])?run+1:1;bestStreak=Math.max(bestStreak,run);}
    v5Pick('v5-goal-kpis').innerHTML=v5Card('This week',String(wk),`${goal} target`)+v5Card('Best day',String(sortedDays[0]?.[1]||0),sortedDays[0]?niceDate(sortedDays[0][0]):'Not yet')+v5Card('Best month',String(sortedMonths[0]?.[1]||0),sortedMonths[0]?.[0]||'Not yet')+v5Card('All-time appointments',String(appts.length),'Since you started tracking')+v5Card('Active-day streak',String(currentStreak),'Days with an appointment')+v5Card('Best active-day streak',String(bestStreak),'Your historical record');
    const targets=[{title:'First 10 appointments',value:10},{title:'First 50 appointments',value:50},{title:'First 100 appointments',value:100},{title:'First 250 appointments',value:250}];
    v5Pick('v5-records').innerHTML=targets.map(x=>`<div class="v5-milestone ${appts.length>=x.value?'is-earned':''}"><div class="v5-milestone-mark">${appts.length>=x.value?'✓':'○'}</div><div class="v5-milestone-copy"><b>${x.title}</b><span>${Math.min(appts.length,x.value)} / ${x.value} completed</span><div class="v5-milestone-track"><span style="width:${Math.min(100,100*appts.length/x.value)}%"></span></div></div></div>`).join('');
    v5Pick('v5-goal-progress').innerHTML=`<div class="v5-goal-spotlight">
      <div class="focus-ring v5-goal-ring" style="--progress:${Math.min(100,amount)}" role="progressbar" aria-valuenow="${Math.min(100,amount)}" aria-valuemin="0" aria-valuemax="100" aria-label="Weekly appointment goal completion">
        <div class="focus-ring-inner"><span class="focus-ring-label">PROGRESS</span><strong>${Math.min(100,amount)}%</strong><small>of weekly goal</small></div>
      </div>
      <div class="v5-goal-copy"><span class="micro-eyebrow">THIS WEEK</span><div class="v5-goal-number">${wk} <small>/ ${goal} appointments</small></div><div class="v5-bar"><span style="width:${Math.min(100,amount)}%"></span></div><p class="v5-help">${wk>=goal?'Weekly goal reached.':`${goal-wk} remaining to your optional weekly target.`} Targets are for planning, not a reason to skip breaks or overwork.</p></div>
      </div>`;
  }
  function v5Productivity(){
    const n=designerNumbers(),tasks=new Map(),projects=new Map(),week=n.week.ms/3600000;
    n.entries.forEach(x=>{tasks.set(x.task,(tasks.get(x.task)||0)+paidHours(x));projects.set(x.project||'Unlabeled',(projects.get(x.project||'Unlabeled')||0)+paidHours(x));});
    const progress=Math.min(100,Math.round(week/state.v5.designerGoal*100));
    v5Pick('v5-designer-kpis').innerHTML=v5Card('This week',fmtHours(week),'Completed sessions')+v5Card('This month',fmtHours(n.monthMs/3600000),'Total paid hours')+v5Card('Projects worked',String(projects.size),'All recorded')+v5Card('Active sessions',String(n.entries.length),'All recorded');
    const bars=(map)=>{const sorted=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10),max=Math.max(1,...sorted.map(x=>x[1]));return sorted.length?sorted.map(([name,hours])=>`<div class="v5-breakdown-row"><div><b>${h(name)}</b><small>${fmtHours(hours)}</small></div><div class="v5-bar"><span style="width:${100*hours/max}%"></span></div></div>`).join(''):'<p class="quiet-empty">No completed time sessions yet.</p>';};
    v5Pick('v5-task-breakdown').innerHTML=bars(tasks);v5Pick('v5-project-breakdown').innerHTML=bars(projects);
    if(document.activeElement!==v5Pick('v5-hours-goal'))v5Pick('v5-hours-goal').value=state.v5.designerGoal;
    v5Pick('v5-designer-goal-progress').innerHTML=`<div class="v5-goal-spotlight"><div class="focus-ring v5-goal-ring" style="--progress:${progress}" role="progressbar" aria-label="Weekly Designer hours goal completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="focus-ring-inner"><span class="focus-ring-label">PROGRESS</span><strong>${progress}%</strong><small>of weekly goal</small></div></div><div class="v5-goal-copy"><span class="micro-eyebrow">DESIGNER HOURS</span><div class="v5-goal-number">${fmtHours(week)} <small>/ ${state.v5.designerGoal}h goal</small></div><div class="v5-bar"><span style="width:${progress}%"></span></div><p class="v5-help">This goal is optional. Take breaks and follow your work schedule.</p></div></div>`;
  }
  function v5InvoiceData(){
    const start=v5Pick('v5-invoice-from').value,end=v5Pick('v5-invoice-to').value;
    if(!start||!end||start>end)return {entries:[],hours:0,total:null,error:'Choose a valid start and end date.'};
    const entries=liveHours().filter(x=>{const d=dateOf(Date.parse(x.startedAt));return d>=start&&d<=end;}).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
    const hours=entries.reduce((sum,x)=>sum+paidHours(x),0);
    // Estimate per period; special payroll rules may apply across both roles.
    const rate=state.designerPrefs.rate,total=rate==null?null:hours*Number(rate);
    return {entries,hours,total,error:null};
  }
  function v5Invoice(){
    const obj=v5InvoiceData();v5Pick('v5-invoice-summary').innerHTML=obj.error?`<p class="v5-help">${h(obj.error)}</p>`:`${v5Card('Work sessions',String(obj.entries.length),'')}${v5Card('Paid hours',fmtHours(obj.hours),'Breaks excluded')}${v5Card('Draft amount',obj.total==null?'Set hourly rate':money(obj.total),'Base rate only; verify overtime')}<div class="v5-invoice-table"><div><b>Date</b><b>Project / task</b><b>Hours</b></div>${obj.entries.slice(0,100).map(x=>`<div><span>${h(niceDate(dateOf(Date.parse(x.startedAt))))}</span><span>${h(x.project)} · ${h(x.task)}</span><span>${paidHours(x).toFixed(2)}</span></div>`).join('')}</div>`;
  }
  function v5ExportTimesheet(){const o=v5InvoiceData();if(o.error){toast(o.error);return;}const fields=['Date','Project','Task','Start','End','Break minutes','Paid hours','Notes'];const rows=o.entries.map(x=>[dateOf(Date.parse(x.startedAt)),x.project,x.task,x.startedAt,x.endedAt,x.breakMinutes,paidHours(x).toFixed(3),x.notes].map(csvCell).join(','));exportText(`leadline-designer-timesheet-${v5Pick('v5-invoice-from').value}-to-${v5Pick('v5-invoice-to').value}.csv`,'\uFEFF'+[fields.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');toast('Timesheet CSV exported');}
  function v5PrintInvoice(){
    const o=v5InvoiceData();if(o.error){toast(o.error);return;}if(!o.entries.length){toast('No time entries in this pay period');return;}
    const from=h(safe(v5Pick('v5-invoice-from-name').value)||'Your name'),to=h(safe(v5Pick('v5-invoice-to-name').value)||'Western Timber Frame');const id=h(safe(v5Pick('v5-invoice-number').value)||'DRAFT');
    const rate=state.designerPrefs.rate;
    const rows=o.entries.map(x=>`<tr><td>${h(niceDate(dateOf(Date.parse(x.startedAt))))}</td><td>${h(x.project)}<br><small>${h(x.task)}</small></td><td>${paidHours(x).toFixed(2)}</td><td>${rate==null?'—':money(paidHours(x)*rate)}</td></tr>`).join('');
    const markup=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Leadline Draft Invoice ${id}</title><style>body{font:14px Arial,sans-serif;color:#1b2430;margin:44px;max-width:850px}h1{margin:0 0 4px;font-size:30px}small,p{color:#657184}.top{display:flex;justify-content:space-between;gap:20px;margin:0 0 30px}.note{background:#f3f4f9;padding:14px;margin:24px 0;border-radius:8px}table{border-collapse:collapse;width:100%;margin-top:25px}td,th{text-align:left;border-bottom:1px solid #dde0e8;padding:13px 8px;vertical-align:top}th{background:#f2f3f8}.total{margin-top:26px;text-align:right;font-size:21px;font-weight:700}@media print{button{display:none}}</style></head><body><div class="top"><div><h1>Draft invoice</h1><small>No. ${id} · Generated ${h(niceDate(today()))}</small></div><div><b>From:</b> ${from}<br><b>To:</b> ${to}</div></div><p>Designer work: ${h(niceDate(v5Pick('v5-invoice-from').value))} – ${h(niceDate(v5Pick('v5-invoice-to').value))}</p><table><thead><tr><th>Date</th><th>Project / task</th><th>Hours</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="total">${o.hours.toFixed(2)} hours · ${o.total==null?'Rate not set':money(o.total)}</div><p class="note">Draft estimate only. The amount shown uses the base Designer hourly rate and does not calculate all possible overtime, adjustments, deductions or taxes. Confirm with company payroll before submitting.</p><button onclick="window.print()">Print / Save PDF</button><script>setTimeout(()=>window.print(),500);<\/script></body></html>`;
    const win=window.open('','_blank');if(!win){toast('Allow popups to print the draft invoice');return;}win.document.open();win.document.write(markup);win.document.close();
  }
  function v5RenderRules(){const target=v5Pick('v5-rules-list');if(!target)return;target.innerHTML=state.v5.rules.length?state.v5.rules.map(x=>`<div class="v5-payment"><div><b>${h(x.from)}</b> <span>→ ${h(x.to)}</span></div><button class="v5-text-button" data-v5-remove-rule="${h(x.id)}" aria-label="Remove correction">×</button></div>`).join(''):'<p class="v5-help">No saved corrections yet. Your company formatting rules still apply.</p>';}
  function renderV5(){
    v5RenderRules();
    if(activePage==='insights'){v5Graph();v5Heatmap();v5Conversion();}
    if(activePage==='income')v5Income();
    if(activePage==='goals')v5Goals();
    if(activePage==='productivity')v5Productivity();
    if(activePage==='invoices')v5Invoice();
  }
  function initV5(){
    const now=today(),prior=v5Shift(now,-13);
    v5Pick('v5-start').value=v5Shift(now,-29);v5Pick('v5-end').value=now;
    v5Pick('v5-invoice-from').value=prior;v5Pick('v5-invoice-to').value=now;v5Pick('v5-invoice-number').value='0003';
    v5Pick('v5-payment-form').elements.date.value=now;
    ['v5-metric','v5-compare','v5-range','v5-start','v5-end','v5-heat-type','v5-invoice-from','v5-invoice-to'].forEach(id=>v5Pick(id).addEventListener('change',()=>{
      if(id==='v5-range')v5Pick('v5-custom-range').classList.toggle('hidden',v5Pick(id).value!=='custom');renderV5();
    }));
    document.addEventListener('click',e=>{
      const incomePoint=e.target.closest('[data-v54-income-week]');if(incomePoint){showV54IncomeDetail(incomePoint.dataset.v54IncomeWeek,JSON.parse($('v5-income-chart').dataset.v54Weeks||'[]'));return;}
      const heat=e.target.closest('[data-v5-heat-day]');if(heat){const d=heat.dataset.v5HeatDay,m=v5Pick('v5-heat-type').value,n=v5MetricMaps()[m].get(d)||0;v5Pick('v5-heat-detail').textContent=`${niceDate(d)} · ${v5Value(m,n)} ${v5Labels[m]}`;return;}
      const point=e.target.closest('[data-v5-chart-day]');if(point){const id=point.closest('[id]')?.id;if(id==='v5-graph'){
        const day=point.dataset.v5ChartDay,index=+point.dataset.v5ChartIndex,primary=JSON.parse(v5Pick('v5-graph').dataset.primary||'[]'),second=JSON.parse(v5Pick('v5-graph').dataset.secondary||'[]'),m=v5Pick('v5-metric').value,comp=v5Pick('v5-compare').value;
        v5Pick('v5-graph-detail').innerHTML=`<strong>${niceDate(day)}: ${h(v5Value(m,primary[index]||0))} ${h(v5Labels[m])}</strong>${second.length?`<span>Compare: ${h(v5Value(comp==='previous'?m:comp,second[index]||0))}</span>`:''}`;
      }return;}
      const p=e.target.closest('[data-v5-remove-payment]');if(p){if(!confirm('Remove this received-payment record?'))return;state.v5.payments=state.v5.payments.filter(x=>x.id!==p.dataset.v5RemovePayment);updatePrefs();return;}
      const r=e.target.closest('[data-v5-remove-rule]');if(r){state.v5.rules=state.v5.rules.filter(x=>x.id!==r.dataset.v5RemoveRule);updatePrefs();return;}
    });
    document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-v54-income-week]')){e.preventDefault();e.target.click();}});
    document.querySelectorAll('[data-income-series]').forEach(input=>input.addEventListener('change',()=>{v54IncomeVisible[input.dataset.incomeSeries]=input.checked;v5Income();}));
    document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ') &&e.target.matches('[data-v5-chart-day]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
    v5Pick('v5-payment-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target),amount=Number(data.get('amount'));
      if(!Number.isFinite(amount)||amount<=0||amount>1e8){toast('Enter a valid payment amount');return;}
      const item={id:makeUUID(),date:safe(data.get('date')),job:safe(data.get('job')),amount,note:safe(data.get('note'))};state.v5.payments.push(item);updatePrefs();e.target.reset();e.target.elements.date.value=today();toast('Payment recorded');
    });
    v5Pick('v5-save-hours-goal').addEventListener('click',()=>{const value=Number(v5Pick('v5-hours-goal').value);if(!Number.isInteger(value)||value<1||value>60){toast('Choose a weekly target between 1 and 60 hours');return;}state.v5.designerGoal=value;updatePrefs();toast('Designer goal saved');});
    v5Pick('v5-rule-form').addEventListener('submit',e=>{e.preventDefault();const from=safe(e.target.elements.from.value),to=safe(e.target.elements.to.value);
      if(from.length<2||to.length<2||from.toLowerCase()===to.toLowerCase()){toast('Enter a useful replacement');return;}if(state.v5.rules.length>=30){toast('Maximum 30 custom rules');return;}
      state.v5.rules.push({id:makeUUID(),from,to});e.target.reset();updatePrefs();toast('Correction saved locally and to your sync preferences');
    });
    v5Pick('v5-download-timesheet').addEventListener('click',v5ExportTimesheet);
    v5Pick('v5-print-invoice').addEventListener('click',v5PrintInvoice);
    document.querySelectorAll('.v5-link').forEach(x=>x.title='V5 feature');
    renderV5();
  }

  function bind(){
    document.addEventListener('click',e=>{
      const trend=e.target.closest('[data-trend][data-days], [data-trend-day]');
      if(trend?.dataset.trendDay){trendSelected[trend.dataset.trendDay]=trend.dataset.date;render();return;}
      if(trend?.dataset.trend){const role=trend.dataset.trend;trendRanges[role]=Number(trend.dataset.days);trendSelected[role]=null;document.querySelectorAll(`[data-trend="${role}"][data-days]`).forEach(b=>b.classList.toggle('selected',b===trend));render();return;}
      const salesPoint=e.target.closest('[data-sales-point]');if(salesPoint){winSelected=salesPoint.dataset.salesPoint;renderSalesChart();return;}
      const salesMatch=e.target.closest('[data-sales-match]');if(salesMatch){const win=state.sales.find(x=>x.id===salesMatch.dataset.salesMatch);const val=safe(document.querySelector(`[data-sales-select="${CSS.escape(win?.id||'')}"]`)?.value);if(win){if(val&&state.sales.some(x=>!x.deleted&&x.id!==win.id&&x.appointmentId===val)&&!confirm('Another win is already matched to this appointment. Confirm this is a separate sale before counting both.'))return;win.appointmentId=val;win.updatedAt=iso();persist();render();scheduleSync();toast(val?'Match saved — included in confirmed totals':'Win moved to unmatched queue');}return;}
      const salesDel=e.target.closest('[data-sales-delete]');if(salesDel){const win=state.sales.find(x=>x.id===salesDel.dataset.salesDelete);if(win&&confirm('Delete this sales record?')){win.deleted=true;win.updatedAt=iso();persist();render();scheduleSync();}return;}
      const salesDays=e.target.closest('[data-sales-days]');if(salesDays){winsRange=Number(salesDays.dataset.salesDays);winSelected=null;document.querySelectorAll('[data-sales-days]').forEach(b=>b.classList.toggle('selected',b===salesDays));renderSalesChart();return;}
      const color=e.target.closest('button.accent-swatch[data-accent]');if(color){state.appearance.accent=color.dataset.accent;applyAppearance();updatePrefs();return;}
      const target=e.target.closest('[data-role],[data-page],[data-add],[data-hours-add],[data-hours-edit],[data-hours-close],[data-edit],[data-close]');
      if(!target)return;
      if(target.dataset.role)setRole(target.dataset.role);
      else if(target.hasAttribute('data-hours-add'))newHourEntry();
      else if(target.dataset.hoursEdit)newHourEntry(target.dataset.hoursEdit);
      else if(target.hasAttribute('data-hours-close'))$('hours-dialog').close();
      else if(target.hasAttribute('data-add'))newEntry();
      else if(target.dataset.edit)newEntry(target.dataset.edit);
      else if(target.hasAttribute('data-close'))$('appointment-dialog').close();
      else if(target.dataset.page)setPage(target.dataset.page);
    });
    document.addEventListener('keydown',e=>{const row=e.target.closest('tr[data-edit],tr[data-hours-edit]');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();row.dataset.hoursEdit?newHourEntry(row.dataset.hoursEdit):newEntry(row.dataset.edit);}});
    $('appointment-form').addEventListener('submit',saveEntry);
    $('hours-form').addEventListener('submit',saveHourEntry);$('hours-delete').addEventListener('click',deleteHourEntry);
    ['startedAt','endedAt','breakMinutes'].forEach(k=>$('hours-form').elements[k].addEventListener('input',updateHourPreview));
    $('timer-start').addEventListener('click',startTimer);$('timer-pause').addEventListener('click',togglePause);$('timer-stop').addEventListener('click',stopTimer);
    $('hours-search').addEventListener('input',renderHours);$('hours-range').addEventListener('change',renderHours);
    $('export-hours-csv').addEventListener('click',exportHoursCSV);
    $('save-designer-settings').addEventListener('click',saveDesignerPrefs);$('delete-entry').addEventListener('click',deleteEntry);
    ['entry-search','entry-range','entry-type'].forEach(id=>$(id).addEventListener(id==='entry-search'?'input':'change',renderAppointments));
    $('wins-analyze').addEventListener('click',analyzeWin);$('wins-save').addEventListener('click',saveWin);$('wins-date').value=today();$('wins-example').addEventListener('click',()=>{$('wins-raw').value='Jordan Example just signed the pergola contract! $28k, cash.';analyzeWin();});
    $('timer-notification-enabled').addEventListener('change',toggleTimerNotifications);
    $('timer-notification-refresh').addEventListener('click',()=>refreshTimerNotice(true));
    bindSalesUploads();
    $('enable-alerts').addEventListener('click',toggleAlerts);$('test-alert').addEventListener('click',testSystemNotification);
    $('appearance-theme').addEventListener('change',e=>{state.appearance.theme=e.target.value;applyAppearance();updatePrefs();});$('save-commission-rate').addEventListener('click',()=>{const n=Number($('sdr-commission-rate').value);if(!Number.isFinite(n)||n<0||n>100){toast('Choose a percentage from 0 to 100');return;}state.commissionRate=n;updatePrefs();toast('Estimated commission rate saved');});
    $('format-button').addEventListener('click',smartFormat);$('validate-format').addEventListener('click',validateFormat);$('formatter-note-date').value=formatterToday();$('formatter-note-date').addEventListener('change',()=>{$('formatter-note-date').dataset.userEdited='yes';});
    $('copy-format').addEventListener('click',copyResult);$('clear-format').addEventListener('click',resetFormatter);
    $('try-example').addEventListener('click',()=>{resetFormatter();$('raw-input').value=`Pergola\n\nApprox 12 x 11 hot tub area maybe 12x14\n\nSliding privacy wall\n\nAlex and Taylor Smith\n\n6264 S Sample Drive Murray Utah\n\n(801) 555-0123\n\nTimbervolt posts\n\nPrivacy wall on two sides one partial barn door sliding\n\n5:00 PM tomorrow\n\nIn-person appointment\n\nHome show\n\nOver pool partially\n\nWant large portion to have literally no cover for star gazing. Still main posts and beams just not shade planks and rafters.`;smartFormat();});
    $('save-goal').addEventListener('click',()=>{const num=Math.floor(Number($('weekly-goal').value));if(!Number.isInteger(num)||num<1||num>1000){toast('Choose a goal from 1 to 1000');return;}state.goal=num;state.goalUpdatedAt=iso();state.prefsUpdatedAt=state.goalUpdatedAt;persist();scheduleSync();render();toast('Weekly goal saved');});
    $('install-button').addEventListener('click',async()=>{if(installPrompt){const p=installPrompt;installPrompt=null;await p.prompt();return;}toast('Use your browser menu → Install app / Add to Home screen');});
    $('backup-button').addEventListener('click',exportJSON);$('csv-button').addEventListener('click',exportCSV);$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importBackup(e.target.files[0]));
    $('config-form').addEventListener('submit',setCloudConfig);$('login-form').addEventListener('submit',e=>{e.preventDefault();authAction('sign-in');});$('sign-up').addEventListener('click',()=>authAction('sign-up'));
    $('sign-out').addEventListener('click',signOut);$('sync-now').addEventListener('click',sync);$('clear-local').addEventListener('click',clearLocal);
    window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden){sync();refreshTimerNotice(true);}});
    window.setInterval(()=>{if(!document.hidden){sync();renderDashboard();renderDesigner();}},60000);
    window.setInterval(()=>{if(!document.hidden)tickTimer();},1000);
    window.setInterval(()=>{if(!document.hidden)refreshTimerNotice();},60000);
  }
  if(demoMode){$('demo-banner').classList.remove('hidden');document.body.classList.add('is-demo');}bind();bindAutoSync();initV5();renderTimerSettings();render();renderAlerts();tickTimer();if(!demoMode){registerPWA();if(timerState && timerNotifications)refreshTimerNotice(true);}try{if(localStorage.getItem('leadline-v3-role')==='designer')setRole('designer');}catch{};if(session && cloud.url && cloud.key){changeStatus('Connecting to sync…');sync();}
})();

