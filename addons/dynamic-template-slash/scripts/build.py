def public_metadata(info):
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    info.mtime = 0
    info.pax_headers = {}
    return info

"""Build the dependency-free Joplin plugin archive."""
from pathlib import Path
import json
import tarfile

root = Path(__file__).resolve().parents[1]
plugin = root / 'plugin'
manifest = json.loads((plugin / 'manifest.json').read_text())
output = root / f"{manifest['id']}-{manifest['version']}.jpl"

with tarfile.open(output, 'w:gz') as archive:
    for name in ('manifest.json', 'index.js', 'contentScript.js'):
        archive.add(plugin / name, arcname=name, filter=public_metadata)

print(f"Built {output.name}")
