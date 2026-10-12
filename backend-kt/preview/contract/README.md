# Preview Protocol contract

Canonical JSON Schema and shared fixtures of Preview Protocol v1. Consumers keep byte-identical
copies and check them:

- `design-system-builder/js/apps/client` (`npm run check:preview-schema`);
- `plasma-android/integration-core/preview-contract` (digest check in its tests).

Layout:

- `schemas/v1/preview-payload.schema.json` — payload schema;
- `fixtures/v1/valid` — payloads every consumer must accept;
- `fixtures/v1/invalid` — payloads every consumer must reject.

Format highlights:

- property `states` is an ordered array of `{when: [stateNames], source}`; when several entries
  match, the one with the most names wins, ties go to the later entry;
- property sources: `literal` and `tokenRef` (both accept `alpha` 0..1), `styleRef` (key of the
  top-level `styles` map), `assetRef` (id from `assets`);
- theme tokens: color, dimension, shape, shadow (layers with `spread`), gradient (linear layers, `angle` in degrees by the CSS convention: 0° bottom to top, 90° left to right),
  fontFamily, typography;
- assets: `TTF`, `OTF`, `SVG`, `PNG`.

The version number stays `1`: the protocol has not been released outside development.
Copies between repositories are compared manually when a client and plugin pair is released.
