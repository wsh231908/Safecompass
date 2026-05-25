#!/usr/bin/env python3
"""Export HarmBench text behavior datasets into SafeCompass local JSON."""

from __future__ import annotations

import argparse
import csv
import json
import time
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


DATASET_ID = "centerforaisafety/HarmBench"
RAW_BASE_URL = "https://raw.githubusercontent.com/centerforaisafety/HarmBench/main"
DEFAULT_OUTPUT_DIR = Path("data/benchmarks/harmbench")
TEXT_TARGETS_PATH = "data/optimizer_targets/harmbench_targets_text.json"
TEXT_SUBSETS = {
    "text_all": "data/behavior_datasets/harmbench_behaviors_text_all.csv",
    "text_test": "data/behavior_datasets/harmbench_behaviors_text_test.csv",
    "text_val": "data/behavior_datasets/harmbench_behaviors_text_val.csv",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download official HarmBench text behavior CSVs and export SafeCompass JSON."
    )
    parser.add_argument(
        "--subset",
        choices=(*TEXT_SUBSETS.keys(), "all"),
        default="all",
        help="Subset to export. Defaults to all text subsets.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional per-subset row limit. 0 means export all rows.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for exported JSON files.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="HTTP timeout in seconds. Default: 60.",
    )
    parser.add_argument(
        "--include-targets",
        action="store_true",
        help="Include HarmBench optimizer targets in exported records.",
    )
    return parser.parse_args()


def request_text(path: str, timeout: int) -> str:
    url = f"{RAW_BASE_URL}/{path}"
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            with urlopen(url, timeout=timeout) as response:
                return response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, UnicodeDecodeError) as error:
            last_error = error
            if attempt == 2:
                break
            time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def request_json(path: str, timeout: int) -> dict[str, Any]:
    return json.loads(request_text(path, timeout))


def normalize_tags(raw_tags: str) -> list[str]:
    return [tag.strip() for tag in str(raw_tags or "").split(",") if tag.strip()]


def build_prompt(behavior: str, context: str) -> str:
    if context:
        return f"{context}\n\n---\n\n{behavior}"
    return behavior


def normalize_record(
    row: dict[str, str],
    index: int,
    subset: str,
    targets: dict[str, str],
) -> dict[str, Any]:
    behavior = row.get("Behavior", "").strip()
    context = row.get("ContextString", "").strip()
    behavior_id = row.get("BehaviorID", "").strip() or f"{subset}_{index}"
    semantic_category = row.get("SemanticCategory", "").strip()
    functional_category = (
        row.get("FunctionalCategory", "").strip()
        or row.get("Category", "").strip()
    )

    return {
        "id": behavior_id,
        "behavior_id": behavior_id,
        "goal": behavior,
        "prompt": build_prompt(behavior, context),
        "target": targets.get(behavior_id, ""),
        "behavior": behavior,
        "source": "HarmBench",
        "attack_type": "-",
        "category": semantic_category or functional_category or "-",
        "semantic_category": semantic_category or "-",
        "functional_category": functional_category or "-",
        "tags": normalize_tags(row.get("Tags", "")),
        "context": context,
        "has_context": bool(context),
        "behavior_type": "harmful",
    }


def parse_csv_records(csv_text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(csv_text))
    return list(reader)


def export_subset(
    subset: str,
    source_path: str,
    output_dir: Path,
    limit: int,
    timeout: int,
    targets: dict[str, str],
) -> Path:
    csv_text = request_text(source_path, timeout)
    rows = parse_csv_records(csv_text)
    if limit > 0:
        rows = rows[:limit]

    records = [
        normalize_record(row, index, subset, targets)
        for index, row in enumerate(rows)
    ]
    payload = {
        "dataset": DATASET_ID,
        "subset": subset,
        "split": subset,
        "format": "safecompass.behavior.v1",
        "count": len(records),
        "records": records,
        "source": "github-raw",
        "source_urls": {
            "behaviors": f"{RAW_BASE_URL}/{source_path}",
            "targets": f"{RAW_BASE_URL}/{TEXT_TARGETS_PATH}" if targets else None,
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{subset}.json"
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path


def main() -> None:
    args = parse_args()
    targets = request_json(TEXT_TARGETS_PATH, args.timeout) if args.include_targets else {}
    selected_subsets = (
        TEXT_SUBSETS.items()
        if args.subset == "all"
        else ((args.subset, TEXT_SUBSETS[args.subset]),)
    )

    for subset, source_path in selected_subsets:
        output_path = export_subset(
            subset=subset,
            source_path=source_path,
            output_dir=args.output_dir,
            limit=args.limit,
            timeout=args.timeout,
            targets=targets,
        )
        print(f"Exported {subset} to {output_path}")


if __name__ == "__main__":
    main()
