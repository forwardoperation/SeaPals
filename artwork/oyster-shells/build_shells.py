"""Rebuild two editable oyster SVGs from their existing Figma silhouettes.

The source photo supplies deterministic curved color regions. A mild prefilter
removes photographic grit; gradient underpainting and glazes soften the result.
Every visible element remains a vector path. Apply a 1.5 px layer blur to the
named Shell-color-contours group in Figma, inside its silhouette mask.
"""
from pathlib import Path
import json, math, re, sys, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tmp' / 'underwater-svg-tools'))
import vtracer

SETTINGS = dict(colormode='color', hierarchical='stacked', mode='spline',
                filter_speckle=6, color_precision=6, layer_difference=16,
                corner_threshold=80, length_threshold=3.5, max_iterations=10,
                splice_threshold=45, path_precision=2)

SPECS = [
    dict(name='rear-oyster', node='4473:42167', title='Rear oyster - amber limestone plates',
         base=['#b6ad91','#7e7b65','#292c24'], glaze='#e2d3ac', texture_opacity=.91),
    dict(name='front-oyster', node='4473:42165', title='Front oyster - dark olive growth ridges',
         base=['#6a5d37','#353b27','#101713'], glaze='#c4a766', texture_opacity=.94,
         trace_overrides={'color_precision':8,'layer_difference':5,'filter_speckle':9}),
]

def points(data):
    nums=list(map(float,re.findall(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?',data)))
    return list(zip(nums[::2],nums[1::2]))

def make(spec, outline, photo):
    w,h=outline['width'],outline['height']
    iw,ih=math.ceil(w),math.ceil(h)
    gx,gy=outline['absoluteTransform'][0][2],outline['absoluteTransform'][1][2]
    x,y=gx-801,gy+426
    d=' '.join(p['data'] for p in outline['paths'])
    crop=photo.transform((iw,ih),Image.Transform.AFFINE,(1,0,x,0,1,y),Image.Resampling.BICUBIC)
    # Deterministic trace simplification, not painted or generated replacement pixels.
    crop=crop.filter(ImageFilter.GaussianBlur(1.35))
    alpha=Image.new('L',(iw,ih),0)
    draw=ImageDraw.Draw(alpha)
    for p in outline['paths']: draw.polygon(points(p['data']),fill=255)
    crop.putalpha(alpha)
    input_file=ROOT/(spec['name']+'-trace-input.png')
    raw_file=ROOT/(spec['name']+'-trace.svg')
    crop.save(input_file)
    settings=dict(SETTINGS,**spec.get('trace_overrides',{}))
    vtracer.convert_image_to_svg_py(str(input_file),str(raw_file),**settings)
    tree=ET.parse(raw_file).getroot()
    paths=[n for n in list(tree) if n.tag.endswith('path')]
    # ElementTree uses namespace prefixes; remove them for the standalone document.
    content=[]
    for i,p in enumerate(paths):
        p.tag='path';p.set('id',f'color-contour-{i+1:03d}')
        content.append(ET.tostring(p,encoding='unicode'))
    b0,b1,b2=spec['base']
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<title>{spec['title']}</title>
<desc>Editable vector oyster with original silhouette, smooth sampled color contours, gradient underpainting and light glazing. No bitmap images or external assets.</desc>
<defs>
 <clipPath id="Original-shell-silhouette"><path d="{d}"/></clipPath>
 <linearGradient id="shell-underpainting" x1="82%" y1="0%" x2="18%" y2="100%"><stop offset="0" stop-color="{b0}"/><stop offset=".48" stop-color="{b1}"/><stop offset="1" stop-color="{b2}"/></linearGradient>
 <linearGradient id="upper-light" x1="85%" y1="0%" x2="30%" y2="100%"><stop offset="0" stop-color="{spec['glaze']}" stop-opacity=".13"/><stop offset=".48" stop-color="{spec['glaze']}" stop-opacity="0"/><stop offset="1" stop-color="#0b100c" stop-opacity=".17"/></linearGradient>
</defs>
<g id="{spec['name']}-clipped-artwork" clip-path="url(#Original-shell-silhouette)">
 <g id="Opaque-gradient-underpainting"><path d="{d}" fill="url(#shell-underpainting)"/></g>
 <g id="Shell-color-contours" opacity="{spec['texture_opacity']}">
{''.join(content)}
 </g>
 <g id="Soft-light-and-shadow-glaze"><path d="{d}" fill="url(#upper-light)"/></g>
</g>
</svg>'''
    output=ROOT/(spec['name']+'.svg')
    output.write_text(svg,encoding='utf-8')
    parsed=ET.fromstring(svg)
    assert not any(n.tag.endswith('image') for n in parsed.iter())
    assert 'data:image' not in svg and 'href=' not in svg
    return dict(name=spec['name'],title=spec['title'],file=output.name,
                outline_node_id=outline['id'],outline_parent_id=outline['parent'],
                page_position={'x':gx,'y':gy},source_position={'x':x,'y':y},
                width=w,height=h,color_contour_paths=len(paths),
                total_visible_paths=len(paths)+2,bytes=output.stat().st_size,
                embedded_images=0,external_references=0,
                trace_settings=settings,
                texture_group='Shell-color-contours',suggested_texture_blur_px=1.5)

def main():
    snapshot=json.loads((ROOT/'figma-before.json').read_text('utf-8-sig'))
    outlines={n['id']:n for n in snapshot['outlines']}
    photo=Image.open(ROOT.parent/'oyster-background'/'reference.png').convert('RGBA')
    results=[make(s,outlines[s['node']],photo) for s in SPECS]
    report={'source_photo':'../oyster-background/reference.png',
            'source_geometry':'figma-before.json','settings':SETTINGS,
            'source_prefilter_gaussian_radius':1.35,'assets':results,
            'layering':'Replace each outline in its existing parent/index; rear is behind main oyster, front is inside main oyster group.'}
    (ROOT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results,indent=2))

if __name__=='__main__': main()
