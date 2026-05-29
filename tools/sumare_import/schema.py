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
    arquivo: str
    timestamp: str
    sender: str
    continuation: str = ""


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
