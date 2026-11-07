"""Editable, hand-traced SVG layers in the photograph's coordinate system."""
import json, math
from pathlib import Path
from xml.sax.saxutils import escape

ROOT=Path(__file__).parent
G=json.loads((ROOT/'geometry-review.json').read_text(encoding='utf-8-sig'))
P=G['paths']
def path(name,d,fill='none',stroke=None,width=1,opacity=1):
    return f'<path id="{escape(name)}" d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else '')+f' opacity="{opacity}"/>'
def ellipse(name,cx,cy,rx,ry,fill,stroke=None,width=1):
    return f'<ellipse id="{name}" cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}"' if stroke else '')+'/>'
def group(name,s): return f'<g id="{name}">{s}</g>'
def linear(name,stops,x1=0,y1=0,x2=0,y2=1):
    return f'<linearGradient id="{name}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'+''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o,c,a in stops)+'</linearGradient>'
DEFS=linear('body',[(0,'#759878',1),(.22,'#4D9EA2',1),(.5,'#357F9B',1),(.75,'#357C87',1),(1,'#577E62',1)])
DEFS+=linear('face',[(0,'#64A5A0',1),(.47,'#A3AE59',1),(.68,'#E5C747',1),(1,'#3C8F9B',1)],.7,0,.2,1)
DEFS+=linear('gold',[(0,'#B1A631',1),(.23,'#F9CF13',1),(.62,'#FFE331',1),(1,'#BC8D1C',1)],0,0,.6,1)
DEFS+=linear('tail',[(0,'#FDE029',1),(.55,'#F9D720',1),(.85,'#C3B333',1),(1,'#57705D',1)],0,.5,1,.5)
DEFS+=linear('pectoral',[(0,'#FFDF16',.94),(.48,'#DDC726',.89),(1,'#779359',.5)],0,.5,1,.5)
DEFS+=linear('shadow',[(0,'#123F66',0),(.52,'#153E59',.08),(1,'#082F49',.40)])
DEFS+='<linearGradient id="tail-blend" gradientUnits="userSpaceOnUse" x1="830" y1="380" x2="942" y2="380"><stop offset="0" stop-color="#EBD336" stop-opacity="0"/><stop offset=".65" stop-color="#EBD336" stop-opacity=".22"/><stop offset="1" stop-color="#FBE02C"/></linearGradient>'
DEFS+=linear('rimlight',[(0,'#F8E048',.85),(.25,'#DBDC49',.4),(1,'#3DBBCC',0)])
DEFS+=linear('bellylight',[(0,'#0EADF3',.85),(1,'#5DC2BB',0)],0,.8,1,.1)
DEFS+=linear('iris',[(0,'#FFF068',1),(.35,'#C6AD2A',1),(.7,'#967121',1),(1,'#E0D460',1)],0,0,1,1)
DEFS+=linear('lip',[(0,'#FFFF8A',1),(.5,'#F3D83B',1),(1,'#AA882A',1)],0,0,.5,1)
DEFS+='<radialGradient id="face-glow" gradientUnits="userSpaceOnUse" cx="290" cy="420" r="248"><stop offset="0" stop-color="#F6D934"/><stop offset=".40" stop-color="#D7C54E" stop-opacity=".97"/><stop offset=".70" stop-color="#8CB391" stop-opacity=".78"/><stop offset="1" stop-color="#4D9EA2" stop-opacity="0"/></radialGradient>'
for k in ['body','dorsal','anal','caudal','pelvic','pectoral']:
    DEFS+=f'<clipPath id="clip-{k}"><path d="{G[k]}"/></clipPath>'

