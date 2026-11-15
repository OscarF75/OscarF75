"""Costruisce il sito statico indipendente (IT/EN/ES/FR) dalla home v27.
Uso: python3 -I site.py <scratch> <origin> <uploads>"""
import sys, os, re, json, shutil, subprocess
from PIL import Image
import qrcode
S, ORIGIN, UP = sys.argv[1:4]
OLD = 'https://accademia-della-guida.oscar1975.chatgpt.site'
site = os.path.join(S, 'site'); shutil.rmtree(site, ignore_errors=True)
os.makedirs(site + '/images'); work = os.path.join(S, 'sitework'); shutil.rmtree(work, ignore_errors=True)
os.makedirs(work + '/lib'); os.makedirs(work + '/content')

def photo(src, dst, box=None, maxw=1400):
    im = Image.open(os.path.join(UP, src)).convert('RGB')
    if box: im = im.crop(box)
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(os.path.join(site, 'images', dst), quality=84, optimize=True, progressive=True)
    return im.size
hero = photo('28f20993-image.jpg', 'oscar-fumagalli-al-volante.jpg')
port = photo('80675b51-image.jpg', 'oscar-fumagalli-istruttore-di-guida.jpg', (120, 0, 960, 905))
cab = photo('44976f9b-image.png', 'oscar-fumagalli-in-cabina.jpg')
qr = qrcode.QRCode(border=2, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M); qr.add_data(ORIGIN + '/'); qr.make(fit=True)
qr.make_image().save(site + '/images/qr-accademia-della-guida.png')

h = open(os.path.join(S, 'out/app/_content/home.html'), encoding='utf-8').read()
def must(old, new, t, n=1):
    assert old in t, old[:80]; return t.replace(old, new, n)
def sub1(pat, new, t):
    r, n = re.subn(pat, lambda m: new, t, count=1, flags=re.S); assert n == 1, pat[:60]; return r
ALT_HERO = 'Oscar Fumagalli al volante, istruttore di guida'
ALT_PORT = 'Oscar Fumagalli, ritratto con occhiali e camicia bianca'
ALT_CAB = 'Oscar Fumagalli nella cabina di un mezzo pesante'
h = sub1(r'<img class="hero-photo"[^>]*>', '<img class="hero-photo" src="/images/oscar-fumagalli-al-volante.jpg" alt="%s" fetchpriority="high" width="%d" height="%d" decoding="async">' % (ALT_HERO, *hero), h)
h = sub1(r'<video class="hero-video cinematic-video".*?</video>', '', h)
h = sub1(r'<img class="personal-photo" src="/images/oscar-fumagalli-istruttore-guida-[^>]*>', '<img class="personal-photo" src="/images/oscar-fumagalli-istruttore-di-guida.jpg" alt="%s" loading="lazy" width="%d" height="%d" decoding="async">' % (ALT_PORT, *port), h)
h = sub1(r'<img class="personal-photo" src="/images/oscar-fumagalli-al-volante-eb[^>]*>', '<img class="personal-photo" src="/images/oscar-fumagalli-in-cabina.jpg" alt="%s" loading="lazy" width="%d" height="%d" decoding="async">' % (ALT_CAB, *cab), h)
h = h.replace('/images/oscar-fumagalli-al-volante-eb96b4a5ce6a.jpg', '/images/oscar-fumagalli-al-volante.jpg').replace('/images/oscar-fumagalli-istruttore-guida-e3a7b788d93c.jpg', '/images/oscar-fumagalli-istruttore-di-guida.jpg')
h = must('<meta property="og:image:width" content="1280"><meta property="og:image:height" content="1536">', '<meta property="og:image:width" content="%d"><meta property="og:image:height" content="%d">' % hero, h)
# prima versione senza calendario e senza statistiche
h = must('Sites / Cloudflare', 'Vercel / Supabase', h)
BEACON = ("(function(){try{if(navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;"
          "try{if(localStorage.getItem('adg-booking-admin'))return}catch{}"
          "var u=new URLSearchParams(location.search).get('utm_source')||'',r='';try{r=document.referrer?new URL(document.referrer).hostname:''}catch{}"
          "fetch('/api/eventi',{method:'POST',headers:{'Content-Type':'application/json','X-Analytics-Event':'1'},body:JSON.stringify({action:'view',u:u.slice(0,20),r:r.slice(0,80)}),keepalive:true,credentials:'same-origin'}).catch(function(){})}catch{}})();\n")
