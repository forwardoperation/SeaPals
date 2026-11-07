"""Generate an editable, filter-free underwater environment. Python standard library only."""
from pathlib import Path
import math
import random
import gzip
import xml.etree.ElementTree as ET

OUT = Path(__file__).parent
rng = random.Random(71)
W, H = 1536, 1024

def n(v):
    return f"{v:.1f}".rstrip('0').rstrip('.')

def pt(x, y):
    return f"{n(x)} {n(y)}"

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none">',
'<title>Sea Realm — clear tropical water and a sunlit sand floor</title>',
'<desc>Editable vector background, with perspective caustics, fine sand, small coral rubble, and distant fish. No raster images, SVG filters, or animation.</desc>',
'''<defs>
<linearGradient id="water" x1="768" y1="0" x2="768" y2="1024" gradientUnits="userSpaceOnUse"><stop stop-color="#0073CB"/><stop offset=".36" stop-color="#087BC4"/><stop offset=".65" stop-color="#339EC7"/><stop offset="1" stop-color="#6DBBD4"/></linearGradient>
<radialGradient id="blueDepth" cx="0" cy="0" r="1" gradientTransform="translate(122 230) rotate(11) scale(1184 820)" gradientUnits="userSpaceOnUse"><stop stop-color="#004CA9" stop-opacity=".56"/><stop offset="1" stop-color="#004CA9" stop-opacity="0"/></radialGradient>
<radialGradient id="surfaceLight" cx="0" cy="0" r="1" gradientTransform="translate(1144 -116) rotate(105) scale(740 1060)" gradientUnits="userSpaceOnUse"><stop stop-color="#58BDFA" stop-opacity=".31"/><stop offset=".68" stop-color="#39A4E6" stop-opacity=".08"/><stop offset="1" stop-color="#39A4E6" stop-opacity="0"/></radialGradient>
<linearGradient id="sunray" x1="1040" y1="0" x2="900" y2="700" gradientUnits="userSpaceOnUse"><stop stop-color="#A9E7FF" stop-opacity=".016"/><stop offset="1" stop-color="#A9E7FF" stop-opacity="0"/></linearGradient>
<linearGradient id="seafloor" x1="830" y1="340" x2="700" y2="1024" gradientUnits="userSpaceOnUse"><stop stop-color="#80C9DA" stop-opacity="0"/><stop offset=".10" stop-color="#80C9DA" stop-opacity=".24"/><stop offset=".28" stop-color="#90CAD9" stop-opacity=".87"/><stop offset=".58" stop-color="#B3D9DE"/><stop offset="1" stop-color="#D0E4DF"/></linearGradient>
<linearGradient id="sandLight" x1="1130" y1="410" x2="1190" y2="1024" gradientUnits="userSpaceOnUse"><stop stop-color="#F0F7E8" stop-opacity="0"/><stop offset="1" stop-color="#EDF3E5" stop-opacity=".37"/></linearGradient>
<linearGradient id="sandHaze" x1="768" y1="332" x2="768" y2="540" gradientUnits="userSpaceOnUse"><stop stop-color="#177DB8" stop-opacity="0"/><stop offset=".3" stop-color="#177DB8" stop-opacity=".45"/><stop offset="1" stop-color="#177DB8" stop-opacity="0"/></linearGradient>
<linearGradient id="detailDepth" x1="768" y1="390" x2="768" y2="1024" gradientUnits="userSpaceOnUse"><stop stop-color="#D3EDEB" stop-opacity=".01"/><stop offset=".31" stop-color="#DCEEE9" stop-opacity=".14"/><stop offset="1" stop-color="#F0F7E9" stop-opacity=".54"/></linearGradient>
<radialGradient id="sandDepression"><stop stop-color="#327B9B" stop-opacity=".23"/><stop offset=".55" stop-color="#5293A9" stop-opacity=".10"/><stop offset="1" stop-color="#629FB0" stop-opacity="0"/></radialGradient>
<radialGradient id="rubbleShadow"><stop stop-color="#2B6E8A" stop-opacity=".62"/><stop offset=".45" stop-color="#2B6E8A" stop-opacity=".35"/><stop offset="1" stop-color="#2B6E8A" stop-opacity="0"/></radialGradient>
</defs>''']

