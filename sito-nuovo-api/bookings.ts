import { defaultSchedule, dayWindow, validDay, weekday, romeNow, shiftDay, MAX_DAYS, sundayMode } from './booking-rules.js';
export const BOOKING_HEADERS = {
  'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
type Window = {start:number;end:number;zone:'all'|'bergamo'};
export type Schedule = {saturdayStart:number|null;sundayMode?:'weekly'|'alternate'|'closed';sundayAnchor:string|null;exceptions:Record<string,Window|null>};
type Booking = {id:string;token_hash:string;name:string;day:string;start:number;end:number;active:number;revision:number;created_at:string;updated_at:string};
export class BookingError extends Error { code:string;status:number;constructor(code:string,status=400){super(code);this.code=code;this.status=status;} }
const fail=(code:string,status=400):never=>{throw new BookingError(code,status)};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:BOOKING_HEADERS});
export async function digest(token:string) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function tokenFor(request:Request) {const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';return /^[a-f0-9]{64}$/.test(token)?token:'';}
function cleanBooking(row:Booking) {const {token_hash,...safe}=row;return safe;}
function namedBooking(row:Booking) {return {id:row.id,revision:row.revision,day:row.day,start:row.start,end:row.end,active:row.active,name:row.name};}
function minute(value:unknown) {return typeof value==='number'&&Number.isInteger(value)&&value%30===0;}
export function validateSchedule(value:unknown):Schedule {
  if(!value||typeof value!=='object'||Array.isArray(value))return fail('invalid_schedule');
  const s=value as Schedule;
  if(s.sundayMode!==undefined&&!['weekly','alternate','closed'].includes(s.sundayMode))return fail('invalid_schedule');
  const mode=sundayMode(s);
  if(!['weekly','alternate','closed'].includes(mode))return fail('invalid_schedule');
  if(s.saturdayStart!==null && (!minute(s.saturdayStart)||s.saturdayStart<360||s.saturdayStart>720))return fail('invalid_schedule');
  if(s.sundayAnchor!==null && (!validDay(s.sundayAnchor)||weekday(s.sundayAnchor)!==0))return fail('invalid_schedule');
  if(mode==='alternate'&&!s.sundayAnchor)return fail('invalid_schedule');
  if(!s.exceptions||typeof s.exceptions!=='object'||Array.isArray(s.exceptions)||Object.keys(s.exceptions).length>366)return fail('invalid_schedule');
  const exceptions:Record<string,Window|null>={};
  for(const [day,w] of Object.entries(s.exceptions)){
    if(!validDay(day)||![0,6].includes(weekday(day)))return fail('invalid_schedule');
    if(w===null){exceptions[day]=null;continue;}
    const min=weekday(day)===6?360:1020,max=weekday(day)===6?1020:1200;
    if(!w||!minute(w.start)||!minute(w.end)||w.start<min||w.end>max||w.end-w.start<60||!['all','bergamo'].includes(w.zone))return fail('invalid_schedule');
    exceptions[day]={start:w.start,end:w.end,zone:w.zone};
  }
  return {saturdayStart:s.saturdayStart,sundayMode:mode,sundayAnchor:mode==='alternate'?s.sundayAnchor:null,exceptions};
}
async function settings(db:any){
  const row=await db.prepare('SELECT value,revision FROM booking_settings WHERE id=1').first<{value:string;revision:number}>();
  return {schedule:row?JSON.parse(row.value) as Schedule:defaultSchedule as Schedule,revision:row?.revision||0};
}
async function body(request:Request,origins?:string[]){
  const origin=request.headers.get('Origin')||'';
  if(!(origins?origins.includes(origin):origin===new URL(request.url).origin) || request.headers.get('X-Booking-Request')!=='1' || request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('forbidden',403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return fail('invalid_request',415);
  const reader=request.body?.getReader();if(!reader)return fail('invalid_request');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32000){await reader.cancel();return fail('too_large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{const result=JSON.parse(new TextDecoder().decode(bytes));if(!result||typeof result!=='object'||Array.isArray(result))return fail('invalid_request');return result;}catch{return fail('invalid_request');}
}
const configVersion='COALESCE((SELECT revision FROM booking_settings WHERE id=1),0)=?';
const noConflict='NOT EXISTS (SELECT 1 FROM bookings b WHERE b.active=1 AND b.day=? AND b.id<>? AND b.start<? AND b."end">?)';
export async function bookingRequest(request:Request,db:any,adminHash?:string,now=Date.now(),viewerHash?:string,origins?:string[]):Promise<Response>{
  try{
    const url=new URL(request.url),token=tokenFor(request),hash=token?await digest(token):'',admin=!!(adminHash&&hash&&hash===adminHash);
    const mode=url.searchParams.get('mode')||'public',local=romeNow(now),limit=shiftDay(local.day,MAX_DAYS);
    const viewer=!!(viewerHash&&hash&&hash===viewerHash),namesVisible=admin||(mode==='names'&&viewer);
    if(mode==='admin'&&!admin)return fail('access_required',401);
    if(mode==='names'&&!namesVisible)return fail('access_required',401);
    const cancelAsOwner=viewer&&mode==='names'&&request.method==='DELETE';
    if(viewer&&!admin&&request.method!=='GET'&&!cancelAsOwner)return fail('forbidden',403);
    const config=await settings(db);
    if(request.method==='GET'){
      if(mode==='mine'){
        if(!hash)return fail('access_required',401);
        const mine=await db.prepare('SELECT * FROM bookings WHERE token_hash=?').bind(hash).first<Booking>();
        return mine?json({booking:cleanBooking(mine)}):json({booking:null});
      }
      const from=url.searchParams.get('from')||local.day,to=url.searchParams.get('to')||shiftDay(from,6);
      if(!validDay(from)||!validDay(to)||to<from||from<shiftDay(local.day,admin?-365:0)||to>limit||Date.parse(to)-Date.parse(from)>34*86400000)return fail('invalid_range');
      // The overview is independent of the visible week. Today's appointments
      // stay included until midnight in Rome, even when their time has passed.
      const queries=[
        db.prepare('SELECT * FROM bookings WHERE day>=? AND day<=? AND active=1 ORDER BY day,start').bind(from,to),
        db.prepare('SELECT day,COUNT(*)::int AS count FROM bookings WHERE active=1 AND day>=? GROUP BY day ORDER BY day').bind(local.day),
      ];
      if(namesVisible)queries.push(db.prepare('SELECT * FROM bookings WHERE active=1 AND day>=? ORDER BY day,start').bind(local.day));
      const [rows,grouped,upcoming]=await db.batch(queries);
      const days=grouped.results as {day:string;count:number}[];
      return json({from,to,now:local,limit,schedule:config.schedule,revision:config.revision,
        bookings:(rows.results as Booking[]).map(row=>admin?cleanBooking(row):namesVisible?namedBooking(row):{day:row.day,start:row.start,end:row.end,active:row.active}),
        activeSummary:{count:days.reduce((n,row)=>n+Number(row.count),0),days},
        ...(namesVisible?{namesVisible:true,canCancel:true,upcomingBookings:(upcoming.results as Booking[]).map(admin?cleanBooking:namedBooking)}:{}),
        updatedAt:new Date(now).toISOString()});
    }
    const input=await body(request,origins);
    if(!hash)return fail('access_required',401);
    if(mode==='settings'){
      if(!admin)return fail('access_required',401);
      if(request.method!=='PUT')return fail('method',405);
      const schedule=validateSchedule(input.schedule);
      if(!Number.isInteger(input.revision)||input.revision!==config.revision)return fail('changed',409);
      const result=await db.prepare('INSERT INTO booking_settings(id,value,revision) SELECT 1,?::text,1 WHERE ?::int=0 ON CONFLICT(id) DO NOTHING').bind(JSON.stringify(schedule),input.revision).run();
      if(!result.meta.changes){
        const updated=await db.prepare('UPDATE booking_settings SET value=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(schedule),input.revision).run();
        if(!updated.meta.changes)return fail('changed',409);
      }
      return json({saved:true,revision:input.revision+1});
    }
    if(!['POST','PUT','DELETE'].includes(request.method))return fail('method',405);
    const existing=(admin||cancelAsOwner)?await db.prepare('SELECT * FROM bookings WHERE id=?').bind(typeof input.id==='string'?input.id:'').first<Booking>():await db.prepare('SELECT * FROM bookings WHERE token_hash=?').bind(hash).first<Booking>();
    if(request.method==='POST'&&existing)return json({booking:cleanBooking(existing)}); // Safe retry after a lost response.
    if(request.method!=='POST'){
      if(!existing)return fail('not_found',404);
      if(!Number.isInteger(input.revision)||input.revision!==existing.revision)return fail('changed',409);
      if(existing.active!==1)return fail('cancelled',409);
    }
    if(request.method==='DELETE'){
      const result=await db.prepare('UPDATE bookings SET active=0,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND active=1').bind(new Date(now).toISOString(),existing!.id,input.revision).run();
      if(!result.meta.changes)return fail('changed',409);
      return json({booking:cleanBooking({...existing!,active:0,revision:input.revision+1,updated_at:new Date(now).toISOString()})});
    }
    if(request.method==='POST'&&admin)return fail('invalid_request');
    const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'';
    const day=input.day,start=input.start,duration=input.duration,end=start+duration;
    if(name.length<2||name.length>80||/[<>\x00-\x1f]/.test(name))return fail('invalid_name');
    if(!validDay(day)||!minute(start)||!minute(duration)||duration<60||duration>(admin?660:120))return fail('invalid_time'); // Clients: 1 h, 1 h 30 or 2 h.
    if(day<local.day||day>limit||(day===local.day&&start<=local.minute))return fail('past_time');
    const window=dayWindow(config.schedule,day);
    if(!window||start<window.start||end>window.end)return fail('closed_time',409);
    const stamp=new Date(now).toISOString(),id=existing?.id||crypto.randomUUID();
    let result;
    if(request.method==='POST'){
      result=await db.prepare(`INSERT INTO bookings(id,token_hash,name,day,start,"end",active,revision,created_at,updated_at) SELECT ?::text,?::text,?::text,?::text,?::int,?::int,1,1,?::text,?::text WHERE ${noConflict} AND ${configVersion} ON CONFLICT(token_hash) DO NOTHING`).bind(id,hash,name,day,start,end,stamp,stamp,day,id,end+30,start-30,config.revision).run();
    }else{
      result=await db.prepare(`UPDATE bookings SET name=?,day=?,start=?,"end"=?,revision=revision+1,updated_at=? WHERE id=? AND active=1 AND revision=? AND ${noConflict} AND ${configVersion}`).bind(name,day,start,end,stamp,id,input.revision,day,id,end+30,start-30,config.revision).run();
    }
    if(!result.meta.changes){
      if(request.method==='POST'){const retry=await db.prepare('SELECT * FROM bookings WHERE token_hash=?').bind(hash).first<Booking>();if(retry)return json({booking:cleanBooking(retry)});}
      return fail('conflict',409);
    }
    const saved=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first<Booking>();
    return json({booking:cleanBooking(saved!)},request.method==='POST'?201:200);
  }catch(error){
    return error instanceof BookingError?json({error:error.code},error.status):json({error:'unavailable'},503);
  }
}
