(()=>{
 const card=document.getElementById('guide-moto');if(!card)return;
 const videos=[...card.querySelectorAll('video')];
 const pause=video=>{if(!video.paused)video.pause();};
 for(const video of videos){
  video.addEventListener('play',()=>videos.filter(other=>other!==video).forEach(pause));
  const error=video.closest('.moto-video').querySelector('[data-video-error]');
  const showError=()=>{error.hidden=false;};
  video.addEventListener('error',showError);video.querySelector('source')?.addEventListener('error',showError);
  video.addEventListener('loadeddata',()=>{error.hidden=true;});
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(pause);});
 const tabs=[...card.querySelectorAll('[role=tab]')];
 const select=tab=>{for(const item of tabs){const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;const panel=document.getElementById(item.getAttribute('aria-controls'));if(!active)panel.querySelectorAll('video').forEach(pause);panel.hidden=!active;}};
 for(const [index,tab] of tabs.entries()){
  tab.addEventListener('click',()=>select(tab));
  tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];else if(event.key==='ArrowLeft')next=tabs[(index+tabs.length-1)%tabs.length];else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs.at(-1);else return;event.preventDefault();select(next);next.focus();});
 }
 card.querySelector('[data-moto-contact]').addEventListener('click',event=>{
  const path=document.getElementById('contact-path'),form=document.getElementById('contact-form');if(!path||!form)return;
  event.preventDefault();path.value='Patente A · Moto';path.dispatchEvent(new Event('change',{bubbles:true}));
  form.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  document.getElementById('contact-name')?.focus({preventScroll:true});
 });
})();
