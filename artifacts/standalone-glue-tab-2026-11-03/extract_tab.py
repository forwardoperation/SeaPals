import bpy,bmesh,json
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'simple-stapling-jig-glue-tabs-2026-10-27'/'paper-stapling-rig.blend'
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(SOURCE),link=False) as (src,dst):
    assert 'TOP glue alignment tab' in src.objects
    dst.objects=['TOP glue alignment tab']
tab=dst.objects[0]
bpy.context.collection.objects.link(tab)
tab.name='Glue alignment tab - print two'
tab.data.transform(tab.matrix_world);tab.matrix_world=Matrix.Identity(4)
low=Vector(tuple(min(v.co[k] for v in tab.data.vertices) for k in range(3)))
tab.data.transform(Matrix.Translation(-low))
high=Vector(tuple(max(v.co[k] for v in tab.data.vertices) for k in range(3)))
assert all(abs(a-b)<.001 for a,b in zip(high,(44,15.375,3))),list(high)
center=high/2
tab.data.transform(Matrix.Translation(-center));tab.location=center
tab.select_set(True);bpy.context.view_layer.objects.active=tab
bm=bmesh.new();bm.from_mesh(tab.data)
bad=sum(not e.is_manifold for e in bm.edges)
volume=bm.calc_volume(signed=True)
assert bad==0 and volume>0,(bad,volume)
bm.free()
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=.001
scene.unit_settings.length_unit='MILLIMETERS'
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
tab['Dimensions mm']='44 x 15.375 x 3'
tab['Mounting holes']='Two 3.4 mm diameter through-holes, 28 mm center spacing.'
tab['Print quantity']=2
tab['Source']='Original glue-reference tab from the October 27 jig design.'
note=bpy.data.texts.new('TAB NOTES')
note.write('Print two identical tabs. Dimensions: 44 x 15.375 x 3 mm. Hole diameter 3.4 mm; pitch 28 mm. The longer plain edge away from the holes is the glue-sheet reference. STL units are millimeters, import at 100%. See GLUE-TABS-README.txt for assembly and calibration.\n')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.shading.color_type='MATERIAL'
            space.clip_end=10000
            space.region_3d.view_location=center
            space.region_3d.view_distance=78
            space.region_3d.view_perspective='ORTHO'
            space.region_3d.view_rotation=Quaternion((0.927,0.324,0.125,0.141)).normalized()
bpy.ops.wm.stl_export(filepath=str(ROOT/'glue-alignment-tab.stl'),export_selected_objects=True,use_scene_unit=False,global_scale=1,forward_axis='Y',up_axis='Z')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glue-alignment-tab.blend'))
result={'dimensions_mm':list(high),'non_manifold_edges':bad,'volume_mm3':volume,'mesh_objects':1,'quantity_to_print':2}
(ROOT/'validation.json').write_text(json.dumps(result,indent=2))
print('TAB_EXTRACTED',json.dumps(result))
