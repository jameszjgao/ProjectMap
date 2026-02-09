import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle } from 'lucide-react';

function getParamsFromUrl(): { accessToken?: string; refreshToken?: string; tokenHash?: string; type?: string } {
    if (typeof window === 'undefined') return {};
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get('access_token') || undefined;
    const refreshToken = hashParams.get('refresh_token') || undefined;
    const tokenHash = hashParams.get('token_hash') || searchParams.get('token_hash') || undefined;
    const type = hashParams.get('type') || searchParams.get('type') || undefined;
    return { accessToken, refreshToken, tokenHash, type: type || undefined };
}

/**
 * Platform auth confirm: only reached when user clicks "Go to Platform" / "Set password in browser"
 * or "Continue in browser" from the website intermediate page. No device detection; just verify and redirect.
 */
const AuthConfirm = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    const ensureUserRecord = useCallback(async (user: any) => {
        try {
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            if (!existingUser) {
                const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
                await supabase.from('users').insert({
                    id: user.id,
                    email: user.email || '',
                    name,
                    current_space_id: null,
                });
            }
        } catch (e) {
            console.error('Error ensuring user record:', e);
        }
    }, []);

    const processConfirm = useCallback(async () => {
        try {
            const { accessToken, refreshToken, tokenHash, type } = getParamsFromUrl();

            if (accessToken && refreshToken) {
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (sessionError) throw sessionError;
                if (sessionData?.user) await ensureUserRecord(sessionData.user);
                if (type === 'recovery') {
                    navigate('/set-password', { replace: true });
                    return;
                }
                setStatus('success');
                if (type === 'email_change') {
                    setMessage('Email change confirmed! Your email has been updated.');
                    setTimeout(() => navigate('/profile'), 2000);
                } else {
                    setMessage('Email confirmed successfully!');
                    setTimeout(() => navigate('/'), 2000);
                }
                return;
            }

            if (tokenHash) {
                const { data, error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: (type as any) || 'email',
                });
                if (error) throw error;
                if (data?.user) await ensureUserRecord(data.user);
                if (type === 'recovery') {
                    // 直接跳改密页，不展示 success 卡避免闪现
                    const waitForSession = async (attempts = 0): Promise<void> => {
                        const max = 20;
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            navigate('/set-password', { replace: true });
                            return;
                        }
                        if (attempts < max) {
                            setTimeout(() => waitForSession(attempts + 1), 150);
                        } else {
                            navigate('/set-password', { replace: true });
                        }
                    };
                    waitForSession();
                    return;
                }
                setStatus('success');
                if (type === 'email_change') {
                    setMessage('Email change confirmed!');
                    setTimeout(() => navigate('/profile'), 2000);
                } else {
                    setMessage('Email confirmed successfully!');
                    setTimeout(() => navigate('/'), 2000);
                }
                return;
            }

            setStatus('error');
            setMessage('Invalid confirmation link. Please try again.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            console.error('Auth confirm error:', err);
            setStatus('error');
            setMessage(err?.message || 'Confirmation failed. The link may have expired. Please request a new one.');
            setTimeout(() => navigate('/login'), 3000);
        }
    }, [navigate, ensureUserRecord]);

    useEffect(() => {
        const params = getParamsFromUrl();
        const hasToken = !!(params.accessToken || params.tokenHash);

        if (!hasToken) {
            setStatus('error');
            setMessage('Invalid confirmation link. Please try again.');
            setTimeout(() => navigate('/login'), 3000);
            return;
        }

        processConfirm();
    // Intentionally run once on mount; processConfirm is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1rem',
    };
    const cardStyle: React.CSSProperties = {
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                {status === 'loading' && (
                    <>
                        <div className="loader" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                            Confirming...
                        </h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                            Please wait while we confirm your request.
                        </p>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: '#10b981' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                            Success!
                        </h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>{message}</p>
                        <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Redirecting...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <XCircle size={48} style={{ margin: '0 auto 1rem', color: '#ef4444' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                            Error
                        </h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>{message}</p>
                        <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Redirecting to login...</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthConfirm;
