"""Generate the Controle - Motos Sumaré.xlsx workbook with 4 sheets."""
from __future__ import annotations
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

from tools.sumare_import.schema import Moto, MOTOS_NXT, STATUS_OPCOES, TIPO_ATENDIMENTO

MOTOS_HEADERS = [
    "ID", "Data registro", "Nº OS", "Data entrada checklist", "Status atual",
    "Identificada?", "Nome", "CPF", "Telefone", "Endereço", "Cidade/UF",
    "Modelo NXT", "Cor", "Nº Chassi", "Nº Motor", "Data compra", "Loja/revendedor",
    "Problema relatado", "Componentes danificados", "Tipo atendimento",
    "Peças substituídas", "Técnico responsável",
    "Foto checklist", "Foto moto", "Fotos extras",
    "Origem do registro", "Quem registrou", "Observações",
]
assert len(MOTOS_HEADERS) == 28

MOV_HEADERS = ["Data/hora", "ID Moto", "Status anterior", "Status novo", "Responsável", "Observação"]
DASH_HEADERS = ["Métrica", "Valor"]

HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _write_headers(ws, headers: list[str]) -> None:
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=col_idx, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = HEADER_ALIGN
    ws.freeze_panes = "A2"


def _moto_row(m: Moto) -> list:
    return [
        m.id, m.data_registro, m.numero_os, m.data_entrada_checklist, m.status_atual,
        "Sim" if m.identificada() else "Não",
        m.nome, m.cpf, m.telefone, m.endereco, m.cidade_uf,
        m.modelo_nxt, m.cor, m.chassi, m.motor, m.data_compra, m.loja,
        m.problema_relatado, "; ".join(m.componentes_danificados),
        m.tipo_atendimento, m.pecas_substituidas, m.tecnico_responsavel,
        m.foto_checklist, m.foto_moto, ", ".join(m.fotos_extras),
        m.origem_registro, m.quem_registrou, m.observacoes,
    ]


def _add_validations(ws, motos_count: int) -> None:
    end = max(motos_count + 1, 200)
    def rng(col: int) -> str:
        return f"{get_column_letter(col)}2:{get_column_letter(col)}{end}"

    dv_status = DataValidation(type="list", formula1='"' + ",".join(STATUS_OPCOES) + '"', allow_blank=True)
    dv_status.add(rng(5))
    ws.add_data_validation(dv_status)

    dv_id = DataValidation(type="list", formula1='"Sim,Não"', allow_blank=True)
    dv_id.add(rng(6))
    ws.add_data_validation(dv_id)

    dv_modelo = DataValidation(type="list", formula1='"' + ",".join(MOTOS_NXT) + '"', allow_blank=True)
    dv_modelo.add(rng(12))
    ws.add_data_validation(dv_modelo)

    dv_tipo = DataValidation(type="list", formula1='"' + ",".join(TIPO_ATENDIMENTO) + '"', allow_blank=True)
    dv_tipo.add(rng(20))
    ws.add_data_validation(dv_tipo)


