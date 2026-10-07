import test from 'node:test';
import assert from 'node:assert/strict';
import { readProjectId, renderReferencePage } from '../src/reference-page.mjs';

const sources = [
  { id: 'projects', title: 'Projects', requiresProjectId: false },
  { id: 'design-systems', title: 'Design systems', requiresProjectId: true },
];

test('reads a selected project from the local API Reference URL', () => {
  assert.equal(readProjectId('/?projectId=project-42'), 'project-42');
  assert.equal(readProjectId('/?projectId=%20%20'), undefined);
});

test('passes the selected project only to project-scoped OpenAPI sources', () => {
  const page = renderReferencePage(sources, 'project-42');

  assert.match(page, /\/openapi\/projects\.json/);
  assert.match(page, /\/openapi\/design-systems\.json\?projectId=project-42/);
  assert.match(page, /Project ID/);
  assert.match(page, /hideClientButton/);
});
