// Реальный код чтения и слияния клиента без React render; проектный DTO, auth и стили заменены тестовыми адаптерами.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const variant = process.argv[2];
const serverInfo = process.argv[3];
const output = process.argv[4];
const bundle = process.argv[5];
const info = JSON.parse(fs.readFileSync(serverInfo));
process.env.DS_ACCEPT_PORT = info.port;
const origin = "http://127.0.0.1:" + info.port,
  root = "/api/design-systems/" + info.system;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.window = {
  location: { origin },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};
const sdk = require(require("node:path").resolve(bundle));
const ctx = {
  projectId: "performance-project",
  designSystemId: info.system,
  tenantId: info.tenant,
};
const samples = [];
const commands = [];
async function api(method, path, body, rev = "0") {
  const r = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Actor-Type": "user",
      "X-User-Id": "performance-user",
      "X-Project-Id": "performance-project",
      "X-Project-Role": "owner",
      "X-DS-Base-Revision": String(rev),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await r.json();
  assert.ok(r.ok, method + " " + path + " " + JSON.stringify(value));
  return value;
}
// Runtime sorts metadata by name; sort a copy without hiding duplicate entries.
const comparableTheme = (theme) => ({
  ...theme,
  meta: { ...theme.meta, tokens: [...theme.meta.tokens].sort((a, b) =>
    a.type.localeCompare(b.type) || a.name.localeCompare(b.name)) },
});
const business = (values) =>
  Object.fromEntries(values.map(({ editRevision, ...v }) => [v.id, v]));
(async () => {
  const controller = new AbortController();
  const shell = await sdk.loadThemeShell(ctx, controller.signal);
  const section = new sdk.EditorSectionData(ctx, shell, controller.signal);
  await section.activate("colors");
  const initialTheme = structuredClone(section.currentSnapshot.themeData);
  const defs = await api("GET", root + "/tokens?type=color");
  const ids = defs
    .filter((t) => t.name.startsWith("performance."))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 12)
    .map((t) => t.id);
  const original = await api(
    "GET",
    root + "/tenants/" + info.tenant + "/token-values",
  );
  const chosen = original.filter((v) => ids.includes(v.tokenId));
  assert.equal(chosen.length, 72);
  const draft = (await api("GET", root)).draftId;
  for (let i = 0; i < 23; i++) {
    const values = await api(
      "GET",
      root + "/tenants/" + info.tenant + "/token-values",
    );
    const byId = new Map(values.map((v) => [v.id, v]));
    for (const v of chosen)
      await api(
        "PATCH",
        root + "/token-values/" + v.id,
        { value: ["#123456"] },
        byId.get(v.id).editRevision,
      );
    const changed = (
      await api("GET", root + "/tenants/" + info.tenant + "/token-values")
    ).filter((v) => chosen.some((x) => x.id === v.id));
    const acknowledgements = ids.map((tokenId) => ({
      tokenId,
      values: changed.filter((value) => value.tokenId === tokenId).map((value) => ({
        platform: value.platform, mode: value.mode,
        value: value.sourceValue ?? value.value,
        revision: value.editRevision, entityId: value.id, overridden: value.overridden,
      })),
    }));
    assert.equal(section.acceptConfirmedValues(acknowledgements), true);
    assert.notDeepEqual(section.currentSnapshot.themeData, initialTheme);
    const start = performance.now();
    await api("POST", root + "/changes/revert-by-address", {
      draftId: draft,
      targets: changed.map((v) => ({
        entityType: "token-value",
        entityId: v.id,
        expectedRevision: v.editRevision,
      })),
    });
    const command = performance.now() - start;
    sdk.invalidateEditorReads(ctx);
    const journal = () =>
      Promise.all([
        sdk.readEditor(
          "/api/projects/performance-project/design-systems/" +
            info.system +
            "/changes/summary",
        ),
        sdk.readEditor(
          "/api/projects/performance-project/design-systems/" +
            info.system +
            "/changes/token-ids",
          { params: { tenantId: info.tenant } },
        ),
      ]);
    const auxiliary = journal();
    if (variant === "current")
      assert.equal(
        await section.refreshAddressedColors(
          changed.map((v) => ({ entityType: "token-value", entityId: v.id })),
        ),
        true,
      );
    else {
      section.invalidate(new Set(["theme-tokens"]), changed.map((v) => ({ entityType: "token-value", entityId: v.id })));
      await section.refresh();
    }
    await auxiliary;
    const elapsed = performance.now() - start;
    const restored = await api(
      "GET",
      root + "/tenants/" + info.tenant + "/token-values",
    );
    assert.deepEqual(business(restored), business(original));
    assert.deepEqual(comparableTheme(section.currentSnapshot.themeData), comparableTheme(initialTheme));
    assert.equal((await api("GET", root + "/changes/summary")).total, 0);
    if (i >= 3) {
      samples.push(elapsed);
      commands.push(command);
    }
    console.log(variant, i, elapsed.toFixed(2), command.toFixed(2));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const cs = [...commands].sort((a, b) => a - b);
  const report = {
    variant,
    samplesMs: samples,
    commandSamplesMs: commands,
    medianMs: (sorted[9] + sorted[10]) / 2,
    p95Ms: sorted[18],
    commandMedianMs: (cs[9] + cs[10]) / 2,
    responsesEqual: true,
    targets: 72,
    environment:
      "Node HTTP + actual EditorSectionData/readEditor; no browser render",
  };
  fs.writeFileSync(output, JSON.stringify(report));
  console.log(JSON.stringify(report));
})()
  .then(() => fs.writeFileSync(serverInfo + ".stop", ""))
  .catch((e) => {
    console.error(e.stack);
    fs.writeFileSync(serverInfo + ".stop", "");
    process.exitCode = 1;
  });
