#!/usr/bin/env python3
"""Convert local JailbreakBench CSV files into the JSON format used by the frontend."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data" / "benchmarks" / "jailbreakbench"

BENIGN_CSV = DATA_DIR / "benign-behaviors.csv"
HARMFUL_CSV = DATA_DIR / "harmful-behaviors.csv"
JUDGE_CSV = DATA_DIR / "judge-comparison.csv"

BEHAVIORS_JSON = DATA_DIR / "behaviors.json"
HARMFUL_JSON = DATA_DIR / "harmful.json"
BENIGN_JSON = DATA_DIR / "benign.json"
JUDGE_JSON = DATA_DIR / "judge_comparison.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def build_behavior_records(source_file: Path, source_kind: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []

    if not source_file.exists():
        return records

    for index, row in enumerate(read_csv(source_file)):
        records.append(
            {
                "id": f"{source_kind}_{row.get('Index', index)}",
                "goal": row.get("Goal", ""),
                "target": row.get("Target", ""),
                "behavior": row.get("Behavior", ""),
                "category": row.get("Category", "-"),
                "source": row.get("Source", "JailbreakBench"),
                "behavior_type": source_kind,
            }
        )

    return records


def build_judge_records() -> list[dict[str, str]]:
    if not JUDGE_CSV.exists():
        return []

    records: list[dict[str, str]] = []
    for index, row in enumerate(read_csv(JUDGE_CSV)):
        records.append(
            {
                "id": f"judge_{row.get('Index', index)}",
                "goal": row.get("goal", ""),
                "prompt": row.get("prompt", ""),
                "target_response": row.get("target_response", ""),
                "human_majority": row.get("human_majority", ""),
                "harmbench_cf": row.get("harmbench_cf", ""),
                "gpt4_cf": row.get("gpt4_cf", ""),
                "llamaguard2_cf": row.get("llamaguard2_cf", ""),
                "llama3_cf": row.get("llama3_cf", ""),
                "category": "judge-comparison",
                "source": "JailbreakBench",
            }
        )

    return records


def write_json(path: Path, subset: str, records: list[dict[str, str]]) -> None:
    payload = {
        "dataset": "JailbreakBench/JBB-Behaviors",
        "subset": subset,
        "split": "local",
        "count": len(records),
        "records": records,
        "source": "local-csv",
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    harmful = build_behavior_records(HARMFUL_CSV, "harmful")
    benign = build_behavior_records(BENIGN_CSV, "benign")
    behaviors = harmful + benign
    judges = build_judge_records()

    if not behaviors and not judges:
        raise SystemExit(
            "No local JailbreakBench CSV files found. Expected files under data/benchmarks/jailbreakbench/."
        )

    if behaviors:
        write_json(BEHAVIORS_JSON, "behaviors", behaviors)
        print(f"Prepared {len(behaviors)} records -> {BEHAVIORS_JSON}")

    if harmful:
        write_json(HARMFUL_JSON, "harmful", harmful)
        print(f"Prepared {len(harmful)} records -> {HARMFUL_JSON}")

    if benign:
        write_json(BENIGN_JSON, "benign", benign)
        print(f"Prepared {len(benign)} records -> {BENIGN_JSON}")

    if judges:
        write_json(JUDGE_JSON, "judge_comparison", judges)
        print(f"Prepared {len(judges)} records -> {JUDGE_JSON}")


if __name__ == "__main__":
    main()