def svg(content,vb='230 40 1040 740',w=1040,h=740):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}"><defs>{DEFS}</defs>{content}</svg>'
def clipped(k,s): return f'<g clip-path="url(#clip-{k})">{s}</g>'
layers={}
for key,title in [('pelvic','01 Pelvic fin'),('dorsal','02 Dorsal fin'),('anal','03 Anal fin'),('caudal','04 Caudal tail fin')]:
    fill='url(#tail)' if key=='caudal' else 'url(#gold)'
    s=path(title+' silhouette',G[key],fill,'#137FBC' if key!='caudal' else '#859843',1.2)
    rays=''
    if key=='dorsal':
        for i in range(42):
            t=i/41
            x0=455+425*t; y0=228+98*t*t
            x1=485+604*t; y1=180-99*t
            rays+=path(f'Dorsal ray {i+1:02}',f'M{x0:.1f} {y0:.1f} Q{x0+55:.1f} {y0-100:.1f} {x1:.1f} {y1:.1f}',stroke='#946F23',width=.9,opacity=.55)
            rays+=path(f'Dorsal light ray {i+1:02}',f'M{x0+2:.1f} {y0:.1f} Q{x0+59:.1f} {y0-96:.1f} {x1+4:.1f} {y1:.1f}',stroke='#FFE34C',width=1.05,opacity=.8)
    elif key=='anal':
        for i in range(42):
            t=i/41; sx=760+130*t;sy=595-157*t;ex=780+407*t;ey=624+45*t
            rays+=path(f'Anal ray {i+1:02}',f'M{sx:.1f} {sy:.1f} Q{sx+77:.1f} {sy+95:.1f} {ex:.1f} {ey:.1f}',stroke='#977C24',width=1.3,opacity=.53)
            rays+=path(f'Anal light ray {i+1:02}',f'M{sx+2:.1f} {sy:.1f} Q{sx+80:.1f} {sy+95:.1f} {ex+4:.1f} {ey:.1f}',stroke='#FFD936',width=1.1,opacity=.8)
    elif key=='caudal':
        for i in range(49):
            t=i/48; ex=1068+31*math.sin(math.pi*t); ey=224+292*t;sy=365+36*t
            rays+=path(f'Caudal ray {i+1:02}',f'M913 {sy:.1f} Q984 {sy+(ey-sy)*.43:.1f} {ex:.1f} {ey:.1f}',stroke='#657D48',width=1.2,opacity=.46)
            rays+=path(f'Caudal golden ray {i+1:02}',f'M922 {sy+1.6:.1f} Q989 {sy+(ey-sy)*.43+2:.1f} {ex:.1f} {ey+2:.1f}',stroke='#FFED47',width=1.3,opacity=.5)
    else:
        for i in range(24):
            t=i/23;ex=545+193*t;ey=614+136*t
            rays+=path(f'Pelvic ray {i+1:02}',f'M{473+18*t:.1f} {588+8*t:.1f} Q{517+50*t:.1f} {620+54*t:.1f} {ex:.1f} {ey:.1f}',stroke='#4F714D',width=1.3,opacity=.75)
            rays+=path(f'Pelvic light ray {i+1:02}',f'M{476+18*t:.1f} {588+8*t:.1f} Q{520+50*t:.1f} {620+54*t:.1f} {ex+3:.1f} {ey:.1f}',stroke='#FFF06A',width=.8,opacity=.6)
    layers[title]=s+group(title+' rays',clipped(key,rays))

face='M276 411 C320 353 369 264 411 235 C428 299 450 350 472 401 C470 469 481 542 513 593 C438 584 370 552 329 518 C303 493 282 474 268 457 C263 451 261 447 262 443 L282 442 C272 439 261 435 264 426 C267 420 272 416 276 411 Z'
layers['05 Body and face base']=path('Body silhouette',G['body'],'url(#body)')+path('Face gold to blue transition',G['body'],'url(#face-glow)')
grain=''
for ix in range(29):
    x=329+ix*5
    dots=''
    for iy in range(41):
        y=291+iy*6+(ix%2)*3
        if x<410 and y<408: continue
        if ((x-375)/60)**2+((y-463)/59)**2>1 and not (x>412 and 296<y<536): continue
        if x>431 and 355<y<489: continue
        dots+=f'M{x} {y} q2 -2 3 1 q-1 2 -3 1 '
    if dots: grain+=path(f'Cheek micro scales {ix:02}',dots,stroke='#C8BF62',width=.65,opacity=.34)
