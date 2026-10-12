"""Render bilingual README GIFs and static alternatives. Requires Pillow.

Optional font overrides: FOCUSMUTE_FONT, FOCUSMUTE_CJK_FONT.
No website screenshots or private browsing data are used.
"""
from functools import lru_cache
from pathlib import Path
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/assets'
W, H, FPS = 1200, 680, 10
BG, INK, MUTED = '#f5f4ec', '#183c32', '#63736c'
GREEN, SAGE, LINE = '#286447', '#e4eedf', '#d9e2d4'
AMBER, SAND, WHITE = '#846037', '#f2e9da', '#ffffff'
COPY = {
 'en': {
  'label':'HOW IT DECIDES', 'headline':'A quiet default. Sound with a reason.',
  'sub':'Three everyday paths through FocusMute’s local rules.',
  'columns':['01  CURRENT PAGE','02  LOCAL CHECKS','03  PLAYBACK'],
  'tabs':['Learning video','Music video','Xiaohongshu'],
  'titles':['Python tutorial','Study music playlist','Xiaohongshu feed'],
  'details':['Functions, examples & exercises','Music for a study session','Every post stays visible'],
  'checks':['Explicit block?','Explicit allow?','Entertainment?','Teaching evidence?'],
  'answers':[['No','No','No','Yes'],['No','No','Yes','Not needed']],
  'xhschecks':['Skip video classification','Mute audio on every post'],
  'xhssub':'No content filtering. No hidden posts.',
  'waiting':'START MUTED', 'allow':'SOUND ALLOWED', 'mute':'STAYS MUTED',
  'resultsub':['Teaching evidence found','Music takes priority','Videos keep playing silently'],
  'pending':'Checking the current page',
  'footer':'Illustrative animation · default rules · not a browser recording',
  'note':'Explicit blocks win. Uncertain YouTube results stay muted.',
  'overview':'Three paths. One quieter browser.',
 },
 'zh': {
  'label':'判断过程', 'headline':'先保持安静，有教学证据再放行。',
  'sub':'跟着三种日常场景，看懂 FocusMute 的本地规则。',
  'columns':['01  当前页面','02  本地判断','03  播放结果'],
  'tabs':['学习视频','音乐视频','小红书'],
  'titles':['Python 函数教程','学习背景音乐歌单','小红书推荐页'],
  'details':['函数、示例与练习','学习时听的音乐','每一条帖子都正常显示'],
  'checks':['命中明确禁止？','命中明确允许？','属于娱乐内容？','教学证据充分？'],
  'answers':[['否','否','否','是'],['否','否','是','无需继续']],
  'xhschecks':['跳过视频内容分类','每条帖子的声音都静音'],
  'xhssub':'不做内容过滤，也不隐藏帖子。',
  'waiting':'默认静音', 'allow':'允许声音', 'mute':'保持静音',
  'resultsub':['教学证据充分','音乐内容优先保持静音','视频继续无声播放'],
  'pending':'正在检查当前页面',
  'footer':'动画示意 · 默认规则 · 非浏览器实录',
  'note':'明确禁止优先；YouTube 无法判断时保持静音。',
  'overview':'三种路径，让浏览器安静下来。',
 }
}

@lru_cache(maxsize=None)
def font(size, lang='en', bold=False):
    custom=os.getenv('FOCUSMUTE_CJK_FONT' if lang=='zh' else 'FOCUSMUTE_FONT')
    if lang=='zh':
        choices=[(custom,0),('/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/STHeiti Light.ttc',0),('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',0)]
    else:
        choices=[(custom,0),('/System/Library/Fonts/Helvetica.ttc',1 if bold else 0),('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',0)]
    for path,index in choices:
        if path and Path(path).exists():return ImageFont.truetype(path,size,index=index)
    raise RuntimeError('No suitable font. Set FOCUSMUTE_FONT / FOCUSMUTE_CJK_FONT.')


def text(d,x,y,value,size=20,color=INK,lang='en',bold=False):
    d.text((x,y),value,font=font(size,lang,bold),fill=color)


