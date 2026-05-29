"""Copy and rename photos to out/Fotos/ using M-IDs."""
from __future__ import annotations
import shutil
from pathlib import Path
from typing import Any


def organize(
    motos: list[dict[str, Any]],
    source_dir: Path,
    out_dir: Path,
) -> dict[str, int]:
    """Copia fotos com novos nomes. Retorna {checklists: N, motos: N, extras: N}."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stats = {"checklists": 0, "motos": 0, "extras": 0, "missing": 0}
    for m in motos:
        mid = m["id"]
        if m.get("foto_checklist_src"):
            src = source_dir / m["foto_checklist_src"]
            if src.exists():
                dst = out_dir / f"{mid}-checklist.jpg"
                shutil.copy2(src, dst)
                stats["checklists"] += 1
            else:
                stats["missing"] += 1
        if m.get("foto_moto_src"):
            src = source_dir / m["foto_moto_src"]
            if src.exists():
                dst = out_dir / f"{mid}-moto.jpg"
                shutil.copy2(src, dst)
                stats["motos"] += 1
            else:
                stats["missing"] += 1
        for idx, extra in enumerate(m.get("fotos_extras_src", []), start=1):
            src = source_dir / extra
            if src.exists():
                dst = out_dir / f"{mid}-extra-{idx}.jpg"
                shutil.copy2(src, dst)
                stats["extras"] += 1
            else:
                stats["missing"] += 1
    return stats
