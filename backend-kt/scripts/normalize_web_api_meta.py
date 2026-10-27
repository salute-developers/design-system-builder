#!/usr/bin/env python3
"""Convert the bundled web API meta to the ds-service import request for local setup."""

import json
import re
import sys
from pathlib import Path


INTERACTION_STATES = {
    "pressed", "hovered", "focused", "selected", "activated", "readonly", "disabled"
}


def kebab_case(value: str) -> str:
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"-\1", value).lower()


def normalize(source: list[dict]) -> list[dict]:
    components: dict[str, dict] = {}
    for entry in source:
        name = entry.get("componentName", "")
        if not isinstance(name, str) or not name.strip():
            continue
        component = components.setdefault(name, {"name": name, "properties": {}, "states": {}})
        for param in entry.get("params", []):
            prop_id = param.get("id", "")
            prop_type = param.get("type", "")
            if not isinstance(prop_id, str) or not prop_id.strip() or not isinstance(prop_type, str) or not prop_type.strip():
                continue
            properties = component["properties"]
            prop = properties.setdefault(
                prop_id, {"name": prop_id, "type": prop_type, "platformNames": {}, "description": ""}
            )
            if prop["type"] != prop_type:
                continue
            state = param.get("state")
            if isinstance(state, str):
                canonical = "".join(char for char in state.lower() if char.isalnum())
                if canonical not in INTERACTION_STATES:
                    normalized_state = kebab_case(state)
                    if normalized_state:
                        component["states"][normalized_state] = None
                continue
            alias = param.get("paramName")
            if not isinstance(alias, str) or not alias.strip():
                continue
            aliases = prop["platformNames"]
            aliases.setdefault(alias, {"name": alias})
            deprecated = param.get("deprecated")
            if deprecated is not None and "deprecated" not in aliases[alias]:
                aliases[alias]["deprecated"] = {"message": deprecated.get("message", "")}

    result = []
    for component in components.values():
        properties = []
        for prop in component["properties"].values():
            aliases = list(prop["platformNames"].values())
            if aliases:
                prop["platformNames"] = aliases
                prop["description"] = "token: " + "/".join(alias["name"] for alias in aliases)
                properties.append(prop)
        result.append({"name": component["name"], "properties": properties, "states": list(component["states"])})
    return result


def main() -> None:
    source_path = Path(sys.argv[1])
    components = normalize(json.loads(source_path.read_text(encoding="utf-8")))
    if not components:
        raise SystemExit("Web API meta contains no components")
    json.dump(
        {"platform": "web", "meta": {"source": source_path.name}, "dryRun": False, "components": components},
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
