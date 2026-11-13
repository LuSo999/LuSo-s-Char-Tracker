# Generates the ornate frames of the illustrated themes from their theme.json colors:
#   src/themes/<id>/frame.svg    edges (9-slice, corners of 40; top edge drawn at x 40..size-40, size 120 by default)
#   src/themes/<id>/corners.svg  corners (top-left corner drawn at 0..40, rotated to the others)
# Usage: python3 scripts/theme-frames.py src/themes
import json, math, sys

root = sys.argv[1]


def frame(corner, edge, defs='', size=120, joint=''):
    """size > 120 makes the edge slice (x 40..size-40) longer, so its motif repeats less often."""
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}"><defs>{defs}</defs>'
    rot = lambda g, a: f'<g transform="rotate({a} {size / 2} {size / 2})">{g}</g>'
    edges = head + ''.join(rot(joint + edge, a) for a in (0, 90, 180, 270)) + '</svg>'
    corners = head + ''.join(rot(corner, a) for a in (0, 90, 180, 270)) + '</svg>'
    return edges, corners


def pts(cx, cy, r, n, start=-90):
    return [(cx + r * math.cos(math.radians(start + i * 360 / n)), cy + r * math.sin(math.radians(start + i * 360 / n))) for i in range(n)]


def poly(p):
    return ' '.join(f'{x:.2f},{y:.2f}' for x, y in p)


def star(cx, cy, r1, r2, n, start=-90):
    o, i = pts(cx, cy, r1, n, start), pts(cx, cy, r2, n, start + 180 / n)
    return poly([p for k in range(n) for p in (o[k], i[k])])


