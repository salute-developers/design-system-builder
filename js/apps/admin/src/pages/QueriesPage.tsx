import { useEffect, useState } from 'react';
import { VITE_DB_SERVICE_API } from '../api/client';
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

interface QueryResult {
  id: string;
  label: string;
  result: Record<string, unknown>[];
  count: number;
}

function QueriesPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${VITE_DB_SERVICE_API}/admin/queries`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setCatalog(data.queries))
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
      const res = await fetch(`${VITE_DB_SERVICE_API}/admin/queries/${id}${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setQueryResult(data);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleSelect = (entry: CatalogEntry) => {
    setActiveId(entry.id);
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

  const handleExecute = () => {
    if (!activeId) return;
    executeQuery(activeId, paramValues);
  };

  const activeEntry = catalog.find((q) => q.id === activeId);
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
            {catalog.map((q) => (
              <button
                key={q.id}
                className={`queries-sidebar-item${q.id === activeId ? ' active' : ''}`}
                onClick={() => handleSelect(q)}
              >
                <span className="queries-sidebar-label">{q.label}</span>
                <span className="queries-sidebar-type">{q.type}</span>
              </button>
            ))}
          </aside>

          <section className="queries-content">
            {!activeEntry && <p className="page-hint">Выберите запрос из каталога.</p>}

            {activeEntry && hasParams && (
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

            {queryLoading && !hasParams && (
              <p className="page-hint">Загрузка...</p>
            )}

            {queryError && <p className="page-error">{queryError}</p>}

            {queryResult && (
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
