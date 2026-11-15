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
h = must('<a href="/prenotazioni">Prenota un orario</a>', '', h)
h = sub1(r'<section class="section" id="prenota">.*?</section>\n?', '', h)
h = sub1(r'<h3>Calendario delle prenotazioni</h3><p>.*?</p>', '', h)
h = sub1(r'<h3>Statistiche aggregate</h3><p>.*?</p><p>.*?</p>', '', h)
h = must("function trackAction(action){", "function trackAction(action){return;", h)
h = must('<link rel="preconnect" href="https://images.unsplash.com">', '<link rel="preconnect" href="https://images.unsplash.com"><link rel="manifest" href="/site.webmanifest">', h)
extra = ('.hero-photo{object-position:32% 22%}.portrait-main img{object-position:center 30%}.vehicle-photo img{object-position:62% 62%}'
         '.moto-video{display:none}')
h = must('</style>\n<script defer src="/moto-guide.js?v=2">', extra + '</style>\n<script defer src="/moto-guide.js?v=2">', h)
h = re.sub(r' poster="/images/moto/[^"]+"', '', h)
h = h.replace(OLD, ORIGIN)
assert 'chatgpt.site/' not in h.replace('autolog-cell.oscar1975.chatgpt.site', '').replace('costi-viaggio-oscar.oscar1975.chatgpt.site', '').replace('tempi-guida-tratte.oscar1975.chatgpt.site', '')
open(work + '/home.html', 'w', encoding='utf-8').write(h)

tr = json.load(open(os.path.join(S, 'out/content/translations.json'), encoding='utf-8'))
tr[ALT_HERO] = {'en': 'Oscar Fumagalli at the wheel, driving instructor', 'es': 'Oscar Fumagalli al volante, instructor de conducción', 'fr': 'Oscar Fumagalli au volant, moniteur de conduite'}
tr[ALT_PORT] = {'en': 'Oscar Fumagalli, portrait with glasses and white shirt', 'es': 'Oscar Fumagalli, retrato con gafas y camisa blanca', 'fr': 'Oscar Fumagalli, portrait avec lunettes et chemise blanche'}
tr[ALT_CAB] = {'en': 'Oscar Fumagalli in the cab of a heavy vehicle', 'es': 'Oscar Fumagalli en la cabina de un vehículo pesado', 'fr': 'Oscar Fumagalli dans la cabine d’un poids lourd'}
json.dump(tr, open(work + '/content/translations.json', 'w', encoding='utf-8'), ensure_ascii=False)
lz = open(os.path.join(S, 'src/lib/localize.mjs'), encoding='utf-8').read().replace(OLD, ORIGIN)
lz = lz.replace("result=result.replaceAll('href=\"/prenotazioni\"','href=\"/prenotazioni?lang='+lang+'\"');", '')
open(work + '/lib/localize.mjs', 'w', encoding='utf-8').write(lz)
open(work + '/gen.mjs', 'w').write("""import fs from 'node:fs';import {localizedHome,validateTranslations} from './lib/localize.mjs';
const h=fs.readFileSync('home.html','utf8');validateTranslations(h);
for(const [l,f] of [['it','index'],['en','en'],['es','es'],['fr','fr']])fs.writeFileSync(process.argv[2]+'/'+f+'.html',localizedHome(h,l));""")
subprocess.run(['node', 'gen.mjs', site], cwd=work, check=True)

for f in ['logo.svg', 'advanced-lessons.css', 'moto-guide.css', 'moto-guide.js']:
    shutil.copy(os.path.join(S, 'src/public', f), site)
langs = {'it': '/', 'en': '/en', 'es': '/es', 'fr': '/fr'}
alts = ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>' % (k, ORIGIN, v) for k, v in langs.items()) + '<xhtml:link rel="alternate" hreflang="x-default" href="%s/"/>' % ORIGIN
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join('<url><loc>%s%s</loc><lastmod>2026-11-15</lastmod>%s</url>\n' % (ORIGIN, v, alts) for v in langs.values()) + '</urlset>\n'
open(site + '/sitemap.xml', 'w').write(sm)
open(site + '/robots.txt', 'w').write('User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % ORIGIN)
json.dump({'name': 'Accademia della Guida', 'short_name': 'Accademia', 'start_url': '/', 'display': 'standalone', 'background_color': '#f2efe7', 'theme_color': '#f2efe7',
           'icons': [{'src': '/favicon.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]}, open(site + '/site.webmanifest', 'w'))
json.dump({'cleanUrls': True, 'trailingSlash': False,
           'headers': [{'source': '/(.*)', 'headers': [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}, {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'}, {'key': 'X-Frame-Options', 'value': 'DENY'}]},
                       {'source': '/images/(.*)', 'headers': [{'key': 'Cache-Control', 'value': 'public, max-age=2592000'}]}]}, open(site + '/vercel.json', 'w'), indent=1)
print('ok', hero, port, cab)
