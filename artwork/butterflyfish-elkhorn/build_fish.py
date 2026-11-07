"""Editable butterflyfish vector artwork in the supplied photo coordinates."""
import json, math, random
from pathlib import Path
from xml.sax.saxutils import escape
ROOT=Path(__file__).parent
G=json.loads((ROOT/'fish-geometry.json').read_text(encoding='utf-8-sig'))
P=G['paths']
from fish_scales import build_scales, scale_defs
def path(name,d,fill='none',stroke=None,width=1,opacity=1):
    return f'<path id="{escape(name)}" d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else '')+f' opacity="{opacity}"/>'
def ellipse(name,cx,cy,rx,ry,fill,stroke=None,width=1,opacity=1):
    return f'<ellipse id="{name}" cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" opacity="{opacity:.3f}"'+(f' stroke="{stroke}" stroke-width="{width}"' if stroke else '')+'/>'
def group(n,s): return f'<g id="{n}">{s}</g>'
def linear(n,stops,x1,y1,x2,y2):
    return f'<linearGradient id="{n}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'+''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o,c,a in stops)+'</linearGradient>'
DEFS=linear('pearl',[(0,'#E9E3CE',1),(.32,'#DDE5E9',1),(.65,'#BFD3DF',1),(1,'#D8D8C8',1)],450,162,575,605)
DEFS+=linear('gold',[(0,'#FFE317',1),(.4,'#E2C109',1),(.72,'#FADF24',1),(1,'#E9CC2D',1)],250,110,380,560)
DEFS+=linear('tailGlass',[(0,'#D5EDE4',.36),(.6,'#C3D9C6',.58),(1,'#F6E649',.8)],88,320,211,320)
DEFS+=linear('tailGold',[(0,'#FDF17C',.8),(.36,'#FFEB2B',1),(1,'#D8B612',1)],126,320,247,320)
DEFS+=linear('pectoralPearl',[(0,'#E2D892',.85),(.4,'#F1E5B0',.51),(1,'#CDDCD1',.18)],563,506,495,461)
DEFS+=linear('rearGold',[(0,'#DABC0E',1),(.4,'#E7D541',.8),(1,'#F0E184',0)],251,350,387,350)
DEFS+=linear('topGold',[(0,'#EADA49',.8),(.65,'#EFE5B4',.15),(1,'#EFE7CF',0)],400,150,435,258)
DEFS+=linear('bellyShade',[(0,'#698F9F',0),(.7,'#7D9196',.05),(1,'#536D70',.29)],475,400,530,604)
DEFS+=linear('frontFace',[(0,'#CBD2CF',1),(.5,'#E6DDCA',1),(1,'#F2DEBB',1)],672,490,740,593)
DEFS+=linear('eyeBand',[(0,'#211D0D',1),(.43,'#0F1315',1),(.73,'#242220',1),(1,'#38291B',1)],669,322,646,600)
DEFS+=linear('eyeIris',[(0,'#D9C78A',1),(.4,'#81765D',1),(.72,'#B0934F',1),(1,'#E2D8B2',1)],652,482,693,534)
DEFS+=linear('silverRim',[(0,'#F7F6DB',.9),(.6,'#E4F4F1',.25),(1,'#D0E6E7',0)],424,160,420,315)
DEFS+='<radialGradient id="eyeSpot" gradientUnits="userSpaceOnUse" cx="332" cy="236" r="51"><stop offset="0" stop-color="#17170F"/><stop offset=".54" stop-color="#211C10"/><stop offset=".77" stop-color="#4B3610" stop-opacity=".85"/><stop offset="1" stop-color="#8C711A" stop-opacity="0"/></radialGradient>'
DEFS+=scale_defs()
for key in ['full_silhouette','body','scale_region','dorsal','anal','caudal','pelvic','pectoral']:
    DEFS+=f'<clipPath id="bf-clip-{key}"><path d="{P[key]}"/></clipPath>'
def clip(key,s):return f'<g clip-path="url(#bf-clip-{key})">{s}</g>'
def svg(s):return f'<svg xmlns="http://www.w3.org/2000/svg" width="730" height="630" viewBox="60 60 730 630"><defs>{DEFS}</defs>{s}</svg>'
def interpolate(points,t):
    i=min(len(points)-2,int(t*(len(points)-1)));u=t*(len(points)-1)-i
    return [points[i][j]*(1-u)+points[i+1][j]*u for j in range(2)]
