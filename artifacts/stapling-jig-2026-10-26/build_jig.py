"""Blender 5.2 parametric prototype. Units: millimeters, STL coordinates: mm.
Run: blender --background --python build_jig.py
Optional: -- --no-render. Edit parameters.json then regenerate.
Original user model is never opened or overwritten by this script.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parent
P = json.loads((ROOT / 'parameters.json').read_text())
OUT = ROOT / 'stl_prototype'
OUT.mkdir(exist_ok=True)
W, H = P['paper_width_mm'], P['paper_height_mm']
GX=(W-P['glue_width_mm'])/2
GY=(H-P['glue_height_mm'])/2
FLOOR=P['dock_floor_mm']
BED=FLOOR+P['anvil_above_stapler_floor_mm_ASSUMED']
BOTTOM=P['bottom_sheet_thickness_mm_ASSUMED']
FILM=P['glue_sheet_thickness_mm_ASSUMED']
TOP=P['top_sheet_thickness_mm_ASSUMED']
GZ=BED+BOTTOM+P['guide_vertical_clearance_mm']
GT=GZ+P['guide_finger_thickness_mm']
GAP=P['stapler_base_width_mm']+P['stapler_width_clearance_mm']
TOE=P['staple_center_from_left_mm']+P['toe_to_staple_mm_ASSUMED']
STATIONS=[H-v for v in P['staple_centers_from_top_mm']]
assert P['guide_vertical_clearance_mm'] < FILM, 'Guide gap must be smaller than actual glue thickness.'
assert P['anvil_above_stapler_floor_mm_ASSUMED'] > 10.2, 'This prototype bridge design requires anvil height >10.2mm; revise bridge and rails for a lower stapler.'
parts=[]
refs=[]
manifest=[]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.collections):
    if data.name != 'Collection': bpy.data.collections.remove(data)
basecol=bpy.data.collections.get('Collection'); basecol.name='01 PRINTABLE ASSEMBLY'
refcol=bpy.data.collections.new('02 REFERENCE ONLY - do not print'); bpy.context.scene.collection.children.link(refcol)
labelcol=bpy.data.collections.new('03 PRESENTATION'); bpy.context.scene.collection.children.link(labelcol)

def material(name, rgb, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.5; bs.inputs['Metallic'].default_value=metallic
    return m
navy=material('Tray - ocean slate',(.055,.15,.19))
teal=material('Guide - teal',(.02,.57,.52))
orange=material('Adjustable controls - coral',(.98,.30,.12))
grey=material('Dock - slate blue',(.22,.33,.40))
paper=material('Reference - bottom paper',(.92,.94,.91))
blue=material('Reference - top paper',(.16,.52,.70))
glue=material('Reference - dry glue film',(.91,.72,.34))
metal=material('Reference - steel hardware',(.45,.49,.52),.6)
black=material('Reference - stapler envelope',(.055,.06,.07))

def active(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o

def box(name,x0,x1,y0,y1,z0,z1,mat=None):
    assert x1>x0 and y1>y0 and z1>z0,(name,x0,x1,y0,y1,z0,z1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0+x1)/2,(y0+y1)/2,(z0+z1)/2))
    o=bpy.context.object; o.name=name; o.dimensions=(x1-x0,y1-y0,z1-z0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if mat:o.data.materials.append(mat)
    return o

def cyl(name,x,y,z0,z1,r,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=z1-z0,location=(x,y,(z0+z1)/2))
    o=bpy.context.object; o.name=name
    return o

def boolean(o, cutter, op='DIFFERENCE'):
    active(o); m=o.modifiers.new('Precision solid','BOOLEAN'); m.operation=op; m.solver='EXACT'; m.object=cutter
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    return o

def union(name, objects,mat):
    o=objects[0]
    for other in objects[1:]: boolean(o,other,'UNION')
    o.name=name; o.data.materials.clear(); o.data.materials.append(mat)
    return o

def hole(o,x,y,z0,z1,r=1.7):return boolean(o,cyl('bore',x,y,z0,z1,r))

def slot(o,x0,x1,y0,y1,z0,z1):
    # Rectangular calibration slots: simple to print and inspect.
    return boolean(o,box('adjustment slot',x0,x1,y0,y1,z0,z1))

def register(o,name=None,flip=False,note=''):
    if name:o.name=name
    o['part_kind']='PRINTABLE PROTOTYPE'; o['print_flip_x']=flip; o['notes']=note
    parts.append(o)
    return o

def reference(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    refcol.objects.link(o); o['part_kind']='REFERENCE ONLY - NOT PRINTABLE'; refs.append(o); return o

def copy_clip(o,name,bounds):
    n=o.copy(); n.data=o.data.copy(); basecol.objects.link(n)
    boolean(n,box('split',*bounds),'INTERSECT'); n.name=name; return n

def recess_key(o,cx,cy,axis='x',z0=-.1,z1=2.4):
    dx,dy=(10,5) if axis=='x' else (5,10)
    slot(o,cx-dx,cx+dx,cy-dy,cy+dy,z0,z1)

# Main bed: four solid-envelope tiles. Slicer infill supplies the internal structure.
# The two generous mouth openings are temporarily filled by removable loading bridges.
tray=box('BED MASTER',-16,W+25,-14,H+14,0,BED,navy)
for y in STATIONS:
    slot(tray,-20,42,y-44,y+44,-1,BED+2)
    slot(tray,41.9,48,y-44,y+44,BED-3,BED+2)
# Outer paper datums: right side twice and top-right once, clear of guide withdrawal.
tray=union('BED MASTER',[tray,
    box('right datum 1',W,W+3,22,40,BED-.1,BED+3),
    box('right datum 2',W,W+3,H-40,H-22,BED-.1,BED+3),
    box('top datum',202,W,H,H+3,BED-.1,BED+3)],navy)
# Open-left recessed tracks support and register the U. Seat against the right
# ends, then bias toward +Y (the top track wall). Bottom track has 0.2 mm freedom.
slot(tray,-16.1,-9.8,-10.2,H+10,GZ-3.4,BED+1)
slot(tray,-16.1,190,-10.2,-3.8,GZ-3.4,BED+1)
slot(tray,-16.1,190,H+3.8,H+10,GZ-3.4,BED+1)
# Vertical mounting bores for two separate screw hold-downs.
for y in [110,190]:
    for yy in [y-14,y+14]:hole(tray,W+13,yy,-1,BED+1)
SX=(W+9)/2; SY=H/2
for yy in [14,H-14]:recess_key(tray,SX,yy)
for xx in [45,W-15]:recess_key(tray,xx,SY,'y')
for row,(ya,yb) in enumerate([(-14,SY),(SY,H+14)]):
    for col,(xa,xb) in enumerate([(-16,SX),(SX,W+25)]):
        o=copy_clip(tray,f'tray_{row+1}{col+1}',(xa,xb,ya,yb,-1,BED+5))
        register(o,note='Print upright. Butt seams; align with underside keys on a flat board. Glue keys after a dry fit.')
bpy.data.objects.remove(tray,do_unlink=True)

# Docks: sliding floor, adjustable side rails and a low adjustable toe stop.
# Screws at the ears sit outside the base channel. Hardware not included in STL.
for index,y in enumerate(STATIONS,1):
    d=box(f'DOCK {index}',-174,42,y-44,y+44,0,FLOOR,grey)
    for x in [-140,-40]:
        for yy in [y-29.5,y+29.5]:hole(d,x,yy,-1,FLOOR+1)
    for yy in [y-29.5,y+29.5]:hole(d,28,yy,-1,FLOOR+1)
    for yy in [y-35,y+35]:recess_key(d,-66,yy,z1=2.4)
    # Fix dock to a flat sacrificial board after aligning the front edge with tray pocket.
    for x in [-156,34]:
        for yy in [y-39,y+39]:hole(d,x,yy,-1,FLOOR+1,r=1.8)
    for n,(xa,xb) in enumerate([(-174,-66),(-66,42)],1):
        p=copy_clip(d,f'dock_{index}_floor_{n}',(xa,xb,y-45,y+45,-1,FLOOR+1))
        register(p,note='Print flat. Align with underside keys. Attach to the same flat board as the tray; hardware setup before seating paper.')
    bpy.data.objects.remove(d,do_unlink=True)
    for side in [-1,1]:
        a=y+side*(GAP/2); b=y+side*(GAP/2+4)
        pieces=[box('lower base side rail',-160,14,min(a,b),max(a,b),FLOOR,FLOOR+7)]
        for x in [-140,-40]:
            aa,bb=sorted([y+side*(GAP/2+1),y+side*36])
            pieces.append(box('rail mounting ear',x-6,x+6,aa,bb,FLOOR,FLOOR+3))
        rail=union('rail',pieces,orange)
        for x in [-140,-40]:
            slot(rail,x-1.8,x+1.8,y+side*29.5-5,y+side*29.5+5,FLOOR-1,FLOOR+4)
        register(rail,f'dock_{index}_rail_{"lower" if side<0 else "upper"}',note='M3 bolts, washers, nuts. Set gap to actual rigid base width plus sliding clearance. Do not guide the moving upper arm.')
    # Nose bar and long slotted ears permit depth tuning; bounds derive from x28 bolt.
    stop=union('toe stop',[
        box('toe contact',TOE,TOE+5,y-GAP/2-4,y+GAP/2+4,FLOOR,FLOOR+6),
        box('stop ear',TOE-8,TOE+13,y-35,y-GAP/2,FLOOR,FLOOR+3),
        box('stop ear',TOE-8,TOE+13,y+GAP/2,y+35,FLOOR,FLOOR+3)],orange)
    for yy in [y-29.5,y+29.5]:slot(stop,TOE-5,TOE+9,yy-1.8,yy+1.8,FLOOR-1,FLOOR+4)
    register(stop,f'dock_{index}_toe_stop',note='Calibrate by actual staples on scrap. Nominal toe offset is an unmeasured placeholder; tune or regenerate.')
    # Loading support: sits on the rails and a 6 mm ledge in the bed, slides left out.
    bridge=union('loading bridge',[
        box('loading surface',-8,47.8,y-43.8,y+43.8,BED-3,BED),
        box('low grip',-27,-6,y-10,y+10,BED-5.2,GZ-3.75),
        box('grip neck',-8,-6,y-10,y+10,BED-5.2,BED-.1),
        box('foot',-8,12,y-GAP/2-3.5,y-GAP/2-.5,FLOOR+7,BED-2.9),
        box('foot',-8,12,y+GAP/2+.5,y+GAP/2+3.5,FLOOR+7,BED-2.9)],teal)
    register(bridge,f'loading_bridge_{index}',flip=False,note='Remove left after clamping the stack, before inserting stapler. Use supports under the loading surface or print on its long side.')

# U frame. Datum fingers contact the glue at LEFT and TOP. Bottom fingers leave
# 0.2 mm freedom to prevent binding; press glue gently top-left before clamping.
# Thick structure stays outside the paper. The whole guide translates toward -X.
g=[box('left spine',-16,-10,-10,H+10,GZ-3.4,GT),
   box('bottom spine',-16,190,-10,-4,GZ-3.4,GT),
   box('top spine',-16,190,H+4,H+10,GZ-3.4,GT),
   box('pull handle',-35,-10,SY-14,SY+14,GZ-3.4,GT)]
for x in [22,90,168]:
    g += [box('bottom finger',x-5,x+5,-10,GY-P['opposite_glue_edge_clearance_mm'],GZ,GT),
          box('top datum finger',x-5,x+5,H-GY,H+10,GZ,GT)]
for y in [95,180]:g.append(box('left datum finger',-16,GX,y-6,y+6,GZ,GT))
guide=union('U GUIDE MASTER',g,teal)
# M3 splice plate holes: entirely outside paper, far from sheet-contact tabs.
for x in [93,107]:
    for y in [-7,H+7]:hole(guide,x,y,GZ-5,GT+1)
for y in [SY-7,SY+7]:hole(guide,-13,y,GZ-5,GT+1)
for row,(ya,yb) in enumerate([(-11,SY),(SY,H+11)]):
    for col,(xa,xb) in enumerate([(-36,100),(100,191)]):
        o=copy_clip(guide,f'glue_guide_{row+1}{col+1}',(xa,xb,ya,yb,GZ-5,GT+1))
        register(o,flip=True,note='Print inverted with finger top surfaces on plate. Glue keyed splice plates outside paper. Insert to right track ends, bias toward top track wall. Deburr paper-contact edges.')
bpy.data.objects.remove(guide,do_unlink=True)
for i,(cx,cy,axis) in enumerate([(100,-7,'x'),(100,H+7,'x'),(-13,SY,'y')],1):
    dx,dy=(12,5) if axis=='x' else (5,12)
    plate=box('splice',cx-dx,cx+dx,cy-dy,cy+dy,GT,GT+3,orange)
    pins=[plate]
    for sign in [-1,1]:pins.append(cyl('splice alignment peg',cx+sign*7*(axis=='x'),cy+sign*7*(axis=='y'),GZ-3.2,GT+.1,1.55))
    plate=union('keyed splice',pins,orange)
    register(plate,f'guide_splice_{i}',flip=True,note='Glue keyed plate across guide joint. Pegs stop 0.2 mm above track floor. Print flat plate face down, pegs upward; no installed guide screws.')

# Two hold-down arms. A standard M4 nut bears against an UNDERSIDE pocket ceiling.
# Print on the side, then mount above the bed with two M3 bolts each.
for i,y in enumerate([110,190],1):
    clamp=union('hold down',[
        box('mount foot',W+5,W+21,y-19,y+19,BED,BED+4),
        box('upright',W+9,W+18,y-7,y+7,BED+3.9,BED+20),
        box('arm',178,W+18,y-7,y+7,BED+14,BED+20)],grey)
    for yy in [y-14,y+14]:hole(clamp,W+13,yy,BED-1,BED+5)
    hole(clamp,187,y,BED+13,BED+21,r=2.2)
    boolean(clamp,cyl('M4 nut pocket',187,y,BED+13,BED+17.5,7.3/math.sqrt(3),vertices=6))
    clamp=register(clamp,f'hold_down_arm_{i}',note='Print on side (export oriented). M4 nut in UNDERSIDE pocket and M4x30 thumbscrew. M3x25 foot bolts; backing board needs hardware relief holes.')
    clamp['print_rotate_x']=90
    pad=box('pressure pad',175,199,y-10,y+10,BED+BOTTOM+FILM+TOP,BED+BOTTOM+FILM+TOP+2,orange)
    hole(pad,187,y,BED+BOTTOM+FILM+TOP+1.3,BED+BOTTOM+FILM+TOP+3,r=2.6)
    register(pad,f'pressure_pad_{i}',note='Loose pad under screw; add smooth protective tape. Tighten only enough to stop sheet movement.')
    screw=reference(cyl('REFERENCE M4 thumbscrew',187,y,BED+2.55,BED+26,2,32)); screw.data.materials.append(metal)
    knob=reference(cyl('REFERENCE thumbscrew head',187,y,BED+24,BED+28,6,32)); knob.data.materials.append(orange)

# Keys supplied as a tray away from the assembly; 8 total: 4 bed + 4 dock.
for i in range(8):
    key=box(f'alignment_key_{i+1}',260+(i%4)*25,279.6+(i%4)*25,40+(i//4)*15,49.6+(i//4)*15,0,2.2,orange)
    register(key,note='Loose underside seam key, 0.2 mm clearance per side. Dry fit then glue; back the completed fixture with a flat board.')

# Scale/fit coupon: small rail clearance gauges, independent of the expensive tray.
for i,gap in enumerate([38.4,38.7,39.1]):
    x=265; y=100+i*35
    q=union('width coupon',[
        box('floor',x,x+gap+8,y,y+22,0,2),
        box('left',x,x+4,y,y+22,1.9,8),
        box('right',x+gap+4,x+gap+8,y,y+22,1.9,8)],orange)
    register(q,f'fit_coupon_gap_{gap:.1f}mm',note='Try on rigid stapler base; choose clearance before printing large components. Channel is across STL X.')

# Reference sheets. The center film is visible in the alignment scene.
bottom=reference(box('REFERENCE bottom sheet 215.9 x 279.4',0,W,0,H,BED,BED+BOTTOM,paper))
film=reference(box('REFERENCE glue film 209.55 x 273.05',GX,W-GX,GY,H-GY,BED+BOTTOM,BED+BOTTOM+FILM,glue))
top=reference(box('REFERENCE top sheet - hidden for alignment view',0,W,0,H,BED+BOTTOM+FILM,BED+BOTTOM+FILM+TOP,blue))
top.hide_render=True; top.hide_set(True)
# Flat backing board provides global station alignment. Hardware must have
# underside clearance: export drilling centers relative to its bottom-left.
relief=[]
for y in STATIONS:
    for x in [-140,-40,28]:
        for yy in [y-29.5,y+29.5]:relief.append((x,yy))
for y in [110,190]:
    for yy in [y-14,y+14]:relief.append((W+13,yy))
(ROOT/'backing_board_hardware_relief.csv').write_text('x_from_board_left_mm,y_from_board_bottom_mm,through_diameter_mm\n'+''.join(f'{x+180:.3f},{y+20:.3f},10\n' for x,y in relief))

# Stapler is a labeled dimensional envelope, never an invented fitted surface.
# Shape is for communication only. Hidden during loading view; shown during stapling.
stapler=[]; y=STATIONS[0]
for o in [box('REFERENCE stapler lower base',TOE-185,TOE,y-19.05,y+19.05,FLOOR,FLOOR+7,black),
          box('REFERENCE stapler anvil',P['staple_center_from_left_mm']-7,P['staple_center_from_left_mm']+7,y-10,y+10,FLOOR+7,BED,metal),
          box('REFERENCE stapler upper arm',TOE-180,TOE-8,y-18,y+18,BED+10,BED+34,black),
          box('REFERENCE stapler hinge',TOE-180,TOE-155,y-16,y+16,FLOOR+5,BED+24,black)]:
    reference(o); o.hide_render=True; o.hide_set(True); stapler.append(o)

# Two reference staple targets; horizontal mark in Y corresponds to crown parallel to edge.
targets=[]
for i,y in enumerate(STATIONS,1):
    t=reference(box(f'REFERENCE staple center {i}',P['staple_center_from_left_mm']-.45,P['staple_center_from_left_mm']+.45,y-6,y+6,BED+.6,BED+.85,orange)); targets.append(t)

def mesh_report(o):
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=0.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(o.data)
    boundary=sum(not e.is_manifold for e in bm.edges)
    volume=bm.calc_volume(signed=True)
    seen=set(); components=0
    for v in bm.verts:
        if v in seen:continue
        components+=1; stack=[v]; seen.add(v)
        while stack:
            a=stack.pop()
            for e in a.link_edges:
                b=e.other_vert(a)
                if b not in seen:seen.add(b);stack.append(b)
    bm.free()
    return {'non_manifold_edges':boundary,'signed_volume_mm3':round(volume,3),'connected_components':components}

def export(o):
    report=mesh_report(o)
    if report['non_manifold_edges'] or report['signed_volume_mm3']<=0 or report['connected_components']!=1:
        raise RuntimeError((o.name,report))
    duplicate=o.copy(); duplicate.data=o.data.copy(); basecol.objects.link(duplicate)
    transform=duplicate.matrix_world.copy()
    rot=Matrix.Identity(4)
    if o.get('print_flip_x'):rot=Matrix.Rotation(math.pi,4,'X')
    if o.get('print_rotate_x'):rot=Matrix.Rotation(math.radians(o['print_rotate_x']),4,'X')
    duplicate.data.transform(rot @ transform); duplicate.matrix_world=Matrix.Identity(4)
    pts=[v.co for v in duplicate.data.vertices]
    lo=Vector(tuple(min(p[k] for p in pts) for k in range(3)))
    hi=Vector(tuple(max(p[k] for p in pts) for k in range(3)))
    duplicate.data.transform(Matrix.Translation(-lo))
    size=hi-lo
    if max(size.x,size.y)>P['maximum_print_footprint_mm']+.01:raise RuntimeError((o.name,'oversized',size))
    active(duplicate)
    dest=OUT/(o.name+'.stl')
    bpy.ops.wm.stl_export(filepath=str(dest),export_selected_objects=True,global_scale=1,use_scene_unit=False,apply_modifiers=True,forward_axis='Y',up_axis='Z')
    manifest.append({'file':dest.name,'print_size_mm':[round(v,3) for v in size],**report,'notes':o.get('notes','')})
    bpy.data.objects.remove(duplicate,do_unlink=True)

for o in parts:export(o)

scene=bpy.context.scene
bpy.context.preferences.filepaths.save_version=0
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=.001; scene.unit_settings.length_unit='MILLIMETERS'
scene['design_status']='PROTOTYPE. Base width ~38.1 mm confirmed; toe offset/anvil height unmeasured.'
scene['source']='Figma 4317:7886, 2550x3300 px mapped to Letter. Staple boxes x25 y468/2646 w78 h231 at300ppi.'
scene['operation']='Bottom -> U guide -> dry glue top-left -> top sheet to top/right -> clamp -> U left -> bridges left -> staple -> release.'
scene['exactness']='Physical print calibration and 100% paper scale required; model geometry alone does not establish repeatability.'
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
shade=scene.display.shading
shade.light='STUDIO';shade.studio_light='paint.sl';shade.color_type='MATERIAL'
shade.show_shadows=True;shade.show_cavity=True;shade.cavity_type='BOTH';shade.curvature_ridge_factor=1.5;shade.curvature_valley_factor=1.2
shade.background_type='WORLD';scene.world.color=(.045,.055,.065)
scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(-420,-500,680))
cam=bpy.context.object;cam.name='Camera - assembly';cam.data.type='ORTHO';cam.data.ortho_scale=620
cam.data.clip_end=10000
target=Vector((35,140,12));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for c in list(cam.users_collection):c.objects.unlink(cam)
labelcol.objects.link(cam)
# Keep spare keys and fit coupons out of the assembly render, but in the .blend.
for o in parts:
    if o.name.startswith(('alignment_key','fit_coupon')):o.hide_render=True;o.hide_set(True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=650
        area.spaces.active.region_3d.view_location=(20,140,0)
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        area.spaces.active.clip_end=10000
        area.spaces.active.shading.color_type='MATERIAL'
active(next(o for o in parts if o.name=='glue_guide_11'))

# Embed reproducible build source and parameters in Blender's Text Editor.
for path in [ROOT/'build_jig.py',ROOT/'parameters.json']:
    t=bpy.data.texts.new(path.name);t.write(path.read_text())
(ROOT/'parts_manifest.json').write_text(json.dumps({'blender':bpy.app.version_string,'status':P['status'],'bed_height_mm':BED,'paper_inset_mm':[GX,GY],'staple_centers_xy_mm':[[P['staple_center_from_left_mm'],y] for y in STATIONS],'parts':manifest},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'SeaRealm_Stapling_Jig_PROTOTYPE.blend'))

if '--no-render' not in sys.argv:
    scene.render.filepath=str(ROOT/'01_alignment_assembly.png');bpy.ops.render.render(write_still=True)
    # Top-down loading view.
    cam.location=(25,140,900);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=490
    scene.render.resolution_x=1600;scene.render.resolution_y=1500
    scene.render.filepath=str(ROOT/'02_top_alignment.png');bpy.ops.render.render(write_still=True)
    # Stapling phase: guide and support bridges removed; top sheet and stapler shown.
    for o in parts:
        if o.name.startswith(('glue_guide','guide_splice','loading_bridge')):o.hide_render=True
    top.hide_render=False
    for o in stapler:o.hide_render=False
    cam.location=(-420,-500,680);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=620
    scene.render.resolution_y=1400
    scene.render.filepath=str(ROOT/'03_stapling_phase.png');bpy.ops.render.render(write_still=True)
print('JIG_COMPLETE',json.dumps({'parts':len(parts),'all_closed_single_component':True,'max_footprint_mm':max(max(p['print_size_mm'][:2]) for p in manifest),'output':str(ROOT)}))
