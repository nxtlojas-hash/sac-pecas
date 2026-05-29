# Controle de Motos Sumaré — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o controle das motos na assistência Sumaré perdido no incêndio, extraindo dados via OCR dos checklists fotografados no WhatsApp em 28/05/2026 e gerando uma planilha Google Sheets compartilhável no Drive com pasta de fotos pareadas.

**Architecture:** Pipeline em 3 fases — (1) toolchain Python com scripts TDD para parsing, schema, pareamento e geração de XLSX; (2) extração manual OCR feita por Claude Code lendo cada uma das ~130 imagens com Read+vision e salvando JSON estruturado; (3) montagem final do XLSX + pasta de fotos organizada + relatório de extração + cópia para o Drive (`H:\Meu Drive\NXT - Motos Assistência Sumaré\`).

**Tech Stack:** Python 3, `openpyxl` (XLSX), `pytest` (testes), Claude Code vision (OCR multimodal), Git, Google Drive (entrega via H: mapeado).

---

## File Structure

**Novo diretório:** `tools/sumare-import/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `tools/sumare-import/requirements.txt` | dependências Python (`openpyxl`, `pytest`) |
| `tools/sumare-import/parse_chat.py` | parse do `_chat.txt` em eventos estruturados |
| `tools/sumare-import/schema.py` | dataclasses `Moto`, `Checklist`, `PhotoRef` |
| `tools/sumare-import/pair.py` | algoritmo de pareamento checklist+moto |
| `tools/sumare-import/build_xlsx.py` | gera `Controle - Motos Sumaré.xlsx` com 4 abas |
| `tools/sumare-import/organize_photos.py` | renomeia e copia fotos pra `out/Fotos/` |
| `tools/sumare-import/report.py` | gera `relatorio-extracao.md` |
| `tools/sumare-import/run.py` | orquestrador end-to-end |
| `tools/sumare-import/tests/test_parse_chat.py` | testes de parse |
| `tools/sumare-import/tests/test_schema.py` | testes de schema |
| `tools/sumare-import/tests/test_pair.py` | testes de pareamento |
| `tools/sumare-import/tests/test_build_xlsx.py` | testes de XLSX |
| `tools/sumare-import/data/events.json` | output do parse (gerado) |
| `tools/sumare-import/data/ocr_results.json` | OCR de todas as fotos (preenchido manualmente por Claude) |
| `tools/sumare-import/data/motos.json` | output do pareamento (gerado) |
| `tools/sumare-import/out/` | XLSX + pasta Fotos finais (gerados) |

**Diretório fonte (read-only):** `%TEMP%/sumare/` — já tem o ZIP extraído com 130 jpgs + `_chat.txt`.

**Diretório de entrega:** `H:\Meu Drive\NXT - Motos Assistência Sumaré\` — cópia final do XLSX + pasta Fotos.

---

## Phase 1 — Toolchain (Python scripts com TDD)

### Task 1: requirements.txt + estrutura de pastas

**Files:**
- Create: `tools/sumare-import/requirements.txt`
- Create: `tools/sumare-import/tests/__init__.py`
- Create: `tools/sumare-import/data/` (vazio inicialmente)
- Create: `tools/sumare-import/out/` (vazio inicialmente)

- [ ] **Step 1: Criar requirements.txt**

```text
openpyxl==3.1.2
pytest==8.0.0
```

- [ ] **Step 2: Criar pastas vazias com .gitkeep**

```bash
mkdir -p tools/sumare-import/tests tools/sumare-import/data tools/sumare-import/out
touch tools/sumare-import/tests/__init__.py
touch tools/sumare-import/data/.gitkeep
touch tools/sumare-import/out/.gitkeep
```

- [ ] **Step 3: Instalar dependências**

Run: `pip install -r tools/sumare-import/requirements.txt`
Expected: openpyxl e pytest instalados sem erro.

- [ ] **Step 4: Adicionar `tools/sumare-import/out/` ao .gitignore**

Modify: `.gitignore` (raiz do repo)
Adicionar linha: `tools/sumare-import/out/`
Adicionar linha: `tools/sumare-import/data/*.json`
(Os JSONs intermediários são reproduzíveis a partir do ZIP; out/ contém binários gerados.)

- [ ] **Step 5: Commit**

```bash
git add tools/sumare-import/requirements.txt tools/sumare-import/tests/__init__.py tools/sumare-import/data/.gitkeep tools/sumare-import/out/.gitkeep .gitignore
git commit -m "chore(sumare-import): scaffold tools/sumare-import"
```

---

### Task 2: parse_chat.py — parse do WhatsApp _chat.txt

**Files:**
- Create: `tools/sumare-import/parse_chat.py`
- Create: `tools/sumare-import/tests/test_parse_chat.py`

- [ ] **Step 1: Escrever teste falhando**

Create `tools/sumare-import/tests/test_parse_chat.py`:

```python
from tools.sumare_import.parse_chat import parse_chat_text

def test_parses_msg_with_name():
    raw = "28/05/2026 11:42 - Emerson Gomes Nxt Sumare: Nathalia do rego Martins\n"
    events = parse_chat_text(raw)
    assert len(events) == 1
    assert events[0]["kind"] == "msg"
    assert events[0]["sender"] == "Emerson Gomes Nxt Sumare"
    assert events[0]["content"] == "Nathalia do rego Martins"
    assert events[0]["ts"] == "28/05/2026 11:42"

def test_parses_photo_event():
    raw = "28/05/2026 11:42 - Emerson Gomes Nxt Sumare: ‎IMG-20260528-WA0068.jpg (arquivo anexado)\n"
    events = parse_chat_text(raw)
    assert events[0]["kind"] == "photo"
    assert events[0]["photo"] == "IMG-20260528-WA0068.jpg"

def test_continuation_attaches_to_previous_event():
    raw = (
        "28/05/2026 13:35 - +55 19 99406-8216: ‎IMG-20260528-WA0157.jpg (arquivo anexado)\n"
        "Matheus Texera\n"
    )
    events = parse_chat_text(raw)
    assert len(events) == 1
    assert events[0]["kind"] == "photo"
    assert events[0]["continuation"] == "Matheus Texera"

def test_system_event_no_colon():
    raw = "28/05/2026 11:37 - Você criou este grupo\n"
    events = parse_chat_text(raw)
    assert events[0]["kind"] == "system"
```

- [ ] **Step 2: Rodar testes — devem falhar**

Run: `pytest tools/sumare-import/tests/test_parse_chat.py -v`
Expected: 4 falhas com `ModuleNotFoundError: tools.sumare_import.parse_chat`.

- [ ] **Step 3: Implementar `parse_chat.py`**

Create `tools/sumare-import/parse_chat.py`:

```python
"""Parse WhatsApp chat export into structured event list."""
from __future__ import annotations
import re
from pathlib import Path
from typing import Any

_TS_RE = re.compile(r"^(\d{2}/\d{2}/\d{4} \d{2}:\d{2}) - (.+)$")
_PHOTO_RE = re.compile(r"IMG-\d{8}-WA\d{4}\.jpg")


def parse_chat_text(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for line in raw.split("\n"):
        line = line.rstrip()
        m = _TS_RE.match(line)
        if m:
            ts, rest = m.group(1), m.group(2)
            if ": " in rest:
                sender, content = rest.split(": ", 1)
                ph = _PHOTO_RE.search(content)
                if ph:
                    events.append({
                        "ts": ts, "sender": sender, "kind": "photo",
                        "photo": ph.group(0), "continuation": "",
                    })
                else:
                    events.append({
                        "ts": ts, "sender": sender, "kind": "msg",
                        "content": content, "continuation": "",
                    })
            else:
                events.append({
                    "ts": ts, "sender": "<system>", "kind": "system",
                    "content": rest, "continuation": "",
                })
        else:
            if line and events:
                prev = events[-1]
                cont = prev.get("continuation", "")
                prev["continuation"] = (cont + " " + line).strip()
    return events


def parse_chat_file(path: Path) -> list[dict[str, Any]]:
    return parse_chat_text(path.read_text(encoding="utf-8"))


def main() -> None:
    import json, sys, os
    folder = Path(os.environ["TEMP"]) / "sumare"
    chat = next((p for p in folder.iterdir() if p.suffix == ".txt"), None)
    if not chat:
        sys.exit("Chat file not found in %TEMP%/sumare/")
    events = parse_chat_file(chat)
    out = Path(__file__).parent / "data" / "events.json"
    out.write_text(json.dumps(events, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(events)} events to {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pytest tools/sumare-import/tests/test_parse_chat.py -v`
Expected: 4 passes.

- [ ] **Step 5: Rodar o script E2E**

Run: `python tools/sumare-import/parse_chat.py`
Expected: `Wrote 156 events to .../data/events.json`. Verificar `data/events.json` tem 156 entries.

- [ ] **Step 6: Commit**

```bash
git add tools/sumare-import/parse_chat.py tools/sumare-import/tests/test_parse_chat.py
git commit -m "feat(sumare-import): parse WhatsApp chat to events.json"
```

---

### Task 3: schema.py — dataclasses para dados extraídos

**Files:**
- Create: `tools/sumare-import/schema.py`
- Create: `tools/sumare-import/tests/test_schema.py`

- [ ] **Step 1: Escrever teste falhando**

Create `tools/sumare-import/tests/test_schema.py`:

```python
from tools.sumare_import.schema import Moto, ChecklistOcr, PhotoRef, MOTOS_NXT, STATUS_OPCOES, TIPO_ATENDIMENTO

def test_moto_id_format():
    m = Moto(id="M001", data_registro="2026-05-28")
    assert m.id == "M001"
    assert m.identificada() is False  # vazio = não identificada

def test_moto_identificada_quando_nome_e_cpf():
    m = Moto(id="M001", data_registro="2026-05-28", nome="Nathalia", cpf="099.194.986-00")
    assert m.identificada() is True

def test_modelos_nxt_lista_completa():
    assert "Jaya" in MOTOS_NXT
    assert "Kay" in MOTOS_NXT
    assert len(MOTOS_NXT) == 12

def test_status_opcoes():
    assert "Aguardando diagnóstico" in STATUS_OPCOES
    assert "Não identificada" in STATUS_OPCOES

def test_checklist_ocr_optional_fields():
    c = ChecklistOcr(arquivo="IMG-0068.jpg")
    assert c.nome is None
    assert c.componentes_danificados == []
```

- [ ] **Step 2: Rodar testes — falham**

Run: `pytest tools/sumare-import/tests/test_schema.py -v`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implementar `schema.py`**

Create `tools/sumare-import/schema.py`:

```python
"""Data schema for OCR results and final Moto entries."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

MOTOS_NXT = [
    "Kay", "Jaya", "Luna", "Shaka", "Zilla",
    "Juna Smart", "Juna", "Gataka", "Pancho",
    "Hyphen", "Vega", "Kimbo",
]

STATUS_OPCOES = [
    "Aguardando diagnóstico",
    "Em reparo",
    "Aguardando peça",
    "Aguardando cliente",
    "Pronta",
    "Entregue",
    "Não identificada",
]

TIPO_ATENDIMENTO = [
    "Garantia",
    "Manutenção preventiva",
    "Reparo pago",
    "Revisão de entrega",
    "Outro",
]


@dataclass
class PhotoRef:
    """Reference to one photo in the source ZIP."""
    arquivo: str            # IMG-20260528-WA0068.jpg
    timestamp: str          # 28/05/2026 11:42
    sender: str             # Emerson Gomes Nxt Sumare
    continuation: str = ""  # legenda inline (raro pre-pareamento)


@dataclass
class ChecklistOcr:
    """OCR extraction of one checklist photo. Tudo Optional pq letras manuscritas podem falhar."""
    arquivo: str
    nome: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade_uf: Optional[str] = None
    modelo: Optional[str] = None
    cor: Optional[str] = None
    chassi: Optional[str] = None
    motor: Optional[str] = None
    data_compra: Optional[str] = None
    loja: Optional[str] = None
    problema_relatado: Optional[str] = None
    componentes_danificados: list[str] = field(default_factory=list)
    tipo_atendimento: Optional[str] = None
    pecas_substituidas: Optional[str] = None
    tecnico_responsavel: Optional[str] = None
    numero_os: Optional[str] = None
    data_entrada: Optional[str] = None
    campos_baixa_confianca: list[str] = field(default_factory=list)
    observacoes_ocr: str = ""


@dataclass
class Moto:
    """Final Moto entry, ready for XLSX row."""
    id: str
    data_registro: str
    numero_os: Optional[str] = None
    data_entrada_checklist: Optional[str] = None
    status_atual: str = "Aguardando diagnóstico"
    nome: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade_uf: Optional[str] = None
    modelo_nxt: Optional[str] = None
    cor: Optional[str] = None
    chassi: Optional[str] = None
    motor: Optional[str] = None
    data_compra: Optional[str] = None
    loja: Optional[str] = None
    problema_relatado: Optional[str] = None
    componentes_danificados: list[str] = field(default_factory=list)
    tipo_atendimento: Optional[str] = None
    pecas_substituidas: Optional[str] = None
    tecnico_responsavel: Optional[str] = None
    foto_checklist: Optional[str] = None
    foto_moto: Optional[str] = None
    fotos_extras: list[str] = field(default_factory=list)
    origem_registro: str = "WhatsApp 28/05/2026"
    quem_registrou: Optional[str] = None
    observacoes: str = ""

    def identificada(self) -> bool:
        return bool(self.nome and self.cpf)
```

- [ ] **Step 4: Rodar testes — passam**

Run: `pytest tools/sumare-import/tests/test_schema.py -v`
Expected: 5 passes.

- [ ] **Step 5: Commit**

```bash
git add tools/sumare-import/schema.py tools/sumare-import/tests/test_schema.py
git commit -m "feat(sumare-import): schema (Moto, ChecklistOcr, PhotoRef)"
```

---

### Task 4: pair.py — algoritmo de pareamento checklist + moto

**Files:**
- Create: `tools/sumare-import/pair.py`
- Create: `tools/sumare-import/tests/test_pair.py`

- [ ] **Step 1: Escrever teste falhando**

Create `tools/sumare-import/tests/test_pair.py`:

```python
from tools.sumare_import.pair import pair_checklists_with_motos

def _ev(ts, sender, photo):
    return {"ts": ts, "sender": sender, "kind": "photo", "photo": photo, "continuation": ""}

def test_pairs_sequential_checklist_then_moto_same_sender():
    events = [
        _ev("28/05/2026 11:42", "Emerson", "IMG-20260528-WA0068.jpg"),
        _ev("28/05/2026 11:43", "Emerson", "IMG-20260528-WA0069.jpg"),
    ]
    classifications = {
        "IMG-20260528-WA0068.jpg": "checklist",
        "IMG-20260528-WA0069.jpg": "moto",
    }
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert len(pairs) == 1
    assert pairs[0]["checklist"] == "IMG-20260528-WA0068.jpg"
    assert pairs[0]["moto"] == "IMG-20260528-WA0069.jpg"
    assert orphans == []

def test_orphan_moto_no_preceding_checklist():
    events = [
        _ev("28/05/2026 13:37", "Marcão", "IMG-20260528-WA0168.jpg"),
    ]
    classifications = {"IMG-20260528-WA0168.jpg": "moto"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert orphans == [{"arquivo": "IMG-20260528-WA0168.jpg", "kind": "moto"}]

def test_orphan_checklist_no_following_moto():
    events = [
        _ev("28/05/2026 14:00", "Leo", "IMG-20260528-WA0200.jpg"),
    ]
    classifications = {"IMG-20260528-WA0200.jpg": "checklist"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert orphans == [{"arquivo": "IMG-20260528-WA0200.jpg", "kind": "checklist"}]

def test_pair_only_with_close_timestamp_same_sender():
    # Checklist do Emerson, moto do Leo 5 min depois: NÃO pareia
    events = [
        _ev("28/05/2026 13:00", "Emerson", "IMG-A.jpg"),
        _ev("28/05/2026 13:05", "Leo",     "IMG-B.jpg"),
    ]
    classifications = {"IMG-A.jpg": "checklist", "IMG-B.jpg": "moto"}
    pairs, orphans = pair_checklists_with_motos(events, classifications)
    assert pairs == []
    assert len(orphans) == 2
```

- [ ] **Step 2: Rodar testes — falham**

Run: `pytest tools/sumare-import/tests/test_pair.py -v`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implementar `pair.py`**

Create `tools/sumare-import/pair.py`:

```python
"""Pair checklist photos with moto photos using sender + timestamp proximity."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any

WINDOW = timedelta(minutes=3)


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%d/%m/%Y %H:%M")


def pair_checklists_with_motos(
    events: list[dict[str, Any]],
    classifications: dict[str, str],
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """
    Build pairs of (checklist photo, moto photo).
    Pareamento: para cada checklist, a próxima foto-moto do mesmo sender em até WINDOW.
    Retorna (pairs, orphans).
    """
    photos = [
        e for e in events
        if e["kind"] == "photo" and e["photo"] in classifications
    ]
    used: set[str] = set()
    pairs: list[dict[str, str]] = []

    for i, ev in enumerate(photos):
        if classifications.get(ev["photo"]) != "checklist":
            continue
        if ev["photo"] in used:
            continue
        ev_ts = _parse_ts(ev["ts"])
        for j in range(i + 1, len(photos)):
            cand = photos[j]
            if cand["photo"] in used:
                continue
            if classifications.get(cand["photo"]) != "moto":
                continue
            if cand["sender"] != ev["sender"]:
                continue
            cand_ts = _parse_ts(cand["ts"])
            if cand_ts - ev_ts > WINDOW:
                break
            pairs.append({
                "checklist": ev["photo"],
                "moto": cand["photo"],
                "ts": ev["ts"],
                "sender": ev["sender"],
            })
            used.add(ev["photo"])
            used.add(cand["photo"])
            break

    orphans = [
        {"arquivo": ev["photo"], "kind": classifications[ev["photo"]]}
        for ev in photos if ev["photo"] not in used
    ]
    return pairs, orphans
```

- [ ] **Step 4: Rodar testes — passam**

Run: `pytest tools/sumare-import/tests/test_pair.py -v`
Expected: 4 passes.

- [ ] **Step 5: Commit**

```bash
git add tools/sumare-import/pair.py tools/sumare-import/tests/test_pair.py
git commit -m "feat(sumare-import): algoritmo de pareamento checklist+moto"
```

---

### Task 5: build_xlsx.py — gerar planilha com 4 abas

**Files:**
- Create: `tools/sumare-import/build_xlsx.py`
- Create: `tools/sumare-import/tests/test_build_xlsx.py`

- [ ] **Step 1: Escrever teste falhando**

Create `tools/sumare-import/tests/test_build_xlsx.py`:

```python
from pathlib import Path
from openpyxl import load_workbook
from tools.sumare_import.schema import Moto
from tools.sumare_import.build_xlsx import build_workbook

def test_workbook_has_4_sheets(tmp_path: Path):
    out = tmp_path / "test.xlsx"
    build_workbook(motos=[], path=out)
    wb = load_workbook(out)
    assert set(wb.sheetnames) == {"Motos", "Movimentações", "Não Identificadas", "Dashboard"}

def test_motos_sheet_has_28_columns_header(tmp_path: Path):
    out = tmp_path / "test.xlsx"
    build_workbook(motos=[], path=out)
    wb = load_workbook(out)
    ws = wb["Motos"]
    headers = [c.value for c in ws[1]]
    assert headers[0] == "ID"
    assert "CPF" in headers
    assert "Foto checklist" in headers
    assert len([h for h in headers if h]) == 28

def test_motos_sheet_populates_data_rows(tmp_path: Path):
    out = tmp_path / "test.xlsx"
    moto = Moto(
        id="M001",
        data_registro="2026-05-28",
        nome="Nathalia do Rego Martins",
        cpf="099.194.986-00",
        modelo_nxt="Jaya",
    )
    build_workbook(motos=[moto], path=out)
    wb = load_workbook(out)
    ws = wb["Motos"]
    assert ws["A2"].value == "M001"
    # coluna Nome (G na ordem definida)
    headers = [c.value for c in ws[1]]
    nome_col_idx = headers.index("Nome") + 1
    assert ws.cell(row=2, column=nome_col_idx).value == "Nathalia do Rego Martins"

def test_movimentacoes_pre_populated(tmp_path: Path):
    out = tmp_path / "test.xlsx"
    moto = Moto(id="M001", data_registro="2026-05-28", quem_registrou="Emerson")
    build_workbook(motos=[moto], path=out)
    wb = load_workbook(out)
    ws = wb["Movimentações"]
    # header + 1 movimentação inicial
    assert ws.max_row == 2
    assert ws["B2"].value == "M001"
    assert ws["D2"].value == "Aguardando diagnóstico"
    assert "Recebida" in (ws["F2"].value or "")
```

- [ ] **Step 2: Rodar testes — falham**

Run: `pytest tools/sumare-import/tests/test_build_xlsx.py -v`
Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implementar `build_xlsx.py`**

Create `tools/sumare-import/build_xlsx.py`:

```python
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
    rng = lambda col: f"{get_column_letter(col)}2:{get_column_letter(col)}{end}"

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
    # ajustar largura
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

    # --- Aba Não Identificadas ---
    ws_ni = wb.create_sheet("Não Identificadas")
    ws_ni["A1"] = "Esta aba é uma view automática. Edite as motos diretamente na aba 'Motos'."
    ws_ni["A1"].font = Font(italic=True, color="808080")
    # formula array
    ws_ni["A3"] = '=QUERY(Motos!A1:AB; "SELECT A, G, L, M, R, W, X WHERE F = ' + "'Não'" + ' ORDER BY A"; 1)'
    ws_ni["I3"] = "Pistas (preencher conforme investiga)"
    ws_ni["I3"].font = Font(bold=True)

    # --- Aba Dashboard ---
    ws_d = wb.create_sheet("Dashboard")
    _write_headers(ws_d, DASH_HEADERS)
    ws_d.append(["Total motos", "=COUNTA(Motos!A2:A)"])
    ws_d.append(["Identificadas", '=COUNTIF(Motos!F:F; "Sim")'])
    ws_d.append(["Não identificadas", '=COUNTIF(Motos!F:F; "Não")'])
    ws_d.append(["% identificadas", "=B3/B2"])
    ws_d.append([])
    ws_d.append(["Status", "Quantidade"])
    for s in STATUS_OPCOES:
        ws_d.append([s, f'=COUNTIF(Motos!E:E; "{s}")'])
    ws_d.append([])
    ws_d.append(["Modelo", "Quantidade"])
    for m in MOTOS_NXT:
        ws_d.append([m, f'=COUNTIF(Motos!L:L; "{m}")'])
    ws_d.column_dimensions["A"].width = 28
    ws_d.column_dimensions["B"].width = 16

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main() -> None:
    import json
    from .schema import Moto
    data_dir = Path(__file__).parent / "data"
    motos_json = data_dir / "motos.json"
    motos = [Moto(**d) for d in json.loads(motos_json.read_text(encoding="utf-8"))]
    out = Path(__file__).parent / "out" / "Controle - Motos Sumaré.xlsx"
    build_workbook(motos, out)
    print(f"Wrote {out} with {len(motos)} motos.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Rodar testes — passam**

Run: `pytest tools/sumare-import/tests/test_build_xlsx.py -v`
Expected: 4 passes.

- [ ] **Step 5: Commit**

```bash
git add tools/sumare-import/build_xlsx.py tools/sumare-import/tests/test_build_xlsx.py
git commit -m "feat(sumare-import): build_xlsx gera planilha 4 abas com validações"
```

---

### Task 6: organize_photos.py — renomear e copiar fotos

**Files:**
- Create: `tools/sumare-import/organize_photos.py`

- [ ] **Step 1: Implementar `organize_photos.py`**

Create `tools/sumare-import/organize_photos.py`:

```python
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
    stats = {"checklists": 0, "motos": 0, "extras": 0}
    for m in motos:
        mid = m["id"]
        if m.get("foto_checklist_src"):
            src = source_dir / m["foto_checklist_src"]
            dst = out_dir / f"{mid}-checklist.jpg"
            shutil.copy2(src, dst)
            stats["checklists"] += 1
        if m.get("foto_moto_src"):
            src = source_dir / m["foto_moto_src"]
            dst = out_dir / f"{mid}-moto.jpg"
            shutil.copy2(src, dst)
            stats["motos"] += 1
        for idx, extra in enumerate(m.get("fotos_extras_src", []), start=1):
            src = source_dir / extra
            dst = out_dir / f"{mid}-extra-{idx}.jpg"
            shutil.copy2(src, dst)
            stats["extras"] += 1
    return stats
```

- [ ] **Step 2: Smoke test manual**

Run quick check:
```python
python -c "from tools.sumare_import.organize_photos import organize; print(organize.__doc__)"
```
Expected: docstring printed.

- [ ] **Step 3: Commit**

```bash
git add tools/sumare-import/organize_photos.py
git commit -m "feat(sumare-import): organize_photos copia renomeando para M-IDs"
```

---

### Task 7: report.py — relatório de extração em markdown

**Files:**
- Create: `tools/sumare-import/report.py`

- [ ] **Step 1: Implementar `report.py`**

Create `tools/sumare-import/report.py`:

```python
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
        f"**Data da execução:** 2026-05-29",
        f"**Fonte:** WhatsApp `Conversa do WhatsApp com Levantamento Sumaré.zip` (28/05/2026)",
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
        md.append(f"**{len(baixa_conf)} motos com campos de baixa confiança no OCR:**\n")
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
```

- [ ] **Step 2: Commit**

```bash
git add tools/sumare-import/report.py
git commit -m "feat(sumare-import): relatório de extração em markdown"
```

---

## Phase 2 — OCR Extraction (manual via Claude vision)

Esta fase é executada por Claude Code dentro da sessão, lendo cada foto com Read+visão e preenchendo `data/ocr_results.json`. NÃO é TDD — é loop manual.

### Task 8: Inicializar ocr_results.json com lista de todas as fotos

**Files:**
- Create: `tools/sumare-import/init_ocr_state.py`
- Create: `tools/sumare-import/data/ocr_results.json` (gerado)

- [ ] **Step 1: Criar e rodar script init**

Create `tools/sumare-import/init_ocr_state.py`:

```python
"""Initialize ocr_results.json from events.json with empty entries."""
import json, os
from pathlib import Path

events_path = Path(__file__).parent / "data" / "events.json"
out_path = Path(__file__).parent / "data" / "ocr_results.json"
events = json.loads(events_path.read_text(encoding="utf-8"))

results = []
seen = set()
for e in events:
    if e["kind"] == "photo" and e["photo"] not in seen:
        seen.add(e["photo"])
        results.append({
            "arquivo": e["photo"],
            "timestamp": e["ts"],
            "sender": e["sender"],
            "continuation": e.get("continuation", ""),
            "classification": None,   # checklist | moto | outro
            "ocr": None,              # ChecklistOcr dict ou None
            "processed": False,
        })

out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Initialized {len(results)} photo entries in {out_path}")
```

Run: `python tools/sumare-import/init_ocr_state.py`
Expected: `Initialized 130 photo entries`.

- [ ] **Step 2: Commit estado inicial**

```bash
git add tools/sumare-import/init_ocr_state.py
git commit -m "feat(sumare-import): init_ocr_state inicializa ocr_results.json"
```

---

### Task 9: OCR batch 1 — primeiras 40 fotos (WA0068–WA0148)

Claude lê cada foto via Read tool. Para cada foto:
1. Classifica: checklist | moto | outro
2. Se checklist: extrai todos os campos no formato `ChecklistOcr`
3. Marca `processed: true`
4. Atualiza `ocr_results.json` com Edit

**Files:**
- Modify: `tools/sumare-import/data/ocr_results.json` (40 entries preenchidas)

- [ ] **Step 1: Processar fotos 1–40**

Para cada foto na faixa, fazer:
1. `Read C:\Users\claud\AppData\Local\Temp\sumare\<arquivo>`
2. Analisar visualmente
3. Editar `ocr_results.json` com classification + ocr

- [ ] **Step 2: Validação intermediária**

Após 40 fotos, rodar:
```python
python -c "import json; r=json.load(open('tools/sumare-import/data/ocr_results.json',encoding='utf-8')); done=[x for x in r if x['processed']]; print(f'Processadas: {len(done)}/{len(r)}'); print(f'Checklists: {sum(1 for x in done if x[\"classification\"]==\"checklist\")}'); print(f'Motos: {sum(1 for x in done if x[\"classification\"]==\"moto\")}')"
```
Expected: ~40 processadas, distribuição aproximadamente 50/50 checklist/moto.

- [ ] **Step 3: Commit progresso**

```bash
git add tools/sumare-import/data/ocr_results.json
git commit -m "feat(sumare-import): OCR batch 1 — 40 fotos processadas"
```

---

### Task 10: OCR batch 2 — fotos 41–80

Mesmo procedimento da Task 9, para faixa de 41 a 80.

- [ ] **Step 1: Processar fotos 41–80**

- [ ] **Step 2: Validação intermediária**

Mesmo comando da Task 9. Expected: ~80 processadas.

- [ ] **Step 3: Commit progresso**

```bash
git add tools/sumare-import/data/ocr_results.json
git commit -m "feat(sumare-import): OCR batch 2 — 80 fotos processadas"
```

---

### Task 11: OCR batch 3 — fotos 81–130 (restante)

- [ ] **Step 1: Processar fotos restantes**

- [ ] **Step 2: Validação final**

Expected: 130/130 processadas. `unprocessed` deve ser 0.

```python
python -c "import json; r=json.load(open('tools/sumare-import/data/ocr_results.json',encoding='utf-8')); print(f'Processadas: {sum(1 for x in r if x[\"processed\"])}/{len(r)}')"
```

- [ ] **Step 3: Commit final OCR**

```bash
git add tools/sumare-import/data/ocr_results.json
git commit -m "feat(sumare-import): OCR completo das 130 fotos"
```

---

## Phase 3 — Assembly & delivery

### Task 12: run.py — orquestrador end-to-end

**Files:**
- Create: `tools/sumare-import/run.py`

- [ ] **Step 1: Implementar `run.py`**

Create `tools/sumare-import/run.py`:

```python
"""End-to-end runner: parse → pair → build XLSX + organize photos + report."""
from __future__ import annotations
import json, os, shutil
from pathlib import Path
from dataclasses import asdict

from tools.sumare_import.parse_chat import parse_chat_file
from tools.sumare_import.pair import pair_checklists_with_motos
from tools.sumare_import.schema import Moto, ChecklistOcr
from tools.sumare_import.build_xlsx import build_workbook
from tools.sumare_import.organize_photos import organize
from tools.sumare_import.report import render_report


BASE = Path(__file__).parent
DATA = BASE / "data"
OUT = BASE / "out"
SOURCE_PHOTOS = Path(os.environ["TEMP"]) / "sumare"
DRIVE_DST = Path(r"H:\Meu Drive\NXT - Motos Assistência Sumaré")


def main() -> None:
    events = json.loads((DATA / "events.json").read_text(encoding="utf-8"))
    ocr = json.loads((DATA / "ocr_results.json").read_text(encoding="utf-8"))
    classifications = {x["arquivo"]: x["classification"] for x in ocr if x["classification"]}
    ocr_by_file = {x["arquivo"]: x for x in ocr}

    pairs, orphans = pair_checklists_with_motos(events, classifications)
    print(f"Pares: {len(pairs)} | Órfãs: {len(orphans)}")

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
        # baixa confiança → observacoes
        bc = c.get("campos_baixa_confianca") or []
        if bc:
            m.observacoes = f"[BAIXA CONFIANÇA OCR: {', '.join(bc)}]"
        motos.append(m)
        moto_dicts.append({
            **asdict(m),
            "foto_checklist_src": p["checklist"],
            "foto_moto_src": p["moto"],
            "fotos_extras_src": [],
        })

    # órfãs viram motos não identificadas
    next_id = len(pairs) + 1
    for o in orphans:
        mid = f"M{next_id:03d}"
        next_id += 1
        if o["kind"] == "moto":
            m = Moto(
                id=mid,
                data_registro="2026-05-28",
                status_atual="Não identificada",
                foto_moto=f"Fotos/{mid}-moto.jpg",
                observacoes="Sem checklist pareado — investigar via foto",
            )
            moto_dicts.append({**asdict(m), "foto_moto_src": o["arquivo"]})
        else:  # checklist órfão
            ckl = ocr_by_file[o["arquivo"]]
            c = ckl.get("ocr") or {}
            m = Moto(
                id=mid,
                data_registro="2026-05-28",
                status_atual="Aguardando diagnóstico",
                nome=c.get("nome"),
                cpf=c.get("cpf"),
                telefone=c.get("telefone"),
                foto_checklist=f"Fotos/{mid}-checklist.jpg",
                observacoes="Checklist sem foto-moto pareada — foto da moto pode estar entre as órfãs",
            )
            moto_dicts.append({**asdict(m), "foto_checklist_src": o["arquivo"]})
        motos.append(m)

    # outputs
    (DATA / "motos.json").write_text(
        json.dumps(moto_dicts, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    xlsx = OUT / "Controle - Motos Sumaré.xlsx"
    build_workbook(motos, xlsx)
    print(f"XLSX: {xlsx}")

    photos_out = OUT / "Fotos"
    stats = organize(moto_dicts, SOURCE_PHOTOS, photos_out)
    print(f"Fotos: {stats}")

    report_path = OUT / "relatorio-extracao.md"
    render_report(moto_dicts, classifications, orphans, report_path)
    print(f"Relatório: {report_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar end-to-end**

Run: `python -m tools.sumare-import.run`
Expected: stdout com contagens; arquivos em `tools/sumare-import/out/`.

- [ ] **Step 3: Inspeção manual**

- Abrir `out/Controle - Motos Sumaré.xlsx` no LibreOffice ou Excel
- Verificar 4 abas presentes
- Verificar dropdowns funcionam nas colunas Status, Modelo NXT, Tipo atendimento
- Conferir ~10 linhas aleatórias contra as fotos originais (sanity check do OCR)
- Verificar pasta `out/Fotos/` tem todas as fotos renomeadas

- [ ] **Step 4: Commit**

```bash
git add tools/sumare-import/run.py
git commit -m "feat(sumare-import): orquestrador end-to-end"
```

---

### Task 13: Copiar para o Drive

**Files:**
- Copy: `out/Controle - Motos Sumaré.xlsx` → `H:\Meu Drive\NXT - Motos Assistência Sumaré\`
- Copy: `out/Fotos/` → `H:\Meu Drive\NXT - Motos Assistência Sumaré\Fotos\`
- Copy: `out/relatorio-extracao.md` → `H:\Meu Drive\NXT - Motos Assistência Sumaré\`

- [ ] **Step 1: Verificar acesso ao Drive**

Run: `ls "H:/Meu Drive/"`
Expected: lista o conteúdo do Drive (já mapeado).

- [ ] **Step 2: Criar pasta de destino**

Run: `mkdir -p "H:/Meu Drive/NXT - Motos Assistência Sumaré/Fotos"`

- [ ] **Step 3: Copiar arquivos**

Run:
```bash
cp "tools/sumare-import/out/Controle - Motos Sumaré.xlsx" "H:/Meu Drive/NXT - Motos Assistência Sumaré/"
cp -r tools/sumare-import/out/Fotos/* "H:/Meu Drive/NXT - Motos Assistência Sumaré/Fotos/"
cp tools/sumare-import/out/relatorio-extracao.md "H:/Meu Drive/NXT - Motos Assistência Sumaré/"
```

- [ ] **Step 4: Confirmar sincronização**

Aguardar 1-2 min para o Drive sincronizar. Confirmar no `drive.google.com` que os arquivos apareceram.

---

### Task 14: Validação no Google Sheets + ajustes

Após sincronizado, abrir o XLSX no Drive como Google Sheets (clique direito → Abrir com → Google Sheets) — isso converte e ativa o `QUERY` da aba Não Identificadas.

- [ ] **Step 1: Abrir no Sheets e converter**

Abrir o `.xlsx` no Drive, clicar "Arquivo → Salvar como Google Sheets". Isso cria uma versão `.gsheet` editável.

- [ ] **Step 2: Verificar fórmulas funcionando**

- Aba **Dashboard**: contadores e percentuais devem mostrar números corretos
- Aba **Não Identificadas**: QUERY deve listar todas as motos com `Identificada? = Não`
- Aba **Motos**: dropdowns funcionam ao clicar em uma célula

- [ ] **Step 3: Ajustar largura/formatação se preciso**

Conforme uso real, ajustar colunas demasiado estreitas.

- [ ] **Step 4: Compartilhar com equipe Sumaré**

- Compartilhar a **pasta `NXT - Motos Assistência Sumaré`** (não só o arquivo)
- Permissão: editor
- Pessoas: Emerson Sumaré, equipe Sumaré
- Avisar no grupo WhatsApp

---

### Task 15: Compromisso final + V2 stub

- [ ] **Step 1: Adicionar TODO no repo para V2**

Modify: `docs/superpowers/specs/2026-05-29-controle-motos-sumare-design.md` — anotar URL da planilha real no spec para referência futura.

- [ ] **Step 2: Commit final**

```bash
git add docs/superpowers/specs/2026-05-29-controle-motos-sumare-design.md
git commit -m "docs(sumare): registra URL da planilha em produção"
```

---

## Self-Review checklist

- [x] **Cobertura do spec:**
  - 4 abas (Motos, Movimentações, Não Identificadas, Dashboard) — Task 5
  - 28 colunas em Motos — Task 5 (testado em test_build_xlsx)
  - Pasta Fotos com renomeação — Task 6 + Task 12
  - OCR de todos os campos do checklist — Tasks 9-11
  - Pareamento checklist+moto — Task 4
  - "Não identificadas" como categoria de status — Task 12 (órfãs viram status=Não identificada)
  - Movimentações pré-populada com evento "Recebida" — Task 5 (testado)
  - Dashboard com totais e quebras — Task 5
  - Relatório de extração — Task 7 + Task 12
  - Entrega no Drive — Task 13
- [x] **Sem placeholders:** todos os steps têm código real ou comando concreto
- [x] **Consistência de tipos:** `Moto`, `ChecklistOcr`, `PhotoRef` definidos em Task 3, usados consistentemente nas demais
- [x] **Ambiguidade:** "OCR batch" 1/2/3 tem critério claro (faixa de fotos + meta de processadas)

## Riscos durante execução

- **OCR demora muito:** se uma foto borrada quebrar o fluxo, marcar como `campos_baixa_confianca: [tudo]` e seguir
- **`H:` Drive desconectado:** Task 13 falha — refazer manualmente quando voltar
- **`openpyxl` vs Google Sheets:** alguns formatos (cores de aba, validações condicionais) podem não sobreviver à conversão — testar e ajustar
- **Cliente "NXT" como dono:** motos com legenda "NXT" no chat são estoque da própria NXT — marcar como identificadas com `nome="NXT (estoque)"` e `cpf=null`
