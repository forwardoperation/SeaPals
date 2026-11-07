"""Rebuild the editable, all-vector octopus skin from the supplied Figma reference.

Uses the existing curved body silhouette and reference colors. No raster data is
embedded in the delivered SVG. Color contours retain papillae and fold direction.
"""
from pathlib import Path
import sys, re, json, time
import xml.etree.ElementTree as ET
from collections import defaultdict

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tmp' / 'figma-vector-deps'))
import cv2
import numpy as np
import vtracer
from PIL import Image

W, H = 1164, 902
SETTINGS = dict(colormode='color', hierarchical='stacked', mode='spline',
    filter_speckle=1, color_precision=8, layer_difference=5,
    corner_threshold=75, length_threshold=3, max_iterations=10,
    splice_threshold=45, path_precision=2)

def main():
    started=time.monotonic()
    photo=np.array(Image.open(ROOT/'reference-canvas.png').convert('RGB'))
    # SVG export bounds begin at x=303.006, y=123.026 in the source canvas.
    crop=photo[123:123+H,303:303+W].copy()
    mask=np.array(Image.open(ROOT/'silhouette-mask.png').convert('RGBA'))[:,:,3]
    # Remove only the red tracing guide visible in the reference screenshot.
    red=((crop[:,:,0]>85)&(crop[:,:,0]>crop[:,:,1]*2.5)&(crop[:,:,0]>crop[:,:,2]*2.5)).astype(np.uint8)*255
    red=cv2.dilate(red,np.ones((3,3),np.uint8))
    crop=cv2.inpaint(crop,red,3,cv2.INPAINT_TELEA)
    crop=cv2.bilateralFilter(crop,3,6,1)
    # Transparent outside the original silhouette; preserve the skin's lit ridges.
    trace=np.dstack([crop,mask])
    Image.fromarray(trace).save(ROOT/'trace-input.png')
    # Trace at double resolution so the smallest curved skin boundaries stay soft.
    Image.open(ROOT/'trace-input.png').resize((W*2,H*2),Image.Resampling.BICUBIC).save(ROOT/'trace-smooth-input.png')
    smooth=dict(SETTINGS,filter_speckle=4,color_precision=8,layer_difference=5,corner_threshold=100)
    vtracer.convert_image_to_svg_py(str(ROOT/'trace-smooth-input.png'),str(ROOT/'skin-unified-trace.svg'),**smooth)
    paths=list(ET.parse(ROOT/'skin-unified-trace.svg').getroot())
    print(json.dumps({'trace_paths':len(paths),'seconds':round(time.monotonic()-started,2)}),flush=True)

if __name__=='__main__': main()