def lin(id, stops, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad(id, stops):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{id}">{s}</radialGradient>'


def leaf(x, y, ang, s, fill, vein):
    return (f'<g transform="translate({x} {y}) rotate({ang}) scale({s})">'
            f'<path d="M0 0 C2.5 -4.2 8.5 -4.6 12 0 C8.5 4.6 2.5 4.2 0 0 Z" fill="{fill}" stroke="{vein}" stroke-width="0.45"/>'
            f'<path d="M0.8 0 H10.5 M4 0 L6 -2 M4 0 L6 2 M7 0 L8.6 -1.6 M7 0 L8.6 1.6" stroke="{vein}" stroke-width="0.35" fill="none"/></g>')


T = {k: json.load(open(f'{root}/{k}/theme.json'))['colors'] for k in
     ['magic', 'scroll', 'battlefield', 'forest', 'holy', 'kraken', 'music', 'ship', 'smithy', 'ancient-temple']}
out = {}

# ---------------- Magic: rune circles with a hexagram and a glowing star; a glowing rune band.
c = T['magic']; a, m, card, tx = c['accent'], c['muted'], c['card'], c['text']
glyphs = ['M-0.9 -1.4 V1.4 M-0.9 -0.2 L0.9 -1.4', 'M-0.9 1.4 L0 -1.4 L0.9 1.4', 'M-0.9 -1.4 L0.9 1.4 M0.9 -1.4 L-0.9 1.4', 'M0 -1.4 V1.4 M-0.9 -0.5 H0.9', 'M-0.9 -1.4 H0.9 L-0.9 1.4 H0.9']
runes = ''.join(f'<path transform="translate({x:.2f} {y:.2f}) rotate({i * 30})" d="{glyphs[i % 5]}"/>' for i, (x, y) in enumerate(pts(20, 20, 13.4, 12)))
ticks = ''.join(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"/>' for (x1, y1), (x2, y2) in zip(pts(20, 20, 15.4, 48), pts(20, 20, 16.4, 48)))
mdefs = rad('mg', [(0, a, 0.55), (0.6, a, 0.18), (1, a, 0)]) + lin('mb', [(0, a, 0), (0.5, a, 0.35), (1, a, 0)])
out['magic'] = frame(
    f'<circle cx="20" cy="20" r="20" fill="url(#mg)"/>'
    f'<circle cx="20" cy="20" r="17.2" fill="{card}" stroke="{a}" stroke-width="1"/>'
    f'<g stroke="{m}" stroke-width="0.35">{ticks}</g>'
    f'<circle cx="20" cy="20" r="15" fill="none" stroke="{a}" stroke-width="0.45"/>'
    f'<g fill="none" stroke="{a}" stroke-width="0.5" stroke-linecap="round">{runes}</g>'
    f'<circle cx="20" cy="20" r="11.6" fill="none" stroke="{a}" stroke-width="0.7"/>'
    f'<g fill="none" stroke="{a}" stroke-width="0.75"><polygon points="{poly(pts(20, 20, 11.2, 3))}"/><polygon points="{poly(pts(20, 20, 11.2, 3, 90))}"/></g>'
    f'<circle cx="20" cy="20" r="6.3" fill="{card}" stroke="{m}" stroke-width="0.5"/>'
    f'<polygon points="{star(20, 20, 5.2, 1.7, 8)}" fill="{a}"/><circle cx="20" cy="20" r="1.1" fill="{tx}"/>'
    + ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="0.9" fill="{tx}"/>' for x, y in pts(20, 20, 11.2, 6))
    + ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{a}"/>' for (x, y), r in zip(pts(20, 20, 18.8, 4, -45), (1.1, 0.8, 1.1, 0.8))),
    f'<rect x="40" y="13" width="40" height="14" fill="url(#mb)"/>'
    f'<g stroke="{m}" stroke-width="0.5"><line x1="40" y1="15.5" x2="80" y2="15.5"/><line x1="40" y1="24.5" x2="80" y2="24.5"/></g>'
    f'<line x1="40" y1="20" x2="80" y2="20" stroke="{a}" stroke-width="0.8"/>'
    f'<g fill="{card}" stroke="{a}" stroke-width="0.6"><circle cx="50" cy="20" r="3"/><circle cx="70" cy="20" r="3"/><path d="M60 15.4 L63.4 20 L60 24.6 L56.6 20 Z"/></g>'
    f'<g fill="none" stroke="{a}" stroke-width="0.45" stroke-linecap="round"><path transform="translate(50 20)" d="{glyphs[0]}"/><path transform="translate(70 20)" d="{glyphs[2]}"/></g>'
    f'<circle cx="60" cy="20" r="1" fill="{tx}"/><g fill="{a}"><circle cx="44.5" cy="20" r="0.7"/><circle cx="55" cy="20" r="0.6"/><circle cx="65" cy="20" r="0.6"/><circle cx="75.5" cy="20" r="0.7"/></g>',
    mdefs)

# ---------------- Scroll: scorched paper edges and a double inked rule that run round the corners;
# a red wax seal with ribbons and ink flourishes on the corners.
c = T['scroll']; a = c['accent']
sdefs = (lin('sp', [(0, '#7a5530', 0.6), (1, '#b48c58', 0)]) + rad('sw', [(0, '#c4473a', 1), (0.7, '#9c2a22', 1), (1, '#6e1a14', 1)])
         + f'<radialGradient id="sk" cx="40" cy="40" r="40" gradientUnits="userSpaceOnUse"><stop offset="0.75" stop-color="#b48c58" stop-opacity="0"/><stop offset="1" stop-color="#7a5530" stop-opacity="0.6"/></radialGradient>')
seal = star(14, 14, 7.6, 6.6, 14)
out['scroll'] = frame(
    f'<g fill="none" stroke="{a}" stroke-width="0.7" stroke-linecap="round">'
    f'<path d="M40 22 C34 22 30 24.5 28.5 28 C27.5 30.5 30 32.5 32 31 C33.4 30 32.4 28 31 28.8"/>'
    f'<path d="M22 40 C22 34 24.5 30 28 28.5 C30.5 27.5 32.5 30 31 32 C30 33.4 28 32.4 28.8 31"/></g>'
    f'<path d="M17 17 L27 31 L24.5 30.8 L23.8 33.5 L14.5 19.5 Z" fill="#9c2a22" stroke="#6e1a14" stroke-width="0.4"/>'
    f'<path d="M17 17 L31 27 L30.8 24.5 L33.5 23.8 L19.5 14.5 Z" fill="#b5352b" stroke="#6e1a14" stroke-width="0.4"/>'
    f'<polygon points="{seal}" fill="url(#sw)" stroke="#6e1a14" stroke-width="0.5"/>'
    f'<circle cx="14" cy="14" r="4.6" fill="none" stroke="#e07a68" stroke-width="0.5" opacity="0.8"/>'
    f'<polygon points="{star(14, 14, 3.2, 1.3, 5)}" fill="#6e1a14" opacity="0.85"/>'
    f'<path d="M10 11 C11 9.6 12.6 9 14 9" fill="none" stroke="#f0a090" stroke-width="0.6" stroke-linecap="round" opacity="0.8"/>',
    f'<rect x="40" y="0" width="40" height="10" fill="url(#sp)"/>'
    f'<line x1="40" y1="12.5" x2="80" y2="12.5" stroke="{a}" stroke-width="0.8"/><line x1="40" y1="15.5" x2="80" y2="15.5" stroke="{a}" stroke-width="0.4"/>'
    f'<g fill="none" stroke="{a}" stroke-width="0.5" stroke-linecap="round"><path d="M52 15.5 C54 18.5 57.5 18.5 60 15.5 C62.5 18.5 66 18.5 68 15.5"/></g>'
    f'<path d="M60 16.6 L61.2 18.5 L60 20.4 L58.8 18.5 Z" fill="{a}"/>',
    sdefs,
    joint=f'<path d="M0 0 H40 V40 H0 Z" fill="url(#sk)"/>'
          f'<path d="M40 12.5 H24.5 A12 12 0 0 0 12.5 24.5 V40" fill="none" stroke="{a}" stroke-width="0.8"/>'
          f'<path d="M40 15.5 H25.5 A10 10 0 0 0 15.5 25.5 V40" fill="none" stroke="{a}" stroke-width="0.4"/>')

# ---------------- Battlefield: a round shield over crossed axe and spear; bunting of war banners on the edges.
c = T['battlefield']; a = c['accent']
bdefs = (lin('bs', [(0, '#e6e1d8', 1), (0.5, '#a39c90', 1), (1, '#5f5a52', 1)], 1, 1)
         + rad('bw', [(0, '#9a6a3e', 1), (0.8, '#6b4526', 1), (1, '#4a2e18', 1)])
         + lin('bh', [(0, '#8a6038', 1), (1, '#4f3420', 1)], 1, 0)
         + lin('bc', [(0, '#b0472c', 1), (1, '#6e2416', 1)]))
rivets = ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="0.75" fill="url(#bs)" stroke="#2b2622" stroke-width="0.25"/>' for x, y in pts(19.5, 19.5, 10.2, 8, -67.5))
planks = '<path d="M13 9.5 V29.5 M19.5 8.3 V30.7 M26 9.5 V29.5" stroke="#3e2614" stroke-width="0.45"/>'
out['battlefield'] = frame(
    f'<line x1="37" y1="37" x2="6" y2="6" stroke="url(#bh)" stroke-width="2.2" stroke-linecap="round"/>'
    f'<path d="M0.5 0.5 C4 1.5 8 3.5 8.6 6.4 L6.4 8.6 C3.5 8 1.5 4 0.5 0.5 Z" fill="url(#bs)" stroke="#2b2622" stroke-width="0.4"/>'
    f'<path d="M1.5 1.5 L7 7" stroke="#5f5a52" stroke-width="0.35"/>'
    f'<rect x="-1.3" y="-0.9" width="2.6" height="1.8" transform="translate(9 9) rotate(45)" fill="#3a332c"/>'
    f'<line x1="3" y1="37" x2="34.5" y2="5.5" stroke="url(#bh)" stroke-width="2.2" stroke-linecap="round"/>'
    f'<path d="M31 4 C33.5 0.5 39.5 0.5 39.8 5.5 C40 11 36 15 31.5 14.5 C33.5 12 33.6 9.5 33 7.5 Z" fill="url(#bs)" stroke="#2b2622" stroke-width="0.5"/>'
    f'<path d="M34.5 3.2 C37.5 3.4 38.8 6 38.6 8.6" fill="none" stroke="#f4f0e8" stroke-width="0.45" opacity="0.8"/>'
    f'<path d="M31 4 C29 2.5 26.5 4.5 28 7 L30.2 6 Z" fill="url(#bs)" stroke="#2b2622" stroke-width="0.4"/>'
    f'<circle cx="19.5" cy="19.5" r="11.8" fill="url(#bs)" stroke="#2b2622" stroke-width="0.5"/>'
    f'<circle cx="19.5" cy="19.5" r="10.6" fill="url(#bw)" stroke="#3a332c" stroke-width="0.4"/>{planks}'
    f'<circle cx="19.5" cy="19.5" r="10.6" fill="none" stroke="{a}" stroke-width="0.5" opacity="0.6"/>{rivets}'
    f'<circle cx="19.5" cy="19.5" r="3.6" fill="url(#bs)" stroke="#2b2622" stroke-width="0.4"/><circle cx="18.6" cy="18.6" r="1" fill="#f4f0e8" opacity="0.8"/>',
    f'<path d="M40 11 Q60 15 80 11" fill="none" stroke="#8a6a45" stroke-width="0.9"/>'
    f'<path d="M40 11 Q60 15 80 11" fill="none" stroke="#c9a676" stroke-width="0.35" stroke-dasharray="1 1"/>'
    f'<path d="M45.5 11.9 L51.5 13 L48 24 Z" fill="url(#bc)" stroke="{a}" stroke-width="0.4"/>'
    f'<path d="M56.5 13.1 L63.5 13.1 L60 26 Z" fill="#3a332c" stroke="{a}" stroke-width="0.45"/><path d="M60 15.5 L61.4 18.6 L60 21.4 L58.6 18.6 Z" fill="{a}"/>'
    f'<path d="M68.5 13 L74.5 11.9 L72 24 Z" fill="url(#bc)" stroke="{a}" stroke-width="0.4"/>'
    f'<g fill="#e8d5a8"><circle cx="48.4" cy="15.6" r="0.6"/><circle cx="71.6" cy="15.6" r="0.6"/></g>',
    bdefs)

# ---------------- Forest (fairy): pastel blossoms, curling tendrils, a fern frond and sparkles; a vine with
# one big blossom per (long) edge tile.
c = T['forest']; vine, vine2 = '#9cc76a', '#5f8a3c'
fdefs = (rad('fp', [(0, '#fff3f8', 1), (0.55, '#f6bdd8', 1), (1, '#d97fb0', 1)]) + rad('fv', [(0, '#f7f1ff', 1), (0.55, '#cdb8f2', 1), (1, '#9d82d8', 1)])
         + rad('fw', [(0, '#ffffff', 1), (0.6, '#fbf3df', 1), (1, '#e3d3a8', 1)]) + rad('fc', [(0, '#fff3b0', 1), (1, '#e0b13c', 1)])
         + lin('fl', [(0, '#b9dc86', 1), (1, '#6f9e40', 1)], 1, 1) + rad('fg', [(0, '#fff8d8', 0.55), (1, '#fff8d8', 0)]))
def blossom(x, y, r, petal, rotate=0, n=5):
    p = f'M0 0 C{-r * 0.62:.2f} {-r * 0.35:.2f} {-r * 0.55:.2f} {-r:.2f} 0 {-r:.2f} C{r * 0.55:.2f} {-r:.2f} {r * 0.62:.2f} {-r * 0.35:.2f} 0 0 Z'
    petals = ''.join(f'<path d="{p}" transform="rotate({rotate + i * 360 / n:.1f})" fill="url(#{petal})" stroke="#b07aa0" stroke-width="0.25" stroke-opacity="0.6"/>' for i in range(n))
    veins = ''.join(f'<path d="M0 {-r * 0.25:.2f} V{-r * 0.7:.2f}" transform="rotate({rotate + i * 360 / n:.1f})" stroke="#ffffff" stroke-width="0.3" opacity="0.7"/>' for i in range(n))
    dots = ''.join(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{r * 0.06:.2f}" fill="#c98a1c"/>' for px, py in pts(0, 0, r * 0.2, 6))
    return f'<g transform="translate({x} {y})">{petals}{veins}<circle r="{r * 0.28:.2f}" fill="url(#fc)"/>{dots}</g>'
def bud(x, y, ang, s, f='fv'):
    return (f'<g transform="translate({x} {y}) rotate({ang}) scale({s})"><path d="M0 0 C-1.8 -1.5 -1.6 -4.6 0 -5.8 C1.6 -4.6 1.8 -1.5 0 0 Z" fill="url(#{f})" stroke="#9d82d8" stroke-width="0.25"/>'
            f'<path d="M0 0.4 C-1.4 -0.6 -1.3 -2 -0.8 -2.4 M0 0.4 C1.4 -0.6 1.3 -2 0.8 -2.4" fill="none" stroke="{vine2}" stroke-width="0.5"/></g>')
sparkle = lambda x, y, r: f'<circle cx="{x}" cy="{y}" r="{r * 1.6}" fill="url(#fg)"/><path d="M{x} {y - r} L{x + r * 0.25} {y - r * 0.25} L{x + r} {y} L{x + r * 0.25} {y + r * 0.25} L{x} {y + r} L{x - r * 0.25} {y + r * 0.25} L{x - r} {y} L{x - r * 0.25} {y - r * 0.25} Z" fill="#fffbe6"/>'
FL = lambda x, y, ang, s=1: leaf(x, y, ang, s, 'url(#fl)', '#4f7a32')
fern = ''.join(f'<path d="M0 0 C1 -1.2 2.6 -1.4 3.4 -0.6 C2.6 0 1.2 0.2 0 0 Z" transform="translate({x:.2f} {y:.2f}) rotate({ang}) scale({sc})" fill="url(#fl)"/>'
               for x, y, ang, sc in [(31, 30.2, -80, 1), (29, 31.4, 170, 1), (33.6, 28, -70, 0.85), (31.4, 28.6, 160, 0.85), (36, 26.4, -60, 0.7), (34, 26.6, 150, 0.7), (37.6, 25.4, -50, 0.55)])
out['forest'] = frame(
    # tendrils curling along both sides
    f'<g fill="none" stroke="{vine}" stroke-width="0.9" stroke-linecap="round">'
    f'<path d="M40 14.5 C32 13.5 25 15 22 19 C19.5 22.5 22 26 25 24.5 C27 23.4 26 21 24.4 21.8"/>'
    f'<path d="M14.5 40 C13.5 32 15 25 19 22 C22.5 19.5 26 22 24.5 25 C23.4 27 21 26 21.8 24.4" />'
    f'<path d="M40 20 C35 19 31 20 29 22 M20 40 C19 35 20 31 22 29" stroke-width="0.6"/></g>'
    f'<path d="M24 34 C27 32 30 29.5 32 27.5 C34 25.5 36 24.5 38.5 24.6" fill="none" stroke="{vine2}" stroke-width="0.5"/>{fern}'
    + FL(28, 13.8, -20, 0.62) + FL(13.8, 28, 110, 0.62) + FL(33, 15, 10, 0.5) + FL(15, 33, 80, 0.5)
    + blossom(25, 6.5, 5.2, 'fv', 20) + blossom(6.5, 25, 5.2, 'fw', 5)
    + blossom(12, 12, 10.5, 'fp', -10)
    + bud(34.5, 12.6, 70, 0.9) + bud(12.6, 34.5, 200, 0.9, 'fp')
    + sparkle(30.5, 6, 1.6) + sparkle(6, 31, 1.3) + sparkle(23, 25, 0.9) + sparkle(3, 3.5, 1.1),
    # one wave of vine over the long tile: a big blossom in the middle, small ones and buds on the way
    f'<path d="M40 20 C73 10 107 10 140 20 C173 30 207 30 240 20" fill="none" stroke="{vine}" stroke-width="1.2"/>'
    f'<path d="M40 20 C73 10 107 10 140 20 C173 30 207 30 240 20" fill="none" stroke="{vine2}" stroke-width="0.4" transform="translate(0 0.8)"/>'
    f'<g fill="none" stroke="{vine}" stroke-width="0.7" stroke-linecap="round"><path d="M104 13 C105 8.5 109.5 7.5 111.2 10 C112.3 11.8 110 13.2 109.2 11.8"/><path d="M176 27 C175 31.5 170.5 32.5 168.8 30 C167.7 28.2 170 26.8 170.8 28.2"/></g>'
    + FL(56, 16.2, -35, 0.75) + FL(118, 14, 215, 0.75) + FL(162, 26, 25, 0.75) + FL(224, 23.8, 145, 0.75)
    + bud(72, 13.6, -25, 1.25, 'fp') + bud(208, 26.4, 155, 1.25, 'fp')
    + blossom(140, 20, 13, 'fp', 12)
    + blossom(92, 12.2, 5.4, 'fv', 30) + blossom(188, 27.8, 5.4, 'fw', 0)
    + sparkle(124, 28, 1.6) + sparkle(156, 11, 1.6) + sparkle(48, 12.5, 1.1) + sparkle(232, 28, 1.1),
    fdefs, 280)

# ---------------- Holy: a radiant gold sun with a cross in a beaded halo; a gilded band with fleurs-de-lis.
c = T['holy']; a, card = c['accent'], c['card']
hdefs = (lin('hg', [(0, '#f6e3a1', 1), (0.5, '#d4a842', 1), (1, '#9a7020', 1)], 1, 1) + rad('hr', [(0, '#ffe9a6', 0.9), (1, '#e8c060', 0)])
         + lin('hv', [(0, '#f3dc8e', 1), (0.5, '#c99a35', 1), (1, '#f3dc8e', 1)]))
def ray(t, r, w):
    p = [(20 + 4.5 * math.cos(math.radians(t - w)), 20 + 4.5 * math.sin(math.radians(t - w))), (20 + r * math.cos(math.radians(t)), 20 + r * math.sin(math.radians(t))),
         (20 + 4.5 * math.cos(math.radians(t + w)), 20 + 4.5 * math.sin(math.radians(t + w)))]
    return f'<polygon points="{poly(p)}"/>'
rays = ''.join(ray(i * 22.5, 19.5 if i % 2 == 0 else 14.5, 7 if i % 2 == 0 else 5) for i in range(16))
beads = ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="0.65" fill="url(#hg)"/>' for x, y in pts(20, 20, 9.4, 16))
fleur = ('<path d="M60 13.2 C61.6 15 61.6 17 60 19 C58.4 17 58.4 15 60 13.2 Z M60 19 C61 16.8 63.8 16.4 64.6 18.2 C63 18.2 61.6 18.8 60.8 20 Z '
         'M60 19 C59 16.8 56.2 16.4 55.4 18.2 C57 18.2 58.4 18.8 59.2 20 Z M57.6 20 H62.4 V21.2 H57.6 Z M59.2 21.2 L60 26.4 L60.8 21.2 Z"/>')
out['holy'] = frame(
    f'<circle cx="20" cy="20" r="19" fill="url(#hr)"/>'
    f'<g fill="url(#hg)" stroke="#8a6416" stroke-width="0.3">{rays}</g>'
    f'<circle cx="20" cy="20" r="10.6" fill="{card}" stroke="url(#hg)" stroke-width="1.3"/>{beads}'
    f'<circle cx="20" cy="20" r="8" fill="none" stroke="#c9a24a" stroke-width="0.4"/>'
    f'<path d="M18.5 13 H21.5 L21 18.5 L26.5 18 V22 L21 21.5 L21.5 27 H18.5 L19 21.5 L13.5 22 V18 L19 18.5 Z" fill="url(#hg)" stroke="#8a6416" stroke-width="0.35"/>'
    f'<circle cx="20" cy="20" r="1.3" fill="{card}" stroke="#8a6416" stroke-width="0.3"/>',
    f'<rect x="40" y="15.8" width="40" height="8.4" fill="url(#hv)" opacity="0.35"/>'
    f'<g stroke="url(#hg)" stroke-width="0.9"><line x1="40" y1="15.8" x2="80" y2="15.8"/><line x1="40" y1="24.2" x2="80" y2="24.2"/></g>'
    f'<g stroke="#c9a24a" stroke-width="0.35"><line x1="40" y1="13.8" x2="80" y2="13.8"/><line x1="40" y1="26.2" x2="80" y2="26.2"/></g>'
    + ''.join(f'<circle cx="{x}" cy="20" r="{r}" fill="url(#hg)" stroke="#8a6416" stroke-width="0.25"/>' for x, r in [(42.5, 0.9), (46, 1.2), (49.5, 0.9), (70.5, 0.9), (74, 1.2), (77.5, 0.9)])
    + f'<g fill="url(#hg)" stroke="#8a6416" stroke-width="0.3">{fleur}</g>',
    hdefs)

# ---------------- Kraken: a shaded tentacle with ringed suckers and bubbles; cresting waves with foam.
c = T['kraken']; a = c['accent']
kdefs = (lin('kt', [(0, '#1f5c58', 1), (0.5, a, 1), (1, '#1f5c58', 1)], 1, 1) + lin('kw', [(0, a, 0.0), (0.5, a, 0.35), (1, '#1f5c58', 0.6)]))
tent = 'M40 8.5 C25 6 10.5 11 9 25 C8 34.5 18 37.5 22 31.5 C25 27 20.5 22.5 16.8 25.6 C14.8 27.4 16.6 30 18.6 28.6'
suckers = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#cfeee7" stroke="#1f5c58" stroke-width="0.35"/><circle cx="{x}" cy="{y}" r="{r * 0.45:.2f}" fill="#7bb8ad"/>'
                  for x, y, r in [(35, 10.2, 1.25), (29.5, 10.2, 1.3), (24, 11.1, 1.3), (19, 13.2, 1.25), (15, 16.6, 1.2), (12.4, 21, 1.1), (11.8, 26, 1), (13.8, 30.4, 0.9)])
bubbles = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#a6e3d8" stroke-width="0.35"/>' for x, y, r in [(30, 22, 1.5), (33, 18.5, 1), (26.5, 25.5, 0.8), (5, 6, 1.2), (8, 3.5, 0.7)])
crest = lambda x: f'M{x} 22 C{x + 3} 16 {x + 9} 14.5 {x + 12} 18 C{x + 13.5} 20 {x + 11} 22.5 {x + 9} 21 C{x + 7.8} 20 {x + 9} 18.4 {x + 10.3} 19.2'
out['kraken'] = frame(
    f'<path d="{tent}" fill="none" stroke="#163f3c" stroke-width="7.2" stroke-linecap="round"/>'
    f'<path d="{tent}" fill="none" stroke="url(#kt)" stroke-width="5.8" stroke-linecap="round"/>'
    f'<path d="{tent}" fill="none" stroke="#bff0e6" stroke-width="0.6" stroke-linecap="round" opacity="0.6" transform="translate(0.9 -1.2)"/>'
    f'{suckers}{bubbles}',
    f'<path d="M40 22 H80 V27 H40 Z" fill="url(#kw)"/>'
    f'<g fill="none" stroke="{a}" stroke-width="0.9" stroke-linecap="round"><path d="{crest(40)}"/><path d="{crest(53.3)}"/><path d="{crest(66.6)}"/></g>'
    f'<path d="M40 22 H80" stroke="{a}" stroke-width="0.7"/><path d="M40 25 C45 23.5 50 26.5 55 25 C60 23.5 65 26.5 70 25 C73 24 77 26 80 25" fill="none" stroke="#1f5c58" stroke-width="0.6"/>'
    + ''.join(f'<circle cx="{x}" cy="{y}" r="0.55" fill="#cfeee7"/>' for x, y in [(48, 14.6), (61.5, 14.2), (75, 14.6), (51, 13.4)]),
    kdefs)

# ---------------- Music: a gilded lyre with strings and floating notes; a staff with notes.
c = T['music']; a = c['accent']; ink = '#b55a66'
mudefs = lin('ml', [(0, '#f4d9a0', 1), (0.5, '#c99a4a', 1), (1, '#8a6224', 1)], 1, 1)
def note(x, y, s=1, flag=False):
    f = f'<path d="M1.7 -7.5 C3.8 -6.4 4.5 -5 3.3 -3.2" fill="none" stroke="{a}" stroke-width="0.6"/>' if flag else ''
    return (f'<g transform="translate({x} {y}) scale({s})"><ellipse rx="1.9" ry="1.35" transform="rotate(-22)" fill="{a}"/>'
            f'<line x1="1.7" y1="-0.4" x2="1.7" y2="-7.5" stroke="{a}" stroke-width="0.6"/>{f}</g>')
def pair(x, y, s=1):
    return (f'<g transform="translate({x} {y}) scale({s})"><ellipse rx="1.9" ry="1.35" transform="rotate(-22)" fill="{a}"/><ellipse cx="5" cy="-1.5" rx="1.9" ry="1.35" transform="rotate(-22 5 -1.5)" fill="{a}"/>'
            f'<path d="M1.7 -0.4 V-7.6 M6.7 -1.9 V-9" stroke="{a}" stroke-width="0.6"/><path d="M1.7 -7.6 L6.7 -9 V-7.8 L1.7 -6.4 Z" fill="{a}"/></g>')
out['music'] = frame(
    f'<g fill="url(#ml)" stroke="#6b4a18" stroke-width="0.4">'
    f'<path d="M9.5 33 C3.5 26 5 13 12 9.5 C15 8 17.5 10.5 15.5 12.8 C13.6 11.6 11.6 12.8 11.3 15 C10.6 21 12.2 27 14.5 31 Z"/>'
    f'<path d="M30.5 33 C36.5 26 35 13 28 9.5 C25 8 22.5 10.5 24.5 12.8 C26.4 11.6 28.4 12.8 28.7 15 C29.4 21 27.8 27 25.5 31 Z"/>'
    f'<rect x="10" y="15.4" width="20" height="2.2" rx="1.1"/><path d="M8.5 31 H31.5 L30 35.5 H10 Z"/></g>'
    f'<g stroke="#f6e7c8" stroke-width="0.4">' + ''.join(f'<line x1="{x}" y1="17.6" x2="{x}" y2="31"/>' for x in (14.5, 17.5, 20, 22.5, 25.5)) + '</g>'
    f'<g fill="#6b4a18"><circle cx="20" cy="33.2" r="0.9"/><circle cx="12.3" cy="16.5" r="0.5"/><circle cx="27.7" cy="16.5" r="0.5"/></g>'
    + note(35, 8.5, 0.8, True) + pair(2.5, 39, 0.65) + note(4, 6, 0.6),
    f'<g stroke="{ink}" stroke-width="0.35">' + ''.join(f'<line x1="40" y1="{y}" x2="80" y2="{y}"/>' for y in (14, 17, 20, 23, 26)) + '</g>'
    + note(45, 23, 0.85) + pair(52, 20, 0.85) + note(66, 17, 0.85, True) + note(74, 24.5, 0.85)
    + f'<path d="M60.5 26 V12" stroke="{ink}" stroke-width="0.5"/>',
    mudefs)

# ---------------- Ship: a shaded 16-point compass rose in a graduated ring; a twisted two-tone rope.
c = T['ship']; a, card = c['accent'], c['card']; rope1 = '#c9a265'
shdefs = lin('sr', [(0, '#e8cc90', 1), (1, '#8a6534', 1)])
def rose(cx, cy):
    parts = []
    for k in range(16):
        t = -90 + k * 22.5
        rank = 0 if k % 4 == 0 else 1 if k % 2 == 0 else 2
        r, w = [(17, 2.6), (12, 2), (8.5, 1.4)][rank]
        tip = (cx + r * math.cos(math.radians(t)), cy + r * math.sin(math.radians(t)))
        l = (cx + w * math.cos(math.radians(t - 90)), cy + w * math.sin(math.radians(t - 90)))
        rr = (cx + w * math.cos(math.radians(t + 90)), cy + w * math.sin(math.radians(t + 90)))
        light, dark = [(a, '#7d5a30'), (rope1, '#5a4020'), ('#e8d5a8', '#8a6534')][rank]
        parts.append((rank, f'<polygon points="{poly([(cx, cy), l, tip])}" fill="{light}" stroke="#3e2a12" stroke-width="0.25"/>'
                            f'<polygon points="{poly([(cx, cy), tip, rr])}" fill="{dark}" stroke="#3e2a12" stroke-width="0.25"/>'))
    return ''.join(p for _, p in sorted(parts, key=lambda p: -p[0]))
ticks2 = ''.join(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke-width="{0.5 if i % 4 == 0 else 0.25}"/>'
                 for i, ((x1, y1), (x2, y2)) in enumerate(zip(pts(20, 20, 12.2, 32), pts(20, 20, 13.6, 32))))
strand = lambda x: (f'<path d="M{x} 24.5 C{x + 1} 22 {x + 2.6} 18 {x + 4.6} 15.5 L{x + 7} 15.5 C{x + 5} 18 {x + 3.4} 22 {x + 2.4} 24.5 Z" fill="url(#sr)" stroke="#5a4020" stroke-width="0.3"/>'
                    f'<path d="M{x + 1.8} 22.5 C{x + 2.6} 20.5 {x + 3.6} 18.5 {x + 5} 16.6" fill="none" stroke="#f3e2b8" stroke-width="0.35" opacity="0.7"/>')
out['ship'] = frame(
    f'<circle cx="20" cy="20" r="14.2" fill="{card}" stroke="url(#sr)" stroke-width="1.2"/>'
    f'<g stroke="{rope1}">{ticks2}</g><circle cx="20" cy="20" r="11.6" fill="none" stroke="{rope1}" stroke-width="0.4"/>'
    + rose(20, 20)
    + f'<circle cx="20" cy="20" r="1.6" fill="{a}" stroke="#3e2a12" stroke-width="0.35"/>',
    f'<rect x="40" y="15.5" width="40" height="9" fill="#5a4020" opacity="0.55"/>'
    + ''.join(strand(x) for x in range(36, 81, 5))
    + f'<g stroke="#3e2a12" stroke-width="0.4"><line x1="40" y1="15.5" x2="80" y2="15.5"/><line x1="40" y1="24.5" x2="80" y2="24.5"/></g>',
    shdefs)

# ---------------- Smithy: an anvil with crossed hammer and tongs over a glowing cog; heavy chain.
c = T['smithy']; a = c['accent']
smdefs = (lin('sm', [(0, '#d8d2ca', 1), (0.5, '#8e877f', 1), (1, '#4b4540', 1)], 1, 1) + rad('se', [(0, '#ffb060', 0.85), (0.5, '#f07020', 0.35), (1, '#f07020', 0)])
          + lin('sw2', [(0, '#8a5e3c', 1), (1, '#4f3420', 1)], 1, 0))
cog = ''.join(f'<rect x="17.8" y="3.4" width="4.4" height="5" rx="0.6" fill="url(#sm)" stroke="#2b2622" stroke-width="0.3" transform="rotate({t} 20 20)"/>' for t in range(0, 360, 36))
out['smithy'] = frame(
    f'<circle cx="20" cy="20" r="20" fill="url(#se)"/>{cog}'
    f'<circle cx="20" cy="20" r="12.4" fill="url(#sm)" stroke="#2b2622" stroke-width="0.4"/><circle cx="20" cy="20" r="9.4" fill="none" stroke="#4b4540" stroke-width="0.5"/>'
    + ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="1.5" fill="#3a3430"/>' for x, y in pts(20, 20, 6.6, 5))
    + f'<g stroke="#2b2622" stroke-width="1.1" stroke-linecap="round" fill="none"><path d="M32 33 L13 10 L9.5 8.5"/><path d="M33 31.5 L14.5 9 L11 5.5"/></g>'
    + f'<g transform="rotate(-45 20 20)"><rect x="18.9" y="9" width="2.2" height="24" rx="0.8" fill="url(#sw2)" stroke="#2b2622" stroke-width="0.3"/>'
      f'<rect x="12.5" y="4.5" width="15" height="6.4" rx="0.8" fill="url(#sm)" stroke="#2b2622" stroke-width="0.45"/><rect x="12.5" y="4.5" width="2.2" height="6.4" fill="#4b4540"/>'
      f'<line x1="15.5" y1="5.5" x2="26.5" y2="5.5" stroke="#f4efe6" stroke-width="0.45" opacity="0.8"/></g>'
    + f'<path d="M12 22 H31 C31 24 28.5 25 26 25.3 L25 27.5 L27.5 30.5 H15.5 L18 27.5 L17 25.3 C14 25 12.3 24 12 22 Z" fill="url(#sm)" stroke="#2b2622" stroke-width="0.45"/>'
    + f'<path d="M12 22 C9 22 6.5 23 5.5 24.5 C8 24.6 10.5 24.4 12.6 24 Z" fill="url(#sm)" stroke="#2b2622" stroke-width="0.4"/><line x1="13" y1="22.6" x2="30.5" y2="22.6" stroke="#f4efe6" stroke-width="0.4" opacity="0.7"/>'
    + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffc070"/>' for x, y, r in [(30, 17.5, 0.6), (33, 15.5, 0.45), (28.5, 14.5, 0.4), (34.5, 19.5, 0.35)]),
    ''.join(f'<rect x="{x}" y="16.2" width="11" height="7.6" rx="3.8" fill="none" stroke="#2b2622" stroke-width="2.2"/><rect x="{x}" y="16.2" width="11" height="7.6" rx="3.8" fill="none" stroke="url(#sm)" stroke-width="1.5"/>'
            f'<path d="M{x + 3} 16.9 H{x + 8}" stroke="#f4efe6" stroke-width="0.4" opacity="0.8"/>' for x in (41.5, 61.5))
    + ''.join(f'<rect x="{x}" y="18.6" width="11" height="2.8" rx="1.4" fill="url(#sm)" stroke="#2b2622" stroke-width="0.4"/>' for x in (31.5, 51.5, 71.5))
    + f'<circle cx="60" cy="20" r="0.9" fill="{a}" opacity="0.8"/>',
    smdefs)

# ---------------- Ancient temple: a bevelled stone block with a carved key spiral and moss; a carved meander frieze.
c = T['ancient-temple']; a, card = c['accent'], c['card']; stone, dark, light = '#6f7262', '#3c3e33', '#a8ab95'
tdefs = lin('ts', [(0, '#8d917d', 1), (1, '#55584a', 1)], 1, 1)
spiral = 'M10.5 30 V10.5 H30 V26 H15 V15 H25 V21.5 H19.5'
moss = (leaf(3, 36, -60, 0.45, '#7c9a3c', '#3e5220') + leaf(4, 38, -10, 0.4, '#93b04a', '#3e5220')
        + leaf(36, 3, -30, 0.45, '#7c9a3c', '#3e5220') + leaf(38, 4.5, -80, 0.4, '#93b04a', '#3e5220'))
mean = 'M40 25 H43 V15 H53 V22 H47 V18 H50 M50 25 H63 V15 H73 V22 H67 V18 H70 M70 25 H80'
out['ancient-temple'] = frame(
    f'<rect x="3" y="3" width="34" height="34" fill="url(#ts)"/>'
    f'<path d="M3 37 V3 H37" fill="none" stroke="{light}" stroke-width="1"/><path d="M3 37 H37 V3" fill="none" stroke="{dark}" stroke-width="1"/>'
    f'<rect x="6" y="6" width="28" height="28" fill="{card}" stroke="{dark}" stroke-width="0.6"/>'
    f'<path d="{spiral}" fill="none" stroke="{dark}" stroke-width="2.4" transform="translate(0.7 0.7)"/>'
    f'<path d="{spiral}" fill="none" stroke="{a}" stroke-width="2.2"/>'
    f'<path d="M14 6.6 L16 9 M27 33.5 L29.5 31 M33.5 13 L31 15" stroke="{dark}" stroke-width="0.35"/>'
    f'{moss}',
    f'<rect x="40" y="10" width="40" height="20" fill="{stone}" opacity="0.35"/>'
    f'<g stroke="{light}" stroke-width="0.5"><line x1="40" y1="10" x2="80" y2="10"/></g><g stroke="{dark}" stroke-width="0.5"><line x1="40" y1="30" x2="80" y2="30"/></g>'
    + ''.join(f'<rect x="{x}" y="10.8" width="2.4" height="2" fill="{stone}" stroke="{dark}" stroke-width="0.25"/>' for x in range(41, 80, 4))
    + f'<path d="{mean}" fill="none" stroke="{dark}" stroke-width="1.6" transform="translate(0.6 0.6)"/>'
    + f'<path d="{mean}" fill="none" stroke="{a}" stroke-width="1.4"/>'
    + f'<line x1="40" y1="27.6" x2="80" y2="27.6" stroke="{a}" stroke-width="0.4"/>',
    tdefs)

for k, (e, c_) in out.items():
    open(f'{root}/{k}/frame.svg', 'w').write(e + '\n')
    open(f'{root}/{k}/corners.svg', 'w').write(c_ + '\n')
print(f'{len(out)} frames written')