def build_workbook(motos: list[Moto], path: Path) -> None:
    wb = Workbook()
    # --- Aba Motos ---
    ws_motos = wb.active
    ws_motos.title = "Motos"
    _write_headers(ws_motos, MOTOS_HEADERS)
    for m in motos:
        ws_motos.append(_moto_row(m))
    _add_validations(ws_motos, len(motos))
    widths = [8, 12, 10, 14, 22, 13, 28, 18, 16, 38, 16, 14, 14, 16, 16, 12, 22, 38, 32, 18, 28, 22, 32, 32, 22, 22, 22, 38]
    for i, w in enumerate(widths, start=1):
        ws_motos.column_dimensions[get_column_letter(i)].width = w

    # --- Aba Movimentações ---
    ws_mov = wb.create_sheet("Movimentações")
    _write_headers(ws_mov, MOV_HEADERS)
    for m in motos:
        ws_mov.append([
            f"{m.data_registro} 13:00",
            m.id,
            "",
            "Aguardando diagnóstico",
            m.quem_registrou or "",
            "Recebida — levantamento pós-incêndio 28/05",
        ])
    dv_mov = DataValidation(type="list", formula1='"' + ",".join(STATUS_OPCOES) + '"', allow_blank=True)
    end_mov = max(len(motos) + 1, 500)
    dv_mov.add(f"C2:D{end_mov}")
    ws_mov.add_data_validation(dv_mov)
    for i, w in enumerate([18, 10, 22, 22, 22, 50], start=1):
        ws_mov.column_dimensions[get_column_letter(i)].width = w

    # --- Aba Não Identificadas (dados estáticos, snapshot do build) ---
    ws_ni = wb.create_sheet("Não Identificadas")
    ws_ni["A1"] = "Snapshot das motos não identificadas no momento do build. Re-rodar tools/sumare_import/run.py para regenerar."
    ws_ni["A1"].font = Font(italic=True, color="808080")
    ni_headers = ["ID", "Nome (parcial)", "Modelo NXT", "Cor", "Problema relatado", "Foto checklist", "Foto moto", "Pistas (preencher conforme investiga)"]
    for col_idx, h in enumerate(ni_headers, start=1):
        c = ws_ni.cell(row=3, column=col_idx, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = HEADER_ALIGN
    row = 4
    for m in motos:
        if m.identificada():
            continue
        ws_ni.cell(row=row, column=1, value=m.id)
        ws_ni.cell(row=row, column=2, value=m.nome or "")
        ws_ni.cell(row=row, column=3, value=m.modelo_nxt or "")
        ws_ni.cell(row=row, column=4, value=m.cor or "")
        ws_ni.cell(row=row, column=5, value=m.problema_relatado or "")
        ws_ni.cell(row=row, column=6, value=m.foto_checklist or "")
        ws_ni.cell(row=row, column=7, value=m.foto_moto or "")
        row += 1
    for i, w in enumerate([8, 26, 14, 14, 38, 32, 32, 32], start=1):
        ws_ni.column_dimensions[get_column_letter(i)].width = w
    ws_ni.freeze_panes = "A4"

    # --- Aba Dashboard ---
    ws_d = wb.create_sheet("Dashboard")
    _write_headers(ws_d, DASH_HEADERS)
    # Calcula valores no build pra garantir funcionar mesmo se as formulas falharem na conversao
    total = len(motos)
    identificadas = sum(1 for m in motos if m.identificada())
    nao_id = total - identificadas
    ws_d.append(["Total motos", total])
    ws_d.append(["Identificadas", identificadas])
    ws_d.append(["Não identificadas", nao_id])
    ws_d.append(["% identificadas", f"{identificadas*100//max(total,1)}%"])
    ws_d.append([])
    ws_d.append(["Status", "Quantidade"])
    for s in STATUS_OPCOES:
        count = sum(1 for m in motos if m.status_atual == s)
        ws_d.append([s, count])
    ws_d.append([])
    ws_d.append(["Modelo", "Quantidade"])
    for m_nome in MOTOS_NXT:
        count = sum(1 for m in motos if m.modelo_nxt == m_nome)
        ws_d.append([m_nome, count])
    ws_d.column_dimensions["A"].width = 28
    ws_d.column_dimensions["B"].width = 16

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main() -> None:
    import json
    data_dir = Path(__file__).parent / "data"
    motos_json = data_dir / "motos.json"
    raw = json.loads(motos_json.read_text(encoding="utf-8"))
    # filtrar campos que não são do dataclass Moto
    moto_fields = set(Moto.__dataclass_fields__.keys())
    motos = [Moto(**{k: v for k, v in d.items() if k in moto_fields}) for d in raw]
    out = Path(__file__).parent / "out" / "Controle - Motos Sumaré.xlsx"
    build_workbook(motos, out)
    print(f"Wrote {out} with {len(motos)} motos.")


if __name__ == "__main__":
    main()
