"""Initialize ocr_results.json from events.json with empty entries."""
import json
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
            "classification": None,
            "ocr": None,
            "processed": False,
        })

out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Initialized {len(results)} photo entries in {out_path}")
