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
