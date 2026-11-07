from pathlib import Path
import sys,json,re,math
OUT=Path(__file__).parent
sys.path.insert(0,str(OUT.parents[1]/'tmp'/'figma-vector-deps'))
import cv2,numpy as np
from PIL import Image

im=Image.open(OUT/'reference-original.png').convert('RGB')
aligned=im.transform((546,770),Image.Transform.AFFINE,(1,0,144.5,0,1,427.5),resample=Image.Resampling.BICUBIC)
aligned.save(OUT/'photo-shark-aligned.png')
rgb=np.array(aligned)
gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
path=json.loads((OUT/'shark-outline.json').read_text())['vectorPaths'][0]['data']
vals=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',path)))
poly=np.array(list(zip(vals[::2],vals[1::2])),dtype=np.float32)
mask=np.zeros(gray.shape,np.uint8);cv2.fillPoly(mask,[np.round(poly).astype(np.int32)],255)
mask=cv2.erode(mask,np.ones((5,5),np.uint8))
# Median removes narrow bright caustics and thin dark gill markings together.
# Low-pass the robust baseline to avoid step artifacts while preserving anatomy.
baseline=cv2.medianBlur(gray,21).astype(np.float32)
baseline=cv2.GaussianBlur(baseline,(0,0),2.2)
signal=np.maximum(0,gray.astype(np.float32)-baseline)
signal=cv2.GaussianBlur(signal,(0,0),.45)
signal[mask==0]=0
Image.fromarray(np.uint8(np.minimum(signal*8,255))).save(OUT/'clean-caustic-signal.png')

def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')

def svgloop(pts,rect=None):
    starts=(pts+np.roll(pts,1,axis=0))*.5
    ends=(pts+np.roll(pts,-1,axis=0))*.5
    boundary=np.zeros(len(pts),bool)
    if rect:
        x0,y0,x1,y1=rect
        boundary=(np.abs(pts[:,0]-x0)<1e-6)|(np.abs(pts[:,0]-x1)<1e-6)|(np.abs(pts[:,1]-y0)<1e-6)|(np.abs(pts[:,1]-y1)<1e-6)
        starts[boundary]=pts[boundary];ends[boundary]=pts[boundary]
    d='M'+fmt(starts[0,0])+','+fmt(starts[0,1])
    for i,p in enumerate(pts):
        if boundary[i]:d+='L'+fmt(p[0])+','+fmt(p[1])
        else:d+='Q'+fmt(p[0])+','+fmt(p[1])+' '+fmt(ends[i,0])+','+fmt(ends[i,1])
        j=(i+1)%len(pts)
        if not np.allclose(ends[i],starts[j]):d+='L'+fmt(starts[j,0])+','+fmt(starts[j,1])
    return d+'Z'

def clippoly(pts,rect):
    out=list(map(tuple,pts))
    for axis,value,greater in [(0,rect[0],True),(0,rect[2],False),(1,rect[1],True),(1,rect[3],False)]:
        inp=out;out=[]
        if not inp:break
        for p,q in zip(inp,inp[1:]+inp[:1]):
            pin=p[axis]>=value if greater else p[axis]<=value
            qin=q[axis]>=value if greater else q[axis]<=value
            if pin:out.append(p)
            if pin!=qin:
                t=(value-p[axis])/(q[axis]-p[axis])
                out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    arr=np.array(out,dtype=float)
    if len(arr)<3:return None
    if abs(cv2.contourArea(arr.astype(np.float32)))<.05:return None
    return arr

def makepaths(binary,epsilon=.45):
    contours,tree=cv2.findContours(binary,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    groups={};pointcount=0;pathcount=0
    for ci,c in enumerate(contours):
        if abs(cv2.contourArea(c))<.8:continue
        pts=cv2.approxPolyDP(c,epsilon,True)[:,0,:].astype(float)
        if len(pts)<3:continue
        root=ci
        while tree[0,root,3]>=0:root=tree[0,root,3]
        groups.setdefault(root,[]).append(pts);pointcount+=len(pts);pathcount+=1
    results=[]
    for loops in groups.values():
        full=''.join(svgloop(p) for p in loops)
        if len(full)<=34000:results.append(full);continue
        # A connected outer contour and all holes are clipped into the same
        # tile path. Even-odd parity therefore remains identical after tiling.
        allpts=np.concatenate(loops)
        xmin,ymin=allpts.min(axis=0);xmax,ymax=allpts.max(axis=0)
        for y in range(int(ymin//128)*128,int(ymax)+1,128):
            for x in range(int(xmin//128)*128,int(xmax)+1,128):
                rect=(x,y,x+128,y+128);tile=[]
                for p in loops:
                    clipped=clippoly(p,rect)
                    if clipped is not None:tile.append(svgloop(clipped,rect))
                if tile:results.append(''.join(tile))
    return results,pointcount,pathcount

parts=['<svg xmlns="http://www.w3.org/2000/svg" width="546" height="769.5" viewBox="0 0 546 769.5">']
meta=[]
# Closely spaced low bands provide soft shoulders. The exact bright-focus
# geometry comes from the photograph rather than a mathematical cell network.
bands=[(2,.04),(4,.055),(7,.07),(11,.085),(16,.105),(23,.13),(32,.15)]
for t,alpha in bands:
    binary=np.uint8(signal>=t)*255
    paths,n,k=makepaths(binary)
    # Bound individual Figma vector complexity while preserving shared color.
    chunks=[];pending=[];size=0
    for p in paths:
        if size+len(p)>38000 and pending:
            chunks.append(pending);pending=[];size=0
        assert len(p)<38000, f'Spatial tile too large: {len(p)}'
        pending.append(p);size+=len(p)
    if pending:chunks.append(pending)
    for i,chunk in enumerate(chunks):
        parts.append(f'<path id="caustics-photo-band-{t:g}-{i+1}" fill="#BCE2E7" opacity="{alpha}" fill-rule="evenodd" d="{"".join(chunk)}"/>')
    meta.append({'threshold':t,'vertices':n,'contours':k,'layers':len(chunks)})
parts.append('</svg>')
svg='\n'.join(parts)
(OUT/'shark-caustics-photo.svg').write_text(svg)
base='<defs><linearGradient id="body" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#17425D"/><stop offset=".5" stop-color="#2E6380"/><stop offset="1" stop-color="#17425D"/></linearGradient></defs><rect width="546" height="770" fill="#052D49"/><path d="'+path+'" fill="url(#body)"/>'
(OUT/'caustic-photo-review.svg').write_text(svg.replace('viewBox="0 0 546 769.5">','viewBox="0 0 546 769.5">'+base))
(OUT/'caustic-photo-report.json').write_text(json.dumps({'bytes':len(svg),'bands':meta},indent=2))
print(json.dumps({'bytes':len(svg),'layers':sum(b['layers'] for b in meta),'vertices':sum(b['vertices'] for b in meta),'contours':sum(b['contours'] for b in meta),'maxPathBytes':max(map(len,re.findall(r'<path[^>]*>',svg)))}))
