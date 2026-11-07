from PIL import Image,ImageFilter,ImageDraw,ImageChops
from pathlib import Path
import json,math,re
OUT=Path(__file__).parent
SOURCE=Path(r'C:\Users\jacob\.codex\codex-remote-attachments\01a18466-97e5-7d61-a939-3d49c32e9b81\1E93FE17-D5BF-458F-AD4A-76D6086720D8\1-Pasted-Image-1.jpg')
photo=Image.open(SOURCE).convert('RGB')
data=json.loads((OUT/'shark-outline.json').read_text())['vectorPaths'][0]['data']
v=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',data)))
poly=list(zip(v[::2],v[1::2]))
sx,sy=.756,.756
ox,oy=126.0,326.0
aligned=photo.transform((546,770),Image.Transform.AFFINE,(sx,0,ox,0,sy,oy),resample=Image.Resampling.BICUBIC)
check=aligned.copy();ImageDraw.Draw(check).line(poly+[poly[0]],fill=(255,120,50),width=1)
check.save(OUT/'caustic-alignment.png')
mask=Image.new('L',(546,770));ImageDraw.Draw(mask).polygon(poly,fill=255)
mask=mask.filter(ImageFilter.MinFilter(7))
luma=aligned.convert('L')
blur=luma.filter(ImageFilter.GaussianBlur(4.2))
signal=ImageChops.subtract(luma,blur)
signal=ImageChops.multiply(signal,mask)
signal.point(lambda p:min(255,p*9)).save(OUT/'caustic-signal.png')

def area(poly):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1]))/2)

def rdp(p,eps):
    if len(p)<=2:return p
    a,b=p[0],p[-1];dx,dy=b[0]-a[0],b[1]-a[1];den=math.hypot(dx,dy)
    ds=[abs(dy*(q[0]-a[0])-dx*(q[1]-a[1]))/den if den else math.dist(a,q) for q in p]
    m=max(ds)
    if m>eps:
        k=ds.index(m);return rdp(p[:k+1],eps)[:-1]+rdp(p[k:],eps)
    return [a,b]

def contours(im,threshold):
    pix=im.load();w,h=im.size;edges={}
    def on(x,y):return 0<=x<w and 0<=y<h and pix[x,y]>=threshold
    def edge(a,b):edges.setdefault(a,[]).append(b)
    for y in range(h):
        for x in range(w):
            if not on(x,y):continue
            if not on(x,y-1):edge((x,y),(x+1,y))
            if not on(x+1,y):edge((x+1,y),(x+1,y+1))
            if not on(x,y+1):edge((x+1,y+1),(x,y+1))
            if not on(x-1,y):edge((x,y+1),(x,y))
    paths=[];vertices=0;loops=0
    while edges:
        start=next(iter(edges));p=[start];current=start
        while current in edges:
            nxt=edges[current].pop()
            if not edges[current]:del edges[current]
            p.append(nxt);current=nxt
            if current==start:break
        if len(p)<5 or area(p)<1.5:continue
        # Split the loop in two to avoid the coincident-endpoint RDP case.
        mid=len(p)//2
        p=rdp(p[:mid+1],.33)[:-1]+rdp(p[mid:],.33)[:-1]
        if len(p)<3:continue
        # Midpoint splines smooth pixel contours while preserving fine light ribs.
        start=((p[-1][0]+p[0][0])/2,(p[-1][1]+p[0][1])/2)
        s=f'M{start[0]:g},{start[1]:g}'
        for a,b in zip(p,p[1:]+p[:1]):s+=f'Q{a[0]:g},{a[1]:g} {(a[0]+b[0])/2:g},{(a[1]+b[1])/2:g}'
        paths.append(s+'Z');vertices+=len(p);loops+=1
    return ''.join(paths),vertices,loops

parts=['<svg xmlns="http://www.w3.org/2000/svg" width="546" height="769.5" viewBox="0 0 546 769.5">']
counts=[]
for t,alpha in [(2,.035),(4,.045),(6,.055),(9,.067),(13,.08),(18,.09),(25,.11),(34,.12)]:
    d,n,k=contours(signal,t)
    parts.append(f'<path id="photographic-caustic-{t}" fill="#C2E8EB" opacity="{alpha}" fill-rule="evenodd" d="{d}"/>')
    counts.append({'threshold':t,'vertices':n,'contours':k})
parts.append('</svg>')
svg='\n'.join(parts)
(OUT/'shark-caustics-photo.svg').write_text(svg)
base='<defs><linearGradient id="body" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#17425D"/><stop offset=".5" stop-color="#2E6380"/><stop offset="1" stop-color="#17425D"/></linearGradient></defs><rect width="546" height="770" fill="#052D49"/><path d="'+data+'" fill="url(#body)"/>'
(OUT/'caustic-photo-review.svg').write_text(svg.replace('viewBox="0 0 546 769.5">','viewBox="0 0 546 769.5">'+base))
print(json.dumps({'bytes':len(svg),'counts':counts}))
