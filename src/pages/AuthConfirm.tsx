import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AuthConfirm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const handleAuthConfirm = async () => {
            try {
                // 获取URL中的hash参数（Supabase会将token放在hash中）
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const type = hashParams.get('type') || searchParams.get('type');

                if (!accessToken) {
                    // 如果没有token，可能是直接访问，重定向到登录页
                    setStatus('error');
                    setMessage('Invalid confirmation link. Please try again.');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // 设置session
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: hashParams.get('refresh_token') || '',
                });

                if (sessionError) {
                    throw sessionError;
                }

                // 确保users表中有用户记录
                if (sessionData?.user) {
                    await ensureUserRecord(sessionData.user);
                }

                // 根据类型显示不同的消息和跳转
                if (type === 'recovery') {
                    setMessage('Password reset verified! Redirecting to set new password...');
                    setStatus('success');
                    // 重定向到设置新密码页面
                    setTimeout(() => navigate('/set-password'), 1500);
                } else if (type === 'email_change') {
                    setMessage('Email change confirmed! Your email has been updated.');
                    setStatus('success');
                    setTimeout(() => navigate('/profile'), 2000);
                } else if (type === 'signup') {
                    setMessage('Email confirmed successfully! Redirecting to dashboard...');
                    setStatus('success');
                    setTimeout(() => navigate('/'), 2000);
                } else {
                    setMessage('Email confirmed successfully!');
                    setStatus('success');
                    setTimeout(() => navigate('/'), 2000);
                }
            } catch (error: any) {
                console.error('Error confirming auth:', error);
                setStatus('error');
                setMessage(error.message || 'Failed to confirm. Please try again.');
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        handleAuthConfirm();
    }, [navigate, searchParams]);

    // 确保users表中有用户记录
    const ensureUserRecord = async (user: any) => {
        try {
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

            if (!existingUser) {
                const userNameFromMetadata = user.user_metadata?.name;
                const userName = userNameFromMetadata || user.email?.split('@')[0] || 'User';

                const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: user.id,
                        email: user.email || '',
                        name: userName,
                        current_space_id: null,
                    });

                if (insertError) {
                    console.error('Error creating user record:', insertError);
                } else {
                    console.log('User record created successfully');
                }
            }
        } catch (error) {
            console.error('Error ensuring user record exists:', error);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1rem',
        }}>
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
                {status === 'loading' && (
                    <>
                        <Loader2 className="animate-spin" size={48} style={{ margin: '0 auto 1rem', color: '#7C3AED' }} />
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
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            {message}
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                            Redirecting...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <XCircle size={48} style={{ margin: '0 auto 1rem', color: '#ef4444' }} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                            Error
                        </h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            {message}
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                            Redirecting to login...
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthConfirm;
