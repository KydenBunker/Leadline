
/* Leadline V4.7 — offline appointment card formatter + bridge-rule validator.
   Grounded in Western Timber Frame SDR Guide v2 (October 14, 2026).
   This is a local heuristic assistant, NOT generative AI and NOT a booking service.
   All outputs must be reviewed by an SDR. */
(function(root){
'use strict';
const DIV='━━━━━━━━━━━━━━━━━━━━━━━━━━';
const DESIGNERS=['Tyrel','Parley','Brighton','Landon','Carter','Chase','Scott','Dave'];
const PERSON_RE=/\b(?:Tyrel|Parley|Brighton|Landon|Carter|Chase|Scott|Dave|Mike|Bronson|Allred|Sutton|Jenson)\b/i;
const VIRTUAL_RE=/\b(?:virtual|zoom|google meet|video call|phone call)\b/i;
const MISSING='[MISSING — VERIFY BEFORE POSTING]';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const title=v=>clean(v).toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()).replace(/\bAnd\b/g,'&');
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
// Appointment dates are understood relative to the current Utah calendar day, not build day.
const utahToday=()=>{const pts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>pts.find(v=>v.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;};
const dateFrom=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))s=utahToday();const [y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d,12);return x.getFullYear()===y&&x.getMonth()+1===m&&x.getDate()===d?x:dateFrom(utahToday());};
const prettyDate=d=>d.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
const utcDate=(y,m,d)=>new Date(Date.UTC(y,m-1,d,12));
const toUTCDate=d=>utcDate(d.getFullYear(),d.getMonth()+1,d.getDate());
const stateMap={utah:'UT',idaho:'ID',arizona:'AZ',colorado:'CO',montana:'MT',wyoming:'WY',california:'CA',nevada:'NV',washington:'WA',oregon:'OR',texas:'TX',florida:'FL'};
const unique=a=>[...new Set(a)];

const TZ_LABEL={
 'America/New_York':'Eastern','America/Chicago':'Central','America/Denver':'Mountain','America/Los_Angeles':'Pacific',
 'America/Phoenix':'Arizona (no DST)','Pacific/Honolulu':'Hawaii','America/Anchorage':'Alaska',
 'America/Adak':'Aleutian','America/Boise':'Mountain (Idaho)'};
const ZONES={
 AL:'America/Chicago',AK:null,AZ:'America/Phoenix',AR:'America/Chicago',CA:'America/Los_Angeles',CO:'America/Denver',CT:'America/New_York',DE:'America/New_York',FL:null,GA:'America/New_York',HI:'Pacific/Honolulu',ID:null,IL:'America/Chicago',IN:null,IA:'America/Chicago',KS:null,KY:null,LA:'America/Chicago',ME:'America/New_York',MD:'America/New_York',MA:'America/New_York',MI:null,MN:'America/Chicago',MS:'America/Chicago',MO:'America/Chicago',MT:'America/Denver',NE:null,NV:'America/Los_Angeles',NH:'America/New_York',NJ:'America/New_York',NM:'America/Denver',NY:'America/New_York',NC:'America/New_York',ND:null,OH:'America/New_York',OK:'America/Chicago',OR:null,PA:'America/New_York',RI:'America/New_York',SC:'America/New_York',SD:null,TN:null,TX:null,UT:'America/Denver',VT:'America/New_York',VA:'America/New_York',WA:'America/Los_Angeles',WV:'America/New_York',WI:'America/Chicago',WY:'America/Denver',DC:'America/New_York'};
