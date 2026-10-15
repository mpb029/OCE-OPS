"""F2-only whole-document text and actual photograph-draw preservation."""
import importlib.util
import sys
import json
import os
import re
from pypdf import PdfReader
from pathlib import Path

# Import the shared read-only parser without creating verification inputs mid-run.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("f1_pdf", Path(__file__).with_name("compare-report-refinement.py"))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def main():
    out = Path(os.environ.get("OCE_TEST_OUTPUT", "test-results"))
    folder = out / "punch-client-reports"
    results = []
    evidence = json.loads((out / "punch-client-results.json").read_text())
    for mode in ["punchlist", "client"]:
        before = helper.read_pdf(folder / f"before-{mode}.pdf")
        after = helper.read_pdf(folder / f"after-{mode}.pdf")
        photos = lambda doc: [im["hash"] for page in doc["images"] for im in page
                              if (im["width"], im["height"]) in [(960, 600), (600, 900)]]
        first_photo = next((n + 1 for n, page in enumerate(after["images"])
                            if any((im["width"], im["height"]) in [(960, 600), (600, 900)] for im in page)), None)
        result = {"mode": mode, "sameContent": before["text"] == after["text"],
                  "beforePages": before["pages"], "afterPages": after["pages"],
                  "photosPreserved": photos(before) == photos(after) and len(photos(after)) >= 6,
                  "photographs": len(photos(after)), "firstPhotoPage": first_photo}
        if mode == "punchlist":
            pages = [page.extract_text(extraction_mode="layout") for page in PdfReader(folder / "after-punchlist.pdf").pages]
            normal = lambda text: "".join(text.split())
            result["firstPageHasChecklist"] = "Comments:" in pages[0] and "Inspection notes:" in pages[0]
            appendix_page = next((n + 1 for n, text in enumerate(pages) if re.search(r"Punch\s*List\s*[\u2014-]\s*photos", text)), None)
            item = next(t for t in evidence["tests"] if "punch-editor/after:" in t["name"])
            label = item["detail"]["appendix"][0]
            result["appendixHeadingWithFirstPhoto"] = appendix_page is not None and appendix_page == first_photo
            result["firstPhotoHasItemLabel"] = first_photo is not None and normal(label) in normal(pages[first_photo - 1])
        results.append(result)
        print(json.dumps(result))
        if not result["sameContent"]:
            import difflib
            print(json.dumps({"characterDiff": list(difflib.unified_diff([before["text"]], [after["text"]]))[:10]}))
    (out / "punch-client-comparison.json").write_text(json.dumps(results, indent=2), encoding="utf8")
    assert all(r["sameContent"] and r["photosPreserved"] for r in results), "Punch List/Client content or photographs changed"
    assert all(r["afterPages"] <= r["beforePages"] for r in results), "Representative pagination increased"
    assert all(results[0][key] for key in ["firstPageHasChecklist", "appendixHeadingWithFirstPhoto", "firstPhotoHasItemLabel"]), "Punch List retains an orphan heading or unlabelled first photo"


if __name__ == "__main__":
    main()
