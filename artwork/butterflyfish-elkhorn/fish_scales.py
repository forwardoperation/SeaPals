"""Editable, hand-directed pearl scale field for the supplied butterflyfish.

Coordinates match the 1280 x 853 reference. No embedded raster content is used.
Call scale_defs() inside the SVG defs and build_scales() in the body stack.
"""

from math import sin, cos, exp, pi
from random import Random


SCALE_ENVELOPE = (
    "M 321 281 C 329 252 351 230 366 213 C 372 187 392 169 420 169 "
    "C 455 169 506 190 553 222 C 603 256 639 302 657 350 "
    "C 660 390 658 428 658 451 C 647 465 637 480 632 499 "
    "C 627 526 633 552 648 563 L 621 589 C 586 600 555 597 518 586 "
    "C 471 572 418 564 381 552 C 335 537 302 514 282 485 "
    "C 265 455 267 425 280 393 C 291 363 304 326 321 281 Z"
)


def scale_defs():
    return f'''<clipPath id="bf-scale-envelope"><path d="{SCALE_ENVELOPE}"/></clipPath>
<linearGradient id="bf-pearl-scale-a" x1="10%" y1="5%" x2="88%" y2="94%">
  <stop offset="0" stop-color="#FAF5E9" stop-opacity="0.82"/>
  <stop offset="0.38" stop-color="#DADEE1" stop-opacity="0.68"/>
  <stop offset="0.71" stop-color="#C1D0D7" stop-opacity="0.54"/>
  <stop offset="1" stop-color="#819FAC" stop-opacity="0.57"/>
</linearGradient>
<linearGradient id="bf-pearl-scale-b" x1="6%" y1="7%" x2="92%" y2="95%">
  <stop offset="0" stop-color="#F8ECD7" stop-opacity="0.73"/>
  <stop offset="0.4" stop-color="#DFDCDC" stop-opacity="0.65"/>
  <stop offset="0.74" stop-color="#CAD1D6" stop-opacity="0.54"/>
  <stop offset="1" stop-color="#9BAABD" stop-opacity="0.59"/>
</linearGradient>
<linearGradient id="bf-pearl-scale-c" x1="7%" y1="5%" x2="90%" y2="97%">
  <stop offset="0" stop-color="#EBF0E8" stop-opacity="0.73"/>
  <stop offset="0.42" stop-color="#C5D2D9" stop-opacity="0.58"/>
  <stop offset="0.79" stop-color="#AEC3D0" stop-opacity="0.49"/>
  <stop offset="1" stop-color="#86A3B1" stop-opacity="0.58"/>
</linearGradient>'''


# Simple sampling boundary, intentionally larger than the precise curved clip.
_ENVELOPE_POLYGON = [
    (321, 281), (340, 243), (366, 213), (383, 182), (420, 167),
    (474, 184), (523, 207), (553, 222), (594, 256), (629, 299),
    (657, 350), (659, 407), (658, 451), (640, 478), (632, 499),
    (634, 538), (648, 563), (621, 590), (582, 599), (545, 594),
    (518, 586), (460, 571), (417, 563), (381, 552), (331, 529),
    (302, 511), (282, 485), (269, 454), (270, 423), (280, 393),
    (300, 334)
]


def _inside(x, y):
    inside = False
    j = len(_ENVELOPE_POLYGON) - 1
    for i, (xi, yi) in enumerate(_ENVELOPE_POLYGON):
        xj, yj = _ENVELOPE_POLYGON[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:
            inside = not inside
        j = i
    return inside


def _cell(x, y, w, h, angle, variation):
    """Overlapping ovoid diamond with a broad, subtly asymmetrical rear lip."""
    c, s = cos(angle), sin(angle)
    def point(u, v):
        return f"{x+u*w*c-v*h*s:.2f} {y+u*w*s+v*h*c:.2f}"
    v = variation
    return (
        f"M {point(-0.03, -0.51)} "
        f"C {point(0.21, -0.41)} {point(0.49, -0.12)} {point(0.47, 0.10)} "
        f"C {point(0.43, 0.30)} {point(0.17, 0.48)} {point(-0.08, 0.52)} "
        f"C {point(-0.33, 0.34)} {point(-0.51, 0.13)} {point(-0.45, -0.08)} "
        f"C {point(-0.36, -0.26)} {point(-0.19+v, -0.44)} {point(-0.03, -0.51)} Z"
    )


def build_scales():
    """Return a group containing individually named scales in curved columns."""
    rng = Random(7314)
    pieces = ['<g id="Scales_Pearl_Overlapping_Cells" clip-path="url(#bf-scale-envelope)">']
    scale_number = 0
    column = 0
    x = 267.0
    while x < 665:
        # Large shoulder scales soften into finer cheek scales near the eye.
        face_taper = 1.0 - 0.48 * max(0, min(1, (x-515)/150))
        rear_taper = 0.82 + 0.18 * max(0, min(1, (x-277)/110))
        width = 12.0 * face_taper * rear_taper
        y = 163.0 + (column % 2) * 5.7
        row = 0
        while y < 608:
            edge_taper = 0.65 + 0.35 * exp(-((y-366)/176)**4)
            height = 17.5 * face_taper * edge_taper
            # Column arcs follow the body; staggering is stable with gentle jitter.
            bow = 10.0 * sin((y-163)/445*pi) * sin((x-268)/397*pi)
            xx = x + bow + rng.uniform(-0.65, 0.65)
            yy = y + 2.2*sin((x-280)*0.012) + rng.uniform(-0.75, 0.75)
            if _inside(xx, yy):
                scale_number += 1
                w = width * rng.uniform(0.93, 1.07)
                h = height * rng.uniform(0.94, 1.07)
                angle = 0.25 + 0.13*((x-430)/230) + rng.uniform(-0.045, 0.045)
                shade = rng.choices(('a', 'b', 'c'), (0.59, 0.22, 0.19))[0]
                # Faint around margins; individual scales catch stronger central light.
                op = (0.50 + 0.33 * exp(-((xx-455)/170)**4-((yy-347)/202)**4))
                op *= rng.uniform(0.84, 1.0)
                d = _cell(xx, yy, w, h, angle, rng.uniform(-0.04, 0.04))
                pieces.append(
                    f'<path id="Pearl_Scale_{scale_number:04d}_C{column:02d}_R{row:02d}" '
                    f'd="{d}" fill="url(#bf-pearl-scale-{shade})" '
                    f'stroke="#7897A8" stroke-opacity="0.22" stroke-width="0.38" '
                    f'opacity="{op:.3f}"/>'
                )
            y += height * 0.67
            row += 1
        x += width * 0.71
        column += 1
    pieces.append('</g>')
    return '\n'.join(pieces)


if __name__ == '__main__':
    scales = build_scales()
    print(f"{scales.count('<path ')} individual editable scale paths")
