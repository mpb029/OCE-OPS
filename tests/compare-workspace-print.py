"""Repeat full per-page text and pagination comparisons from three workspace routes."""
import json
import difflib
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
spec = importlib.util.spec_from_file_location('wp_parity', Path(__file__).with_name('work-package-parity.py'))
wp_parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wp_parity)

folder = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results')) / 'workspace-pdfs'
captures = json.loads((folder / 'capture-results.json').read_text())['reports']
results = []
for mode in ['report', 'dailyWorks', 'punchlist', 'photos', 'client']:
    original = [' '.join(p.extract_text().split()) for p in PdfReader(folder / f'baseline-{mode}.pdf').pages]
    for route in ['operations', 'site', 'all', 'overview']:
        actual = [' '.join(p.extract_text().split()) for p in PdfReader(folder / f'{route}-{mode}.pdf').pages]
        result = {'family': mode, 'workspace': route, 'baselinePages': len(original), 'actualPages': len(actual), 'sameTextOnEveryPage': actual == original}
        if mode in ['report', 'photos', 'client', 'punchlist']:
            old_document = content.read_pdf(folder / f'baseline-{mode}.pdf')
            new_document = content.read_pdf(folder / f'{route}-{mode}.pdf')
            images = lambda doc: [image['hash'] for page in doc['images'] for image in page]
            capture = next(item for item in captures if item['mode'] == mode and item['route'] == route)
            permitted = capture['workPackageAdditions']
            result['sameContent'] = old_document['text'] == wp_parity.legacy_text(old_document['text'], new_document['text'], permitted)
            result['verifiedReadinessAdditions'] = len(permitted)
            result['photosPreserved'] = images(old_document) == images(new_document)
        results.append(result)
        print(json.dumps(result))
        if actual != original:
            first = next((i for i in range(min(len(original), len(actual))) if original[i] != actual[i]), min(len(original), len(actual)))
            before = original[first] if first < len(original) else ''
            after = actual[first] if first < len(actual) else ''
            print(json.dumps({'firstDifferentPage': first + 1,
                              'firstPageDiff': list(difflib.unified_diff(before.split(), after.split(), n=5))[:100]}))
(folder / 'comparison-results.json').write_text(json.dumps(results, indent=2), encoding='utf8')
assert all((r['sameContent'] and r['photosPreserved']) if r['family'] in ['report', 'photos', 'client', 'punchlist'] else r['sameTextOnEveryPage']
           for r in results), 'Workspace changed printed content/images or unapproved report pagination'
