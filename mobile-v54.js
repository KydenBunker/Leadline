
/* V5.4 mobile navigation and non-destructive sound-unlock status.
   No cloud credentials or customer information are handled here. */
(() => {
  'use strict';
  const sheet=document.getElementById('v54-more-sheet');
  const shade=document.getElementById('v54-more-shade');
  const trigger=document.getElementById('v54-more-trigger');
  const closeBtn=document.getElementById('v54-more-close');
  if(!sheet||!shade||!trigger)return;
  function toggle(open){
    sheet.classList.toggle('hidden',!open);
    shade.classList.toggle('hidden',!open);
    trigger.setAttribute('aria-expanded',String(open));
    if(open)sheet.focus();else trigger.focus({preventScroll:true});
  }
  trigger.addEventListener('click',()=>toggle(sheet.classList.contains('hidden')));
  closeBtn.addEventListener('click',()=>toggle(false));
  shade.addEventListener('click',()=>toggle(false));
  sheet.addEventListener('click',e=>{if(e.target.closest('[data-page],[data-role]'))toggle(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.classList.contains('hidden')){e.preventDefault();toggle(false);}});
  // If a sub-page is selected, show that the More tab owns the current page.
  const updateCurrent=()=>{
    if(sheet.classList.contains('hidden')){
      const active=document.querySelector('.page:not(.hidden)');
      const key=active?.id?.replace('page-','');
      const primary=[...document.querySelectorAll('.v54-bottom-nav [data-page]')].some(b=>b.dataset.page===key&&!b.classList.contains('hidden'));
      trigger.classList.toggle('active',!!key&&!primary);
    }
  };
  new MutationObserver(updateCurrent).observe(document.querySelector('main'),{attributes:true,subtree:true,attributeFilter:['class']});
  updateCurrent();
})();

