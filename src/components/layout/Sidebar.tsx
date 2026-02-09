import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  ArrowUpCircle,
  PackageSearch,
  PackageCheck,
  LogOut
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();

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
      <div className="sidebar-logo">
        <div className="logo-icon">V</div>
        <span>Vouchap</span>
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
