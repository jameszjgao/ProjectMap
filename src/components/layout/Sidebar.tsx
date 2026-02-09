import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  ArrowUpCircle,
  PackageSearch,
  PackageCheck,
  User,
  Building2,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentUserInfo, getCurrentSpaceInfo, UserInfo, SpaceInfo } from '../../lib/auth-helper';

import './Sidebar.css';

interface SidebarProps {
  user?: any;
}

const Sidebar = ({ user }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndSpace();
  }, []);

  const loadUserAndSpace = async () => {
    try {
      setLoading(true);
      const [userData, spaceData] = await Promise.all([
        getCurrentUserInfo(),
        getCurrentSpaceInfo(),
      ]);
      setUserInfo(userData);
      setSpaceInfo(spaceData);
    } catch (error) {
      console.error('Error loading user and space:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = () => {
    navigate('/profile');
  };

  const handleSpaceClick = () => {
    navigate('/space-manage');
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'BI Dashboard' },
    { path: '/expenditure', icon: Receipt, label: 'Expenditure' },
    { path: '/income', icon: ArrowUpCircle, label: 'Income' },
    { path: '/inbound', icon: PackageSearch, label: 'Inbound' },
    { path: '/outbound', icon: PackageCheck, label: 'Outbound' },
  ];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button 
        className="sidebar-toggle-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <Menu size={20} /> : <X size={20} />}
      </button>

      <div className="sidebar-top">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Vouchap Logo" className="sidebar-logo-img" />
          {!collapsed && <span className="sidebar-logo-text">Vouchap</span>}
        </div>

        {/* Space Information - Top */}
        {!collapsed && spaceInfo && (
          <div className="sidebar-space-info" onClick={handleSpaceClick}>
            <div className="info-name-row">
              <div className="info-avatar space-avatar">
                <Building2 size={14} />
              </div>
              <span className="info-name" title={spaceInfo.name}>
                {spaceInfo.name}
              </span>
              <Settings size={16} className="info-manage-icon" />
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
            title={collapsed ? item.label : ''}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-bottom-section">
        {/* User Information - Bottom */}
        {!collapsed && userInfo && (
          <div className="sidebar-user-info-bottom" onClick={handleUserClick}>
            <div className="info-name-row">
              <div className="info-avatar user-avatar">
                {userInfo.name ? (
                  <span className="info-avatar-text">
                    {userInfo.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User size={14} />
                )}
              </div>
              <div className="info-content">
                <span className="info-name" title={userInfo.email}>
                  {userInfo.name || userInfo.email}
                </span>
                {userInfo.email && userInfo.name && (
                  <span className="info-secondary" title={userInfo.email}>
                    {userInfo.email}
                  </span>
                )}
              </div>
              <Settings size={16} className="info-manage-icon" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Sidebar;