h = must("document.addEventListener('DOMContentLoaded',()=>{initLanguage();", BEACON + "document.addEventListener('DOMContentLoaded',()=>{initLanguage();", h)
h = must('<link rel="preconnect" href="https://images.unsplash.com">', '<link rel="preconnect" href="https://images.unsplash.com"><link rel="manifest" href="/site.webmanifest">', h)
extra = ('.hero-photo{object-position:32% 22%}.portrait-main img{object-position:center 30%}.vehicle-photo img{object-position:62% 62%}')
h = must('</style>\n<script defer src="/moto-guide.js?v=2">', extra + '</style>\n<script defer src="/moto-guide.js?v=2">', h)
h = h.replace(OLD, ORIGIN)
assert 'chatgpt.site/' not in h.replace('autolog-cell.oscar1975.chatgpt.site', '').replace('costi-viaggio-oscar.oscar1975.chatgpt.site', '').replace('tempi-guida-tratte.oscar1975.chatgpt.site', '')
open(work + '/home.html', 'w', encoding='utf-8').write(h)

tr = json.load(open(os.path.join(S, 'out/content/translations.json'), encoding='utf-8'))
tr[ALT_HERO] = {'en': 'Oscar Fumagalli at the wheel, driving instructor', 'es': 'Oscar Fumagalli al volante, instructor de conducción', 'fr': 'Oscar Fumagalli au volant, moniteur de conduite'}
tr[ALT_PORT] = {'en': 'Oscar Fumagalli, portrait with glasses and white shirt', 'es': 'Oscar Fumagalli, retrato con gafas y camisa blanca', 'fr': 'Oscar Fumagalli, portrait avec lunettes et chemise blanche'}
tr[ALT_CAB] = {'en': 'Oscar Fumagalli in the cab of a heavy vehicle', 'es': 'Oscar Fumagalli en la cabina de un vehículo pesado', 'fr': 'Oscar Fumagalli dans la cabine d’un poids lourd'}
tr = {k.replace('Sites / Cloudflare', 'Vercel / Supabase'): {l: v.replace('Sites / Cloudflare', 'Vercel / Supabase') for l, v in d.items()} for k, d in tr.items()}
json.dump(tr, open(work + '/content/translations.json', 'w', encoding='utf-8'), ensure_ascii=False)
shutil.copy(os.path.join(S, 'src/content/dashboard-translations.json'), work + '/content/')
shutil.copy(os.path.join(S, 'src/lib/dashboard-localize.mjs'), work + '/lib/')
shutil.copy(os.path.join(S, 'src/app/_content/statistiche.html'), work + '/statistiche.html')
lz = open(os.path.join(S, 'src/lib/localize.mjs'), encoding='utf-8').read().replace(OLD, ORIGIN)
open(work + '/lib/localize.mjs', 'w', encoding='utf-8').write(lz)
open(work + '/gen.mjs', 'w').write("""import fs from 'node:fs';import {localizedHome,validateTranslations} from './lib/localize.mjs';
const h=fs.readFileSync('home.html','utf8');validateTranslations(h);
for(const [l,f] of [['it','index'],['en','en'],['es','es'],['fr','fr']])fs.writeFileSync(process.argv[2]+'/'+f+'.html',localizedHome(h,l));
const {localizedDashboard,validateDashboardTranslations}=await import('./lib/dashboard-localize.mjs');const d=fs.readFileSync('statistiche.html','utf8');validateDashboardTranslations(d);
fs.mkdirSync(process.argv[2]+'/pages',{recursive:true});for(const l of ['it','en','es','fr'])fs.writeFileSync(process.argv[2]+'/pages/statistiche-'+l+'.html',localizedDashboard(d,l));""")
subprocess.run(['node', 'gen.mjs', site], cwd=work, check=True)

os.makedirs(site + '/images/moto'); os.makedirs(site + '/videos')
for n in ('lento', 'veloce'):
    shutil.copy(os.path.join(S, 'vid/percorso-%s.webp' % n), site + '/images/moto/'); shutil.copy(os.path.join(S, 'vid/moto-percorso-%s.mp4' % n), site + '/videos/')
for f in ['logo.svg', 'advanced-lessons.css', 'moto-guide.css', 'moto-guide.js', 'booking.css', 'booking-rules.js', 'booking-messages.js', 'language-preference.js']:
    shutil.copy(os.path.join(S, 'src/public', f), site)
