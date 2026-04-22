#!/usr/bin/env python
"""
Generate PNG icons for the DyslexiaEase Chrome extension.
Run: python generate_icons.py
Requires: Python 3 only (no external dependencies).
"""

import struct
import zlib
import math
import os


# ── Colour palette ──────────────────────────────────────────────────────────

TEAL   = (78, 205, 196)   # #4ECDC4
WHITE  = (255, 255, 255)
DARK   = (30,  41,  59)   # text on icon


# ── Minimal raw-PNG writer ───────────────────────────────────────────────────

def _chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: str, pixels: list, w: int, h: int) -> None:
    """Write an RGBA PNG from a list of (r,g,b,a) rows."""
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # colour type 6 = RGBA
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type = None
        for r, g, b, a in row:
            raw.extend((r, g, b, a))
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(_chunk(b"IHDR", ihdr))
        f.write(_chunk(b"IDAT", idat))
        f.write(_chunk(b"IEND", b""))


# ── Icon renderer ────────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def create_icon(size: int) -> list:
    """
    Render a rounded-square icon:
      - Teal background with a subtle radial sheen
      - Three white horizontal 'text' bars (symbolising readable text)
    """
    pixels = []
    cx = cy = size / 2.0 - 0.5
    sq_r  = size * 0.44          # half-side of the rounded square
    cr    = size * 0.22          # corner radius

    # Bar geometry (relative, -1…+1 space)
    bars = [
        (-0.26, 0.55),   # (centre_y_rel, half_x_extent_rel)
        ( 0.0,  0.55),
        ( 0.26, 0.33),   # shorter last bar
    ]
    bar_half_h = 0.10    # half-height of each bar in rel coords

    for y in range(size):
        row = []
        for x in range(size):
            # ── Is this pixel inside the rounded square? ──────────────────
            dx = abs(x - cx) - (sq_r - cr)
            dy = abs(y - cy) - (sq_r - cr)
            if dx <= 0 and dy <= 0:
                inside = True
            elif dx <= 0:
                inside = dy <= cr
            elif dy <= 0:
                inside = dx <= cr
            else:
                inside = math.sqrt(dx * dx + dy * dy) <= cr

            if not inside:
                row.append((0, 0, 0, 0))
                continue

            # ── Radial sheen ──────────────────────────────────────────────
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size * 0.5)
            shade = 1.0 - 0.18 * dist          # slight darkening toward edge
            bg = tuple(int(c * shade) for c in TEAL)

            # ── Bar test ──────────────────────────────────────────────────
            rel_y = (y - cy) / sq_r
            rel_x = (x - cx) / sq_r

            in_bar = False
            for (bar_cy, bar_xmax) in bars:
                if abs(rel_y - bar_cy) <= bar_half_h and abs(rel_x) <= bar_xmax:
                    in_bar = True
                    break

            if in_bar:
                row.append((*WHITE, 255))
            else:
                row.append((*bg, 255))

        pixels.append(row)
    return pixels


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs("icons", exist_ok=True)
    for size in (16, 48, 128):
        pixels = create_icon(size)
        path = f"icons/icon{size}.png"
        write_png(path, pixels, size, size)
        print(f"  ✓  {path}  ({size}×{size})")
    print("Done — icons/ folder is ready.")


if __name__ == "__main__":
    main()
