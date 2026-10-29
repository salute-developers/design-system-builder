import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { serviceSources } from '../src/catalog.mjs';
import { transformOpenApi } from '../src/openapi-transform.mjs';

test('authentication source exposes only the public token endpoint', async () => {
  const source = serviceSources.find(({ id }) => id === 'gateway-authentication');
  const document = parse(await readFile(source.specPath, 'utf8'));
  const result = transformOpenApi(document, source, [{ url: '/targets/local' }]);

  assert.notEqual(source.id, document.paths['/auth/token'].post.tags[0].toLowerCase());
  assert.deepEqual(Object.keys(result.paths), ['/auth/token']);
  assert.equal(result.paths['/auth/token'].post.operationId, 'obtainAccessToken');
  assert.ok(result.paths['/auth/token'].post.requestBody.content['application/x-www-form-urlencoded']);
  const schema = result.paths['/auth/token'].post.requestBody.content['application/x-www-form-urlencoded'].schema;
  assert.equal(schema.properties.client_id.default, 'dsbuilder-api');
  assert.equal(schema.properties.grant_type.default, 'password');
  assert.equal(JSON.stringify(result).includes('/internal/'), false);
  assert.equal(result.components.securitySchemes.BearerAuth.scheme, 'bearer');
});
