"""Organize traced skin into editable anatomical regions without changing stacking."""
from pathlib import Path
import sys, re, json, xml.etree.ElementTree as ET
from html import escape
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parents[1]/'tmp'/'figma-vector-deps'))
import cv2
import numpy as np
W,H=1164,902
ZONES=[
 ('01 Mantle - mottled shadow skin',[(0,0),(480,0),(500,85),(425,235),(320,385),(260,450),(200,444),(0,450)]),
 ('02 Eye hood - raised papillae',[(480,0),(740,0),(740,250),(530,250),(425,235),(500,85)]),
 ('03 Shoulder - ivory papillae and ochre mottling',[(425,235),(530,250),(510,400),(500,595),(350,500),(200,444),(260,450),(320,385)]),
 ('04 Central body - vertical folds and fine granules',[(530,250),(740,250),(720,640),(650,710),(500,595),(510,400)]),
 ('05 Curled arm - cool shadows and skin ridges',[(740,0),(W,0),(W,H),(935,H),(650,710),(720,640)]),
 ('06 Foreground arm - sweeping skin folds',[(0,450),(200,444),(350,500),(500,595),(650,710),(935,H),(0,H)]),
]
num=re.compile(r'-?\d*\.?\d+(?:e[-+]?\d+)?',re.I)
def compact(s,scale=.5):
    def f(m):
        v=round(float(m[0])*scale,1)
        return f'{v:.1f}'.rstrip('0').rstrip('.') if v else '0'
    return re.sub(r'\s*([MCZ])\s*',r'\1',num.sub(f,s))
def polygon_d(points):return 'M'+'L'.join(f'{x} {y}' for x,y in points)+'Z'
def main():
    source_paths=list(ET.parse(ROOT/'skin-unified-trace.svg').getroot())
    paths=[(p,.5,set(range(6))) for p in source_paths]
    outline=re.search(r'<path d="([^"]+)"', (ROOT/'body-outline.svg').read_text())[1]
    integrals=[]
    for name,points in ZONES:
        mask=np.zeros((H,W),np.uint8)
        cv2.fillPoly(mask,[np.array(points,np.int32)],1)
        integrals.append(cv2.integral(mask))
    buckets=[[] for _ in ZONES]
    counts=[0 for _ in ZONES]
    for idx,(p,scale,allowed) in enumerate(paths):
        d=p.get('d'); transform=p.get('transform','translate(0,0)')
        tx,ty=map(float,num.findall(transform))
        a=np.array(list(map(float,num.findall(d)))).reshape(-1,2)
        a+=np.array([tx,ty])
        a*=scale
        lo=np.floor(a.min(axis=0)-1).astype(int);hi=np.ceil(a.max(axis=0)+1).astype(int)
        x0,y0=np.maximum(lo,[0,0]);x1,y1=np.minimum(hi,[W,H])
        if x0>=x1 or y0>=y1: continue
        rgb=tuple(int(p.get('fill')[i:i+2],16) for i in (1,3,5))
        lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]
        role=('Folds' if lum<23 else 'Shadows' if lum<48 else 'Mottle' if lum<95 else 'Papillae' if lum<155 else 'Glints')
        item=f'<path id="{role.replace(" ","-")}-{idx:05}" d="{compact(d,scale)}" fill="{p.get("fill")}" transform="{compact(transform,scale)}"/>'
        for z,integral in enumerate(integrals):
            area=integral[y1,x1]-integral[y0,x1]-integral[y1,x0]+integral[y0,x0]
            if area>0 and z in allowed:
                buckets[z].append(item.replace('id="',f'id="z{z}-',1));counts[z]+=1
    defs=f'<clipPath id="body-silhouette"><path d="{outline}"/></clipPath>'
    defs+=''.join(f'<clipPath id="zone-{i}"><path d="{polygon_d(p)}"/></clipPath>' for i,(_,p) in enumerate(ZONES))
    body=f'<path id="Continuous-dark-skin-base" d="{outline}" fill="#100e0d"/>'
    body+=''.join(f'<g id="{escape(name)}" clip-path="url(#zone-{i})">'+''.join(buckets[i])+'</g>' for i,(name,_) in enumerate(ZONES))
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>Octopus - detailed editable body skin</title><desc>Six anatomical vector groups preserving the existing silhouette. Curved color contours describe irregular papillae, pale highlight caps, ochre mottling, dark creases, and directional skin folds. No embedded bitmap images. Place at x -465.9944, y -388.9736 on the Octopus page, beneath the existing eye and suckers.</desc><defs>{defs}</defs><g id="Body-skin-detail" clip-path="url(#body-silhouette)">{body}</g></svg>'
    (ROOT/'octopus-body-detailed.svg').write_text(svg,encoding='utf-8')
    for i,(name,_) in enumerate(ZONES):
        part=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>{escape(name)}</title><defs>{defs}</defs><g clip-path="url(#body-silhouette)"><g id="{escape(name)}" clip-path="url(#zone-{i})">'+''.join(buckets[i])+'</g></g></svg>'
        (ROOT/f'skin-region-{i+1:02}.svg').write_text(part,encoding='utf-8')
    report={'source_contours':len(paths),'editable_vector_paths':sum(counts)+1,'regions':[{'name':n,'paths':counts[i]}for i,(n,_)in enumerate(ZONES)],'bytes':len(svg.encode()),'embedded_rasters':0,'canvas':[W,H],'placement':[-465.9944,-388.9736]}
    (ROOT/'vector-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
