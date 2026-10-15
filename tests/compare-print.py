"""Compare complete report text and pagination; never modifies source or operational data."""
import json
import os
import importlib.util
import sys
from pathlib import Path
from pypdf import PdfReader

# Shared parser must not generate new verification inputs during a run.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('report_content', Path(__file__).with_name('compare-report-refinement.py'))
content = importlib.util.module_from_spec(spec)
spec.loader.exec_module(content)

folder = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results'))
results = []
for mode in ['report', 'dailyWorks', 'punchlist', 'photos', 'client']:
    before = PdfReader(folder / f'before-print-{mode}.pdf')
    after = PdfReader(folder / f'print-{mode}.pdf')
    old = [' '.join(p.extract_text().split()) for p in before.pages]
    new = [' '.join(p.extract_text().split()) for p in after.pages]
    result = {'report': mode, 'beforePages': len(old), 'afterPages': len(new), 'sameTextOnEveryPage': old == new}
    if mode in ['report', 'photos', 'client', 'punchlist']:
        original = content.read_pdf(folder / f'before-print-{mode}.pdf')
        actual = content.read_pdf(folder / f'print-{mode}.pdf')
        images = lambda doc: [image['hash'] for page in doc['images'] for image in page]
        result['sameContent'] = original['text'] == actual['text']
        result['photosPreserved'] = images(original) == images(actual)
    results.append(result)
    print(json.dumps(result))
    if mode in ['report', 'photos', 'client', 'punchlist']:
        assert result['sameContent'] and result['photosPreserved'], f'PDF content/image order changed: {mode}'
    else:
        assert old == new, f'PDF pagination/content changed: {mode}'
(folder / 'print-comparison.json').write_text(json.dumps(results, indent=2), encoding='utf8')
