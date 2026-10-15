"""Only F1's two report families: whole-document content and drawn images, not page parity."""
import hashlib
import json
import os
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream


def drawn_images(stream, resources, reader):
    """Count actual Do draws; page image resources can include undrawn images."""
    result = []
    if stream is None:
        return result
    for args, op in ContentStream(stream, reader).operations:
        if op != b'Do':
            continue
        obj = resources['/XObject'][args[0]].get_object()
        if obj.get('/Subtype') == '/Image':
            # Resource object numbers can change when pages reflow; decoded pixel
            # bytes and dimensions remain an exact content fingerprint.
            header = repr((obj.get('/Width'), obj.get('/Height'), obj.get('/BitsPerComponent'))).encode()
            result.append({'hash': hashlib.sha256(header + obj.get_data()).hexdigest(),
                           'width': int(obj['/Width']), 'height': int(obj['/Height'])})
        elif obj.get('/Subtype') == '/Form':
            result.extend(drawn_images(obj, obj.get('/Resources', resources), reader))
    return result


def read_pdf(path):
    reader = PdfReader(path)
    images = [drawn_images(page.get_contents(), page['/Resources'], reader) for page in reader.pages]
    # Chromium's PDF paint order can defer composited statistics text until after
    # the next card. Layout extraction restores physical reading order. Ignore
    # whitespace only: line/page breaks and newly separated title/date metadata
    # must not fail pagination refinement. Every other character remains ordered.
    text = ''.join(''.join(page.extract_text(extraction_mode='layout') for page in reader.pages).split())
    return {'pages': len(reader.pages), 'text': text, 'images': images}


def main():
    out = Path(os.environ.get('OCE_TEST_OUTPUT', 'test-results'))
    folder = out / 'report-refinement'
    results = []
    for mode in ['report', 'photos']:
        before = read_pdf(folder / f'before-{mode}.pdf')
        after = read_pdf(folder / f'after-{mode}.pdf')
        # Unique dimensions identify all synthetic landscape/portrait photographs,
        # excluding map tiles and the unchanged logo; preserve every draw in order.
        photos = lambda doc: [im['hash'] for page in doc['images'] for im in page
                              if (im['width'], im['height']) in [(960, 600), (600, 900)]]
        first_photo = next((n + 1 for n, page in enumerate(after['images'])
                            if any((im['width'], im['height']) in [(960, 600), (600, 900)] for im in page)), None)
        result = {'mode': mode, 'sameContent': before['text'] == after['text'],
                  'beforePages': before['pages'], 'afterPages': after['pages'],
                  'photosPreserved': photos(before) == photos(after) and len(photos(after)) >= 4,
                  'photographs': len(photos(after)), 'firstPhotoPage': first_photo}
        results.append(result)
        print(json.dumps(result))
        if not result['sameContent']:
            import difflib
            print(json.dumps({'wordDiff': list(difflib.unified_diff(before['text'].split(), after['text'].split(), n=3))[:100]}))
    (out / 'report-refinement-comparison.json').write_text(json.dumps(results, indent=2), encoding='utf8')
    assert all(r['sameContent'] and r['photosPreserved'] for r in results), 'Report content/photos changed'
    assert results[1]['firstPhotoPage'] == 1, 'Weekly photo report still has a heading-only opening page'
    assert all(r['afterPages'] <= r['beforePages'] for r in results), 'Representative report pagination increased'


if __name__ == '__main__':
    main()
