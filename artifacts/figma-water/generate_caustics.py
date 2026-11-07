import math, random, re, json
from pathlib import Path

OUT=Path(__file__).parent
rng=random.Random(71493)
W,H=546,769.5
# A compact approximation is used only to omit unnecessary off-shark paths.
# Figma uses the original, exact shark silhouette as its final mask.
outline_data=json.loads((OUT/'shark-outline.json').read_text(encoding='utf-8'))['vectorPaths'][0]['data']
nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',outline_data)))
outline=list(zip(nums[::2],nums[1::2]))

def inside(x,y):
    c=False
    j=len(outline)-1
    for i,(xi,yi) in enumerate(outline):
        xj,yj=outline[j]
        if ((yi>y)!=(yj>y)) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:c=not c
        j=i
    return c

def near(x,y):
    return any(inside(x+dx,y+dy) for dx,dy in [(0,0),(-13,0),(13,0),(0,-13),(0,13)])

def safe(p):
    x,y=p
    if not inside(x,y):return False
    for a,b in zip(outline,outline[1:]+outline[:1]):
        dx,dy=b[0]-a[0],b[1]-a[1]
        l=dx*dx+dy*dy
        if l==0:continue
        t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/l))
        if (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2<1.75**2:return False
    return True

def evalq(a,c,b,t):
    return ((1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1])

def subq(a,c,b,t0,t1):
    aa,bb=evalq(a,c,b,t0),evalq(a,c,b,t1)
    mm=evalq(a,c,b,(t0+t1)/2)
    return aa,(2*mm[0]-(aa[0]+bb[0])/2,2*mm[1]-(aa[1]+bb[1])/2),bb

def clipq(a,c,b):
    # Subdivide in parameter space to exact quadratic subcurves. A dense safety
    # sampling with 1.75px inset keeps every stroke at least .7px inside.
    ts=[i/80 for i in range(81)]
    states=[safe(evalq(a,c,b,t)) for t in ts]
    runs=[];start=None
    for i in range(80):
        good=states[i] and states[i+1]
        if good and start is None:start=ts[i]
        if start is not None and (not good or i==79):
            end=ts[i] if not good else ts[i+1]
            if end-start>.055:runs.append(subq(a,c,b,start,end))
            start=None
    return runs

# Jittered sites give a variable-sized network without a recognizable lattice.
sites=[]
for row in range(-2,41):
    for col in range(-2,30):
        x=col*21+(row%2)*10.5+rng.uniform(-9,9)
        y=row*21+rng.uniform(-9,9)
        sites.append((x,y))

def clip(poly,a,b,c):
    ret=[]
    for p,q in zip(poly,poly[1:]+poly[:1]):
        fp=a*p[0]+b*p[1]-c;fq=a*q[0]+b*q[1]-c
        if fp<=1e-7:ret.append(p)
        if (fp<=0)!=(fq<=0):
            t=fp/(fp-fq)
            ret.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return ret

def warp(p):
    x,y=p
    return (x+9*math.sin(y/27)+5*math.sin((x+y)/19),y+7*math.sin(x/29)+4*math.sin((y-x)/21))

edges={}
for i,s in enumerate(sites):
    if not near(*s):continue
    nearest=sorted((j for j in range(len(sites)) if j!=i),key=lambda j:(sites[j][0]-s[0])**2+(sites[j][1]-s[1])**2)[:18]
    poly=[(-90,-90),(640,-90),(640,860),(-90,860)]
    for j in nearest:
        t=sites[j];poly=clip(poly,2*(t[0]-s[0]),2*(t[1]-s[1]),t[0]**2+t[1]**2-s[0]**2-s[1]**2)
        if not poly:break
    for a,b in zip(poly,poly[1:]+poly[:1]):
        key=tuple(sorted([(round(a[0],2),round(a[1],2)),(round(b[0],2),round(b[1],2))]))
        edges[key]=(a,b)

core=[[] for _ in range(4)]
focus=[[] for _ in range(4)]
count=0
def fmt(p):return f'{p[0]:.1f} {p[1]:.1f}'
for key,(a,b) in sorted(edges.items()):
    a,b=warp(a),warp(b)
    mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
    if not near(mx,my):continue
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=math.hypot(dx,dy)
    if length<2 or length>42:continue
    # One coherent flowing deformation, with gently bulging irregular edges.
    bend=rng.uniform(-.38,.38)*length
    c=(mx-dy/length*bend,my+dx/length*bend)
    # Preserve organic gaps so the result reads as refracted light, not mesh wire.
    if rng.random()<.2:continue
    if rng.random()<.3:
        t=rng.uniform(.5,.85)
        b=(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
    spine=535-.69*my
    dist=abs(mx-spine)
    dorsal=math.exp(-(dist/75)**2)
    tail_fade=max(.34,1-my/1100)
    light=(.3+.7*dorsal)*tail_fade*rng.uniform(.7,1.15)
    bucket=min(3,max(0,int(light*4)))
    for aa,cc,bb in clipq(a,c,b):
        core[bucket].append(f'M{fmt(aa)}Q{fmt(cc)} {fmt(bb)}');count+=1
    if rng.random()<.59:
        # Highlight part of the bend; no exact doubled full-network stroke.
        t0=rng.uniform(.02,.48);t1=min(.98,t0+rng.uniform(.18,.48))
        def point(t):return ((1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1])
        aa,bb=point(t0),point(t1);cc=point((t0+t1)/2)
        # midpoint-to-control conversion is exact for the quadratic subsegment.
        cc=(2*cc[0]-(aa[0]+bb[0])/2,2*cc[1]-(aa[1]+bb[1])/2)
        for aa,cc,bb in clipq(aa,cc,bb):
            focus[bucket].append(f'M{fmt(aa)}Q{fmt(cc)} {fmt(bb)}')

parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none">']
parts.append('<g id="caustic-refraction" stroke-linecap="round" stroke-linejoin="round">')
for k,paths in enumerate(core):
    parts.append(f'<path id="soft-refraction-{k+1}" d="{" ".join(paths)}" stroke="#87C2D5" stroke-width="1.9" opacity="{.021+k*.012:.3f}"/>')
for k,paths in enumerate(core):
    parts.append(f'<path id="caustic-lace-{k+1}" d="{" ".join(paths)}" stroke="#A5D8E3" stroke-width="{.4+k*.05:.2f}" opacity="{.075+k*.035:.3f}"/>')
for k,paths in enumerate(focus):
    parts.append(f'<path id="focused-light-{k+1}" d="{" ".join(paths)}" stroke="#D8F4F3" stroke-width="{.6+k*.16:.2f}" opacity="{.21+k*.085:.3f}"/>')
parts.append('</g></svg>')
svg='\n'.join(parts)
(OUT/'shark-caustics.svg').write_text(svg,encoding='utf-8')
# A review-only image source; not imported into the Figma deliverable.
backdrop='<path d="M'+' L'.join(f'{x} {y}' for x,y in outline)+' Z" fill="#255A76"/>'
preview=svg.replace('<g id="caustic-refraction"', '<rect width="546" height="769.5" fill="#052D49"/>'+backdrop+'<g id="caustic-refraction"')
(OUT/'caustics-review.svg').write_text(preview,encoding='utf-8')
print(json.dumps({'bytes':len(svg.encode()),'paths':len(re.findall('<path',svg)),'edges':count,'path':str(OUT/'shark-caustics.svg')}))
