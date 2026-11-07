import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'stl_prototype');
const output = path.join(root, 'Printable_Components');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'parts_manifest.json'), 'utf8'));
const mapping = [
  ['fit_coupon_', '00_Print_First_Fit_Gauges'],
  ['tray_', '01_Paper_Tray_4_Pieces'],
  ['dock_', '02_Stapler_Docks_10_Pieces'],
  ['loading_bridge_', '03_Loading_Supports_2_Pieces'],
  ['glue_guide_', '04_Glue_Alignment_Guide_4_Pieces'],
  ['guide_splice_', '05_Guide_Connectors_3_Pieces'],
  ['hold_down_arm_', '06_Clamps_and_Pads_4_Pieces'],
  ['pressure_pad_', '06_Clamps_and_Pads_4_Pieces'],
  ['alignment_key_', '07_Base_Alignment_Keys_8_Pieces'],
];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const inventory = [];
for (const part of manifest.parts) {
  const category = mapping.find(([prefix]) => part.file.startsWith(prefix))?.[1];
  if (!category) throw new Error(`Unclassified part: ${part.file}`);
  const bytes = await fs.readFile(path.join(source, part.file));
  const triangles = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + triangles * 50) throw new Error(`Invalid binary STL: ${part.file}`);
  const low = [Infinity,Infinity,Infinity], high = [-Infinity,-Infinity,-Infinity];
  for (let face = 0; face < triangles; face++) {
    for (let vertex = 0; vertex < 3; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = bytes.readFloatLE(84 + face*50 + 12 + vertex*12 + axis*4);
        if (!Number.isFinite(value)) throw new Error(`Nonfinite vertex: ${part.file}`);
        low[axis] = Math.min(low[axis], value); high[axis] = Math.max(high[axis], value);
      }
    }
  }
  const dimensions = high.map((v,i) => v-low[i]);
  if (Math.abs(low[2]) > 0.01 || dimensions.some((v,i) => Math.abs(v-part.print_size_mm[i]) > 0.01))
    throw new Error(`Size or bed placement mismatch: ${part.file}`);
  const dir = path.join(output, category);
  await fs.mkdir(dir, {recursive:true});
  const target = path.join(dir, part.file);
  await fs.writeFile(target, bytes);
  if (sha(await fs.readFile(target)) !== sha(bytes)) throw new Error(`Copy mismatch: ${part.file}`);
  const notes = part.file.startsWith('hold_down_arm_')
    ? 'SUPPORTS REQUIRED as exported: the side-oriented arm extends above the build plate beyond its mounting foot. ' + part.notes
    : part.notes;
  inventory.push({folder:category, file:part.file, quantity:1,
    purpose:part.file.startsWith('fit_coupon_')?'Optional fit test':'Assembly part',
    size_mm:part.print_size_mm, notes, sha256:sha(bytes), triangles});
}
const csv = value => '"'+String(value).replaceAll('"','""')+'"';
const rows = inventory.map(p=>[p.folder,p.file,p.quantity,p.purpose,...p.size_mm,p.notes].map(csv).join(','));
await fs.writeFile(path.join(output,'PRINT_LIST.csv'),
  '\uFEFFFolder,File,Quantity,Purpose,Width_mm,Depth_mm,Height_mm,Orientation_and_notes\r\n'+rows.join('\r\n')+'\r\n');
