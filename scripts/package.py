"""Deterministic ZIP with an explicit file list; verify every entry after writing."""
import json
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(sys.argv[1]).resolve()
destination = root / 'dist' / sys.argv[2]
files = json.load(sys.stdin)
destination.parent.mkdir(exist_ok=True)
expected = {}
for source, name in files:
    path = (root / source).resolve()
    if root not in path.parents or name.startswith('/') or '..' in Path(name).parts:
        raise ValueError('Archive path outside the project')
    expected[name] = path.read_bytes()
if len(expected) != len(files):
    raise ValueError('Duplicate archive entries')
with ZipFile(destination, 'w') as archive:
    for name, content in sorted(expected.items()):
        info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(expected)
    for name, content in expected.items():
        assert archive.read(name) == content, name
print(f'Verified {len(expected)} archive entries against source files.')
