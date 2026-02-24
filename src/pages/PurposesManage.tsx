/**
 * Manage Purposes - 与移动端 app/purposes-manage.tsx 一一对应，复用 shared lib
 */
import { useState, useEffect } from 'react';
import { getPurposes, createPurpose, updatePurpose, deletePurpose } from '../lib/shared/index';
import './ManageList.css';

const COLOR_OPTIONS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F1948A', '#85C1E2', '#82E0AA'];

export default function PurposesManage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#95A5A6');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#95A5A6');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPurposes();
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const item = await createPurpose(newName.trim(), newColor);
      setList((prev) => [...prev, item]);
      setNewName('');
      setNewColor('#95A5A6');
      setShowAdd(false);
    } catch (e: any) {
      alert(e.message || 'Failed to create');
    }
  };

  const handleSave = async (id: string) => {
    try {
      await updatePurpose(id, { name: editName.trim(), color: editColor });
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, name: editName.trim(), color: editColor } : x)));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this purpose?')) return;
    try {
      await deletePurpose(id);
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-common manage-list-page">
      <div className="manage-list-header">
        <h1>Manage Purposes</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add</button>
      </div>
      {showAdd && (
        <div className="manage-list-form card">
          <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="manage-list-input" />
          <div className="manage-list-colors">
            {COLOR_OPTIONS.map((c) => (
              <button key={c} type="button" className="manage-list-color-dot" style={{ background: c }} onClick={() => setNewColor(c)} />
            ))}
          </div>
          <div className="manage-list-form-actions">
            <button type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleAdd}>Create</button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="manage-list-loading">Loading...</p>
      ) : (
        <ul className="manage-list-ul">
          {list.map((item) => (
            <li key={item.id} className="manage-list-li">
              {editingId === item.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="manage-list-input" />
                  <div className="manage-list-colors">
                    {COLOR_OPTIONS.map((c) => (
                      <button key={c} type="button" className="manage-list-color-dot" style={{ background: c }} onClick={() => setEditColor(c)} />
                    ))}
                  </div>
                  <button type="button" onClick={() => handleSave(item.id)}>Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="manage-list-item-name" style={{ borderLeftColor: item.color || '#95A5A6' }}>{item.name}</span>
                  <button type="button" className="manage-list-btn" onClick={() => { setEditingId(item.id); setEditName(item.name); setEditColor(item.color || '#95A5A6'); }}>Edit</button>
                  <button type="button" className="manage-list-btn danger" onClick={() => handleDelete(item.id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