def chip(d,x,y,value,lang='en',color=GREEN,bg=SAGE):
    f=font(15,lang,True);width=d.textbbox((0,0),value,font=f)[2]+26
    d.rounded_rectangle((x,y,x+width,y+30),radius=15,fill=bg)
    d.text((x+13,y+6),value,font=f,fill=color)
    return width


def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)


def travel(d,points,fraction,color):
    """Draw a settled wire and a smoothly traveling signal."""
    d.line(points,fill=LINE,width=3,joint='curve')
    lengths=[math.dist(a,b) for a,b in zip(points,points[1:])]
    remaining=sum(lengths)*max(0,min(1,fraction));active=[points[0]]
    for a,b,length in zip(points,points[1:],lengths):
        if remaining>=length:active.append(b);remaining-=length
        else:
            f=remaining/length if length else 0
            active.append((a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f));break
    if fraction>0:
        d.line(active,fill=color,width=3,joint='curve');x,y=active[-1]
        d.ellipse((x-6,y-6,x+6,y+6),fill=color)


def frame(lang,scene,t):
    c=COPY[lang];im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
    d.rounded_rectangle((44,30,78,64),radius=10,fill=INK)
    for x,top,bottom in [(53,42,52),(60,37,57),(67,40,54)]:d.rounded_rectangle((x,top,x+3,bottom),radius=2,fill='#d9efb4')
    text(d,89,35,'FocusMute',23,bold=True)
    text(d,975,39,c['label'],14,color=MUTED,lang=lang,bold=True)
    text(d,44,95,c['headline'],34,lang=lang,bold=True)
    text(d,45,147,c['sub'],20,color=MUTED,lang=lang)
    for x,label in zip([44,430,884],c['columns']):text(d,x,211,label,14,color=MUTED,lang=lang,bold=True)
    d.rounded_rectangle((44,245,369,528),radius=18,fill=WHITE,outline=LINE,width=2)
    chip(d,65,263,'XIAOHONGSHU' if scene==2 else 'YOUTUBE')
    d.rounded_rectangle((65,310,348,421),radius=12,fill='#edf1e7')
    if scene==2:
        for k in range(3):
            x=79+k*87
            d.rounded_rectangle((x,323,x+77,407),radius=8,fill=['#cfdfc3','#dfe2cf','#c3d8d0'][k])
            d.polygon([(x+29,347),(x+29,382),(x+53,365)],fill=WHITE)
    elif scene==0:
        for k,width in enumerate([164,112,193]):
            x=85+(16 if k==1 else 0);y=332+k*27
            d.rounded_rectangle((x,y,x+width,y+8),radius=4,fill=['#83a894','#aac2ac','#c1d3b9'][k])
    else:
        for k in range(12):
            height=16+24*(1+math.sin(k*1.8+t*3))
            x=85+k*21
            d.rounded_rectangle((x,365-height/2,x+9,365+height/2),radius=4,fill='#a8bda8')
    text(d,65,442,c['titles'][scene],24,lang=lang,bold=True)
    text(d,65,482,c['details'][scene],17,color=MUTED,lang=lang)

    steps=2 if scene==2 else (4 if scene==0 else 3)
    step_time=0.82;start=0.6
    completed=max(0,min(steps,int((t-start)/step_time)+1)) if t>=start else 0
    result_at=start+steps*step_time+0.3
    settled=t>=result_at
    color=GREEN if scene==0 else AMBER
    travel(d,[(370,280),(429,280)],smooth(t/0.6),GREEN)
    labels=c['xhschecks'] if scene==2 else c['checks']
    for i,label in enumerate(labels):
        y=245+i*71
        done=i<completed
        active=done and i==completed-1 and not settled
        skipped=scene==1 and i==3 and completed==3
        fill=SAGE if done else '#f0f0e9'
        if done and scene==1 and i==2:fill=SAND
        outline=GREEN if active else LINE
        d.rounded_rectangle((430,y,788,y+55),radius=12,fill=fill,outline=outline,width=2)
        d.ellipse((447,y+18,466,y+37),fill=GREEN if done else '#d0d8ca')
        if done:
            d.line([(452,y+27),(456,y+31),(462,y+23)],fill=WHITE,width=2)
        text(d,480,y+17,label,17,color=MUTED if skipped else INK,lang=lang,bold=done)
        if scene!=2 and (done or skipped):
            answer=c['answers'][scene][i]
            text(d,702 if lang=='zh' else 686,y+19,answer,13,color=color if done else MUTED,lang=lang,bold=True)
        if i<len(labels)-1:
            progress=smooth((t-(start+i*step_time+0.2))/0.45) if i<steps-1 else 0
            travel(d,[(454,y+56),(454,y+71)],progress,GREEN)
    if scene==2:
        text(d,439,409,c['xhssub'],17,color=MUTED,lang=lang)
        chip(d,440,457,'MUTE ONLY' if lang=='en' else '仅静音',lang)
    exit_y=245+(steps-1)*71+27
    travel(d,[(789,exit_y),(833,exit_y),(833,387),(883,387)],smooth((t-(result_at-0.5))/0.5),color)
    d.rounded_rectangle((884,292,1156,484),radius=20,fill=(SAGE if scene==0 else SAND) if settled else WHITE,outline=color if settled else LINE,width=2)
    # Speaker and either sound waves or a mute stroke.
    sx,sy=1001,321
    d.polygon([(sx,sy+14),(sx+13,sy+14),(sx+30,sy),(sx+30,sy+48),(sx+13,sy+34),(sx,sy+34)],fill=color if settled else MUTED)
    if settled and scene==0:
        for j in range(2):
            r=14+j*11
            d.arc((sx+24-r,sy+24-r,sx+24+r,sy+24+r),-55,55,fill=GREEN,width=3)
    else:
        d.line((sx+42,sy+16,sx+57,sy+32),fill=color if settled else MUTED,width=3)
        d.line((sx+57,sy+16,sx+42,sy+32),fill=color if settled else MUTED,width=3)
    status=c['allow'] if scene==0 else c['mute']
    title=status if settled else c['waiting'];f=font(23,lang,True)
    tw=d.textbbox((0,0),title,font=f)[2];text(d,1020-tw/2,386,title,23,color=color if settled else MUTED,lang=lang,bold=True)
    subtitle=c['resultsub'][scene] if settled else c['pending'];f=font(15,lang)
    tw=d.textbbox((0,0),subtitle,font=f)[2];text(d,1020-tw/2,433,subtitle,15,color=MUTED,lang=lang)
    # Scene selector doubles as a readable playback progress strip.
    for i,label in enumerate(c['tabs']):
        x=44+i*377
        d.rounded_rectangle((x,559,x+358,601),radius=12,fill=INK if scene==i else '#eaece2')
        text(d,x+17,571,f'0{i+1}  {label}',16,color=WHITE if scene==i else MUTED,lang=lang,bold=scene==i)
        if scene==i:
            length=320*min(1,t/6.4)
            if length>0:d.rounded_rectangle((x+18,596,x+18+length,599),radius=1,fill='#b8d991')
    text(d,45,623,c['footer'],14,color=MUTED,lang=lang)
    text(d,45,647,c['note'],13,color=MUTED,lang=lang)
    return im


def generate(lang):
    # One global palette prevents colors from flickering between frames.
    samples=[frame(lang,i,5.5) for i in range(3)]
    sheet=Image.new('RGB',(W,H*3),BG)
    for i,sample in enumerate(samples):sheet.paste(sample,(0,H*i))
    palette=sheet.quantize(colors=128)
    frames=[frame(lang,scene,k/FPS).quantize(palette=palette,dither=Image.Dither.NONE)
            for scene in range(3) for k in range(64)]
    path=OUT/f'decision-flow-{lang}.gif'
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True,disposal=1)
    # A compact static alternative presents all three final paths.
    overview=Image.new('RGB',(W,H*3),BG)
    for i,sample in enumerate(samples):overview.paste(sample,(0,H*i))
    overview.save(OUT/f'decision-flow-{lang}.png',optimize=True)
    print(f'{path.name}: {path.stat().st_size:,} bytes, 19.2 second loop')

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for lang in ['en','zh']:generate(lang)
