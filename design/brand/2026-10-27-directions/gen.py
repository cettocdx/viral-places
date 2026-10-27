from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import os
f=instantiateVariableFont(TTFont('/System/Library/Fonts/SFNSRounded.ttf'), {'wght':820,'GRAD':400})
gs=f.getGlyphSet(); cmap=f.getBestCmap(); hmtx=f['hmtx']
def text_path(s, size, x, y, track=0):
    """Glyph outlines as one SVG path, baseline at y, left at x."""
    upm=f['head'].unitsPerEm; sc=size/upm; d=[]; cx=0
    for ch in s:
        g=cmap[ord(ch)]; pen=SVGPathPen(gs); gs[g].draw(pen)
        d.append(f'<path transform="translate({x+cx*sc:.2f},{y}) scale({sc:.5f},{-sc:.5f})" d="{pen.getCommands()}"/>')
        cx+=hmtx[g][0]+track
    return ''.join(d), cx*sc
def width(s,size,track=0):
    upm=f['head'].unitsPerEm; return sum(hmtx[cmap[ord(c)]][0]+track for c in s)*size/upm
def glyph_bounds(ch,size):
    bp=BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp); x0,y0,x1,y1=bp.bounds; s=size/f['head'].unitsPerEm
    return x0*s,y0*s,x1*s,y1*s

NAVY='#0F1A22'; INK='#1B2834'; LIME='#D5F49A'; WHITE='#FFFFFF'; BLUE='#5B93FF'; PURPLE='#A78BFA'
def icon(body, bg=NAVY):
    # iOS masks the corners itself; the 1024 master is a full square, preview adds the squircle.
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="{bg}"/>{body}</svg>'

def pin(cx, cy, r, fill, ring, tail=True, shadow=True):
    """App pin: white ring disc with a rounded pointer tail, like the map markers."""
    t=''
    if tail:
        w=r*0.62; h=r*0.62; ty=cy+r+ring*0.2
        t=f'<path d="M{cx-w/2:.1f} {ty-h*0.35:.1f} Q{cx} {ty+h*1.15:.1f} {cx+w/2:.1f} {ty-h*0.35:.1f} Z" fill="{WHITE}" stroke="{WHITE}" stroke-width="{ring*0.6:.1f}" stroke-linejoin="round"/>'
    sh=f'<ellipse cx="{cx}" cy="{cy+r*1.6:.1f}" rx="{r*0.55:.1f}" ry="{r*0.12:.1f}" fill="#000" opacity="0.28"/>' if shadow else ''
    return sh+t+f'<circle cx="{cx}" cy="{cy}" r="{r+ring}" fill="{WHITE}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"/>'

def ns(p, outline, size):
    """White die-cut edge in glyph units, so it scales with the glyph like a printed sticker."""
    return p.replace('<path ', f'<path stroke-width="{outline*f["head"].unitsPerEm/size:.1f}" ')

def centered_glyph(ch,size,cx,cy,fill,outline=0,rot=0):
    x0,y0,x1,y1=glyph_bounds(ch,size); gx=cx-(x0+x1)/2; gy=cy+(y0+y1)/2
    p,_=text_path(ch,size,gx,gy)
    o=f'<g fill="{WHITE}" stroke="{WHITE}" stroke-linejoin="round">{ns(p,outline,size)}</g>' if outline else ''
    return f'<g transform="rotate({rot} {cx} {cy})">{o}<g fill="{fill}">{p}</g></g>'

A=icon(pin(512,452,250,LIME,34)+centered_glyph('e',300,512,452,INK))
B=icon(centered_glyph('e',620,512,500,INK,outline=70,rot=-9)+f'<circle cx="772" cy="270" r="46" fill="{NAVY}"/>', bg=LIME)
C=icon(pin(380,560,170,BLUE,28)+pin(640,420,190,PURPLE,30)+f'<circle cx="790" cy="610" r="74" fill="{LIME}" stroke="{NAVY}" stroke-width="22"/>'+centered_glyph('e',200,640,420,WHITE)+'')
# D: pin with a rounded play triangle
tri='M455 330 L630 452 L455 574 Z'
D=icon(pin(512,452,250,WHITE,0)+f'<path d="{tri}" fill="{INK}" stroke="{INK}" stroke-width="60" stroke-linejoin="round"/>'+f'<circle cx="736" cy="236" r="58" fill="{LIME}"/>')

os.makedirs('out',exist_ok=True)
for n,s in (('A',A),('B',B),('C',C),('D',D)): open(f'out/icon-{n}.svg','w').write(s)

# Wordmark: the agreed sticker style (ink letters, thick white die-cut edge), as outlines.
size=200; w=width('elsewhere',size,track=-12); pad=60
p,_=text_path('elsewhere',size,pad,size*0.95,track=-12)
W=int(w+pad*2); H=int(size*1.3)
wm=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><g fill="{WHITE}" stroke="{WHITE}" stroke-linejoin="round">{ns(p,44,size)}</g><g fill="{INK}">{p}</g></svg>'
open('out/wordmark.svg','w').write(wm)

