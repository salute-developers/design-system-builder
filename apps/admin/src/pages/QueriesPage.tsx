import { useEffect, useState } from 'react';
import { VITE_DS_REGISTRY_API } from '../api/client';
import './Page.css';

interface ParamOption {
  value: string;
  label: string;
}

interface QueryParam {
  name: string;
  type: 'string' | 'number';
  default?: unknown;
  options?: ParamOption[];
}

interface CatalogEntry {
  id: string;
  label: string;
  type: string;
  params?: QueryParam[];
}

interface SavedQuery {
  id: string;
  label: string;
  sql: string;
  createdAt: string;
}

interface QueryResult {
  id: string;
  label: string;
  result: Record<string, unknown>[];
  count: number;
}

interface NLQueryResult {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
}

interface NLQueryError {
  error: string;
  sql?: string;
}

function NLQueryContent({ onSaved }: { onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NLQueryError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch(`${VITE_DS_REGISTRY_API}/nl-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data as NLQueryError);
      } else {
        setResult(data as NLQueryResult);
      }
    } catch (err) {
      setError({
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || saving || saved) return;

    setSaving(true);
    try {
      const res = await fetch(`${VITE_DS_REGISTRY_API}/saved-queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: query.trim(), sql: result.sql }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className={`nl-query-content${result || error ? ' nl-query-content--has-result' : ''}`}>
      <div className="nl-query-input-section">
        <div className="nl-query-input-wrapper">
          <textarea
            className="nl-query-textarea"
            placeholder="Введите запрос на естественном языке, например: список дизайн систем по пользователю neretin"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            className="nl-query-submit-btn"
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            title="Выполнить (Cmd+Enter)"
          >
            {loading ? (
              <span className="nl-query-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <span className="page-hint">Cmd+Enter для выполнения</span>
      </div>

      {error && (
        <div className="nl-query-error-block">
          <p className="page-error">{error.error}</p>
          {error.sql && (
            <pre className="nl-query-sql">{error.sql}</pre>
          )}
        </div>
      )}

      {result && (
        <div className="query-result">
          <details className="nl-query-sql-details" open>
            <summary className="nl-query-sql-summary">
              Сгенерированный SQL
            </summary>
            <pre className="nl-query-sql">{result.sql}</pre>
          </details>

          <div className="nl-query-actions">
            <p className="page-hint">Найдено: {result.count} записей</p>
            <button
              className="nl-query-save-btn"
              onClick={handleSave}
              disabled={saving || saved}
            >
              {saved ? 'Сохранено' : saving ? 'Сохранение...' : 'Сохранить в каталог'}
            </button>
          </div>

          {result.columns.length > 0 && (
            <div className="table-wrapper">
              <table className="result-table">
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {result.columns.map((col) => {
                        const val = row[col];
                        if (val === null || val === undefined)
                          return <td key={col} className="cell-null">NULL</td>;
                        if (typeof val === 'object')
                          return <td key={col}>{JSON.stringify(val)}</td>;
                        return <td key={col}>{String(val)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueriesPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'catalog' | 'saved' | 'nl'>('nl');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const fetchSavedQueries = async () => {
    try {
      const res = await fetch(`${VITE_DS_REGISTRY_API}/saved-queries`);
      const data = await res.json();
      setSavedQueries(data.queries ?? []);
    } catch {
      // silently ignore — saved queries are optional
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`${VITE_DS_REGISTRY_API}/queries`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => setCatalog(data.queries)),
      fetchSavedQueries(),
    ])
      .catch((e) => setCatalogError(e.message || 'Failed to load queries'))
      .finally(() => setCatalogLoading(false));
  }, []);

  const executeQuery = async (id: string, params?: Record<string, string>) => {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const qs = params
        ? '?' + new URLSearchParams(params).toString()
        : '';
      const res = await fetch(`${VITE_DS_REGISTRY_API}/queries/${id}${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setQueryResult(data);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setQueryLoading(false);
    }
  };

  const executeSavedQuery = async (id: string) => {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const res = await fetch(`${VITE_DS_REGISTRY_API}/saved-queries/${id}/run`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setQueryResult(data);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleSelectNL = () => {
    setActiveId(null);
    setActiveType('nl');
    setQueryResult(null);
    setQueryError(null);
    setParamValues({});
  };

  const handleSelect = (entry: CatalogEntry) => {
    setActiveId(entry.id);
    setActiveType('catalog');
    setQueryResult(null);
    setQueryError(null);

    if (entry.params && entry.params.length > 0) {
      const defaults: Record<string, string> = {};
      for (const p of entry.params) {
        const def = p.default != null ? String(p.default) : '';
        if (p.options && p.options.length > 0) {
          const hasMatch = p.options.some((o) => o.value === def);
          defaults[p.name] = hasMatch ? def : p.options[0].value;
        } else {
          defaults[p.name] = def;
        }
      }
      setParamValues(defaults);
    } else {
      setParamValues({});
      executeQuery(entry.id);
    }
  };

  const handleSelectSaved = (sq: SavedQuery) => {
    setActiveId(sq.id);
    setActiveType('saved');
    setParamValues({});
    setQueryResult(null);
    setQueryError(null);
    executeSavedQuery(sq.id);
  };

  const handleDeleteSaved = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${VITE_DS_REGISTRY_API}/saved-queries/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setSavedQueries((prev) => prev.filter((q) => q.id !== id));
      if (activeId === id) {
        handleSelectNL();
      }
    } catch {
      // ignore
    }
  };

  const handleExecute = () => {
    if (!activeId) return;
    executeQuery(activeId, paramValues);
  };

  const activeEntry = activeType === 'catalog'
    ? catalog.find((q) => q.id === activeId)
    : undefined;
  const hasParams = activeEntry?.params && activeEntry.params.length > 0;
  const columns = queryResult?.result?.length
    ? Object.keys(queryResult.result[0])
    : [];

  return (
    <div className="page">
      {catalogLoading && <p className="page-hint">Loading...</p>}
      {catalogError && <p className="page-error">{catalogError}</p>}

      {!catalogLoading && !catalogError && (
        <div className="queries-layout">
          <aside className="queries-sidebar">
            <button
              className={`queries-sidebar-item queries-sidebar-nl${activeType === 'nl' ? ' active' : ''}`}
              onClick={handleSelectNL}
            >
              <span className="queries-sidebar-label">NL Query</span>
              <span className="queries-sidebar-type">AI</span>
            </button>

            <div className="queries-sidebar-separator" />

            {catalog.map((q) => (
              <button
                key={q.id}
                className={`queries-sidebar-item${q.id === activeId && activeType === 'catalog' ? ' active' : ''}`}
                onClick={() => handleSelect(q)}
              >
                <span className="queries-sidebar-label">{q.label}</span>
                <span className="queries-sidebar-type">{q.type}</span>
              </button>
            ))}

            {savedQueries.length > 0 && (
              <>
                <div className="queries-sidebar-separator" />
                {savedQueries.map((sq) => (
                  <button
                    key={sq.id}
                    className={`queries-sidebar-item${sq.id === activeId && activeType === 'saved' ? ' active' : ''}`}
                    onClick={() => handleSelectSaved(sq)}
                  >
                    <span className="queries-sidebar-label">
                      {sq.label}
                      <span className="queries-badge-ai">AI</span>
                    </span>
                    <span
                      className="queries-sidebar-delete"
                      onClick={(e) => handleDeleteSaved(e, sq.id)}
                      title="Удалить запрос"
                    >
                      &times;
                    </span>
                  </button>
                ))}
              </>
            )}
          </aside>

          <section className="queries-content">
            {activeType === 'nl' && (
              <NLQueryContent onSaved={fetchSavedQueries} />
            )}

            {activeType !== 'nl' && activeEntry && hasParams && (
              <div className="queries-params">
                <h3 className="queries-params-title">Параметры</h3>
                {activeEntry.params!.map((p) => (
                  <div key={p.name} className="queries-param-row">
                    <label className="queries-param-label">{p.name}</label>
                    {p.options ? (
                      <select
                        className="queries-param-select"
                        value={paramValues[p.name] ?? ''}
                        onChange={(e) =>
                          setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                      >
                        {p.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="queries-param-input"
                        type={p.type === 'number' ? 'number' : 'text'}
                        value={paramValues[p.name] ?? ''}
                        onChange={(e) =>
                          setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                ))}
                <button
                  className="query-btn"
                  onClick={handleExecute}
                  disabled={queryLoading}
                >
                  {queryLoading ? 'Выполняется...' : 'Выполнить'}
                </button>
              </div>
            )}

            {activeType !== 'nl' && queryLoading && !hasParams && (
              <p className="page-hint">Загрузка...</p>
            )}

            {activeType !== 'nl' && queryError && <p className="page-error">{queryError}</p>}

            {activeType !== 'nl' && queryResult && (
              <div className="query-result">
                <p className="page-hint">Найдено: {queryResult.count} записей</p>
                {columns.length > 0 && (
                  <div className="table-wrapper">
                    <table className="result-table">
                      <thead>
                        <tr>
                          {columns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.result.map((row, i) => (
                          <tr key={i} className={row._status ? `row-status-${row._status}` : undefined}>
                            {columns.map((col) => {
                              const val = row[col];
                              if (val === null || val === undefined)
                                return <td key={col} className="cell-null">NULL</td>;
                              if (typeof val === 'object')
                                return <td key={col}>{JSON.stringify(val)}</td>;
                              return <td key={col}>{String(val)}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default QueriesPage;