layers['05 Body and face base']+=group('Fine cheek scale texture',clipped('body',grain))

try:
    from scale_pattern import build_scales
    layers['06 Scales - individually editable']=clipped('body',build_scales())
except ImportError:
    layers['06 Scales - individually editable']=''

shadow=''
shadow+=path('Lower flank volume','M450 447 C603 506 775 518 883 407 C880 503 847 565 802 604 C663 616 523 602 449 582 Z','url(#shadow)')
shadow+=path('Tail peduncle gold transition',G['body'],'url(#tail-blend)')
shadow+=path('Gill and operculum crease',P['gill_dark_fold'],'#153C6D',opacity=.87)
shadow+=path('Under cheek seam','M332 516 C375 526 425 515 453 500',stroke='#133A53',width=5,opacity=.8)
shadow+=path('Pectoral socket shadow','M479 460 C498 453 526 472 537 496 C525 517 506 527 489 517 C474 493 470 475 479 460 Z','#194B66',opacity=.65)
shadow+=path('Dorsal root fold','M462 211 C565 157 709 143 792 198',stroke='#485F57',width=3,opacity=.28)
shadow+=path('Tail peduncle lower fold','M836 514 C859 482 869 443 883 433 C899 422 919 427 932 432',stroke='#16465D',width=3.5,opacity=.55)
shadow+=path('Eye socket arc','M346 369 C350 344 382 342 397 361 C406 378 402 401 387 411',stroke='#337682',width=6,opacity=.6)
shadow+=path('Lip crease',P['mouth_shadow'],'#263F44')
layers['07 Shadows and contour lines']=shadow

marks=path('Crown cyan halo',P['crown_cyan_border'],'#02BEF0', '#178DCA',1.5)
marks+=path('Crown dark patch',P['crown_dark_center'],'#003879')
marks+=ellipse('Crown fleck 1',383,285,2,4,'#10A7E9')+ellipse('Crown fleck 2',375,303,2.1,3,'#10A7E9')
for key in ['gill_outer_cyan','gill_front_cyan','cheek_cyan','nose_cyan']:
    marks+=path(key.replace('_',' '),P[key],'#02ABF1','#077AD5',.8)
marks+=path('Gill fine reflected edge','M437 492 Q452 488 458 470',stroke='#5CE3EA',width=1.5)
marks+=path('Nostril gold rim','M313 393 Q318 380 330 388',stroke='#F8D441',width=5)
marks+=ellipse('Nostril',323,390,6,3.7,'#799272')
marks+=path('Upper lip',P['upper_lip'],'url(#lip)')+path('Lower lip',P['lower_lip'],'url(#lip)')
marks+=path('Mouth opening',P['mouth_shadow'],'#23353B')
marks+=path('Upper lip highlight','M269 424 Q280 421 293 432',stroke='#FFF381',width=2,opacity=.85)
layers['08 Face - crown gill mouth']=marks

eye=ellipse('Outer eye socket',373,383,30,32,'#217CAE')
eye+=ellipse('Electric blue outer rim',373,383,27.5,29,'#13BDED')
eye+=ellipse('Gold outer iris',373,383,24,25,'url(#iris)','#507B72',1)
eye+=ellipse('Iris olive middle ring',374,384,19.5,20,'#767031')
eye+=ellipse('Fine golden inner ring',374,384,16.3,17,'#F1D244')
eye+=ellipse('Black pupil',374,384,13.9,14.2,'#031421')
eye+=path('Lower iris reflected arc','M362 393 C369 401 382 398 387 388',stroke='#EEED9D',width=1.4)
eye+=path('Upper rim blue glint','M352 371 C360 355 382 354 390 363',stroke='#6EE1DA',width=1.3,opacity=.95)
eye+=ellipse('Small eye glint',369,377,3.1,1.7,'#BDDDE0')
layers['09 Eye - rings pupil glints']=eye

