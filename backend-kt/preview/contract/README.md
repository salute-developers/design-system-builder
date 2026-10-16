# Preview Protocol contract

Canonical JSON Schema and shared fixtures of Preview Protocol v1. Consumers:

- `design-system-builder/js/apps/client` reads these files directly in its tests (`npm test`, no copy);
- `plasma-android/integration-core/preview-contract` keeps byte-identical copies and checks them against a recorded
  digest.

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

Defaults:

- optional `defaults` carries what the sandbox app provides around every story: `text` (`style` and `color` are theme
  token ids) and `styles` (`button`, `switch`, `spinner` are ids from `styles` of `BasicButton`, `Switch`, `Spinner`
  components). The client builds them from the design system theme; the plugin provides them as the default text style
  and as `LocalButtonStyle`, `LocalSwitchStyle`, `LocalSpinnerStyle`. A missing section, token or style is skipped.
- `states` of a property are ordered by priority: when several entries match with the same number of states, the last
  one wins. A producer whose source lets the first match win (Android `ColorStateList`) reverses its order.

Icons:

- a property of type `icon` (`closedIcon`, `openedIcon`, ...) is a `literal` string: the icon name as it is stored in
  the component configuration (`disclosure.down.fill.16`). The plugin maps it to an icon of its registry and answers
  with the warning `unknown_icon` when it has none. A property without a value is not sent.

Render results:

- a `failure` result may carry optional `details` `{stack?, consoleError?}`: the stack of the exception that
  stopped the plugin and its message (`render_crashed`, `plugin_crashed`). Consumers that do not know the field
  ignore it. A Kotlin/Wasm exception reaches the browser as an opaque `WebAssembly.Exception`, so the plugin reports
  the cause of a layout failure from Kotlin; composition and draw failures carry no cause.

The version number stays `1`: the protocol has not been released outside development.
Copies between repositories are compared manually when a client and plugin pair is released.
