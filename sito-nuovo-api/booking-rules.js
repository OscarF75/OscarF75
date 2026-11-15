// One set of scheduling rules for the server and the public calendar.
export const GAP = 30;
export const MAX_DAYS = 180;
export const defaultSchedule = { saturdayStart: 600, sundayMode: 'weekly', sundayAnchor: null, exceptions: {} };
export function sundayMode(schedule) { return schedule.sundayMode || (schedule.sundayAnchor ? 'alternate' : 'closed'); }
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
}
export function shiftDay(day, days) { return new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10); }
export function weekday(day) { return new Date(day+'T12:00:00Z').getUTCDay(); }
export function romeNow(now=Date.now()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {day:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute)};
}
export function dayWindow(schedule,day) {
  const dow=weekday(day);
  if(dow!==6 && dow!==0)return null;
  if(Object.hasOwn(schedule.exceptions,day))return schedule.exceptions[day];
  if(dow===6 && schedule.saturdayStart!==null)return {start:schedule.saturdayStart,end:1020,zone:'all'};
  if(dow===0 && (sundayMode(schedule)==='weekly' || (sundayMode(schedule)==='alternate' && schedule.sundayAnchor && day>=schedule.sundayAnchor && Math.round((Date.parse(day)-Date.parse(schedule.sundayAnchor))/86400000)%14===0)))return {start:1020,end:1200,zone:'all'};
  return null;
}
export function fits(schedule,bookings,day,start,duration,now=romeNow(),excludeId=null) {
  const window=dayWindow(schedule,day),end=start+duration;
  if(!window || start<window.start || end>window.end || !Number.isInteger(start) || start%30 || duration<60 || duration%30)return false;
  if(day<now.day || (day===now.day && start<=now.minute))return false;
  return !bookings.some(b=>b.active!==0 && b.id!==excludeId && b.day===day && start<b.end+GAP && end>b.start-GAP);
}
export function slotState(schedule,bookings,day,start,now=romeNow()) {
  const active=bookings.filter(b=>b.active!==0 && b.day===day);
  if(active.some(b=>start<b.end && start+30>b.start))return 'busy';
  if(active.some(b=>start>=b.end && start<b.end+GAP))return 'buffer';
  const window=dayWindow(schedule,day);
  if(!window || start<window.start || start+30>window.end || day<now.day || (day===now.day && start<=now.minute))return 'closed';
  return 'free';
}
export function clock(minute) {return String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');}
