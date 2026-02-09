import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Smartphone, ExternalLink } from 'lucide-react';

const DEEP_LINK_BASE = 'vouchap://auth/confirm';

function isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android|ipad|iphone|ipod/i.test(ua);
}

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

function buildDeepLinkUrl(): string {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const qs = (search ? search.slice(1) + '&' : '') + (hash ? hash.slice(1) : '');
    return qs ? `${DEEP_LINK_BASE}?${qs}` : DEEP_LINK_BASE;
}

const AuthConfirm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'mobile_choice' | 'success' | 'error'>('loading');
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
        const { accessToken, refreshToken, tokenHash, type } = getParamsFromUrl();

        if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            if (sessionData?.user) await ensureUserRecord(sessionData.user);
            setStatus('success');
            if (type === 'recovery') {
                setMessage('Password reset verified! Redirecting to set new password...');
                setTimeout(() => navigate('/set-password'), 1500);
            } else if (type === 'email_change') {
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
            setStatus('success');
            if (type === 'recovery') {
                setMessage('Password reset verified! Redirecting to set new password...');
                setTimeout(() => navigate('/set-password'), 1500);
            } else if (type === 'email_change') {
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

        if (isMobile()) {
            setStatus('mobile_choice');
            const deepLink = buildDeepLinkUrl();
            window.location.href = deepLink;
        } else {
            processConfirm();
        }
    // Intentionally run once on mount; processConfirm is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContinueInBrowser = () => {
        setStatus('loading');
        processConfirm();
    };

    const handleOpenApp = () => {
        window.location.href = buildDeepLinkUrl();
    };

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
    const btnStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.75rem 1rem',
        marginTop: '0.5rem',
        borderRadius: '0.75rem',
        border: 'none',
        fontSize: '0.9375rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    };

    if (status === 'mobile_choice') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <Smartphone size={40} style={{ margin: '0 auto 1rem', color: '#7C3AED' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                        Open in App
                    </h2>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        If the app didn’t open, choose an option below.
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenApp}
                        style={{ ...btnStyle, background: '#7C3AED', color: 'white' }}
                    >
                        <Smartphone size={20} />
                        Open App
                    </button>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '1rem', marginBottom: '0.25rem' }}>
                        Don’t have the app?
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="#"
                            style={{
                                ...btnStyle,
                                background: '#000',
                                color: 'white',
                                textDecoration: 'none',
                                width: 'auto',
                                padding: '0.5rem 1rem',
                            }}
                        >
                            App Store
                        </a>
                        <a
                            href="#"
                            style={{
                                ...btnStyle,
                                background: '#000',
                                color: 'white',
                                textDecoration: 'none',
                                width: 'auto',
                                padding: '0.5rem 1rem',
                            }}
                        >
                            Google Play
                        </a>
                    </div>
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Or complete in this browser
                        </p>
                        <button
                            type="button"
                            onClick={handleContinueInBrowser}
                            style={{ ...btnStyle, background: '#f3f4f6', color: '#374151' }}
                        >
                            <ExternalLink size={18} />
                            Continue in Browser
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
