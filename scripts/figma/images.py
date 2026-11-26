"""Converts captured image URLs to JPEG (or PNG when transparent) for Figma, which cannot read WebP."""
import base64, io, json, sys
from PIL import Image

items = json.load(open(sys.argv[1]))
out = []
for it in items:
    try:
        if it.get('data'):
            raw = base64.b64decode(it['data'].split(',', 1)[1])
            im = Image.open(io.BytesIO(raw))
        else:
            im = Image.open(it['file'])
        im.load()
        alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        im = im.convert('RGBA' if alpha else 'RGB')
        im.thumbnail((1600, 1600))
        buf = io.BytesIO()
        if alpha:
            im.save(buf, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            im.save(buf, 'JPEG', quality=86, optimize=True, progressive=True)
            mime = 'image/jpeg'
        out.append({'key': it['key'], 'mime': mime, 'width': im.width, 'height': im.height, 'base64': base64.b64encode(buf.getvalue()).decode()})
    except Exception as e:  # keep going; the plugin shows a placeholder colour
        sys.stderr.write(f"image skipped {it['url']}: {e}\n")
print(json.dumps(out))
