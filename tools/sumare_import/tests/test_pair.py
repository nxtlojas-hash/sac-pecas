from tools.sumare_import.pair import pair_checklists_with_motos


def _ev(ts, sender, photo):
    return {"ts": ts, "sender": sender, "kind": "photo", "photo": photo, "continuation": ""}


def test_pairs_sequential_checklist_then_moto_same_sender():
    events = [
        _ev("28/05/2026 11:42", "Emerson", "IMG-20260528-WA0068.jpg"),
        _ev("28/05/2026 11:43", "Emerson", "IMG-20260528-WA0069.jpg"),
    ]
    classifications = {
        "IMG-20260528-WA0068.jpg": "checklist",
        "IMG-20260528-WA0069.jpg": "moto",
    }
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert len(pairs) == 1
    assert pairs[0]["checklist"] == "IMG-20260528-WA0068.jpg"
    assert pairs[0]["moto"] == "IMG-20260528-WA0069.jpg"
    assert orphans == []


def test_orphan_moto_no_preceding_checklist():
    events = [
        _ev("28/05/2026 13:37", "Marcão", "IMG-20260528-WA0168.jpg"),
    ]
    classifications = {"IMG-20260528-WA0168.jpg": "moto"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert orphans == [{"arquivo": "IMG-20260528-WA0168.jpg", "kind": "moto"}]


def test_orphan_checklist_no_following_moto():
    events = [
        _ev("28/05/2026 14:00", "Leo", "IMG-20260528-WA0200.jpg"),
    ]
    classifications = {"IMG-20260528-WA0200.jpg": "checklist"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert orphans == [{"arquivo": "IMG-20260528-WA0200.jpg", "kind": "checklist"}]


def test_pair_only_with_close_timestamp_same_sender():
    events = [
        _ev("28/05/2026 13:00", "Emerson", "IMG-A.jpg"),
        _ev("28/05/2026 13:05", "Leo",     "IMG-B.jpg"),
    ]
    classifications = {"IMG-A.jpg": "checklist", "IMG-B.jpg": "moto"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert len(orphans) == 2
