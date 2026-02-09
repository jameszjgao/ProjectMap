import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Lock, LogOut, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUserInfo, UserInfo } from '../lib/auth-helper';
import './Profile.css';

const UserProfile = () => {
    const navigate = useNavigate();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [editingPassword, setEditingPassword] = useState(false);
    const [changingEmail, setChangingEmail] = useState(false);
    const [userName, setUserName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const userData = await getCurrentUserInfo();
            setUserInfo(userData);
            if (userData) {
                setUserName(userData.name || '');
                setNewEmail(userData.email || '');
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = async () => {
        if (!userInfo) return;

        try {
            setSaving(true);
            const { error } = await supabase
                .from('users')
                .update({ name: userName.trim() || null })
                .eq('id', userInfo.id);

            if (error) throw error;

            setEditingName(false);
            await loadData();
            alert('Name updated successfully');
        } catch (error) {
            console.error('Error updating name:', error);
            alert('Failed to update name');
        } finally {
            setSaving(false);
        }
    };

    // 普通登录改密须验证原密码；通过 reset 邮件进来的在 SetPassword 页直接输新密码+确认
    const handleChangePassword = async () => {
        if (!currentPassword.trim()) {
            alert('Please enter your current password');
            return;
        }
        if (!newPassword.trim() || newPassword.length < 6) {
            alert('Please enter a new password (at least 6 characters)');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('New password and confirmation do not match');
            return;
        }

        try {
            setSaving(true);
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: userInfo!.email || '',
                password: currentPassword,
            });
            if (signInError) {
                if (signInError.message?.toLowerCase().includes('invalid') || signInError.message?.toLowerCase().includes('password')) {
                    alert('Current password is incorrect');
                } else {
                    throw signInError;
                }
                return;
            }
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setEditingPassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            alert('Password updated successfully.');
        } catch (error: any) {
            console.error('Error updating password:', error);
            alert(error.message || 'Failed to update password');
        } finally {
            setSaving(false);
        }
    };

    const handleChangeEmail = async () => {
        if (!newEmail.trim() || !newEmail.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }

        try {
            setSaving(true);
            // 构建重定向URL，指向web应用的确认页面
            const redirectUrl = `${window.location.origin}/auth/confirm`;
            
            const { error } = await supabase.auth.updateUser({
                email: newEmail.trim(),
            }, {
                emailRedirectTo: redirectUrl,
            });

            if (error) throw error;

            alert('Email change request sent! Please check your new email inbox and click the confirmation link to complete the change.');
            setChangingEmail(false);
            await loadData();
        } catch (error: any) {
            console.error('Error changing email:', error);
            alert(error.message || 'Failed to change email');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await supabase.auth.signOut();
            navigate('/login');
        }
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
                <h1>Personal Information</h1>
            </div>

            <div className="profile-content">
                {/* Name */}
                <div className="profile-card">
                    <div className="profile-card-header">
                        <User size={20} className="profile-card-icon" />
                        {editingName ? (
                            <div className="profile-edit-container">
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="profile-input"
                                    placeholder="Enter your name"
                                    autoFocus
                                />
                                <div className="profile-button-row">
                                    <button
                                        className="profile-btn profile-btn-cancel"
                                        onClick={() => {
                                            setEditingName(false);
                                            setUserName(userInfo?.name || '');
                                        }}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="profile-btn profile-btn-save"
                                        onClick={handleSaveName}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="profile-view-container">
                                <div className="profile-view-content">
                                    <div className="profile-name-row">
                                        <span className="profile-name">{userInfo?.name || 'Not set'}</span>
                                        <button
                                            className="profile-edit-icon-btn"
                                            onClick={() => setEditingName(true)}
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Email */}
                <div className="profile-card">
                    <div className="profile-card-header">
                        <Mail size={20} className="profile-card-icon" />
                        {changingEmail ? (
                            <div className="profile-edit-container">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="profile-input"
                                    placeholder="Enter new email"
                                    autoFocus
                                />
                                <div className="profile-button-row">
                                    <button
                                        className="profile-btn profile-btn-cancel"
                                        onClick={() => {
                                            setChangingEmail(false);
                                            setNewEmail(userInfo?.email || '');
                                        }}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="profile-btn profile-btn-save"
                                        onClick={handleChangeEmail}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Change Email'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="profile-view-container">
                                <div className="profile-view-content">
                                    <div className="profile-info-row">
                                        <div className="profile-info-content">
                                            <div className="profile-info-label">Email</div>
                                            <div className="profile-info-value">{userInfo?.email || 'N/A'}</div>
                                        </div>
                                        <button
                                            className="profile-edit-icon-btn"
                                            onClick={() => setChangingEmail(true)}
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Password - 直接修改，不需邮件确认 */}
                <div className="profile-card">
                    <div className="profile-card-header">
                        <Lock size={20} className="profile-card-icon" />
                        {editingPassword ? (
                            <div className="profile-edit-container">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="profile-input"
                                    placeholder="Current password"
                                    autoComplete="current-password"
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="profile-input"
                                    placeholder="New password (min 6 characters)"
                                    autoComplete="new-password"
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="profile-input"
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                />
                                <div className="profile-button-row">
                                    <button
                                        className="profile-btn profile-btn-cancel"
                                        onClick={() => {
                                            setEditingPassword(false);
                                            setCurrentPassword('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                        }}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="profile-btn profile-btn-save"
                                        onClick={handleChangePassword}
                                        disabled={saving}
                                    >
                                        {saving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="profile-view-container">
                                <div className="profile-view-content">
                                    <div className="profile-info-row">
                                        <div className="profile-info-content">
                                            <div className="profile-info-label">Password</div>
                                            <div className="profile-info-value">••••••••</div>
                                        </div>
                                        <button
                                            className="profile-edit-icon-btn"
                                            onClick={() => setEditingPassword(true)}
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sign Out Button */}
            <div className="profile-content">
                <button className="profile-signout-btn" onClick={handleSignOut}>
                    <LogOut size={20} />
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    );
};

export default UserProfile;
