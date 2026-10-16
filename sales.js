
/* Leadline V4.6 Sales Wins helper. Local parsing only; no Google Chat access. */
(function(root){
 'use strict';
 const trim=s=>String(s??'').trim();
 function amountFrom(s){
  const txt=trim(s);
  // Prefer explicit $ values, then isolated 31k / 31,000 style amounts.
  const money=txt.match(/(?:\$|USD\s*)(\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\s*\d{4,9}(?:\.\d{1,2})?)\s*(k|thousand|m|million)?\b/i)
    ||txt.match(/\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d+)?\s*(?:k|thousand|million)|\d{4,9})\b/i);
  if(!money)return null;
  const chunk=money[1].replace(/[\s,]/g,''); const suffix=(money[2]||money[0].match(/\s*(k|thousand|million|m)\b/i)?.[1]||'').toLowerCase();
  const val=Number(chunk.replace(/(?:k|thousand|m|million)$/i,''));
  const value=val*(suffix==='k'||suffix==='thousand'?1000:suffix==='m'||suffix==='million'?1000000:1);
  return Number.isFinite(value)&&value>=1&&value<=1e9?Math.round(value*100)/100:null;
 }
 function parse(text){
  const raw=trim(text);
  const amount=amountFrom(raw);
  let customer='';
  let m=raw.match(/\b(?:customer|client|name)\s*[:\-]\s*([A-Z][A-Za-z.'-]+(?:[ \t]+[A-Z][A-Za-z.'-]+){0,3})/i);
  if(m)customer=trim(m[1]);
  else {
    m=raw.match(/(?:^|\n)\s*([A-Z][a-z][A-Za-z.'-]+\s+[A-Z][a-z][A-Za-z.'-]+)\s+(?:just\s+)?(?:won|signed|sold|purchased|bought|closed)\b/);
    if(m)customer=m[1];
  }
  const project=(raw.match(/\b(?:redwood|timber(?:\s+frame)?|polycarbonate|attached|freestanding)?\s*(?:pergola|pavilion|gazebo|trusses?|deck|carport)\b/i)||[])[0]||'';
  return {customer,amount,project:trim(project),warnings:[...(!amount?['Sale amount not found. Add it manually if you know it.']:[]),...(!customer?['Customer was not named. Don’t assume which appointment this belongs to.']:[])]};
 }
 function suggestions(sale,appointments){
  const n=trim(sale.customer).toLowerCase();if(n.split(/\s+/).length<2)return [];
  return appointments.filter(a=>[a.label,a.notes].some(txt=>trim(txt).toLowerCase().includes(n))).map(a=>a.id);
 }
 root.LeadlineSales={parse,amountFrom,suggestions};if(typeof module!=='undefined'&&module.exports)module.exports={parse,amountFrom,suggestions};
})(typeof window!=='undefined'?window:globalThis);

