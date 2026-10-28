#!/usr/bin/env python3
"""Check the frozen nginx contract and optionally probe the public entrypoint."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.request


def check_sources(matrix, backend):
    for profile in matrix["profiles"].values():
        source = backend / profile["source"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != profile["sha256"]:
            raise ValueError("nginx source changed: " + str(source))
        selectors = re.findall(r"^        location (.+?) \{\n", source.read_text(), re.M)
        if selectors != [row["selector"] for row in profile["locations"]]:
            raise ValueError("Incomplete route matrix: " + str(source))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target")
    parser.add_argument("--settings", choices=["local", "production"], default="local")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    matrix = json.loads((directory / "gateway-contract.json").read_text())
    check_sources(matrix, directory.parents[1])
    probes = [("/health", 200), ("/internal/projects", 403),
              ("/api/projects", 401), ("/auth/login", 404), ("/auth/register", 404)]
    results = []
    for path, expected in probes:
        result = {"path": path, "expected": expected}
        if args.target:
            request = urllib.request.Request(args.target.rstrip("/") + path)
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    result["actual"] = response.status
            except urllib.error.HTTPError as error:
                result["actual"] = error.code
            result["passed"] = result["actual"] == expected
        results.append(result)
    report = {"settings": args.settings, "sourceVerified": True,
              "executed": bool(args.target), "results": results}
    output = json.dumps(report, indent=2) + "\n"
    if args.report:
        args.report.write_text(output)
    print(output, end="")
    if any(not row.get("passed", True) for row in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
