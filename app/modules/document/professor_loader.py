import json
from pathlib import Path
from typing import List

from pydantic import ValidationError

from app.modules.document.professor import Professor


def load_professors(path: str | Path) -> List[Professor]:
    raw = Path(path).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("professors.json のトップレベルはJSON配列である必要があります")
    professors: List[Professor] = []
    seen_keys: set[tuple[str, str]] = set()
    for i, item in enumerate(data):
        try:
            prof = Professor.model_validate(item)
        except ValidationError as e:
            raise ValueError(f"教授データ[{i}]の形式が不正です: {e}") from e
        key = (prof.school_slug, prof.name)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        professors.append(prof)
    return professors
