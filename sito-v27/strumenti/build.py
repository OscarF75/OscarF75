"""Genera la home v27 (nuova grafica) a partire dalla home v26 originale.
Uso: python3 -I build.py <src_dir> <out_dir> <new.css>
Non tocca testi, script funzionali, dati strutturati o sezioni: cambia stile, hero e animazioni."""
import sys, re, json, os

src, out, layer_path = sys.argv[1:4]
html = open(os.path.join(src, 'app/_content/home.html'), encoding='utf-8').read()
layer = open(layer_path, encoding='utf-8').read()

def must(old, new, text, count=1):
    assert text.count(old) >= 1, 'non trovato: ' + old[:70]
    return text.replace(old, new, count)

# ---------- 1. colori del vecchio foglio di stile -> variabili ----------
m = re.search(r'<style>(.*?)</style>', html, re.S)
css = m.group(1)

def pct(a):
    return max(1, round(a * 100))

def mix(var, a):
    return 'color-mix(in srgb,var(--%s) %d%%,transparent)' % (var, pct(a))

BG = {'22252b', '252930', '272b32', '292d34', '2a2e35', '2b2f35', '1c1f25'}
PANEL = {'2c3037', '353a43', '3e4450'}

def lum(h):
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255, max(r, g, b) - min(r, g, b)

def hex8(mo):
    h, a = mo.group(1).lower(), int(mo.group(2), 16) / 255
    if h == 'ffffff': return mix('ink', a)
    if h in BG: return mix('bg', a)
    if h in PANEL: return mix('panel', a)
    if h == 'ffb800': return mix('yellow', a)
    return mo.group(0)

def hex6(mo):
    h = mo.group(1).lower()
    if h in BG: return 'var(--bg)'
    if h in PANEL: return 'var(--panel)'
    return mo.group(0)

def text_color(mo):
    h = mo.group(1).lower()
    l, spread = lum(h)
    if spread < 40 and l > .42: return 'color:var(--muted)'
    return mo.group(0)

css = re.sub(r'#([0-9a-fA-F]{6})([0-9a-fA-F]{2})\b', hex8, css)
css = re.sub(r'(?<![-\w])color:#([0-9a-fA-F]{6})\b', text_color, css)
css = re.sub(r'#([0-9a-fA-F]{6})\b', hex6, css)
css = re.sub(r'rgba\(255,255,255,(\.?[\d.]+)\)', lambda mo: mix('ink', float(mo.group(1))), css)
css = re.sub(r'rgba\(34,37,43,(\.?[\d.]+)\)', lambda mo: mix('bg', float(mo.group(1))), css)
css = re.sub(r'(?<![-\w])color:var\(--yellow\)', 'color:var(--accent-ink)', css)
css = css.replace('color-scheme:dark', 'color-scheme:light')
html = html[:m.start(1)] + css + html[m.end(1):]

# ---------- 2. font e colore del tema ----------
html = must("https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&amp;family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap",
            "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&amp;family=Instrument+Serif:ital@0;1&amp;family=DM+Sans:opsz,wght@9..40,400..700&amp;family=DM+Mono:wght@400;500&amp;display=swap", html)
html = must('<meta name="theme-color" content="#22252B">', '<meta name="theme-color" content="#F2EFE7">', html)

# ---------- 3. hero: riquadro visivo con adesivi ----------
ring = ('<svg viewBox="0 0 200 200" focusable="false"><defs><path id="adg-ring" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0"/></defs>'
        '<text><textPath href="#adg-ring" startOffset="0">ACCADEMIA DELLA GUIDA</textPath><textPath href="#adg-ring" startOffset="50%">ACCADEMIA DELLA GUIDA</textPath></text></svg>')
stickers = ('<div class="hero-sticker sticker-ring" aria-hidden="true">' + ring + '<img src="/logo.svg?v=strada-1" width="64" height="64" alt=""></div>'
            '<div class="hero-sticker sticker-hours" aria-hidden="true"><b>Sabato / 10:00 – 17:00</b><span>Domenica / 17:00 – 20:00</span></div>'
            '<div class="hero-sticker sticker-quote" aria-hidden="true">«Prima la fiducia. Poi, la strada.»</div>')