# Presentation sheet: squircle previews, home-screen size, tiny size, lockups.
def use(n,x,y,s): return f'<g transform="translate({x},{y}) scale({s})" clip-path="url(#sq)">{open(f"out/icon-{n}.svg").read().split(">",1)[1].rsplit("</svg>",1)[0]}</g>'
sheet=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 2400" width="2400" height="2400"><defs><clipPath id="sq"><rect width="1024" height="1024" rx="230"/></clipPath></defs><rect width="2400" height="2400" fill="#0B141A"/>']
for i,n in enumerate('ABCD'):
    x=120+i*560
    sheet.append(use(n,x,100,0.42))
    sheet.append(f'<text x="{x+215}" y="610" fill="#9FB0BD" font-family="Helvetica" font-size="40" text-anchor="middle">{n}</text>')
    sheet.append(use(n,x+80,680,0.12)); sheet.append(use(n,x+250,690,0.07))
    lock_p,_=text_path('elsewhere',70,x+120,1010,track=-12)
    sheet.append(use(n,x,930,0.1))
    sheet.append(f'<g fill="#FFF" stroke="#FFF" stroke-linejoin="round">{ns(lock_p,16,70)}</g><g fill="{INK}">{lock_p}</g>')
big,_=text_path('elsewhere',300,(2400-width('elsewhere',300,-12))/2,1900,track=-12)
sheet.append(f'<g fill="#FFF" stroke="#FFF" stroke-linejoin="round">{ns(big,40,300)}</g><g fill="{INK}">{big}</g></svg>')
open('out/sheet.svg','w').write(''.join(sheet))
print('ok')

# B2: lime, tilted sticker "e" sitting on a pin tail, a play badge instead of the dot.
def b2(scale_play=1.0):
    cx,cy=500,470; rot=-9
    x0,y0,x1,y1=glyph_bounds('e',600); gx=cx-(x0+x1)/2; gy=cy+(y0+y1)/2
    p,_=text_path('e',600,gx,gy)
    by=cy+(y1-y0)/2  # glyph bottom (unrotated)
    # Pin pointer under the letter: the "e" sits on the map like the app's markers.
    # White pointer like the app's pin tails, long enough to read at icon size, short enough not to become a cone.
    tail=f'<path d="M{cx-95} {by-50} Q{cx-20} {by+95} {cx} {by+150} Q{cx+20} {by+95} {cx+95} {by-50} Z" fill="{WHITE}" stroke="{WHITE}" stroke-width="30" stroke-linejoin="round"/>'
    body=f'<g transform="rotate({rot} {cx} {cy})">{tail}<g fill="{WHITE}" stroke="{WHITE}" stroke-linejoin="round">{ns(p,64,600)}</g><g fill="{INK}">{p}</g></g>'
    px,py,r=760,250,78*scale_play
    play=f'<circle cx="{px}" cy="{py}" r="{r+16}" fill="{WHITE}"/><circle cx="{px}" cy="{py}" r="{r}" fill="{INK}"/><path d="M{px-r*0.28:.0f} {py-r*0.42:.0f} L{px+r*0.46:.0f} {py} L{px-r*0.28:.0f} {py+r*0.42:.0f} Z" fill="{LIME}" stroke="{LIME}" stroke-width="{r*0.16:.0f}" stroke-linejoin="round"/>'
    return icon(body+play, bg=LIME)
open('out/icon-B2.svg','w').write(b2())
s2=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 2400" width="2400" height="2400"><defs><clipPath id="sq"><rect width="1024" height="1024" rx="230"/></clipPath></defs><rect width="2400" height="2400" fill="#0B141A"/>']
s2.append(use('B2',120,120,1.0))
s2.append(use('B2',1300,140,0.4)); s2.append(use('B2',1800,160,0.2)); s2.append(use('B2',2060,180,0.1))
lp,_=text_path('elsewhere',110,1520,1430,track=-12)
s2.append(use('B2',1300,1310,0.18))
s2.append(f'<g fill="#FFF" stroke="#FFF" stroke-linejoin="round">{ns(lp,24,110)}</g><g fill="{INK}">{lp}</g>')
big,_=text_path('elsewhere',260,(2400-width('elsewhere',260,-12))/2,2000,track=-12)
s2.append(f'<g fill="#FFF" stroke="#FFF" stroke-linejoin="round">{ns(big,44,260)}</g><g fill="{INK}">{big}</g></svg>')
open('out/sheet-B2.svg','w').write(''.join(s2))

# ---- Round 2: one sticker silhouette instead of parts stuck together ----
def glyph_at(ch,size,cx,cy):
    x0,y0,x1,y1=glyph_bounds(ch,size); return text_path(ch,size,cx-(x0+x1)/2,cy+(y0+y1)/2)[0], (y1-y0)
