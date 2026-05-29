"""Match motos enriquecidas contra a planilha CASOS SAC E SUMARE.

Cruza por telefone (ultimos 4) + nome fuzzy. Foco na aba
'ASSISTÊNCIA SUMARE - AGUARDANDO' que e a mais relevante;
inclui tambem 'CLIENTES SAC PECAS' como secundario.
"""
from __future__ import annotations
import json, re
from pathlib import Path
from difflib import SequenceMatcher

BASE = Path(__file__).parent
DATA = BASE / "data"


def _phone_last4(phone) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    return digits[-4:] if len(digits) >= 4 else None


def _normalize_name(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def _name_similarity(a, b) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _normalize_name(a), _normalize_name(b)).ratio()


def _score(moto: dict, sac_entry: dict, fields_map: dict) -> tuple[int, list[str]]:
    """Score a moto vs SAC entry. fields_map tells which keys to use."""
    score = 0
    reasons = []
    moto_p4 = _phone_last4(moto.get("telefone"))
    sac_p4 = _phone_last4(sac_entry.get(fields_map["telefone"]))
    if moto_p4 and sac_p4 and moto_p4 == sac_p4:
        score += 50
        reasons.append(f"tel:{moto_p4}")

    moto_nome = moto.get("nome")
    sac_nome = sac_entry.get(fields_map["cliente"])
    if moto_nome and sac_nome:
        sim = _name_similarity(moto_nome, sac_nome)
        if sim >= 0.8:
            score += 30
            reasons.append(f"nome_fuzzy:{sim:.2f}")
        elif sim >= 0.6:
            score += 15
            reasons.append(f"nome_fuzzy_baixo:{sim:.2f}")
        else:
            # first token match
            moto_first = _normalize_name(moto_nome).split()[0]
            sac_first = _normalize_name(sac_nome).split()[0]
            if moto_first == sac_first:
                score += 20
                reasons.append(f"primeiro_nome:{moto_first}")

    moto_modelo = moto.get("modelo_nxt")
    sac_modelo = sac_entry.get(fields_map["modelo"])
    if moto_modelo and sac_modelo:
        if moto_modelo.lower() in str(sac_modelo).lower():
            score += 5
            reasons.append(f"modelo:{moto_modelo}")
    return score, reasons


SHEET_AGUARDANDO = "ASSISTÊNCIA SUMARE - AGUARDANDO"
SHEET_PECAS = "CLIENTES SAC PEÇAS - KAY E OUTR"

FIELDS_AGUARDANDO = {
    "cliente": "Cliente",
    "telefone": "TELEFONE ",
    "modelo": "Modelo",
    "status": "STATUS ",
    "acao": "Ação / Status",
    "pecas": "PEÇAS ",
}

FIELDS_PECAS = {
    "cliente": "Cliente - PENDÊNCIAS",
    "telefone": "TELEFONE",
    "modelo": "Modelo",
    "status": "SITUAÇÃO ",
    "acao": "RESUMO ",
}


def match_against_sac(motos: list[dict], sac_data: dict) -> list[dict]:
    """Add SAC match info to each moto."""
    aguardando = sac_data.get(SHEET_AGUARDANDO, [])
    pecas = sac_data.get(SHEET_PECAS, [])

    THRESHOLD = 40
    enriched = []
    for m in motos:
        # Best match no aguardando
        best_agu_score = 0
        best_agu = None
        for e in aguardando:
            s, _ = _score(m, e, FIELDS_AGUARDANDO)
            if s > best_agu_score:
                best_agu_score = s
                best_agu = e
        # Best match no pecas
        best_pec_score = 0
        best_pec = None
        for e in pecas:
            s, _ = _score(m, e, FIELDS_PECAS)
            if s > best_pec_score:
                best_pec_score = s
                best_pec = e

        em = dict(m)
        em["sac_match_aguardando"] = "Sim" if best_agu_score >= THRESHOLD else "Não"
        em["sac_match_aguardando_score"] = best_agu_score
        if best_agu_score >= THRESHOLD and best_agu:
            em["sac_status_aguardando"] = best_agu.get(FIELDS_AGUARDANDO["status"]) or ""
            em["sac_pecas_solicitadas"] = best_agu.get(FIELDS_AGUARDANDO["pecas"]) or ""
            em["sac_acao_aguardando"] = best_agu.get(FIELDS_AGUARDANDO["acao"]) or ""
        else:
            em["sac_status_aguardando"] = ""
            em["sac_pecas_solicitadas"] = ""
            em["sac_acao_aguardando"] = ""

        em["sac_match_pecas"] = "Sim" if best_pec_score >= THRESHOLD else "Não"
        em["sac_match_pecas_score"] = best_pec_score
        if best_pec_score >= THRESHOLD and best_pec:
            em["sac_resumo_pecas"] = best_pec.get(FIELDS_PECAS["acao"]) or ""
            em["sac_situacao_pecas"] = best_pec.get(FIELDS_PECAS["status"]) or ""
        else:
            em["sac_resumo_pecas"] = ""
            em["sac_situacao_pecas"] = ""

        enriched.append(em)
    return enriched


def main() -> None:
    motos = json.loads((DATA / "motos_enriched.json").read_text(encoding="utf-8"))
    sac = json.loads((DATA / "casos_sac_sumare.json").read_text(encoding="utf-8"))
    enriched = match_against_sac(motos, sac)
    (DATA / "motos_full_enriched.json").write_text(
        json.dumps(enriched, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    matched_agu = sum(1 for m in enriched if m.get("sac_match_aguardando") == "Sim")
    matched_pec = sum(1 for m in enriched if m.get("sac_match_pecas") == "Sim")
    print(f"Total motos: {len(enriched)}")
    print(f"  Match SAC Aguardando: {matched_agu}")
    print(f"  Match SAC Pecas:      {matched_pec}")


if __name__ == "__main__":
    main()
