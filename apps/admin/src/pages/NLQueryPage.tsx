import { useState } from 'react';
import { VITE_DS_REGISTRY_API } from '../api/client';
import './Page.css';

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

function NLQueryPage() {
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
    <div className="page nl-query-page">
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

export default NLQueryPage;
