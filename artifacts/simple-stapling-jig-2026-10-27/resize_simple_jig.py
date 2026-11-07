"""Repair the user's simple tray as one solid, in real millimeters.
Run Blender with the original .blend open in background, then this script.
Outputs are staged in this script's directory; source is never overwritten here.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
PAPER_W=215.9
PAPER_H=279.4
CLEARANCE=.5  # total, across each pair of opposite paper stops
W=PAPER_W+CLEARANCE
H=PAPER_H+CLEARANCE
PAPER_ORIGIN=CLEARANCE  # sheet pushed to TOP/RIGHT, leaving clearance at left/bottom
WALL=3.2
BED=12.7  # USER: tabletop to anvil = 1/2 inch
RIM=3.0
GROOVE=38.7  # USER: ~1.5 inch base +0.6 mm total sliding clearance
TOE=15.875  # USER: base toe to staple center = 5/8 inch
LEFT_INSET=64*25.4/300
# Holographic Figma's right-edge mark center: x2476 on a2550px Letter page.
RIGHT_INSET=(2550-2476)*25.4/300
FROM_TOP=[49.403,233.807]
STATIONS=[H-v for v in FROM_TOP]
LEFT_STOP=PAPER_ORIGIN+LEFT_INSET+TOE
RIGHT_STOP=PAPER_ORIGIN+PAPER_W-RIGHT_INSET-TOE

source_path=bpy.data.filepath
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=.001
scene.unit_settings.length_unit='MILLIMETERS'
bpy.context.preferences.filepaths.save_version=0

def active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True);bpy.context.view_layer.objects.active=o

def box(name,x0,x1,y0,y1,z0,z1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2))
    o=bpy.context.object;o.name=name;o.dimensions=(x1-x0,y1-y0,z1-z0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return o

def boolean(o,other,operation):
    active(o)
    mod=o.modifiers.new('Solid repair','BOOLEAN');mod.operation=operation;mod.solver='EXACT';mod.object=other
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(other,do_unlink=True)

tray=box('Paper stapling tray - Letter',-WALL,W+WALL,-WALL,H+WALL,0,BED)
# Preserve the original four L-shaped corner stops. Overlap the corner square
# so unions create a connected solid instead of the original four-face edge.
for right in [False,True]:
    for top in [False,True]:
        xa,xb=(W,W+WALL) if right else (-WALL,0)
        ya,yb=(H-34.8,H+WALL) if top else (-WALL,34.8)
        boolean(tray,box('corner side',xa,xb,ya,yb,BED-.2,BED+RIM),'UNION')
        xa,xb=(W-27.1,W+WALL) if right else (-WALL,27.1)
        ya,yb=(H,H+WALL) if top else (-WALL,0)
        boolean(tray,box('corner end',xa,xb,ya,yb,BED-.2,BED+RIM),'UNION')
# Full-depth open notches: the stapler's rubber base remains on the tabletop.
# Left pair matches ordinary front marks; right pair matches holo front marks.
for y in STATIONS:
    boolean(tray,box('left stapler opening',-WALL-2,LEFT_STOP,y-GROOVE/2,y+GROOVE/2,-1,BED+RIM+1),'DIFFERENCE')
    boolean(tray,box('right stapler opening',RIGHT_STOP,W+WALL+2,y-GROOVE/2,y+GROOVE/2,-1,BED+RIM+1),'DIFFERENCE')
active(tray)

bm=bmesh.new();bm.from_mesh(tray.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
nonmanifold=sum(not e.is_manifold for e in bm.edges)
volume=bm.calc_volume(signed=True)
seen=set();components=0
for v in bm.verts:
    if v in seen:continue
    components+=1;stack=[v];seen.add(v)
    while stack:
        a=stack.pop()
        for e in a.link_edges:
            b=e.other_vert(a)
            if b not in seen:seen.add(b);stack.append(b)
bm.to_mesh(tray.data);bm.free()
assert nonmanifold==0 and components==1 and volume>0,(nonmanifold,components,volume)
# Origin at base center; normalize transforms so displayed dimensions are real.
tray.data.transform(tray.matrix_world)
tray.matrix_world.identity()
tray['Paper size mm']='215.9 x279.4 (8.5 x11 inches)'
tray['Paper pocket mm']='216.4 x279.9 (0.5mm total clearance)'
tray['Paper support height mm']=BED
tray['Corner stops above paper bed mm']=RIM
tray['Stapler base width mm']=38.1
tray['Groove clear width mm']=GROOVE
tray['Measured toe to staple mm']=TOE
tray['Use']='Slide stapler directly on tabletop into a notch; keep paper seated consistently against top/right stops.'
tray['Fit status']='User supplied ruler dimensions. Verify printed fit and staple marks on scrap.'
mat=bpy.data.materials.new('Original-style neutral gray');mat.diffuse_color=(.42,.48,.51,1)
tray.data.materials.append(mat)
rim_mat=bpy.data.materials.new('Corner stops');rim_mat.diffuse_color=(.13,.22,.26,1)
tray.data.materials.append(rim_mat)
for polygon in tray.data.polygons:
    if polygon.center.z>BED+.01:polygon.material_index=1

measurements={
 'source_blend':source_path,
 'paper_mm':[PAPER_W,PAPER_H],
 'usable_paper_pocket_mm':[W,H],
 'total_paper_clearance_mm':CLEARANCE,
 'paper_registration':'Seat against TOP and RIGHT corner-stop faces; paper origin (0.5,0.5) mm.',
 'paper_support_height_mm':BED,
 'corner_stop_height_above_bed_mm':RIM,
 'overall_height_mm':BED+RIM,
 'overall_footprint_mm':[W+2*WALL,H+2*WALL],
 'stapler_base_width_mm_user_approximate':38.1,
 'stapler_groove_clear_width_mm':GROOVE,
 'toe_to_staple_mm_user':TOE,
 'groove_depth_past_nominal_left_paper_edge_mm':LEFT_INSET+TOE,
 'groove_depth_past_nominal_right_paper_edge_mm':RIGHT_INSET+TOE,
 'left_staple_inset_mm':LEFT_INSET,
 'right_staple_inset_mm':RIGHT_INSET,
 'groove_centers_from_nominal_paper_top_mm':FROM_TOP,
 'stapler_reference_plane':'Tabletop Z=0; no floor inside notches',
 'non_manifold_edges':nonmanifold,'connected_components':components,'volume_mm3':volume,
 'caveats':['0.5mm paper-pocket freedom means exact staple location requires consistent top/right seating and scrap calibration.',
            'Figma positions assume nominal print size; Epson borderless enlargement remains a physical-print calibration issue.',
            'One-piece length is286.3mm. Confirm build plate or split in slicer; no extra components are introduced.']
}
(ROOT/'dimensions.json').write_text(json.dumps(measurements,indent=2))
active(tray)
bpy.ops.wm.stl_export(filepath=str(ROOT/'paper-stapling-rig-Letter.stl'),export_selected_objects=True,global_scale=1,use_scene_unit=False,forward_axis='Y',up_axis='Z')

# Inspectable render; only ONE printable mesh exists in this project.
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=1500;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
shade=scene.display.shading
shade.light='STUDIO';shade.studio_light='paint.sl';shade.color_type='MATERIAL'
shade.show_shadows=True;shade.show_cavity=True;shade.cavity_type='BOTH'
shade.curvature_ridge_factor=1.35;shade.curvature_valley_factor=1.1
shade.background_type='WORLD';scene.world.color=(.06,.07,.08)
scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(-280,-380,490))
camera=bpy.context.object;camera.name='Preview camera';camera.data.type='ORTHO';camera.data.ortho_scale=430;camera.data.clip_end=10000
target=Vector((W/2,H/2,0));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            v=area.spaces.active
            v.clip_start=.1;v.clip_end=10000
            v.region_3d.view_distance=430;v.region_3d.view_location=target
            v.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            v.shading.color_type='MATERIAL'
            v.overlay.show_floor=False;v.overlay.show_axis_x=False;v.overlay.show_axis_y=False
active(tray)
readme=bpy.data.texts.get('DIMENSIONS AND USE') or bpy.data.texts.new('DIMENSIONS AND USE')
readme.clear();readme.write(json.dumps(measurements,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'paper-stapling-rig-Letter.blend'))
scene.render.filepath=str(ROOT/'simple-tray-preview.png');bpy.ops.render.render(write_still=True)
camera.location=(W/2,H/2,600);camera.rotation_euler=(0,0,0);camera.data.ortho_scale=340
scene.render.filepath=str(ROOT/'simple-tray-top.png');bpy.ops.render.render(write_still=True)
print('SIMPLE_JIG_COMPLETE',json.dumps(measurements))
