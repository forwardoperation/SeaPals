"""Editable source-traced reef masses and surface caustics for the Figma scene.

Pillow is used for sampling and contour extraction. The deliverable contains
only vector paths and native gradients; it embeds no source pixels.
"""
import json, math
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT=Path(__file__).parent
photo=Image.open(ROOT/'source.png').convert('RGB')
W,H=photo.size

def simplify(ps,eps):
    if len(ps)<3:return ps
    a,b=ps[0],ps[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=math.hypot(dx,dy)
    ds=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/den if den else math.dist(a,p) for p in ps]
    j=max(range(len(ds)),key=ds.__getitem__)
    if ds[j]<=eps:return [a,b]
    return simplify(ps[:j+1],eps)[:-1]+simplify(ps[j:],eps)

def loops(mask,minarea=8,eps=.75):
    # Directed pixel-boundary edges retain holes using EVENODD winding.
    im=Image.new('L',(mask.width+2,mask.height+2));im.paste(mask,(1,1))
    p=im.load();adj=defaultdict(list)
    for y in range(1,mask.height+1):
        for x in range(1,mask.width+1):
            if not p[x,y]:continue
            if not p[x,y-1]:adj[(x-1,y-1)].append((x,y-1))
            if not p[x+1,y]:adj[(x,y-1)].append((x,y))
            if not p[x,y+1]:adj[(x,y)].append((x-1,y))
            if not p[x-1,y]:adj[(x-1,y)].append((x-1,y-1))
    out=[]
    while adj:
        start=next(iter(adj));q=start;ps=[q]
        while True:
            nxt=adj[q].pop()
            if not adj[q]:del adj[q]
            q=nxt
            if q==start:break
            ps.append(q)
        area=sum(ps[i][0]*ps[(i+1)%len(ps)][1]-ps[(i+1)%len(ps)][0]*ps[i][1] for i in range(len(ps)))/2
        if abs(area)<minarea:continue
        j=max(range(len(ps)),key=lambda j:math.dist(ps[0],ps[j]))
        pts=simplify(ps[:j+1],eps)[:-1]+simplify(ps[j:]+[ps[0]],eps)[:-1]
        if len(pts)>=3:out.append((pts,area))
    return out

def path(ps,scale=1,smooth=.28):
    ps=[(x*scale,y*scale) for x,y in ps];n=len(ps)
    # Rounded polygon corners preserve the sampled contour without tiny zigzags.
    enter=[];leave=[]
    for i,p in enumerate(ps):
        prev=ps[i-1];nxt=ps[(i+1)%n]
        a=min(smooth,6/max(1,math.dist(p,prev)));b=min(smooth,6/max(1,math.dist(p,nxt)))
        if p[0] in (0,W) or p[1] in (0,H):a=b=0
        enter.append((p[0]+(prev[0]-p[0])*a,p[1]+(prev[1]-p[1])*a))
        leave.append((p[0]+(nxt[0]-p[0])*b,p[1]+(nxt[1]-p[1])*b))
    d=f'M {enter[0][0]:.1f} {enter[0][1]:.1f}'
    for i,p in enumerate(ps):
        a,b=enter[i],leave[i]
        if i:d+=f' L {a[0]:.1f} {a[1]:.1f}'
        d+=f' Q {p[0]:.1f} {p[1]:.1f} {b[0]:.1f} {b[1]:.1f}'
    return d+' Z'

skyline=[(0,192),(23,213),(36,241),(52,224),(67,265),(86,218),(116,211),(153,252),(143,295),(161,329),(197,329),(219,354),(254,354),(283,420),(295,452),(328,450),(348,475),(375,500),(403,506),(432,529),(474,543),(510,556),(552,575),(610,601),(714,626),(824,636),(950,625),(1045,622),(1110,612),(1150,625),(1200,591),(1256,583),(1303,546),(1353,520),(1368,484),(1405,513),(1430,482),(1464,461),(1510,474),(1536,462)]
base=Image.new('L',(W,H));ImageDraw.Draw(base).polygon(skyline+[(W,H),(0,H)],fill=255)
# Adjust the boundary to actual source silhouettes while keeping the terrain solid.
px=photo.load();bp=base.load()
for y in range(170,660):
    for x in range(W):
        r,g,b=px[x,y]
        if bp[x,y] and b>g*1.18 and b>r*1.75:bp[x,y]=0
base=base.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))
bp=base.load()
for x in range(W):
    top=next((y for y in range(180,H) if bp[x,y]),H)
    for y in range(top,H):bp[x,y]=255
base.save(ROOT/'environment-floor-mask.png')
pillar=Image.open(ROOT/'continuous-coverage.png').convert('L')
floor=ImageChops.subtract(base,pillar.filter(ImageFilter.MaxFilter(3)))

# Large, smoothly joined masses sampled from the reference reef. Palette chosen
# from the reef only, so water and the hero coral cannot skew the color clusters.
small=photo.filter(ImageFilter.GaussianBlur(4.0)).resize((768,512),Image.Resampling.LANCZOS)
fm=floor.resize(small.size,Image.Resampling.NEAREST)
colors=[c for c,m in zip(small.getdata(),fm.getdata()) if m]
swatch=Image.new('RGB',(len(colors),1));swatch.putdata(colors)
palette=swatch.quantize(colors=23,method=Image.Quantize.MEDIANCUT)
quant=small.quantize(palette=palette,dither=Image.Dither.NONE)
pal=quant.getpalette();qp=quant.load();fp=fm.load()
nodes=[];total=0
for k in range(23):
    mask=Image.new('L',small.size);mp=mask.load()
    for y in range(512):
        for x in range(768):
            if fp[x,y] and qp[x,y]==k:mp[x,y]=255
    ls=loops(mask,minarea=20,eps=.95)
    # Compound paths batch the same material into editable, manageable layers.
    col=pal[k*3:k*3+3];parts=[];size=0
    for pts,area in ls:
        d=path(pts,2,.30);total+=1
        if size+len(d)>16000 and parts:
            nodes.append(dict(name=f'Reef material {k+1:02d}',path=' '.join(parts),color=col,layer='floor',opacity=1));parts=[];size=0
        parts.append(d);size+=len(d)
    if parts:nodes.append(dict(name=f'Reef material {k+1:02d}',path=' '.join(parts),color=col,layer='floor',opacity=1))