def path(d, fill, opacity=None, extra=''):
    op = '' if opacity is None else f' opacity="{opacity}"'
    svg.append(f'<path d="{d}" fill="{fill}"{op}{extra}/>')

def rect(fill):
    svg.append(f'<path d="M0 0H1536V1024H0Z" fill="{fill}"/>')

rect('url(#water)')
rect('url(#blueDepth)')
rect('url(#surfaceLight)')
svg.append('<g id="Faint light through open water">')
for a,b,c,d in [(850,906,570,852),(1052,1102,1005,1180),(1220,1261,1330,1520)]:
    path(f'M{a} 0H{b}L{d} 740H{c}Z','url(#sunray)')
svg.append('</g>')

# Very fine broken surface light, restrained so the blue remains open.
surface = []
for i in range(50):
    x = rng.uniform(300,1570); y = rng.uniform(-5,100)
    w = rng.uniform(12,65); h = rng.uniform(.8,3.5)
    surface.append(f'M{pt(x,y)}q{pt(w*.3,-h)} {pt(w*.57,0)}t{pt(w*.43,-h*.25)}q{pt(-w*.23,h*1.3)} {pt(-w*.6,h*.65)}T{pt(x,y)}Z')
path(''.join(surface), '#72C4EE', .045)

# Horizon is a gentle sloping dissolve into the floor rather than a hard line.
rect('url(#seafloor)')
rect('url(#sandLight)')

# Broad, naturally patchy sand tones. Avoid regular ripples or repeated rows.
svg.append('<g id="Subtle sand relief">')
for idx in range(14):
    x=rng.uniform(-250,1300); y=rng.uniform(490,1070)
    w=rng.uniform(190,550); h=rng.uniform(15,64)*(y-350)/650
    d=f'M{pt(x,y)}C{pt(x+w*.16,y-h)} {pt(x+w*.29,y-h*.7)} {pt(x+w*.5,y-h*.32)}S{pt(x+w*.76,y+h*.12)} {pt(x+w,y-h*.26)}C{pt(x+w*.92,y+h*.55)} {pt(x+w*.69,y+h)} {pt(x+w*.5,y+h*.52)}S{pt(x+w*.22,y+h*.7)} {pt(x,y)}Z'
    path(d,'#478EAE' if idx%3 else '#F0F6E8', .035 if idx%3 else .08)
svg.append('</g>')

# Broad, translucent low spots make the floor feel like actual uneven sand.
svg.append('<g id="Diffuse sand hollows">')
for x,y,rx,ry in [(205,665,360,95),(1090,709,470,123),(635,943,410,92),(1490,1005,340,110)]:
    svg.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="url(#sandDepression)"/>')
svg.append('</g>')

# An irregular, open cellular network of refracted light. Voronoi edges are
# generated once, curved and projected into distance, then batched by depth.
netrng=random.Random(432)
cols,rows=12,28
seeds=[((c+netrng.uniform(.08,.92))*1600/cols-30,
        (r+netrng.uniform(.08,.92))*2200/rows)
       for r in range(rows) for c in range(cols)]

def clipped(poly,A,B,C):
    result=[]
    for j,p in enumerate(poly):
        q=poly[(j+1)%len(poly)]
        pv=A*p[0]+B*p[1]-C;qv=A*q[0]+B*q[1]-C
        if pv<=0:result.append(p)
        if (pv<=0)!=(qv<=0):
            t=pv/(pv-qv);result.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return result

def project(p):
    return (p[0],422+max(0,p[1]/2200)**1.85*660)

edges={}
for i,p in enumerate(seeds):
    cell=[(-80,0),(1620,0),(1620,2250),(-80,2250)]
    for j,q in enumerate(seeds):
        if i==j or abs(p[0]-q[0])>350 or abs(p[1]-q[1])>250:continue
        A=q[0]-p[0];B=q[1]-p[1]
        cell=clipped(cell,A,B,(q[0]*q[0]+q[1]*q[1]-p[0]*p[0]-p[1]*p[1])/2)
        if not cell:break
    for j,a in enumerate(cell):
        b=cell[(j+1)%len(cell)]
        if math.hypot(a[0]-b[0],a[1]-b[1])<10:continue
        key=tuple(sorted([(round(a[0],1),round(a[1],1)),(round(b[0],1),round(b[1],1))]))
        edges[key]=(a,b)

