"""Read the saved Blender model; check solid overlap and sampled withdrawal paths.
This is a geometric check, not a physical tolerance or fatigue qualification.
Run with blender --background SeaRealm_Stapling_Jig_PROTOTYPE.blend --python verify_assembly.py
"""
import bpy,bmesh,json,itertools
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
all_parts=[o for o in bpy.data.objects if o.get('part_kind')=='PRINTABLE PROTOTYPE' and not o.name.startswith(('fit_coupon','alignment_key'))]

def bounds(o):
    pts=[o.matrix_world@Vector(c) for c in o.bound_box]
    return [min(p[k] for p in pts) for k in range(3)],[max(p[k] for p in pts) for k in range(3)]

def overlap(a,b):
    al,ah=bounds(a);bl,bh=bounds(b)
    if any(min(ah[k],bh[k])-max(al[k],bl[k])<.0001 for k in range(3)):return 0
    cp=a.copy();cp.data=a.data.copy();bpy.context.collection.objects.link(cp)
    m=cp.modifiers.new('intersection check','BOOLEAN');m.operation='INTERSECT';m.solver='EXACT';m.object=b
    dg=bpy.context.evaluated_depsgraph_get();ev=cp.evaluated_get(dg);me=ev.to_mesh()
    bm=bmesh.new();bm.from_mesh(me);v=abs(bm.calc_volume(signed=True));bm.free();ev.to_mesh_clear()
    bpy.data.objects.remove(cp,do_unlink=True)
    return v

issues=[]
for a,b in itertools.combinations(all_parts,2):
    v=overlap(a,b)
    if v>.02:issues.append({'phase':'assembled','parts':[a.name,b.name],'volume_mm3':round(v,4)})

guide=[o for o in all_parts if o.name.startswith(('glue_guide','guide_splice'))]
stationary=[o for o in all_parts if o not in guide]
for dx in [-1,-5,-15,-30,-60,-100,-150,-200]:
    initial={o.name:o.location.copy() for o in guide}
    for o in guide:o.location.x+=dx
    bpy.context.view_layer.update()
    for a in guide:
        for b in stationary:
            v=overlap(a,b)
            if v>.02:issues.append({'phase':f'guide_x{dx}','parts':[a.name,b.name],'volume_mm3':round(v,4)})
    for o in guide:o.location=initial[o.name]

# Guide is physically absent during bridge withdrawal. Clamp remains engaged.
bridges=[o for o in stationary if o.name.startswith('loading_bridge')]
fixed=[o for o in stationary if o not in bridges]
for dx in [-1,-10,-30,-60,-100,-200]:
    initial={o.name:o.location.copy() for o in bridges}
    for o in bridges:o.location.x+=dx
    bpy.context.view_layer.update()
    for a in bridges:
        for b in fixed:
            v=overlap(a,b)
            if v>.02:issues.append({'phase':f'bridge_x{dx}','parts':[a.name,b.name],'volume_mm3':round(v,4)})
    for o in bridges:o.location=initial[o.name]
result={'assembled_and_sampled_withdrawal_overlap_count':len(issues),'issues':issues,'guide_samples_mm':[-1,-5,-15,-30,-60,-100,-150,-200],'bridge_samples_mm':[-1,-10,-30,-60,-100,-200],'limitations':'Nominal printed solids only; actual media, hardware, compliance, stapler body and continuously swept surfaces require physical validation.'}
(ROOT/'assembly_validation.json').write_text(json.dumps(result,indent=2))
print('ASSEMBLY_CHECK',json.dumps(result))
if issues:raise RuntimeError('Assembly overlap requires correction')
