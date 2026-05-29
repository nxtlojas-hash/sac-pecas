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
    raw = "28/05/2026 11:37 - Voce criou este grupo\n"
    events = parse_chat_text(raw)
    assert events[0]["kind"] == "system"
