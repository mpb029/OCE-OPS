"""Compare complete report text and pagination; never modifies source or operational data."""
import json
import os
from pathlib import Path
from pypdf import PdfReader

folder = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results'))
results = []
for mode in ['report', 'dailyWorks', 'punchlist', 'photos', 'client']:
    before = PdfReader(folder / f'before-print-{mode}.pdf')
    after = PdfReader(folder / f'print-{mode}.pdf')
    old = [' '.join(p.extract_text().split()) for p in before.pages]
    new = [' '.join(p.extract_text().split()) for p in after.pages]
    result = {'report': mode, 'beforePages': len(old), 'afterPages': len(new), 'sameTextOnEveryPage': old == new}
    results.append(result)
    print(json.dumps(result))
    assert old == new, f'PDF pagination/content changed: {mode}'
(folder / 'print-comparison.json').write_text(json.dumps(results, indent=2), encoding='utf8')
