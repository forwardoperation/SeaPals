import sys, json, re, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'figma-water' / 'trace-deps'))
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).parent
source = np.asarray(Image.open(ROOT / 'reference.png').convert('RGB'))
shells = json.loads((ROOT / 'contours.json').read_text(encoding='utf-8-sig'))

def smooth_path(points):
    p = np.asarray(points, dtype=float).reshape(-1, 2)
    if len(p) < 3: return ''
    def xy(v): return f'{v[0]:.1f} {v[1]:.1f}'
    out = ['M ' + xy(p[0])]
    for i in range(len(p)):
        a,b,c,d = p[(i-1)%len(p)],p[i],p[(i+1)%len(p)],p[(i+2)%len(p)]
        # Restrained smooth handles preserve organic marking boundaries.
        h1 = b+(c-a)*0.115
        h2 = c-(d-b)*0.115
        out.append('C '+xy(h1)+' '+xy(h2)+' '+xy(c))
    return ' '.join(out)+' Z'

def paths_from_mask(mask, minimum, tolerance):
    contours,hierarchy = cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None: return []
    paths=[]
    for i,c in enumerate(contours):
        if hierarchy[0][i][3] >= 0 or cv2.contourArea(c)<minimum: continue
        simplified=cv2.approxPolyDP(c,tolerance,True)
        path=smooth_path(simplified)
        child=hierarchy[0][i][2]
        while child>=0:
            if cv2.contourArea(contours[child])>minimum*0.3:
                path+=' '+smooth_path(cv2.approxPolyDP(contours[child],tolerance,True))
            child=hierarchy[0][child][0]
        if path: paths.append(path)
    return paths

