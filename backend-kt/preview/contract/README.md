# Preview Protocol contract

Canonical JSON Schema and shared fixtures of Preview Protocol v1. Consumers:

- `design-system-builder/js/apps/client` reads these files directly in its tests (`npm test`, no copy);
- `plasma-android/integration-core/preview-contract` keeps byte-identical copies and checks them against the
  fingerprints in `CONTRACT.sha256` (see below).

Layout:

- `schemas/v1/preview-payload.schema.json` — payload schema;
- `fixtures/v1/valid` — payloads every consumer must accept;
- `fixtures/v1/invalid` — payloads every consumer must reject;
- `fixtures/v1/web/valid` — payloads of the `WEB` platform; only the web consumers (the client and
  `js/apps/preview-web-plugin`) check them.

Platform fixtures are kept apart from the shared ones on purpose. `valid` and `invalid` are copied into
plasma-android and checked there against `CONTRACT.sha256`, so everything placed there becomes part of the
Android repository. A web-only payload would then live and be verified in a repository that neither builds nor
renders web components, and every change of the web format would require a plasma-android release. Each consumer
keeps only the fixtures it validates: shared fixtures describe what every platform must accept or reject, platform
fixtures stay in this repository next to the platform's consumers. The schema is the same for all of them.

Format highlights:

- property `states` is an ordered array of `{when: [stateNames], source}`; when several entries
  match, the one with the most names wins, ties go to the later entry;
- property sources: `literal` and `tokenRef` (both accept `alpha` 0..1), `styleRef` (key of the
  top-level `styles` map), `assetRef` (id from `assets`);
- theme tokens: color, dimension, shape, shadow (layers with `spread`), gradient (linear layers, `angle` in degrees by the CSS convention: 0° bottom to top, 90° left to right),
  fontFamily, typography (optional `fontStyle`: `NORMAL` | `ITALIC`);
- assets: `TTF`, `OTF`, `WOFF`, `WOFF2`, `SVG`, `PNG`; a plugin that does not support a font format uses the default
  font of the family with `allowFallback: true` and answers with a warning;
- `styles` entries are `{component, properties}`; an entry may also carry the optional `variation` (variation name),
  `name` (style name within the variation), `default: true` (the default style of its variation) and `invariant: true`
  (the invariants of the component). Such entries describe every style of a related component, so the plugin can build
  its full config (`fixtures/v1/valid/related-styles-woff2.json`); an entry without them stays a nested style for
  `styleRef`. Consumers that do not know the optional fields ignore them.

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

Platform `WEB` (`js/apps/preview-web-plugin`; example — `fixtures/v1/web/valid/web-button.json`):

- the payload follows the same rules as `COMPOSE`: properties by canonical property name, sources `literal`,
  `tokenRef`, `styleRef`, states in the ordered `states` array, theme tokens in the schema structures with the values of
  the web platform of the design system converted to protocol units (sizes in px, colors `#RRGGBBAA`, shadows and
  gradients as layers, typography with `letterSpacing` in px and optional `fontStyle`, font families as faces with
  `WOFF2`/`WOFF` assets). There are no root fields known to one platform only; values are never pre-translated to CSS;
- properties are selected by the web parameters of the component: a property without a web parameter but with
  parameters of other platforms is skipped;
- value overrides of web parameters stored by the design system come as the `tokenRef` source of the property (or of
  its state); web templates of multi-value properties and web adjustments are not sent: they are web library knowledge
  and live in the web plugin (`web-adapter.json`, API meta);
- `component.variations` holds the selected style names by variation name (a flag style is named `true`);
- `styles` carries every style of every variation and the invariants of the selected component, of every component
  from its dependencies and of every parent it is a `compose` child of (`<component>/<variation>/<style>`,
  `<component>/invariants`, with `variation`/`name`/`default`/`invariant`); the tokens they reference are in `theme`.
  The plugin builds the related component configs of the story and the shared variables of `compose` dependencies from
  them;
- `theme` also carries the color tokens of the selected mode by their full id (`dark.text.default.primary`) for the
  story environment and the body font `fontFamily.body`;
- `surface.background` is the id of the theme color token of the preview background (present in `theme`) or a color;
  `surface.width`/`height` are ignored by the web plugin;
- `example` is `{id: <story name>, props: <story arguments that differ from the defaults>}`; an unknown story is
  answered with `failure` `story_not_found` (`path` `$.example.id`);
- the plugin answers `invalid_payload` for a payload with the root field `web` (`$.web`) or with CSS strings instead of
  protocol values.

`describe` (platform `WEB`):

- the envelope `{type: "sdds.preview.describe", protocolVersion: 1, requestId, componentId, storyId?}` takes an optional
  `storyId`; without it the plugin describes the default story, the first one of the component;
- the description carries `stories: [{id, name}]` — every story of the component in order, the first is the default;
  `id` equals the story name. `storyId` of the description is the described story;
- `properties` are the arguments of the described story: booleans as `boolean`, strings with a list as `singleChoice`,
  other strings as `string`, numbers as `int`/`float`;
- an unknown `storyId` is answered with `failure` `story_not_found`, an unknown component with `component_not_found`.
  Hosts that do not know `stories` ignore it.

Render results:

- a `failure` result may carry optional `details` `{stack?, consoleError?}`: the stack of the exception that
  stopped the plugin and its message (`render_crashed`, `plugin_crashed`). Consumers that do not know the field
  ignore it. A Kotlin/Wasm exception reaches the browser as an opaque `WebAssembly.Exception`, so the plugin reports
  the cause of a layout failure from Kotlin; composition and draw failures carry no cause.

The version number stays `1`: the protocol has not been released outside development.
Copies between repositories are compared manually when a client and plugin pair is released.

Fingerprints:

- `CONTRACT.sha256` holds the SHA-256 of the schema and every shared fixture (`sha256sum` format, paths relative to this
  directory, sorted). After changing a schema or fixture run `./fingerprint.sh --write`; CI runs `./fingerprint.sh --check`.
- Update the plasma-android copy with
  `./fingerprint.sh --sync-to <plasma-android>/integration-core/preview-contract/src/commonMain/resources`: it copies the
  schema, puts fixtures into `fixtures/v1/shared` and rewrites `schemas/v1/DIGEST`.
- plasma-android compares its `DIGEST` with the canonical `CONTRACT.sha256` (paths differ by `fixtures/v1/shared/`):
  a pull request gets a warning, `release/*`, `hotfix/*`, `main` and the nightly run on `develop` fail.
