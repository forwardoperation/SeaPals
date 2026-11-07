"""Rebuild the Sunfish open-water background using Python's standard library.

Run from any working directory: python path/to/generate_background.py
The deterministic SVG has 19 painted paths, no raster images, SVG filters,
animation, clipping masks, or external dependencies. Fine details are batched.
Metrics are printed as JSON for inclusion in the parent artwork report.
"""

from pathlib import Path
import gzip
import json
import math
import random
import xml.etree.ElementTree as ET


OUT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1024, 1536
RNG = random.Random(42598746)
SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" '
    'viewBox="0 0 1024 1536" fill="none">',
    '<title>Sunfish — open blue water</title>',
    '<desc>Light glances off the underside of the sea near a diffuse sun at '
    'upper right. Azure water falls away into navy blue. All visible marks are '
    'static editable vector paths, without raster imagery or rendering filters.</desc>',
    """<defs>
<linearGradient id="water" x1="460" y1="0" x2="600" y2="1536" gradientUnits="userSpaceOnUse">
<stop stop-color="#057FAB"/><stop offset=".17" stop-color="#087CA7"/>
<stop offset=".41" stop-color="#076391"/><stop offset=".69" stop-color="#003B63"/>
<stop offset="1" stop-color="#00213D"/></linearGradient>
<radialGradient id="depth" cx="0" cy="0" r="1" gradientTransform="translate(-230 830) rotate(-11) scale(1180 1280)" gradientUnits="userSpaceOnUse">
<stop stop-color="#001C4B" stop-opacity=".49"/><stop offset=".52" stop-color="#002957" stop-opacity=".18"/>
<stop offset="1" stop-color="#002957" stop-opacity="0"/></radialGradient>
<radialGradient id="blueVolume" cx="0" cy="0" r="1" gradientTransform="translate(826 343) rotate(101) scale(790 520)" gradientUnits="userSpaceOnUse">
<stop stop-color="#00ADE0" stop-opacity=".31"/><stop offset=".43" stop-color="#0F96CD" stop-opacity=".17"/>
<stop offset="1" stop-color="#0F96CD" stop-opacity="0"/></radialGradient>
<radialGradient id="surfaceGlow" cx="0" cy="0" r="1" gradientTransform="translate(816 -25) rotate(99) scale(435 660)" gradientUnits="userSpaceOnUse">
<stop stop-color="#D0F8EC" stop-opacity=".77"/><stop offset=".19" stop-color="#85E8E7" stop-opacity=".48"/>
<stop offset=".49" stop-color="#38CDD9" stop-opacity=".21"/><stop offset="1" stop-color="#38CDD9" stop-opacity="0"/></radialGradient>
<radialGradient id="sunBloom" cx="0" cy="0" r="1" gradientTransform="translate(803 12) rotate(92) scale(161 224)" gradientUnits="userSpaceOnUse">
<stop stop-color="#F4FFF0" stop-opacity=".76"/><stop offset=".23" stop-color="#E7FFE9" stop-opacity=".47"/>
<stop offset=".56" stop-color="#AEF6E5" stop-opacity=".14"/><stop offset="1" stop-color="#AEF6E5" stop-opacity="0"/></radialGradient>
<radialGradient id="ray1" cx="0" cy="0" r="1" gradientTransform="translate(629 225) rotate(126) scale(695 42)" gradientUnits="userSpaceOnUse">
<stop stop-color="#A1E3E0" stop-opacity=".14"/><stop offset=".28" stop-color="#85D9DE" stop-opacity=".085"/><stop offset="1" stop-color="#72CEDC" stop-opacity="0"/></radialGradient>
<radialGradient id="ray2" cx="0" cy="0" r="1" gradientTransform="translate(676 348) rotate(112) scale(952 52)" gradientUnits="userSpaceOnUse">
<stop stop-color="#9ADFE0" stop-opacity=".105"/><stop offset=".35" stop-color="#85D9DE" stop-opacity=".057"/><stop offset="1" stop-color="#72CEDC" stop-opacity="0"/></radialGradient>
<radialGradient id="ray3" cx="0" cy="0" r="1" gradientTransform="translate(789 303) rotate(94) scale(822 34)" gradientUnits="userSpaceOnUse">
<stop stop-color="#A1E3E0" stop-opacity=".12"/><stop offset=".31" stop-color="#85D9DE" stop-opacity=".061"/><stop offset="1" stop-color="#72CEDC" stop-opacity="0"/></radialGradient>
<radialGradient id="ray4" cx="0" cy="0" r="1" gradientTransform="translate(919 282) rotate(69) scale(735 44)" gradientUnits="userSpaceOnUse">
<stop stop-color="#9ADFE0" stop-opacity=".08"/><stop offset=".31" stop-color="#85D9DE" stop-opacity=".044"/><stop offset="1" stop-color="#72CEDC" stop-opacity="0"/></radialGradient>
<radialGradient id="ray5" cx="0" cy="0" r="1" gradientTransform="translate(502 304) rotate(138) scale(626 23)" gradientUnits="userSpaceOnUse">
<stop stop-color="#A1E3E0" stop-opacity=".09"/><stop offset=".3" stop-color="#85D9DE" stop-opacity=".05"/><stop offset="1" stop-color="#72CEDC" stop-opacity="0"/></radialGradient>
<linearGradient id="rayFine" x1="818" y1="0" x2="516" y2="963" gradientUnits="userSpaceOnUse">
<stop stop-color="#D2F8E7" stop-opacity=".105"/><stop offset=".27" stop-color="#AFEDE5" stop-opacity=".047"/>
<stop offset=".82" stop-color="#7CD7E0" stop-opacity="0"/></linearGradient>
<linearGradient id="surfaceShade" x1="512" y1="0" x2="512" y2="370" gradientUnits="userSpaceOnUse">
<stop stop-color="#004A74" stop-opacity=".31"/><stop offset=".38" stop-color="#005E8B" stop-opacity=".19"/>
<stop offset="1" stop-color="#005E8B" stop-opacity="0"/></linearGradient>
<linearGradient id="surfaceCyan" x1="512" y1="0" x2="512" y2="483" gradientUnits="userSpaceOnUse">
<stop stop-color="#5DE5E3" stop-opacity=".43"/><stop offset=".28" stop-color="#63DFE2" stop-opacity=".26"/>
<stop offset=".67" stop-color="#68D9DF" stop-opacity=".08"/><stop offset="1" stop-color="#68D9DF" stop-opacity="0"/></linearGradient>
<linearGradient id="surfacePale" x1="512" y1="-20" x2="512" y2="430" gradientUnits="userSpaceOnUse">
<stop stop-color="#BCF9E9" stop-opacity=".64"/><stop offset=".25" stop-color="#A8F1E6" stop-opacity=".41"/>
<stop offset=".63" stop-color="#95E8E4" stop-opacity=".13"/><stop offset="1" stop-color="#95E8E4" stop-opacity="0"/></linearGradient>
<linearGradient id="surfaceBright" x1="512" y1="-20" x2="512" y2="370" gradientUnits="userSpaceOnUse">
<stop stop-color="#F0FFEA" stop-opacity=".83"/><stop offset=".25" stop-color="#D8FFE9" stop-opacity=".51"/>
<stop offset=".67" stop-color="#BCF5E7" stop-opacity=".10"/><stop offset="1" stop-color="#BCF5E7" stop-opacity="0"/></linearGradient>
<linearGradient id="particleNear" x1="300" y1="300" x2="700" y2="1536" gradientUnits="userSpaceOnUse">
<stop stop-color="#B0E4E5" stop-opacity=".22"/><stop offset=".49" stop-color="#8CBBC8" stop-opacity=".13"/>
<stop offset="1" stop-color="#719AAC" stop-opacity=".06"/></linearGradient>
<linearGradient id="particleFar" x1="600" y1="200" x2="400" y2="1536" gradientUnits="userSpaceOnUse">
<stop stop-color="#B1E6E6" stop-opacity=".11"/><stop offset=".53" stop-color="#88BDCE" stop-opacity=".065"/>
<stop offset="1" stop-color="#719AAC" stop-opacity=".03"/></linearGradient>
</defs>""",
]


