"""Layered emperor angelfish vector study, traced in photo coordinates."""
import json, math
from pathlib import Path
from xml.sax.saxutils import escape
ROOT=Path(__file__).parent
G=json.loads((ROOT/'geometry.json').read_text(encoding='utf-8-sig'))
from stripes import build_stripes

def path(name,d,fill='none',stroke=None,width=1,opacity=1):
    return f'<path id="{escape(name)}" d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else '')+f' opacity="{opacity}"/>'
def ellipse(name,cx,cy,rx,ry,fill,stroke=None,width=1,opacity=1):
    return f'<ellipse id="{name}" cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" opacity="{opacity}"'+(f' stroke="{stroke}" stroke-width="{width}"' if stroke else '')+'/>'
def group(name,s): return f'<g id="{name}">{s}</g>'
def linear(name,stops,x1,y1,x2,y2):
    return f'<linearGradient id="{name}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'+''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o,c,a in stops)+'</linearGradient>'
DEFS=linear('body',[(0,'#677F96',1),(.25,'#285D9F',1),(.57,'#184996',1),(.83,'#122D63',1),(1,'#0B142E',1)],650,80,650,710)
DEFS+=linear('tail',[(0,'#BFA725',1),(.26,'#EBD236',1),(.65,'#F8D831',1),(1,'#829241',1)],1050,380,1210,380)
DEFS+=linear('dorsal',[(0,'#CCD995',1),(.3,'#70858C',1),(.63,'#256AB1',1),(1,'#1C48A0',1)],600,75,650,340)
DEFS+=linear('anal',[(0,'#091638',1),(.5,'#111B42',1),(1,'#172658',1)],890,440,850,714)
DEFS+=linear('pelvic',[(0,'#142339',1),(.4,'#B4A75A',1),(.76,'#917116',1),(1,'#103E91',1)],495,700,550,766)
DEFS+=linear('pectoral',[(0,'#080E1C',.98),(.4,'#0C162D',.91),(.75,'#162233',.55),(1,'#142039',.1)],418,546,654,500)
DEFS+=linear('goldHead',[(0,'#ADB679',1),(.35,'#B2BB81',1),(.63,'#A5B48B',.8),(1,'#9EB09A',0)],370,240,497,240)
DEFS+=linear('paleFace',[(0,'#89C1DE',1),(.25,'#B5BDE3',1),(.64,'#9B9BCD',1),(1,'#5D89BF',1)],176,412,304,584)
DEFS+=linear('lip',[(0,'#D0D5E3',1),(.52,'#B6C6DC',1),(1,'#8E83B1',1)],144,440,188,517)
DEFS+=linear('eyeBand',[(0,'#111727',1),(.6,'#080E1D',1),(1,'#35313C',1)],250,345,335,520)
DEFS+=linear('gill',[(0,'#07165F',1),(.25,'#061441',1),(.58,'#060E22',1),(1,'#0D172F',1)],449,300,460,616)
DEFS+=linear('bellyShadow',[(0,'#030A16',0),(.5,'#050918',.18),(1,'#050811',.62)],570,510,560,712)
DEFS+=linear('backSheen',[(0,'#D7E9DC',.58),(.46,'#A6CECE',.1),(1,'#86C9E5',0)],640,68,650,221)
DEFS+=linear('finSheen',[(0,'#FFF16B',0),(.6,'#F5DD49',.55),(1,'#FADF42',.7)],1010,200,1115,140)
for key in ['body','full_silhouette','dorsal','anal','caudal','pectoral','pelvic']:
    DEFS+=f'<clipPath id="clip-{key}"><path d="{G[key]}"/></clipPath>'
def clip(key,s): return f'<g clip-path="url(#clip-{key})">{s}</g>'
def svg(content,vb='100 40 1120 760',w=1120,h=760):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}"><defs>{DEFS}</defs>{content}</svg>'
L={}