L={}
for key,title in [('caudal','01 Caudal tail fin'),('pelvic','02 Pelvic fin'),('anal','03 Anal fin'),('dorsal','04 Dorsal fin and spines')]:
    s=path(title+' silhouette',P[key],'url(#tailGlass)' if key=='caudal' else 'url(#gold)')
    if key=='caudal':s+=path('Yellow tail core',P['tail_yellow_core'],'url(#tailGold)')
    rays='';f=G['fins'][key]
    if 'rayPairs' in f:
        pairs=f['rayPairs']; count=3*(len(pairs)-1)
        for i in range(count+1):
            t=i/count;start=interpolate([p[0] for p in pairs],t);end=interpolate([p[1] for p in pairs],t)
            sx,sy=start;ex,ey=end;cx=(sx+ex)/2+4;cy=(sy+ey)/2-2
            rays+=path(f'{key.title()} ray {i+1:02}',f'M{sx:.2f} {sy:.2f} Q{cx:.2f} {cy:.2f} {ex:.2f} {ey:.2f}',stroke='#A89517',width=.85,opacity=.52)
            rays+=path(f'{key.title()} ray glint {i+1:02}',f'M{sx+1.2:.2f} {sy:.2f} Q{cx+1.2:.2f} {cy:.2f} {ex+1.2:.2f} {ey:.2f}',stroke='#FFF4A7',width=.7,opacity=.75)
    else:
        for i in range(f['count']):
            t=i/(f['count']-1);ex,ey=interpolate(f['arc'],t);sx,sy=f['origin'];sy+=3*(t-.5)
            rays+=path(f'{key.title()} ray {i+1:02}',f'M{sx:.2f} {sy:.2f} Q{(sx+ex)/2:.2f} {(sy+ey)/2-6:.2f} {ex:.2f} {ey:.2f}',stroke='#D7C545' if key=='pelvic' else '#EAF3D5',width=1,opacity=.82)
            rays+=path(f'{key.title()} ray shadow {i+1:02}',f'M{sx:.2f} {sy+1.2:.2f} Q{(sx+ex)/2:.2f} {(sy+ey)/2-4.5:.2f} {ex:.2f} {ey+1.3:.2f}',stroke='#949D70',width=.65,opacity=.32)
    s+=group(title+' individual rays',clip(key,rays))
    if key=='dorsal':
        spineTips=[(371,100,387,134),(399,92,430,162),(430,92,467,177),(462,93,505,203),(498,99,549,244),(543,114,585,265),(582,138,616,293),(612,166,637,311),(638,201,653,326),(660,242,667,329)]
        for i,(x,y,a,b) in enumerate(spineTips):s+=path(f'Dorsal spine bright edge {i+1:02}',f'M{x} {y} Q{(x+a)/2-2} {(y+b)/2} {a} {b}',stroke='#FFF3A4',width=1.7,opacity=.82)
    L[title]=s
L['05 Body and pearl color']=path('Body silhouette',P['body'],'url(#pearl)')+path('Yellow rear-body transition',P['body'],'url(#rearGold)')+path('Warm dorsal reflection',P['body'],'url(#topGold)')
L['06 Individual pearl scales']=clip('scale_region',build_scales())

mark=ellipse('Soft eyespot edge',332,236,52,59,'url(#eyeSpot)')+path('False eyespot dark center',P['false_eyespot'],'#252319',opacity=.78)
random.seed(94)
for i in range(290):
    a=random.random()*math.tau;r=math.sqrt(random.random());x=332+50*r*math.cos(a);y=235+59*r*math.sin(a)
    op=(.27+.55*random.random())*(1-.47*r)
    mark+=ellipse(f'Eyespot fleck {i+1:03}',x,y,random.uniform(.6,1.9),random.uniform(.8,2.1),random.choice(['#38331C','#51421A','#796522']),opacity=op)
mark+=path('Small dorsal tail spot',P['tail_spot'],'#272A16')
mark+=path('Vertical black eye band',P['eye_band'],'url(#eyeBand)')
L['07 Eye band and false eyespots']=clip('full_silhouette',mark)

face=path('Pale snout',P['pale_face'],'url(#frontFace)')
face+=path('Upper mouth lip',P['mouth_upper'],stroke='#FAECCF',width=2)
face+=path('Lower mouth lip',P['mouth_lower'],stroke='#DBCFAC',width=1.2)
face+=path('Mouth seam',P['mouth_seam'],stroke='#908776',width=1.2)
face+=path('Gill fold',P['gill_line'],stroke='#9DAEA9',width=1.7,opacity=.8)
face+=path('Gill plate pale reflected line',P['gill_highlight'],stroke='#ECF4E5',width=1.9,opacity=.8)
face+=path('Cheek contour',P['cheek_line'],stroke='#A0B6B9',width=1.1)
face+=path('Yellow gill marking',P['yellow_gill_mark'],'#D5B51B')
face+=path('Yellow gill fine light edge','M582 480 C594 460 601 443 611 431',stroke='#F1D731',width=1.2,opacity=.85)
L['08 Mouth and gill detail']=face