def play_badge(px,py,r,bg=INK,fg=LIME,ring=None):
    ring=ring if ring is not None else r*0.2
    return (f'<circle cx="{px}" cy="{py}" r="{r+ring:.0f}" fill="{WHITE}"/><circle cx="{px}" cy="{py}" r="{r}" fill="{bg}"/>'
            f'<path d="M{px-r*0.26:.0f} {py-r*0.40:.0f} L{px+r*0.44:.0f} {py} L{px-r*0.26:.0f} {py+r*0.40:.0f} Z" fill="{fg}" stroke="{fg}" stroke-width="{r*0.18:.0f}" stroke-linejoin="round"/>')
def soft_shadow(cx,cy,rx): return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{rx*0.16:.0f}" fill="{INK}" opacity="0.16"/>'

# V1: "e" and its pin point are ONE die-cut sticker (shared white edge), play badge tucked on the shoulder.
def v1():
    cx,cy=505,455; p,h=glyph_at('e',560,cx,cy); by=cy+h/2
    tail=f'<path d="M{cx-80} {by-60} Q{cx-12} {by+80} {cx} {by+120} Q{cx+12} {by+80} {cx+80} {by-60} Z"/>'
    shape=p+tail
    edge=ns(p,60,560)+tail.replace('<path ','<path stroke-width="60" ')
    g=f'<g transform="rotate(-8 {cx} {cy})">{soft_shadow(cx, by+170, 120)}<g fill="{WHITE}" stroke="{WHITE}" stroke-linejoin="round">{edge}</g><g fill="{INK}">{shape}</g></g>'
    return icon(g+play_badge(745,262,74), bg=LIME)

# V2: the white teardrop pin is the sticker; a lime "e" sits in it; play badge overlaps its top-right.
def v2():
    cx,cy,r=512,440,250
    pin_d=f'M{cx} {cy+r*1.55:.0f} C{cx-r*0.35:.0f} {cy+r*1.1:.0f} {cx-r} {cy+r*0.55:.0f} {cx-r} {cy} A{r} {r} 0 1 1 {cx+r} {cy} C{cx+r} {cy+r*0.55:.0f} {cx+r*0.35:.0f} {cy+r*1.1:.0f} {cx} {cy+r*1.55:.0f} Z'
    p,_=glyph_at('e',330,cx,cy)
    body=(soft_shadow(cx,cy+r*1.66,110)+f'<path d="{pin_d}" fill="{WHITE}"/><path d="{pin_d}" fill="{INK}" transform="translate({cx} {cy}) scale(0.86) translate({-cx} {-cy})"/>'
          f'<g fill="{LIME}">{p}</g>'+play_badge(cx+r*0.78,cy-r*0.72,66,bg=LIME,fg=INK))
    return icon(body, bg=LIME)

# V3: the "e"'s eye IS the play button; the letter stands on a pin point. One idea, no extra badge.
def v3():
    cx,cy=512,455; size=600; p,h=glyph_at('e',size,cx,cy); by=cy+h/2
    tail=f'<path d="M{cx-85} {by-60} Q{cx-12} {by+85} {cx} {by+125} Q{cx+12} {by+85} {cx+85} {by-60} Z"/>'
    shape=p+tail
    edge=ns(p,60,size)+tail.replace('<path ','<path stroke-width="60" ')
    # play triangle placed in the e's upper counter
    tx,ty=cx-8,cy-92
    tri=f'<path d="M{tx-34} {ty-40} L{tx+44} {ty} L{tx-34} {ty+40} Z" fill="{LIME}" stroke="{LIME}" stroke-width="22" stroke-linejoin="round"/>'
    g=f'<g transform="rotate(-8 {cx} {cy})">{soft_shadow(cx,by+175,125)}<g fill="{WHITE}" stroke="{WHITE}" stroke-linejoin="round">{edge}</g><g fill="{INK}">{shape}</g>{tri}</g>'
    return icon(g, bg=LIME), tri

for n,s in (('R1',v1()),('R2',v2())): open(f'out/icon-{n}.svg','w').write(s)
s3,tri=v3(); open('out/icon-R3.svg','w').write(s3)

s4=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 2400" width="2400" height="2400"><defs><clipPath id="sq"><rect width="1024" height="1024" rx="230"/></clipPath></defs><rect width="2400" height="2400" fill="#0B141A"/>']
for i,n in enumerate(['R1','R2','R3']):
    x=110+i*770
    s4.append(use(n,x,140,0.68))
    s4.append(f'<text x="{x+348}" y="900" fill="#9FB0BD" font-family="Helvetica" font-size="44" text-anchor="middle">{i+1}</text>')
    s4.append(use(n,x+170,980,0.2)); s4.append(use(n,x+420,1010,0.11))
    s4.append(use(n,x,1300,0.16))
    lp,_=text_path('elsewhere',96,x+190,1405,track=-12)
    s4.append(f'<g fill="#FFF" stroke="#FFF" stroke-linejoin="round">{ns(lp,20,96)}</g><g fill="{INK}">{lp}</g>')
s4.append('</svg>')
open('out/sheet-R.svg','w').write(''.join(s4))