await fs.writeFile(path.join(output,'PACKAGE_CHECKS.json'),JSON.stringify({
  status:manifest.status, assembly_pieces:inventory.filter(x=>x.purpose==='Assembly part').length,
  optional_gauges:inventory.filter(x=>x.purpose==='Optional fit test').length,
  validation:'Copied STLs match original SHA-256, binary triangle counts, manifest dimensions, and Z=0 placement.',
  parts:inventory
},null,2));
await fs.writeFile(path.join(output,'READ_FIRST.txt'),`SEA REALM STAPLING JIG — PRINTABLE COMPONENTS

35 assembly pieces + 3 optional fit-test gauges. Each named STL is one physical
piece: print ONE of every file in folders 01–07. Repeated parts already have
separate numbered files; do not multiply their quantities again.

Folder 00: three optional stapler-width gauges. Try these before the full kit.
Folder 01: four paper-tray tiles.
Folder 02: two complete stapler docks; each has two floors, two rails and a stop.
Folder 03: two removable loading supports.
Folder 04: four sections of the U-shaped glue-sheet alignment guide.
Folder 05: three keyed connectors for that guide.
Folder 06: two hold-down arms and two pressure pads.
Folder 07: eight underside alignment keys (four for tray, four for dock floors).

IMPORT / SCALE
Import the individual STL files into Bambu Studio or your print service's slicer
as SEPARATE OBJECTS, not as one multipart object.
Units are MILLIMETERS. Keep scale at 100%. They are separate objects, already
exported with their minimum Z at the build plate. Arrange only as many as fit
your selected printer; this is not one combined print plate.
The largest individual footprint dimension is 174 mm. The largest tray tile
is 128.45 x 153.7 mm. Allow space for your printer's brim and exclusion zones.

ORIENTATION / SUPPORTS
- Tray, docks, rails, stops, pads, keys, and gauges: preserve exported orientation.
- Guide sections: already inverted with thin finger surfaces down. Do not flip
  them again based on the assembled Blender view.
- Guide connectors: already flat face down with pegs up.
- Clamp arms: already turned onto their sides and NEED SUPPORTS beneath the
  elevated arms beyond their mounting feet. Inspect nut pockets/overhangs too.
- Loading supports: exported upright and NEED SUPPORTS under the broad surface,
  or deliberate reorientation by the person slicing them.
- Review all slicer previews before printing, especially 0.6 mm guide fingers
  and underside recesses. Initial layer height: 0.2 mm (three finger layers).
PRINT_LIST.csv includes the size and notes for every file.

PROTOTYPE FIT STILL TO CONFIRM
Stapler width is approximately 38.1 mm. Toe-to-staple distance (18 mm default)
and anvil height (12 mm default) are UNMEASURED. Physical media thickness and
the printer's dimensional accuracy are also unverified. Print the small width
gauges first; confirm the two missing measurements before printing the full kit.
This package contains the existing prototype geometry without design changes.

ASSEMBLY / EXTRA MATERIALS
See ASSEMBLY_INSTRUCTIONS.txt for hardware, board attachment and calibration.
You also need a flat backing board, M3 mounting hardware, two M4 nuts and two
M4 thumbscrews, plus suitable adhesive. Hardware is not represented by the STLs.
The backing-board CSV identifies underside hardware relief holes.
The fixture is for room-temperature assembly; remove the stack before heating.

GLUE COVERAGE
The centered 8.25 x 10.75 inch glue sheet covers the nominal Figma card area.
The Epson print route applies borderless enlargement, so verify that the
outermost FINISHED CUT edges on actual paper remain at least 3.175 mm inside
the page edges before assuming full adhesive coverage.

PREVIEWS
Preview_alignment.png shows the top sheet hidden so the glue guide is visible.
Preview_stapling.png shows the guide/supports withdrawn and the stapler envelope.
Paper, glue film, screws, and the illustrated stapler are reference objects only.
`);
for (const [from,to] of [
  ['START_HERE.txt','ASSEMBLY_INSTRUCTIONS.txt'],
  ['backing_board_hardware_relief.csv','backing_board_hardware_relief.csv'],
  ['01_alignment_assembly.png','Preview_alignment.png'],
  ['03_stapling_phase.png','Preview_stapling.png'],
]) await fs.copyFile(path.join(root,from),path.join(output,to));
console.log(JSON.stringify({folder:output,assembly_pieces:35,optional_gauges:3,
  checked_files:inventory.length,all_copies_match:true,max_footprint_mm:Math.max(...inventory.flatMap(p=>p.size_mm.slice(0,2)))}));
