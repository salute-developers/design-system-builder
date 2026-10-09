import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { serviceSources } from './catalog.mjs';
import { transformOpenApi } from './openapi-transform.mjs';
import { readProjectId, renderReferencePage } from './reference-page.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const port = parsePort(process.env.API_REFERENCE_PORT ?? '8090');
const targets = configuredTargets();
const requestDefaults = configuredRequestDefaults();
const sourceDocuments = await loadSourceDocuments();
const scalarScript = await readFile(
  path.resolve(currentDirectory, '../node_modules/@scalar/api-reference/dist/browser/standalone.js'),
);

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      return sendHtml(response, renderReferencePage(serviceSources, readProjectId(request.url)));
    }
    if (request.url === '/scalar.js') {
      return send(response, 200, 'application/javascript; charset=utf-8', scalarScript);
    }
    const sourceId = requestUrl.pathname.match(/^\/openapi\/([a-z-]+)\.json$/)?.[1];
    if (sourceId && sourceDocuments[sourceId]) {
      return sendJson(response, transformOpenApi(
        sourceDocuments[sourceId],
        serviceSources.find((source) => source.id === sourceId),
        serversForTargets(targets),
        { ...requestDefaults, ...(readProjectId(request.url) ? { projectId: readProjectId(request.url) } : {}) },
      ));
    }
    const targetMatch = request.url?.match(/^\/targets\/([a-z]+)(\/.*)?$/);
    if (targetMatch) {
      return await proxyGatewayRequest(request, response, targetMatch[1], targetMatch[2] ?? '/');
    }
    return send(response, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (error) {
    console.error(error);
    return send(response, 500, 'text/plain; charset=utf-8', 'API reference server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`API reference: http://127.0.0.1:${port}`);
});

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid API_REFERENCE_PORT: ${value}`);
  }
  return parsed;
}

function configuredTargets() {
  return {
    local: 'http://localhost:8080',
    ...(process.env.DS_API_REFERENCE_DEV_GATEWAY ? { dev: process.env.DS_API_REFERENCE_DEV_GATEWAY } : {}),
    ...(process.env.DS_API_REFERENCE_PROD_GATEWAY ? { production: process.env.DS_API_REFERENCE_PROD_GATEWAY } : {}),
  };
}

function configuredRequestDefaults() {
  return {
    ...(process.env.DS_API_REFERENCE_PROJECT_ID ? { projectId: process.env.DS_API_REFERENCE_PROJECT_ID } : {}),
  };
}

async function loadSourceDocuments() {
  const sources = await Promise.all(serviceSources.map(async (source) => {
    const content = await readFile(source.specPath, 'utf8');
    const document = source.specPath.endsWith('.json') ? JSON.parse(content) : parse(content);
    return [source.id, document];
  }));
  return Object.fromEntries(sources);
}

function serversForTargets(targets) {
  return Object.keys(targets).map((target) => ({
    // Scalar resolves the OAuth token URL relative to this URL. The trailing
    // slash preserves the target name as a path segment.
    url: `/targets/${target}/`,
    description: target === 'local' ? 'Local gateway' : `${target[0].toUpperCase()}${target.slice(1)} gateway`,
  }));
}

async function proxyGatewayRequest(request, response, targetName, pathAndQuery) {
  const target = targets[targetName];
  if (!target) {
    return send(response, 404, 'text/plain; charset=utf-8', 'Unknown gateway target');
  }
  const body = await readRequestBody(request);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  const upstream = await fetch(new URL(pathAndQuery, ensureTrailingSlash(target)), {
    method: request.method,
    headers,
    body: body.length === 0 || ['GET', 'HEAD'].includes(request.method ?? '') ? undefined : body,
    redirect: 'manual',
  });
  upstream.headers.forEach((value, key) => {
    if (!['connection', 'content-encoding', 'content-length', 'transfer-encoding'].includes(key)) {
      response.setHeader(key, value);
    }
  });
  response.writeHead(upstream.status);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendHtml(response, body) {
  send(response, 200, 'text/html; charset=utf-8', body);
}

function sendJson(response, document) {
  send(response, 200, 'application/json; charset=utf-8', JSON.stringify(document));
}

function send(response, status, contentType, body) {
  response.writeHead(status, { 'content-type': contentType });
  response.end(body);
}