shutil.copy(os.path.join(S, 'out/public/booking.js'), site)
T = {'title': {'it': 'Disponibilità e prenotazioni', 'en': 'Availability and bookings', 'es': 'Disponibilidad y reservas', 'fr': 'Disponibilités et réservations'},
     'loading': {'it': 'Caricamento del calendario…', 'en': 'Loading the calendar…', 'es': 'Cargando el calendario…', 'fr': 'Chargement du calendrier…'},
     'nojs': {'it': 'Attiva JavaScript per consultare gli orari e inserire una prenotazione.', 'en': 'Enable JavaScript to view availability and make a booking.', 'es': 'Activa JavaScript para consultar los horarios y hacer una reserva.', 'fr': 'Active JavaScript pour consulter les créneaux et réserver.'}}
for l in ('it', 'en', 'es', 'fr'):
    open(site + '/pages/prenotazioni-%s.html' % l, 'w', encoding='utf-8').write('<!doctype html><html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><script src="/language-preference.js?v=1"></script><meta name="theme-color" content="#22252b"><title>%s | Accademia della Guida</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=strada-1"><link rel="icon" type="image/png" sizes="192x192" href="/favicon.png?v=strada-1"><link rel="icon" type="image/svg+xml" sizes="any" href="/logo.svg?v=strada-1"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=strada-1"><link rel="stylesheet" href="/booking.css?v=4"></head><body class="booking-page"><main><div class="booking-app" id="booking-app" data-lang="%s"><p class="bk-loading">%s</p></div><noscript>%s</noscript></main><script type="module" src="/booking.js?v=9"></script></body></html>' % (l, T['title'][l], l, T['loading'][l], T['nojs'][l]))
for l in ('it', 'en', 'es', 'fr'):
    f = site + '/pages/statistiche-%s.html' % l; d = open(f, encoding='utf-8').read(); assert '/booking.js?v=8' in d
    open(f, 'w', encoding='utf-8').write(d.replace('/booking.js?v=8', '/booking.js?v=9'))
langs = {'it': '/', 'en': '/en', 'es': '/es', 'fr': '/fr'}
alts = ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>' % (k, ORIGIN, v) for k, v in langs.items()) + '<xhtml:link rel="alternate" hreflang="x-default" href="%s/"/>' % ORIGIN
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join('<url><loc>%s%s</loc><lastmod>2026-11-15</lastmod>%s</url>\n' % (ORIGIN, v, alts) for v in langs.values()) + '</urlset>\n'
open(site + '/sitemap.xml', 'w').write(sm)
open(site + '/robots.txt', 'w').write('User-agent: *\nAllow: /\nDisallow: /statistiche\nDisallow: /pages/\nDisallow: /api/\n\nSitemap: %s/sitemap.xml\n' % ORIGIN)
json.dump({'name': 'Accademia della Guida', 'short_name': 'Accademia', 'start_url': '/', 'display': 'standalone', 'background_color': '#f2efe7', 'theme_color': '#f2efe7',
           'icons': [{'src': '/favicon.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]}, open(site + '/site.webmanifest', 'w'))
API = 'https://scmiyjbhxmwzzcafzves.supabase.co/functions/v1/adg/'
SEC = [{'key': 'Cache-Control', 'value': 'private, no-store, max-age=0'}, {'key': 'X-Robots-Tag', 'value': 'noindex, nofollow, noarchive'}, {'key': 'Referrer-Policy', 'value': 'no-referrer'}]
CSP_B = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
CSP_S = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
rw = [{'source': '/api/:path*', 'destination': API + ':path*'}]
for page in ('prenotazioni', 'statistiche'):
    for l in ('en', 'es', 'fr'):
        rw.append({'source': '/' + page, 'has': [{'type': 'query', 'key': 'lang', 'value': l}], 'destination': '/pages/%s-%s' % (page, l)})
    rw.append({'source': '/' + page, 'destination': '/pages/%s-it' % page})
long = [{'key': 'Cache-Control', 'value': 'public, max-age=2592000'}]
json.dump({'cleanUrls': True, 'trailingSlash': False, 'rewrites': rw,
           'headers': [{'source': '/(.*)', 'headers': [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}, {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'}, {'key': 'X-Frame-Options', 'value': 'DENY'}]},
                       {'source': '/videos/(.*)', 'headers': long}, {'source': '/images/(.*)', 'headers': long},
                       {'source': '/prenotazioni', 'headers': SEC + [{'key': 'Content-Security-Policy', 'value': CSP_B}]},
                       {'source': '/statistiche', 'headers': SEC + [{'key': 'Content-Security-Policy', 'value': CSP_S}]},
                       {'source': '/pages/(.*)', 'headers': SEC}]}, open(site + '/vercel.json', 'w'), indent=1)
print('ok', hero, port, cab)