def n(value):
    return f"{value:.1f}".rstrip("0").rstrip(".")


def p(x, y):
    return f"{n(x)} {n(y)}"


def path(name, commands, paint, opacity=None):
    alpha = "" if opacity is None else f' opacity="{opacity}"'
    SVG.append(f'<path id="{name}" d="{commands}" fill="{paint}"{alpha}/>')


def field(name, paint):
    path(name, "M0 0H1024V1536H0Z", paint)


def ripple(x, y, width, height, bend, tilt):
    """One broken, asymmetrical tapered reflection with organically curved edges."""
    # Eight independently varied points keep neighboring marks from repeating a
    # "fish-shaped" motif. Quadratics through their midpoints round the contours.
    points = []
    for index in range(8):
        angle = index * math.tau / 8 + RNG.uniform(-.10, .10)
        radius = RNG.uniform(.64, 1.18)
        u = math.cos(angle) * width * .5 * radius
        v = math.sin(angle) * height * radius
        points.append((x + u, y + v + u * tilt + bend * math.sin(angle*2)))
    mids = [
        ((points[i][0]+points[(i+1)%8][0])*.5,
         (points[i][1]+points[(i+1)%8][1])*.5)
        for i in range(8)
    ]
    return (
        f"M{p(*mids[-1])}"
        + "".join(f"Q{p(*points[i])} {p(*mids[i])}" for i in range(8))
        + "Z"
    )


field("Open-water-depth", "url(#water)")
field("Cool-shadow-left", "url(#depth)")
field("Azure-light-volume", "url(#blueVolume)")
field("Broad-surface-illumination", "url(#surfaceGlow)")

# Five radial light volumes share an implied origin, with transparent edges and
# ends. The gradients soften the beams without SVG blur or any clipping masks.
for index in range(5):
    field(f"Sun-ray-{index+1}", f"url(#ray{index+1})")
