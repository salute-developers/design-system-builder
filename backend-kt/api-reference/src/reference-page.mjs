const projectIdParameterName = 'projectId';

/** Extracts a non-empty project context from an API Reference page URL. */
export function readProjectId(requestUrl) {
  const projectId = new URL(requestUrl, 'http://127.0.0.1').searchParams.get(projectIdParameterName)?.trim();
  return projectId || undefined;
}

/** Builds the locally hosted Scalar page and its project-context control. */
export function renderReferencePage(sources, projectId) {
  const scalarSources = sources.map(({ id, title, requiresProjectId }) => ({
    title,
    slug: id,
    url: `/openapi/${id}.json${requiresProjectId && projectId ? `?${projectIdParameterName}=${encodeURIComponent(projectId)}` : ''}`,
  }));
  const inputValue = escapeHtml(projectId ?? '');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DS Builder API reference</title>
<style>
  #project-context { align-items: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px; padding: 8px 16px; }
  #project-context label { color: #334155; font: 600 14px system-ui, sans-serif; }
  #project-context input { border: 1px solid #cbd5e1; border-radius: 4px; font: 14px system-ui, sans-serif; max-width: 420px; padding: 6px 8px; width: 100%; }
  #project-context button { background: #334155; border: 0; border-radius: 4px; color: white; cursor: pointer; font: 600 14px system-ui, sans-serif; padding: 7px 12px; }
  #project-context button[type="button"] { background: transparent; color: #475569; }
  #project-context small { color: #64748b; font: 12px system-ui, sans-serif; }
</style></head>
<body>
<form id="project-context">
  <label for="project-id">Project ID</label>
  <input id="project-id" name="projectId" value="${inputValue}" placeholder="Select a project in Projects, then paste its ID here" autocomplete="off">
  <button type="submit">Apply</button>
  <button type="button" id="clear-project-id">Clear</button>
  <small>Used by all Design systems requests in this browser.</small>
</form>
<div id="app"></div><script src="/scalar.js"></script><script>
  const storageKey = 'ds-builder-api-reference.project-id';
  const form = document.querySelector('#project-context');
  const input = document.querySelector('#project-id');
  const clear = document.querySelector('#clear-project-id');
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.get('${projectIdParameterName}')) {
    const savedProjectId = window.localStorage.getItem(storageKey);
    if (savedProjectId) {
      currentUrl.searchParams.set('${projectIdParameterName}', savedProjectId);
      window.location.replace(currentUrl);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const projectId = input.value.trim();
    if (projectId) window.localStorage.setItem(storageKey, projectId);
    else window.localStorage.removeItem(storageKey);
    const nextUrl = new URL(window.location.href);
    if (projectId) nextUrl.searchParams.set('${projectIdParameterName}', projectId);
    else nextUrl.searchParams.delete('${projectIdParameterName}');
    window.location.assign(nextUrl);
  });
  clear.addEventListener('click', () => {
    window.localStorage.removeItem(storageKey);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('${projectIdParameterName}');
    window.location.assign(nextUrl);
  });
  Scalar.createApiReference('#app', ${JSON.stringify({ sources: scalarSources, persistAuth: false, hideClientButton: true })});
</script></body></html>`;
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
