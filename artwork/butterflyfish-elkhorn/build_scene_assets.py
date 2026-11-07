"""Coral outline/mask and editable water-light setting for the two-subject study."""
from pathlib import Path
import json
from build_coral import CORAL_GEOMETRY,coral_defs,build_coral_layers
ROOT=Path(__file__).parent
G=json.loads((ROOT/'fish-geometry.json').read_text(encoding='utf-8-sig'))['paths']
def svg(s,defs=''):return f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853" viewBox="0 0 1280 853"><defs>{defs}</defs>{s}</svg>'
layers=build_coral_layers()
(ROOT/'elkhorn-coral-editable.svg').write_text(svg(''.join(layers.values()),coral_defs()),encoding='utf-8')
(ROOT/'coral-structure.svg').write_text(svg(layers['01 Branch silhouettes'],coral_defs()),encoding='utf-8')
out=''.join(f'<path id="{name} outline" d="{d}" fill="none" stroke="#60462D" stroke-width="1.8" stroke-linejoin="round"/>' for name,d in CORAL_GEOMETRY.items() if name!='silhouette')
(ROOT/'coral-outline.svg').write_text(svg(out),encoding='utf-8')
maskdefs=f'<mask id="excludeFish" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="853" mask-type="luminance"><rect width="1280" height="853" fill="white"/><path d="{G["full_silhouette"]}" fill="black"/></mask>'
mask=f'<g id="Visible coral only" mask="url(#excludeFish)"><path id="Coral silhouette" d="{CORAL_GEOMETRY["silhouette"]}" fill="white"/></g>'
(ROOT/'coral-mask.svg').write_text(svg(mask,maskdefs),encoding='utf-8')
(ROOT/'coral-geometry.json').write_text(json.dumps(CORAL_GEOMETRY,indent=2),encoding='utf-8')
(ROOT/'coral-manifest.json').write_text(json.dumps([{'name':n} for n in layers],indent=2),encoding='utf-8')
waterdefs='''<linearGradient id="ocean" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="#3F96A0"/><stop offset=".35" stop-color="#247D8B"/><stop offset="1" stop-color="#073C51"/></linearGradient>
<radialGradient id="surfaceGlow" gradientUnits="userSpaceOnUse" cx="534" cy="0" r="610"><stop stop-color="#FFF4C6" stop-opacity=".78"/><stop offset=".2" stop-color="#E9F0D1" stop-opacity=".25"/><stop offset=".65" stop-color="#AFE1DA" stop-opacity=".07"/><stop offset="1" stop-color="#80BFC1" stop-opacity="0"/></radialGradient>
<linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="525" y1="0" x2="565" y2="730"><stop stop-color="#F9F1CF" stop-opacity=".16"/><stop offset=".7" stop-color="#D0E6DA" stop-opacity=".025"/><stop offset="1" stop-color="#D0E6DA" stop-opacity="0"/></linearGradient>'''
water='<g id="01 Ocean gradient"><rect id="Teal water" width="1280" height="853" fill="url(#ocean)"/><rect id="Surface light" width="1280" height="853" fill="url(#surfaceGlow)"/></g>'
water+='<g id="02 Sunlight shafts">'
for i,(a,b,c,d) in enumerate([(454,487,-80,183),(491,508,178,370),(525,539,470,583),(554,569,742,864),(587,611,1086,1254)]):
    water+=f'<path id="Sun shaft {i+1}" d="M{a} 0 L{b} 0 L{d} 853 L{c} 853 Z" fill="url(#beam)"/>'
water+='</g>'
(ROOT/'water-light.svg').write_text(svg(water,waterdefs),encoding='utf-8')
print(json.dumps({'coralLayers':len(layers),'coralBytes':(ROOT/'elkhorn-coral-editable.svg').stat().st_size,'sceneAssets':['coral-outline.svg','coral-mask.svg','water-light.svg']}))