eye=ellipse('Eye socket soft outline',674,509,27,30,'#A7B5AF','#E2E4C9',1.1)
eye+=ellipse('Eye outer grey ring',674,509,24,27,'#615F4D','#E4DBC0',1)
eye+=ellipse('Gold and olive iris',674,510,20,23,'url(#eyeIris)')
eye+=ellipse('Inner iris dark ring',674,510,16.4,18.1,'#39362B','#C2AA62',.8)
eye+=ellipse('Round black pupil',674,511,13.7,14.7,'#070D12','#9C7F2E',.9)
eye+=path('Upper iris reflection','M659 498 C663 487 678 484 687 495',stroke='#F1E1BB',width=1.1,opacity=.8)
eye+=path('Lower pupil gold reflection','M665 523 Q678 529 685 519',stroke='#CFB364',width=.85,opacity=.8)
eye+=ellipse('Small subdued catchlight',667,501,2.1,2.6,'#BCCCD0',opacity=.48)
L['09 Eye rings pupil and glints']=eye

pect=path('Pectoral translucent membrane',P['pectoral'],'url(#pectoralPearl)');rays='';f=G['fins']['pectoral']
for i in range(26):
    t=i/25;ex,ey=interpolate(f['arc'],t);sx,sy=f['origin']
    rays+=path(f'Pectoral ray {i+1:02}',f'M{sx} {sy} Q{(sx+ex)/2-3:.2f} {(sy+ey)/2:.2f} {ex:.2f} {ey:.2f}',stroke='#E6D996',width=.85,opacity=.69)
pect+=clip('pectoral',group('Pectoral fin rays',rays))
pect+=path('Golden fin attachment',P['pectoral_attachment'],stroke='#D0AD18',width=5,opacity=.8)
L['10 Pectoral fin']=pect

shadow=path('Soft belly volume',P['body'],'url(#bellyShade)')
shadow+=path('Gill rear fold shadow',P['gill_line'],stroke='#849B9F',width=1.1,opacity=.4)
shadow+=path('Under pectoral subtle shade','M503 515 C518 531 540 542 558 527 C550 543 530 550 511 535 Z','#91AAAE',opacity=.15)
shadow+=path('Tail root shadow','M237 298 C248 319 249 343 238 362',stroke='#C4B333',width=2,opacity=.55)
shadow+=path('Anal contour shadow','M172 417 C158 443 179 479 205 495',stroke='#877B21',width=1.4,opacity=.7)
L['11 Shadows and contour lines']=shadow

high=''
high+=path('Dorsal pale edge','M222 189 C248 140 301 114 354 107',stroke='#FFF2A0',width=2,opacity=.83)
high+=path('Tail transparent rim','M170 194 C132 232 105 292 92 350 C86 377 89 397 96 407',stroke='#D6F0E7',width=1.2,opacity=.75)
high+=path('Anal pale reflected edge','M167 413 C151 436 161 462 179 482 C205 512 248 535 291 545',stroke='#EDF0C1',width=1.7,opacity=.8)
high+=path('Pelvic white-gold rim','M412 576 C400 603 392 638 397 657',stroke='#FFF5BB',width=1.5,opacity=.95)
high+=path('Face sunlight fine edge','M692 436 C697 473 710 512 721 536 C727 547 739 555 747 565',stroke='#F9E9AD',width=1.4,opacity=.9)
high+=path('Gill icy fine line','M582 496 C585 523 590 538 600 553',stroke='#F3F5D5',width=1,opacity=.8)
L['12 Silver and yellow highlights']=high

for name,s in L.items():(ROOT/(name+'.svg')).write_text(svg(group(name,s)),encoding='utf-8')
(ROOT/'butterflyfish-master.svg').write_text(svg(''.join(group(n,s) for n,s in L.items())),encoding='utf-8')
out=''
for key in ['caudal','pelvic','anal','dorsal','body','pectoral','eye_band','false_eyespot','tail_spot']:
    out+=path(key.replace('_',' ').title()+' outline',P[key],stroke='#134E68',width=1.4)
out+=ellipse('Eye outline',674,509,27,30,'none','#134E68',1.2)+ellipse('Pupil outline',674,511,13.7,14.7,'none','#134E68',.9)
out+=path('Gill outline',P['gill_line'],stroke='#134E68',width=1)
(ROOT/'fish-outline.svg').write_text(svg(out),encoding='utf-8')
(ROOT/'fish-mask.svg').write_text(svg(path('Fish silhouette',P['full_silhouette'],'white')),encoding='utf-8')
(ROOT/'fish-manifest.json').write_text(json.dumps([{'name':n,'filename':n+'.svg'} for n in L],indent=2))
print(json.dumps({'fishLayers':len(L),'masterBytes':(ROOT/'butterflyfish-master.svg').stat().st_size}))