s=path('Pectoral translucent membrane',G['pectoral'],'url(#pectoral)')
rays=''
for i in range(28):
    t=i/27; ex=588+28*math.sin(math.pi*t);ey=387+156*t
    rays+=path(f'Pectoral ray {i+1:02}',f'M{496+8*t:.2f} {476+29*t:.2f} Q555 {456+58*t:.2f} {ex:.2f} {ey:.2f}',stroke='#E7CE28',width=1.2,opacity=.9)
    rays+=path(f'Pectoral shadow ray {i+1:02}',f'M{497+8*t:.2f} {477+29*t:.2f} Q556 {457+58*t:.2f} {ex:.2f} {ey+2:.2f}',stroke='#7D8E45',width=.8,opacity=.5)
s+=group('Pectoral fin rays',clipped('pectoral',rays))+path('Cobalt pectoral base',P['pectoral_blue_base'],'#072F9C')
s+=path('Pectoral base reflected blue','M479 465 C484 461 489 461 494 465',stroke='#2588F3',width=2)
layers['10 Pectoral fin and blue base']=s

high=path('Dorsal cobalt outer margin',G['dorsal'].split(' C1195')[0],stroke='#0786F5',width=2.2,opacity=.95)
high+=path('Dorsal trailing blue edge','M1116 81 C1048 85 991 109 945 138 C910 160 891 190 892 221 C889 250 904 288 897 311 C893 329 882 334 872 325',stroke='#087BFF',width=2.6)
high+=path('Anal cobalt margin','M909 437 C930 472 928 506 947 535 C965 577 1001 602 1043 620 C1108 647 1219 669 1231 689 M641 592 C695 624 750 638 803 636 C874 638 960 628 1030 636',stroke='#087BFF',width=3)
high+=path('Pelvic cobalt margin','M462 587 C494 630 545 673 593 695 C646 723 704 746 766 756',stroke='#008EFD',width=2.4)
high+=path('Forehead gold sheen','M346 313 C383 260 397 238 442 217 C536 170 635 147 715 168 C563 159 441 230 403 291 C379 319 358 359 339 384 Z','url(#rimlight)')
high+=path('Ventral cyan reflected light',P['ventral_cyan_edge'],'url(#bellylight)')
high+=path('Lower face turquoise wash','M335 522 C367 530 407 532 450 555 L481 591 C414 577 363 552 335 522 Z','url(#bellylight)',opacity=.8)
high+=path('Dorsal filament gold core','M813 150 C898 132 998 94 1081 82 C1129 75 1172 80 1187 92',stroke='#FFD344',width=1.9)
high+=path('Anal filament gold core','M1034 626 C1110 651 1212 675 1224 683',stroke='#FFD843',width=1.7)
layers['11 Color highlights and blue fin edges']=high

for name,content in layers.items(): (ROOT/(name+'.svg')).write_text(svg(group(name,content)),encoding='utf-8')
(ROOT/'queen-angelfish-master.svg').write_text(svg(''.join(group(n,c) for n,c in layers.items())),encoding='utf-8')
outlines=''
for k in ['pelvic','dorsal','anal','caudal','body','pectoral']:
    outlines+=path(k.title()+' outline',G[k],stroke='#134E68',width=1.8)
outlines+=ellipse('Eye outline',373,383,30,32,'none','#134E68',1.6)+ellipse('Pupil outline',374,384,14,14,'none','#134E68',1.1)
outlines+=path('Crown outline',G['crown'],stroke='#134E68',width=1.2)
outlines+=path('Gill contour',P['gill_outer_cyan'],stroke='#134E68',width=1.2)
(ROOT/'outline-study.svg').write_text(svg(outlines),encoding='utf-8')
manifest=[{'name':n,'filename':n+'.svg'} for n in layers]
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'layers':len(layers),'scale_svg_characters':len(layers['06 Scales - individually editable']),'master_bytes':(ROOT/'queen-angelfish-master.svg').stat().st_size}))
