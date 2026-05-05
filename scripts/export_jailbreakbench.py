#!/usr/bin/env python3
"""Export JailbreakBench subsets from the Hugging Face dataset-viewer API."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


DATASET_ID = "JailbreakBench/JBB-Behaviors"
DATASET_VIEWER_BASE = "https://datasets-server.huggingface.co"
DEFAULT_OUTPUT_DIR = Path("data/benchmarks/jailbreakbench")
SUPPORTED_SUBSETS = ("harmful", "benign", "judge_comparison")
DEFAULT_SPLITS = {
    "harmful": "harmful",
    "benign": "benign",
    "judge_comparison": "test",
}
PAGE_SIZE = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export JailbreakBench subset to local JSON via the dataset-viewer API."
    )
    parser.add_argument(
        "--subset",
        choices=SUPPORTED_SUBSETS,
        default="harmful",
        help="Subset/config name.",
    )
    parser.add_argument(
        "--split",
        default=None,
        help="Dataset split to load. Defaults to the official JailbreakBench split for the subset.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional row limit. 0 means export all rows.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output file path.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="HTTP timeout in seconds. Default: 60",
    )
    return parser.parse_args()


def request_json(path: str, params: dict[str, Any], timeout: int) -> dict[str, Any]:
    url = f"{DATASET_VIEWER_BASE}{path}?{urlencode(params)}"
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            with urlopen(url, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == 2:
                break
            time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def fetch_rows(subset: str, split: str, offset: int, length: int, timeout: int) -> dict[str, Any]:
    config = "behaviors" if subset in {"harmful", "benign"} else subset
    return request_json(
        "/rows",
        {
            "dataset": DATASET_ID,
            "config": config,
            "split": split,
            "offset": offset,
            "length": length,
        },
        timeout=timeout,
    )


def export_subset(subset: str, split: str, limit: int, timeout: int) -> list[dict[str, Any]]:
    offset = 0
    records: list[dict[str, Any]] = []
    total_rows: int | None = None

    while True:
      page_length = PAGE_SIZE
      if limit > 0:
          remaining = limit - len(records)
          if remaining <= 0:
              break
          page_length = min(page_length, remaining)

      payload = fetch_rows(subset, split, offset, page_length, timeout)
      page_rows = payload.get("rows", [])

      if total_rows is None:
          total_rows = int(payload.get("num_rows_total", 0))

      if not page_rows:
          break

      records.extend(item.get("row", {}) for item in page_rows)
      offset += len(page_rows)
      print(f"Fetched {len(records)} rows", flush=True)

      if len(page_rows) < page_length:
          break
      if limit > 0 and len(records) >= limit:
          break
      if total_rows is not None and offset >= total_rows:
          break

    return records


def main() -> None:
    args = parse_args()
    split = args.split or DEFAULT_SPLITS[args.subset]
    records = export_subset(args.subset, split, args.limit, args.timeout)

    output_path = args.output or (DEFAULT_OUTPUT_DIR / f"{args.subset}.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "dataset": DATASET_ID,
        "subset": args.subset,
        "split": split,
        "count": len(records),
        "records": records,
        "source": "dataset-viewer-api",
    }

    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(records)} records to {output_path}")


if __name__ == "__main__":
    main()
