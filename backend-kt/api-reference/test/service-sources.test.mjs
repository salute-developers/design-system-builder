import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { serviceSources } from '../src/catalog.mjs';
import { transformOpenApi } from '../src/openapi-transform.mjs';

const servers = [{ url: '/targets/local' }];

test('transforms every path covered by every service-level source rule', async () => {
  for (const source of serviceSources) {
    const content = await readFile(source.specPath, 'utf8');
    const document = source.specPath.endsWith('.json') ? JSON.parse(content) : parse(content);
    const expectedPaths = Object.keys(document.paths).filter(
      (path) => path === source.sourcePrefix || path.startsWith(`${source.sourcePrefix}/`),
    );
    const result = transformOpenApi(document, source, servers);

    assert.ok(expectedPaths.length > 0, `${source.id} has paths for its prefix`);
    assert.equal(Object.keys(result.paths).length, expectedPaths.length, `${source.id} path count`);
    for (const path of expectedPaths) {
      const publicPath = `${source.gatewayPrefix}${path.slice(source.sourcePrefix.length)}`;
      assert.ok(result.paths[publicPath], `${source.id} transforms ${path}`);
    }
    if (source.requiresAuthentication) {
      const operations = JSON.stringify(result.paths).toLowerCase();
      for (const header of ['x-user-id', 'x-system-admin', 'x-actor-type', 'x-project-id', 'x-project-role', 'x-project-key-id', 'x-project-scopes']) {
        assert.equal(operations.includes(header), false, `${source.id} omits ${header}`);
      }
    }
  }
});