# Four exposure bands capture the actual broad surface reflections. Closed white
# contours give a natural broken cellular pattern, instead of a repeating mesh.
surf=photo.filter(ImageFilter.GaussianBlur(1.0)).resize((768,512),Image.Resampling.LANCZOS)
sp=surf.load();broad=surf.filter(ImageFilter.GaussianBlur(7));broadp=broad.load();causticcounts=[]
for band,threshold,col,alpha in [(0,65,[77,184,225],.50),(1,108,[127,216,245],.64),(2,158,[180,237,253],.79),(3,203,[233,251,255],.88)]:
    mask=Image.new('L',surf.size);mp=mask.load()
    for y in range(145):
        for x in range(768):
            r,g,b=sp[x,y]
            # Local contrast relative to the smooth underwater field isolates
            # shimmering reflections without tracing the entire blue ceiling.
            falloff=max(0,(y*2-115)/170)
            value=.35*r+.65*g
            bc=broadp[x,y];local=.35*bc[0]+.65*bc[1]
            if value>threshold+falloff*55 and value-local>[4,7,10,12][band] and b>r*.82:mp[x,y]=255
    ls=loops(mask,minarea=3 if band>1 else 6,eps=.46)
    parts=[];size=0
    for pts,a in ls:
        d=path(pts,2,.34)
        if size+len(d)>16000 and parts:
            nodes.append(dict(name=f'Surface caustics — exposure {band+1}',path=' '.join(parts),color=col,opacity=alpha,layer='caustics',blur=.85));parts=[];size=0
        parts.append(d);size+=len(d)
    if parts:nodes.append(dict(name=f'Surface caustics — exposure {band+1}',path=' '.join(parts),color=col,opacity=alpha,layer='caustics',blur=.85))
    causticcounts.append(len(ls))

# Source-conforming floor boundary and hero-colony shadow projection.
basepaths=path(skyline+[(W,H),(0,H)],1,.20)
shadowparts=[]
for pts,a in loops(pillar.resize((768,512)),minarea=15,eps=1):
    projected=[]
    for x,y in pts:
        x*=2;y*=2
        projected.append((800+(x-800)*.93-(945-y)*.58,925+(945-y)*.165+(x-800)*.10))
    shadowparts.append(path(projected,1,.30))

# Dark, larger-scale substrate avoids hairline gaps between rounded material
# boundaries and gives the reef the same soft vector finish as the pillar.
fishmask=Image.new('L',(768,512));fip=fishmask.load();exclusion=ImageChops.lighter(base,pillar.filter(ImageFilter.MaxFilter(15))).resize((768,512));exp=exclusion.load()
for y in range(85,322):
    for x in range(768):
        if exp[x,y]:continue
        r,g,b=sp[x,y];br,bg,bb=broadp[x,y]
        if .25*r+.55*g+.2*b < .25*br+.55*bg+.2*bb-23 and g<140:fip[x,y]=255
fish=[]
for pts,a in loops(fishmask,minarea=2,eps=.4):
    xs=[p[0] for p in pts];ys=[p[1] for p in pts]
    if a>0 and a<55 and max(xs)-min(xs)<17 and max(ys)-min(ys)<12:fish.append(path(pts,2,.3))
result={'nodes':nodes,'floorPath':basepaths,'fishPath':' '.join(fish),'shadowPath':' '.join(shadowparts),'stats':{'reefContours':total,'surfaceContours':causticcounts,'fish':len(fish),'nodes':len(nodes)}}
(ROOT/'environment.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
import re
def pack(d):
    tokens=re.findall(r'[MLQCZ]|-?\d+(?:\.\d+)?',d)
    nums=[float(t) for t in tokens if t not in 'MLQCZ']
    ox=math.floor(min(nums[0::2]));oy=math.floor(min(nums[1::2]));out='';axis=0;last=[0,0]
    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    commands=dict(zip('MLQCZ','!@#$%'))
    for t in tokens:
        if t in 'MLQCZ':out+=commands[t]
        else:
            value=round((float(t)-(ox if axis%2==0 else oy))*2)
            delta=value-last[axis%2];last[axis%2]=value;axis+=1
            v=(-delta*2+1) if delta<0 else delta*2
            while v>=32:out+=alphabet[(v&31)|32];v>>=5
            out+=alphabet[v]
    return dict(x=ox,y=oy,d=out)
packed={'nodes':[{**{k:v for k,v in n.items() if k!='path'},**pack(n['path'])} for n in nodes], 'floor':pack(basepaths),'shadow':pack(result['shadowPath']),'fish':pack(result['fishPath']) if fish else None,'stats':result['stats']}
(ROOT/'environment-packed.json').write_text(json.dumps(packed,separators=(',',':'),ensure_ascii=False),encoding='utf8')
print(json.dumps(result['stats']))
print('data bytes', (ROOT/'environment.json').stat().st_size)

# A diagnostic rendering of the extracted terrain colors, not the final Figma
# composition, helps judge simplification before native-vector construction.
preview=quant.convert('RGB');preview.putalpha(fm)
preview.save(ROOT/'environment-reef-trace.png')