path(
    "Fine-refracted-rays",
    "M790-15L797-15L322 1017L296 1017Z"
    "M824-15L830-15L737 968L714 968Z"
    "M846-15L852-15L1028 805L1003 805Z",
    "url(#rayFine)", .28,
)

# Only four painted paths hold all reflection marks. Their placement is
# clustered and irregular; the fragments grow larger toward the foreground.
marks = [[] for _ in range(4)]
for index in range(310):
    # Dense overhead texture, a few longer fragments tapering into distance.
    y = RNG.triangular(-22, 329, -20)
    if y > 250 and RNG.random() < 0.35:
        continue
    x = RNG.uniform(-65, 1090)
    distance = max(0.0, y) / 360
    width = RNG.uniform(9, 55) * (0.72 + distance * 1.43)
    height = RNG.uniform(2.4, 8.5) * (0.65 + distance * 0.72)
    bend = RNG.uniform(-height * .6, height * .6)
    tilt = ((x - 803) / 1024) * .12 + RNG.uniform(-.16, .16)
    near_sun = max(0, 1 - abs(x - 803) / 550)
    tone = RNG.choices([0, 1, 2, 3], [2, 4, 2 + near_sun*2, near_sun*2 + .25])[0]
    # Broken dark pockets and cyan glints remain most common. White fragments
    # concentrate around the reflected sun instead of uniformly covering water.
    marks[tone].append(ripple(x, y, width, height, bend, tilt))

# A few scattered wisps hang below the surface; no stripes across the canvas.
for x, y, width, height in [
    (92, 301, 39, 4), (255, 342, 58, 4), (610, 290, 47, 5),
    (896, 317, 56, 5), (412, 389, 27, 3), (784, 364, 43, 4),
    (107, 421, 25, 3), (957, 448, 22, 2), (552, 463, 18, 2),
]:
    marks[1].append(ripple(x, y, width, height, height*.25, -.04))

for index, paint in enumerate(
    ["surfaceShade", "surfaceCyan", "surfacePale", "surfaceBright"]
):
    path(f"Surface-reflection-{index+1}", "".join(marks[index]), f"url(#{paint})")

# A soft diffuse center integrates the fragments with the sun without a circle
# edge, expensive blur, or raster texture.
field("Diffuse-sun", "url(#sunBloom)")

# Three large, faint curved surface folds add broad water movement underneath
# the finer reflections. They are one compound path, not horizontal strips.
path(
    "Surface-water-folds",
    "M-41 114C92 76 194 134 305 108C412 83 462 65 537 86"
    "C445 79 407 112 308 132C188 157 80 105-41 142Z"
    "M355 207C437 161 507 180 582 158C691 126 771 139 838 107"
    "C775 155 704 145 591 182C505 210 455 181 355 223Z"
    "M693 262C786 204 862 222 931 194C981 174 1029 180 1061 168"
    "L1061 179C1013 194 994 186 941 210C855 247 790 223 693 274Z",
    "url(#surfaceCyan)",
    .12,
)

# Add subtle little accents on the strongest light fragments; all in one path.
accents = []
for index in range(21):
    x = RNG.uniform(582, 1002)
    y = RNG.uniform(-7, 115)
    width = RNG.uniform(4.4, 17.0)
    accents.append(ripple(x, y, width, RNG.uniform(1.0, 2.8), 0.3, -.04))
path("Fine-light-flecks", "".join(accents), "url(#surfaceBright)", .6)

# Suspended water particles, deliberately sparse, are batched into two paths.
particles = [[], []]
for index in range(68):
    x = RNG.uniform(15, 1009)
    y = RNG.uniform(260, 1515)
    radius = RNG.uniform(.4, 1.15) if index % 2 else RNG.uniform(.55, 1.75)
    ry = radius * RNG.uniform(.55, 1.1)
    particles[index % 2].append(
        f"M{p(x-radius,y)}a{p(radius,ry)} 0 1 0 {p(radius*2,0)}"
        f"a{p(radius,ry)} 0 1 0 {p(-radius*2,0)}Z"
    )
for index, paint in enumerate(["particleNear", "particleFar"]):
    path(f"Suspended-water-particles-{index+1}", "".join(particles[index]), f"url(#{paint})")

SVG.append("</svg>")
result = "\n".join(SVG) + "\n"
root = ET.fromstring(result)
tags = [node.tag.split("}")[-1] for node in root.iter()]
assert tags.count("path") <= 25
assert not set(tags) & {"image", "filter", "mask", "clipPath", "script", "animate"}
assert "href=" not in result
destination = OUT / "sunfish-background.svg"
destination.write_text(result, encoding="utf-8")
print(json.dumps({
    "file": str(destination),
    "width": WIDTH,
    "height": HEIGHT,
    "bytes": len(result.encode("utf-8")),
    "gzipBytes": len(gzip.compress(result.encode("utf-8"))),
    "paintedPaths": tags.count("path"),
    "gradients": tags.count("linearGradient") + tags.count("radialGradient"),
    "filters": 0,
    "embeddedImages": 0,
    "externalReferences": 0,
}, indent=2))
