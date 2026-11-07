import bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
results={}
for name,expected in [('paper-stapling-rig.stl',(222.8,306.3,15.7)),('glue-alignment-tab.stl',(44,15.375,3))]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.wm.stl_import(filepath=str(ROOT/name),use_scene_unit=False)
    o=bpy.context.object
    coords=[o.matrix_world@v.co for v in o.data.vertices]
    lo=[min(v[k] for v in coords) for k in range(3)]
    hi=[max(v[k] for v in coords) for k in range(3)]
    dims=[hi[k]-lo[k] for k in range(3)]
    assert all(abs(dims[k]-expected[k])<.001 for k in range(3)),(name,dims)
    assert all(abs(v)<.001 for v in lo),(name,lo)
    bm=bmesh.new();bm.from_mesh(o.data)
    bad=sum(not e.is_manifold for e in bm.edges)
    volume=bm.calc_volume(signed=True)
    assert bad==0 and volume>0,(name,bad,volume)
    results[name]={'dimensions_mm':dims,'non_manifold_edges':bad,'volume_mm3':volume,'lowest_xyz_mm':lo}
    bm.free()
(ROOT/'export-validation.json').write_text(json.dumps(results,indent=2))
print('STL_IMPORT_VALIDATED',json.dumps(results))
