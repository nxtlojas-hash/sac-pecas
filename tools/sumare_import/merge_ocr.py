"""Merge a batch of OCR updates into ocr_results.json.

Usage:
    python -m tools.sumare_import.merge_ocr <batch_json_path>

Batch JSON format:
    [
      {
        "arquivo": "IMG-...jpg",
        "classification": "checklist" | "moto" | "outro",
        "ocr": { ... ChecklistOcr fields ... }   # null for non-checklists
      },
      ...
    ]
"""
from __future__ import annotations
import json, sys
from pathlib import Path

BASE = Path(__file__).parent
RESULTS = BASE / "data" / "ocr_results.json"


def merge(batch_path: Path) -> tuple[int, int]:
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    updates = json.loads(batch_path.read_text(encoding="utf-8"))
    by_file = {r["arquivo"]: r for r in results}

    applied = 0
    skipped = 0
    for u in updates:
        target = by_file.get(u["arquivo"])
        if not target:
            print(f"WARN: arquivo nao encontrado: {u['arquivo']}")
            skipped += 1
            continue
        target["classification"] = u["classification"]
        target["ocr"] = u.get("ocr")
        target["processed"] = True
        applied += 1

    RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return applied, skipped


def status() -> None:
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    done = [r for r in results if r["processed"]]
    checklists = sum(1 for r in done if r["classification"] == "checklist")
    motos = sum(1 for r in done if r["classification"] == "moto")
    outros = sum(1 for r in done if r["classification"] == "outro")
    print(f"Processadas: {len(done)}/{len(results)}")
    print(f"  Checklists: {checklists}")
    print(f"  Motos:      {motos}")
    print(f"  Outros:     {outros}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        status()
    else:
        batch = Path(sys.argv[1])
        applied, skipped = merge(batch)
        print(f"Aplicadas: {applied} | Puladas: {skipped}")
        status()
