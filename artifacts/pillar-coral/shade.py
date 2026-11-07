"""Build photo-sampled, smooth native vector shading for the traced pillars."""
import json, math, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter
from trace import contours, occlusion, cubics, evaluate, path_data

ROOT=Path(__file__).parent
photo=Image.open(ROOT/'source.png').convert('RGB')
pixels=photo.load()
SIZE=photo.size
polys=[];masks=[]
for c in contours:
    poly=[evaluate(b,j/10) for b in cubics(c['points'],c['closed']) for j in range(10)]
    # An untraced fused base closes without changing the hand-traced side curves.
    polys.append(poly)
    mask=Image.new('L',SIZE);ImageDraw.Draw(mask).polygon([tuple(p) for p in poly],fill=255)
    masks.append(mask)

def mean_color(samples):
    if not samples:return [70,69,51]
    # Trim the brightest/darkest texture flecks while retaining local hue.
    samples=sorted(samples,key=lambda c:sum(c))
    trim=int(len(samples)*.16)
    samples=samples[trim:len(samples)-trim] if trim else samples
    return [sum(p[k] for p in samples)/len(samples) for k in (0,1,2)]

def lerp(a,b,t):return [a[k]*(1-t)+b[k]*t for k in range(len(a))]
def sample_stops(stops,t):
    t=max(0,min(1,t))
    for a,b in zip(stops,stops[1:]):
        if t<=b['position']:
            return lerp(a['rgb'],b['rgb'],(t-a['position'])/(b['position']-a['position']))
    return stops[-1]['rgb']

data=[];visible_masks=[]
for i,c in enumerate(contours):
    number=i+1
    mask=masks[i].copy()
    for j in occlusion.get(number,[]):mask=ImageChops.subtract(mask,masks[j-1])
    visible_masks.append(mask)
    bounds=masks[i].getbbox();x0,y0,x1,y1=bounds;w=x1-x0;h=y1-y0
    m=masks[i].load();vm=mask.load()
    rows=[]
    for y in range(y0+int(h*.15),y0+int(h*.85)):
        xs=[x for x in range(x0,x1) if m[x,y]]
        if xs:rows.append((y,sum(xs)/len(xs)))
    if rows:
        my=sum(p[0] for p in rows)/len(rows);mx=sum(p[1] for p in rows)/len(rows)
        den=sum((y-my)**2 for y,x in rows)
        slope=sum((y-my)*(x-mx) for y,x in rows)/den if den else 0
    else:slope=0
    slope=max(-1,min(1,slope)) if h>w*.85 else 0
    uv=[p[0]-slope*(p[1]-y0) for p in polys[i]]
    u0,u1=min(uv),max(uv)
    samples=[]
    for y in range(y0,y1):
        for x in range(x0,x1):
            if vm[x,y]:
                rgb=pixels[x,y]
                # Avoid cyan water antialiasing outside the coral edge.
                if rgb[2]>rgb[0]*1.35 and rgb[1]>rgb[0]*1.4:continue
                samples.append(((x-slope*(y-y0)-u0)/(u1-u0),(y-y0)/h,rgb))
    body=[p for p in samples if .12<p[1]<.82] or samples
    positions=[0,.12,.3,.5,.7,.85,.95,1]
    stops=[]
    for p in positions:
        nearby=[rgb for u,v,rgb in body if abs(u-p)<.09]
        if len(nearby)<6:
            nearby=[z[2] for z in sorted(body,key=lambda z:abs(z[0]-p))[:max(8,len(body)//12)]]
        col=mean_color(nearby)
        stops.append({'position':p,'rgb':[round(v,2) for v in col]})
    cap=mean_color([rgb for u,v,rgb in samples if v<.085])
    base=mean_color([rgb for u,v,rgb in samples if v>.88])
    # Use source-derived light at the cap and shade at the base over the body.
    tip_amount=.82
    base_amount=.55 if h>80 else .35
    vert=[{'position':0,'rgba':cap+[tip_amount]},
          {'position':min(.08,12/max(30,h)),'rgba':cap+[.43]},
          {'position':min(.34,34/max(65,h)),'rgba':cap+[0]},
          {'position':.72,'rgba':base+[0]},
          {'position':1,'rgba':base+[base_amount]}]
    path=path_data([[x-x0,y-y0] for x,y in c['points']],c['closed'])
    if not c['closed']:path+=' Z'
    data.append({'number':number,'name':c['name'],'x':x0,'y':y0,'w':w,'h':h,'path':path,
        'slope':round(slope,6),'u0':round(u0,6),'u1':round(u1,6),'stops':stops,'vertical':vert,
        'occluders':occlusion.get(number,[])})

(ROOT/'shading.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
# Render the vector paint model to inspect its fit before writing Figma nodes.
render=photo.copy(); rp=render.load()
isolate=Image.new('RGB',SIZE,(17,28,32));ip=isolate.load()
for c,mask in zip(data,visible_masks):
    box=mask.getbbox();mp=mask.load()
    if not box:continue
    for y in range(box[1],box[3]):
        for x in range(box[0],box[2]):
            if not mp[x,y]:continue
            u=(x-c['slope']*(y-c['y'])-c['u0'])/(c['u1']-c['u0'])
            col=sample_stops(c['stops'],u)
            v=(y-c['y'])/c['h']
            vs=[{'position':s['position'],'rgb':s['rgba']} for s in c['vertical']]
            tint=sample_stops(vs,v)
            col=lerp(col,tint[:3],tint[3])
            rgb=tuple(round(max(0,min(255,z))) for z in col)
            rp[x,y]=rgb;ip[x,y]=rgb
render.save(ROOT/'shaded-preview.png')
isolate.crop((485,65,953,947)).resize((702,1323)).save(ROOT/'shaded-isolated-preview.png')
render.crop((485,65,953,947)).resize((702,1323)).save(ROOT/'shaded-detail-preview.png')
print(json.dumps({'pillars':len(data),'gradientStops':sum(len(c['stops'])+len(c['vertical']) for c in data),'cutouts':sum(len(c['occluders']) for c in data)}))
