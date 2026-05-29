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


def main() -> None:
    events = json.loads((DATA / "events.json").read_text(encoding="utf-8"))
    ocr = json.loads((DATA / "ocr_results.json").read_text(encoding="utf-8"))
    classifications = {x["arquivo"]: x["classification"] for x in ocr if x["classification"]}
    ocr_by_file = {x["arquivo"]: x for x in ocr}

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
            foto_checklist=f"Fotos/{mid}-checklist.jpg",
            foto_moto=f"Fotos/{mid}-moto.jpg",
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
                foto_moto=f"Fotos/{mid}-moto.jpg",
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
                foto_checklist=f"Fotos/{mid}-checklist.jpg",
                quem_registrou=ckl.get("sender"),
                observacoes="Checklist sem foto-moto pareada — foto da moto pode estar entre as orfas",
            )
            moto_dicts.append({**asdict(m), "foto_checklist_src": o["arquivo"]})
        motos.append(m)

    # outputs
    (DATA / "motos.json").write_text(
        json.dumps(moto_dicts, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    OUT.mkdir(parents=True, exist_ok=True)
    xlsx = OUT / "Controle - Motos Sumaré.xlsx"
    build_workbook(motos, xlsx)
    print(f"XLSX: {xlsx} ({len(motos)} motos)")

    photos_out = OUT / "Fotos"
    stats = organize(moto_dicts, SOURCE_PHOTOS, photos_out)
    print(f"Fotos: {stats}")

    report_path = OUT / "relatorio-extracao.md"
    render_report(moto_dicts, classifications, orphans, report_path)
    print(f"Relatorio: {report_path}")


if __name__ == "__main__":
    main()
