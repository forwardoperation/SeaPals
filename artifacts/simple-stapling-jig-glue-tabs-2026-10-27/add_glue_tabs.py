"""Add two end mounting ears and two identical visual-reference tabs.
Run with the user's current, corrected simple tray opened in Blender background.
Millimeter model units. Stages new files beside this script; does not overwrite
the user file until review and validation are complete.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent
W,H=216.4,279.9
PAPER_W,PAPER_H=215.9,279.4
PAPER_ORIGIN=.5 # preserve TOP/RIGHT registration in the existing tray
GLUE_H=273.05
INSET=(PAPER_H-GLUE_H)/2
BED=12.7
GAP=1.0
TAB_Z=BED+GAP
TAB_T=3.0
CX=W/2
TAB_W=44.0
EAR_W=48.0
EAR_END=13.2 # 10 mm beyond existing 3.2 mm tray border
TOP_EDGE=H-INSET
BOTTOM_EDGE=PAPER_ORIGIN+INSET
TAB_L=15.375
HOLE_PITCH=28.0
HOLE_D=3.4
HEAD_D=6.4
HEAD_RECESS=3.4
# Both tabs have identical hole locations relative to their inner reference edge.
HOLE_FROM_INNER=11.375
TOP_BOLT_Y=TOP_EDGE+HOLE_FROM_INNER
BOTTOM_BOLT_Y=BOTTOM_EDGE-HOLE_FROM_INNER
assert abs((TOP_EDGE-BOTTOM_EDGE)-GLUE_H)<1e-8

if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
source_path=bpy.data.filepath
tray=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Paper stapling tray'))
scene=bpy.context.scene
bpy.context.preferences.filepaths.save_version=0

def active(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def box(name,x0,x1,y0,y1,z0,z1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2))
    o=bpy.context.object;o.name=name;o.dimensions=(x1-x0,y1-y0,z1-z0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return o

def bore(name,x,y,z0,z1,r):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=z1-z0,location=(x,y,(z0+z1)/2))
    o=bpy.context.object;o.name=name;return o

def boolean(o,cutter,operation='DIFFERENCE'):
    active(o);m=o.modifiers.new('Mounting ear solid','BOOLEAN');m.operation=operation;m.solver='MANIFOLD';m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cutter,do_unlink=True)

def validate(o):
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    edges=sum(not e.is_manifold for e in bm.edges);volume=bm.calc_volume(signed=True)
    seen=set();components=0
    for v in bm.verts:
        if v in seen:continue
        components+=1;stack=[v];seen.add(v)
        while stack:
            a=stack.pop()
            for e in a.link_edges:
                b=e.other_vert(a)
                if b not in seen:seen.add(b);stack.append(b)
    if edges:
        print('BAD_EDGES',json.dumps([{'verts':[list(v.co) for v in e.verts],'faces':len(e.link_faces)} for e in bm.edges if not e.is_manifold]))
    bm.to_mesh(o.data);bm.free()
    assert edges==0 and components==1 and volume>0,(o.name,edges,components,volume)
    return {'non_manifold_edges':edges,'connected_components':components,'volume_mm3':volume}

# Triangulate the existing concave bottom faces before adding drilled mounts.
# This avoids ambiguous polygon tessellation when a circular bore crosses an ngon.
bm=bmesh.new();bm.from_mesh(tray.data)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bm.to_mesh(tray.data);bm.free()
# Ears overlap the old tray border by 0.5 mm, and rise 1 mm above the bed.
for y0,y1,y in [(-EAR_END,-2.7,BOTTOM_BOLT_Y),(H+2.7,H+EAR_END,TOP_BOLT_Y)]:
    ear=box('Integrated end mounting ear',CX-EAR_W/2,CX+EAR_W/2,y0,y1,0,TAB_Z)
    for x in [CX-HOLE_PITCH/2,CX+HOLE_PITCH/2]:
        boolean(ear,bore('M3 through hole',x,y,-1,TAB_Z+1,HOLE_D/2))
        # Bolt heads enter from below and sit above the tabletop plane.
        boolean(ear,bore('Recessed socket head',x,y,-1,HEAD_RECESS,HEAD_D/2))
    validate(ear)
    boolean(tray,ear,'UNION')
tray.name='Paper stapling tray - Letter with end mounts'
tray['End ear extension beyond existing outline mm']=10.0
tray['Mount holes']='Four diameter3.4 mm; two per end, 28 mm apart.'
tray['Underside head recess']='Diameter6.4 mm x3.4 mm deep. Insert M3 socket heads upward; nuts above tabs.'
tray['Tab underside gap above paper bed mm']=GAP
tray['Glue reference edges y mm']=f'{BOTTOM_EDGE:.3f}, {TOP_EDGE:.3f}'
tray['Glue alignment type']='VISUAL reference only; all sheets pass below tabs.'
body_check=validate(tray)

tabmat=bpy.data.materials.new('Glue guide tabs - teal');tabmat.diffuse_color=(.02,.43,.44,1)
top=box('TOP glue alignment tab',CX-TAB_W/2,CX+TAB_W/2,TOP_EDGE,TOP_EDGE+TAB_L,TAB_Z,TAB_Z+TAB_T)
for x in [CX-HOLE_PITCH/2,CX+HOLE_PITCH/2]:boolean(top,bore('Tab M3 hole',x,TOP_BOLT_Y,TAB_Z-1,TAB_Z+TAB_T+1,HOLE_D/2))
top.data.materials.clear();top.data.materials.append(tabmat)
top.data.transform(top.matrix_world);top.matrix_world=Matrix.Identity(4)
top_check=validate(top)
bottom=top.copy();bottom.data=top.data.copy();bpy.context.collection.objects.link(bottom)
bottom.name='BOTTOM glue alignment tab'
# Rotate the identical top part 180 degrees about X/Y center of the glue region.
center=Vector((CX,(TOP_EDGE+BOTTOM_EDGE)/2,0))
bottom.data.transform(Matrix.Translation(center) @ Matrix.Rotation(math.pi,4,'Z') @ Matrix.Translation(-center))
bottom_check=validate(bottom)
for tab in [top,bottom]:
    tab['Print quantity']='Two identical tabs total; use glue-alignment-tab.stl twice.'
    tab['Reference']='Look straight down; line glue end up with the inward vertical edge. Top/bottom guidance only.'
    tab['Initial setup']='Allow for bolt clearance: align edges using a centered glue sheet before tightening both nuts.'
    tab['Hardware']='Two M3x20 socket-head bolts inserted upward; two M3 nuts above each tab.'
    tab['Clearance']='1 mm above bed. Raise with equal washer shims between tab and ear if needed.'

def hit(o,p,v):
    ok,co,n,i=o.ray_cast(Vector(p),Vector(v))
    assert ok,(o.name,p,v)
    return co
def close(a,b):assert abs(a-b)<.001,(a,b)
# Validate the actual mesh reference faces, underside clearance, and shared bores.
actual_bottom=hit(bottom,(CX,10,TAB_Z+1),(0,-1,0)).y
actual_top=hit(top,(CX,H-10,TAB_Z+1),(0,1,0)).y
close(actual_top-actual_bottom,GLUE_H)
close(actual_bottom-PAPER_ORIGIN,INSET);close(H-actual_top,INSET)
for tab,y in [(top,TOP_EDGE+1),(bottom,BOTTOM_EDGE-1)]:
    underside=hit(tab,(CX,y,BED),(0,0,1)).z
    close(underside-BED,GAP)
for y,tab in [(TOP_BOLT_Y,top),(BOTTOM_BOLT_Y,bottom)]:
    for x in [CX-14,CX+14]:
        assert not tray.ray_cast(Vector((x,y,50)),Vector((0,0,-1)))[0]
        assert not tab.ray_cast(Vector((x,y,50)),Vector((0,0,-1)))[0]
        # Check bore wall and underside counterbore radius at the nominal center.
        close(hit(tray,(x,y,5),(1,0,0)).x-x,HOLE_D/2)
        close(hit(tray,(x,y,1),(1,0,0)).x-x,HEAD_D/2)
        close(hit(tab,(x,y,TAB_Z+1),(1,0,0)).x-x,HOLE_D/2)

# Check no added mount changed the original letter pocket, bed or staple slots.
close(hit(tray,(100,130,50),(0,0,-1)).z,BED)
close(hit(tray,(100,10,13.2),(1,0,0)).x-hit(tray,(100,10,13.2),(-1,0,0)).x,W)
close(hit(tray,(15,130,13.2),(0,1,0)).y-hit(tray,(15,130,13.2),(0,-1,0)).y,H)
for y in [H-49.403,H-233.807]:
    for x in [5,210]:
        assert not tray.ray_cast(Vector((x,y,50)),Vector((0,0,-1)))[0]
        close(hit(tray,(x,y,3),(0,1,0)).y-hit(tray,(x,y,3),(0,-1,0)).y,38.7)

def export(o,filename):
    cp=o.copy();cp.data=o.data.copy();bpy.context.collection.objects.link(cp)
    cp.data.transform(cp.matrix_world);cp.matrix_world=Matrix.Identity(4)
    verts=[v.co for v in cp.data.vertices]
    low=Vector(tuple(min(v[k] for v in verts) for k in range(3)))
    cp.data.transform(Matrix.Translation(-low));active(cp)
    bpy.ops.wm.stl_export(filepath=str(ROOT/filename),export_selected_objects=True,use_scene_unit=False,global_scale=1,forward_axis='Y',up_axis='Z')
    bpy.data.objects.remove(cp,do_unlink=True)
export(tray,'paper-stapling-rig.stl')
export(top,'glue-alignment-tab.stl')

metadata={
 'source_blend':source_path,'printable_parts':3,'print_files':{'paper-stapling-rig.stl':1,'glue-alignment-tab.stl':2},
 'glue_sheet_mm':[209.55,273.05],'glue_top_bottom_inset_mm':INSET,
 'reference_edges_y_mm':[BOTTOM_EDGE,TOP_EDGE],'actual_reference_gap_mm':actual_top-actual_bottom,
 'paper_registration':'Top and right stops, with lower-left paper corner at(0.5,0.5).',
 'tab_dimensions_mm':[TAB_W,TAB_L,TAB_T],'ear_width_mm':EAR_W,'ear_extension_mm':10.0,
 'tray_footprint_mm':[222.8,H+2*EAR_END],'tray_height_mm':15.7,'assembled_printed_height_mm':TAB_Z+TAB_T,
 'tab_underside_clearance_mm':GAP,'hole_diameter_mm':HOLE_D,'hole_pitch_mm':HOLE_PITCH,
 'underside_bolt_head_recess_mm':{'diameter':HEAD_D,'depth':HEAD_RECESS},
 'bolt_centers_mm':[[x,y] for y in [BOTTOM_BOLT_Y,TOP_BOLT_Y] for x in [CX-14,CX+14]],
 'hardware':'Four M3x20 socket-head bolts inserted from below, four M3 nuts above tabs. Optional paired equal shims under tabs.',
 'validation':{'tray':body_check,'top_tab':top_check,'bottom_tab':bottom_check,'reference_gap_and_pocket_checked':True,'all_bores_aligned':True},
 'fit_note':'Confirm the real three-sheet stack slides below the 1 mm gap; add equal washer shims between tab and ear if needed. Align tabs before tightening to remove bolt-clearance error. Look straight down to minimize parallax. Tabs guide top/bottom only.'
}
(ROOT/'dimensions-and-validation.json').write_text(json.dumps(metadata,indent=2))
txt=bpy.data.texts.get('GLUE ALIGNMENT TABS') or bpy.data.texts.new('GLUE ALIGNMENT TABS');txt.clear();txt.write(json.dumps(metadata,indent=2))
old=bpy.data.texts.get('DIMENSIONS AND USE')
if old:
    existing=json.loads(old.as_string());existing['overall_footprint_mm']=metadata['tray_footprint_mm']
    existing['assembled_printed_height_mm']=metadata['assembled_printed_height_mm']
    existing['glue_tabs']='See GLUE ALIGNMENT TABS text block.'
    existing['caveats']=[s for s in existing.get('caveats',[]) if not s.startswith('One-piece length')]
    existing['caveats'].append('Tray footprint with mounting ears is222.8x306.3mm; check build-plate fit.')
    old.clear();old.write(json.dumps(existing,indent=2))

camera=scene.camera
if not camera:
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
camera.location=(-280,-380,490);target=Vector((W/2,H/2,0))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=460;camera.data.clip_end=10000
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=target
            area.spaces.active.region_3d.view_distance=460
active(tray)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'paper-stapling-rig.blend'))
scene.render.filepath=str(ROOT/'tray-with-glue-tabs.png');bpy.ops.render.render(write_still=True)
camera.location=(CX,H/2,600);camera.rotation_euler=(0,0,0);camera.data.ortho_scale=380
scene.render.filepath=str(ROOT/'tray-with-glue-tabs-top.png');bpy.ops.render.render(write_still=True)
# Close-up of the lower tab, clearly showing the cantilever and paper clearance.
camera.location=(CX-65,-85,75);target=Vector((CX,-1,13))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=85
scene.render.filepath=str(ROOT/'glue-tab-detail.png');bpy.ops.render.render(write_still=True)
print('GLUE_TABS_COMPLETE',json.dumps(metadata))
