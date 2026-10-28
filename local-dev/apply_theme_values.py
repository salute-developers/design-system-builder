#!/usr/bin/env python3
"""Loads the Android token values of a theme-converter theme package into a theme of the local stack.

The theme package is the directory of a theme-converter theme (`themes/<name>/<version>.zip` of
https://github.com/salute-developers/theme-converter): `android/android_<type>.json` hold the values. Compose
preview reads the `android` values, so only they are replaced. Tokens are matched by name: color, gradient, shadow
and typography values of the light and dark modes are stored under `<mode>.<token>`, the others under `<token>`.
Tokens that the package does not know keep their values. The script is idempotent.
"""
import json
import sys
import urllib.request

FILES = {
    "color": "android_color",
    "gradient": "android_gradient",
    "typography": "android_typography",
    "shadow": "android_shadow",
    "shape": "android_shape",
    "spacing": "android_spacing",
    "fontFamily": "android_fontFamily",
}
BATCH = 400


def main(gateway, token, project, design_system, tenant, package):
    base = f"{gateway}/api/projects/{project}/ds"

    def call(method, path, body=None):
        request = urllib.request.Request(
            base + path,
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)

    package_values = {}
    for token_type, file in FILES.items():
        with open(f"{package}/android/{file}.json") as handle:
            package_values[token_type] = json.load(handle)

    tokens = {item["id"]: item for item in call("GET", f"/design-systems/{design_system}/tokens")}
    current = call("GET", f"/tenants/{tenant}/token-values")
    revision = call("GET", f"/tenants/{tenant}")["editRevision"]

    updates, skipped = [], 0
    for item in current:
        if item["platform"] != "android":
            continue
        definition = tokens.get(item["tokenId"])
        values = package_values.get(definition["type"]) if definition else None
        if values is None:
            skipped += 1
            continue
        mode = item.get("mode")
        key = f"{mode}.{definition['name']}" if mode in ("light", "dark") else definition["name"]
        if key not in values:
            skipped += 1
            continue
        value = values[key]
        value = value if isinstance(value, list) else [value]
        if value == item["value"]:
            continue
        updates.append(
            {
                "tokenId": item["tokenId"],
                "platform": "android",
                "mode": mode,
                "paletteId": item.get("paletteId"),
                "value": value,
                "baseRevision": item.get("editRevision", 0),
            }
        )

    for start in range(0, len(updates), BATCH):
        saved = call(
            "PUT",
            f"/tenants/{tenant}/token-values",
            {"editRevision": revision, "values": updates[start : start + BATCH]},
        )
        revision = saved["editRevision"]

    print(f"updated {len(updates)} android values, {skipped} kept (not in the package)")


if __name__ == "__main__":
    main(*sys.argv[1:7])
