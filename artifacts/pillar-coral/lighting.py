"""Sample source-lit contour rims, cap reflections, and occlusion shading."""
import json, math, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from trace import contours, occlusion, cubics, evaluate, path_data

ROOT=Path(__file__).parent
photo=Image.open(ROOT/'source.png').convert('RGB');px=photo.load()
existing=json.loads((ROOT/'contours.json').read_text())
shade=json.loads((ROOT/'shading.json').read_text())
def lum(c):return .2126*c[0]+.7152*c[1]+.0722*c[2]
def clamp(x,a,b):return max(a,min(b,x))
def mean(cs):return [sum(c[k] for c in cs)/len(cs) for k in range(3)] if cs else [224,198,139]
def sample(x,y):
    x=round(x);y=round(y)
    if 0<=x<1536 and 0<=y<1024:
        c=px[x,y]
        if not(c[2]>c[0]*1.32 and c[1]>c[0]*1.36):return c
    return None

def resample(piece):
    pts=[]
    for curve in piece:
        length=sum(math.dist(curve[i],curve[i+1]) for i in range(3))
        count=max(3,math.ceil(length/1.15))
        pts.extend(evaluate(curve,j/count) for j in range(count))
    pts.append(piece[-1][-1]);return pts

def simplify(ps,eps=.42):
    if len(ps)<3:return ps
    a,b=ps[0],ps[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=math.hypot(dx,dy)
    ds=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/den if den else math.dist(a,p) for p in ps]
    j=max(range(len(ds)),key=ds.__getitem__)
    if ds[j]<=eps:return [a,b]
    return simplify(ps[:j+1],eps)[:-1]+simplify(ps[j:],eps)

out=[]
for c,s in zip(existing,shade):
    num=c['number'];top=min(p[1] for p in c['points']);left=min(p[0] for p in c['points'])
    width=max(p[0] for p in c['points'])-left;height=max(p[1] for p in c['points'])-top
    m=Image.new('L',photo.size);ImageDraw.Draw(m).polygon([tuple(evaluate(b,j/8)) for b in cubics(c['points'],c['closed']) for j in range(8)],fill=255)
    for other in occlusion.get(num,[]):
        cc=contours[other-1];mask=Image.new('L',photo.size)
        ImageDraw.Draw(mask).polygon([tuple(evaluate(b,j/8)) for b in cubics(cc['points'],True) for j in range(8)],fill=255)
        m=ImageChops.subtract(m,mask)
    mp=m.load();cap=[];side=[]
    capdepth=clamp(min(width*.48,height*.18),5,19)
    for y in range(int(top),int(top+capdepth+1)):
        for x in range(int(left),int(left+width+1)):
            if mp[x,y]:
                color=sample(x,y)
                if color:cap.append(color)
    bright=sorted(cap,key=lum)
    hot=mean(bright[int(len(bright)*.80):])
    capLum=lum(hot)
    strength=clamp((capLum-60)/145,.15,.98)
    # Source highlights are warm white, not the olive average of the whole tip.
    hot=[round(clamp(v,0,255),2) for v in hot]
    runs=[];ring_colors=[]
    for piece in c['pieces']:
        pts=resample(piece)
        normals=[];levels=[];cols=[]
        for i,p in enumerate(pts):
            pa=pts[max(0,i-2)];pb=pts[min(len(pts)-1,i+2)]
            dx=pb[0]-pa[0];dy=pb[1]-pa[1];den=math.hypot(dx,dy) or 1
            nx,ny=-dy/den,dx/den # inward normal of clockwise original contour
            normals.append((nx,ny))
            samples=[]
            for depth in [1,2.5,4,6]:
                for tangent in [-2,0,2]:
                    rgb=sample(p[0]+nx*depth+dx/den*tangent,p[1]+ny*depth+dy/den*tangent)
                    if rgb:samples.append(rgb)
            samples.sort(key=lum)
            tone=mean(samples[int(len(samples)*.65):]) if samples else [40,50,40]
            # An exposed edge can reflect blue fill, but the warm source rim is
            # strongest toward the upper-right light, and absent under joins.
            facing=clamp((-nx*.55+ny*.83+.1)/.8,0,1)
            L=lum(tone);level=clamp((L-105)/105,0,1)*(.3+.7*facing)
            levels.append(level);cols.append(tone)
        smoothed=[]
        for i in range(len(levels)):
            vals=levels[max(0,i-3):min(len(levels),i+4)]
            smoothed.append(sum(vals)/len(vals))
        current=[]
        for i,(p,n,level,tone) in enumerate(zip(pts,normals,smoothed,cols)):
            if level>.14:
                current.append((p,n,level));ring_colors.append(tone)
            else:
                if len(current)>4:runs.append(current)
                current=[]
        if len(current)>4:runs.append(current)
    polygons=[]
    for run in runs:
        if sum(math.dist(run[i][0],run[i+1][0]) for i in range(len(run)-1))<4:continue
        outer=[];inner=[]
        for i,(p,n,l) in enumerate(run):
            taper=min(1,(i+1)/3,(len(run)-i)/3)
            band=(.6+2.4*l)*taper
            outer.append([p[0]+n[0]*.8,p[1]+n[1]*.8])
            inner.append([p[0]+n[0]*(.8+band),p[1]+n[1]*(.8+band)])
        poly=simplify(outer)+list(reversed(simplify(inner)))
        polygons.append(poly)
    rim=mean(sorted(ring_colors,key=lum)[int(len(ring_colors)*.6):]) if ring_colors else hot
    rim=[round(clamp(v,0,255),2) for v in rim]
    allpts=[p for poly in polygons for p in poly]
    if allpts:
        rx=min(p[0] for p in allpts);ry=min(p[1] for p in allpts)
        # Rounded line joins with close source-spaced anchors keep rim placement.
        d=' '.join('M '+' L '.join(f'{p[0]-rx:.2f} {p[1]-ry:.2f}' for p in poly)+' Z' for poly in polygons)
    else:rx=left;ry=top;d=''
    shadow=.22 if capLum>180 else .32
    if num in [28,29,31,32,34,40,43,51,54,60]:shadow=.44
    out.append({'number':num,'top':top,'left':left,'width':width,'height':height,'capDepth':round(capdepth,3),
        'capColor':hot,'capStrength':round(strength,3),'rimColor':rim,'rimPath':d,'rimX':rx,'rimY':ry,
        'rimPolygons':polygons,'shadowAlpha':shadow,'shadowRadius':round(clamp(width*.14,2.2,8),3)})

(ROOT/'lighting.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps({'pillars':len(out),'rimmedPillars':sum(bool(c['rimPath']) for c in out),'rimRegions':sum(len(c['rimPolygons']) for c in out),'pathChars':sum(len(c['rimPath']) for c in out),'capLuminanceRange':[round(min(lum(c['capColor']) for c in out)),round(max(lum(c['capColor']) for c in out))]}))
