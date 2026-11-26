#!/usr/bin/env python3
"""Convert the bundled web API meta to the ds-service import request for local setup."""

import argparse
import base64
import hashlib
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path


INTERACTION_STATES = {
    "pressed", "hovered", "focused", "selected", "activated", "readonly", "disabled"
}


def kebab_case(value: str) -> str:
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"-\1", value).lower()


def normalize(source: list[dict]) -> list[dict]:
    if not isinstance(source, list):
        raise ValueError("Web API meta must be an array")
    components: dict[str, dict] = {}
    for entry in source:
        if not isinstance(entry, dict):
            raise ValueError("Web API meta component must be an object")
        name = entry.get("componentName", "")
        if not isinstance(name, str) or not name.strip():
            continue
        component = components.setdefault(name, {"name": name, "properties": {}, "states": {}})
        for param in entry.get("params", []):
            if not isinstance(param, dict) or not isinstance(param.get("paramName"), str):
                raise ValueError("Web API meta parameter requires a string paramName")
            prop_id = param.get("id", "")
            prop_type = param.get("type", "")
            if not isinstance(prop_id, str) or not prop_id.strip() or not isinstance(prop_type, str) or not prop_type.strip():
                continue
            properties = component["properties"]
            prop = properties.setdefault(
                prop_id, {"name": prop_id, "type": prop_type, "platformNames": {}, "description": "",
                          "stateSupport": {"states": [], "combinations": False}}
            )
            if prop["type"] != prop_type:
                raise ValueError(f"Conflicting property types for {name}.{prop_id}: {prop['type']} and {prop_type}")
            state = param.get("state")
            if isinstance(state, str):
                canonical = "".join(char for char in state.lower() if char.isalnum())
                normalized_state = kebab_case(state)
                if normalized_state.strip():
                    states = prop["stateSupport"]["states"]
                    if normalized_state not in states:
                        states.append(normalized_state)
                    if canonical not in INTERACTION_STATES:
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
    if source and not result:
        raise ValueError("Nonempty Web API meta has no valid components")
    return result


def read_archive(source: str) -> tuple[bytes, dict]:
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=120) as response:
            archive = zipfile.ZipFile(io.BytesIO(response.read()))
    else:
        archive = zipfile.ZipFile(source)
    with archive:
        manifest = json.loads(archive.read("preview-plugin.json"))
        meta = archive.read("api-meta.json")
    coordinates = manifest.get("coreRelease") if isinstance(manifest, dict) else None
    if (
        not isinstance(coordinates, dict)
        or coordinates.get("platform") != "web"
        or not isinstance(coordinates.get("libraryId"), str)
        or not coordinates["libraryId"].strip()
        or not isinstance(coordinates.get("version"), str)
        or not coordinates["version"].strip()
        or coordinates["version"] != manifest.get("plasmaNewHopeVersion")
    ):
        raise ValueError("Web preview archive has no matching Core coordinates")
    if hashlib.sha256(meta).hexdigest() != manifest.get("apiMetaSha256"):
        raise ValueError("Web preview API meta checksum does not match the manifest")
    return meta, coordinates


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--archive", action="store_true", help="Read API meta and Core coordinates from a Web preview ZIP")
    parser.add_argument("--library-id")
    parser.add_argument("--core-version")
    parser.add_argument("--channel", choices=["stable", "dev"], required=True)
    args = parser.parse_args()
    if not args.archive and not (args.core_version or "").strip():
        parser.error("Set DSBUILDER_WEB_CORE_VERSION to the exact version used to generate the supplied Web API meta")
    try:
        if args.archive:
            raw, coordinates = read_archive(args.source)
            for field, expected in (("libraryId", args.library_id), ("version", args.core_version)):
                if expected and expected != coordinates[field]:
                    raise ValueError(f"Web preview archive Core {field} differs from the configured value")
            source_name = "api-meta.json"
        else:
            source_path = Path(args.source)
            raw = source_path.read_bytes()
            coordinates = {"libraryId": args.library_id or "plasma-new-hope", "platform": "web", "version": args.core_version}
            source_name = source_path.name
        components = normalize(json.loads(raw))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.error(str(error))
    json.dump(
        {"platform": "web", "meta": {"source": source_name}, "dryRun": False, "components": components,
         "coreRelease": coordinates,
         "channel": args.channel, "sourceMetaBase64": base64.b64encode(raw).decode(),
         "metaSha256": hashlib.sha256(raw).hexdigest()},
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