network=[[[],[],[]] for _ in range(3)]
for a,b in edges.values():
    if netrng.random()<.19:continue
    a=project(a);b=project(b);y=(a[1]+b[1])/2
    # The distant network dissolves into the haze; the foreground is most legible.
    if y<480:continue
    dx=b[0]-a[0];dy=b[1]-a[1]
    bow=netrng.choice([-1,1])*netrng.uniform(.24,.72)
    mx=(a[0]+b[0])/2-dy*bow;my=(a[1]+b[1])/2+dx*bow*.4
    # Break many light traces before intersections, just as real caustics open
    # and dissolve. Keep a few connected junctions for a recognizable network.
    if netrng.random()<.57:
        t0=netrng.uniform(0,.19);t1=netrng.uniform(.65,.98)
        def bez(t):
            return ((1-t)**2*a[0]+2*(1-t)*t*mx+t*t*b[0],
                    (1-t)**2*a[1]+2*(1-t)*t*my+t*t*b[1])
        pa=bez(t0);pb=bez(t1)
        mx=pa[0]+(t1-t0)*((1-t0)*(mx-a[0])+t0*(b[0]-mx))
        my=pa[1]+(t1-t0)*((1-t0)*(my-a[1])+t0*(b[1]-my))
        a,b=pa,pb
    d=f'M{pt(*a)}Q{pt(mx,my)} {pt(*b)}'
    tone=netrng.choices([0,1,2],[.25,.55,.20])[0]
    network[min(2,max(0,int((y-470)/190)))][tone].append(d)
svg.append('<g id="Sunlight caustic network" stroke-linecap="round" stroke-linejoin="round">')
for i,tones in enumerate(network):
    for tone,d in enumerate(tones):
        opacity=[.42,.78,1.08][tone]
        path(''.join(d),'none',round([.055,.075,.105][i]*opacity,3),f' stroke="#E7F3E7" stroke-width="{n([6,9,13][i]*[.7,1,1.2][tone])}"')
        path(''.join(d),'none',round([.15,.25,.38][i]*opacity,3),f' stroke="#EFF6E8" stroke-width="{n([.9,1.5,2.1][i]*[.65,1,1.3][tone])}"')
svg.append('</g>')

# Delicate, wandering caustic ribbons; each is a distinct tapered curved shape.
# A few branch away or cross, with no grid and no animation/rendering filters.
caustics=[[],[],[]]
shade=[]
for i in range(100):
    y=rng.uniform(405,1060); v=(y-370)/680
    x=rng.uniform(-50,1550)
    w=rng.uniform(24,100)*(.35+v)
    dy=rng.uniform(-16,18)*v
    bend=rng.uniform(-17,17)*v
    thick=rng.uniform(.6,2.8)*v
    p1=(x+w*.27,y+bend);p2=(x+w*.64,y-bend*.7+dy);p3=(x+w,y+dy)
    d=f'M{pt(x,y)}C{pt(*p1)} {pt(*p2)} {pt(*p3)}C{pt(x+w*.69,y+dy-bend*.65+thick)} {pt(x+w*.26,y+bend+thick*1.2)} {pt(x,y)}Z'
    caustics[i%3].append(d)
    if i%3==0:
        shade.append(f'M{pt(x+w*.06,y+thick*3)}C{pt(x+w*.3,y+bend+thick*3)} {pt(x+w*.68,y-bend*.7+dy+thick*2)} {pt(x+w,y+dy)}C{pt(x+w*.6,y+dy-bend*.5+thick*4)} {pt(x+w*.2,y+bend+thick*5)} {pt(x+w*.06,y+thick*3)}Z')
    if i%5==0:
        caustics[i%3].append(f'M{pt(x+w*.47,y+dy*.5)}q{pt(-w*.14,12*v)} {pt(w*.02,27*v)}q{pt(-w*.1,-17*v)} {pt(-w*.02,-27*v)}Z')
