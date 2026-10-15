"""Verify all ZIP bytes against the independently restored full-bundle manifest."""
import hashlib
import json
import os
import zipfile
from pathlib import Path

folder = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results'))
manifest = json.loads((folder / 'recovery-manifest.json').read_text(encoding='utf8'))
expected = {f['path']: f for f in manifest['files']}
with zipfile.ZipFile(folder / 'OCE-OPS-source-and-attachments.zip') as archive:
    assert archive.testzip() is None
    names = {i.filename for i in archive.infolist() if not i.is_dir()}
    assert names == set(expected)
    for name in names:
        assert hashlib.sha256(archive.read(name)).hexdigest() == expected[name]['sha256'], name
result = {'commit': manifest['commit'], 'allTrackedFilesPresent': True, 'filesVerified': len(names),
          'zipCRC': 'PASS', 'everyFileSHA256': 'PASS'}
(folder / 'source-archive-validation.json').write_text(json.dumps(result, indent=2), encoding='utf8')
print(json.dumps(result))
