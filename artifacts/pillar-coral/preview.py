"""Rasterize the editable vector trace for alignment inspection."""
import json
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
ROOT=Path(__file__).parent
S=3
im=Image.open(ROOT/'source.png').convert('RGB').resize((1536*S,1024*S))
d=ImageDraw.Draw(im)
cs=json.loads((ROOT/'contours.json').read_text())
colors=['#60FFC6','#FF8ADB','#FFE575','#7EDCFF']
for c in cs:
    for piece in c['pieces']:
        curve=[]
        for p1,a,b,p2 in piece:
            for step in range(13):
                t=step/12;u=1-t
                curve.append(tuple(S*(u*u*u*p1[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t*t*t*p2[k]) for k in (0,1)))
        d.line(curve,fill=colors[(c['number']-1)%4],width=3)
im.resize((1536,1024)).save(ROOT/'outline-preview.png')
for name,b in [('upper',(580,60,910,450)),('middle',(545,390,950,750)),('lower',(490,660,950,950))]:
    im.crop(tuple(v*S for v in b)).resize(((b[2]-b[0])*2,(b[3]-b[1])*2)).save(ROOT/(name+'-preview.png'))