svg.append('<g id="Irregular seafloor caustics">')
path(''.join(shade),'#3D83A3',.075)
for i,d in enumerate(caustics): path(''.join(d),'url(#detailDepth)',[.85,.65,.42][i])
svg.append('</g>')

# Small cloudy carbonate patches, with softly irregular silhouettes built from curves.
patches=[[],[],[]]
for i in range(120):
    x=rng.uniform(-25,1560);y=rng.uniform(415,1060);v=(y-350)/680
    w=rng.uniform(5,40)*v;h=rng.uniform(1,8)*v
    patches[i%3].append(f'M{pt(x-w,y)}q{pt(w*.4,-h*1.4)} {pt(w*.8,-h*.7)}t{pt(w*.8,-h*.1)}l{pt(w*.5,h*.7)}q{pt(-w*.4,h*.8)} {pt(-w*.8,h*.5)}t{pt(-w*.8,h*.1)}Z')
for i,d in enumerate(patches): path(''.join(d),['#347D9F','#5D9DAE','#EEF1DD'][i],[.08,.10,.22][i])

# Sand and scattered coral grains. Batched by material, not individual nodes.
grains=[[],[],[],[],[],[]]
for i in range(450):
    x=rng.uniform(0,W);y=rng.uniform(398,1028);v=(y-370)/654
    a=rng.uniform(.55,2.5)*(.23+v**1.2)
    b=a*rng.uniform(.35,.9)
    if rng.random()<.11: a*=2.3;b*=1.6
    grains[i%6].append(f'M{pt(x-a,y)}l{pt(a*.55,-b)} {pt(a*.94,-b*.18)} {pt(a*.63,b*.78)} {pt(-a*.38,b*.63)} {pt(-a*.9,b*.08)}Z')
svg.append('<g id="Fine mineral sand and coral grains">')
for i,d in enumerate(grains): path(''.join(d),['#36718C','#5B8390','#668F99','#8EAAA9','#FAF5E1','#E6ECDA'][i],[.24,.27,.26,.41,.58,.46][i])
svg.append('</g>')

# Small, low-profile bits of carbonate rock with shadow, cool face and light top.
rock_layers=[[],[],[],[]]
for i in range(105):
    x=rng.uniform(-5,1540);y=rng.uniform(435,1050);v=(y-360)/664
    a=rng.uniform(2,7.5)*(.25+v*1.3);b=rng.uniform(1,4.5)*(.2+v)
    if i%13==0:a*=1.75;b*=1.5
    rock_layers[0].append(f'M{pt(x-a*1.5,y+b*.15)}q{pt(a,-b*.5)} {pt(a*2.5,b*.1)}l{pt(a*.7,b*.6)}q{pt(-a*1.5,b*.5)} {pt(-a*3.2,-b*.7)}Z')
    rock_layers[1].append(f'M{pt(x-a,y)}l{pt(a*.25,-b*.9)} {pt(a*.75,-b*.4)} {pt(a*.72,b*.34)} {pt(a*.55,b*.98)} {pt(-a*.65,b*.5)} {pt(-a*.9,-b*.05)}Z')
    rock_layers[2].append(f'M{pt(x-a,y)}l{pt(a*.25,-b*.9)} {pt(a*.75,-b*.4)} {pt(a*.72,b*.34)} {pt(-a*.55,b*.38)} {pt(-a*.4,-b*.15)} {pt(-a*.1,b*.65)}Z')
    if i%2==0:rock_layers[3].append(f'M{pt(x-a*.7,y-b*.9)}l{pt(a*.7,-b*.4)} {pt(a*.72,b*.34)} {pt(-a*.75,b*.09)}Z')
svg.append('<g id="Scattered limestone fragments">')
for i,d in enumerate(rock_layers):path(''.join(d),['#3B7893','#638791','#C1D4CC','#EAF0D9'][i],[.16,.5,.70,.75][i])
svg.append('</g>')

# Discreet reef/rubble clusters, edges kept broken and irregular.
clusters = [(1390,450,1.0,.16),(1273,471,.65,.16),(153,413,.57,.13),
            (64,729,.70,.57),(1494,707,.53,.45),(268,916,1.10,.72),
            (1257,856,.4,.48),(1015,603,.26,.3)]
