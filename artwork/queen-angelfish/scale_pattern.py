"""Editable queen-angelfish scale lattice in the photo's 1280 x 853 space.

The caller can clip the returned groups to the body silhouette.  Each scale is
an independent, named SVG path, so it remains individually editable in Figma.
"""

from math import exp, pi, sin


def _interp(x, points):
    for (xa, ya), (xb, yb) in zip(points, points[1:]):
        if xa <= x <= xb:
            return ya + (yb - ya) * (x - xa) / (xb - xa)
    return points[0][1] if x < points[0][0] else points[-1][1]


def build_scales() -> str:
    """Return a dense, staggered gold-and-blue lattice as named SVG groups.

    Coordinates follow the source photograph. The scale field deliberately
    stops before the cheek and narrows at the caudal peduncle. Size increases
    toward the flank, then diminishes at the back, belly and tail.
    """
    top = [(416, 233), (460, 207), (510, 182), (570, 164),
           (640, 155), (710, 160), (775, 186), (826, 222),
           (867, 272), (902, 319), (940, 334)]
    bottom = [(416, 546), (460, 575), (510, 587), (570, 595),
              (640, 600), (710, 595), (775, 574), (826, 544),
              (867, 501), (902, 451), (940, 424)]
    # Gold varies across the flank just as it does in the photograph; both
    # deterministic per-scale variation and a broad light falloff are used.
    golds = ['#DEC24D', '#E2C849', '#D6B83F', '#E8CD56', '#C9AD46',
             '#D8BE5C', '#E9D363', '#C9B14D', '#DECA68']
    muted = ['#8EAF91', '#9EAF74', '#A5B471', '#AAB978', '#B2B970']
    pieces = ['<g id="Scales__editable_gold_centres_and_blue_edges">']
    # 56 curved columns create roughly 1,500 separately addressable scales.
    for column in range(56):
        base_x = 420 + column * 9.28
        ymax, ymin = _interp(base_x, bottom), _interp(base_x, top)
        height = ymax - ymin
        rows = max(9, round(height / 12.1))
        pieces.append(f'<g id="Scales__column_{column + 1:02d}">')
        for row in range(rows):
            t = (row + 0.5 + (column % 2) * 0.48) / rows
            if t > 0.99:
                continue
            # Bow the rows around the round body; taper their width toward
            # both poles. Neighbouring columns fit into the staggered gaps.
            longitude = (base_x - 416) / 524
            x = (base_x + sin(t * pi) * 25.0 * sin(longitude * pi)
                 + sin(t * 2 * pi) * 3.5 * sin(longitude * pi))
            y = ymin + height * t
            # Follow the cheek's curved rear margin; do not leave a ruler-
            # straight stripe of large flank scales beside the eye and gill.
            if x < 420 + 60 * sin(pi * t) ** 1.2:
                continue
            edge = max(0.0, sin(pi * t)) ** 0.55
            flank = exp(-((base_x - 654) / 205) ** 2)
            # A cubic leaf reaches only about 75% of its control-point width.
            # This gives central gold centres about eight pixels of visible
            # width after their blue outline, producing an interlocking mesh.
            w = 1.72 * (3.0 + 4.2 * edge * (0.55 + 0.45 * flank))
            h = 6.2 + 12.5 * edge * (0.70 + 0.30 * flank)
            # Pointed gold centres are tucked inside the blue lattice, with
            # asymmetric curves instead of repeated geometric diamonds.
            tilt = -2.8 - 1.6 * flank + 1.3 * (t - 0.5)
            xt, yt = x - tilt, y - h * 0.5
            xb, yb = x + tilt, y + h * 0.5
            path = (f'M {xt:.2f} {yt:.2f} '
                    f'C {x+w*.52:.2f} {y-h*.25:.2f} '
                    f'{x+w*.54:.2f} {y+h*.24:.2f} {xb:.2f} {yb:.2f} '
                    f'C {x-w*.45:.2f} {y+h*.25:.2f} '
                    f'{x-w*.51:.2f} {y-h*.23:.2f} {xt:.2f} {yt:.2f} Z')
            variation = (column * 13 + row * 7 + column * row) % len(golds)
            fill = golds[variation]
            # Dorsal scales are smaller and cooler, and the belly lies in shade.
            if t < 0.17 or t > 0.85:
                fill = muted[(column * 3 + row) % len(muted)]
            elif base_x > 884:
                fill = ['#DCCA48', '#E2CC43', '#CCB845'][(column+row) % 3]
            stroke = '#197EC0' if t < 0.54 else '#28769D'
            width = 0.75 + 0.35 * edge
            opacity = 0.72 + 0.26 * edge
            pieces.append(
                f'<path id="Scale__c{column+1:02d}_r{row+1:02d}" '
                f'd="{path}" fill="{fill}" stroke="{stroke}" '
                f'stroke-width="{width:.2f}" opacity="{opacity:.2f}" '
                'stroke-linejoin="round"/>')
        pieces.append('</g>')
    pieces.append('</g>')
    return '\n'.join(pieces)


if __name__ == '__main__':
    import pathlib
    output = pathlib.Path(__file__).with_name('scale-detail.svg')
    output.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="853" '
        'viewBox="0 0 1280 853">\n' + build_scales() + '\n</svg>',
        encoding='utf-8')
    print(output)
