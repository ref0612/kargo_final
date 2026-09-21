"""Generates favicon.ico (64x64 PNG inside an ICO, no dependencies): KARGO mark = orange diamond on navy tile.
Usage: python scripts/make-favicon.py   (writes web/favicon.ico)"""
import math, struct, zlib
from pathlib import Path

N, SS = 64, 4                     # size, supersampling per axis
NAVY, ORANGE = (11, 27, 46), (255, 122, 47)

def rr(x, y, cx, cy, half, r):    # inside test for a rounded square (signed-distance)
    dx, dy = abs(x - cx) - (half - r), abs(y - cy) - (half - r)
    return math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) <= r

def px(i, j):
    """RGBA of pixel (i, j): average colour of covered subsamples, alpha = coverage."""
    cov, rgb = 0, [0, 0, 0]
    for a in range(SS):
        for b in range(SS):
            x, y = i + (a + .5) / SS, j + (b + .5) / SS
            if not rr(x, y, N / 2, N / 2, N / 2, 16):           # outside tile -> transparent
                continue
            u, v = x - N / 2, y - N / 2                          # rotate 45deg for the diamond
            ru, rv = (u + v) / math.sqrt(2) + N / 2, (v - u) / math.sqrt(2) + N / 2
            c = ORANGE if rr(ru, rv, N / 2, N / 2, 14, 6) else NAVY
            cov += 1
            rgb = [rgb[k] + c[k] for k in range(3)]
    if not cov:
        return (0, 0, 0, 0)
    return (rgb[0] // cov, rgb[1] // cov, rgb[2] // cov, cov * 255 // (SS * SS))

rows = b''.join(b'\x00' + b''.join(bytes(px(i, j)) for i in range(N)) for j in range(N))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
ico = struct.pack('<HHH', 0, 1, 1) + struct.pack('<BBBBHHII', N, N, 0, 0, 1, 32, len(png), 22) + png

root = Path(__file__).resolve().parent.parent
for p in (root / 'web' / 'favicon.ico',):
    p.write_bytes(ico)
    print('wrote', p, len(ico), 'bytes')
