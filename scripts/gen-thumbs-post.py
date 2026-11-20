"""Convert rendered basemap PNGs to small JPEG thumbnails + build the Auto (Paper/Soot) split.
Run after gen-thumbs.mjs:  python scripts/gen-thumbs-post.py
"""
import os
from PIL import Image, ImageDraw

D = os.path.join(os.path.dirname(__file__), '..', 'public', 'basemaps')
SIZE = (240, 180)

for f in sorted(os.listdir(D)):
    if not f.endswith('.png'):
        continue
    im = Image.open(os.path.join(D, f)).convert('RGB').resize(SIZE, Image.LANCZOS)
    im.save(os.path.join(D, f[:-4] + '.jpg'), quality=80, optimize=True, progressive=True)
    os.remove(os.path.join(D, f))

paper = Image.open(os.path.join(D, 'positron.jpg'))
soot = Image.open(os.path.join(D, 'dark.jpg'))
mask = Image.new('L', SIZE, 0)
ImageDraw.Draw(mask).polygon([(SIZE[0], 0), (SIZE[0], SIZE[1]), (0, SIZE[1])], fill=255)  # lower-right triangle = dark
auto = Image.composite(soot, paper, mask)
ImageDraw.Draw(auto).line([(SIZE[0], 0), (0, SIZE[1])], fill=(255, 106, 31), width=2)
auto.save(os.path.join(D, 'auto.jpg'), quality=80, optimize=True, progressive=True)

for f in sorted(os.listdir(D)):
    print(f, os.path.getsize(os.path.join(D, f)) // 1024, 'KB')
