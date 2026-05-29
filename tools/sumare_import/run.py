"""End-to-end runner: parse -> pair -> build XLSX + organize photos + report."""
from __future__ import annotations
import json, os
from pathlib import Path
from dataclasses import asdict

from tools.sumare_import.pair import pair_checklists_with_motos
from tools.sumare_import.schema import Moto
from tools.sumare_import.build_xlsx import build_workbook
from tools.sumare_import.organize_photos import organize
from tools.sumare_import.report import render_report


BASE = Path(__file__).parent
DATA = BASE / "data"
OUT = BASE / "out"
SOURCE_PHOTOS = Path(os.environ["TEMP"]) / "sumare"
DRIVE_DST = Path(r"J:\Meu Drive\SAC\Motos Assistência Sumaré")


def _safe_str(v):
    return v if v is not None else None


def _load_drive_ids() -> dict[str, str]:
    """Load mapping {filename: file_id} from drive_file_ids.json if it exists."""
    ids_path = DATA / "drive_file_ids.json"
    if not ids_path.exists():
        return {}
    return json.loads(ids_path.read_text(encoding="utf-8"))


def _foto_link(filename: str, drive_ids: dict[str, str], label: str) -> str:
    """Return HYPERLINK formula if file ID known, else relative path.

    Usa virgula (formato XLSX padrao). Google Sheets converte automaticamente
    para ponto-virgula em locales que usam virgula como separador decimal.
    """
    file_id = drive_ids.get(filename)
    if file_id:
        url = f"https://drive.google.com/file/d/{file_id}/view"
        return f'=HYPERLINK("{url}","{label}")'
    return f"Fotos/{filename}"


