import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { components } from '../api/types.gen';
import { fetchTokenNames, toImportedProperties } from '../utils/importProps';
import './Page.css';
import './SettingsPage.css';

type DesignSystem = components['schemas']['DesignSystem'];
type Comp = components['schemas']['Component'];
type Variation = components['schemas']['Variation'];
type Property = components['schemas']['Property'];
type ComponentDep = components['schemas']['ComponentDep'];
type PropertyVariation = components['schemas']['PropertyVariation'];

type DesignSystemComponent = components['schemas']['DesignSystemComponent'];

type Section = 'design-systems' | 'components';
type ComponentTab = 'properties' | 'deps' | 'variations' | 'prop-variations' | 'design-systems';

// ─── Helpers ────────────────────────────────────────────────────────────────

function ErrMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="adm-error">{msg}</p>;
}

// ─── Design Systems Section ───────────────────────────────────────────────────

function DesignSystemsSection({ designSystems, reload }: { designSystems: DesignSystem[]; reload: () => void }) {
  const [err, setErr] = useState<string | null>(null);

  // Add form
  const [name, setName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [desc, setDesc] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Rename state: dsId -> new name
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [renameErr, setRenameErr] = useState<string | null>(null);

  async function addDs(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/ds/design-systems', {
      body: { name, projectName, description: desc || undefined },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setName(''); setProjectName(''); setDesc('');
    reload();
  }

  async function deleteDs(id: string) {
    await api.DELETE('/ds/design-systems/{id}', { params: { path: { id } } });
    reload();
  }

  async function renameDs(id: string) {
    const newName = renaming[id];
    if (!newName?.trim()) return;
    setRenameErr(null);
    const { error } = await api.PATCH('/ds/design-systems/{id}', {
      params: { path: { id } },
      body: { name: newName.trim() },
    });
    if (error) { setRenameErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setRenaming((r) => { const c = { ...r }; delete c[id]; return c; });
    reload();
  }

  return (
    <div className="adm-section">
      <h2 className="adm-section-title">Design Systems</h2>

      {/* Add DS */}
      <div className="adm-card">
        <h3 className="adm-card-title">Add design system</h3>
        <form className="adm-form" onSubmit={addDs}>
          <div className="adm-form-row">
            <input className="adm-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="adm-input" placeholder="Project name (e.g. sdds)" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
            <input className="adm-input" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      {/* DS list */}
      <div className="adm-card">
        <h3 className="adm-card-title">All design systems ({designSystems.length})</h3>
        <ErrMsg msg={err} />
        <ErrMsg msg={renameErr} />
        {designSystems.length === 0 ? (
          <p className="page-hint">No design systems</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Project name</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {designSystems.map((d) => (
                <tr key={d.id}>
                  <td>
                    {renaming[d.id] !== undefined ? (
                      <div className="adm-inline-edit">
                        <input
                          className="adm-input adm-input--sm"
                          value={renaming[d.id]}
                          onChange={(e) => setRenaming((r) => ({ ...r, [d.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameDs(d.id);
                            if (e.key === 'Escape') setRenaming((r) => { const c = { ...r }; delete c[d.id]; return c; });
                          }}
                          autoFocus
                        />
                        <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => renameDs(d.id)}>Save</button>
                        <button className="adm-btn adm-btn--sm" onClick={() => setRenaming((r) => { const c = { ...r }; delete c[d.id]; return c; })}>Cancel</button>
                      </div>
                    ) : (
                      <span
                        className="adm-editable"
                        title="Click to rename"
                        onClick={() => setRenaming((r) => ({ ...r, [d.id]: d.name }))}
                      >{d.name}</span>
                    )}
                  </td>
                  <td className="adm-mono">{d.projectName}</td>
                  <td className="adm-muted">{d.description ?? '—'}</td>
                  <td>
                    <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteDs(d.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Properties Tab ───────────────────────────────────────────────────────────

const PROP_TYPES = ['color', 'typography', 'shape', 'shadow', 'dimension', 'float'] as const;
type PlatformKey = 'xml' | 'compose' | 'ios' | 'web';
const PLATFORMS: PlatformKey[] = ['xml', 'compose', 'ios', 'web'];

interface PlatformParamRow { id: string; propertyId: string; platform: string; name: string }

function parsePlatformAliases(val: string): string[] {
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}
function formatPlatformAliases(arr: string[]): string {
  return arr.join(', ');
}

function groupPlatformParams(rows: PlatformParamRow[], propertyId: string): Record<PlatformKey, string[]> {
  const result: Record<PlatformKey, string[]> = { xml: [], compose: [], ios: [], web: [] };
  for (const r of rows) {
    if (r.propertyId === propertyId && (result as any)[r.platform]) {
      (result as any)[r.platform].push(r.name);
    }
  }
  return result;
}

function PlatformParamsDisplay({ pppRows, propertyId }: { pppRows: PlatformParamRow[]; propertyId: string }) {
  const grouped = groupPlatformParams(pppRows, propertyId);
  const entries = PLATFORMS.flatMap((p) => {
    const arr = grouped[p];
    if (arr.length === 0) return [];
    return [<span key={p} className="adm-platform-entry"><span className="adm-platform-key">{p}</span>{arr.join(', ')}</span>];
  });
  return entries.length > 0 ? <div className="adm-platform-list">{entries}</div> : <span className="adm-muted">—</span>;
}

interface PropEditState {
  name: string;
  type: typeof PROP_TYPES[number];
  defaultValue: string;
  platforms: Record<PlatformKey, string>;
}

async function syncPlatformParams(
  propertyId: string,
  platforms: Record<PlatformKey, string>,
  existingRows: PlatformParamRow[],
) {
  const existing = existingRows.filter((r) => r.propertyId === propertyId);

  // Delete all existing params for this property
  await Promise.all(existing.map((r) =>
    api.DELETE('/ds/property-platform-params/{id}', { params: { path: { id: r.id } } }),
  ));

  // Create new params
  for (const platform of PLATFORMS) {
    const names = parsePlatformAliases(platforms[platform]);
    for (const name of names) {
      await api.POST('/ds/property-platform-params', {
        body: { propertyId, platform, name },
      });
    }
  }
}

function PropertiesTab({ componentId, componentName }: { componentId: string; componentName: string }) {
  const [props, setProps] = useState<Property[]>([]);
  const [pppRows, setPppRows] = useState<PlatformParamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, PropEditState>>({});
  const [editErr, setEditErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // add form
  const [pName, setPName] = useState('');
  const [pType, setPType] = useState<typeof PROP_TYPES[number]>('color');
  const [pDefault, setPDefault] = useState('');
  const [pPlatforms, setPPlatforms] = useState<Record<PlatformKey, string>>({ xml: '', compose: '', ios: '', web: '' });
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // import from plasma tokens.ts
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [propsRes, pppRes] = await Promise.all([
      api.GET('/ds/components/{id}/properties', { params: { path: { id: componentId } } }),
      api.GET('/ds/property-platform-params', {}),
    ]);
    if (propsRes.data) setProps(propsRes.data);
    if (pppRes.data) setPppRows(pppRes.data as PlatformParamRow[]);
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addProp(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { data, error } = await api.POST('/ds/properties', {
      body: {
        componentId,
        name: pName,
        type: pType,
        defaultValue: pDefault || undefined,
      },
    });
    if (error) { setAdding(false); setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    if (data) {
      await syncPlatformParams(data.id, pPlatforms, []);
    }
    setAdding(false);
    setPName(''); setPDefault('');
    setPPlatforms({ xml: '', compose: '', ios: '', web: '' });
    load();
  }

  async function importFromTokens() {
    setImportErr(null);
    setImportMsg(null);
    setImporting(true);

    try {
      const tokenNames = await fetchTokenNames(componentName);
      const imported = toImportedProperties(tokenNames);

      const existingNames = new Set(props.map((p) => p.name));
      const toCreate = imported.filter((p) => !existingNames.has(p.name));

      let created = 0;

      for (const prop of toCreate) {
        const { data, error } = await api.POST('/ds/properties', {
          body: { componentId, name: prop.name, type: prop.type },
        });

        if (error || !data) {
          continue;
        }

        // web-параметры: имена токенов «как есть»
        for (const tokenName of prop.webTokens) {
          await api.POST('/ds/property-platform-params', {
            body: { propertyId: data.id, platform: 'web', name: tokenName },
          });
        }

        created++;
      }

      const skipped = imported.length - toCreate.length;
      setImportMsg(
        `Импортировано: ${created}${skipped ? `, пропущено (уже есть): ${skipped}` : ''}`,
      );
      load();
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  function startEdit(p: Property) {
    const grouped = groupPlatformParams(pppRows, p.id);
    setEditing((prev) => ({
      ...prev,
      [p.id]: {
        name: p.name,
        type: p.type,
        defaultValue: p.defaultValue ?? '',
        platforms: {
          xml: formatPlatformAliases(grouped.xml),
          compose: formatPlatformAliases(grouped.compose),
          ios: formatPlatformAliases(grouped.ios),
          web: formatPlatformAliases(grouped.web),
        },
      },
    }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setEditErr((prev) => { const c = { ...prev }; delete c[id]; return c; });
  }

  async function saveProp(id: string) {
    const s = editing[id];
    if (!s) return;
    setEditErr((prev) => { const c = { ...prev }; delete c[id]; return c; });
    setSaving((prev) => ({ ...prev, [id]: true }));
    const { error } = await api.PATCH('/ds/properties/{id}', {
      params: { path: { id } },
      body: {
        name: s.name,
        type: s.type,
        // Пустую строку отправляем явно, чтобы значение очистилось (undefined Drizzle проигнорирует).
        defaultValue: s.defaultValue.trim(),
      },
    });
    if (error) {
      setSaving((prev) => { const c = { ...prev }; delete c[id]; return c; });
      setEditErr((prev) => ({ ...prev, [id]: typeof error === 'string' ? error : JSON.stringify(error) }));
      return;
    }
    await syncPlatformParams(id, s.platforms, pppRows);
    setSaving((prev) => { const c = { ...prev }; delete c[id]; return c; });
    cancelEdit(id);
    load();
  }

  async function deleteProp(id: string) {
    // Delete platform params first (FK constraint)
    const toDelete = pppRows.filter((r) => r.propertyId === id);
    await Promise.all(toDelete.map((r) =>
      api.DELETE('/ds/property-platform-params/{id}', { params: { path: { id: r.id } } }),
    ));
    await api.DELETE('/ds/properties/{id}', { params: { path: { id } } });
    cancelEdit(id);
    load();
  }

  function updateEditField(id: string, field: keyof Omit<PropEditState, 'platforms'>, value: string) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function updateEditPlatform(id: string, platform: PlatformKey, value: string) {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], platforms: { ...prev[id].platforms, [platform]: value } },
    }));
  }

  if (loading) return <p className="page-hint">Loading…</p>;

  return (
    <div>
      <div className="adm-card">
        <div className="adm-card-title-row">
          <h3 className="adm-card-title">Add property</h3>
          <button
            type="button"
            className="adm-btn adm-btn--sm"
            onClick={importFromTokens}
            disabled={importing}
            title={`Импорт web-токенов из plasma (${componentName}.tokens.ts)`}
          >
            {importing ? 'Импорт…' : 'Импорт из plasma'}
          </button>
        </div>
        {importMsg && <p className="adm-muted" style={{ marginTop: 0 }}>{importMsg}</p>}
        <ErrMsg msg={importErr} />
        <form className="adm-form" onSubmit={addProp}>
          <div className="adm-form-row adm-form-row--wrap">
            <input className="adm-input" placeholder="Name" value={pName} onChange={(e) => setPName(e.target.value)} required />
            <select className="adm-select adm-select--shrink" value={pType} onChange={(e) => setPType(e.target.value as typeof PROP_TYPES[number])}>
              {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="adm-input" placeholder="Default value (optional)" value={pDefault} onChange={(e) => setPDefault(e.target.value)} />
          </div>
          <div className="adm-platform-grid">
            {PLATFORMS.map((p) => (
              <label key={p} className="adm-platform-field">
                <span className="adm-platform-label">{p}</span>
                <input
                  className="adm-input"
                  placeholder="alias1, alias2…"
                  value={pPlatforms[p]}
                  onChange={(e) => setPPlatforms((prev) => ({ ...prev, [p]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="adm-form-row">
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      <div className="adm-card">
        <h3 className="adm-card-title">Properties ({props.length})</h3>
        {props.length === 0 ? (
          <p className="page-hint">No properties</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Platform aliases</th><th>Default</th><th></th></tr>
            </thead>
            <tbody>
              {props.map((p) => {
                const ed = editing[p.id];
                if (ed) {
                  return (
                    <>
                      <tr key={`${p.id}-edit`} className="adm-edit-row">
                        <td>
                          <input
                            className="adm-input adm-input--sm"
                            value={ed.name}
                            onChange={(e) => updateEditField(p.id, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="adm-select adm-select--shrink"
                            value={ed.type}
                            onChange={(e) => updateEditField(p.id, 'type', e.target.value)}
                          >
                            {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td colSpan={2}>
                          <div className="adm-platform-grid adm-platform-grid--sm">
                            {PLATFORMS.map((pl) => (
                              <label key={pl} className="adm-platform-field">
                                <span className="adm-platform-label">{pl}</span>
                                <input
                                  className="adm-input"
                                  placeholder="alias1, alias2…"
                                  value={ed.platforms[pl]}
                                  onChange={(e) => updateEditPlatform(p.id, pl, e.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                          <div className="adm-platform-field" style={{ marginTop: 6 }}>
                            <span className="adm-platform-label">default</span>
                            <input
                              className="adm-input"
                              placeholder="Default value…"
                              value={ed.defaultValue}
                              onChange={(e) => updateEditField(p.id, 'defaultValue', e.target.value)}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="adm-row-actions">
                            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => saveProp(p.id)} disabled={saving[p.id]}>
                              {saving[p.id] ? 'Saving…' : 'Save'}
                            </button>
                            <button className="adm-btn adm-btn--sm" onClick={() => cancelEdit(p.id)}>Cancel</button>
                            <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteProp(p.id)}>Delete</button>
                          </div>
                          {editErr[p.id] && <p className="adm-error" style={{ marginTop: 4 }}>{editErr[p.id]}</p>}
                        </td>
                      </tr>
                    </>
                  );
                }
                return (
                  <tr key={p.id}>
                    <td className="adm-mono">{p.name}</td>
                    <td><span className="adm-badge">{p.type}</span></td>
                    <td><PlatformParamsDisplay pppRows={pppRows} propertyId={p.id} /></td>
                    <td className="adm-muted">{p.defaultValue || '—'}</td>
                    <td>
                      <div className="adm-row-actions">
                        <button className="adm-btn adm-btn--sm" onClick={() => startEdit(p)}>Edit</button>
                        <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteProp(p.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Deps Tab ─────────────────────────────────────────────────────────────────

function DepsTab({ componentId, allComponents }: { componentId: string; allComponents: Comp[] }) {
  const [asParent, setAsParent] = useState<ComponentDep[]>([]);
  const [asChild, setAsChild] = useState<ComponentDep[]>([]);
  const [loading, setLoading] = useState(true);

  const [childId, setChildId] = useState('');
  const [depType, setDepType] = useState<'reuse' | 'compose'>('reuse');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/ds/components/{id}/deps', { params: { path: { id: componentId } } });
    if (data) { setAsParent(data.asParent); setAsChild(data.asChild); }
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addDep(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/ds/component-deps', {
      body: { parentId: componentId, childId, type: depType },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setChildId('');
    load();
  }

  async function deleteDep(id: string) {
    await api.DELETE('/ds/component-deps/{id}', { params: { path: { id } } });
    load();
  }

  const compMap = Object.fromEntries(allComponents.map((c) => [c.id, c.name]));

  if (loading) return <p className="page-hint">Loading…</p>;

  function DepTable({ deps, childCol }: { deps: ComponentDep[]; childCol: boolean }) {
    if (deps.length === 0) return <p className="page-hint">None</p>;
    return (
      <table className="adm-table">
        <thead>
          <tr>
            <th>{childCol ? 'Child component' : 'Parent component'}</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deps.map((d) => (
            <tr key={d.id}>
              <td>{compMap[childCol ? d.childId : d.parentId] ?? (childCol ? d.childId : d.parentId)}</td>
              <td><span className="adm-badge">{d.type}</span></td>
              <td><button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteDep(d.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <div className="adm-card">
        <h3 className="adm-card-title">Add child dependency</h3>
        <form className="adm-form" onSubmit={addDep}>
          <div className="adm-form-row">
            <select className="adm-select" value={childId} onChange={(e) => setChildId(e.target.value)} required>
              <option value="">Select child component…</option>
              {allComponents.filter((c) => c.id !== componentId).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="adm-select" value={depType} onChange={(e) => setDepType(e.target.value as 'reuse' | 'compose')}>
              <option value="reuse">reuse</option>
              <option value="compose">compose</option>
            </select>
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      <div className="adm-card">
        <h3 className="adm-card-title">Uses ({asParent.length})</h3>
        <DepTable deps={asParent} childCol={true} />
      </div>

      <div className="adm-card">
        <h3 className="adm-card-title">Used by ({asChild.length})</h3>
        <DepTable deps={asChild} childCol={false} />
      </div>
    </div>
  );
}

// ─── Variations Tab ───────────────────────────────────────────────────────────

function VariationsTab({ componentId }: { componentId: string }) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);

  const [vName, setVName] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Inline editing state: variationId -> { name, description }
  const [editing, setEditing] = useState<Record<string, { name: string; description: string }>>({});
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.GET('/ds/components/{id}/variations', { params: { path: { id: componentId } } });
    if (data) setVariations(data);
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addVar(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/ds/variations', {
      body: { componentId, name: vName, description: vDesc || undefined },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setVName(''); setVDesc('');
    load();
  }

  async function deleteVar(id: string) {
    await api.DELETE('/ds/variations/{id}', { params: { path: { id } } });
    load();
  }

  function startEdit(v: Variation) {
    setEditing((prev) => ({ ...prev, [v.id]: { name: v.name, description: v.description ?? '' } }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => { const c = { ...prev }; delete c[id]; return c; });
  }

  async function saveEdit(id: string) {
    const edit = editing[id];
    if (!edit?.name?.trim()) return;
    setEditErr(null);
    const { error } = await api.PATCH('/ds/variations/{id}', {
      params: { path: { id } },
      body: { name: edit.name.trim(), description: edit.description.trim() || undefined },
    });
    if (error) { setEditErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    cancelEdit(id);
    load();
  }

  if (loading) return <p className="page-hint">Loading…</p>;

  return (
    <div>
      <div className="adm-card">
        <h3 className="adm-card-title">Add variation</h3>
        <form className="adm-form" onSubmit={addVar}>
          <div className="adm-form-row">
            <input className="adm-input" placeholder="Name (e.g. size, state)" value={vName} onChange={(e) => setVName(e.target.value)} required />
            <input className="adm-input" placeholder="Description (optional)" value={vDesc} onChange={(e) => setVDesc(e.target.value)} />
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      <div className="adm-card">
        <h3 className="adm-card-title">Variations ({variations.length})</h3>
        <ErrMsg msg={editErr} />
        {variations.length === 0 ? (
          <p className="page-hint">No variations</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {variations.map((v) => (
                <tr key={v.id}>
                  <td>
                    {editing[v.id] !== undefined ? (
                      <input
                        className="adm-input adm-input--sm"
                        value={editing[v.id].name}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [v.id]: { ...prev[v.id], name: e.target.value } }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(v.id);
                          if (e.key === 'Escape') cancelEdit(v.id);
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="adm-mono">{v.name}</span>
                    )}
                  </td>
                  <td>
                    {editing[v.id] !== undefined ? (
                      <input
                        className="adm-input adm-input--sm"
                        value={editing[v.id].description}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [v.id]: { ...prev[v.id], description: e.target.value } }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(v.id);
                          if (e.key === 'Escape') cancelEdit(v.id);
                        }}
                        placeholder="Description (optional)"
                      />
                    ) : (
                      <span>{v.description ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    {editing[v.id] !== undefined ? (
                      <div className="adm-inline-edit">
                        <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => saveEdit(v.id)}>Save</button>
                        <button className="adm-btn adm-btn--sm" onClick={() => cancelEdit(v.id)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="adm-inline-edit">
                        <button className="adm-btn adm-btn--sm" onClick={() => startEdit(v)}>Edit</button>
                        <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteVar(v.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Property-Variations Tab ──────────────────────────────────────────────────

function PropVariationsTab({ componentId }: { componentId: string }) {
  const [pvList, setPvList] = useState<PropertyVariation[]>([]);
  const [props, setProps] = useState<Property[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);

  const [pvPropId, setPvPropId] = useState('');
  const [pvVarId, setPvVarId] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [pvRes, prRes, varRes] = await Promise.all([
      api.GET('/ds/property-variations'),
      api.GET('/ds/components/{id}/properties', { params: { path: { id: componentId } } }),
      api.GET('/ds/components/{id}/variations', { params: { path: { id: componentId } } }),
    ]);
    if (pvRes.data) setPvList(pvRes.data);
    if (prRes.data) setProps(prRes.data);
    if (varRes.data) setVariations(varRes.data);
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addPv(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/ds/property-variations', {
      body: { propertyId: pvPropId, variationId: pvVarId },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    // Сбрасываем только проперти, вариацию запоминаем — удобно линковать несколько пропсов подряд.
    setPvPropId('');
    load();
  }

  async function deletePv(id: string) {
    await api.DELETE('/ds/property-variations/{id}', { params: { path: { id } } });
    load();
  }

  if (loading) return <p className="page-hint">Loading…</p>;

  // filter to only this component's props/variations
  const compPropIds = new Set(props.map((p) => p.id));
  const compVarIds = new Set(variations.map((v) => v.id));
  const filtered = pvList.filter((pv) => compPropIds.has(pv.propertyId) && compVarIds.has(pv.variationId));

  // linked propIds per variation
  const linkedPropIdsByVar: Record<string, Set<string>> = {};
  for (const pv of filtered) {
    if (!linkedPropIdsByVar[pv.variationId]) linkedPropIdsByVar[pv.variationId] = new Set();
    linkedPropIdsByVar[pv.variationId].add(pv.propertyId);
  }

  // props not linked to any variation
  const linkedPropIds = new Set(filtered.map((pv) => pv.propertyId));
  const unlinkedProps = props.filter((p) => !linkedPropIds.has(p.id));

  // available props for add form (not yet linked to selected variation), sorted alphabetically
  const alreadyInVar = pvVarId ? (linkedPropIdsByVar[pvVarId] ?? new Set()) : new Set<string>();
  const availableProps = props
    .filter((p) => !alreadyInVar.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="adm-card">
        <h3 className="adm-card-title">Link property to variation</h3>
        <form className="adm-form" onSubmit={addPv}>
          <div className="adm-form-row">
            <select className="adm-select" value={pvVarId} onChange={(e) => setPvVarId(e.target.value)} required>
              <option value="">Select variation…</option>
              {variations.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select className="adm-select" value={pvPropId} onChange={(e) => setPvPropId(e.target.value)} required>
              <option value="">Select property…</option>
              {availableProps.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
            </select>
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Link'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      {/* Grouped by variation */}
      {variations.map((v) => {
        const varPvs = filtered.filter((pv) => pv.variationId === v.id);
        return (
          <div key={v.id} className="adm-card">
            <h3 className="adm-card-title">
              {v.name}
              <span className="adm-card-count"> ({varPvs.length})</span>
            </h3>
            {varPvs.length === 0 ? (
              <p className="page-hint">No properties linked</p>
            ) : (
              <div className="adm-prop-var-list">
                {varPvs.map((pv) => {
                  const prop = props.find((p) => p.id === pv.propertyId);
                  return (
                    <span key={pv.id} className="adm-prop-var-item">
                      <span className="adm-mono">{prop?.name ?? pv.propertyId}</span>
                      {prop && <span className="adm-badge">{prop.type}</span>}
                      <button className="adm-tag-remove" onClick={() => deletePv(pv.id)} title="Unlink">×</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Unlinked props */}
      {props.length > 0 && (
        <div className="adm-card">
          <h3 className="adm-card-title">
            Not linked to any variation
            <span className="adm-card-count"> ({unlinkedProps.length})</span>
          </h3>
          {unlinkedProps.length === 0 ? (
            <p className="page-hint">All properties are linked</p>
          ) : (
            <div className="adm-prop-var-list">
              {unlinkedProps.map((p) => (
                <span key={p.id} className="adm-prop-var-item adm-prop-var-item--unlinked">
                  <span className="adm-mono">{p.name}</span>
                  <span className="adm-badge">{p.type}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Copy base DS values ─────────────────────────────────────────────────────

/**
 * After adding a component to a design system, copies appearances, styles,
 * invariant and variation property values from the "base" design system.
 * Tokens are mapped by name; if the target DS has no matching token the
 * reference is omitted (the plain `value` is still copied).
 */
async function copyBaseValues(targetDsId: string, componentId: string) {
  // 1. Find the base design system
  const dsRes = await api.GET('/ds/design-systems');
  const baseDs = dsRes.data?.find((ds) => ds.name === 'base');
  if (!baseDs || baseDs.id === targetDsId) return;

  // 2. Get component variations
  const varRes = await api.GET('/ds/components/{id}/variations', { params: { path: { id: componentId } } });
  const componentVariations = varRes.data ?? [];
  if (componentVariations.length === 0) return;

  // 3. Load base appearances for this component
  const baseAppRes = await api.GET('/ds/design-systems/{id}/appearances', { params: { path: { id: baseDs.id } } });
  const baseAppearances = (baseAppRes.data ?? []).filter((a) => a.componentId === componentId);
  if (baseAppearances.length === 0) return;

  // 4. Create appearances in the target DS
  const createdAppearances = await Promise.all(
    baseAppearances.map((a) =>
      api.POST('/ds/appearances', {
        body: { designSystemId: targetDsId, componentId, name: a.name ?? 'default' },
      }),
    ),
  );

  // Build appearance ID map: base → target (by name)
  const appIdMap = new Map<string, string>();
  for (let i = 0; i < baseAppearances.length; i++) {
    const created = createdAppearances[i].data;
    if (created) appIdMap.set(baseAppearances[i].id, created.id);
  }

  // 5. Load base styles for each variation, create in target DS
  const styleIdMap = new Map<string, string>();

  for (const variation of componentVariations) {
    const baseStylesRes = await api.GET(
      '/ds/styles/by-variation/{variationId}/by-design-system/{designSystemId}',
      { params: { path: { variationId: variation.id, designSystemId: baseDs.id } } },
    );
    const baseStyles = baseStylesRes.data ?? [];

    const createdStyles = await Promise.all(
      baseStyles.map((s) =>
        api.POST('/ds/styles', {
          body: {
            designSystemId: targetDsId,
            variationId: variation.id,
            name: s.name,
            description: s.description ?? undefined,
            isDefault: s.isDefault ?? false,
          },
        }),
      ),
    );

    for (let i = 0; i < baseStyles.length; i++) {
      const created = createdStyles[i].data;
      if (created) styleIdMap.set(baseStyles[i].id, created.id);
    }
  }

  // 6. Build token name map: base DS token name → target DS token ID
  const [baseTokensRes, targetTokensRes] = await Promise.all([
    api.GET('/ds/design-systems/{id}/tokens', { params: { path: { id: baseDs.id } } }),
    api.GET('/ds/design-systems/{id}/tokens', { params: { path: { id: targetDsId } } }),
  ]);
  const baseTokens = baseTokensRes.data ?? [];
  const targetTokens = targetTokensRes.data ?? [];

  const tokenIdMap = new Map<string, string>();
  for (const bt of baseTokens) {
    const tt = targetTokens.find((t) => t.name === bt.name);
    if (tt) tokenIdMap.set(bt.id, tt.id);
  }

  const mapTokenId = (id: string | null): string | undefined => {
    if (!id) return undefined;
    return tokenIdMap.get(id) ?? undefined;
  };

  // 7. Copy invariant property values
  const baseIpvRes = await api.GET(
    '/ds/invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId}',
    { params: { path: { componentId, designSystemId: baseDs.id } } },
  );
  const baseIpvs = baseIpvRes.data ?? [];

  if (baseIpvs.length > 0) {
    await Promise.all(
      baseIpvs
        .filter((ipv) => appIdMap.has(ipv.appearanceId))
        .map((ipv) =>
          api.POST('/ds/invariant-property-values', {
            body: {
              propertyId: ipv.propertyId,
              designSystemId: targetDsId,
              componentId,
              appearanceId: appIdMap.get(ipv.appearanceId)!,
              tokenId: mapTokenId(ipv.tokenId),
              value: ipv.value ?? undefined,
              // Состояния переехали в property_value_states: копируется ключ набора.
              // Сами связи не копируются — CRUD-маршрута для них нет.
              statesKey: ipv.statesKey,
            },
          }),
        ),
    );
  }

  // 8. Copy variation property values (for each base style that was copied)
  const baseStyleIds = [...styleIdMap.keys()];
  if (baseStyleIds.length > 0) {
    const vpvArrays = await Promise.all(
      baseStyleIds.map((styleId) =>
        api.GET('/ds/variation-property-values/by-style/{styleId}', {
          params: { path: { styleId } },
        }),
      ),
    );
    const allBaseVpvs = vpvArrays.flatMap((r) => r.data ?? []);

    if (allBaseVpvs.length > 0) {
      await Promise.all(
        allBaseVpvs
          .filter((vpv) => styleIdMap.has(vpv.styleId) && appIdMap.has(vpv.appearanceId))
          .map((vpv) =>
            api.POST('/ds/variation-property-values', {
              body: {
                propertyId: vpv.propertyId,
                styleId: styleIdMap.get(vpv.styleId)!,
                appearanceId: appIdMap.get(vpv.appearanceId)!,
                tokenId: mapTokenId(vpv.tokenId),
                value: vpv.value ?? undefined,
                // Состояния переехали в property_value_states: копируется ключ набора.
                // Сами связи не копируются — CRUD-маршрута для них нет.
                statesKey: vpv.statesKey,
              },
            }),
          ),
      );
    }
  }
}

// ─── Design Systems Tab ──────────────────────────────────────────────────────

function DesignSystemsTab({ componentId }: { componentId: string }) {
  const [allDs, setAllDs] = useState<DesignSystem[]>([]);
  const [dsComponents, setDsComponents] = useState<DesignSystemComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addDsId, setAddDsId] = useState('');

  const load = useCallback(async () => {
    const [dsRes, dscRes] = await Promise.all([
      api.GET('/ds/design-systems'),
      api.GET('/ds/design-system-components'),
    ]);
    if (dsRes.data) setAllDs(dsRes.data);
    if (dscRes.data) setDsComponents(dscRes.data.filter((dsc: DesignSystemComponent) => dsc.componentId === componentId));
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addToDs(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);

    const { error } = await api.POST('/ds/design-system-components', {
      body: { designSystemId: addDsId, componentId },
    });
    if (error) { setAdding(false); setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }

    // Copy appearances, styles, and property values from the base design system
    await copyBaseValues(addDsId, componentId);

    setAdding(false);
    setAddDsId('');
    load();
  }

  async function removeFromDs(dscId: string) {
    await api.DELETE('/ds/design-system-components/{id}', { params: { path: { id: dscId } } });
    load();
  }

  if (loading) return <p className="page-hint">Loading…</p>;

  const linkedDsIds = new Set(dsComponents.map((dsc) => dsc.designSystemId));
  const unlinkedDs = allDs.filter((ds) => !linkedDsIds.has(ds.id));
  const dsMap = Object.fromEntries(allDs.map((d) => [d.id, d]));

  return (
    <div>
      {/* Add to DS */}
      {unlinkedDs.length > 0 && (
        <div className="adm-card">
          <h3 className="adm-card-title">Add to design system</h3>
          <form className="adm-form" onSubmit={addToDs}>
            <div className="adm-form-row">
              <select className="adm-select" value={addDsId} onChange={(e) => setAddDsId(e.target.value)} required>
                <option value="">Select design system…</option>
                {unlinkedDs.map((ds) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
              </select>
              <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
            </div>
            <ErrMsg msg={addErr} />
          </form>
        </div>
      )}

      {/* Linked DS list */}
      <div className="adm-card">
        <h3 className="adm-card-title">Design systems ({dsComponents.length})</h3>
        {dsComponents.length === 0 ? (
          <p className="page-hint">Not added to any design system</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Project name</th><th></th></tr></thead>
            <tbody>
              {dsComponents.map((dsc) => {
                const ds = dsMap[dsc.designSystemId];
                return (
                  <tr key={dsc.id}>
                    <td>{ds?.name ?? dsc.designSystemId}</td>
                    <td className="adm-mono">{ds?.projectName ?? '—'}</td>
                    <td>
                      <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => removeFromDs(dsc.id)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Unlinked DS */}
      {unlinkedDs.length > 0 && (
        <div className="adm-card">
          <h3 className="adm-card-title">
            Not in
            <span className="adm-card-count"> ({unlinkedDs.length})</span>
          </h3>
          <div className="adm-tags">
            {unlinkedDs.map((ds) => (
              <span key={ds.id} className="adm-tag" style={{ background: '#2a2020', borderColor: '#4a2a2a', color: '#c0a0a0' }}>
                {ds.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component Detail ─────────────────────────────────────────────────────────

function ComponentDetail({ component, allComponents }: { component: Comp; allComponents: Comp[] }) {
  const [tab, setTab] = useState<ComponentTab>('properties');

  const tabs: { id: ComponentTab; label: string }[] = [
    { id: 'properties', label: 'Properties' },
    { id: 'variations', label: 'Variations' },
    { id: 'prop-variations', label: 'Prop → Variation' },
    { id: 'deps', label: 'Dependencies' },
    { id: 'design-systems', label: 'Design Systems' },
  ];

  return (
    <div className="adm-detail">
      <div className="adm-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`adm-tab${tab === t.id ? ' adm-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="adm-tab-content">
        {tab === 'properties' && <PropertiesTab key={component.id} componentId={component.id} componentName={component.name} />}
        {tab === 'deps' && <DepsTab key={component.id} componentId={component.id} allComponents={allComponents} />}
        {tab === 'variations' && <VariationsTab key={component.id} componentId={component.id} />}
        {tab === 'prop-variations' && <PropVariationsTab key={component.id} componentId={component.id} />}
        {tab === 'design-systems' && <DesignSystemsTab key={component.id} componentId={component.id} />}
      </div>
    </div>
  );
}

// ─── Components Section ───────────────────────────────────────────────────────

function ComponentsSection() {
  const [components, setComponents] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/ds/components');
    if (data) setComponents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addComp(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { data, error } = await api.POST('/ds/components', {
      body: { name: cName, description: cDesc || undefined },
    });
    if (error) { setAdding(false); setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }

    // Auto-add to all design systems and copy base values
    if (data) {
      const dsRes = await api.GET('/ds/design-systems');
      if (dsRes.data) {
        await Promise.all(
          dsRes.data.map((ds) =>
            api.POST('/ds/design-system-components', {
              body: { designSystemId: ds.id, componentId: data.id },
            }),
          ),
        );
        // Copy base DS values for each non-base DS
        for (const ds of dsRes.data) {
          if (ds.name !== 'base') {
            await copyBaseValues(ds.id, data.id);
          }
        }
      }
    }

    setAdding(false);
    setCName(''); setCDesc('');
    load();
  }

  async function deleteComp(id: string) {
    await api.DELETE('/ds/components/{id}', { params: { path: { id } } });
    if (selected === id) setSelected(null);
    load();
  }

  if (loading) return <p className="page-hint">Loading...</p>;

  const selectedComp = components.find((c) => c.id === selected);

  return (
    <div className="adm-section">
      <h2 className="adm-section-title">Components</h2>

      {/* Add component */}
      <div className="adm-card">
        <h3 className="adm-card-title">Add component</h3>
        <form className="adm-form" onSubmit={addComp}>
          <div className="adm-form-row">
            <input className="adm-input" placeholder="Name (e.g. Button)" value={cName} onChange={(e) => setCName(e.target.value)} required />
            <input className="adm-input" placeholder="Description (optional)" value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      <div className="adm-components-layout">
        {/* Component list */}
        <div className="adm-comp-list">
          <p className="adm-comp-list-hint">Components ({components.length})</p>
          {components.map((c) => (
            <div
              key={c.id}
              className={`adm-comp-item${selected === c.id ? ' adm-comp-item--active' : ''}`}
              onClick={() => setSelected(c.id)}
            >
              <span className="adm-comp-name">{c.name}</span>
              <button
                className="adm-btn adm-btn--danger adm-btn--icon"
                onClick={(e) => { e.stopPropagation(); deleteComp(c.id); }}
                title="Delete component"
              >×</button>
            </div>
          ))}
          {components.length === 0 && <p className="page-hint">No components</p>}
        </div>

        {/* Component detail */}
        <div className="adm-comp-detail">
          {selectedComp ? (
            <>
              <div className="adm-comp-detail-header">
                <span className="adm-comp-detail-name">{selectedComp.name}</span>
                {selectedComp.description && <span className="adm-muted"> — {selectedComp.description}</span>}
              </div>
              <ComponentDetail component={selectedComp} allComponents={components} />
            </>
          ) : (
            <p className="page-hint">Select a component to manage its properties, dependencies, variations and more.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

function SettingsPage() {
  const [section, setSection] = useState<Section>('design-systems');
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);

  const loadDesignSystems = useCallback(async () => {
    const { data } = await api.GET('/ds/design-systems');
    if (data) setDesignSystems(data);
  }, []);

  useEffect(() => { loadDesignSystems(); }, [loadDesignSystems]);

  const navItems: { id: Section; label: string }[] = [
    { id: 'design-systems', label: 'Design Systems' },
    { id: 'components', label: 'Components' },
  ];

  return (
    <div className="page adm-page">
      <div className="adm-layout">
        <aside className="adm-sidebar">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`adm-nav-item${section === item.id ? ' adm-nav-item--active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </aside>
        <main className="adm-main">
          {section === 'design-systems' && (
            <DesignSystemsSection designSystems={designSystems} reload={loadDesignSystems} />
          )}
          {section === 'components' && <ComponentsSection />}
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