const STATES={alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY','district of columbia':'DC'};
// Split-state cities are illustrative, not a complete city/ZIP lookup. Unknown city => user must choose zone.
const SPLIT_CITIES={
 KY:[['America/New_York',/\b(?:louisville|lexington|frankfort|richmond|covington|newport|ashland|florence|danville|somerset|winchester|georgetown)\b/i],['America/Chicago',/\b(?:bowling green|paducah|owensboro|hopkinsville|henderson|elizabethtown|murray|mayfield|madisonville|russellville)\b/i]],
 FL:[['America/Chicago',/\b(?:pensacola|panama city|destin|fort walton|crestview|niceville|marianna)\b/i],['America/New_York',/\b(?:miami|orlando|tampa|jacksonville|tallahassee|gainesville|fort lauderdale|west palm beach|sarasota|naples)\b/i]],
 TN:[['America/New_York',/\b(?:knoxville|chattanooga|johnson city|bristol|kingsport|cleveland)\b/i],['America/Chicago',/\b(?:nashville|memphis|clarksville|murfreesboro|franklin|jackson|columbia)\b/i]],
 ID:[['America/Denver',/\b(?:boise|idaho falls|twin falls|pocatello|nampa|meridian|rexburg)\b/i],['America/Los_Angeles',/\b(?:coeur d'alene|lewiston|moscow|post falls|sandpoint)\b/i]],
 TX:[['America/Denver',/\b(?:el paso|hudspeth)\b/i],['America/Chicago',/\b(?:dallas|houston|austin|san antonio|fort worth|waco|lubbock|amarillo|corpus christi)\b/i]],
 OR:[['America/Denver',/\b(?:ontario|vale|nyssa)\b/i],['America/Los_Angeles',/\b(?:portland|eugene|salem|bend|medford|ashland|beaverton)\b/i]],
 IN:[['America/Chicago',/\b(?:gary|hammond|east chicago|valparaiso|evansville|vincennes|jasper)\b/i],['America/New_York',/\b(?:indianapolis|fort wayne|bloomington|lafayette|carmel|fishers|south bend)\b/i]],
 NE:[['America/Denver',/\b(?:scottsbluff|sidney|chadron|alliance)\b/i],['America/Chicago',/\b(?:omaha|lincoln|grand island|kearney|norfolk|fremont)\b/i]],
 KS:[['America/Denver',/\b(?:goodland|colby|tribune)\b/i],['America/Chicago',/\b(?:wichita|topeka|overland park|olathe|lawrence|kansas city)\b/i]],
 ND:[['America/Denver',/\b(?:dickinson|medora|beach|bowman)\b/i],['America/Chicago',/\b(?:fargo|bismarck|grand forks|minot)\b/i]],
 SD:[['America/Denver',/\b(?:rapid city|spearfish|deadwood|sturgis)\b/i],['America/Chicago',/\b(?:sioux falls|aberdeen|brookings|watertown|mitchell)\b/i]],
 MI:[['America/Chicago',/\b(?:iron mountain|menominee|ironwood|esc[a-z]*naba)\b/i],['America/New_York',/\b(?:detroit|grand rapids|lansing|ann arbor|flint|kalamazoo|traverse city)\b/i]],
 AK:[['America/Adak',/\b(?:adak|atka)\b/i],['America/Anchorage',/\b(?:anchorage|fairbanks|juneau|wasilla|kenai|homer)\b/i]]
};
// High-confidence US city clues usable even if a state was not explicitly typed.
// Only recognize city-only/address lines, not incidental mentions in a project description.
const CITY_ZONES=[
 ['Indianapolis','IN','America/New_York'],['Fort Wayne','IN','America/New_York'],
 ['Louisville','KY','America/New_York'],['Lexington','KY','America/New_York'],['Paducah','KY','America/Chicago'],
 ['New Orleans','LA','America/Chicago'],['Baton Rouge','LA','America/Chicago'],
 ['Salt Lake City','UT','America/Denver'],['Provo','UT','America/Denver'],['Orem','UT','America/Denver'],['Ogden','UT','America/Denver'],
 ['Denver','CO','America/Denver'],['Colorado Springs','CO','America/Denver'],
 ['Phoenix','AZ','America/Phoenix'],['Tucson','AZ','America/Phoenix'],
 ['Chicago','IL','America/Chicago'],['Dallas','TX','America/Chicago'],['Houston','TX','America/Chicago'],['Austin','TX','America/Chicago'],['San Antonio','TX','America/Chicago'],['El Paso','TX','America/Denver'],
 ['Los Angeles','CA','America/Los_Angeles'],['Sacramento','CA','America/Los_Angeles'],['San Francisco','CA','America/Los_Angeles'],['San Diego','CA','America/Los_Angeles'],
 ['Seattle','WA','America/Los_Angeles'],['Spokane','WA','America/Los_Angeles'],['Boise','ID','America/Denver'],
 ['Las Vegas','NV','America/Los_Angeles'],['Nashville','TN','America/Chicago'],['Memphis','TN','America/Chicago'],['Knoxville','TN','America/New_York'],
 ['Atlanta','GA','America/New_York'],['Miami','FL','America/New_York'],['Orlando','FL','America/New_York'],['Tampa','FL','America/New_York'],['Pensacola','FL','America/Chicago'],
 ['Philadelphia','PA','America/New_York'],['New York City','NY','America/New_York'],['Brooklyn','NY','America/New_York'],['Boston','MA','America/New_York'],
 ['Minneapolis','MN','America/Chicago'],['St Paul','MN','America/Chicago'],['Detroit','MI','America/New_York'],['Oklahoma City','OK','America/Chicago'],
 ['Raleigh','NC','America/New_York'],['Charlotte','NC','America/New_York'],['Baltimore','MD','America/New_York'],['Washington DC','DC','America/New_York']
];
function cityFromNotes(lines){
 for(const original of lines){
  const t=original.trim().replace(/^(?:location|city|town|address|project location)\s*[:=]\s*/i,'').replace(/(?:,?\s+(?:US|USA|United States))$/i,'').trim();
  for(const [name,state,zone] of CITY_ZONES){
   const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   // A bare city, City ST, City State, or City ZIP on an otherwise location-only line.
   const re=new RegExp('^'+escaped+'(?:[, ]+(?:'+state+'|'+Object.keys(STATES).find(k=>STATES[k]===state)+'|\\d{5}))?(?:[, ]+\\d{5})?$', 'i');
   if(re.test(t))return {name,state,zone};
  }
 }
 return null;
}
const TZ_ABBR={EST:'America/New_York',EDT:'America/New_York',ET:'America/New_York',CST:'America/Chicago',CDT:'America/Chicago',CT:'America/Chicago',MST:'America/Denver',MDT:'America/Denver',MT:'America/Denver',PST:'America/Los_Angeles',PDT:'America/Los_Angeles',PT:'America/Los_Angeles',AKST:'America/Anchorage',AKDT:'America/Anchorage',HST:'Pacific/Honolulu'};
function zoneFromNotes(lines,override){
 const qs=[];const all=lines.join(' ');
 // Search for a full state name first; two-letter codes only on a location/state line.
 let state=null,place='';
 for(const line of lines){
   const p=line.toLowerCase();
   for(const [name,code] of Object.entries(STATES).sort((a,b)=>b[0].length-a[0].length)){
     if(new RegExp('\\b'+name+'\\b','i').test(p)){state=code;place=line;break;}
   }
   if(state)break;
   const m=line.match(/(?:^|[,\s])([A-Z]{2})(?:\s+\d{5})?\s*$/);
   if(m&&ZONES.hasOwnProperty(m[1])){state=m[1];place=line;break;}
 }
 const explicit=all.match(/\b(?:EST|EDT|ET|CST|CDT|CT|MST|MDT|MT|PST|PDT|PT|AKST|AKDT|HST)\b/i);
 // Treat regional abbreviations as geographic zones with daylight saving; 'CST' in October may mean CDT.
 const explicitZone=explicit?TZ_ABBR[explicit[0].toUpperCase()]:null;
 let locationZone=null;
 if(state){locationZone=ZONES[state]||null;if(!locationZone){const hits=(SPLIT_CITIES[state]||[]).filter(([zone,re])=>re.test(place)||re.test(all));if(hits.length===1)locationZone=hits[0][0];if(hits.length!==1&&!explicitZone&&!(override&&TZ_LABEL[override]))qs.push(`${state} has multiple time zones. Add the customer's city or select their time zone before posting.`);}}
 const city=cityFromNotes(lines);
 if(!state&&city){state=city.state;locationZone=city.zone;}
 // Verified local ZIP hints for examples; unknown ZIP codes never get guessed.
 const knownZips={'34689':['FL','America/New_York'],'46229':['IN','America/New_York']};
 if(!locationZone&&!state){
   const zip=lines.map(line=>line.match(/^(?:address|location|zip(?: code)?|postal code)?\s*[:=]?\s*(\d{5})(?:-\d{4})?\s*$/i)).find(Boolean);
   if(zip&&knownZips[zip[1]]){state=knownZips[zip[1]][0];locationZone=knownZips[zip[1]][1];qs.push(`Time zone inferred from ZIP ${zip[1]}; confirm the location.`);}
 }
 const chosen=override&&override!=='auto'?override:null;
 if(chosen&&!TZ_LABEL[chosen])qs.push('Unknown selected customer time zone. Choose one of the listed options.');
 if(explicitZone&&locationZone&&explicitZone!==locationZone)qs.push(`Notes say ${explicit[0].toUpperCase()} (${TZ_LABEL[explicitZone]}), but the customer location indicates ${TZ_LABEL[locationZone]}; verify which was intended.`);
 if(chosen&&explicitZone&&chosen!==explicitZone)qs.push('Manual time zone conflicts with the abbreviation in notes; manually selected time zone used. Verify.');
 if(chosen&&locationZone&&chosen!==locationZone)qs.push('Manual time zone conflicts with the customer location; manually selected time zone used. Verify.');
 if(explicit&&/[SCMPE]ST/i.test(explicit[0])&&['America/New_York','America/Chicago','America/Denver','America/Los_Angeles'].includes(explicitZone))qs.push(`Interpreting ${explicit[0].toUpperCase()} as the regional time zone (with daylight-saving changes), not a fixed UTC offset. Confirm if needed.`);
 const zone=(chosen&&TZ_LABEL[chosen]?chosen:null)||explicitZone||locationZone;
 if(!zone)qs.push('Customer time zone not identified; add a state/city or select it manually. Utah appointment time cannot be calculated yet.');
 return {zone,locationZone,explicitZone,locationState:state,issues:qs,source:chosen?'selected':explicitZone?'notes abbreviation':locationZone?'location':'unknown'};
}
function zoneParts(date,zone){
 const entries=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const byType=k=>+entries.find(x=>x.type===k).value;return {y:byType('year'),m:byType('month'),d:byType('day'),h:byType('hour'),min:byType('minute')};
}
function utcFromWall(ymd,hour,minute,zone){
 const [y,m,d]=ymd.split('-').map(Number),desired=Date.UTC(y,m-1,d,hour,minute);
 let guess=desired;
 for(let i=0;i<4;i++){
  const p=zoneParts(new Date(guess),zone),seen=Date.UTC(p.y,p.m-1,p.d,p.h,p.min),delta=desired-seen;
  guess+=delta;if(delta===0)break;
 }
 const got=zoneParts(new Date(guess),zone);
 if(got.y!==y||got.m!==m||got.d!==d||got.h!==hour||got.min!==minute)return null; // nonexistent DST gap
 return new Date(guess);
}
function timeAndDateInZone(instant,zone){
 return {date:new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(instant),time:new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:true}).format(instant),abbr:new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'short'}).formatToParts(instant).find(x=>x.type==='timeZoneName')?.value||TZ_LABEL[zone]};
}

