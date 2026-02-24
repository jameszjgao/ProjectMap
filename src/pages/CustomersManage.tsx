/**
 * Manage Customers - 与移动端 app/customers-manage.tsx 一一对应，复用 shared lib
 */
import { useState, useEffect } from 'react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../lib/shared/index';
import './ManageList.css';

export default function CustomersManage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
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
      const item = await createCustomer(newName.trim(), false);
      setList((prev) => [...prev, item]);
      setNewName('');
      setShowAdd(false);
    } catch (e: any) {
      alert(e.message || 'Failed to create');
    }
  };

  const handleSave = async (id: string) => {
    try {
      await updateCustomer(id, { name: editName.trim() });
      setList((prev) => prev.map((x) => (x.id === id ? { ...x, name: editName.trim() } : x)));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await deleteCustomer(id);
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  return (
    <div className="page-common manage-list-page">
      <div className="manage-list-header">
        <h1>Customers</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add</button>
      </div>
      {showAdd && (
        <div className="manage-list-form card">
          <input placeholder="Customer name" value={newName} onChange={(e) => setNewName(e.target.value)} className="manage-list-input" />
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
                  <button type="button" onClick={() => handleSave(item.id)}>Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="manage-list-item-name">{item.name}</span>
                  <button type="button" className="manage-list-btn" onClick={() => { setEditingId(item.id); setEditName(item.name); }}>Edit</button>
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