a = html.index('<div class="hero-scene">')
b = html.index('<div class="hero-shade"></div>')
scene = html[a:b]
r1 = html.index('<div class="hero-readout"')
r2 = html.index('</div></div>', r1) + len('</div></div>')
readout = html[r1:r2]
html = html[:r1] + html[r2:]
html = html.replace(scene, '<div class="hero-visual">' + scene + readout + stickers + '</div>', 1)
html = must('<h1 class="display" id="hero-title">ACCADEMIA<span>DELLA GUIDA</span></h1>',
            '<h1 class="display" id="hero-title">Accademia<span>della Guida</span></h1>', html)

# ---------- 4. nastro scorrevole sotto l'hero ----------
items = ['<b>MONZA · BRIANZA</b>', '<i>Manuale &amp; Automatico</i>', '<b>FORMULA WEEKEND</b>', '<i>«Prima la fiducia. Poi, la strada.»</i>',
         '<b>TECNICA / FIDUCIA / AUTONOMIA</b>', '<i>IL PERCORSO INIZIA A CASA TUA</i>']
row = ''.join(i + '<span class="marquee-dot"></span>' for i in items)
marquee = '<div class="marquee" aria-hidden="true"><div class="marquee-track"><div>' + row + '</div><div>' + row + '</div></div></div>\n'
html = must('<section class="intro-strip"', marquee + '<section class="intro-strip"', html)

# ---------- 5. durata massima due ore: testo della sezione prenota ----------
html = must('scegli una durata da un’ora in su', 'scegli una durata da una a due ore', html)

# ---------- 6. nuovo livello grafico, dopo gli altri fogli di stile ----------
html = must('<script defer src="/moto-guide.js?v=2">', '<style data-theme="v27">' + layer + '</style>\n<script defer src="/moto-guide.js?v=2">', html)

# ---------- 7. animazioni: niente zoom bloccato, comparsa morbida ----------
a = html.index("if(!mobile){const timeline=gsap.timeline({scrollTrigger:{trigger:'.hero'")
b = html.index("gsap.fromTo('.method-visual img'")
motion = ("if(!mobile){gsap.to('.hero-visual',{y:-70,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});"
          "gsap.to('.sticker-hours',{y:-40,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});"
          "gsap.to('.hero-readout',{y:30,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});}"
          "gsap.utils.toArray('.strip-item,.info-card,.tool-card,.faq-item,.target,.timeline-step,.superprof-card,.vehicle-panel,.practice-cta,.share-card,.contact-form').forEach(el=>{gsap.from(el,{y:36,opacity:0,duration:.7,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 92%',once:true}})});")
html = html[:a] + motion + html[b:]

os.makedirs(os.path.join(out, 'app/_content'), exist_ok=True)
open(os.path.join(out, 'app/_content/home.html'), 'w', encoding='utf-8').write(html)

# ---------- 8. traduzioni per i testi nuovi ----------
tr = json.load(open(os.path.join(src, 'content/translations.json'), encoding='utf-8'))
tr['Accademia'] = {'en': 'Accademia', 'es': 'Accademia', 'fr': 'Accademia'}
tr['della Guida'] = {'en': 'della Guida', 'es': 'della Guida', 'fr': 'della Guida'}
old = 'Consulta il calendario, scegli una durata da un’ora in su e inserisci il tuo nominativo. Puoi modificare o annullare con il tuo link personale.'
assert old in tr, 'chiave prenota mancante'
o = tr.pop(old)
tr[old.replace('da un’ora in su', 'da una a due ore')] = {
    'en': o['en'].replace('a duration of at least one hour', 'a duration from one to two hours'),
    'es': o['es'].replace('una duración de al menos una hora', 'una duración de una a dos horas'),
    'fr': o['fr'].replace('une durée d’au moins une heure', 'une durée d’une à deux heures')}
for k, v in tr[old.replace('da un’ora in su', 'da una a due ore')].items(): assert v != o[k], k
os.makedirs(os.path.join(out, 'content'), exist_ok=True)
json.dump(tr, open(os.path.join(out, 'content/translations.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('home', len(html), 'byte')
