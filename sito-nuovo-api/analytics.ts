export const RETENTION_DAYS = 400;
const HOUR = 3600000, DAY = 24 * HOUR;
const localFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
export function localParts(timestamp: number) {
  const p = Object.fromEntries(localFormat.formatToParts(timestamp).map(p => [p.type, p.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export function shiftDay(day: string, offset: number) {
  return new Date(Date.parse(day + 'T12:00:00Z') + offset * DAY).toISOString().slice(0, 10);
}
export function isAllowedIdentity(request: Request, ownerEmail?: string) {
  const id = request.headers.get('oai-authenticated-user-id'), email = request.headers.get('oai-authenticated-user-email');
  return !!(id && email && ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase());
}
export function deviceType(ua: string) {
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'Tablet';
  if (/mobile|iphone|ipod|android|windows phone/i.test(ua)) return 'Cellulare';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'Computer';
  return 'Non riconosciuto';
}
export function sourceType(request: Request) {
  const url = new URL(request.url), tagged = (url.searchParams.get('utm_source') || '').toLowerCase();
  const known: Record<string, string> = { whatsapp: 'WhatsApp (link dedicato)', superprof: 'Superprof (link dedicato)', facebook: 'Facebook (link dedicato)', instagram: 'Instagram (link dedicato)' };
  if (known[tagged]) return known[tagged];
  try {
    const host = new URL(request.headers.get('referer') || '').hostname.toLowerCase();
    if (host === url.hostname) return 'Navigazione interna';
    if (/(^|\.)google\.(com|it|fr|de|es|ch|at|be|nl|pt|co\.uk|com\.au|ca|co\.in|co\.jp)$/.test(host)) return 'Google';
    for (const [domain, label] of [['bing.com','Bing'],['superprof.it','Superprof'],['superprof.com','Superprof'],['facebook.com','Facebook'],['instagram.com','Instagram'],['youtube.com','YouTube'],['linkedin.com','LinkedIn'],['duckduckgo.com','DuckDuckGo'],['t.co','X']]) {
      if (host === domain || host.endsWith('.' + domain)) return label;
    }
    return 'Altro sito';
  } catch { return 'Diretto / non disponibile'; }
}
type Geo = { country?: string | null; region?: string | null; botManagement?: { verifiedBot?: boolean; score?: number } };
export function regionType(cf?: Geo) {
  if (!cf?.country || !/^[A-Z]{2}$/.test(cf.country) || cf.country === 'XX') return 'Non disponibile';
  let country = cf.country;
  try { country = new Intl.DisplayNames(['it'], { type: 'region' }).of(cf.country) || country; } catch {}
  const region = cf.region?.replace(/[^\p{L}\p{N} .,'’()-]/gu, '').trim().slice(0, 60);
  return region ? `${country} · ${region}` : country;
}
export function countableBrowser(request: Request, ownerEmail?: string) {
  if (isAllowedIdentity(request, ownerEmail)) return false;
  if (request.headers.has('cf-brapi-devtools') || /cloudflare-browser-rendering/.test(request.headers.get('signature-agent') || '')) return false;
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return false;
  if (/prefetch|prerender/i.test((request.headers.get('purpose') || '') + (request.headers.get('sec-purpose') || ''))) return false;
  const ua = request.headers.get('user-agent') || '';
  if (!/Mozilla\//i.test(ua) || /bot|spider|crawler|slurp|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegrambot|preview|curl|wget|python|monitor|uptime/i.test(ua)) return false;
  const cf = (request as any).cf as Geo | undefined;
  if (cf?.botManagement?.verifiedBot || (cf?.botManagement?.score != null && cf.botManagement.score < 30)) return false;
  return true;
}
export function shouldCount(request: Request, ownerEmail?: string) {
  if (request.method !== 'GET' || !['/', '/en', '/es', '/en/', '/es/', '/fr', '/fr/'].includes(new URL(request.url).pathname)) return false;
  const dest = request.headers.get('sec-fetch-dest');
  if (dest && dest !== 'document') return false;
  if (!request.headers.get('accept')?.includes('text/html')) return false;
  return countableBrowser(request, ownerEmail);
}
export const ACTIONS = ['whatsapp', 'configurator', 'superprof'] as const;
export type Action = typeof ACTIONS[number];
export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}
export async function recordAction(db: any, action: Action, now = Date.now()) {
  if (!isAction(action)) throw new Error('Invalid action');
  const day = localParts(now).day;
  await db.batch([
    db.prepare("INSERT INTO analytics_meta (key,value) VALUES ('actions_started_at',?) ON CONFLICT DO NOTHING").bind(new Date(now).toISOString()),
    db.prepare('INSERT INTO analytics_actions(day,action,clicks) VALUES (?,?,1) ON CONFLICT(day,action) DO UPDATE SET clicks=analytics_actions.clicks+1').bind(day,action),
    db.prepare('DELETE FROM analytics_actions WHERE day < ?').bind(shiftDay(day,-RETENTION_DAYS+1)),
  ]);
}
export async function recordView(request: Request, db: any, now = Date.now()) {
  const bucket = Math.floor(now / HOUR) * HOUR, day = localParts(now).day;
  const cutoff = Math.floor((now - RETENTION_DAYS * DAY) / HOUR) * HOUR;
  const dimensions = [['device', deviceType(request.headers.get('user-agent') || '')], ['region', regionType({ ...((request as any).cf as Geo | undefined), country: ((request as any).cf as Geo | undefined)?.country || request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') })], ['source', sourceType(request)]];
  await db.batch([
    db.prepare("INSERT INTO analytics_meta (key,value) VALUES ('started_at',?) ON CONFLICT DO NOTHING").bind(new Date(now).toISOString()),
    db.prepare('INSERT INTO analytics_hours(bucket,views) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET views=analytics_hours.views+1').bind(bucket),
    ...dimensions.map(([dimension, value]) => db.prepare('INSERT INTO analytics_dimensions(day,dimension,value,views) VALUES (?,?,?,1) ON CONFLICT(day,dimension,value) DO UPDATE SET views=analytics_dimensions.views+1').bind(day, dimension, value)),
    db.prepare('DELETE FROM analytics_hours WHERE bucket < ?').bind(cutoff),
    db.prepare('DELETE FROM analytics_dimensions WHERE day < ?').bind(localParts(cutoff).day),
    db.prepare('DELETE FROM analytics_actions WHERE day < ?').bind(shiftDay(day,-RETENTION_DAYS+1)),
  ]);
}
export function parseRange(url: URL, now = Date.now()) {
  const today = localParts(now).day;
  const from = url.searchParams.get('from') || today.slice(0, 8) + '01', to = url.searchParams.get('to') || today;
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if (!valid(from) || !valid(to) || from > to || to > today || from < shiftDay(today, -RETENTION_DAYS + 1) || Date.parse(to) - Date.parse(from) > 365 * DAY) throw new Error('Scegli un periodo valido, fino a 366 giorni, entro gli ultimi 400 giorni.');
  return { from, to, today };
}
type HourRow = { bucket: number; views: number };
export function summarize(hours: HourRow[], from: string, to: string, now = Date.now()) {
  const today = localParts(now).day, yesterday = shiftDay(today,-1), month = today.slice(0,7);
  const daily = new Map<string, number>();
  for (let d = from; d <= to; d = shiftDay(d, 1)) daily.set(d, 0);
  const monthly = new Map<string, number>(), monthBase = new Date(today.slice(0,7) + '-01T12:00:00Z');
  for (let n = 11; n >= 0; n--) { const d = new Date(monthBase); d.setUTCMonth(d.getUTCMonth() - n); monthly.set(d.toISOString().slice(0,7),0); }
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 }));
  let todayViews = 0, yesterdayViews = 0, monthViews = 0, selectedViews = 0;
  for (const row of hours) {
    if (row.bucket > now) continue;
    const { day, hour } = localParts(row.bucket), views = Number(row.views);
    if (day === today) todayViews += views;
    if (day === yesterday) yesterdayViews += views;
    if (day.startsWith(month)) monthViews += views;
    if (monthly.has(day.slice(0,7))) monthly.set(day.slice(0,7),monthly.get(day.slice(0,7))! + views);
    if (day >= from && day <= to) { selectedViews += views; daily.set(day,(daily.get(day) || 0) + views); hourly[hour].views += views; }
  }
  return { todayViews, yesterdayViews, monthViews, selectedViews, daily: [...daily].map(([day,views])=>({day,views})), hourly, monthly: [...monthly].map(([month,views])=>({month,views})) };
}
export async function report(db: any, range: ReturnType<typeof parseRange>, now = Date.now()) {
  const cutoff = Math.floor((now - RETENTION_DAYS * DAY) / HOUR) * HOUR;
  await db.batch([db.prepare('DELETE FROM analytics_hours WHERE bucket < ?').bind(cutoff),db.prepare('DELETE FROM analytics_dimensions WHERE day < ?').bind(localParts(cutoff).day),db.prepare('DELETE FROM analytics_actions WHERE day < ?').bind(shiftDay(localParts(now).day,-RETENTION_DAYS+1))]);
  const data = await db.batch([
    db.prepare('SELECT bucket::float8 AS bucket, views FROM analytics_hours WHERE bucket >= ? ORDER BY bucket').bind(cutoff),
    db.prepare('SELECT dimension,value,SUM(views)::int AS views FROM analytics_dimensions WHERE day >= ? AND day <= ? GROUP BY dimension,value ORDER BY views DESC').bind(range.from,range.to),
    db.prepare("SELECT value FROM analytics_meta WHERE key='started_at'"),
    db.prepare('SELECT action,SUM(clicks)::int AS clicks FROM analytics_actions WHERE day >= ? AND day <= ? GROUP BY action').bind(range.from,range.to),
    db.prepare("SELECT value FROM analytics_meta WHERE key='actions_started_at'"),
  ]);
  return { ...summarize(data[0].results as HourRow[],range.from,range.to,now), range,
    dimensions: data[1].results, startedAt: (data[2].results[0] as {value:string} | undefined)?.value || null,
    actions: ACTIONS.map(action => ({ action, clicks: Number((data[3].results as {action:string;clicks:number}[]).find(row => row.action === action)?.clicks || 0) })),
    actionsStartedAt: (data[4].results[0] as {value:string} | undefined)?.value || null,
    updatedAt: new Date(now).toISOString(), timezone: 'Europe/Rome', retentionDays: RETENTION_DAYS };
}
export const ANALYTICS_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
