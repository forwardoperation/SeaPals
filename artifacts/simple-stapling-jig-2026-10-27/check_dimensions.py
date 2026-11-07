import bpy, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
d=json.loads((root/'dimensions.json').read_text())
o=next(o for o in bpy.data.objects if o.type=='MESH')
def hit(p,v):
    ok,co,normal,index=o.ray_cast(Vector(p),Vector(v))
    assert ok,(p,v)
    return co
def near(a,b):assert abs(a-b)<.001,(a,b)
bed=hit((100,130,50),(0,0,-1)).z;near(bed,12.7)
x0=hit((100,10,13.7),(-1,0,0)).x;x1=hit((100,10,13.7),(1,0,0)).x
y0=hit((15,130,13.7),(0,-1,0)).y;y1=hit((15,130,13.7),(0,1,0)).y
near(x1-x0,216.4);near(y1-y0,279.9)
notches=[]
for y in [279.9-49.403,279.9-233.807]:
    for side in ['left','right']:
        x=5 if side=='left' else 210
        assert not o.ray_cast(Vector((x,y,50)),Vector((0,0,-1)))[0]
        ya=hit((x,y,3),(0,-1,0)).y;yb=hit((x,y,3),(0,1,0)).y
        near(yb-ya,38.7)
        if side=='left':
            stop=hit((-5,y,3),(1,0,0)).x;depth=stop-.5
            near(depth,15.875+64*25.4/300)
        else:
            stop=hit((225,y,3),(-1,0,0)).x;depth=216.4-stop
            near(depth,15.875+74*25.4/300)
        notches.append({'side':side,'center_y':y,'clear_width_mm':yb-ya,'stop_depth_past_nominal_paper_mm':depth})
for x,y in [(-1.6,10),(-1.6,269.9),(218,10),(218,269.9),(15,-1.6),(201.4,-1.6),(15,281.5),(201.4,281.5)]:
    near(hit((x,y,50),(0,0,-1)).z,15.7)
result={'passed':True,'measured_mesh_pocket_mm':[x1-x0,y1-y0],'measured_mesh_bed_height_mm':bed,'notches':notches,'corner_rails_checked':8}
(root/'dimension_validation.json').write_text(json.dumps(result,indent=2))
print('DIMENSIONS_VALIDATED',json.dumps(result))
