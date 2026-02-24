import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Save, X, Users, Tag, Wallet, ChevronRight, Plus, RefreshCw, ArrowLeftRight, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUserInfo, getCurrentSpaceInfo, getUserSpaces, UserInfo, SpaceInfo } from '../lib/auth-helper';
import './Profile.css';

interface UserSpace {
    id: string;
    spaceId: string;
    space?: SpaceInfo;
}

const SpaceManage = () => {
    const navigate = useNavigate();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [spaceInfo, setSpaceInfo] = useState<SpaceInfo | null>(null);
    const [userSpaces, setUserSpaces] = useState<UserSpace[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSpace, setEditingSpace] = useState(false);
    const [spaceName, setSpaceName] = useState('');
    const [spaceAddress, setSpaceAddress] = useState('');
    const [saving, setSaving] = useState(false);
    const [showSpaceSwitch, setShowSpaceSwitch] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');
    const [newSpaceAddress, setNewSpaceAddress] = useState('');
    const [creating, setCreating] = useState(false);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [userData, spaceData] = await Promise.all([
                getCurrentUserInfo(),
                getCurrentSpaceInfo(),
            ]);
            setUserInfo(userData);
            setSpaceInfo(spaceData);
            if (spaceData) {
                setSpaceName(spaceData.name);
                setSpaceAddress(spaceData.address || '');
            }
            if (userData) {
                await loadSpaces(userData.id);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSpaces = async (userId: string) => {
        try {
            const spaces = await getUserSpaces();
            setUserSpaces(spaces);
        } catch (error) {
            console.error('Error loading spaces:', error);
        }
    };

    const handleSaveSpace = async () => {
        if (!spaceInfo || !spaceName.trim()) {
            alert('Space name cannot be empty');
            return;
        }

        try {
            setSaving(true);
            const { error } = await supabase
                .from('spaces')
                .update({
                    name: spaceName.trim(),
                    address: spaceAddress.trim() || null,
                })
                .eq('id', spaceInfo.id);

            if (error) throw error;

            setEditingSpace(false);
            await loadData();
            alert('Space information updated successfully');
        } catch (error) {
            console.error('Error updating space:', error);
            alert('Failed to update space information');
        } finally {
            setSaving(false);
        }
    };

    const handleSwitchSpace = async (spaceId: string) => {
        if (!userInfo) return;

        try {
            setSwitching(true);
            const { error } = await supabase
                .from('users')
                .update({ current_space_id: spaceId })
                .eq('id', userInfo.id);

            if (error) throw error;

            setShowSpaceSwitch(false);
            await loadData();
            window.dispatchEvent(new CustomEvent('space-changed'));
            alert('Space switched successfully');
        } catch (error) {
            console.error('Error switching space:', error);
            alert('Failed to switch space');
        } finally {
            setSwitching(false);
        }
    };

    const handleCreateSpace = async () => {
        if (!newSpaceName.trim()) {
            alert('Please enter space name');
            return;
        }

        if (!userInfo) return;

        try {
            setCreating(true);
            // 创建空间
            const { data: spaceData, error: spaceError } = await supabase
                .from('spaces')
                .insert({
                    name: newSpaceName.trim(),
                    address: newSpaceAddress.trim() || null,
                })
                .select()
                .single();

            if (spaceError) throw spaceError;

            // 创建 user_spaces 关联
            const { error: assocError } = await supabase
                .from('user_spaces')
                .insert({
                    user_id: userInfo.id,
                    space_id: spaceData.id,
                    is_admin: true,
                });

            if (assocError) throw assocError;

            // 设置为当前空间
            const { error: updateError } = await supabase
                .from('users')
                .update({ current_space_id: spaceData.id })
                .eq('id', userInfo.id);

            if (updateError) throw updateError;

            setShowCreateModal(false);
            setNewSpaceName('');
            setNewSpaceAddress('');
            await loadData();
            window.dispatchEvent(new CustomEvent('space-changed'));
            alert('Space created successfully');
        } catch (error: any) {
            console.error('Error creating space:', error);
            alert(error.message || 'Failed to create space');
        } finally {
            setCreating(false);
        }
    };

    const menuItems = [
        { id: 'members', title: 'Members', icon: Users, route: '/space-members', description: 'Manage members & invitations' },
        { id: 'categories', title: 'Categories', icon: Tag, route: '/categories-manage', description: 'Manage expense categories' },
        { id: 'accounts', title: 'Accounts', icon: Wallet, route: '/accounts-manage', description: 'Manage and merge accounts' },
    ];

    const handleMenuClick = (route: string) => {
        // 暂时显示提示，具体管理页面待开发
        alert('This feature is coming soon!');
        // navigate(route); // 待开发时启用
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} /> Back
                </button>
                <h1>Space Information</h1>
            </div>

            <div className="profile-content">
                {/* Space Name */}
                <div className="profile-card">
                    <div className="profile-card-header">
                        <Building2 size={20} className="profile-card-icon" />
                        {editingSpace ? (
                            <div className="profile-edit-container">
                                <input
                                    type="text"
                                    value={spaceName}
                                    onChange={(e) => setSpaceName(e.target.value)}
                                    className="profile-input"
                                    placeholder="Enter space name"
                                    autoFocus
                                />
                                <textarea
                                    value={spaceAddress}
                                    onChange={(e) => setSpaceAddress(e.target.value)}
                                    className="profile-input profile-textarea"
                                    rows={3}
                                    placeholder="Enter space address (optional)"
                                />
                                <div className="profile-button-row">
                                    <button
                                        className="profile-btn profile-btn-cancel"
                                        onClick={() => {
                                            setEditingSpace(false);
                                            setSpaceName(spaceInfo?.name || '');
                                            setSpaceAddress(spaceInfo?.address || '');
                                        }}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="profile-btn profile-btn-save"
                                        onClick={handleSaveSpace}
                                        disabled={saving || !spaceName.trim()}
                                    >
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="profile-view-container">
                                <div className="profile-view-content">
                                    <div className="profile-name-row">
                                        <span className="profile-name">{spaceInfo?.name || 'N/A'}</span>
                                        <button
                                            className="profile-edit-icon-btn"
                                            onClick={() => setEditingSpace(true)}
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    </div>
                                    {spaceInfo?.address ? (
                                        <div className="profile-address-row">
                                            <Building2 size={14} className="profile-address-icon" />
                                            <span className="profile-address">{spaceInfo.address}</span>
                                        </div>
                                    ) : (
                                        <span className="profile-address-placeholder">No address set</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Management Menu Items */}
                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        className="profile-menu-item"
                        onClick={() => handleMenuClick(item.route)}
                    >
                        <div className="profile-menu-item-icon">
                            <item.icon size={24} />
                        </div>
                        <div className="profile-menu-item-content">
                            <div className="profile-menu-item-title">{item.title}</div>
                            <div className="profile-menu-item-description">{item.description}</div>
                        </div>
                        <ChevronRight size={20} className="profile-menu-item-chevron" />
                    </div>
                ))}
            </div>

            {/* Space Switch Modal */}
            {showSpaceSwitch && (
                <div className="profile-modal-overlay" onClick={() => setShowSpaceSwitch(false)}>
                    <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>Switch Space</h3>
                            <button className="profile-modal-close" onClick={() => setShowSpaceSwitch(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="profile-modal-body">
                            {userSpaces.map((userSpace) => (
                                <div
                                    key={userSpace.spaceId}
                                    className={`profile-space-option ${spaceInfo?.id === userSpace.spaceId ? 'active' : ''}`}
                                    onClick={() => handleSwitchSpace(userSpace.spaceId)}
                                >
                                    <Building2 size={20} />
                                    <div className="profile-space-option-content">
                                        <div className="profile-space-option-name">
                                            {userSpace.space?.name || 'Unnamed Space'}
                                        </div>
                                        {userSpace.space?.address && (
                                            <div className="profile-space-option-address">
                                                {userSpace.space.address}
                                            </div>
                                        )}
                                    </div>
                                    {spaceInfo?.id === userSpace.spaceId && (
                                        <div className="profile-space-option-check">✓</div>
                                    )}
                                </div>
                            ))}
                            {switching && (
                                <div className="profile-modal-loading">
                                    <div className="loader"></div>
                                </div>
                            )}
                        </div>
                        <div className="profile-modal-footer">
                            <button
                                className="profile-create-space-btn"
                                onClick={() => {
                                    setShowSpaceSwitch(false);
                                    setShowCreateModal(true);
                                }}
                                disabled={switching}
                            >
                                <Plus size={20} />
                                <span>Create a New Space</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Space Modal */}
            {showCreateModal && (
                <div className="profile-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="profile-modal-header">
                            <h3>Create New Space</h3>
                            <button className="profile-modal-close" onClick={() => setShowCreateModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="profile-modal-body">
                            <input
                                type="text"
                                className="profile-input"
                                placeholder="Space Name"
                                value={newSpaceName}
                                onChange={(e) => setNewSpaceName(e.target.value)}
                                disabled={creating}
                            />
                            <textarea
                                className="profile-input profile-textarea"
                                placeholder="Address (Optional)"
                                value={newSpaceAddress}
                                onChange={(e) => setNewSpaceAddress(e.target.value)}
                                rows={3}
                                disabled={creating}
                            />
                        </div>
                        <div className="profile-modal-footer">
                            <div className="profile-button-row">
                                <button
                                    className="profile-btn profile-btn-cancel"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewSpaceName('');
                                        setNewSpaceAddress('');
                                    }}
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="profile-btn profile-btn-save"
                                    onClick={handleCreateSpace}
                                    disabled={creating || !newSpaceName.trim()}
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions - Switch Space Button */}
            <div className="profile-content">
                <button
                    className="profile-switch-space-btn"
                    onClick={async () => {
                        if (userInfo) {
                            await loadSpaces(userInfo.id);
                        }
                        setShowSpaceSwitch(true);
                    }}
                >
                    <ArrowLeftRight size={20} />
                    <span>Switch Space</span>
                </button>
            </div>
        </div>
    );
};

export default SpaceManage;
