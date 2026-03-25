import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { VITE_DS_REGISTRY_API } from '../api/client';
import './Page.css';

interface TableMeta {
  name: string;
  columns: string[];
  count: number;
}

const PAGE_SIZE = 50;

function DataTable({
  meta,
  rows,
}: {
  meta: TableMeta;
  rows: Record<string, unknown>[];
}) {
  const columnHelper = createColumnHelper<Record<string, unknown>>();

  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      meta.columns.map((col) =>
        columnHelper.accessor(col, {
          header: col,
          cell: (info) => {
            const val = info.getValue();
            if (val === null || val === undefined) return <span className="cell-null">NULL</span>;
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          },
        }),
      ),
    [meta.columns],
  );

  const reactTable = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="table-wrapper">
      <table className="result-table">
        <thead>
          {reactTable.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {reactTable.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablesPage() {
  const [tablesMeta, setTablesMeta] = useState<TableMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, unknown>[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const allRowsTableRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`${VITE_DS_REGISTRY_API}/tables`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setTablesMeta(data.tables);
        if (data.tables.length > 0) {
          setActiveTable(data.tables[0].name);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load tables');
        setLoading(false);
      });
  }, []);

  const fetchRows = useCallback((tableName: string, pageNum: number) => {
    setRowsLoading(true);
    fetch(`${VITE_DS_REGISTRY_API}/tables/${tableName}?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRows(data.rows);
        setRowsLoading(false);
      })
      .catch(() => {
        setRows([]);
        setRowsLoading(false);
      });
  }, []);

  const fetchAllRows = useCallback((tableName: string) => {
    if (allRowsTableRef.current === tableName && allRows !== null) return;

    setRowsLoading(true);
    fetch(`${VITE_DS_REGISTRY_API}/tables/${tableName}?all=true`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setAllRows(data.rows);
        allRowsTableRef.current = tableName;
        setRowsLoading(false);
      })
      .catch(() => {
        setAllRows([]);
        allRowsTableRef.current = tableName;
        setRowsLoading(false);
      });
  }, [allRows]);

  useEffect(() => {
    if (activeTable) {
      setPage(0);
      setSearch('');
      setCommittedSearch('');
      setAllRows(null);
      allRowsTableRef.current = null;
      fetchRows(activeTable, 0);
    }
  }, [activeTable, fetchRows]);

  const isSearching = committedSearch.trim().length > 0;
  const [searchPage, setSearchPage] = useState(0);

  useEffect(() => {
    if (isSearching && activeTable) {
      fetchAllRows(activeTable);
      setSearchPage(0);
    }
  }, [isSearching, activeTable, fetchAllRows]);

  const filteredRows = useMemo(() => {
    const q = committedSearch.trim().toLowerCase();

    if (!q) return rows;

    const source = allRows ?? rows;
    return source.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.toLowerCase().includes(q);
      }),
    );
  }, [rows, allRows, committedSearch]);

  const displayRows = useMemo(() => {
    if (!isSearching) return filteredRows;
    const start = searchPage * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, isSearching, searchPage]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!activeTable) return;
      setPage(newPage);
      fetchRows(activeTable, newPage);
    },
    [activeTable, fetchRows],
  );

  const currentMeta = tablesMeta.find((t) => t.name === activeTable);

  return (
    <div className="page">
      {loading && <p className="page-hint">Loading...</p>}
      {error && <p className="page-error">{error}</p>}
      {!loading && !error && tablesMeta.length === 0 && (
        <p className="page-hint">No tables found in the database.</p>
      )}
      {!loading && !error && tablesMeta.length > 0 && (
        <div className="tables-layout">
          <aside className="tables-sidebar">
            {tablesMeta.map((t) => (
              <button
                key={t.name}
                className={`tables-sidebar-item${t.name === activeTable ? ' active' : ''}`}
                onClick={() => setActiveTable(t.name)}
              >
                <span className="tables-sidebar-name">{t.name}</span>
                <span className="tables-sidebar-count">{t.count}</span>
              </button>
            ))}
          </aside>
          <section className="tables-content">
            {currentMeta && (
              <>
                <div className="table-header">
                  <h2 className="table-section-title">
                    {currentMeta.name}{' '}
                    <span className="table-row-count">
                      ({isSearching ? `${filteredRows.length} / ${currentMeta.count}` : currentMeta.count})
                    </span>
                  </h2>
                  <input
                    className="table-search"
                    type="text"
                    placeholder="Search... (Enter)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setCommittedSearch(search);
                      }
                    }}
                  />
                </div>
                <div className="tables-content-inner">
                  {currentMeta.count === 0 ? (
                    <p className="page-hint">Нет данных</p>
                  ) : rowsLoading ? (
                    <p className="page-hint">Loading...</p>
                  ) : (
                    <DataTable
                      key={currentMeta.name}
                      meta={currentMeta}
                      rows={displayRows}
                    />
                  )}
                </div>
                {isSearching && filteredRows.length > PAGE_SIZE && (
                  <div className="table-pagination">
                    <button disabled={searchPage === 0} onClick={() => setSearchPage(searchPage - 1)}>
                      ←
                    </button>
                    <span className="table-pagination-info">
                      {searchPage + 1} / {Math.ceil(filteredRows.length / PAGE_SIZE)}
                    </span>
                    <button
                      disabled={searchPage >= Math.ceil(filteredRows.length / PAGE_SIZE) - 1}
                      onClick={() => setSearchPage(searchPage + 1)}
                    >
                      →
                    </button>
                  </div>
                )}
                {!isSearching && currentMeta.count > PAGE_SIZE && (
                  <div className="table-pagination">
                    <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}>
                      ←
                    </button>
                    <span className="table-pagination-info">
                      {page + 1} / {Math.ceil(currentMeta.count / PAGE_SIZE)}
                    </span>
                    <button
                      disabled={page >= Math.ceil(currentMeta.count / PAGE_SIZE) - 1}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default TablesPage;