const knownSource=/^(?:home show|trade show|website|website form|instagram|facebook|referral|showroom|walk[- ]?in|phone call|google ads?|home and garden show)$/i;
function normalizeAddress(s){let r=title(s).replace(/\s*,\s*/g,', ');for(const [nm,abbr] of Object.entries(stateMap))r=r.replace(new RegExp('\\b'+nm+'\\b','gi'),abbr);r=r.replace(/\b(Ut|Id|Az|Co|Mt|Wy|Ca|Nv|Wa|Or|Tx|Fl)\b/g,v=>v.toUpperCase());r=r.replace(/\b(Drive|Street|Road|Lane|Way|Avenue|Boulevard|Court|Circle|Dr|St|Rd|Ln|Ave|Blvd|Ct)\s+([A-Z][a-z'-]+)\s+(UT|ID|AZ|CO|MT|WY|CA|NV|WA|OR|TX|FL)\b/,'$1, $2, $3');r=r.replace(/\s+(UT|ID|AZ|CO|MT|WY|CA|NV|WA|OR|TX|FL)(\s+\d{5})?$/,(str,state,zip)=>`, ${state}${zip||''}`);r=r.replace(/,\s*,/g,',');return r;}
function extract(raw){
 const lines=String(raw||'').replace(/\r/g,'').split('\n').map(x=>x.trim().replace(/^[*•-]\s+/,'' )).filter(Boolean);
 const fields={}, used=new Set(), joined=lines.join(' ');
 function named(key,re){for(let i=0;i<lines.length;i++){const m=lines[i].match(re);if(m){fields[key]=clean(m[1]);used.add(i);return;}}}
 named('name',/^(?:name|customer(?: name)?|client(?: name)?|contact(?: name)?)\s*[:=]\s*(.+)$/i);
 named('phone',/^(?:phone|mobile|cell|contact number)\s*[:=]\s*(.+)$/i);
 named('email',/^(?:email|e-mail)\s*[:=]\s*(.+)$/i);
 named('location',/^(?:location|address|project address|site)\s*[:=]\s*(.+)$/i);
 named('project',/^(?:project|project type|structure|structure type)\s*[:=]\s*(.+)$/i);
 named('source',/^(?:source|lead source|came from)\s*[:=]\s*(.+)$/i);
 named('meeting',/^(?:meeting type|appointment type)\s*[:=]\s*(.+)$/i);
 const phoneMatch=joined.match(/(?<!\d)(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/);
 if(!fields.phone&&phoneMatch){fields.phone=phoneMatch[0];lines.forEach((l,i)=>{if(l.replace(/\D/g,'')===fields.phone.replace(/\D/g,''))used.add(i);});}
 const mailMatch=joined.match(/\b[A-Z\d._%+-]+@[A-Z\d.-]+\.[A-Z]{2,}\b/i);
 if(!fields.email&&mailMatch){fields.email=mailMatch[0];lines.forEach((l,i)=>{if(l===mailMatch[0])used.add(i);});}
 if(!fields.name){for(let i=0;i<lines.length;i++){const l=lines[i];if(used.has(i))continue;
  if(!Object.keys(STATES).some(state=>new RegExp('\\b'+state+'$','i').test(l))&& (/^[A-Z][a-z'’-]+\s+(?:and|&)\s+[A-Z][a-z'’-]+\s+[A-Za-z][a-z'’-]+$/.test(l)||(/^[A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+$/.test(l)&&!knownSource.test(l)&&!/^timbervolt posts$/i.test(l)&&!/^privacy wall/i.test(l)))){fields.name=title(l);used.add(i);break;}
 }}
 if(!fields.location){for(let i=0;i<lines.length;i++){const l=lines[i];if(used.has(i))continue;if(/^\d{1,6}\s+\S.+\b(?:utah|idaho|arizona|colorado|montana|wyoming|california|nevada|washington|oregon|texas|florida|UT|ID|AZ|CO|MT|WY|CA|NV|WA|OR|TX|FL)(?:\s+\d{5})?\s*$/i.test(l)){fields.location=l;used.add(i);break;}}}
 if(fields.location)fields.location=normalizeAddress(fields.location);
 // A state or city/state can locate a virtual customer without a street address.
 if(!fields.location){for(let i=0;i<lines.length;i++){
   if(used.has(i))continue;
   const l=lines[i],lo=l.toLowerCase();
   if(STATES[lo]||/^location\s*:/i.test(l)){
     fields.location=l.replace(/^location\s*:\s*/i,'');used.add(i);break;
   }
   // Recognize a city + state (without street) as useful virtual meeting geography.
   for(const name of Object.keys(STATES).sort((a,b)=>b.length-a.length)){
     if(new RegExp(`^(?:[A-Za-z.\\s-]+\\s+){1,3}${name}$`,'i').test(l)&&!/^\s*(?:customer|wants|building|working|project|material|referred)\b/i.test(l)){
       fields.location=title(l);used.add(i);break;
     }
   }
   if(fields.location)break;
   if(/^(?:[A-Za-z'’-]+\s+){1,3}[A-Z]{2}$/.test(l)&&Object.keys(ZONES).includes(l.split(' ').at(-1))){
     fields.location=l;used.add(i);break;
   }
 }}
 // For virtual leads, a city plus a ZIP-only address is more helpful than LOCATION: 46229.
 const cityClue=cityFromNotes(lines);
 if(cityClue){
   const bareLoc=clean(fields.location||'');
   const zip=bareLoc.match(/^(\d{5})(?:\s*(?:US|USA))?$/i);
   if(zip){fields.location=`${cityClue.name}, ${cityClue.state} ${zip[1]}`;}
   else if(!fields.location){fields.location=`${cityClue.name}, ${cityClue.state}`;}
   lines.forEach((line,i)=>{if(line.trim().toLowerCase()===cityClue.name.toLowerCase())used.add(i);});
 }
 if(fields.name)fields.name=title(fields.name);
 if(!fields.project){const m=joined.match(/\b(pergola|pavilion|gazebo|deck|timber truss(?:es)?|carport|arbor|cabin|barn|shop)\b/i);if(m){fields.project=title(m[1]);lines.forEach((l,i)=>{if(l.toLowerCase()===m[0].toLowerCase())used.add(i);});}}
 if(!fields.source){for(let i=0;i<lines.length;i++){if(knownSource.test(lines[i])){fields.source=title(lines[i]);used.add(i);break;}}}
 if(fields.source&&/^phone call$/i.test(fields.source))fields.source='Inbound Phone Inquiry';
 if(!fields.source){const m=joined.match(/\b(home show|trade show|instagram|facebook|website|referral|showroom)\b/i);if(m)fields.source=title(m[1]);}
 if(fields.source&&/^phone call$/i.test(fields.source))fields.source='Inbound Phone Inquiry';
 const sizes=[...joined.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:ft\.?|feet|foot|['′])?\s*(?:x|×|by)\s*(\d{1,3}(?:\.\d+)?)\s*(?:ft\.?|feet|foot|['′])?\b/gi)];
 if(sizes.length){let a=sizes[0][1],b=sizes[0][2];const alternative=sizes.slice(1).find(x=>x[1]===a||x[2]===b);const approx=/\b(?:approx|about|roughly|around|maybe|possibly)\b/i.test(joined);fields.size=alternative?`${a}x${b} to ${a}x${alternative[1]===a?alternative[2]:alternative[1]}`:`${a}x${b}`;fields.sizeShort=(approx?'~':'')+(alternative?`${a}x${b}–${alternative[1]===a?alternative[2]:alternative[1]}`:`${a}x${b}`);}
 return {fields,lines,used,joined,sizes};
}
function dateTime(lines,opts){
 const notes=clean(opts.notesDate);const ref=dateFrom(notes);const t=lines.join(' ');let date=null;const issues=[];
 if(/\bday after tomorrow\b/i.test(t)){date=new Date(ref);date.setDate(date.getDate()+2);}
 else if(/\btomorrow\b/i.test(t)){date=new Date(ref);date.setDate(date.getDate()+1);}
 else if(/\btoday\b/i.test(t)){date=new Date(ref);}
 else {const m=t.match(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?[,]?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:[,]?\s+(20\d{2}))?\b/i);if(m){const year=m[3]?Number(m[3]):ref.getFullYear();let dt=new Date(`${m[1]} ${m[2]}, ${year} 12:00:00`);if(!Number.isNaN(dt.getTime()))date=dt;if(!m[3])issues.push('Year inferred from the notes date; confirm it.');}
 else {const iso=t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/),usa=t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);if(iso)date=new Date(+iso[1],+iso[2]-1,+iso[3],12);else if(usa)date=new Date(+usa[3],+usa[1]-1,+usa[2],12);else {const day=t.match(/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);if(day){let w=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day[1].toLowerCase());let delta=(w-ref.getDay()+7)%7;if(delta===0||/^next /i.test(day[0]))delta+=7;date=new Date(ref);date.setDate(date.getDate()+delta);issues.push('Weekday converted to a date from the notes date; confirm the date.');}}}}
 if(!notes&&date&&/\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t))issues.push('Relative date was interpreted from today; set the notes recording date if different.');
 // The notes are the first source of truth. Dropdowns fill in genuinely missing information.
 // Unmarked appointments use normal business-hour defaults; always flag inferred AM/PM.
 const timeLines=lines.filter(line=>/\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|(?:at|time\s*:)\s*\d{1,2}|\d{1,2}\s*(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT)|noon)\b/i.test(line));
 let time=null,notedPeriod=null;
 const parsePeriod=s=>{const v=clean(s).toUpperCase().replace(/\./g,'');return ['AM','PM'].includes(v)?v:null;};
 const inferDaypart=line=>{if(/\b(?:morning|before noon|a\.?m\.?)\b/i.test(line))return 'AM';if(/\b(?:afternoon|evening|tonight|after lunch|after noon|p\.?m\.?)\b/i.test(line))return 'PM';return null;};
 // Prioritize time expressions with an explicit meridiem over ambiguous times.
 const explicitTime=timeLines.map(line=>({line,m:line.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?=\s|$|[,;.!?])/i)})).find(x=>x.m);
 let timeLine=explicitTime?.line||null,timeMatch=explicitTime?.m||null;
 if(!timeMatch){
   const colon=timeLines.map(line=>({line,m:line.match(/\b(1[0-2]|0?[1-9]):([0-5]\d)\b/)})).find(x=>x.m);
   if(colon){timeLine=colon.line;timeMatch=colon.m;}
 }
 if(!timeMatch){
   const bare=timeLines.map(line=>({line,m:line.match(/\b(?:at|for|time\s*[:=]|appointment\s*[:=]|meeting\s*[:=])\s*(1[0-2]|0?[1-9])\b/i)})).find(x=>x.m);
   if(bare){timeLine=bare.line;timeMatch=bare.m;}
 }
 if(timeMatch){
   const hour=Number(timeMatch[1]),minute=timeMatch[2]&&/^\d\d$/.test(timeMatch[2])?Number(timeMatch[2]):0;
   notedPeriod=explicitTime?parsePeriod(timeMatch[3]):inferDaypart(timeLine);
   const fallback=parsePeriod(opts.timePeriod);
   // For time-only notes, treat the appointment as later today, in the customer's time zone.
   // If an AM time has already passed today, choose PM. Dates in the company's card always
   // include the year even when the caller only says '9:30'.
   const geoHint=zoneFromNotes(lines,opts.customerZone);
   let heuristic=hour>=8&&hour<=11?'AM':'PM';
   const dateFromNotes=/\b(?:today|tomorrow|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{1,2}-\d{1,2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(t);
   if(!dateFromNotes&&!notedPeriod&&!fallback){
     const zone=geoHint.zone||'America/Denver';
     const parts=zoneParts(new Date(),zone);
     const actualMins=parts.h*60+parts.min;
     const candidateMins=hour*60+minute;
     // Today at the AM occurrence already passed, so later today means PM.
     if(actualMins>=candidateMins-5)heuristic='PM';
   }
   const period=notedPeriod||fallback||heuristic;
   if(!notedPeriod&&!fallback)issues.push(`Interpreted ${hour}:${String(minute).padStart(2,'0')} as ${period}. Check AM/PM with the customer.`);
   if(period)time=`${hour}:${String(minute).padStart(2,'0')} ${period}`;

   if(notedPeriod&&fallback&&notedPeriod!==fallback)issues.push(`Notes indicate ${notedPeriod}, but the dropdown says ${fallback}; used the notes. Verify the time.`);
 }
 if(!date&&time){date=new Date(ref);issues.push('No date stated: assumed the notes recording day. Confirm appointment date.');}
 const resolvedDate=date?prettyDate(toUTCDate(date)):null;
 let meeting=null;
 const meetingFromLine=line=>{
   const inPerson=/\b(?:in[- ]?person|face[- ]?to[- ]?face|on[- ]?site|on[- ]?location)\b|\b(?:meet|meeting|appointment|visit)\s+(?:at|in)\s+(?:the\s+)?(?:customer'?s?\s+|their\s+)?(?:home|house|property|showroom)\b/i.test(line);
   const virtual=/\b(?:virtual|zoom|google meet|video\s*(?:call|meeting|chat)|(?:over|on)\s+the\s+phone|phone\s*(?:call|appointment|consultation|meeting)|remote\s+meeting|\bcall\b|telephone\s+appointment)\b/i.test(line);
   const meetingContext=/\b(?:meeting|appointment|consultation|design\s+call|scheduled|schedule|booking|booked|tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm))\b/i.test(line);
   // A previous conversation or a lead source is NOT a future virtual appointment.
   const historical=/\b(?:previously|earlier|last\s+week|first\s+had|already\s+had|spoke\s+(?:by|on|over)|talked\s+(?:by|on|over)|called\s+(?:us|them|me))\b/i.test(line);
   const sourceOnly=/^(?:lead\s+source|source)\s*[:=]|^phone\s+call$/i.test(line.trim());
   const virtualFuture=virtual && (meetingContext || (/^(?:call|design call|scheduled call)$/i.test(line.trim()) && /\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:[0-5]\d)\b/i.test(lines.join(' ')))) && !historical && !sourceOnly;
   if(inPerson&&virtualFuture)return 'conflict';
   if(inPerson)return 'In-Person';
   if(virtualFuture)return 'Virtual';
   return null;
 };
 const typeLines=lines.filter(line=>!/^(?:project|details?)\s*:/i.test(line));
 const types=unique(typeLines.map(meetingFromLine).filter(Boolean));
 let fromNotes=types.length===1&&types[0]!=='conflict'?types[0]:null;
 if(types.includes('conflict')||types.length>1)issues.push('Conflicting meeting-type wording in the notes; clarify whether the appointment is In-Person or Virtual.');
 // Personal preference: phone/virtual is the default unless notes indicate an on-site visit.
 const hasStreetAddress=lines.some(line=>{
   const v=line.replace(/^(?:address|location|project address|site)\s*[:=]\s*/i,'').trim();
   return /\b\d{1,6}\s+(?:(?:[NSEW]\.?|North|South|East|West)\s+)?[A-Za-z0-9][A-Za-z0-9.' -]{2,80}\s+(?:Street|St\.?|Road|Rd\.?|Drive|Dr\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Court|Ct\.?|Way|Circle|Cir\.?|Place|Pl\.?|Parkway|Pkwy)\b/i.test(v);
 });
 const atTheirHome=lines.some(line=>/\b(?:at|visit|meet|meeting|appointment|come\s+to|be\s+at)\s+(?:his|her|their|the|the\s+customer'?s|customer'?s)\s+(?:house|home|property|address)\b/i.test(line));
 if((hasStreetAddress||atTheirHome)&&fromNotes!=='In-Person'){
   if(fromNotes==='Virtual')issues.push('Notes mention both a call and an address/home visit; treated as In-Person as requested. Confirm meeting type.');
   else issues.push('Street address/home visit found; treated as In-Person. Confirm meeting location.');
   fromNotes='In-Person';
 }
 const selected=clean(opts.meetingType).toLowerCase();
 let fallbackType=/in[- ]?person/.test(selected)?'In-Person':/virtual|phone|video/.test(selected)?'Virtual':null;
 if(fromNotes){meeting=fromNotes;if(fallbackType&&fallbackType!==fromNotes)issues.push(`Notes say ${fromNotes}, but the dropdown says ${fallbackType}; used the notes. Verify the meeting type.`);}
 else if(types.length===0 || fromNotes===null)meeting=fallbackType||'Virtual';
 // If the note itself contains contradictory type instructions, don't paper over it with a dropdown.
 const geo=zoneFromNotes(lines,opts.customerZone);
 issues.push(...geo.issues);
 let customerTime=null,utahTime=null,customerDisplay=null,utahDisplay=null,utahDate=resolvedDate;
 if(date&&time&&geo.zone){
   const match=time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
   const h12=+match[1],h24=h12%12+(match[3]==='PM'?12:0),min=+match[2];
   const instant=utcFromWall(localDate(date),h24,min,geo.zone);
   if(!instant)issues.push('Customer time falls in a daylight-saving clock change and does not exist; confirm a new time.');
   else{
     customerDisplay=timeAndDateInZone(instant,geo.zone);
     utahDisplay=timeAndDateInZone(instant,'America/Denver');
     customerTime=customerDisplay.time;
     utahTime=utahDisplay.time;
     utahDate=utahDisplay.date;
   }
 }
 return {date:utahDate,time:utahTime,meeting,issues,customerTime,customerDisplay,utahDisplay,customerZone:geo.zone,customerZoneSource:geo.source,customerDate:resolvedDate,locationState:geo.locationState};
}
function identifyRoute(joined,opts){let mode=clean(opts.routingMode)||'auto',designer=clean(opts.routingDesigner),reason=clean(opts.routingReason),warnings=[];
 const forced=joined.match(/\b(?:override\s+)?(?:assign|book|give|send)\s+to\s+(Tyrel|Parley|Brighton|Landon|Carter|Chase|Scott|Dave)\b/i);
 const wish=joined.match(/\b(?:prefer|ideally|if available|if (?:he|she|they)(?:'re| are) free)\s+(Tyrel|Parley|Brighton|Landon|Carter|Chase|Scott|Dave)\b/i);
 if(mode==='auto'&&forced){designer=title(forced[1]);mode=/\b(?:if available|if (?:he|she|they)(?:'re| are) free|preferably|ideally)\b/i.test(joined)?'prefer':'force';}
 if(mode==='auto'&&wish){designer=title(wish[1]);mode='prefer';}
 if(mode==='auto')return {line:'',reason:'',warnings,mode:'auto'};
 if(!DESIGNERS.includes(designer)){warnings.push('Select an active designer before including routing instructions.');return {line:'',reason:'',warnings,mode:'auto'};}
 if(mode==='force'){
   if(opts.confirmedFree===true)return {line:`Assign to ${designer}`,reason,warnings,mode:'force'};
   warnings.push(`Assignment to ${designer} needs confirmed availability. Converted to a nonbinding preference.`);
   return {line:`Give to ${designer} if available`,reason,warnings,mode:'prefer'};
 }
 return {line:`Give to ${designer} if available`,reason,warnings,mode:'prefer'};
}
function specFor(parsed,meeting,questions,internal){
 const {joined:t,fields:f,lines,used,sizes}=parsed,spec=[];
 const mountFree=/\b(?:free[- ]?standing|standalone|detached)\b/i.test(t),mountAttach=/\b(?:attached to|attaches to|connect(?:ed)? to the (?:house|building)|ledger board)\b/i.test(t);
 const mountTent=/\b(?:maybe|might|possibly|could|not sure|unsure)\s+(?:be\s+)?(?:free[- ]?standing|attached|detached)\b/i.test(t);
 if(mountFree&&!mountAttach){f.mount=mountTent?'Freestanding (tentative)':'Freestanding';}else if(mountAttach&&!mountFree){f.mount=mountTent?'Attached (tentative)':'Attached';}else questions.push('Confirm if structure is attached or freestanding.');
 if(mountTent)questions.push('Attachment style is tentative; do not present it as confirmed.');
 const hot=/\bhot[- ]?tub\b/i.test(t),pool=/\bpool\b/i.test(t),overPool=/\b(?:over|above)\s+(?:the\s+)?pool\b|\bpool\s+partial|\bpartially\s+(?:over|above)\s+(?:the\s+)?pool\b/i.test(t);
 const kind=(f.project||'structure').toLowerCase();let opener=f.project?`Customer is looking for a ${f.mount&&!mountTent?f.mount.toLowerCase()+' ':''}${kind}`:'Customer is considering a structure';
 if(hot)opener+=' over a hot-tub area';if(f.size)opener+=`, roughly ${f.size}`;spec.push(opener+'.');
 const timber=/\btimber\s*volt\b/i.test(t),privacy=/\bprivacy\s+walls?\b/i.test(t),sides=/\b(?:two|2)\s+sides?\b/i.test(t),sliding=/\bslid(?:ing|e)\b/i.test(t),barn=/\bbarn\s+door\b/i.test(t),partial=/\bpartial\b/i.test(t);
 if(timber&&privacy){let v=`They want TimberVolt posts and ${sides?'privacy walls on two sides':'privacy walls'}`;if(sliding)v+=`, with ${sides?'one side':'a side'} incorporating a ${partial?'partial ':''}${barn?'sliding barn-door-style':'sliding'} privacy panel`;spec.push(v+'.');}
 else{if(timber)spec.push('TimberVolt posts are requested.');if(privacy){let v=`They want ${sides?'privacy walls on two sides':'privacy walls'}`;if(sliding)v+=`, including a ${partial?'partial ':''}${barn?'sliding barn-door-style':'sliding'} panel`;spec.push(v+'.');}}
 if(overPool)spec.push(`The ${kind} will partially extend over the pool area.`);else if(pool)spec.push('A pool was mentioned; confirm how the structure relates to it.');
 const stargaze=/\bstar\s*gaz(?:e|ing)|stargaz(?:e|ing)\b/i.test(t),open=/\b(?:no\s+cover|completely\s+open|literally\s+no\s+cover|without\s+(?:a\s+)?roof|open\s+(?:to|for)\s+(?:the\s+)?sky)\b/i.test(t),noRafter=/\b(?:no|not|without)\s+(?:the\s+)?rafters?\b|\bno\s+rafters?\b|\bnot\s+shade\s+planks?\s+and\s+rafters?\b/i.test(t),noShade=/\b(?:no|not|without)\s+(?:the\s+)?shade\s+planks?\b|\bnot\s+shade\s+planks?\s+and\s+rafters?\b/i.test(t),posts=/\bposts?\b/i.test(t)&&/\bbeams?\b/i.test(t);
 if(stargaze){let v='They want a large portion of the structure open for stargazing';if(open&&noRafter&&noShade&&posts)v+=' — keeping the main posts and beams, but without rafters or shade planks over that section';else if(noRafter&&noShade)v+=' — without rafters or shade planks over that section';spec.push(v+'.');}
 if(/\b(?:3d\s+rendering|rendering|sketchup\s+drawings?|custom\s+drawing|designer\s+required)\b/i.test(t)&&!/\b(?:no|not|doesn['’]?t|without)\s+(?:need\s+)?(?:a\s+)?(?:rendering|drawing|drawings)\b/i.test(t))spec.push('Customer wants a 3D rendering or custom drawings.');
 if(/\b(?:no rendering needed|doesn['’]?t need a drawing|no drawings needed)\b/i.test(t))spec.push('No rendering needed.');
 if(/\b(?:church|rv park|event venue|restaurant|school|park|hoa common area)\b/i.test(t))spec.push('Project site is '+(t.match(/\b(church|rv park|event venue|restaurant|school|park|hoa common area)\b/i)||[])[0]+'.');
 if(/\b(?:fully enclosed(?: building)?|home with walls)\b/i.test(t)||(['cabin','barn','shop'].includes(kind)&&!/\bbarn\s+door\b/i.test(t)))spec.push('Project may be a fully enclosed building; confirm enclosure details.');
 const money=t.match(/\b(?:budget|price range|spend(?:ing)?|cost)\s*(?:is|of|around|:)?\s*\$?\d[\d,.]*(?:k|thousand)?(?:\s*[-–]\s*\$?\d[\d,.]*(?:k|thousand)?)?/i);if(money)spec.push('Budget: '+clean(money[0])+'.');
 const timeline=t.match(/\b(?:next (?:spring|summer|fall|winter|month)|in \d+\s*(?:weeks?|months?)|asap|as soon as possible)\b/i);if(timeline)spec.push('Project timeline mentioned: '+timeline[0]+'.');
 if(/\b(?:DIY|kit only|self[- ]install|build it themselves)\b/i.test(t))spec.push('Customer is considering a self-installed kit.');
 const known=/\b(?:pergola|pavilion|gazebo|deck|truss|carport|hot[- ]?tub|pool|timber\s*volt|privacy\s+wall|sliding|barn\s+door|stargaz|star\s+gaz|shade\s+plank|rafter|post|beam|cover|free[- ]?standing|attached)\b/i;
 const extra=[];
 for(let i=0;i<lines.length;i++){if(used.has(i))continue;let line=lines[i];if(/^(?:US|USA|United States|Call|Design call|Scheduled call|tomorrow|today|day after tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\.?$/i.test(line))continue;if(/^\s*(?:meeting time|time|date|meeting type|appointment type)\s*[:=]/i.test(line))continue;if(/^(?:home show|trade show|website|instagram|facebook|referral|showroom)$/i.test(line))continue;if(/^(?:5|\d{1,2}):\d{2}\s*(?:am|pm)?\s*(?:tomorrow|today)?$/i.test(line))continue;if(/\b(?:tomorrow|today)\b/i.test(line)&&/\d{1,2}:\d{2}/.test(line))continue;if(sizes.some(v=>line.includes(v[0].trim()))&&/^(?:approx|about|maybe|around|roughly|\d)/i.test(line))continue;
  if(/\b(?:assign|book|give|send)\s+to\s+(?:Tyrel|Parley|Brighton|Landon|Carter|Chase|Scott|Dave)\b/i.test(line))continue;
  if(PERSON_RE.test(line)){internal.push('Internal note: '+line);questions.push('A designer name in project text would be hidden by the bridge; moved the original line into private notes.');continue;}
  if(known.test(line)&&!/(?:budget|price|\$|stain|color|colour|wood|species|timeline|spring|summer|fall|winter|install|kit|electrical|outlet|lighting|drain|height|grade|concrete|pitch|gable|hip|waterproof|motor|hardware|delivery|ho[a])/i.test(line))continue;
  if(/^(?:name|customer|phone|mobile|cell|email|location|address|source|lead source|project|structure)\s*[:=]/i.test(line))continue;
  if(/^(?:(?:website|facebook|instagram|home show|trade show|showroom|referral|walk[- ]?in)(?:\s+lead)?|lead\s+(?:from\s+)?(?:website|facebook|instagram|home show|referral)|[0-9]{6,})[.!]?$/i.test(line))continue;
  if(/^(?:in[- ]?person|virtual|phone call|zoom call|video call)$/i.test(line))continue;
  if(/^(?=.*\b(?:\d{1,2}:[0-5]\d|\d{1,2}\s*(?:am|pm))\b)(?=.*\b(?:call|appointment|meeting|zoom|virtual|CST|CDT|EST|EDT|MST|MDT|PST|PDT)\b).*$/i.test(line))continue;
  // Don't duplicate entire scheduling-only statements inside project specifications.
  if(!/\b(?:pergola|pavilion|gazebo|deck|truss|timber|rafters|beams|posts|hot[- ]?tub|pool|shade|privacy|budget|wood|roof|drawing|rendering)\b/i.test(line) && (
    /\b(?:tomorrow|today|appointment|meeting|in[- ]?person|virtual|zoom|on[- ]?site|video call)\b/i.test(line) && /\b(?:\d{1,2}:[0-5]\d|\d{1,2}\s*(?:am|pm)|morning|afternoon|evening|appointment|meeting|in[- ]?person|virtual|zoom|on[- ]?site)\b/i.test(line)
    || /^\s*\d{1,2}\s*(?:am|pm)\s*$/i.test(line)
  ))continue;
  // Scheduling metadata belongs ONLY in SCHEDULE, never in PROJECT SPECIFICATIONS.
  // Examples: 'Meeting Type is a virtual call', 'Tomorrow at 5pm in person', '5:00 PM tomorrow'.
  if(/^(?:meeting|appointment|consultation|design\s+call)(?:\s+type)?\s*(?:is|will be|:|=|at|for|on|tomorrow|today)\b/i.test(line) && !/\b(?:pergola|pavilion|gazebo|deck|truss|roof|timber|wood|rafters|beams|posts|hot[- ]?tub|pool|shade|privacy|budget)\b/i.test(line))continue;
  if(/^(?:(?:meeting|appointment)\s+type\s*[:=]\s*|(?:meeting|appointment)\s+(?:is|will be)\s+)?(?:an?\s+)?(?:in[- ]?person|on[- ]?site|virtual|zoom|google meet|video call|phone call)(?:\s+(?:meeting|appointment|consultation|call))?(?:[.,;:]?\s*(?:tomorrow|today|on\s+\w+|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?))*[.!]?$/i.test(line))continue;
  if(/^(?:(?:tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s+(?:at\s+)?)?(?:at\s+)?\d{1,2}(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?|in\s+the\s+(?:morning|afternoon|evening))?\s*(?:tomorrow|today|in[- ]?person|virtual|on[- ]?site|zoom|phone\s+call|video\s+call)?[.!]?$/i.test(line))continue;
  if(/^(?:tomorrow|today)\s+at\s+\d{1,2}(?::[0-5]\d)?(?:\s*(?:am|pm|in\s+the\s+(?:morning|afternoon|evening)))?(?:\s+(?:in[- ]?person|virtual))?[.!]?$/i.test(line))continue;
  if(/^(?:\d{1,2}:\d{2}\s*(?:am|pm)?)$/i.test(line))continue;
  extra.push(line.replace(/^(?:notes?|details?)\s*:\s*/i,''));
 }
 if(extra.length){let extraText=extra.join('; ');if(meeting==='In-Person'&&VIRTUAL_RE.test(extraText)){extraText=extraText.replace(/\bphone call\b/gi,'earlier conversation').replace(/\bvideo call\b/gi,'earlier conversation').replace(/\bzoom\b/gi,'earlier conversation').replace(/\bgoogle meet\b/gi,'earlier conversation').replace(/\bvirtual\b/gi,'remote');questions.push('Removed virtual-trigger wording from in-person project details; verify meaning.');}spec.push('Additional details: '+extraText.replace(/[.;\s]+$/,'')+'.');}
 return {spec:spec.map(x=>x.replace(/\s+/g,' ').trim()),mount:f.mount||null};
}
function validateCard(card,{todayYMD}={}){
 const errors=[],warnings=[];const text=String(card||'').replace(/\r/g,'');const lines=text.split('\n').map(s=>s.trim());
 const index=heading=>lines.indexOf(heading);
 const headers=['CUSTOMER DETAILS','SCHEDULE','PROJECT SPECIFICATIONS'];for(const h of headers)if(index(h)<0)errors.push(`Missing exact heading: ${h}.`);
 const field=(key)=>{const m=lines.find(x=>x.startsWith(key+':'));return m?m.slice(key.length+1).trim():null;};
 const req=[['NAME','Customer name'],['PHONE','10-digit mobile number'],['DATE','Full appointment date with year'],['MEETING TIME','12-hour appointment time'],['MEETING TYPE','Explicit meeting type'],['LEAD SOURCE','Lead source']];
 for(const [key,label]of req){let value=field(key);if(!value||/\[MISSING|not (?:provided|specified)|TBD|pending/i.test(value))errors.push(`${label} is missing (${key}).`);}
 const name=field('NAME');if(name&&!name.includes('[')&&name.split(/\s+/).length<2)warnings.push('Only one customer name provided. The company guide requires first and last name for reliable customer matching; confirm before posting.');if(name&&PERSON_RE.test(name))warnings.push('Customer name contains a designer-routing keyword. The bridge may hide that line; confirm with Laurence before posting.');
 const ph=field('PHONE');if(ph&&!/^(?:\d{10}|1\d{10})$/.test(ph.replace(/\D/g,'')))errors.push('PHONE must be 10 US digits, optionally prefixed with +1.');
 const email=field('EMAIL');if(!email||email.includes('['))warnings.push('No email provided. The company guide says to include one; without it the customer may miss confirmations, invites, and designer introduction emails.');else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))warnings.push('EMAIL format appears invalid; verify before posting.');
 const when=field('DATE');if(when&&!when.includes('[')){const valid=/^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+20\d{2}$/.test(when);if(!valid)errors.push('DATE must be a supported date with a 4-digit year (e.g. Thursday, October 15, 2026).');else {const parsed=Date.parse(when.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*/,''));const current=dateFrom(todayYMD||utahToday());if(!Number.isNaN(parsed)&&parsed<new Date(current.getFullYear(),current.getMonth(),current.getDate()).getTime())warnings.push('The appointment date is in the past. The bridge holds past dates for Laurence to review.');}}
 const time=field('MEETING TIME');if(time&&!time.includes('[')&&!/^(?:1[0-2]|[1-9]):[0-5]\d\s(?:AM|PM)$/.test(time))errors.push('MEETING TIME must be like 2:00 PM (Utah/Mountain time).');
 const mt=field('MEETING TYPE');if(mt&&!mt.includes('[')&&!['In-Person','Virtual'].includes(mt))errors.push('MEETING TYPE must be exactly In-Person or Virtual.');
 const loc=field('LOCATION');if(mt==='In-Person'&&(!loc||loc.includes('[')))errors.push('In-person visits require a full Utah street address (LOCATION).');if(mt==='In-Person'&&loc&&!loc.includes('[')&&(!/^\d{1,6}\s+\S.+,\s*\S.+,\s*UT(?:\s+\d{5})?$/i.test(loc)))errors.push('In-person visits require a full Utah street address; otherwise the bridge may book virtual.');
 const si=index('SETTING NOTES');if(si>=0){const following=lines.slice(si+1);if(!following.some(x=>/^━{3,}$/.test(x)))errors.push('SETTING NOTES must end with a divider (━━━) so private notes do not hide later content.');
  for(const l of following){if(/^━{3,}$/.test(l))break;if(/\b(?:assign|book|give|send)\b/i.test(l)&&!/(?:^(?:Override\s+)?(?:Assign|Book|Give|Send)\s+to\s+(?:Tyrel|Parley|Brighton|Landon|Carter|Chase|Scott|Dave)\b|^Internal note:)/i.test(l))warnings.push('Review designer-routing syntax under SETTING NOTES; orders require “Assign to [first name]”.');
   if(/^(?:assign|book|give|send)\s+to\s+\w+/i.test(l)&&!/\b(?:if available|if (?:he|she|they)(?:'re| are) free|preferably|ideally)\b/i.test(l))warnings.push('Named designer assignment bypasses calendar and visit restrictions. Only post if availability was confirmed.');
  }
 }
 const proj=index('PROJECT SPECIFICATIONS');if(proj>=0){const stop=lines.findIndex((x,i)=>i>proj&&/^━{3,}$/.test(x));const spec=lines.slice(proj+1,stop>=0?stop:undefined).join('\n');if(PERSON_RE.test(spec))errors.push('PROJECT SPECIFICATIONS contains a designer name; the bridge would hide the entire line.');if(mt==='In-Person'&&VIRTUAL_RE.test(spec))errors.push('In-person PROJECT SPECIFICATIONS has a trigger word (virtual/zoom/google meet/video call/phone call) that may change meeting type.');if(/\b(?:\d{1,3}\s+by\s+\d{1,3}|\d{1,3}\s*ft\s+by\s+\d{1,3})\b/i.test(spec))warnings.push('Write dimensions as 20x30, not “20 by 30”.');if(/\b(?:government|city of|county|school district|corporation|developer|dealer|multiple structures|several structures)\b/i.test(spec))warnings.push('Government, corporate and multi-structure buyers are held for Laurence to assign.');}
 if(mt==='In-Person'&&VIRTUAL_RE.test(lines.filter(x=>!x.startsWith('MEETING TYPE:')).join('\n')))errors.push('An in-person card contains virtual-trigger wording outside the MEETING TYPE field.');
 if(!lines.some(x=>/^━{3,}$/.test(x)))errors.push('Divider lines are required.');
 if(!/^.+\s—\s.+$/.test(lines.find(x=>x.includes(' — '))||''))errors.push('Card headline must be NAME — PROJECT.');
 if(lines.some(x=>/^TIME\s*:/i.test(x)))errors.push('Use MEETING TIME:, not TIME:.');
 if(lines.includes('SETTING NOTES')&&lines.findIndex(x=>x.startsWith('LEAD SOURCE:'))<=index('SETTING NOTES'))errors.push('LEAD SOURCE must be after the closed SETTING NOTES block.');
 return {ready:errors.length===0,errors:unique(errors),warnings:unique(warnings)};
}
function format(raw,options={}){
 const input=String(raw||'').trim();if(!input)return {text:'',fields:{},detected:[],questions:[],errors:[],warnings:[],ready:false};
 const parsed=extract(input),{fields,joined}=parsed,questions=[],internal=[];
 const schedule=dateTime(parsed.lines,options);questions.push(...schedule.issues);
 const routing=identifyRoute(joined,options);questions.push(...routing.warnings);
 const {spec}=specFor(parsed,schedule.meeting,questions,internal);
 if(/\b(?:government|city of|county|school district|corporation|developer|dealer|multiple structures|several structures)\b/i.test(joined))questions.push('This may be a government, corporate, or volume buyer; the bridge holds it for Laurence.');
 // For US phone numbers, normalize optional +1 international country code to 10 digits for bridge compatibility.
 if(fields.phone&&fields.phone.replace(/\D/g,'').length===11&&fields.phone.replace(/\D/g,'').startsWith('1')){
   const digits=fields.phone.replace(/\D/g,'').slice(1); fields.phone=`${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
 }
 const heading=`${(fields.name||'CUSTOMER NAME MISSING').toUpperCase()} — ${[fields.sizeShort,(fields.mount&&!/tentative/i.test(fields.mount))?fields.mount.toUpperCase():'',/\bhot[- ]?tub\b/i.test(joined)?'HOT-TUB':'',(fields.project||'PROJECT NOT SPECIFIED').toUpperCase()].filter(Boolean).join(' ')}`;
 const parts=[DIV,heading,DIV,'CUSTOMER DETAILS',`NAME: ${fields.name||MISSING}`,`PHONE: ${fields.phone||MISSING}`,...(fields.email?[`EMAIL: ${fields.email}`]:[]),...(fields.location?[`LOCATION: ${fields.location}`]:schedule.meeting==='In-Person'?[`LOCATION: ${MISSING}`]:[]),DIV,'SCHEDULE',`DATE: ${schedule.date||MISSING}`,`MEETING TIME: ${schedule.time||MISSING}`,`MEETING TYPE: ${schedule.meeting||MISSING}`,DIV,'PROJECT SPECIFICATIONS',...spec,DIV];
 const privateLines=[];if(routing.line)privateLines.push(routing.line);if(routing.reason)privateLines.push(routing.reason);privateLines.push(...internal);
 if(privateLines.length)parts.push('SETTING NOTES',...privateLines,DIV);
 parts.push(`LEAD SOURCE: ${fields.source||MISSING}`,DIV);
 const text=parts.join('\n');const validator=validateCard(text);const detected=Object.keys(fields).filter(k=>k!=='sizeShort');
 if(fields.name&&fields.name.includes('&'))questions.push('Verify both customers share the last name shown.');
 if(fields.size&&/\b(?:maybe|possibly|approx|roughly)\b/i.test(joined))questions.push('Footprint is approximate; confirm final dimensions.');
 if(!fields.mount)questions.push('Mounting type was not supplied; it is not guessed.');
 return {text,timezoneInfo:{customer:schedule.customerDisplay,utah:schedule.utahDisplay,zone:schedule.customerZone,source:schedule.customerZoneSource},fields:{...fields,meetingType:schedule.meeting,appointmentDate:schedule.date,appointmentTime:schedule.time},detected,questions:unique(questions),errors:validator.errors,warnings:unique([...validator.warnings,...routing.warnings]),ready:validator.ready};
}
root.LeadFormatter={format,validateCard,utahToday};if(typeof module!=='undefined'&&module.exports)module.exports={format,validateCard,utahToday};
})(typeof window!=='undefined'?window:globalThis);

