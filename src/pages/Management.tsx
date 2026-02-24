/**
 * Management - 与移动端 app/management.tsx 一一对应
 * 个人/空间信息 + 入口：Members, Categories, Purposes, Accounts
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Tags, Briefcase, Wallet, Settings, LogOut, ArrowRightLeft } from 'lucide-react';
import { getCurrentUserInfo, getCurrentSpaceInfo } from '../lib/auth-helper';
import { supabase } from '../lib/supabase';
import './Management.css';

const menuItems = [
  { id: 'members', title: 'Members', icon: Users, route: '/space-members', description: 'Manage members & invitations' },
  { id: 'categories', title: 'Categories', icon: Tags, route: '/categories-manage', description: 'Manage expense categories' },
  { id: 'purposes', title: 'Purposes', icon: Briefcase, route: '/purposes-manage', description: 'Manage procurement purpose' },
  { id: 'accounts', title: 'Accounts', icon: Wallet, route: '/accounts-manage', description: 'Manage and merge accounts' },
];

export default function Management() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [space, setSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [u, s] = await Promise.all([getCurrentUserInfo(), getCurrentSpaceInfo()]);
        setUser(u);
        setSpace(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-common management-page">
      <div className="management-section">
        <h2 className="management-section-tag">Personal Information</h2>
        <div className="management-card">
          {loading && !user ? (
            <div className="management-loading">Loading...</div>
          ) : (
            <div className="management-card-content">
              <span className="management-name">{user?.name || user?.email || 'N/A'}</span>
              {user?.email && <span className="management-meta">{user.email}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="management-section">
        <h2 className="management-section-tag">Space Information</h2>
        <div className="management-card">
          {loading && !space ? (
            <div className="management-loading">Loading...</div>
          ) : (
            <div className="management-card-content">
              <span className="management-name">{space?.name || 'N/A'}</span>
              {space?.address && <span className="management-meta">{space.address}</span>}
            </div>
          )}
        </div>
        <button type="button" className="management-link-btn" onClick={() => navigate('/space-manage')}>
          <Settings size={18} /> Edit Space
        </button>
      </div>

      <div className="management-section">
        <h2 className="management-section-tag">Settings</h2>
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="management-menu-item"
            onClick={() => navigate(item.route)}
          >
            <item.icon size={24} className="management-menu-icon" />
            <div className="management-menu-text">
              <span className="management-menu-title">{item.title}</span>
              <span className="management-menu-desc">{item.description}</span>
            </div>
            <span className="management-menu-arrow">›</span>
          </button>
        ))}
      </div>

      <div className="management-bottom">
        <button type="button" className="management-btn management-btn-switch" onClick={() => navigate('/space-manage')}>
          <ArrowRightLeft size={20} /> Switch Space
        </button>
        <button type="button" className="management-btn management-btn-signout" onClick={handleSignOut}>
          <LogOut size={20} /> Sign Out
        </button>
      </div>
    </div>
  );
}