for key,title,fill in [('pelvic','01 Pelvic fin','url(#pelvic)'),('dorsal','02 Dorsal fin','url(#body)'),('anal','03 Anal fin','url(#anal)'),('caudal','04 Caudal tail fin','url(#tail)')]:
    s=path(title+' silhouette',G[key],fill)
    rays=''
    if key=='caudal':
        for i in range(47):
            t=i/46; ex=1158+52*math.sin(math.pi*t);ey=258+258*t;sy=352+85*t
            rays+=path(f'Caudal ray {i+1:02}',f'M1053 {sy:.2f} Q1130 {sy+(ey-sy)*.45:.2f} {ex:.2f} {ey:.2f}',stroke='#897B23',width=1.1,opacity=.4)
            rays+=path(f'Caudal light ray {i+1:02}',f'M1055 {sy+1:.2f} Q1131 {sy+(ey-sy)*.45+2:.2f} {ex:.2f} {ey+2:.2f}',stroke='#FFDF46',width=1.3,opacity=.55)
    elif key=='dorsal':
        for i in range(43):
            t=i/42; sx=534+497*t; sy=175+166*t;ex=618+488*t;ey=112+30*t
            rays+=path(f'Dorsal ray {i+1:02}',f'M{sx:.1f} {sy:.1f} Q{sx+58:.1f} {sy-52:.1f} {ex:.1f} {ey:.1f}',stroke='#9EAD72',width=.75,opacity=.3)
    elif key=='anal':
        for i in range(28):
            t=i/27; sx=729+276*t;sy=671-211*t;ex=824+239*t;ey=701-150*t
            rays+=path(f'Anal membrane ray {i+1:02}',f'M{sx:.1f} {sy:.1f} Q{ex-38:.1f} {ey-2:.1f} {ex:.1f} {ey:.1f}',stroke='#18449B',width=.8,opacity=.4)
    else:
        for i in range(24):
            t=i/23; ex=573+155*t;ey=710+67*t
            rays+=path(f'Pelvic ray {i+1:02}',f'M{453+36*t:.1f} {694+8*t:.1f} Q{512+51*t:.1f} {704+31*t:.1f} {ex:.1f} {ey:.1f}',stroke='#314B85',width=1.15,opacity=.9)
            rays+=path(f'Pelvic gold ray {i+1:02}',f'M{455+36*t:.1f} {694+8*t:.1f} Q{514+51*t:.1f} {704+31*t:.1f} {ex+2:.1f} {ey:.1f}',stroke='#D6B74C',width=.7,opacity=.65)
    L[title]=s+group(title+' rays',clip(key,rays))

L['05 Body base']=path('Body silhouette',G['body'],'url(#body)')
texture=''
count=0
for col in range(75):
    x=427+col*8.45
    for row in range(61):
        y=134+row*9+(col%2)*4.5
        if ((x-715)/330)**2+((y-407)/287)**2>1: continue
        tilt=1.7*math.sin((y-160)/520*math.pi)
        d=f'M{x:.1f} {y-3.3:.1f} q3.2 1.8 {tilt:.1f} 6.6 q-3 -1.4 {-tilt:.1f} -6.6Z'
        texture+=path(f'Scale c{col+1:02} r{row+1:02}',d,'none','#8BBDCB',.45,.115)
        count+=1
L['06 Fine scale texture']=clip('body',group('Subtle editable body scales',texture))
L['07 Yellow and blue stripe pattern']=clip('full_silhouette',build_stripes())

# Face-region paths supplied by the anatomical tracing.
P=G.get('paths',{})
def geo(*keys):
    for k in keys:
        if k in G and isinstance(G[k],str):return G[k]
        if k in P:return P[k]
    raise KeyError(keys)
facial=''
facial+=path('Gold forehead and curved head band',geo('gold_head_band','head_band','forehead'),'url(#goldHead)')
facial+=path('Dark eye band',geo('eye_band','face_mask','dark_eye_band'),'url(#eyeBand)')
facial+=path('Pale lavender face',geo('pale_face','pale_mouth_face','face'),'url(#paleFace)')
facial+=path('Dark gill patch',geo('gill_patch','gill_dark_patch','gill'),'url(#gill)')
facial+=path('Upper lip',geo('upper_lip','lips_upper'),'url(#lip)','#7396BC',.7)
facial+=path('Lower lip',geo('lower_lip','lips_lower'),'url(#lip)','#7A91B6',.7)
facial+=path('Mouth opening','M141 464 Q155 468 175 485 Q160 483 145 477 Z','#635464')
facial+=path('Lip corner fold','M173 440 C185 451 197 471 199 490 C205 506 201 519 192 521 C183 522 178 517 173 511',stroke='#7A81A1',width=1.2,opacity=.8)
facial+=path('Lower lip soft gleam','M132 489 Q147 505 165 510',stroke='#D9DFF0',width=1.6,opacity=.6)
L['08 Face mask lips and gill']=facial

eye=ellipse('Outer eye socket',310,402,27,29,'#111828','#1B2540',2)
eye+=ellipse('Eye outer iris',311,402,22,23,'#070F20','#292A36',1.4)
eye+=ellipse('Iris blue ring',311,401,14.8,15.6,'#10172C','#254268',1)
eye+=ellipse('Deep pupil',312,401,10.7,11.5,'#020B19')
eye+=path('Lower iris reflected light','M302 410 C308 418 319 413 322 406',stroke='#496281',width=.8,opacity=.7)
eye+=ellipse('Small cool glint',307,394,2.2,1.4,'#6280A1',opacity=.7)
eye+=path('Upper eye socket fold','M285 391 C289 376 306 371 321 379',stroke='#0A1020',width=2.5,opacity=.8)
eye+=ellipse('Nostril',247,398,5,4,'#1D1D24','#35313C',.8)
L['09 Eye and nostril']=eye

pect=path('Pectoral translucent membrane',G['pectoral'],'url(#pectoral)')
rays=''
for i in range(39):
    t=i/38; ex=615+36*math.sin(math.pi*t);ey=429+195*t;sx=426+41*t;sy=546+46*t
    rays+=path(f'Pectoral dark ray {i+1:02}',f'M{sx:.1f} {sy:.1f} Q536 {495+106*t:.1f} {ex:.1f} {ey:.1f}',stroke='#101B2A',width=2,opacity=.82)
    rays+=path(f'Pectoral fine light ray {i+1:02}',f'M{sx+1:.1f} {sy:.1f} Q539 {496+106*t:.1f} {ex+1:.1f} {ey+1.6:.1f}',stroke='#7892A2',width=.55,opacity=.54)
