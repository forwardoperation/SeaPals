"""Rebuild the water-only SVG from the cleaned reference using VTracer 0.6.15.

Run from the SeaPals root after installing vtracer into tmp/underwater-svg-tools.
No bitmap data or external dependencies are embedded in the output SVG.
"""
from pathlib import Path
import json
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tmp' / 'underwater-svg-tools'))
import vtracer

SETTINGS = dict(
    colormode='color',
    hierarchical='stacked',
    mode='spline',
    filter_speckle=1,
    color_precision=8,
    layer_difference=4,
    corner_threshold=60,
    length_threshold=3.5,
    max_iterations=10,
    splice_threshold=45,
    path_precision=2,
)

def main():
    output = ROOT / 'underwater-background.svg'
    started = time.monotonic()
    vtracer.convert_image_to_svg_py(str(ROOT / 'water-cleaned.png'), str(output), **SETTINGS)
    svg = output.read_text(encoding='utf-8')
    # Preserve all generated contours, while adding a scalable canvas and metadata.
    svg = svg.replace('<svg ', '<svg viewBox="0 0 1536 1024" role="img" aria-labelledby="water-title water-description" ', 1)
    root_end = svg.index('>', svg.index('<svg ')) + 1
    svg = svg[:root_end] + '\n<title id="water-title">Sunlit underwater surface</title>\n<desc id="water-description">Detailed vector reconstruction of the blue underwater background from Sea Realm Production, Hammerhead_2. Shark removed and occluded water reconstructed using image generation. Curved cyan surface ripples, white reflections and descending sunlight fading into deep blue. All visible artwork consists of editable filled vector paths; no embedded raster images.</desc>\n<g id="water-reflections-and-light">' + svg[root_end:]
    svg = svg.replace('</svg>', '</g>\n</svg>')
    output.write_text(svg, encoding='utf-8')
    tree = ET.fromstring(svg)
    ns = {'s': 'http://www.w3.org/2000/svg'}
    paths = tree.findall('.//s:path', ns)
    assert paths and not tree.findall('.//s:image', ns)
    assert not tree.findall('.//s:script', ns)
    assert 'data:image' not in svg and 'href=' not in svg
    report = dict(width=1536, height=1024, viewBox=tree.attrib['viewBox'],
                  paths=len(paths), bytes=output.stat().st_size,
                  embedded_images=0, external_references=0, settings=SETTINGS,
                  elapsed_seconds=round(time.monotonic()-started, 2))
    (ROOT / 'vector-report.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
