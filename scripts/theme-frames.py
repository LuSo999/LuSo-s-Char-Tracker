# Generates src/themes/<id>/frame.svg: a 9-slice frame (120x120, slices of 40).
# Corner motif drawn for the top-left corner (0..40) and rotated to the others;
# edge motif drawn on the top edge (x 40..80) and rotated to the other edges.
import json, math, sys
root = sys.argv[1]
def rot(g, a): return f'<g transform="rotate({a} 60 60)">{g}</g>'
def frame(corner, edge, defs=''):
    head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">'
    return (head + ''.join(rot(edge, a) for a in (0, 90, 180, 270)) + '</svg>',
            head + ''.join(rot(corner, a) for a in (0, 90, 180, 270)) + '</svg>')
def pts(cx, cy, r, n, start=-90):
    return [(cx + r*math.cos(math.radians(start + i*360/n)), cy + r*math.sin(math.radians(start + i*360/n))) for i in range(n)]
def poly(p): return ' '.join(f'{x:.1f},{y:.1f}' for x, y in p)

T = {k: json.load(open(f'{root}/{k}/theme.json'))['colors'] for k in ['magic','scroll','battlefield','forest','holy','kraken','music','ship','smithy','ancient-temple']}
out = {}

# --- Magic: magic circles with a hexagram at the corners, double rune line with dots on the edges.
a, m = T['magic']['accent'], T['magic']['muted']
hexa = poly(pts(20,20,9,3)) ; hexb = poly(pts(20,20,9,3,90))
ticks = ''.join(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>' for (x1,y1),(x2,y2) in zip(pts(20,20,13.5,12), pts(20,20,16,12)))
out['magic'] = frame(
  f'<g fill="none" stroke="{a}" stroke-width="1.1"><circle cx="20" cy="20" r="16" fill="{T["magic"]["card"]}"/><circle cx="20" cy="20" r="12.5"/><polygon points="{hexa}"/><polygon points="{hexb}"/><circle cx="20" cy="20" r="3" fill="{a}"/><g stroke="{m}">{ticks}</g></g>'
  + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.1" fill="{a}"/>' for x,y in pts(20,20,9,6,-60)),
  f'<g stroke="{m}" stroke-width="0.9"><line x1="40" y1="17.5" x2="80" y2="17.5"/><line x1="40" y1="22.5" x2="80" y2="22.5"/></g>'
  f'<g fill="{a}"><circle cx="50" cy="20" r="1.3"/><path d="M60 16.5 L62.5 20 L60 23.5 L57.5 20 Z"/><circle cx="70" cy="20" r="1.3"/></g>')

# --- Scroll: torn, burnt paper edges with rolled curls at the corners.
a, c = T['scroll']['accent'], '#b48c58'
torn = 'M40 0 L40 6 L44 8 L47 5.5 L51 7.5 L55 4.5 L58 8 L62 5 L66 7.5 L70 4.5 L74 7 L77 5 L80 6.5 L80 0 Z'
out['scroll'] = frame(
  f'<path d="M0 0 H40 V7 C30 5 22 9 16 15 C10 21 6 29 7 40 H0 Z" fill="{c}" opacity="0.55"/>'
  f'<g fill="none" stroke="{a}" stroke-width="1.3"><path d="M7 40 C6 29 10 21 16 15 C22 9 30 5 40 7"/>'
  f'<path d="M24 24 C17 24 14 18 18 14 C22 10 29 13 28 19 C27 23 22 23 21 20"/><path d="M11 33 C8 30 9 26 12 26"/><path d="M33 11 C30 8 26 9 26 12"/></g>',
  f'<path d="{torn}" fill="{c}" opacity="0.55"/><path d="M40 6 L44 8 L47 5.5 L51 7.5 L55 4.5 L58 8 L62 5 L66 7.5 L70 4.5 L74 7 L77 5 L80 6.5" fill="none" stroke="{a}" stroke-width="0.9" opacity="0.8"/>'
  f'<line x1="40" y1="14" x2="80" y2="14" stroke="{a}" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.6"/>')

# --- Battlefield: crossed axe and spear with a banner at the corners; studded iron band on the edges.
a, steel, cloth = T['battlefield']['accent'], '#b9b2a6', '#8e3b26'
out['battlefield'] = frame(
  # crossed spear (top-left to bottom-right) and axe, a tattered banner on the spear
  f'<line x1="3" y1="3" x2="38" y2="38" stroke="#6b4a2e" stroke-width="2.6" stroke-linecap="round"/>'
  f'<path d="M1 1 L12 5 L8 8 L5 12 Z" fill="{steel}" stroke="#3a332c" stroke-width="0.7"/>'
  f'<path d="M9 9 L31 4 L26 11 L33 16 L27 19 L14 14 Z" fill="{cloth}" stroke="{a}" stroke-width="1"/>'
  f'<path d="M17 11 L22 9 M19 15 L25 13" stroke="{a}" stroke-width="0.8"/>'
  f'<line x1="38" y1="4" x2="5" y2="37" stroke="#6b4a2e" stroke-width="2.6" stroke-linecap="round"/>'
  f'<path d="M30 8 C33 1 41 1 41 7 C41 14 36 18 31 18 C34 14 33 11 30 8 Z" fill="{steel}" stroke="#3a332c" stroke-width="0.8"/>'
  f'<path d="M30 8 C27 6 24 9 26 12 L28 10 Z" fill="{steel}" stroke="#3a332c" stroke-width="0.6"/>'
  f'<circle cx="20.5" cy="20.5" r="3.2" fill="{a}" stroke="#3a332c" stroke-width="0.8"/>',
  f'<rect x="40" y="16.5" width="40" height="7" fill="#3a332c" stroke="{steel}" stroke-width="0.8"/><g fill="{steel}"><circle cx="45" cy="20" r="1.5"/><circle cx="75" cy="20" r="1.5"/></g>'
  f'<path d="M52 20 L60 17 L68 20 L60 23 Z" fill="{a}"/>')

# --- Forest: curling vines with leaves at the corners, a leafy vine along the edges.
a, d = T['forest']['accent'], '#5f8a3c'
leaf = lambda x, y, ang, s=1: f'<path transform="translate({x} {y}) rotate({ang}) scale({s})" d="M0 0 C3 -4 9 -4 12 0 C9 4 3 4 0 0 Z" fill="{a}" stroke="{d}" stroke-width="0.6"/>'
out['forest'] = frame(
  f'<g fill="none" stroke="{d}" stroke-width="1.5"><path d="M40 20 C30 20 20 22 20 30 C20 36 26 38 29 34 C31 31 28 28 26 30"/><path d="M20 40 C20 30 18 18 10 14 C5 12 3 17 6 20"/></g>'
  + leaf(30, 18, -150) + leaf(18, 28, 120) + leaf(11, 12, -40, 0.9) + leaf(24, 9, -100, 0.8) + f'<circle cx="34" cy="33" r="1.8" fill="#d7c15a"/><circle cx="8" cy="30" r="1.5" fill="#d7c15a"/>',
  f'<path d="M40 20 C46 15 54 15 60 20 C66 25 74 25 80 20" fill="none" stroke="{d}" stroke-width="1.4"/>' + leaf(50, 16, -120, 0.75) + leaf(70, 24, 60, 0.75))

# --- Holy: radiant gold sunbursts at the corners, beaded gold band on the edges.
a, g = T['holy']['accent'], '#c9a24a'
rays = ''.join(f'<polygon points="{poly([(20+5*math.cos(math.radians(t-6)),20+5*math.sin(math.radians(t-6))),(20+(17 if i%2==0 else 12)*math.cos(math.radians(t)),20+(17 if i%2==0 else 12)*math.sin(math.radians(t))),(20+5*math.cos(math.radians(t+6)),20+5*math.sin(math.radians(t+6)))])}"/>' for i, t in enumerate(range(0, 360, 30)))
out['holy'] = frame(
  f'<g fill="{g}" stroke="{a}" stroke-width="0.5">{rays}</g><circle cx="20" cy="20" r="6" fill="{T["holy"]["card"]}" stroke="{a}" stroke-width="1.2"/><circle cx="20" cy="20" r="3" fill="{g}"/>',
  f'<g stroke="{g}" stroke-width="0.9"><line x1="40" y1="16" x2="80" y2="16"/><line x1="40" y1="24" x2="80" y2="24"/></g>'
  + ''.join(f'<circle cx="{x}" cy="20" r="{1.8 if x % 20 == 0 else 1.1}" fill="{a}"/>' for x in range(45, 80, 5)))

# --- Kraken: a tentacle curling out of each corner with suckers; rolling waves on the edges.
a, d = T['kraken']['accent'], '#2f7f78'
tent = 'M40 9 C24 7 10 12 9 25 C8 34 17 37 21 31 C24 26 19 22 16 26 C15 28 17 29 18 28'
suck = ''.join(f'<circle cx="{x}" cy="{y}" r="1.2" fill="{T["kraken"]["card"]}" stroke="{a}" stroke-width="0.5"/>' for x, y in [(33, 10.5), (26, 11), (19, 13.5), (14, 18), (12, 24)])
out['kraken'] = frame(
  f'<path d="{tent}" fill="none" stroke="{d}" stroke-width="5.5" stroke-linecap="round"/><path d="{tent}" fill="none" stroke="{a}" stroke-width="1.2" stroke-linecap="round"/>{suck}',
  f'<g fill="none" stroke="{a}" stroke-width="1.1"><path d="M40 18 C45 13 50 13 50 18 C50 22 46 22 46 19 M50 18 C55 13 60 13 60 18 C60 22 56 22 56 19 M60 18 C65 13 70 13 70 18 C70 22 66 22 66 19 M70 18 C75 13 80 13 80 18"/></g>'
  f'<line x1="40" y1="24" x2="80" y2="24" stroke="{d}" stroke-width="1"/>')

# --- Music: a lyre at the corners, a three-line staff with notes along the edges.
a, d = T['music']['accent'], '#b55a66'
out['music'] = frame(
  f'<g fill="none" stroke="{a}" stroke-width="1.4"><path d="M11 33 C5 25 8 12 15 9 C18 8 19 11 17 13"/><path d="M29 33 C35 25 32 12 25 9 C22 8 21 11 23 13"/><line x1="10" y1="33" x2="30" y2="33" stroke-width="2"/><line x1="12" y1="17" x2="28" y2="17"/></g>'
  f'<g stroke="{d}" stroke-width="0.7"><line x1="16" y1="17" x2="16" y2="33"/><line x1="20" y1="17" x2="20" y2="33"/><line x1="24" y1="17" x2="24" y2="33"/></g>'
  f'<ellipse cx="34" cy="7" rx="2.6" ry="1.9" fill="{a}" transform="rotate(-20 34 7)"/><line x1="36.3" y1="6" x2="36.3" y2="-1" stroke="{a}" stroke-width="0.9"/>',
  f'<g stroke="{d}" stroke-width="0.7"><line x1="40" y1="16" x2="80" y2="16"/><line x1="40" y1="20" x2="80" y2="20"/><line x1="40" y1="24" x2="80" y2="24"/></g>'
  f'<ellipse cx="52" cy="22" rx="2.4" ry="1.7" fill="{a}" transform="rotate(-20 52 22)"/><line x1="54.2" y1="21" x2="54.2" y2="12" stroke="{a}" stroke-width="0.9"/>'
  f'<ellipse cx="68" cy="18" rx="2.4" ry="1.7" fill="{a}" transform="rotate(-20 68 18)"/><line x1="70.2" y1="17" x2="70.2" y2="8" stroke="{a}" stroke-width="0.9"/><path d="M70.2 8 C73 9 74 11 72 13" fill="none" stroke="{a}" stroke-width="0.9"/>')

# --- Ship: compass roses at the corners, twisted rope along the edges.
a, r = T['ship']['accent'], '#a07a45'
star = poly([p for i in range(8) for p in [pts(20,20,15 if i%2==0 else 9,8)[i], pts(20,20,3.5,8,-67.5)[i]]])
out['ship'] = frame(
  f'<circle cx="20" cy="20" r="12" fill="{T["ship"]["card"]}" stroke="{r}" stroke-width="1"/><polygon points="{star}" fill="{a}" stroke="{r}" stroke-width="0.6"/><circle cx="20" cy="20" r="2" fill="{r}"/>',
  f'<rect x="40" y="16.5" width="40" height="7" fill="{r}" opacity="0.35"/>' + ''.join(f'<path d="M{x} 23.5 C{x+2} 21 {x+3} 19 {x+5} 16.5" stroke="{a}" stroke-width="1.6" fill="none"/>' for x in range(40, 80, 5))
  + f'<g stroke="{r}" stroke-width="0.6"><line x1="40" y1="16.5" x2="80" y2="16.5"/><line x1="40" y1="23.5" x2="80" y2="23.5"/></g>')

# --- Smithy: a cog with a crossed hammer at the corners, chain links along the edges.
a, steel = T['smithy']['accent'], '#9a9187'
cog = ''.join(f'<rect x="18" y="5" width="4" height="5" fill="{steel}" transform="rotate({t} 20 20)"/>' for t in range(0, 360, 45))
out['smithy'] = frame(
  f'{cog}<circle cx="20" cy="20" r="11" fill="{steel}"/><circle cx="20" cy="20" r="5" fill="{T["smithy"]["card"]}" stroke="{a}" stroke-width="1.2"/>'
  f'<g transform="rotate(-45 20 20)"><rect x="18.8" y="8" width="2.4" height="26" fill="#6b4a32"/><rect x="13" y="4" width="14" height="6" rx="1" fill="#4b4540" stroke="{a}" stroke-width="0.8"/></g>',
  ''.join(f'<rect x="{x}" y="16" width="12" height="8" rx="4" fill="none" stroke="{steel}" stroke-width="1.6"/>' for x in (41, 61))
  + ''.join(f'<rect x="{x}" y="18.5" width="12" height="3" rx="1.5" fill="none" stroke="{a}" stroke-width="1.2"/>' for x in (51, 71, 31)))

# --- Ancient temple: square key spirals at the corners, a Greek meander along the edges.
a, s = T['ancient-temple']['accent'], '#8d917d'
out['ancient-temple'] = frame(
  f'<rect x="4" y="4" width="32" height="32" fill="{T["ancient-temple"]["card"]}" stroke="{s}" stroke-width="1.2"/>'
  f'<path d="M10 30 V10 H30 V26 H16 V16 H24 V21 H20" fill="none" stroke="{a}" stroke-width="2"/>',
  f'<path d="M40 26 H44 V14 H56 V22 H50 V18 M60 26 H64 V14 H76 V22 H70 V18" fill="none" stroke="{a}" stroke-width="1.6"/>'
  f'<path d="M50 18 V26 H60 M70 18 V26 H80" fill="none" stroke="{a}" stroke-width="1.6"/>'
  f'<g stroke="{s}" stroke-width="0.8"><line x1="40" y1="11" x2="80" y2="11"/><line x1="40" y1="29" x2="80" y2="29"/></g>')

for k, (e, c) in out.items():
    open(f'{root}/{k}/frame.svg', 'w').write(e + '\n')
    open(f'{root}/{k}/corners.svg', 'w').write(c + '\n')
