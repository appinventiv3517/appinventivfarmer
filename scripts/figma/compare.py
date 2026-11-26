"""Compares real screenshots with screens rebuilt from the Figma JSON.
Prints per-screen pixel agreement and writes side-by-side images for review.
   python3 compare.py <real_dir> <preview_dir> <out_dir>"""
import os, sys
from PIL import Image, ImageChops

real, prev, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
rows = []
for f in sorted(os.listdir(real)):
    pf = os.path.join(prev, f)
    if not os.path.exists(pf):
        continue
    a = Image.open(os.path.join(real, f)).convert('RGB')
    b = Image.open(pf).convert('RGB')
    if b.size != a.size:
        # compare the common area (screens can differ by a few pixels in total height)
        h = min(a.height, b.height)
        a = a.crop((0, 0, min(a.width, b.width), h)); b = b.crop((0, 0, min(a.width, b.width), h))
    d = ImageChops.difference(a, b).convert('L')
    hist = d.histogram()
    total = a.size[0] * a.size[1]
    close = sum(hist[:33]) / total  # within 32/255 per pixel
    rows.append((close, f))
    side = Image.new('RGB', (a.width * 2 + 12, a.height), 'white')
    side.paste(a, (0, 0)); side.paste(b, (a.width + 12, 0))
    side.save(os.path.join(out, f))
rows.sort()
for close, f in rows:
    print(f'{close * 100:5.1f}%  {f}')
print(f'average {sum(r[0] for r in rows) / max(1, len(rows)) * 100:.1f}% of pixels match across {len(rows)} screens')
