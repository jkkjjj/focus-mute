"""Optional artwork regeneration: Python 3 + Pillow. Runtime has no dependencies."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs/assets'
ASSETS.mkdir(parents=True, exist_ok=True)
BG, INK, MUTED, GREEN = '#f5f4ec', '#183c32', '#63736c', '#286447'
WHITE, LINE, SAGE = '#ffffff', '#d9e2d4', '#e4eedf'

def font(size, bold=False):
    candidates = [('/System/Library/Fonts/Helvetica.ttc', 1 if bold else 0),
                  ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 0)]
    for path, index in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size, index=index)
    return ImageFont.load_default(size=size)

def text(d, xy, value, size=24, fill=INK, bold=False):
    d.text(xy, value, font=font(size, bold), fill=fill)

def pill(d, x, y, label, fill=SAGE, color=GREEN):
    f = font(19, True)
    w = d.textbbox((0, 0), label, font=f)[2] + 34
    d.rounded_rectangle((x, y, x+w, y+40), radius=20, fill=fill)
    d.text((x+17, y+9), label, font=f, fill=color)
    return w

def logo(size=256):
    im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,255,255),radius=61,fill=INK)
    for x,top,bottom in [(58,98,158),(110,60,196),(162,82,174)]:
        d.rounded_rectangle((x,top,x+28,bottom),radius=14,fill='#d9efb4')
    return im.resize((size,size),Image.Resampling.LANCZOS)

icons=ROOT/'extension/icons';icons.mkdir(exist_ok=True)
for n in [16,32,48,128]: logo(n).save(icons/f'icon-{n}.png')
logo(256).save(ASSETS/'logo.png')

im=Image.new('RGB',(1400,760),BG);d=ImageDraw.Draw(im)
im.paste(logo(54),(72,65),logo(54));text(d,(144,75),'FocusMute',31,bold=True)
pill(d,1134,72,'CHROME')
text(d,(72,218),'Keep the lesson.',72,bold=True)
text(d,(72,305),'Quiet the noise.',72,bold=True)
text(d,(76,425),'Learning videos get sound.',28,fill=MUTED)
text(d,(76,469),'Distracting audio takes a break.',28,fill=MUTED)
x=76
for label in ['LOCAL RULES','NO ACCOUNT','MIT LICENSE']:
    x+=pill(d,x,552,label)+12
# Two deliberate illustrative cards, not a live-browser screenshot.
for y,site,title,sub,status,allowed in [(212,'YOUTUBE','Python tutorial','Teaching evidence found','SOUND ALLOWED',True),(421,'XIAOHONGSHU','Every post stays visible','All audio stays quiet','AUDIO MUTED',False)]:
    d.rounded_rectangle((855,y,1324,y+176),radius=22,fill=WHITE,outline=LINE,width=2)
    text(d,(881,y+22),site,15,fill=MUTED,bold=True)
    text(d,(881,y+55),title,26,bold=True)
    text(d,(881,y+93),sub,18,fill=MUTED)
    pill(d,881,y+124,status,fill=SAGE if allowed else '#efeee6',color=GREEN if allowed else MUTED)
d.line((72,666,1324,666),fill=LINE,width=2)
text(d,(76,698),'Less distraction. Same browser.',21,fill=MUTED)
text(d,(1052,701),'Illustrative examples',18,fill=MUTED)
im.save(ASSETS/'hero.png',optimize=True)

im=Image.new('RGB',(1400,620),BG);d=ImageDraw.Draw(im)
text(d,(64,42),'One extension. Three everyday moments.',38,bold=True)
text(d,(66,99),'Example outcomes with the default rules — not a live browser recording.',22,fill=MUTED)
examples=[('01 / LEARN','Python tutorial','Functions, parameters & examples','Sound allowed',GREEN,True),('02 / STAY FOCUSED','Study music playlist','Music stays muted, even for studying','Audio muted','#7b6244',False),('03 / BROWSE QUIETLY','Xiaohongshu feed','Posts visible. Videos keep playing.','Audio muted','#7b6244',False)]
for i,(over,title,subtitle,status,color,allowed) in enumerate(examples):
    x=64+i*430;y=169
    d.rounded_rectangle((x,y,x+410,565),radius=20,fill=WHITE,outline=LINE,width=2)
    text(d,(x+24,y+22),over,17,fill=MUTED,bold=True)
    d.rounded_rectangle((x+24,y+66,x+386,y+225),radius=13,fill='#e9efe5')
    if i<2:
        for j,h in enumerate([20,36,58,81,102,68,43,73,51,30]):
            xx=x+58+j*27
            d.rounded_rectangle((xx,y+147-h/2,xx+12,y+147+h/2),radius=6,fill='#71a17b' if allowed else '#c5cabc')
        if not allowed:d.line((x+98,y+199,x+318,y+96),fill='#7b6244',width=5)
    else:
        for j in range(3):
            xx=x+41+j*111
            d.rounded_rectangle((xx,y+83,xx+97,y+207),radius=9,fill=['#cfdfc3','#dfe2cf','#c3d8d0'][j])
            d.polygon([(xx+38,y+120),(xx+38,y+160),(xx+68,y+140)],fill=WHITE)
    text(d,(x+24,y+246),title,26,bold=True)
    text(d,(x+24,y+290),subtitle,18,fill=MUTED)
    pill(d,x+24,y+335,status.upper(),fill=SAGE if allowed else '#f1ebe1',color=color)
im.save(ASSETS/'examples.png',optimize=True)
print('Generated icons, hero and example illustrations.')
