/**
 * Space Members - 与移动端 app/space-members.tsx 一一对应，复用 shared lib
 */
import { useState, useEffect } from 'react';
import { getSpaceMembers } from '../lib/shared/index';
import './ManageList.css';

export default function SpaceMembers() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSpaceMembers();
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

  return (
    <div className="page-common manage-list-page">
      <div className="manage-list-header">
        <h1>Space Members</h1>
      </div>
      {loading ? (
        <p className="manage-list-loading">Loading...</p>
      ) : (
        <ul className="manage-list-ul">
          {list.map((m: any) => (
            <li key={m.userId} className="manage-list-li">
              <span className="manage-list-item-name">{m.name || m.email}</span>
              <span className="manage-list-meta">{m.email}</span>
              {m.isAdmin && <span className="manage-list-badge">Admin</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
