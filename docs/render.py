"""docs/architecture.svg -> docs/architecture.png, via PyMuPDF.
MuPDF's SVG renderer ignores <marker> and stroke-dasharray, so this script draws the arrowheads as
polygons and tints 'reply' lines grey before rendering. Run: python docs/render.py
"""
import math
import re

import pymupdf

SRC, OUT = "docs/architecture.svg", "docs/architecture.png"
s = open(SRC, encoding="utf-8").read()


def head(x, y, dx, dy, color):
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    L, W = 13, 6
    pts = [(x, y), (x - L * ux + W * px, y - L * uy + W * py), (x - L * ux - W * px, y - L * uy - W * py)]
    return '<polygon points="%s" fill="%s"/>' % (" ".join(f"{a:.1f},{b:.1f}" for a, b in pts), color)


def fix_line(m):
    tag = m.group(0)
    g = lambda k: float(re.search(rf'{k}="([-\d.]+)"', tag).group(1))
    x1, y1, x2, y2 = g("x1"), g("y1"), g("x2"), g("y2")
    color = re.search(r'stroke="(#[0-9a-f]+)"', tag).group(1)
    tag = re.sub(r'\s*marker-end="[^"]+"', "", tag)
    return tag + head(x2, y2, x2 - x1, y2 - y1, color)


def fix_path(m):
    tag = m.group(0)
    pts = [tuple(map(float, p)) for p in re.findall(r"[ML]\s*([-\d.]+)\s+([-\d.]+)", tag)]
    color = re.search(r'stroke="(#[0-9a-f]+)"', tag).group(1)
    tag = re.sub(r'\s*marker-end="[^"]+"', "", tag)
    (ax, ay), (bx, by) = pts[-2], pts[-1]
    return tag + head(bx, by, bx - ax, by - ay, color)


s = re.sub(r'<line [^>]*marker-end="[^"]+"[^>]*/>', fix_line, s)
s = re.sub(r'<path [^>]*marker-end="[^"]+"[^>]*/>', fix_path, s)
# dashed = reply/local; MuPDF draws them solid, so make them grey instead
s = re.sub(r'(<(?:line|path)[^>]*)stroke="#1c1622"([^>]*stroke-dasharray)', r'\1stroke="#8a8094"\2', s)
s = s.replace('font-family="Helvetica, Arial, sans-serif"', 'font-family="Arial"')

doc = pymupdf.open(stream=s.encode("utf-8"), filetype="svg")
pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
pix.save(OUT)
print(OUT, pix.width, "x", pix.height)
