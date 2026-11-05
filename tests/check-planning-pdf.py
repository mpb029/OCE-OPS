"""PLN-001: verify only the three new native client-lookahead PDFs."""
import json,re,sys
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
folder=Path(sys.argv[1]);results=[]
for name in ['two-week-short','six-week-populated','client-visible-only']:
    path=folder/(name+'.pdf');reader=PdfReader(path);expected=json.loads((folder/(name+'-expected.json')).read_text())
    text='\n'.join(p.extract_text() or '' for p in reader.pages)
    assert 'PRIVATE' not in text,(name,'Private field leaked')
    ids=re.findall(r'CLIENT\s+ACTIVITY\s+(\d{3})',text)
    references=expected if isinstance(expected,list) else expected['references']
    wanted=[re.search(r'CLIENT ACTIVITY (\d{3})',x).group(1) for x in references]
    assert ids==wanted,(name,'Missing, duplicate or reordered rows',ids,wanted)
    assert 'not programme approval' in text.lower() or 'not programme' in text.lower()
    page_rows=[];sizes=[]
    with pdfplumber.open(path) as pdf:
        for i,p in enumerate(pdf.pages):
            assert abs(p.width-1190.55)<2 and abs(p.height-841.89)<2,(name,'Not A3 landscape',p.width,p.height)
            chars=[c for c in p.chars if c.get('text','').strip()]
            assert chars,(name,'Blank page',i+1)
            clipped=[c for c in chars if c['x0'] < -1 or c['x1']>p.width+1 or c['top'] < -1 or c['bottom']>p.height+1]
            assert not clipped,(name,'Clipped characters',i+1)
            rows=re.findall(r'CLIENT\s+ACTIVITY\s+(\d{3})',p.extract_text() or '')
            assert rows,(name,'Heading-only/empty page',i+1)
            assert any(header in (p.extract_text() or '') for header in ['Planned start','Recorded planned date','Recorded onsite date','Recorded status / dates','Outstanding approval or required decision']),(name,'Missing repeated header',i+1)
            page_rows.append(len(rows));sizes.extend(c['size'] for c in chars)
    if name=='six-week-populated':assert len(reader.pages)>=2,'Long report did not paginate'
    results.append({'file':path.name,'pages':len(reader.pages),'activity_rows':len(expected if isinstance(expected,list) else expected['activities']),'activity_references':len(ids),'references_per_page':page_rows,'min_font_pt':round(min(sizes),2),'a3_landscape':True,'clipped_characters':0,'private_fields':False})
(folder/'pdf-checks.json').write_text(json.dumps({'status':'PASS','reports':results},indent=2));print(json.dumps(results,indent=2))
