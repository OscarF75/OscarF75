// Accademia della Guida: bookings, statistics and anonymous event counts.
// Pure Web-API code so it runs the same on the hosting runtime and in tests.
import { d1 } from './db.ts';
import { bookingRequest, BOOKING_HEADERS } from './bookings.ts';
import { ANALYTICS_HEADERS, countableBrowser, isAction, recordAction, recordView, parseRange, report } from './analytics.ts';

export function makeHandler(sql: any, origins: string[]) {
  const db = d1(sql);
  let cached: { at: number; values: Record<string, string> } | null = null;
  async function config() {
    if (!cached || Date.now() - cached.at > 30000) {
      const rows = await sql.unsafe('SELECT key,value FROM adg_config');
      cached = { at: Date.now(), values: Object.fromEntries([...rows].map((r: any) => [r.key, r.value])) };
    }
    return cached.values;
  }
  const reply = (status: number) => new Response(null, { status, headers: ANALYTICS_HEADERS });

  async function events(request: Request) {
    if (!origins.includes(request.headers.get('origin') || '') || request.headers.get('x-analytics-event') !== '1') return reply(403);
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin') return reply(403);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415);
    if (!countableBrowser(request)) return reply(204);
    const text = await request.text();
    if (text.length > 300) return reply(413);
    let body: any;
    try { body = JSON.parse(text); } catch { return reply(400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400);
    if (body.action === 'view') {
      // One page view: only device class, country and referrer category are kept.
      const keys = Object.keys(body);
      if (keys.length > 3 || keys.some(k => !['action', 'u', 'r'].includes(k))) return reply(400);
      const tag = typeof body.u === 'string' ? body.u.slice(0, 20).replace(/[^a-z0-9_-]/gi, '') : '';
      const host = typeof body.r === 'string' && /^[a-z0-9.-]{1,80}$/i.test(body.r) ? body.r : '';
      const headers: Record<string, string> = { 'user-agent': request.headers.get('user-agent') || '' };
      if (host) headers.referer = 'https://' + host + '/';
      const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || '';
      if (country) headers['cf-ipcountry'] = country;
      await recordView(new Request(origins[0] + '/' + (tag ? '?utm_source=' + tag : ''), { headers }), db);
      return reply(204);
    }
    if (Object.keys(body).length !== 1 || !isAction(body.action)) return reply(400);
    await recordAction(db, body.action);
    return reply(204);
  }

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^.*\/adg(?=\/|$)/, '').replace(/\/+$/, '');
    try {
      if (path === '/prenotazioni') {
        const c = await config();
        return await bookingRequest(request, db, c.admin_hash, Date.now(), c.view_hash, origins);
      }
      if (path === '/statistiche' && request.method === 'GET') {
        let range;
        try { range = parseRange(url); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400, headers: ANALYTICS_HEADERS }); }
        return Response.json(await report(db, range), { headers: ANALYTICS_HEADERS });
      }
      if (path === '/eventi' && request.method === 'POST') return await events(request);
      return Response.json({ error: 'not_found' }, { status: 404, headers: BOOKING_HEADERS });
    } catch {
      return Response.json({ error: 'unavailable' }, { status: 503, headers: BOOKING_HEADERS });
    }
  };
}
