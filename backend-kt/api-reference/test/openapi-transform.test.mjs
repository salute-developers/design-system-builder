import test from 'node:test';
import assert from 'node:assert/strict';
import { transformOpenApi } from '../src/openapi-transform.mjs';

const servers = [{ url: '/targets/local', description: 'Local gateway' }];

test('keeps an OAuth token URL below the selected proxy target', () => {
  const selectedServerUrl = 'http://127.0.0.1:8090/targets/local/';

  assert.equal(new URL('auth/token', selectedServerUrl).toString(), `${selectedServerUrl}auth/token`);
});

test('rewrites every design-system path with one service prefix and projectId', () => {
  const document = {
    openapi: '3.0.3',
    paths: {
      '/api/ds/design-systems': { get: { responses: { 200: { description: 'ok' } } } },
      '/api/ds/themes': { post: { responses: { 201: { description: 'created' } } } },
    },
  };
  const result = transformOpenApi(document, {
    id: 'design-systems',
    sourcePrefix: '/api/ds',
    gatewayPrefix: '/api/projects/{projectId}/ds',
    requiresProjectId: true,
    requiresAuthentication: true,
  }, servers, { projectId: 'project-42' });

  assert.deepEqual(Object.keys(result.paths), [
    '/api/projects/{projectId}/ds/design-systems',
    '/api/projects/{projectId}/ds/themes',
  ]);
  assert.deepEqual(result.paths['/api/projects/{projectId}/ds/themes'].post.parameters, [{
    name: 'projectId', in: 'path', required: true, schema: { type: 'string', default: 'project-42' },
  }]);
  assert.deepEqual(result.paths['/api/projects/{projectId}/ds/themes'].post.security, [{ GatewayOAuth: ['openid'] }]);
  assert.equal(result.components.securitySchemes.GatewayOAuth.type, 'oauth2');
  assert.equal(result.components.securitySchemes.GatewayOAuth.flows.password.tokenUrl, 'auth/token');
  assert.equal(result.components.securitySchemes.GatewayOAuth.flows.password['x-scalar-credentials-location'], 'body');
  assert.equal(result.components.securitySchemes.GatewayOAuth.flows.password['x-scalar-secret-client-id'], 'dsbuilder-api');
  assert.equal(result['x-scalar-environments'], undefined);
});

test('applies a configured project default to referenced project parameters', () => {
  const document = {
    paths: {
      '/projects/{projectId}': {
        get: {
          parameters: [{ $ref: '#/components/parameters/ProjectIdPath' }],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
    components: {
      parameters: {
        ProjectIdPath: { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
      },
    },
  };
  const result = transformOpenApi(document, {
    id: 'projects', sourcePrefix: '/projects', gatewayPrefix: '/api/projects', requiresProjectId: false, requiresAuthentication: true,
  }, servers, { projectId: 'project-42' });

  assert.equal(result.components.parameters.ProjectIdPath.schema.default, 'project-42');
});

test('leaves project-scoped parameters empty until a local project context is selected', () => {
  const document = {
    paths: {
      '/api/ds/themes': { get: { responses: { 200: { description: 'ok' } } } },
    },
  };
  const result = transformOpenApi(document, {
    id: 'design-systems',
    sourcePrefix: '/api/ds',
    gatewayPrefix: '/api/projects/{projectId}/ds',
    requiresProjectId: true,
    requiresAuthentication: true,
  }, servers);

  assert.equal(
    result.paths['/api/projects/{projectId}/ds/themes'].get.parameters[0].schema.default,
    '',
  );
});

test('filters non-service paths and removes trusted headers from public operations', () => {
  const document = {
    openapi: '3.0.3',
    paths: {
      '/health': { get: { responses: { 200: { description: 'ok' } } } },
      '/projects': {
        get: {
          parameters: [
            { name: 'X-User-Id', in: 'header', schema: { type: 'string' } },
            { $ref: '#/components/parameters/XProjectScopes' },
            { name: 'query', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'ok' } },
        },
      },
    },
    components: { parameters: { XProjectScopes: { name: 'X-Project-Scopes', in: 'header' } } },
  };
  const result = transformOpenApi(document, {
    id: 'projects',
    sourcePrefix: '/projects',
    gatewayPrefix: '/api/projects',
    requiresProjectId: false,
    requiresAuthentication: true,
  }, servers);

  assert.deepEqual(Object.keys(result.paths), ['/api/projects']);
  assert.deepEqual(result.paths['/api/projects'].get.parameters, [
    { name: 'query', in: 'query', schema: { type: 'string' } },
  ]);
  assert.deepEqual(result.components.parameters, {});
  assert.deepEqual(result.paths['/api/projects'].get.security, [{ GatewayOAuth: ['openid'] }]);
});
