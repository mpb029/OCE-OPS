"""Exact additive WP1 allowance for historical PDFs; never removes legacy text."""
READINESS = "NOGOMaterials:UnconfirmedMaterialsunconfirmed"


def legacy_text(original, actual, additions):
    assert isinstance(additions, list), "Missing verified Work Package additions"
    assert all("".join(text.split()) == READINESS for text in additions), "Unapproved WP text allowance"
    assert READINESS not in original, "Legacy report unexpectedly contains the new readiness text"
    assert actual.count(READINESS) == len(additions), "PDF must contain every DOM-verified readiness addition exactly once"
    # This exact sequence comprises only the new GO/materials/default blocking
    # reason. All pre-existing names, metadata, order and images remain compared.
    return actual.replace(READINESS, "")
