#!/usr/bin/env python3
"""
Moongrove icon set: renders the app icon (App Store 1024), PWA icons and
favicon from a single hand-authored SVG design. No external assets.
Usage: python3 tools/icons.py   (writes into dist/icons + dist/favicon.svg)
"""
import os
import random

import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "dist")
ICONS = os.path.join(DIST, "icons")
os.makedirs(ICONS, exist_ok=True)

random.seed(20260101)
stars = "".join(
    f'<circle cx="{random.randint(40, 984)}" cy="{random.randint(40, 984)}" '
    f'r="{random.uniform(1.5, 4):.1f}" fill="#e8ecff" opacity="{random.uniform(0.12, 0.5):.2f}"/>'
    for _ in range(26)
)

PETALS_MAIN = "".join(
    f'<ellipse cx="512" cy="268" rx="72" ry="168" fill="url(#petalV)" transform="rotate({a} 512 512)"/>'
    for a in range(0, 360, 60)
)
PETALS_INNER = "".join(
    f'<ellipse cx="512" cy="330" rx="50" ry="118" fill="url(#petalT)" opacity="0.9" transform="rotate({a} 512 512)"/>'
    for a in range(30, 390, 60)
)

DEFS = """
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#2b2159"/>
      <stop offset="55%" stop-color="#181238"/>
      <stop offset="100%" stop-color="#0b1026"/>
    </radialGradient>
    <linearGradient id="petalV" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#6d32d8"/>
      <stop offset="55%" stop-color="#a875f5"/>
      <stop offset="100%" stop-color="#ecd9ff"/>
    </linearGradient>
    <linearGradient id="petalT" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#0f8fa8"/>
      <stop offset="55%" stop-color="#2fd8c6"/>
      <stop offset="100%" stop-color="#c9fff5"/>
    </linearGradient>
    <radialGradient id="core" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#ffe49a"/>
      <stop offset="100%" stop-color="#e0952b"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c9a4ff" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#8d5ff0" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbT" cx="38%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#7cf0e2"/>
      <stop offset="100%" stop-color="#0f8fa8"/>
    </radialGradient>
    <radialGradient id="orbV" cx="38%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#cda8ff"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </radialGradient>
    <radialGradient id="orbG" cx="38%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#ffe49a"/>
      <stop offset="100%" stop-color="#e0952b"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
"""


def bloom(group_scale=1.0):
    """The Moongrove bloom mark, centered on (512, 512)."""
    return f"""
    <g transform="translate(512 512) scale({group_scale}) translate(-512 -512)">
      <circle cx="512" cy="512" r="330" fill="url(#halo)"/>
      {PETALS_MAIN}
      {PETALS_INNER}
      <circle cx="512" cy="512" r="86" fill="url(#core)"/>
      <circle cx="512" cy="512" r="86" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="6"/>
      <g filter="url(#soft)" opacity="0.85">
        <circle cx="512" cy="512" r="120" fill="none" stroke="#ffe9a3" stroke-width="10"/>
      </g>
    </g>"""


def seed_orbs():
    return """
    <circle cx="150" cy="820" r="34" fill="url(#orbT)"/>
    <circle cx="864" cy="776" r="26" fill="url(#orbV)"/>
    <circle cx="812" cy="196" r="22" fill="url(#orbG)"/>"""


APP_ICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  {DEFS}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  {stars}
  <circle cx="820" cy="180" r="200" fill="#e8ecff" opacity="0.05"/>
  {bloom(1.0)}
  {seed_orbs()}
</svg>"""

MASKABLE = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  {DEFS}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  {bloom(0.72)}
</svg>"""

FAVICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  {DEFS}
  <g transform="translate(100 100) scale(0.62) translate(-512 -512)">
    <circle cx="512" cy="512" r="330" fill="url(#halo)"/>
    {PETALS_MAIN}
    {PETALS_INNER}
    <circle cx="512" cy="512" r="86" fill="url(#core)"/>
  </g>
</svg>"""


def render(svg, size, path):
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path, output_width=size, output_height=size)
    print(f"  {os.path.relpath(path, DIST)}  {size}x{size}")


print("Moongrove icons → dist/")
render(APP_ICON, 1024, os.path.join(ICONS, "icon-1024.png"))
render(APP_ICON, 512, os.path.join(ICONS, "icon-512.png"))
render(APP_ICON, 192, os.path.join(ICONS, "icon-192.png"))
render(APP_ICON, 180, os.path.join(ICONS, "icon-180.png"))
render(MASKABLE, 512, os.path.join(ICONS, "icon-maskable-512.png"))
with open(os.path.join(DIST, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(FAVICON)
print("  favicon.svg")
print("done")
