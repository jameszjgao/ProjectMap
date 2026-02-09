import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SetPassword.css';

const SetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const resolveSession = (session: any) => {
            if (!cancelled) setCheckingAuth(false);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) resolveSession(session);
        });

        const checkWithRetries = async (attempt = 0) => {
            const delays = [0, 200, 500, 1000, 2000];
            const idx = Math.min(attempt, delays.length - 1);
            if (delays[idx] > 0) {
                await new Promise((r) => setTimeout(r, delays[idx]));
            }
            if (cancelled) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                resolveSession(session);
                return;
            }
            if (attempt < delays.length - 1) {
                checkWithRetries(attempt + 1);
            } else {
                if (!cancelled) {
                    setCheckingAuth(false);
                    setError('Your password reset session has expired. Please request a new password reset link.');
                    setTimeout(() => navigate('/reset-password'), 3000);
                }
            }
        };

        checkWithRetries(0);

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [navigate]);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password.trim()) {
            setError('Please enter a new password');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password.trim(),
            });

            if (updateError) {
                throw updateError;
            }

            // 成功设置密码
            alert('Password set successfully! Please sign in with your new password.');
            await supabase.auth.signOut();
            navigate('/login');
        } catch (err: any) {
            console.error('Error setting password:', err);
            setError(err.message || 'Failed to set password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="set-password-page">
                <div className="set-password-container">
                    <div className="set-password-loading">
                        <div className="loader"></div>
                        <p>Verifying session...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="set-password-page">
            <div className="set-password-container">
                <div className="set-password-header">
                    <div className="set-password-icon-container">
                        <div className="set-password-icon-circle">
                            <Lock size={60} color="#6C5CE7" />
                        </div>
                    </div>
                    <h1 className="set-password-title">Set New Password</h1>
                    <p className="set-password-subtitle">Enter your new password</p>
                </div>

                <form onSubmit={handleSetPassword} className="set-password-form">
                    <div className="set-password-input-group">
                        <div className="set-password-input-wrapper">
                            <Lock size={20} className="set-password-input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="set-password-input"
                                placeholder="New Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="set-password-eye-btn"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="set-password-input-group">
                        <div className="set-password-input-wrapper">
                            <Lock size={20} className="set-password-input-icon" />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                className="set-password-input"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="set-password-eye-btn"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {error && <div className="set-password-error">{error}</div>}

                    <button
                        type="submit"
                        className="set-password-submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Setting Password...' : 'Set Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetPassword;