pect+=clip('pectoral',group('Pectoral fine rays',rays))
pect+=path('Pectoral socket','M418 536 C432 531 459 542 474 566 C481 581 483 598 472 605 C446 601 426 581 419 562 Z','#080F20',opacity=.75)
L['10 Pectoral fin']=pect

shadow=path('Belly volume',G['body'],'url(#bellyShadow)')
shadow+=path('Gill inner fold','M423 352 C418 418 407 490 379 548',stroke='#02091B',width=4,opacity=.62)
shadow+=path('Gill-to-pectoral fold','M389 552 C410 559 437 576 453 595',stroke='#070C19',width=5,opacity=.75)
shadow+=path('Lower cheek seam','M197 581 C229 596 276 599 315 585',stroke='#11223A',width=2.3,opacity=.9)
shadow+=path('Under pectoral shadow','M438 569 C485 586 528 597 577 600 C554 627 499 632 458 617 Z','#070F1C',opacity=.24)
shadow+=path('Tail socket fold','M1041 349 Q1058 393 1036 446',stroke='#987D28',width=3,opacity=.34)
L['11 Shadows and contour lines']=shadow

high=path('Back reflected sheen',G['full_silhouette'],'url(#backSheen)')
high+=path('Dorsal trailing gold glow',G['dorsal'],'url(#finSheen)')
high+=path('Top icy blue rim','M247 336 C282 281 329 223 384 191 C504 116 682 92 834 81 C915 78 972 66 1025 66 C1077 66 1109 79 1113 112',stroke='#78C9FF',width=3.6)
high+=path('Top fine white gleam','M390 187 C501 118 690 91 837 81 C916 78 979 66 1024 66',stroke='#D0E5E8',width=1.3,opacity=.8)
high+=path('Dorsal rear electric rim','M1113 112 C1120 155 1093 240 1078 288 C1068 319 1055 336 1043 341',stroke='#2FAFFF',width=3)
high+=path('Anal outer electric blue','M1025 452 C1046 458 1065 497 1069 540 C1073 585 1067 623 1041 647 C1003 687 923 711 823 709 C779 710 744 705 721 698',stroke='#0866F7',width=4)
high+=path('Pelvic electric border','M450 700 C488 728 548 753 603 764 C647 772 688 774 726 777',stroke='#075AFA',width=2.5)
high+=path('Eye band upper blue border','M244 341 C267 349 295 352 321 365 C342 379 353 404 359 427',stroke='#1459F7',width=8)
high+=path('Eye band lower blue border','M207 402 C248 412 281 431 307 448 C328 463 330 478 328 500 C329 527 320 552 322 564',stroke='#367BFF',width=7)
high+=path('Gill luminous leading border','M450 304 C424 311 411 337 406 367 C400 436 390 496 366 551 C359 570 345 579 325 568',stroke='#1559F7',width=6)
high+=path('Gill reflected blue base','M301 585 C342 579 385 584 428 587 C402 596 351 596 316 590 Z','#133BF7')
high+=path('Pectoral upper edge gleam','M416 533 C452 524 479 508 512 486',stroke='#145DE5',width=1.3,opacity=.85)
high+=path('Upper lip highlight','M144 451 C151 442 160 439 170 440',stroke='#D9E7E9',width=1.4,opacity=.65)
L['12 Blue borders and color highlights']=high

for name,content in L.items(): (ROOT/(name+'.svg')).write_text(svg(group(name,content)),encoding='utf-8')
(ROOT/'emperor-angelfish-master.svg').write_text(svg(''.join(group(n,s) for n,s in L.items())),encoding='utf-8')
outline=''
for k in ['pelvic','dorsal','anal','caudal','body','pectoral']:
    outline+=path(k.title()+' outline',G[k],stroke='#134E68',width=1.7)
outline+=ellipse('Eye outline',310,402,27,29,'none','#134E68',1.5)
outline+=ellipse('Pupil outline',312,401,10.7,11.5,'none','#134E68',1.1)
for name,keys in [('Eye band outline',('eye_band','face_mask','dark_eye_band')),('Gill outline',('gill_patch','gill_dark_patch','gill')),('Face outline',('pale_face','pale_mouth_face','face'))]:
    outline+=path(name,geo(*keys),stroke='#134E68',width=1.2)
(ROOT/'outline-study.svg').write_text(svg(outline),encoding='utf-8')
(ROOT/'mask.svg').write_text(svg(path('Fish silhouette mask',G['full_silhouette'],'white')),encoding='utf-8')
(ROOT/'manifest.json').write_text(json.dumps([{'name':n,'filename':n+'.svg'} for n in L],indent=2))
print(json.dumps({'layers':len(L),'editableScales':count,'masterBytes':(ROOT/'emperor-angelfish-master.svg').stat().st_size}))
