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
