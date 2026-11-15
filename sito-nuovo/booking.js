import {GAP,clock,romeNow,shiftDay,weekday,dayWindow,fits,slotState,MAX_DAYS,sundayMode} from './booking-rules.js?v=3';
import {messages} from './booking-messages.js?v=6';

export function mountBooking(root){
 const d=root.ownerDocument,w=d.defaultView,dashboard=root.dataset.mode==='admin',lang=root.dataset.lang||'it';
 const t=s=>lang==='it'?s:(messages[s]?.[lang]||s),locale={it:'it-IT',en:'en-GB',es:'es-ES',fr:'fr-FR'}[lang];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{w.localStorage.setItem('adg-language',lang)}catch{}
 const tokenOK=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const store={get(k,fallback){try{return JSON.parse(w.localStorage.getItem(k))??fallback}catch{return fallback}},set(k,v){try{w.localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}};
 const fragment=new URLSearchParams(w.location.hash.slice(1));
 const key=fragment.get('gestione')||store.get('adg-booking-admin',''),viewKey=fragment.get('nominativi')||store.get('adg-booking-view','');
 const admin=dashboard&&tokenOK(key)&&!tokenOK(fragment.get('nominativi')),readKey=tokenOK(viewKey)?viewKey:tokenOK(key)?key:'';
 const ownerView=admin||!!readKey;
 if(tokenOK(key))store.set('adg-booking-admin',key);
 if(tokenOK(viewKey))store.set('adg-booking-view',viewKey);
 let tokens=store.get('adg-booking-links',[]);tokens=Array.isArray(tokens)?tokens.filter(tokenOK).slice(-12):[];
 if(!admin&&tokenOK(fragment.get('prenotazione'))){tokens=[...new Set([...tokens,fragment.get('prenotazione')])].slice(-12);store.set('adg-booking-links',tokens);}
 const today=romeNow().day;
 let from=today,selectedDay=today,data=null,editing=null,mine=[],selectedStart=null,sequence=0,saving=false,stale=true,draftToken=null,syncError=false;
 const errors={access_required:'Apri il tuo link personale per accedere.',invalid_schedule:'Controlla gli orari: sabato entro le 17:00 e domenica dalle 17:00 alle 20:00, a passi di mezz’ora.',invalid_name:'Inserisci un nominativo da 2 a 80 caratteri.',invalid_time:'Scegli almeno un’ora, con incrementi di mezz’ora.',past_time:'Scegli un orario futuro, entro i prossimi 180 giorni.',closed_time:'Quella fascia non è disponibile. Scegli un altro orario.',conflict:'La fascia è stata occupata o aggiornata. Controlla il calendario e scegli di nuovo.',changed:'La prenotazione è cambiata. Riaprila dall’elenco aggiornato.',cancelled:'La prenotazione è stata annullata.',not_found:'Prenotazione non trovata. Controlla il link personale.',invalid_range:'Scegli una data entro i prossimi 180 giorni.',forbidden:'Ricarica la pagina e riprova.',unavailable:'Connessione non disponibile. Riprova tra poco.'};
 const fmt=(day,options={weekday:'long',day:'numeric',month:'long'})=>new Date(day+'T12:00:00Z').toLocaleDateString(locale,options);
 const E=(tag,text,cls)=>{const el=d.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
 const linkFor=token=>w.location.origin+'/prenotazioni?lang='+lang+'#prenotazione='+token;
 const $=s=>root.querySelector(s);
 root.innerHTML=`${dashboard&&!ownerView?`<p class="bk-note">${t('Per gestire i nominativi e le disponibilità, apri il tuo link personale della dashboard.')}</p>`:''}${dashboard?'':`<div class="bk-top"><a class="bk-brand" href="${lang==='it'?'/':'/'+lang}">ACCADEMIA DELLA GUIDA ↗</a><nav class="bk-languages" aria-label="${t('Scegli la lingua')}">${['it','en','es','fr'].map(l=>`<a href="?lang=${l}${esc(w.location.hash)}" ${l===lang?'aria-current="page"':''}>${l.toUpperCase()}</a>`).join('')}</nav></div>`}
 <div class="bk-intro"><${dashboard?'h2':'h1'}>${ownerView?t('Il tuo calendario.'):t('Scegli il tuo prossimo orario.')}</${dashboard?'h2':'h1'}><p>${ownerView?t('Consulta i nominativi e annulla gli appuntamenti dall’elenco sotto il calendario. Avvisa personalmente il cliente: non vengono inviate notifiche automatiche.'):t('Guarda le fasce libere, scegli la durata e inserisci il tuo nominativo. L’orario viene occupato subito; i dettagli della lezione li concordi personalmente con Oscar.')}</p></div>
 <div class="bk-owner-view" data-owner-view hidden><strong>${t('Vista personale · nominativi visibili')}</strong><p class="bk-note">${t('Il nominativo compare sotto Occupato e nel riepilogo. Puoi annullare gli appuntamenti dall’elenco sotto il calendario.')}</p><a href="${dashboard?'/prenotazioni':'/statistiche'}?lang=${lang}${esc(w.location.hash)}">${dashboard?t('Apri calendario ↗'):t('Apri statistiche ↗')}</a><button type="button" data-show-bookings>${t('Gestisci appuntamenti ↓')}</button></div>
 <div class="bk-legend"><span class="bk-tag bk-free">● ${t('Disponibile')}</span><span class="bk-tag bk-busy">● ${t('Occupato')}</span><span class="bk-tag bk-closed">● ${t('Non disponibile')}</span></div>
 ${admin?`<div class="bk-managebar"><button type="button" data-admin-link>${t('Copia il mio link di gestione')}</button><a href="/prenotazioni?lang=${lang}">${t('Apri calendario pubblico ↗')}</a></div><details class="bk-box bk-settings"><summary>${t('Giorni e orari disponibili')}</summary><p class="bk-note">${t('Il sabato è aperto dalle 10:00 alle 17:00 e tutte le domeniche dalle 17:00 alle 20:00. Puoi scegliere anche domeniche alterne o chiuderle. Puoi modificare una singola data, anche per Bergamo. Le prenotazioni già inserite restano occupate finché non le sposti o annulli.')}</p><form data-settings><div class="bk-row"><label>${t('Inizio del sabato')}<select name="saturday"><option value="">${t('Da impostare · chiuso')}</option></select></label><label>${t('Domeniche')}<select name="sundayMode"><option value="weekly">${t('Tutte le domeniche')}</option><option value="alternate">${t('A domeniche alterne')}</option><option value="closed">${t('Non disponibili')}</option></select></label></div><div class="bk-row"><label data-sunday-anchor hidden>${t('Prima domenica aperta')}<input name="sunday" type="date"></label></div><button class="bk-primary" type="submit">${t('Salva orari ricorrenti')}</button></form><form data-exception><h3>${t('Modifica una singola giornata')}</h3><div class="bk-row"><label>${t('Data')}<input name="day" type="date" required></label><label>${t('Disponibilità')}<select name="state"><option value="closed">${t('Non disponibile')}</option><option value="open">${t('Disponibile')}</option><option value="reset">${t('Ripristina orari ricorrenti')}</option></select></label></div><div class="bk-row"><label>${t('Dalle')}<input name="start" type="time" step="1800" value="17:00"></label><label>${t('Alle')}<input name="end" type="time" step="1800" value="20:00"></label></div><label>${t('Zona')}<select name="zone"><option value="all">${t('Zone abituali')}</option><option value="bergamo">Bergamo</option></select></label><button type="submit">${t('Salva giornata')}</button></form><div class="bk-settings-list" data-exceptions></div></details>`:''}
 <div class="bk-message" role="status" aria-live="polite" data-message hidden></div>
 <div class="bk-layout"><section class="bk-box" aria-label="${t('Calendario delle disponibilità')}"><div class="bk-weeknav"><strong data-period></strong><div><button type="button" data-prev aria-label="${t('Settimana precedente')}">←</button><button type="button" data-next aria-label="${t('Settimana successiva')}">→</button><button type="button" data-refresh aria-label="${t('Aggiorna calendario')}">↻</button></div></div><div class="bk-days" data-days></div><h2 class="bk-day-title" data-day-title></h2><p class="bk-note" data-day-note></p><div class="bk-slots" data-slots></div><p class="bk-status" data-status aria-live="polite"></p><p class="bk-note">${t('Ogni riquadro indica inizio e fine della mezz’ora. Lo spostamento, in blu, occupa solo i 30 minuti dopo la fine della lezione. Orari italiani.')}</p><section class="bk-overview" aria-label="${t('Prenotazioni attive')}"><strong class="bk-overview-total" data-active-count role="status" aria-live="polite">${t('Caricamento del riepilogo…')}</strong><p class="bk-note" data-active-note>${t('Totale di oggi e dei giorni futuri, anche fuori dalla settimana visualizzata. Le prenotazioni di oggi restano nel conteggio fino a fine giornata; quelle annullate sono escluse.')}</p><div class="bk-active-days" data-active-days></div></section></section>
 <section class="bk-box"><form class="bk-form" data-form><h2 data-form-title>${t('Inserisci la prenotazione')}</h2><label>${t('Nominativo (obbligatorio)')}<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>${t('Data')}<input name="day" type="date" required min="${today}" max="${shiftDay(today,MAX_DAYS)}" value="${selectedDay}"></label><div class="bk-row"><label>${t('Durata')}<select name="duration">${(dashboard?Array.from({length:21},(_,i)=>60+i*30):[60,90,120]).map(n=>`<option value="${n}">${Math.floor(n/60)} h${n%60?' 30 min':''}</option>`).join('')}</select></label><label>${t('Ora iniziale')}<select name="start" required><option value="">${t('Scegli un orario verde')}</option></select></label></div><p class="bk-note" data-summary></p><button type="submit" class="bk-primary" data-save disabled>${t('Occupa questo orario')}</button><div class="bk-buttons" data-edit-actions hidden><button type="button" data-stop-edit>${t('Chiudi modifica')}</button><button type="button" class="bk-danger" data-cancel>${t('Annulla prenotazione')}</button></div><p class="bk-note">${t('Il nominativo è visibile a Oscar e a chi possiede il tuo link personale. Gli altri visitatori vedono soltanto gli orari occupati.')}</p><p class="bk-note">${t('Conserva il link personale: serve per modificare o annullare anche da un altro dispositivo. Non vengono inviate notifiche automatiche.')}</p></form><div class="bk-link" data-personal-link hidden><label>${t('Il tuo link personale')}<input readonly data-link-value></label><div class="bk-buttons"><button type="button" data-copy-link>${t('Copia link personale')}</button></div></div></section></div>
 <section class="bk-box bk-mine"><h2>${ownerView?t('Prenotazioni di oggi e future'):t('Le tue prenotazioni su questo dispositivo')}</h2><p class="bk-note">${ownerView?t('Usa Annulla appuntamento accanto al nominativo. L’orario si libera dopo la tua conferma.'):t('Qui ritrovi le prenotazioni aperte con i tuoi link su questo dispositivo.')}</p><div data-bookings></div></section>`;
 root.querySelectorAll('.bk-languages a').forEach(a=>a.addEventListener('click',()=>{try{w.localStorage.setItem('adg-language',new URL(a.href).searchParams.get('lang'))}catch{}}));
 const form=$('[data-form]'),field=n=>form.elements.namedItem(n);root.addEventListener('invalid',e=>{const f=e.target;f.setCustomValidity(f.validity.valueMissing?t('Compila questo campo.'):t('Controlla questo campo e inserisci un valore valido.'))},true);for(const type of ['input','change'])root.addEventListener(type,e=>{if(e.target.setCustomValidity)e.target.setCustomValidity('')});
 $('[data-show-bookings]').addEventListener('click',()=>$('.bk-mine').scrollIntoView({behavior:'smooth',block:'start'}));
 $('[data-prev]').disabled=true;$('[data-next]').disabled=true;
 function message(text,error=false){const el=$('[data-message]');el.textContent=text;el.dataset.error=String(error);el.hidden=!text;}
 async function api(path='',method='GET',body,token=''){
  const response=await w.fetch('/api/prenotazioni'+path,{method,cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(method==='GET'?{}:{'Content-Type':'application/json','X-Booking-Request':'1'})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok){const error=new Error(t(errors[result.error]||errors.unavailable));error.code=result.error;throw error;}return result;
 }
 function matchesSelf(b){return editing&&b.day===editing.day&&b.start===editing.start&&b.end===editing.end;}
 function planningRows(){return (data?.bookings||[]).filter(b=>!matchesSelf(b));}
 function duration(){return Number(field('duration').value);}
 function possible(start){return !!data&&!stale&&fits(data.schedule,planningRows(),selectedDay,start,duration(),data.now);}
 function renderFormOptions(){
  const select=field('start');select.setCustomValidity('');field('day').setCustomValidity('');select.replaceChildren(new w.Option(t('Scegli un orario verde'),''));
  const window=data&&dayWindow(data.schedule,selectedDay);
  if(window)for(let m=window.start;m<window.end;m+=30)if(possible(m))select.add(new w.Option(clock(m),String(m)));
  if(selectedStart!==null&&possible(selectedStart))select.value=String(selectedStart);else{selectedStart=null;select.value='';}
  $('[data-save]').disabled=saving||stale||selectedStart===null||(admin&&!editing);
  $('[data-summary]').textContent=selectedStart===null?t('Seleziona una fascia verde adatta alla durata scelta.'):fmt(selectedDay)+' · '+clock(selectedStart)+' – '+clock(selectedStart+duration());
 }
 function renderCalendar(){
  if(!data)return;
  $('[data-period]').textContent=fmt(from,{day:'numeric',month:'short'})+' – '+fmt(data.to,{day:'numeric',month:'short',year:'numeric'});
  $('[data-prev]').disabled=from<=data.now.day;$('[data-next]').disabled=shiftDay(from,7)>data.limit;
  const days=$('[data-days]');days.replaceChildren();
  for(let day=from;day<=data.to;day=shiftDay(day,1)){
   const available=dayWindow(data.schedule,day),busy=data.bookings.some(b=>b.day===day),button=E('button',null,'bk-day '+(available?'bk-free':busy?'bk-busy':'bk-closed'));
   button.type='button';button.setAttribute('aria-pressed',String(day===selectedDay));button.setAttribute('aria-label',fmt(day));button.append(E('span',fmt(day,{weekday:'short'})),E('strong',day.slice(8)));
   const count=data.bookings.filter(b=>b.day===day).length;if(count){button.classList.add('bk-has-bookings');const badge=E('small',String(count),'bk-day-count');const label=count===1?t('1 prenotazione'):t('{n} prenotazioni').replace('{n}',count);badge.setAttribute('aria-hidden','true');button.setAttribute('aria-label',fmt(day)+': '+label);button.append(badge);}
   const dots=E('span',null,'bk-dots');if(available)dots.append(E('i'));if(busy)dots.append(E('i',null,'bk-busy'));button.append(dots);
   button.addEventListener('click',()=>{selectedDay=day;field('day').value=day;selectedStart=null;renderCalendar();});days.append(button);
  }
  $('[data-day-title]').textContent=fmt(selectedDay);const window=dayWindow(data.schedule,selectedDay);
  $('[data-day-note]').textContent=window?(clock(window.start)+' – '+clock(window.end)+(window.zone==='bergamo'?' · Bergamo':'')):t('Nessuna fascia disponibile in questa giornata.');
  const slots=$('[data-slots]');slots.replaceChildren();
  const start=Math.min(window?.start??540,...data.bookings.filter(b=>b.day===selectedDay).map(b=>b.start)),end=Math.max(window?.end??1200,...data.bookings.filter(b=>b.day===selectedDay).map(b=>b.end+GAP));
  for(let m=start;m<end;m+=30){
   const state=slotState(data.schedule,data.bookings,selectedDay,m,data.now),can=possible(m),label=state==='busy'?t('Occupato'):state==='buffer'?t('Spostamento'):state==='free'?t('Disponibile'):t('Non disponibile');
   const button=E('button',null,'bk-slot bk-'+state);button.type='button';button.disabled=!can;button.setAttribute('aria-pressed',String(m===selectedStart));button.setAttribute('aria-label',clock(m)+' – '+clock(m+30)+': '+label);button.append(E('strong',clock(m)+'–'+clock(m+30),'bk-slot-range'),E('small',label));
   const booked=state==='busy'?data.bookings.find(b=>b.day===selectedDay&&b.start<=m&&b.end>m):null;
   if(booked?.name){button.append(E('span',booked.name,'bk-slot-name'));button.setAttribute('aria-label',button.getAttribute('aria-label')+' · '+booked.name);}
   if(state==='free'&&!can)button.title=t('La durata scelta non entra in questa fascia.');
   button.addEventListener('click',()=>{selectedStart=m;renderCalendar();if(w.innerWidth<850)form.scrollIntoView({behavior:'smooth',block:'start'});field('name').focus({preventScroll:true});});slots.append(button);
  }
  renderFormOptions();
 }
 function renderOverview(){
  const summary=data?.activeSummary,host=$('[data-active-days]');host.replaceChildren();
  $('[data-active-count]').textContent=summary?(summary.count===0?t('Nessuna prenotazione attiva'):summary.count===1?t('1 prenotazione attiva'):t('{n} prenotazioni attive').replace('{n}',summary.count)):(stale?t('Riepilogo non disponibile'):t('Caricamento del riepilogo…'));
  $('[data-active-note]').textContent=stale?t('Riepilogo non aggiornato. Premi Aggiorna calendario per riprovare.'):t('Totale di oggi e dei giorni futuri, anche fuori dalla settimana visualizzata. Le prenotazioni di oggi restano nel conteggio fino a fine giornata; quelle annullate sono escluse.');
  $('[data-active-count]').closest('.bk-overview').classList.toggle('bk-overview-stale',stale);
  for(const row of summary?.days||[]){
   const button=E('button',null,'bk-active-day');button.type='button';button.disabled=stale;
   button.append(E('span',fmt(row.day)),E('strong',row.count===1?t('1 prenotazione'):t('{n} prenotazioni').replace('{n}',row.count)),E('small',t('Vedi giorno →')));
   if(data.namesVisible){const names=E('span',null,'bk-overview-names');for(const booking of data.upcomingBookings.filter(b=>b.day===row.day))names.append(E('span',clock(booking.start)+' – '+clock(booking.end)+' · '+booking.name));button.append(names);}
   button.addEventListener('click',async()=>{selectedDay=row.day;selectedStart=null;field('day').value=row.day;if(row.day<from||row.day>data.to){from=row.day;await refresh();}else renderCalendar();$('[data-day-title]').scrollIntoView({behavior:'smooth',block:'center'});});
   host.append(button);
  }
 }
 function showLink(token){const box=$('[data-personal-link]');box.hidden=!token;if(token)$('[data-link-value]').value=linkFor(token);}
 function resetEdit(){editing=null;selectedStart=null;field('name').value='';$('[data-edit-actions]').hidden=true;$('[data-form-title]').textContent=t('Inserisci la prenotazione');$('[data-save]').textContent=t('Occupa questo orario');showLink(null);renderCalendar();}
 async function editBooking(booking){
  if(!booking.active){message(t('La prenotazione è stata annullata.'));return;}
  editing=booking;selectedDay=booking.day;selectedStart=booking.start;field('day').value=booking.day;field('name').value=booking.name;field('duration').value=String(booking.end-booking.start);
  $('[data-form-title]').textContent=t('Modifica prenotazione');$('[data-save]').textContent=t('Salva modifiche');$('[data-edit-actions]').hidden=false;showLink(admin?null:booking.token);
  if(!data||booking.day<from||booking.day>data.to){from=booking.day;await refresh();}else renderCalendar();
  if(w.innerWidth<850)form.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderList(){
  const host=$('[data-bookings]');host.replaceChildren();const rows=ownerView?(data?.upcomingBookings||[]):mine;
  if(!rows.length){host.append(E('p',t('Nessuna prenotazione da mostrare.'),'bk-empty'));return;}
  for(const booking of rows){
   const row=E('article',null,'bk-booking'),copy=E('div');copy.append(E('strong',booking.name),E('small',fmt(booking.day)+' · '+clock(booking.start)+' – '+clock(booking.end)));
   if(!booking.active)copy.append(E('small',t('Annullata')));
   const buttons=E('div',null,'bk-buttons');if(booking.active&&(!ownerView||admin)){const edit=E('button',t('Modifica'));edit.type='button';edit.addEventListener('click',()=>editBooking(booking));buttons.append(edit);}
   if(booking.active&&(ownerView?data?.canCancel:tokenOK(booking.token))){const cancel=E('button',t('Annulla appuntamento'),'bk-danger');cancel.type='button';cancel.dataset.cancelBooking=booking.id;cancel.disabled=stale||saving;cancel.addEventListener('click',()=>cancelFromList(booking));buttons.append(cancel);}
   if(!ownerView){const link=E('button',t('Link personale'));link.type='button';link.addEventListener('click',()=>{showLink(booking.token);$('[data-personal-link]').scrollIntoView({behavior:'smooth',block:'center'});});buttons.append(link);}
   row.append(copy,buttons);host.append(row);
  }
 }
 async function loadMine(){
  if(ownerView){renderList();return;}
  const results=await Promise.allSettled(tokens.map(async token=>{const r=await api('?mode=mine','GET',undefined,token);return r.booking?{...r.booking,token}:null;}));
  mine=results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value).sort((a,b)=>a.day.localeCompare(b.day)||a.start-b.start);renderList();
 }
 function renderSettings(){
  if(!admin||!data)return;const f=$('[data-settings]');
  if(!f.contains(d.activeElement)){f.elements.saturday.value=data.schedule.saturdayStart===null?'':String(data.schedule.saturdayStart);f.elements.sundayMode.value=sundayMode(data.schedule);f.elements.sunday.value=data.schedule.sundayAnchor||'';$('[data-sunday-anchor]').hidden=f.elements.sundayMode.value!=='alternate';f.elements.sunday.required=f.elements.sundayMode.value==='alternate';}
  const host=$('[data-exceptions]');host.replaceChildren();
  for(const [day,window] of Object.entries(data.schedule.exceptions).sort(([a],[b])=>a.localeCompare(b))){const row=E('div'),text=E('span',fmt(day)+': '+(window?clock(window.start)+'–'+clock(window.end)+(window.zone==='bergamo'?' · Bergamo':''):t('Non disponibile')));const remove=E('button',t('Ripristina'));remove.type='button';remove.addEventListener('click',()=>{const exceptions={...data.schedule.exceptions};delete exceptions[day];saveSchedule({...data.schedule,exceptions});});row.append(text,remove);host.append(row);}
 }
 async function refresh(){
  const seq=++sequence;$('[data-status]').textContent=t('Aggiornamento del calendario…');
  try{
   const currentDay=romeNow().day,last=shiftDay(currentDay,MAX_DAYS);
   if(from<currentDay)from=currentDay;if(selectedDay<currentDay){selectedDay=currentDay;selectedStart=null;field('day').value=currentDay;}field('day').min=currentDay;field('day').max=last;
   const to=shiftDay(from,6)>last?last:shiftDay(from,6);
   const result=await api('?'+new URLSearchParams({from,to,mode:admin?'admin':readKey?'names':'public'}),'GET',undefined,admin?key:readKey);if(seq!==sequence)return;
   data=result;stale=false;$('[data-owner-view]').hidden=!data.namesVisible;renderCalendar();renderOverview();renderSettings();renderList();
   if(syncError){message('');syncError=false;}
   $('[data-status]').textContent=t('Aggiornato alle')+' '+new Date(result.updatedAt).toLocaleTimeString(locale,{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'})+' · '+t('Ora italiana');
  }catch(error){if(seq!==sequence)return;stale=true;renderCalendar();renderOverview();renderFormOptions();renderList();$('[data-status]').textContent=t('Dati non aggiornati: riprova prima di prenotare.');syncError=true;message(t(errors[error.code]||errors.unavailable),true);}
 }
 async function perform(action){
  if(saving)return;saving=true;root.setAttribute('aria-busy','true');renderFormOptions();renderList();message('');
  try{await action();}catch(error){message(t(errors[error.code]||errors.unavailable),true);if(['changed','conflict','cancelled','closed_time'].includes(error.code)){resetEdit();await Promise.all([refresh(),loadMine()]);}}
  finally{saving=false;root.setAttribute('aria-busy','false');renderFormOptions();renderList();}
 }
 async function cancelFromList(booking){
  if(stale||saving||!booking.active||(ownerView?!data?.canCancel:!tokenOK(booking.token)))return;
  const question=t('Annullare l’appuntamento di {name} del {date}, dalle {start} alle {end}? L’orario tornerà disponibile.').replace('{name}',booking.name).replace('{date}',fmt(booking.day)).replace('{start}',clock(booking.start)).replace('{end}',clock(booking.end));
  if(!w.confirm(question))return;
  await perform(async()=>{
   await api(admin?'?mode=admin':ownerView?'?mode=names':'','DELETE',{id:booking.id,revision:booking.revision},admin?key:ownerView?readKey:booking.token);
   if(editing?.id===booking.id)resetEdit();
   await Promise.all([refresh(),loadMine()]);
   message(t('Prenotazione annullata. La fascia è di nuovo libera.'));
  });
 }
 async function saveSchedule(schedule){await perform(async()=>{await api('?mode=settings','PUT',{schedule,revision:data.revision},key);await refresh();message(t('Disponibilità aggiornate. Le prenotazioni esistenti sono state conservate.'));});}
 form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity()||selectedStart===null||stale)return;perform(async()=>{
  let token=admin?key:(editing?.token||draftToken);
  if(!token){token=[...w.crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');draftToken=token;tokens=[...new Set([...tokens,token])].slice(-12);store.set('adg-booking-links',tokens);}
  const payload={name:field('name').value,day:selectedDay,start:selectedStart,duration:duration(),...(editing?{id:editing.id,revision:editing.revision}:{})};
  const result=await api(admin?'?mode=admin':'',editing?'PUT':'POST',payload,token);
  draftToken=null;resetEdit();await Promise.all([refresh(),loadMine()]);showLink(admin?null:token);message(t('Prenotazione salvata. Il calendario è aggiornato.'));
  if(!admin)w.history.replaceState(null,'','#prenotazione='+token);
 });});
 $('[data-cancel]').addEventListener('click',()=>{if(!editing||!w.confirm(t('Vuoi annullare questa prenotazione e liberare l’orario?')))return;perform(async()=>{await api(admin?'?mode=admin':'','DELETE',{id:editing.id,revision:editing.revision},admin?key:editing.token);resetEdit();await Promise.all([refresh(),loadMine()]);message(t('Prenotazione annullata. La fascia è di nuovo libera.'));});});
 $('[data-stop-edit]').addEventListener('click',resetEdit);
 field('duration').addEventListener('change',()=>{selectedStart=null;renderCalendar();});
 field('start').addEventListener('change',()=>{selectedStart=field('start').value===''?null:Number(field('start').value);renderCalendar();});
 field('day').addEventListener('change',async()=>{if(!field('day').reportValidity())return;selectedDay=field('day').value;selectedStart=null;if(!data||selectedDay<from||selectedDay>data.to){from=selectedDay;await refresh();}else renderCalendar();});
 $('[data-prev]').addEventListener('click',()=>{if(!data)return;from=shiftDay(from,-7)<data.now.day?data.now.day:shiftDay(from,-7);selectedDay=from;field('day').value=from;selectedStart=null;refresh();});
 $('[data-next]').addEventListener('click',()=>{if(!data)return;from=shiftDay(from,7);selectedDay=from;field('day').value=from;selectedStart=null;refresh();});
 $('[data-refresh]').addEventListener('click',()=>Promise.all([refresh(),loadMine()]));
 async function copy(input,value){try{await w.navigator.clipboard.writeText(value);message(t('Link copiato. Conservalo per ritrovare la prenotazione.'));}catch{input.focus();input.select();message(t('Seleziona il link e scegli Copia.'));}}
 $('[data-copy-link]').addEventListener('click',()=>copy($('[data-link-value]'),$('[data-link-value]').value));
 if(admin){
  const f=$('[data-settings]');
  f.elements.sundayMode.addEventListener('change',()=>{$('[data-sunday-anchor]').hidden=f.elements.sundayMode.value!=='alternate';f.elements.sunday.required=f.elements.sundayMode.value==='alternate';});for(let m=360;m<=720;m+=30)f.elements.saturday.add(new w.Option(clock(m),String(m)));
  f.addEventListener('submit',e=>{e.preventDefault();if(data)saveSchedule({...data.schedule,saturdayStart:f.elements.saturday.value===''?null:Number(f.elements.saturday.value),sundayMode:f.elements.sundayMode.value,sundayAnchor:f.elements.sundayMode.value==='alternate'?(f.elements.sunday.value||null):null});});
  $('[data-exception]').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!data||!f.reportValidity())return;const day=f.elements.day.value,state=f.elements.state.value,exceptions={...data.schedule.exceptions};const minutes=s=>s.split(':').map(Number).reduce((h,m)=>h*60+m);
   if(state==='reset')delete exceptions[day];else exceptions[day]=state==='closed'?null:{start:minutes(f.elements.start.value),end:minutes(f.elements.end.value),zone:f.elements.zone.value};saveSchedule({...data.schedule,exceptions});
  });
  $('[data-admin-link]').addEventListener('click',()=>{const box=$('[data-personal-link]');box.hidden=false;const input=$('[data-link-value]');input.value=w.location.origin+'/statistiche?lang='+lang+'#gestione='+key;copy(input,input.value);});
 }
 const ready=(async()=>{await Promise.all([refresh(),loadMine()]);const shared=mine.find(b=>b.token===fragment.get('prenotazione'));if(shared)await editBooking(shared);if(admin&&data&&data.schedule.saturdayStart===null&&sundayMode(data.schedule)==='closed'){$('.bk-settings').open=true;message(t('Completa gli orari qui sopra per aprire le disponibilità. Fino ad allora i giorni restano blu.'));}})();
 const timer=w.setInterval(()=>{if(!d.hidden&&!saving){refresh();if(!admin)loadMine();}},30000);
 const focus=()=>{if(!saving){refresh();loadMine();}};w.addEventListener('focus',focus);
 return {ready,refresh,destroy(){w.clearInterval(timer);w.removeEventListener('focus',focus);}};
}
if(typeof document!=='undefined'){const root=document.getElementById('booking-app');if(root)mountBooking(root);}
