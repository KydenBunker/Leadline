/* Leadline v3 — two role workspaces, appointments + designer timesheets, optional Supabase sync.
   No third-party scripts, analytics, secret keys, or paid services are necessary. */
(() => {
  'use strict';
  const DATA_KEY = 'leadline-v2-data';
  const CLOUD_KEY = 'leadline-v2-cloud';
  const AUTH_KEY = 'leadline-v2-auth';
  const TIMER_KEY = 'leadline-v3-active-timer';
  const TYPES = ['Phone / video', 'In person'];
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
  let state = { records: Array.isArray(initial.records) ? initial.records : [], goal: Math.max(1, Math.min(1000, Number(initial.goal) || 25)), goalUpdatedAt: initial.goalUpdatedAt || '2020-01-01T00:00:00.000Z', hours: Array.isArray(initial.hours) ? initial.hours : [], designerPrefs: {rate: initial.designerPrefs?.rate ?? null, threshold: initial.designerPrefs?.threshold ?? 40, multiplier: initial.designerPrefs?.multiplier ?? 1.5}, prefsUpdatedAt: initial.prefsUpdatedAt || '2020-01-01T00:00:00.000Z' };
  let cloud = loadJSON(CLOUD_KEY, {url:'', key:''});
  let session = loadJSON(AUTH_KEY, null);
  let activePage = 'dashboard';
  let activeRole = 'sdr';
  let timerState = loadJSON(TIMER_KEY, null);
  let syncBusy = false, queuedSync = false, syncTimer, toastTimer, installPrompt = null, lastSync = null;

  function normalized(entry) {
    return { id: safe(entry.id) || makeUUID(), dateSet: /^\d{4}-\d{2}-\d{2}$/.test(safe(entry.dateSet)) ? entry.dateSet : today(), meetingType: TYPES.includes(entry.meetingType) ? entry.meetingType : TYPES[0], projectType: safe(entry.projectType).slice(0,80), source: safe(entry.source).slice(0,80), label: safe(entry.label).slice(0,150), notes: safe(entry.notes).slice(0,3000), createdAt: safe(entry.createdAt) || iso(), updatedAt: safe(entry.updatedAt) || iso(), deleted: !!entry.deleted };
  }
  state.records = state.records.filter(x=>x && typeof x==='object').map(normalized);
  const validDt = v => Number.isFinite(Date.parse(v));
  function normalizedHour(x){return {id: safe(x.id) || makeUUID(), project:safe(x.project).slice(0,100), task:safe(x.task).slice(0,70)||'Other', startedAt:safe(x.startedAt), endedAt:safe(x.endedAt), breakMinutes: Math.max(0,Math.min(1440,Math.round(Number(x.breakMinutes)||0))), notes:safe(x.notes).slice(0,1000), createdAt:safe(x.createdAt)||iso(), updatedAt:safe(x.updatedAt)||iso(), deleted:!!x.deleted};}
  state.hours=state.hours.filter(x=>x && typeof x==='object').map(normalizedHour).filter(x=>x.deleted || (validDt(x.startedAt)&&validDt(x.endedAt)&&Date.parse(x.endedAt)>Date.parse(x.startedAt)));
  function liveHours(){return state.hours.filter(x=>!x.deleted && validDt(x.startedAt) && validDt(x.endedAt));}
  function persist() { try {localStorage.setItem(DATA_KEY, JSON.stringify(state));return true;}catch{alert('Could not save locally. Check browser storage and export a backup.');return false;} }
  function saveCloud() {localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud));}
  function saveSession() {if(session)localStorage.setItem(AUTH_KEY, JSON.stringify(session));else localStorage.removeItem(AUTH_KEY);}
  function live() {return state.records.filter(x=>!x.deleted);}
  function selected(range, d) { return range==='all'||range==='today'&&d===today()||range==='week'&&d>=startWeek()&&d<=today()||range==='month'&&d.slice(0,7)===thisMonth(); }
  const count = (range) => live().filter(x=>selected(range, x.dateSet)).length;
  function toast(msg) {const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);}
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
    if(!['dashboard','appointments','formatter','designer','hours','settings'].includes(p)) return;
    if(['designer','hours'].includes(p)&&activeRole!=='designer'){setRole('designer');if(p==='designer')return;}
    if(['dashboard','appointments','formatter'].includes(p)&&activeRole!=='sdr'){setRole('sdr');if(p==='dashboard')return;}
    activePage=p;
    document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!==`page-${p}`));
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===p));
    $('location-title').textContent=({dashboard:'Dashboard',appointments:'Appointments',formatter:'Formatter',designer:'Designer overview',hours:'Time entries',settings:'Settings & sync'})[p];
    window.scrollTo(0,0);
  }
  function renderDashboard() {
    $('stat-today').textContent=count('today');$('stat-week').textContent=count('week');$('stat-month').textContent=count('month');$('stat-total').textContent=count('all');
    $('date-today').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    const dates=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(6-i));return localYMD(d);});
    const nums=dates.map(d=>live().filter(x=>x.dateSet===d).length);const tallest=Math.max(1,...nums);
    $('seven-total').textContent=`${nums.reduce((a,b)=>a+b,0)} total`;
    $('weekly-chart').setAttribute('aria-label',dates.map((d,i)=>`${weekday(d)}: ${nums[i]}`).join('; '));
    $('weekly-chart').innerHTML=dates.map((d,i)=>`<div class="bar-col"><span class="bar-value">${nums[i]}</span><div class="bar-wrap"><div class="bar-fill ${d===today()?'bar-current':''}" style="height:${Math.max(4,Math.round(nums[i]/tallest*100))}%"></div></div><span class="bar-day">${weekday(d)}</span></div>`).join('');
    const week = count('week'), goal = state.goal;
    $('goal-progress').textContent=week;$('goal-target').textContent=`/ ${goal} appointments`;$('goal-bar').style.width=`${Math.min(100,Math.round(week/goal*100))}%`;
    $('goal-message').textContent=week>=goal ? `Goal reached! ${week-goal} above target.` : `${goal-week} more to hit your weekly goal.`;
    const bySource = SOURCES.map(src=>({name:src,count:live().filter(x=>x.source===src).length})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
    const unspec = live().filter(x=>!SOURCES.includes(x.source)).length;if(unspec)bySource.push({name:'Not specified',count:unspec});
    const max=Math.max(1,...bySource.map(x=>x.count));
    $('source-breakdown').innerHTML=bySource.length ? bySource.map(x=>`<div class="source-row"><div><span>${h(x.name)}</span><b>${x.count}</b></div><div class="source-track"><span style="width:${(x.count/max*100).toFixed(2)}%"></span></div></div>`).join('') : '<div class="quiet-empty">Your lead-source breakdown appears here as you log appointments.</div>';
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
    $('sidebar-sync-label').textContent=loggedIn?syncBusy?'Syncing…':lastSync?'Cloud connected':'Cloud sync ready':'Saved on this device';
    $('sidebar-sync-light').classList.toggle('is-cloud',loggedIn);
    $('sync-chip').textContent=loggedIn?syncBusy?'◌ Syncing…':lastSync?'● Cloud synced':'● Cloud enabled':'● Offline-ready';
    $('weekly-goal').value=state.goal;
    if(document.activeElement?.id!=='designer-rate') $('designer-rate').value=state.designerPrefs.rate ?? '';
    if(document.activeElement?.id!=='designer-threshold') $('designer-threshold').value=state.designerPrefs.threshold;
    if(document.activeElement?.id!=='designer-multiplier') $('designer-multiplier').value=state.designerPrefs.multiplier;
  }
  function render() {renderDashboard();renderAppointments();renderDesigner();renderHours();renderSyncUi();}
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
  function parseRaw(raw) {
    const text=safe(raw);if(!text)return '';
    const rows=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const used=new Set();
    const get = labels => {const regex = new RegExp(`^(?:${labels})\\s*[:=\\-]\\s*(.*)$`,'i');for(let i=0;i<rows.length;i++){const m=rows[i].match(regex);if(m?.[1]){used.add(i);return safe(m[1]);}}return '';};
    const name=get('name|full name|contact name|customer|client');
    const phone=get('phone|cell|mobile|telephone|tel')||(text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)||[])[0]||'';
    const email=get('email|e-mail')||(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)||[])[0]||'';
    const project=get('project|project type|structure|interested in|type')||(['Pavilion','Pergola','Gazebo','Deck','Timber trusses'].find(t=>new RegExp(t==='Timber trusses'?'trusses?':t,'i').test(text))||'');
    const size=get('size|dimensions|project size')||((text.match(/\b\d{1,3}\s*(?:ft|feet|['′])?\s*(?:x|×|by)\s*\d{1,3}\s*(?:ft|feet|['′])?/i)||[])[0]||'');
    const location=get('city|location|address|city\/state|state');
    const timeline=get('timeline|time frame|timeframe|when|start date');
    const source=get('source|lead source|origin');
    let notes=get('notes|message|description|details|comments');
    const leftovers=rows.filter((line,i)=>!used.has(i) && line!==phone && line!==email && !/^\s*(?:new lead|submission|request)\s*$/i.test(line)).filter(line=>{
      if(line.includes(phone) && phone) return false;
      if(line.includes(email) && email) return false;
      return true;
    });
    if(leftovers.length)notes=[notes,...leftovers].filter(Boolean).join('\n');
    const data=[['Name',name],['Phone',phone],['Email',email],['Project',project],['Size',size],['Location',location],['Timeline',timeline],['Source',source],['Notes',notes]];
    return data.filter(([k,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n');
  }
  async function copyResult() {
    const t=$('format-output').value;if(!safe(t)){toast('Format something first');return;}
    try {await navigator.clipboard.writeText(t);toast('Copied to clipboard');}
    catch { $('format-output').focus();$('format-output').select();toast('Select the text and use Copy'); }
  }
  function exportText(filename, text, mime) {
    const blob=new Blob([text],{type:mime}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function exportJSON() {exportText(`leadline-full-backup-${today()}.json`,JSON.stringify({app:'Leadline',version:3,exportedAt:iso(),...state},null,2),'application/json');toast('Both workspaces backed up');}
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
  function exportCSV(){const headers=['dateSet','meetingType','projectType','source','label','notes','id','createdAt','updatedAt'];const rows=live().map(x=>headers.map(k=>csvCell(x[k])).join(','));exportText(`leadline-appointments-${today()}.csv`,'\uFEFF'+[headers.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');toast('CSV downloaded');}
  function csvRows(text){const result=[];let row=[],word='',quote=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){word+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(word);word='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(word);if(row.some(x=>x.trim()))result.push(row);row=[];word='';}else word+=c;}row.push(word);if(row.some(x=>x.trim()))result.push(row);return result;}
  async function importBackup(file){
    if(!file)return;
    if(file.size>8*1024*1024){alert('File is too large (8 MB max).');return;}
    try {
      const text=await file.text();let records=[], restoredGoal=null, restoredHours=[], restoredPrefs=null, isNewBackup=false;
      if(file.name.toLowerCase().endsWith('.json')) {
        const parsed=JSON.parse(text);if(Array.isArray(parsed.records)){records=parsed.records.map(normalized);restoredGoal=parsed.goal;restoredHours=Array.isArray(parsed.hours)?parsed.hours.map(normalizedHour).filter(x=>x.deleted||(validDt(x.startedAt)&&validDt(x.endedAt)&&Date.parse(x.endedAt)>Date.parse(x.startedAt))):[];restoredPrefs=parsed.designerPrefs||null;isNewBackup=true;}
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
      if(!records.length&&!restoredHours.length)throw Error('No records to import.');
      if(!confirm(`Import ${records.filter(x=>!x.deleted).length} appointments and ${restoredHours.filter(x=>!x.deleted).length} time entries? Existing matching IDs are updated when the imported copy is newer.`))return;
      for(const entry of records){const i=state.records.findIndex(x=>x.id===entry.id);if(i<0)state.records.push(entry);else if(entry.updatedAt>state.records[i].updatedAt)state.records[i]=entry;}
      for(const entry of restoredHours){const i=state.hours.findIndex(x=>x.id===entry.id);if(i<0)state.hours.push(entry);else if(entry.updatedAt>state.hours[i].updatedAt)state.hours[i]=entry;}
      if(isNewBackup && confirm('Restore goals and designer pay settings from this backup too?')){if(restoredGoal>=1&&restoredGoal<=1000){state.goal=Math.floor(restoredGoal);state.goalUpdatedAt=iso();}if(restoredPrefs){state.designerPrefs={...state.designerPrefs,...restoredPrefs};state.prefsUpdatedAt=iso();}}
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
      await api('/rest/v1/leadline_preferences?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{user_id:session.user_id,payload:{designerPrefs:state.designerPrefs,goal:state.goal},updated_at:state.prefsUpdatedAt}])});
    } else if(Date.parse(r.updated_at)>localTime){
      const prefs=r.payload||{};
      const rate=prefs.designerPrefs?.rate;const th=Number(prefs.designerPrefs?.threshold);const mul=Number(prefs.designerPrefs?.multiplier);
      state.designerPrefs={rate:(rate===null||rate===''||!Number.isFinite(Number(rate)))?null:Math.max(0,Number(rate)),threshold:th>=1&&th<=168?th:40,multiplier:mul>=1&&mul<=5?mul:1.5};
      if(Number.isFinite(Number(prefs.goal))&&Number(prefs.goal)>=1&&Number(prefs.goal)<=1000)state.goal=Math.floor(Number(prefs.goal));
      state.prefsUpdatedAt=r.updated_at;
    }
  }
  async function sync(){
    if(!session?.access_token||!cloud.url||!cloud.key)return;
    if(syncBusy){queuedSync=true;return;}
    syncBusy=true;renderSyncUi();
    try {
      if(!await refreshSession())return;
      await syncCollection('leadline_appointments',state.records,normalized);
      await syncCollection('leadline_hours',state.hours,normalizedHour);
      await syncPrefs();
      persist();lastSync=new Date();changeStatus(`Synced both workspaces at ${lastSync.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}.`, 'ok');render();
    }catch(e){changeStatus('Sync not completed: '+e.message,'error');$('cloud-status').textContent='Needs sync';$('sync-chip').textContent='● Saved locally';}
    finally{syncBusy=false;renderSyncUi();if(queuedSync){queuedSync=false;setTimeout(sync,300);}}
  }
  function scheduleSync(){if(!session?.access_token)return;clearTimeout(syncTimer);syncTimer=setTimeout(sync,1200);}
  async function signOut(){
    if(!confirm('Sign out of cloud sync? Appointments remain on this device until you clear them.'))return;
    session=null;saveSession();lastSync=null;renderSyncUi();changeStatus('Signed out. Data remains saved on this device.');
  }
  function clearLocal(){
    if(!confirm('Clear all appointments, hours, and the active timer from THIS device? This does not delete cloud records. Download a backup first.'))return;
    state.records=[];state.hours=[];timerState=null;localStorage.removeItem(TIMER_KEY);persist();render();tickTimer();toast('Local data cleared.');
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
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(6-i));return localYMD(d);});
    const nums=days.map(day=>(n.days.get(day)||0)/3600000);const max=Math.max(1,...nums);
    $('designer-seven-total').textContent=fmtHours(nums.reduce((a,b)=>a+b,0))+' total';
    $('designer-weekly-chart').setAttribute('aria-label',days.map((d,i)=>`${weekday(d)} ${nums[i].toFixed(2)} hours`).join('; '));
    $('designer-weekly-chart').innerHTML=days.map((day,i)=>`<div class="bar-col"><span class="bar-value">${nums[i]?nums[i].toFixed(1):'0'}</span><div class="bar-wrap"><div class="bar-fill ${day===today()?'bar-current':''}" style="height:${Math.max(4,Math.round(nums[i]/max*100))}%"></div></div><span class="bar-day">${weekday(day)}</span></div>`).join('');
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
  function saveTimer(){try{if(timerState)localStorage.setItem(TIMER_KEY,JSON.stringify(timerState));else localStorage.removeItem(TIMER_KEY);}catch{toast('Could not save timer on this device');}}
  function startTimer(){
    if(timerState)return;
    const project=safe($('timer-project').value),task=safe($('timer-task').value);
    if(!project){$('timer-project').focus();toast('Enter a project label before starting');return;}
    timerState={startAt:iso(),project,task,breakMs:0,pausedAt:null};saveTimer();tickTimer();toast('Clock started');
  }
  function togglePause(){
    if(!timerState)return;
    if(timerState.pausedAt){timerState.breakMs+=Math.max(0,Date.now()-Date.parse(timerState.pausedAt));timerState.pausedAt=null;toast('Back on the clock');}
    else{timerState.pausedAt=iso();toast('Break started');}
    saveTimer();tickTimer();
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
    timerState=null;saveTimer();patchHour(entry);tickTimer();toast('Session saved to Project Designer');
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
  }

  function bind(){
    document.addEventListener('click',e=>{
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
    $('format-button').addEventListener('click',()=>{const formatted=parseRaw($('raw-input').value);if(!formatted){toast('Paste some lead details first');return;}$('format-output').value=formatted;toast('Lead formatted — review the result');});
    $('copy-format').addEventListener('click',copyResult);$('clear-format').addEventListener('click',()=>{$('raw-input').value='';$('format-output').value='';});
    $('save-goal').addEventListener('click',()=>{const num=Math.floor(Number($('weekly-goal').value));if(!Number.isInteger(num)||num<1||num>1000){toast('Choose a goal from 1 to 1000');return;}state.goal=num;state.goalUpdatedAt=iso();state.prefsUpdatedAt=state.goalUpdatedAt;persist();scheduleSync();render();toast('Weekly goal saved');});
    $('install-button').addEventListener('click',async()=>{if(installPrompt){const p=installPrompt;installPrompt=null;await p.prompt();return;}toast('Use your browser menu → Install app / Add to Home screen');});
    $('backup-button').addEventListener('click',exportJSON);$('csv-button').addEventListener('click',exportCSV);$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importBackup(e.target.files[0]));
    $('config-form').addEventListener('submit',setCloudConfig);$('login-form').addEventListener('submit',e=>{e.preventDefault();authAction('sign-in');});$('sign-up').addEventListener('click',()=>authAction('sign-up'));
    $('sign-out').addEventListener('click',signOut);$('sync-now').addEventListener('click',sync);$('clear-local').addEventListener('click',clearLocal);
    window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    window.setInterval(()=>{if(!document.hidden){sync();renderDashboard();renderDesigner();}},60000);
    window.setInterval(()=>{if(!document.hidden)tickTimer();},1000);
  }
  bind();render();tickTimer();registerPWA();try{if(localStorage.getItem('leadline-v3-role')==='designer')setRole('designer');}catch{};if(session && cloud.url && cloud.key){changeStatus('Connecting to sync…');sync();}
})();