def main() -> None:
    events = json.loads((DATA / "events.json").read_text(encoding="utf-8"))
    ocr = json.loads((DATA / "ocr_results.json").read_text(encoding="utf-8"))
    classifications = {x["arquivo"]: x["classification"] for x in ocr if x["classification"]}
    ocr_by_file = {x["arquivo"]: x for x in ocr}
    drive_ids = _load_drive_ids()
    if drive_ids:
        print(f"Drive IDs carregados: {len(drive_ids)} fotos com link clicavel")

    pairs, orphans = pair_checklists_with_motos(events, classifications)
    print(f"Pairs: {len(pairs)} | Orphans: {len(orphans)}")

    motos: list[Moto] = []
    moto_dicts: list[dict] = []

    for i, p in enumerate(pairs, start=1):
        mid = f"M{i:03d}"
        ckl = ocr_by_file[p["checklist"]]
        c = ckl.get("ocr") or {}
        m = Moto(
            id=mid,
            data_registro="2026-05-28",
            numero_os=c.get("numero_os"),
            data_entrada_checklist=c.get("data_entrada"),
            nome=c.get("nome"),
            cpf=c.get("cpf"),
            telefone=c.get("telefone"),
            endereco=c.get("endereco"),
            cidade_uf=c.get("cidade_uf"),
            modelo_nxt=c.get("modelo"),
            cor=c.get("cor"),
            chassi=c.get("chassi"),
            motor=c.get("motor"),
            data_compra=c.get("data_compra"),
            loja=c.get("loja"),
            problema_relatado=c.get("problema_relatado"),
            componentes_danificados=c.get("componentes_danificados") or [],
            tipo_atendimento=c.get("tipo_atendimento"),
            pecas_substituidas=c.get("pecas_substituidas"),
            tecnico_responsavel=c.get("tecnico_responsavel"),
            foto_checklist=_foto_link(f"{mid}-checklist.jpg", drive_ids, "Ver checklist"),
            foto_moto=_foto_link(f"{mid}-moto.jpg", drive_ids, "Ver moto"),
            quem_registrou=p["sender"],
        )
        bc = c.get("campos_baixa_confianca") or []
        obs_parts = []
        if bc:
            obs_parts.append(f"[BAIXA CONFIANÇA OCR: {', '.join(bc)}]")
        obs_ocr = c.get("observacoes_ocr")
        if obs_ocr:
            obs_parts.append(obs_ocr)
        m.observacoes = " | ".join(obs_parts)
        motos.append(m)
        moto_dicts.append({
            **asdict(m),
            "foto_checklist_src": p["checklist"],
            "foto_moto_src": p["moto"],
            "fotos_extras_src": [],
        })

    # orphans become not-identified motos
    next_id = len(pairs) + 1
    for o in orphans:
        mid = f"M{next_id:03d}"
        next_id += 1
        if o["kind"] == "moto":
            ckl = ocr_by_file[o["arquivo"]]
            c = ckl.get("ocr") or {}
            m = Moto(
                id=mid,
                data_registro="2026-05-28",
                status_atual="Não identificada" if not c.get("nome") else "Aguardando diagnóstico",
                nome=c.get("nome"),
                cpf=c.get("cpf"),
                modelo_nxt=c.get("modelo"),
                cor=c.get("cor"),
                motor=c.get("motor"),
                problema_relatado=c.get("problema_relatado"),
                componentes_danificados=c.get("componentes_danificados") or [],
                foto_moto=_foto_link(f"{mid}-moto.jpg", drive_ids, "Ver moto"),
                quem_registrou=ckl.get("sender"),
                observacoes=(c.get("observacoes_ocr") or "") + " | Sem checklist pareado",
            )
            moto_dicts.append({**asdict(m), "foto_moto_src": o["arquivo"]})
        else:
            ckl = ocr_by_file[o["arquivo"]]
            c = ckl.get("ocr") or {}
            m = Moto(
                id=mid,
                data_registro="2026-05-28",
                status_atual="Aguardando diagnóstico",
                numero_os=c.get("numero_os"),
                data_entrada_checklist=c.get("data_entrada"),
                nome=c.get("nome"),
                cpf=c.get("cpf"),
                telefone=c.get("telefone"),
                endereco=c.get("endereco"),
                cidade_uf=c.get("cidade_uf"),
                modelo_nxt=c.get("modelo"),
                cor=c.get("cor"),
                chassi=c.get("chassi"),
                motor=c.get("motor"),
                data_compra=c.get("data_compra"),
                problema_relatado=c.get("problema_relatado"),
                componentes_danificados=c.get("componentes_danificados") or [],
                tipo_atendimento=c.get("tipo_atendimento"),
                pecas_substituidas=c.get("pecas_substituidas"),
                tecnico_responsavel=c.get("tecnico_responsavel"),
                foto_checklist=_foto_link(f"{mid}-checklist.jpg", drive_ids, "Ver checklist"),
                quem_registrou=ckl.get("sender"),
                observacoes="Checklist sem foto-moto pareada — foto da moto pode estar entre as orfas",
            )
            moto_dicts.append({**asdict(m), "foto_checklist_src": o["arquivo"]})
        motos.append(m)

    # outputs
    (DATA / "motos.json").write_text(
        json.dumps(moto_dicts, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # Cruzar com WhatsApp 29/05 e CASOS SAC E SUMARE
    from tools.sumare_import.match_whatsapp import match_all as match_wa
    from tools.sumare_import.match_sac import match_against_sac
    wa_ass_path = DATA / "assistencia_29_05.json"
    wa_cem_path = DATA / "cemiterio_29_05.json"
    sac_path = DATA / "casos_sac_sumare.json"
    extras_by_id: dict[str, dict] = {}
    cemiterio = []
    novas_wa = []
    if wa_ass_path.exists():
        wa_ass = json.loads(wa_ass_path.read_text(encoding="utf-8"))
        wa_enriched, used = match_wa(moto_dicts, wa_ass)
        if sac_path.exists():
            sac = json.loads(sac_path.read_text(encoding="utf-8"))
            wa_enriched = match_against_sac(wa_enriched, sac)
        for e in wa_enriched:
            extras_by_id[e["id"]] = e
        novas_wa = [w for i, w in enumerate(wa_ass) if i not in used]
        print(f"Cruzamento WA: {sum(1 for e in wa_enriched if e.get('wa_match') == 'Sim')} matches; {len(novas_wa)} novas")
    if wa_cem_path.exists():
        cemiterio = json.loads(wa_cem_path.read_text(encoding="utf-8"))
        print(f"Cemitério: {len(cemiterio)} motos")

    # Estoque de caixas (29/05)
    caixas = None
    caixas_path = DATA / "estoque_caixas_29_05.json"
    if caixas_path.exists():
        caixas = json.loads(caixas_path.read_text(encoding="utf-8"))
        total_caixas = sum(c.get("total", 0) for c in caixas.get("caixas", []))
        print(f"Caixas: {total_caixas} unidades")

    # Enriquecimento via Leads RespondIO (19k clientes)
    leads_path = DATA / "leads_respondio.json"
    if leads_path.exists():
        from tools.sumare_import.match_leads import enrich_motos as enrich_with_leads, enrich_wa_novas as enrich_novas_leads
        leads = json.loads(leads_path.read_text(encoding="utf-8"))
        moto_dicts_enriched = enrich_with_leads(moto_dicts, leads)
        leads_match = sum(1 for m in moto_dicts_enriched if m.get("lead_match") == "Sim")
        print(f"Leads RespondIO: {leads_match}/{len(moto_dicts_enriched)} motos enriquecidas")
        # Merge lead info into extras_by_id
        leads_by_id = {m["id"]: m for m in moto_dicts_enriched}
        for mid, ex in extras_by_id.items():
            le = leads_by_id.get(mid, {})
            ex["lead_match"] = le.get("lead_match", "Não")
            ex["lead_telefone_completo"] = le.get("lead_telefone_completo", "")
            ex["lead_cidade"] = le.get("lead_cidade", "")
            ex["lead_estado"] = le.get("lead_estado", "")
            ex["lead_lifecycle"] = le.get("lead_lifecycle", "")
        # IDs in extras but not yet - add them
        for mid, le in leads_by_id.items():
            if mid not in extras_by_id:
                extras_by_id[mid] = {
                    "lead_match": le.get("lead_match", "Não"),
                    "lead_telefone_completo": le.get("lead_telefone_completo", ""),
                    "lead_cidade": le.get("lead_cidade", ""),
                    "lead_estado": le.get("lead_estado", ""),
                    "lead_lifecycle": le.get("lead_lifecycle", ""),
                }
        # WA novas
        novas_wa = enrich_novas_leads(novas_wa, leads)
        nw_match = sum(1 for n in novas_wa if n.get("lead_match") == "Sim")
        print(f"WA novas com Lead: {nw_match}/{len(novas_wa)}")

    OUT.mkdir(parents=True, exist_ok=True)
    xlsx = OUT / "Controle - Motos Sumaré.xlsx"
    build_workbook(motos, xlsx, extras_by_id=extras_by_id, cemiterio=cemiterio, novas_wa=novas_wa, caixas=caixas)
    print(f"XLSX: {xlsx} ({len(motos)} motos)")

    photos_out = OUT / "Fotos"
    stats = organize(moto_dicts, SOURCE_PHOTOS, photos_out)
    print(f"Fotos: {stats}")

    report_path = OUT / "relatorio-extracao.md"
    render_report(moto_dicts, classifications, orphans, report_path)
    print(f"Relatorio: {report_path}")


if __name__ == "__main__":
    main()