svg.append('<g id="Distant reef and sparse foreground rubble">')
for ci,(cx,cy,s,op) in enumerate(clusters):
    layers=[[],[],[],[]]
    count=14 if ci in (0,5) else 8
    shadow=f'M{pt(cx-89*s,cy)}a{pt(89*s,15*s)} 0 1 0 {pt(178*s,0)}a{pt(89*s,15*s)} 0 1 0 {pt(-178*s,0)}Z'
    path(shadow,'url(#rubbleShadow)',op*.7)
    for j in range(count):
        x=cx+rng.gauss(0,36)*s;y=cy+rng.gauss(0,5)*s
        a=rng.uniform(4,14)*s;b=rng.uniform(6,22)*s
        if ci==5:b*=.65
        d=f'M{pt(x-a,y)}l{pt(a*.2,-b*.48)} {pt(a*.28,-b*.06)} {pt(a*.15,-b*.42)} {pt(a*.65,-b*.04)} {pt(a*.23,b*.19)} {pt(a*.4,b*.07)} {pt(a*.12,b*.43)} {pt(a*.28,b*.2)} {pt(-a*.7,b*.3)}Z'
        layers[0].append(d)
        layers[1].append(f'M{pt(x-a,y)}l{pt(a*.2,-b*.48)} {pt(a*.28,-b*.06)} {pt(a*.15,-b*.42)} {pt(a*.65,-b*.04)} {pt(-a*.15,b*.3)} {pt(-a*.42,b*.13)} {pt(-a*.1,b*.45)}Z')
        layers[2].append(f'M{pt(x-a*.8,y-b*.48)}l{pt(a*.28,-b*.06)} {pt(a*.15,-b*.42)} {pt(a*.65,-b*.04)} {pt(-a*.45,b*.23)} {pt(-a*.1,b*.24)}Z')
        for k in range(2):
            gx=x+rng.uniform(-.65,.5)*a;gy=y-rng.uniform(.12,.7)*b
            layers[3].append(f'M{pt(gx,gy)}l{pt(a*.16,-b*.08)} {pt(a*.16,b*.06)} {pt(-a*.1,b*.12)}Z')
    cols=['#3A697E','#6B969D','#A9C4BD','#244F66'] if ci<3 else ['#6D878A','#A3B6AA','#DFE2CC','#385F6C']
    for k in range(4):path(''.join(layers[k]),cols[k],op*[.9,.8,.92,.46][k])
svg.append('</g>')

# A thin color veil carries all distant texture back into the water.
path('M0 330H1536V540H0Z','url(#sandHaze)')

# Tiny fish are deliberately distant, leaving the main animal as the focal point.
svg.append('<g id="Distant fish silhouettes" fill="#086799" opacity=".21">')
for x,y,s,flip in [(490,334,1.0,False),(623,302,.58,False),(1047,338,.45,True),(1218,381,.43,False)]:
    p=f'M{pt(x-22*s,y)}q{pt(17*s,-13*s)} {pt(42*s,-1*s)}l{pt(12*s,-8*s)} {pt(-3*s,10*s)} {pt(3*s,8*s)} {pt(-12*s,-6*s)}q{pt(-25*s,9*s)} {pt(-42*s,-3*s)}Z'
    svg.append(f'<path d="{p}"/>')
    svg.append(f'<path d="M{pt(x-2*s,y-6*s)}l{pt(3*s,-7*s)} {pt(8*s,9*s)}Z"/>')
svg.append('</g>')
svg.append('</svg>')

result='\n'.join(svg)+'\n'
destination=OUT/'underwater-background.svg'
destination.write_text(result,encoding='utf-8')
root=ET.fromstring(result)
counts={}
for el in root.iter():
    tag=el.tag.split('}')[-1]
    counts[tag]=counts.get(tag,0)+1
print({'path':str(destination),'bytes':len(result.encode()),'gzip_bytes':len(gzip.compress(result.encode())), 'paintable_elements':sum(counts.get(x,0) for x in ('path','rect','circle','ellipse','polygon','polyline','line','text')), 'tags':counts})
