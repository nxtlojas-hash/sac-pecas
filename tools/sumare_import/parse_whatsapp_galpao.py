"""Parse texto do WhatsApp 'Motos da assistência / Oficina retirada peças' 29/05/2026.

Extrai 2 listas:
1. 'cemiterio': motos da NXT canibalizadas para retirar pecas
2. 'assistencia': motos de clientes em servico (com nome, ultimos 4 digitos do tel, cidade, motivo)

Formato de entrada (heuristica):
    Modelo: <model> <color>
    Cliente: <nome>  cel: <4digitos>  <cidade>
    Motivo: <texto>
"""
from __future__ import annotations
import re
import json
from pathlib import Path
from typing import Optional

BASE = Path(__file__).parent
SOURCE = BASE / "data" / "whatsapp_29_05.txt"
OUT_CEM = BASE / "data" / "cemiterio_29_05.json"
OUT_ASS = BASE / "data" / "assistencia_29_05.json"


def _split_modelo_cor(s: str) -> tuple[Optional[str], Optional[str]]:
    """Split 'Hyphen roxa' into ('Hyphen', 'Roxa'). Handles multi-word models."""
    s = s.strip()
    if not s:
        return None, None
    # E-kay or Ekay -> Kay (custom mapping later)
    parts = s.split()
    if len(parts) == 1:
        return parts[0].capitalize(), None
    # 'Juna smart preta' -> Juna Smart + Preta
    # 'Luna cross vermelha' -> Luna + Cross + Vermelha? Cross is not a model variant in our list; treat last word as color
    if len(parts) >= 3:
        model = " ".join(p.capitalize() for p in parts[:-1])
        cor = parts[-1].capitalize()
        return model, cor
    return parts[0].capitalize(), parts[1].capitalize()


def _normalize_modelo(m: Optional[str]) -> Optional[str]:
    """Normalize model name to one of the 12 NXT models. Returns None if unmappable."""
    if not m:
        return None
    m_low = m.lower().strip()
    aliases = {
        "ekay": "Kay", "e-kay": "Kay", "kay": "Kay",
        "jaya": "Jaya",
        "luna": "Luna", "luna cross": "Luna",
        "shaka": "Shaka",
        "zilla": "Zilla", "zila": "Zilla", "zilla prata antiga": "Zilla",
        "juna smart": "Juna Smart",
        "juna": "Juna",
        "gataka": "Gataka",
        "pancho": "Pancho",
        "hyphen": "Hyphen",
        "vega": "Vega",
        "kimbo": "Kimbo",
        "luma": "Luna",  # typo no whatsapp
        "yzl": "?Yzl",  # nao reconhecido
        "maria vizan": "?Maria Vizan",  # nao reconhecido / provavel erro de digitacao
        "zila fendy": "Zilla",
    }
    return aliases.get(m_low, m)


def _parse_cliente_line(line: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Parse 'Cliente: <nome>  cel: <4>  <cidade>' -> (nome, cel4, cidade)."""
    txt = line.split(":", 1)[1].strip() if ":" in line else line
    # find 'cel'
    cel_match = re.search(r"\bcel(?:a)?\s*:\s*([\d]{3,5})", txt, re.IGNORECASE)
    if cel_match:
        cel4 = cel_match.group(1)[-4:]
        before = txt[:cel_match.start()].strip()
        after = txt[cel_match.end():].strip()
        nome = before if before else None
        cidade = after if after else None
        return nome, cel4, cidade
    return (txt.strip() or None), None, None


def parse_text(raw: str) -> dict:
    lines = raw.split("\n")
    cemiterio: list[dict] = []
    assistencia: list[dict] = []

    mode = None  # 'cemiterio' | 'assistencia'
    current: Optional[dict] = None

    def flush():
        if current is None:
            return
        if mode == "cemiterio":
            cemiterio.append(current)
        elif mode == "assistencia":
            assistencia.append(current)

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        # Headers
        if line.startswith("Oficina Nxt retirada de peças"):
            flush()
            current = None
            mode = "cemiterio"
            continue
        if line.startswith("Motos da assistência"):
            flush()
            current = None
            mode = "assistencia"
            continue

        # 'Modelo: ...' or first line of moto in cemiterio without prefix
        if line.lower().startswith("modelo:"):
            flush()
            raw_mc = line.split(":", 1)[1].strip()
            modelo, cor = _split_modelo_cor(raw_mc)
            current = {
                "modelo": _normalize_modelo(modelo) or modelo,
                "modelo_raw": modelo,
                "cor": cor,
                "cliente": None,
                "cel_4dig": None,
                "cidade": None,
                "motivo": None,
                "fonte": mode,
            }
        elif line.lower().startswith("cliente"):
            if current is None:
                continue
            nome, cel4, cidade = _parse_cliente_line(line)
            current["cliente"] = nome
            current["cel_4dig"] = cel4
            current["cidade"] = cidade
        elif line.lower().startswith("motivo:"):
            if current is None:
                continue
            current["motivo"] = line.split(":", 1)[1].strip()
        elif line.startswith("•") or line.startswith("*"):
            if current is None:
                continue
            # Bullet observation
            obs = line.lstrip("•*").strip()
            if "motivo" in obs.lower() or current.get("motivo") is None:
                current["motivo"] = obs
            else:
                current["motivo"] = f"{current['motivo']}; {obs}"
        elif line.lower().startswith("obs:"):
            if current is None:
                continue
            current["motivo"] = (current["motivo"] or "") + " | Obs: " + line.split(":", 1)[1].strip()
        elif mode == "assistencia" and not line.lower().startswith(("cliente", "modelo:", "motivo:")):
            # Standalone first-line of an entry without 'Modelo:' prefix
            # E.g. 'Shaka verde militar' at start of assistencia section
            if current is None or (current.get("cliente") and current.get("motivo")):
                flush()
                modelo, cor = _split_modelo_cor(line)
                current = {
                    "modelo": _normalize_modelo(modelo) or modelo,
                    "modelo_raw": modelo,
                    "cor": cor,
                    "cliente": None,
                    "cel_4dig": None,
                    "cidade": None,
                    "motivo": None,
                    "fonte": mode,
                }
    flush()
    return {"cemiterio": cemiterio, "assistencia": assistencia}


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")
    result = parse_text(raw)
    OUT_CEM.write_text(json.dumps(result["cemiterio"], ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_ASS.write_text(json.dumps(result["assistencia"], ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Cemiterio: {len(result['cemiterio'])} entradas -> {OUT_CEM}")
    print(f"Assistencia: {len(result['assistencia'])} entradas -> {OUT_ASS}")


if __name__ == "__main__":
    main()
