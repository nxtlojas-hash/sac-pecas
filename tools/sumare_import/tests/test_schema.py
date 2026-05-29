from tools.sumare_import.schema import (
    Moto, ChecklistOcr, MOTOS_NXT, STATUS_OPCOES,
)


def test_moto_id_format():
    m = Moto(id="M001", data_registro="2026-05-28")
    assert m.id == "M001"
    assert m.identificada() is False


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
