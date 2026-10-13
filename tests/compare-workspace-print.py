"""Repeat full per-page text and pagination comparisons from three workspace routes."""
import json
import os
from pathlib import Path
from pypdf import PdfReader

folder = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results')) / 'workspace-pdfs'
results = []
for mode in ['report', 'dailyWorks', 'punchlist', 'photos', 'client']:
    original = [' '.join(p.extract_text().split()) for p in PdfReader(folder / f'baseline-{mode}.pdf').pages]
    for route in ['operations', 'site', 'all']:
        actual = [' '.join(p.extract_text().split()) for p in PdfReader(folder / f'{route}-{mode}.pdf').pages]
        result = {'family': mode, 'workspace': route, 'baselinePages': len(original), 'actualPages': len(actual), 'sameTextOnEveryPage': actual == original}
        results.append(result)
        print(json.dumps(result))
(folder / 'comparison-results.json').write_text(json.dumps(results, indent=2), encoding='utf8')
assert all(r['sameTextOnEveryPage'] for r in results), 'Workspace changed printed content/pagination'
