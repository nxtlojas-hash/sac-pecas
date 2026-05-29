"""Cruza motos com base Leads RespondIO (19k clientes) para enriquecer
telefones, cidades e identificar clientes existentes.
"""
from __future__ import annotations
import json, re
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict

BASE = Path(__file__).parent
DATA = BASE / "data"


def _norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _phone_last4(phone) -> str | None:
    if not phone:
        return None
    d = re.sub(r"\D", "", str(phone))
    return d[-4:] if len(d) >= 4 else None


def _first_token(name) -> str:
    return _norm(name).split()[0] if name else ""


def _sim(a, b) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def index_leads(leads: list[dict]) -> dict[str, list[dict]]:
    """Index leads by phone last 4 digits (primary key)."""
    idx: dict[str, list[dict]] = defaultdict(list)
    for lead in leads:
        p4 = _phone_last4(lead.get("telefone"))
        if p4:
            idx[p4].append(lead)
    return idx


def find_best_lead(
    nome: str | None,
    phone_p4: str | None,
    cidade: str | None,
    leads_by_phone: dict[str, list[dict]],
) -> tuple[dict | None, int, str]:
    """Return (best_lead, score, reasons)."""
    candidates = leads_by_phone.get(phone_p4, []) if phone_p4 else []
    if not candidates:
        return None, 0, ""

    best_score = 0
    best_lead = None
    best_reasons = ""
    for lead in candidates:
        score = 50  # phone match
        reasons = [f"tel:{phone_p4}"]
        full_lead_name = f"{lead.get('nome','')} {lead.get('sobrenome','')}".strip()
        if nome:
            sim = _sim(nome, full_lead_name)
            first_match = _first_token(nome) == _first_token(full_lead_name)
            if first_match:
                score += 30
                reasons.append("primeiro_nome")
            elif sim >= 0.7:
                score += 20
                reasons.append(f"nome_fuzzy:{sim:.2f}")
            elif sim >= 0.5:
                score += 10
                reasons.append(f"nome_fuzzy_baixo:{sim:.2f}")
        if cidade and lead.get("cidade"):
            if _norm(cidade) == _norm(lead.get("cidade")):
                score += 10
                reasons.append("cidade")
        if score > best_score:
            best_score = score
            best_lead = lead
            best_reasons = ", ".join(reasons)

    return best_lead, best_score, best_reasons


def enrich_motos(motos: list[dict], leads: list[dict]) -> list[dict]:
    """Anota cada moto com match no Leads (se houver)."""
    leads_idx = index_leads(leads)
    enriched = []
    for m in motos:
        p4 = _phone_last4(m.get("telefone"))
        lead, score, reasons = find_best_lead(m.get("nome"), p4, m.get("cidade_uf"), leads_idx)
        em = dict(m)
        if lead and score >= 50:
            em["lead_match"] = "Sim"
            em["lead_score"] = score
            em["lead_razoes"] = reasons
            em["lead_telefone_completo"] = lead.get("telefone")
            em["lead_cidade"] = lead.get("cidade")
            em["lead_estado"] = lead.get("estado")
            em["lead_lifecycle"] = lead.get("lifecycle")
            em["lead_modelo_interesse"] = lead.get("modelo")
        else:
            em["lead_match"] = "Não"
            em["lead_score"] = 0
            em["lead_razoes"] = reasons or ""
            em["lead_telefone_completo"] = ""
            em["lead_cidade"] = ""
            em["lead_estado"] = ""
            em["lead_lifecycle"] = ""
            em["lead_modelo_interesse"] = ""
        enriched.append(em)
    return enriched


def enrich_wa_novas(novas: list[dict], leads: list[dict]) -> list[dict]:
    """Anota cada WA nova com lead match — focado em achar telefone completo."""
    leads_idx = index_leads(leads)
    enriched = []
    for w in novas:
        p4 = w.get("cel_4dig")
        lead, score, reasons = find_best_lead(w.get("cliente"), p4, w.get("cidade"), leads_idx)
        ew = dict(w)
        if lead and score >= 50:
            ew["lead_match"] = "Sim"
            ew["telefone_completo"] = lead.get("telefone")
            ew["lead_cidade"] = lead.get("cidade")
            ew["lead_estado"] = lead.get("estado")
            ew["lead_razoes"] = reasons
        else:
            ew["lead_match"] = "Não"
            ew["telefone_completo"] = ""
            ew["lead_cidade"] = ""
            ew["lead_estado"] = ""
            ew["lead_razoes"] = reasons or ""
        enriched.append(ew)
    return enriched


def main() -> None:
    leads = json.loads((DATA / "leads_respondio.json").read_text(encoding="utf-8"))
    print(f"Leads carregados: {len(leads)}")

    # 1. Motos in-loco
    motos = json.loads((DATA / "motos.json").read_text(encoding="utf-8"))
    em = enrich_motos(motos, leads)
    matched = sum(1 for m in em if m.get("lead_match") == "Sim")
    print(f"Motos in-loco: {matched}/{len(em)} com match Leads")
    (DATA / "motos_leads_enriched.json").write_text(
        json.dumps(em, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # 2. WA novas
    novas = json.loads((DATA / "wa_novas.json").read_text(encoding="utf-8"))
    en = enrich_wa_novas(novas, leads)
    matched = sum(1 for n in en if n.get("lead_match") == "Sim")
    print(f"WA novas: {matched}/{len(en)} com match Leads")
    (DATA / "wa_novas_leads_enriched.json").write_text(
        json.dumps(en, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
