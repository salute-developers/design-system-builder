import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { components } from '../api/types.gen';
import './Page.css';
import './SettingsPage.css';

type User = components['schemas']['User'];
type DesignSystem = components['schemas']['DesignSystem'];
type Comp = components['schemas']['Component'];
type Variation = components['schemas']['Variation'];
type Property = components['schemas']['Property'];
type ComponentDep = components['schemas']['ComponentDep'];
type PropertyVariation = components['schemas']['PropertyVariation'];
type DesignSystemUser = components['schemas']['DesignSystemUser'];

type DesignSystemComponent = components['schemas']['DesignSystemComponent'];

type Section = 'users' | 'design-systems' | 'components';
type ComponentTab = 'properties' | 'deps' | 'variations' | 'prop-variations' | 'design-systems';

// ─── Helpers ────────────────────────────────────────────────────────────────

function useToggle(initial = false): [boolean, () => void] {
  const [v, set] = useState(initial);
  return [v, () => set((x) => !x)];
}

function ErrMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="adm-error">{msg}</p>;
}

// ─── Users Section ───────────────────────────────────────────────────────────

function UsersSection({ designSystems }: { designSystems: DesignSystem[] }) {
  const [users, setUsers] = useState<User[]>([]);
  const [dsUsers, setDsUsers] = useState<DesignSystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add form
  const [login, setLogin] = useState('');
  const [token, setToken] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Assign DS form
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDsId, setAssignDsId] = useState('');
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ur, dsu] = await Promise.all([
      api.GET('/users'),
      api.GET('/design-system-users'),
    ]);
    if (ur.data) setUsers(ur.data);
    if (dsu.data) setDsUsers(dsu.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/users', { body: { login, token } });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setLogin(''); setToken('');
    load();
  }

  async function deleteUser(id: string) {
    await api.DELETE('/users/{id}', { params: { path: { id } } });
    load();
  }

  async function assignDs(e: React.FormEvent) {
    e.preventDefault();
    setAssignErr(null);
    setAssigning(true);
    const { error } = await api.POST('/design-system-users', {
      body: { userId: assignUserId, designSystemId: assignDsId },
    });
    setAssigning(false);
    if (error) { setAssignErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setAssignUserId(''); setAssignDsId('');
    load();
  }

  async function removeAssignment(id: string) {
    await api.DELETE('/design-system-users/{id}', { params: { path: { id } } });
    load();
  }

  if (loading) return <p className="page-hint">Loading...</p>;

  const dsMap = Object.fromEntries(designSystems.map((d) => [d.id, d.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.login]));

  return (
    <div className="adm-section">
      <h2 className="adm-section-title">Users</h2>

      {/* Add user */}
      <div className="adm-card">
        <h3 className="adm-card-title">Add user</h3>
        <form className="adm-form" onSubmit={addUser}>
          <div className="adm-form-row">
            <input className="adm-input" placeholder="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <input className="adm-input" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} required />
            <button className="adm-btn adm-btn--primary" disabled={adding}>{adding ? 'Adding…' : 'Add'}</button>
          </div>
          <ErrMsg msg={addErr} />
        </form>
      </div>

      {/* User list */}
      <div className="adm-card">
        <h3 className="adm-card-title">All users ({users.length})</h3>
        {err && <ErrMsg msg={err} />}
        {users.length === 0 ? (
          <p className="page-hint">No users</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Login</th><th>Token</th><th>Design Systems</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => {
                const userDsLinks = dsUsers.filter((d) => d.userId === u.id);
                return (
                  <tr key={u.id}>
                    <td className="adm-mono">{u.login}</td>
                    <td className="adm-mono adm-muted">{u.token}</td>
                    <td>
                      <div className="adm-tags">
                        {userDsLinks.map((link) => (
                          <span key={link.id} className="adm-tag">
                            {dsMap[link.designSystemId] ?? link.designSystemId}
                            <button className="adm-tag-remove" onClick={() => removeAssignment(link.id)} title="Remove">×</button>
                          </span>
                        ))}
                        {userDsLinks.length === 0 && <span className="adm-muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteUser(u.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign DS */}
      <div className="adm-card">
        <h3 className="adm-card-title">Assign user to design system</h3>
        <form className="adm-form" onSubmit={assignDs}>
          <div className="adm-form-row">
            <select className="adm-select" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required>
              <option value="">Select user…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.login}</option>)}
            </select>
            <select className="adm-select" value={assignDsId} onChange={(e) => setAssignDsId(e.target.value)} required>
              <option value="">Select design system…</option>
              {designSystems.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button className="adm-btn adm-btn--primary" disabled={assigning}>{assigning ? 'Assigning…' : 'Assign'}</button>
          </div>
          <ErrMsg msg={assignErr} />
        </form>
      </div>
    </div>
  );
}

// ─── Design Systems Section ───────────────────────────────────────────────────

function DesignSystemsSection({ designSystems, reload }: { designSystems: DesignSystem[]; reload: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [dsUsers, setDsUsers] = useState<DesignSystemUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Add form
  const [name, setName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [desc, setDesc] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Rename state: dsId -> new name
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [renameErr, setRenameErr] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const [ur, dsu] = await Promise.all([
      api.GET('/users'),
      api.GET('/design-system-users'),
    ]);
    if (ur.data) setUsers(ur.data);
    if (dsu.data) setDsUsers(dsu.data);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function addDs(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/design-systems', {
      body: { name, projectName, description: desc || undefined },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setName(''); setProjectName(''); setDesc('');
    reload();
  }

  async function deleteDs(id: string) {
    await api.DELETE('/design-systems/{id}', { params: { path: { id } } });
    reload();
  }

  async function renameDs(id: string) {
    const newName = renaming[id];
    if (!newName?.trim()) return;
    setRenameErr(null);
    const { error } = await api.PATCH('/design-systems/{id}', {
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
            <thead><tr><th>Name</th><th>Project name</th><th>Description</th><th>Users</th><th></th></tr></thead>
            <tbody>
              {designSystems.map((d) => {
                const assignedUsers = dsUsers
                  .filter((du) => du.designSystemId === d.id)
                  .map((du) => users.find((u) => u.id === du.userId)?.login ?? du.userId);
                return (
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
                    <div className="adm-tags">
                      {assignedUsers.length > 0
                        ? assignedUsers.map((login, i) => <span key={i} className="adm-tag">{login}</span>)
                        : <span className="adm-muted">—</span>}
                    </div>
                  </td>
                  <td>
                    <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteDs(d.id)}>Delete</button>
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
    api.DELETE('/property-platform-params/{id}', { params: { path: { id: r.id } } }),
  ));

  // Create new params
  for (const platform of PLATFORMS) {
    const names = parsePlatformAliases(platforms[platform]);
    for (const name of names) {
      await api.POST('/property-platform-params', {
        body: { propertyId, platform, name },
      });
    }
  }
}

function PropertiesTab({ componentId }: { componentId: string }) {
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

  const load = useCallback(async () => {
    const [propsRes, pppRes] = await Promise.all([
      api.GET('/components/{id}/properties', { params: { path: { id: componentId } } }),
      api.GET('/property-platform-params', {}),
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
    const { data, error } = await api.POST('/properties', {
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
    const { error } = await api.PATCH('/properties/{id}', {
      params: { path: { id } },
      body: {
        name: s.name,
        type: s.type,
        defaultValue: s.defaultValue || undefined,
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
      api.DELETE('/property-platform-params/{id}', { params: { path: { id: r.id } } }),
    ));
    await api.DELETE('/properties/{id}', { params: { path: { id } } });
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
        <h3 className="adm-card-title">Add property</h3>
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
                    <td className="adm-muted">{p.defaultValue ?? '—'}</td>
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
    const { data } = await api.GET('/components/{id}/deps', { params: { path: { id: componentId } } });
    if (data) { setAsParent(data.asParent); setAsChild(data.asChild); }
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addDep(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/component-deps', {
      body: { parentId: componentId, childId, type: depType },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setChildId('');
    load();
  }

  async function deleteDep(id: string) {
    await api.DELETE('/component-deps/{id}', { params: { path: { id } } });
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

  const load = useCallback(async () => {
    const { data } = await api.GET('/components/{id}/variations', { params: { path: { id: componentId } } });
    if (data) setVariations(data);
    setLoading(false);
  }, [componentId]);

  useEffect(() => { load(); }, [load]);

  async function addVar(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { error } = await api.POST('/variations', {
      body: { componentId, name: vName, description: vDesc || undefined },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setVName(''); setVDesc('');
    load();
  }

  async function deleteVar(id: string) {
    await api.DELETE('/variations/{id}', { params: { path: { id } } });
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
        {variations.length === 0 ? (
          <p className="page-hint">No variations</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {variations.map((v) => (
                <tr key={v.id}>
                  <td className="adm-mono">{v.name}</td>
                  <td className="adm-muted">{v.description ?? '—'}</td>
                  <td><button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => deleteVar(v.id)}>Delete</button></td>
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
      api.GET('/property-variations'),
      api.GET('/components/{id}/properties', { params: { path: { id: componentId } } }),
      api.GET('/components/{id}/variations', { params: { path: { id: componentId } } }),
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
    const { error } = await api.POST('/property-variations', {
      body: { propertyId: pvPropId, variationId: pvVarId },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setPvPropId(''); setPvVarId('');
    load();
  }

  async function deletePv(id: string) {
    await api.DELETE('/property-variations/{id}', { params: { path: { id } } });
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

  // available props for add form (not yet linked to selected variation)
  const alreadyInVar = pvVarId ? (linkedPropIdsByVar[pvVarId] ?? new Set()) : new Set<string>();
  const availableProps = props.filter((p) => !alreadyInVar.has(p.id));

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
      api.GET('/design-systems'),
      api.GET('/design-system-components'),
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
    const { error } = await api.POST('/design-system-components', {
      body: { designSystemId: addDsId, componentId },
    });
    setAdding(false);
    if (error) { setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }
    setAddDsId('');
    load();
  }

  async function removeFromDs(dscId: string) {
    await api.DELETE('/design-system-components/{id}', { params: { path: { id: dscId } } });
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
        {tab === 'properties' && <PropertiesTab key={component.id} componentId={component.id} />}
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
    const { data } = await api.GET('/components');
    if (data) setComponents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addComp(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAdding(true);
    const { data, error } = await api.POST('/components', {
      body: { name: cName, description: cDesc || undefined },
    });
    if (error) { setAdding(false); setAddErr(typeof error === 'string' ? error : JSON.stringify(error)); return; }

    // Auto-add to all design systems
    if (data) {
      const dsRes = await api.GET('/design-systems');
      if (dsRes.data) {
        await Promise.all(
          dsRes.data.map((ds) =>
            api.POST('/design-system-components', {
              body: { designSystemId: ds.id, componentId: data.id },
            }),
          ),
        );
      }
    }

    setAdding(false);
    setCName(''); setCDesc('');
    load();
  }

  async function deleteComp(id: string) {
    await api.DELETE('/components/{id}', { params: { path: { id } } });
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
    const { data } = await api.GET('/design-systems');
    if (data) setDesignSystems(data);
  }, []);

  useEffect(() => { loadDesignSystems(); }, [loadDesignSystems]);

  const navItems: { id: Section; label: string }[] = [
    { id: 'design-systems', label: 'Design Systems' },
    { id: 'users', label: 'Users' },
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
          {section === 'users' && <UsersSection designSystems={designSystems} />}
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
