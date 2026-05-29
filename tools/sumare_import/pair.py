"""Pair checklist photos with moto photos using sender + timestamp proximity."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any

WINDOW = timedelta(minutes=3)


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%d/%m/%Y %H:%M")


def pair_checklists_with_motos(
    events: list[dict[str, Any]],
    classifications: dict[str, str],
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """
    Build pairs of (checklist photo, moto photo).
    Pareamento: para cada checklist, a próxima foto-moto do mesmo sender em até WINDOW.
    Retorna (pairs, orphans).
    """
    photos = [
        e for e in events
        if e["kind"] == "photo" and e["photo"] in classifications
    ]
    used: set[str] = set()
    pairs: list[dict[str, str]] = []

    for i, ev in enumerate(photos):
        if classifications.get(ev["photo"]) != "checklist":
            continue
        if ev["photo"] in used:
            continue
        ev_ts = _parse_ts(ev["ts"])
        for j in range(i + 1, len(photos)):
            cand = photos[j]
            if cand["photo"] in used:
                continue
            if classifications.get(cand["photo"]) != "moto":
                continue
            if cand["sender"] != ev["sender"]:
                continue
            cand_ts = _parse_ts(cand["ts"])
            if cand_ts - ev_ts > WINDOW:
                break
            pairs.append({
                "checklist": ev["photo"],
                "moto": cand["photo"],
                "ts": ev["ts"],
                "sender": ev["sender"],
            })
            used.add(ev["photo"])
            used.add(cand["photo"])
            break

    orphans = [
        {"arquivo": ev["photo"], "kind": classifications[ev["photo"]]}
        for ev in photos if ev["photo"] not in used
    ]
    return pairs, orphans
