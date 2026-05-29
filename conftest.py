"""Repo-root conftest: ensures tools.sumare_import is importable in tests."""
import sys
from pathlib import Path

ROOT = Path(__file__).parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
