"""Match WhatsApp 29/05 entries against our in-loco motos planilha.

Estrategia:
1. Indexa nossas motos por (telefone_ultimos_4, nome_primeiro_token)
2. Para cada entrada do WhatsApp, busca pelo telefone -> match forte
3. Fallback: fuzzy match no nome
"""
from __future__ import annotations
import json, re
from pathlib import Path
from difflib import SequenceMatcher

BASE = Path(__file__).parent
DATA = BASE / "data"


def _phone_last4(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return digits[-4:] if len(digits) >= 4 else None


def _first_token(name: str | None) -> str | None:
    if not name:
        return None
    return re.split(r"\s+", name.strip())[0].lower()


def _name_similarity(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def score_match(moto: dict, wa_entry: dict) -> tuple[int, list[str]]:
    """Score a moto vs whatsapp entry. Returns (score, reasons)."""
    score = 0
    reasons: list[str] = []

    # 1. Phone match
    moto_p4 = _phone_last4(moto.get("telefone"))
    wa_p4 = wa_entry.get("cel_4dig")
    if moto_p4 and wa_p4 and moto_p4 == wa_p4:
        score += 50
        reasons.append(f"tel_match:{moto_p4}")

    # 2. Name match (first token)
    moto_first = _first_token(moto.get("nome"))
    wa_first = _first_token(wa_entry.get("cliente"))
    if moto_first and wa_first and moto_first == wa_first:
        score += 25
        reasons.append(f"nome_primeiro:{moto_first}")
    elif moto_first and wa_first:
        sim = _name_similarity(moto_first, wa_first)
        if sim >= 0.8:
            score += 15
            reasons.append(f"nome_fuzzy:{moto_first}~{wa_first}({sim:.2f})")

    # 3. Full name fuzzy
    sim_full = _name_similarity(moto.get("nome"), wa_entry.get("cliente"))
    if sim_full >= 0.7:
        score += 15
        reasons.append(f"nome_completo_fuzzy:{sim_full:.2f}")

    # 4. Modelo match
    if moto.get("modelo_nxt") and wa_entry.get("modelo"):
        if moto["modelo_nxt"].lower() in wa_entry["modelo"].lower() or \
           wa_entry["modelo"].lower().startswith(moto["modelo_nxt"].lower()):
            score += 10
            reasons.append(f"modelo:{moto['modelo_nxt']}")

    # 5. Cor match
    if moto.get("cor") and wa_entry.get("cor"):
        if moto["cor"].lower() == wa_entry["cor"].lower():
            score += 5
            reasons.append(f"cor:{moto['cor']}")

    return score, reasons


def match_all(motos: list[dict], wa_assistencia: list[dict]) -> tuple[list[dict], set[int]]:
    """Para cada moto, anota best match no WhatsApp. Retorna motos enriquecidas e indices WA utilizados."""
    used_wa: set[int] = set()
    enriched = []
    THRESHOLD = 40

    for m in motos:
        best_score = 0
        best_idx = None
        best_reasons: list[str] = []
        for i, wa in enumerate(wa_assistencia):
            score, reasons = score_match(m, wa)
            if score > best_score:
                best_score = score
                best_idx = i
                best_reasons = reasons

        enriched_m = dict(m)
        if best_score >= THRESHOLD and best_idx is not None:
            wa = wa_assistencia[best_idx]
            used_wa.add(best_idx)
            enriched_m["wa_match"] = "Sim"
            enriched_m["wa_match_score"] = best_score
            enriched_m["wa_match_razoes"] = ", ".join(best_reasons)
            enriched_m["wa_motivo_29_05"] = wa.get("motivo")
            enriched_m["wa_modelo_29_05"] = wa.get("modelo")
            enriched_m["wa_cor_29_05"] = wa.get("cor")
            enriched_m["wa_cidade_29_05"] = wa.get("cidade")
            enriched_m["wa_cliente_29_05"] = wa.get("cliente")
            # Conflitos
            conflitos = []
            if m.get("modelo_nxt") and wa.get("modelo") and \
               m["modelo_nxt"].lower() not in wa["modelo"].lower() and \
               wa["modelo"].lower() not in m["modelo_nxt"].lower():
                conflitos.append(f"modelo: nosso={m['modelo_nxt']} vs WA={wa['modelo']}")
            if m.get("cor") and wa.get("cor") and m["cor"].lower() != wa["cor"].lower():
                conflitos.append(f"cor: nosso={m['cor']} vs WA={wa['cor']}")
            enriched_m["wa_conflitos"] = "; ".join(conflitos) if conflitos else ""
            enriched_m["categoria"] = "Cliente (assistência)"
        else:
            enriched_m["wa_match"] = "Não"
            enriched_m["wa_match_score"] = best_score
            enriched_m["wa_match_razoes"] = ", ".join(best_reasons) if best_reasons else ""
            enriched_m["wa_motivo_29_05"] = None
            enriched_m["wa_modelo_29_05"] = None
            enriched_m["wa_cor_29_05"] = None
            enriched_m["wa_cidade_29_05"] = None
            enriched_m["wa_cliente_29_05"] = None
            enriched_m["wa_conflitos"] = ""
            # Se for moto NXT (estoque do incendio), categoria = Cemiterio/Estoque NXT
            if m.get("nome") and "nxt" in m["nome"].lower():
                enriched_m["categoria"] = "Cemitério / Estoque NXT"
            else:
                enriched_m["categoria"] = "Cliente (assistência)"

        enriched.append(enriched_m)

    return enriched, used_wa


def main() -> None:
    motos_dict = json.loads((DATA / "motos.json").read_text(encoding="utf-8"))
    wa_ass = json.loads((DATA / "assistencia_29_05.json").read_text(encoding="utf-8"))
    wa_cem = json.loads((DATA / "cemiterio_29_05.json").read_text(encoding="utf-8"))

    enriched, used_indices = match_all(motos_dict, wa_ass)

    # WhatsApp entries que NAO bateram com nenhuma moto (sao motos NOVAS no galpao)
    novas_wa = [wa for i, wa in enumerate(wa_ass) if i not in used_indices]

    # Salvar
    (DATA / "motos_enriched.json").write_text(
        json.dumps(enriched, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    (DATA / "wa_novas.json").write_text(
        json.dumps(novas_wa, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Motos enriquecidas: {len(enriched)}")
    matched = sum(1 for m in enriched if m.get("wa_match") == "Sim")
    print(f"  Match com WhatsApp: {matched}")
    print(f"  Sem match:         {len(enriched) - matched}")
    print(f"Novas motos do WhatsApp (sem foto in-loco): {len(novas_wa)}")
    print(f"Cemiterio: {len(wa_cem)}")

    # Listar matches por score
    print("\n=== Matches por score ===")
    by_score: dict[str, int] = {}
    for m in enriched:
        s = m.get("wa_match_score", 0)
        bucket = "0" if s == 0 else "1-39" if s < 40 else "40-59" if s < 60 else "60-89" if s < 90 else "90+"
        by_score[bucket] = by_score.get(bucket, 0) + 1
    for k, v in sorted(by_score.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
