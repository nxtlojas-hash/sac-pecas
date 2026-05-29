"""Generate markdown report of extraction run."""
from __future__ import annotations
from pathlib import Path
from collections import Counter


def render_report(
    motos: list[dict],
    classifications: dict[str, str],
    orphans: list[dict],
    out_path: Path,
) -> None:
    total = len(motos)
    identificadas = sum(1 for m in motos if m.get("nome") and m.get("cpf"))
    nao_id = total - identificadas
    photo_count = len(classifications)
    checklists = sum(1 for k in classifications.values() if k == "checklist")
    motos_kind = sum(1 for k in classifications.values() if k == "moto")

    modelos = Counter(m.get("modelo_nxt") for m in motos if m.get("modelo_nxt"))
    senders = Counter(m.get("quem_registrou") for m in motos if m.get("quem_registrou"))
    baixa_conf = [
        (m["id"], m.get("observacoes", ""))
        for m in motos
        if "[BAIXA CONFIANÇA" in (m.get("observacoes") or "")
    ]

    md = [
        "# Relatório de extração — Controle Sumaré",
        "",
        "**Data da execução:** 2026-05-29",
        "**Fonte:** WhatsApp `Conversa do WhatsApp com Levantamento Sumaré.zip` (28/05/2026)",
        "",
        "## Totais",
        "",
        f"- Fotos processadas: **{photo_count}**",
        f"  - Checklists: {checklists}",
        f"  - Fotos de moto: {motos_kind}",
        f"- Motos cadastradas: **{total}**",
        f"  - Identificadas (nome + CPF): **{identificadas}** ({identificadas*100//max(total,1)}%)",
        f"  - Não identificadas: **{nao_id}**",
        f"- Fotos órfãs (sem par): **{len(orphans)}**",
        "",
        "## Distribuição por modelo",
        "",
    ]
    for modelo, n in modelos.most_common():
        md.append(f"- {modelo}: {n}")
    md += ["", "## Quem fotografou", ""]
    for s, n in senders.most_common():
        md.append(f"- {s}: {n}")
    md += ["", "## Casos para revisão humana", ""]
    if baixa_conf:
        md.append(f"**{len(baixa_conf)} motos com campos de baixa confiança no OCR:**")
        md.append("")
        for mid, obs in baixa_conf:
            md.append(f"- {mid}: {obs}")
    else:
        md.append("Nenhum caso flagado (revise mesmo assim algumas amostras).")

    md += ["", "## Próximos passos", ""]
    md += [
        "1. Abrir `Controle - Motos Sumaré.xlsx` no Google Sheets (Drive → abrir com Google Sheets).",
        "2. Verificar fórmulas das abas Não Identificadas e Dashboard (algumas funções como QUERY só ativam após abrir no Sheets).",
        "3. Compartilhar a pasta inteira `NXT - Motos Assistência Sumaré` com a equipe Sumaré.",
        "4. Revisar casos de baixa confiança e completar campos vazios consultando a equipe e o WhatsApp original.",
    ]
    out_path.write_text("\n".join(md), encoding="utf-8")
