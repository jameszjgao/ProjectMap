import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  ArrowUpCircle,
  PackageSearch,
  PackageCheck,
  LogOut,
  User,
  Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

import './Sidebar.css';

interface SidebarProps {
  user?: any;
}

const Sidebar = ({ user }: SidebarProps) => {
  const location = useLocation();
  const [spaceName, setSpaceName] = useState('My Workspace');

  useEffect(() => {
    if (user?.user_metadata?.space_id) {
      // Optimistically set if possible, or fetch
      // Assuming metadata might have name, otherwise fetch
      supabase
        .from('spaces')
        .select('name')
        .eq('id', user.user_metadata.space_id)
        .single()
        .then(({ data }) => {
          if (data?.name) setSpaceName(data.name);
        });
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'BI Dashboard' },
    { path: '/expenditure', icon: Receipt, label: 'Expenditure' },
    { path: '/income', icon: ArrowUpCircle, label: 'Income' },
    { path: '/inbound', icon: PackageSearch, label: 'Inbound' },
    { path: '/outbound', icon: PackageCheck, label: 'Outbound' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-logo">
          <div className="logo-icon">V</div>
          <span>Vouchap</span>
        </div>

        {user && (
          <div className="sidebar-user-info">
            <div className="user-item">
              <User size={14} className="user-icon" />
              <span className="user-text" title={user.email}>{user.email}</span>
            </div>
            <div className="user-item">
              <Building2 size={14} className="user-icon" />
              <span className="user-text">{spaceName}</span>
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
