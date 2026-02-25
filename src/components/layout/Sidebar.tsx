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
  X,
  Network,
  Box,
  Tags,
  Briefcase,
  Wallet,
  Users,
  Store,
  Package,
  Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentUserInfo, getCurrentSpaceInfo, UserInfo, SpaceInfo } from '../../lib/auth-helper';
import { getPendingInvitationsForUser } from '../../lib/shared/space-invitations';
import InvitationsPanel from '../InvitationsPanel';

import './Sidebar.css';

interface SidebarProps {
  user?: any;
}

// 与移动端 index + AI Inventory + Management 一一对应
const mainMenuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/expenditure', icon: Receipt, label: 'Expenses' },
  { path: '/income', icon: ArrowUpCircle, label: 'Income' },
  { path: '/inbound', icon: PackageSearch, label: 'Inbound' },
  { path: '/outbound', icon: PackageCheck, label: 'Outbound' },
  { path: '/ai-inventory', icon: Box, label: 'AI Inventory' },
  { path: '/management', icon: Settings, label: 'Management' },
  { path: '/project-map', icon: Network, label: 'Project Map' },
];

// Management 子项（与移动端 management 页 menuItems 一致）
const managementSubItems = [
  { path: '/space-members', icon: Users, label: 'Members' },
  { path: '/categories-manage', icon: Tags, label: 'Categories' },
  { path: '/purposes-manage', icon: Briefcase, label: 'Purposes' },
  { path: '/accounts-manage', icon: Wallet, label: 'Accounts' },
  { path: '/suppliers-manage', icon: Store, label: 'Suppliers' },
  { path: '/customers-manage', icon: Users, label: 'Customers' },
  { path: '/warehouse-manage', icon: Package, label: 'Warehouse' },
  { path: '/skus-manage', icon: Box, label: 'SKU' },
];

const Sidebar = ({ user }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [showInvitations, setShowInvitations] = useState(false);

  useEffect(() => {
    loadUserAndSpace();
  }, []);

  useEffect(() => {
    loadUserAndSpace();
  }, [location.pathname]);

  useEffect(() => {
    const onSpaceChanged = () => loadUserAndSpace();
    window.addEventListener('space-changed', onSpaceChanged);
    return () => window.removeEventListener('space-changed', onSpaceChanged);
  }, []);

  const fetchPendingInviteCount = async () => {
    try {
      const list = await getPendingInvitationsForUser();
      setPendingInviteCount(list.length);
    } catch {
      setPendingInviteCount(0);
    }
  };

  useEffect(() => {
    fetchPendingInviteCount();
  }, [userInfo?.id]);

  useEffect(() => {
    const userEmail = userInfo?.email?.toLowerCase();
    if (!userEmail) return;
    const channel = supabase
      .channel('sidebar-invitations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'space_invitations',
          filter: `invitee_email=eq.${userEmail}`,
        },
        () => {
          fetchPendingInviteCount();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userInfo?.email]);

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

  const handleUserClick = () => navigate('/profile');
  const handleSpaceClick = () => navigate('/space-manage');

  const isManagementActive = managementSubItems.some(
    (item) => location.pathname === item.path
  );
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/project-map') return location.pathname.startsWith('/project-map');
    return location.pathname === path;
  };

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

        {!collapsed && userInfo && (
          <div className="sidebar-user-row">
            <div className="sidebar-user-info-inline" onClick={handleUserClick}>
              <div className="info-avatar user-avatar">
                {userInfo.name ? (
                  <span className="info-avatar-text">{userInfo.name.charAt(0).toUpperCase()}</span>
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
            </div>
            <button
              type="button"
              className="sidebar-invite-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowInvitations(true);
              }}
              title="Invitations"
              aria-label="Invitations"
            >
              <Bell size={18} />
              {pendingInviteCount > 0 && (
                <span className="sidebar-invite-badge">
                  {pendingInviteCount > 99 ? '99+' : pendingInviteCount}
                </span>
              )}
            </button>
          </div>
        )}

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
        {mainMenuItems
          .filter((item) => item.path !== '/management')
          .map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}

        {/* Management 可展开子菜单 */}
        {!collapsed ? (
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item nav-item-expandable ${isManagementActive || location.pathname === '/management' ? 'active' : ''}`}
              onClick={() => setManagementOpen(!managementOpen)}
            >
              <Settings size={20} />
              <span>Management</span>
              <span className={`expand-chevron ${managementOpen ? 'open' : ''}`}>▼</span>
            </button>
            {managementOpen && (
              <div className="nav-sub">
                {managementSubItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item nav-sub-item ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/management"
            className={`nav-item ${location.pathname === '/management' ? 'active' : ''}`}
            title="Management"
          >
            <Settings size={20} />
          </Link>
        )}
      </nav>

      <div className="sidebar-bottom-section" aria-hidden="true" />

      <InvitationsPanel
        open={showInvitations}
        onClose={() => setShowInvitations(false)}
        onAccepted={() => fetchPendingInviteCount()}
      />
    </div>
  );
};

export default Sidebar;
