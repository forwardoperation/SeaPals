"""Fill the newly smoothed distant silhouette with source-based cool contours."""
import json
from PIL import Image, ImageDraw, ImageChops
from environment import ROOT, W, H, photo, base, pillar, skyline, loops, path, pack

smooth=Image.new('L',(W,H));ImageDraw.Draw(smooth).polygon(skyline+[(W,H),(0,H)],fill=255)
gap=ImageChops.subtract(smooth,base)
gap=ImageChops.subtract(gap,pillar)
small=photo.resize((768,512),Image.Resampling.LANCZOS)
mask=gap.resize(small.size,Image.Resampling.NEAREST)
cols=[c for c,m in zip(small.getdata(),mask.getdata()) if m]
swatch=Image.new('RGB',(len(cols),1));swatch.putdata(cols)
pal=swatch.quantize(colors=10,method=Image.Quantize.MEDIANCUT)
q=small.quantize(palette=pal,dither=Image.Dither.NONE);qp=q.load();mp=mask.load();colors=q.getpalette()
nodes=[]
for k in range(10):
    m=Image.new('L',small.size);p=m.load()
    for y in range(512):
        for x in range(768):
            if mp[x,y] and qp[x,y]==k:p[x,y]=255
    contours=loops(m,minarea=6,eps=.8)
    if not contours:continue
    d=' '.join(path(pts,2,.3) for pts,a in contours)
    nodes.append({**pack(d),'name':f'Distant reef — blue formation {k+1:02d}','color':colors[k*3:k*3+3],'layer':'floor','opacity':1})
(ROOT/'distant-reef-packed.json').write_text(json.dumps(nodes,separators=(',',':')))
print(json.dumps({'layers':len(nodes),'chars':sum(len(n['d']) for n in nodes)}))