layers = [
  # Each threshold is a shape family; these overlap like the user's foot shading.
  ('warm-ridge-shadows','lt',163,90,1.5,'#ad784c','#93664f',0.94),
  ('umber-recesses','lt',128,50,1.2,'#82522e','#79503e',0.93),
  ('brown-shell-markings','lt',99,28,1.05,'#5d3019','#664538',1.0),
  ('deep-grooves','lt',69,23,0.95,'#35251e','#4a322e',0.9),
  ('raised-ridge-light','gt',182,80,1.5,'#e7c79a','#cfb39a',0.88),
  ('ivory-crest-highlights','gt',209,40,1.2,'#f0dbc0','#e1c7b1',0.68),
]
results=[]
for shell in shells:
    w,h=math.ceil(shell['width']),math.ceil(shell['height'])
    ox,oy=int(shell['x']+837),int(shell['y']+472)
    crop=source[oy:oy+h,ox:ox+w]
    # Half-pixel origins are retained in Figma placement.
    nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',shell['paths'][0]['data'])))
    polygon=np.array(list(zip(nums[::2],nums[1::2])),np.int32)
    silhouette=np.zeros((h,w),np.uint8)
    cv2.fillPoly(silhouette,[polygon],255)
    safe=cv2.erode(silhouette,np.ones((5,5),np.uint8))
    reduced=cv2.bilateralFilter(crop,13,35,6)
    reduced=cv2.GaussianBlur(reduced,(0,0),2.4)
    gray=cv2.cvtColor(reduced,cv2.COLOR_RGB2GRAY)
    defs=[];groups=[];count=0
    # Lip has its own salmon/cream material, with the same shadow family.
    lip=shell['name']=='shell-top'
    base_top,base_bottom=('#dda371','#947e70') if lip else ('#d7ac77','#ba9577')
    defs.append(f'<linearGradient id="base" x1="0.25" y1="0" x2="0.70" y2="1"><stop offset="0" stop-color="{base_top}"/><stop offset="1" stop-color="{base_bottom}"/></linearGradient>')
    groups.append(f'<path id="base-color" d="M 0 0 L {w} 0 L {w} {h} L 0 {h} Z" fill="url(#base)"/>')
    layer_counts={}
    for idx,(name,direction,level,area,tolerance,c1,c2,opacity) in enumerate(layers):
        if lip:
            colors=[('#c78b65','#8c776a'),('#a66042','#776759'),('#90492f','#625347'),('#5d3528','#4a4038'),('#eed2a7','#bdad91'),('#f4e2c5','#d5c6ab')]
            c1,c2=colors[idx]
            area=max(15,area*0.55)
        mask=np.where((gray<level) if direction=='lt' else (gray>level),255,0).astype(np.uint8)
        mask=cv2.bitwise_and(mask,safe)
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
        paths=paths_from_mask(mask,area,tolerance)
        defs.append(f'<linearGradient id="g{idx}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>')
        groups.append(f'<g id="{name}" opacity="{opacity}">'+''.join(f'<path id="{name}-{j+1:02}" d="{d}" fill="url(#g{idx})" fill-rule="evenodd"/>' for j,d in enumerate(paths))+'</g>')
        layer_counts[name]=len(paths);count+=len(paths)
    if not lip:
        defs += [
            '<radialGradient id="golden-light" cx="0.62" cy="0.04" r="0.75"><stop offset="0" stop-color="#ffe3ad" stop-opacity="0.19"/><stop offset="1" stop-color="#ffe3ad" stop-opacity="0"/></radialGradient>',
            '<linearGradient id="lower-shade" x1="0.1" y1="1" x2="0.8" y2="0"><stop offset="0" stop-color="#39281f" stop-opacity="0.32"/><stop offset="0.65" stop-color="#39281f" stop-opacity="0"/></linearGradient>',
            '<linearGradient id="reflected-light" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ad9295" stop-opacity="0.17"/><stop offset="0.45" stop-color="#ad9295" stop-opacity="0"/></linearGradient>',
        ]
        for name in ['golden-light','lower-shade','reflected-light']:
            groups.append(f'<path id="{name}" d="M 0 0 L {w} 0 L {w} {h} L 0 {h} Z" fill="url(#{name})"/>')
    else:
        defs=[
            '<linearGradient id="lip-base" x1="0.75" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#f1d6a8"/><stop offset="0.4" stop-color="#d6b58e"/><stop offset="1" stop-color="#8b7b6c"/></linearGradient>',
            '<linearGradient id="cup" x1="0.35" y1="0" x2="0.65" y2="1"><stop offset="0" stop-color="#e7b078"/><stop offset="0.45" stop-color="#b36d46"/><stop offset="0.75" stop-color="#975d46"/><stop offset="1" stop-color="#b19386"/></linearGradient>',
            '<linearGradient id="floor" x1="0.8" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#b19f82"/><stop offset="1" stop-color="#51463b"/></linearGradient>',
            '<linearGradient id="lip-glow" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#fff0d3" stop-opacity="0.9"/><stop offset="1" stop-color="#ecceab" stop-opacity="0.15"/></linearGradient>'
        ]
        groups=[
            f'<path id="lip-base" d="M 0 0 L {w} 0 L {w} {h} L 0 {h} Z" fill="url(#lip-base)"/>',
            '<g id="lip-interior"><path id="rust-peach-cup" d="M 151 181 C 210 162 268 112 291 54 C 303 26 318 14 341 14 C 365 14 389 35 393 60 C 400 81 386 108 364 123 C 339 139 304 132 267 151 C 232 168 190 180 151 181 Z" fill="url(#cup)"/></g>',
            '<g id="lip-underside"><path id="muted-underside" d="M 0 183 C 83 178 159 171 205 155 C 246 141 278 145 311 148 C 262 155 245 171 202 194 C 157 217 103 218 79 232 L 53 252 Z" fill="url(#floor)"/></g>',
            '<g id="lip-rim-light"><path id="cream-flared-rim" d="M 286 59 C 295 25 315 4 342 4 C 370 2 395 28 400 59 C 397 39 380 20 360 17 C 333 11 316 20 305 37 C 296 50 289 67 282 83 Z" fill="url(#lip-glow)"/><path id="rim-reflection" d="M 220 173 C 270 152 297 145 333 145 C 369 144 392 124 400 99 C 396 127 378 143 347 150 C 310 156 277 155 246 166 Z" fill="#e7cfac" opacity="0.4"/></g>',
        ]
        count=5;layer_counts={'lip-base':1,'lip-interior':1,'lip-underside':1,'lip-rim-light':2}
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs>'+''.join(defs)+'</defs>'+''.join(groups)+'</svg>'
    (ROOT/(shell['name']+'.svg')).write_text(svg)
    results.append({'name':shell['name'],'id':shell['id'],'svg':svg,'count':count,'layerCounts':layer_counts})
(ROOT/'vector_payload.json').write_text(json.dumps(results))
print(json.dumps([{k:v for k,v in r.items() if k!='svg'} for r in results],indent=2))
