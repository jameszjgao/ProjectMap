import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Loader2 } from 'lucide-react';

const Register = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isDark, setIsDark] = useState(false);

    // 检测系统深色模式偏好
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDark(mediaQuery.matches);
        
        const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        // 验证密码
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name || email.split('@')[0],
                    },
                    emailRedirectTo: `${window.location.origin}/auth/confirm`,
                },
            });

            if (signUpError) {
                // 处理邮箱已存在的错误
                if (signUpError.message?.toLowerCase().includes('already registered') ||
                    signUpError.message?.toLowerCase().includes('email already')) {
                    setError('This email is already registered. Please sign in instead.');
                } else {
                    setError(signUpError.message);
                }
                setLoading(false);
                return;
            }

            // 检查是否需要邮箱确认
            if (data.user && !data.session) {
                setSuccess(true);
                setError(null);
            } else if (data.session) {
                // 如果直接登录成功，跳转到首页
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`login-page ${isDark ? 'dark' : ''}`}>
            <div className="login-glass-card">
                <div className="login-header">
                    <div className="login-logo-container">
                        <img src="/logo.png" alt="Vouchap Logo" className="login-logo-img" />
                        <span className="login-brand-name">Vouchap</span>
                    </div>
                    <p className="login-slogan">
                        <span>Voucher Snapping,</span>
                        <span>Balance Clarity.</span>
                    </p>
                </div>

                {success ? (
                    <div className="success-message">
                        <h3>Check your email</h3>
                        <p>We've sent a confirmation link to {email}. Please check your inbox and click the link to verify your account.</p>
                        <Link to="/login" className="login-link">
                            <p>Back to <span>Sign In</span></p>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="login-form">
                        <div className="input-group">
                            <label>Full Name</label>
                            <div className="input-wrapper">
                                <User className="input-icon" size={20} />
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={20} />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                'Sign Up'
                            )}
                        </button>
                    </form>
                )}

                <div className="login-footer">
                    <Link to="/login" className="login-link">
                        <p>Already have an account? <span>Sign In</span></p>
                    </Link>
                </div>
            </div>

            <style>{`
        .login-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          overflow: hidden;
          position: relative;
          transition: background-color 0.3s ease;
        }

        .login-page.dark {
          background: #0a0a0a;
        }

        .login-page::before {
          content: '';
          position: absolute;
          width: 1000px;
          height: 600px;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%);
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 0;
        }

        .login-page.dark::before {
          background: radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%);
        }

        .login-page::after {
          content: '';
          position: absolute;
          width: 800px;
          height: 600px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
          bottom: 0;
          right: 0;
          z-index: 0;
        }

        .login-glass-card {
          width: 440px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 2rem;
          padding: 3rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
          z-index: 10;
          transition: all 0.3s ease;
        }

        .login-page.dark .login-glass-card {
          background: rgba(10, 10, 10, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .login-logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin: 0 auto 2rem;
        }

        .login-logo-img {
          width: 64px;
          height: 64px;
          object-fit: contain;
        }

        .login-brand-name {
          font-size: 2rem;
          font-weight: 800;
          font-family: 'Poppins', 'Outfit', sans-serif;
          color: #0a0a0a;
          transition: color 0.3s ease;
          letter-spacing: -0.02em;
        }

        .login-page.dark .login-brand-name {
          color: #ededed;
        }

        .login-slogan {
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
          font-family: 'Poppins', sans-serif;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          line-height: 1.3;
        }

        .login-slogan span {
          background: linear-gradient(to right, #0a0a0a, #9F7AEA, #7C3AED);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-page.dark .login-slogan span {
          background: linear-gradient(to right, #ededed, #9F7AEA, #7C3AED);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #2d3436;
          margin-left: 0.25rem;
          transition: color 0.3s ease;
        }

        .login-page.dark .input-group label {
          color: #ededed;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          color: #636e72;
          transition: color 0.3s ease;
        }

        .login-page.dark .input-icon {
          color: #94a3b8;
        }

        .login-form input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 3rem;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 1rem;
          color: #0a0a0a;
          outline: none;
          transition: all 0.2s ease;
        }

        .login-page.dark .login-form input {
          background: rgba(10, 10, 10, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ededed;
        }

        .login-form input:focus {
          border-color: #7C3AED;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1);
        }

        .login-page.dark .login-form input:focus {
          background: rgba(10, 10, 10, 0.8);
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.2);
        }

        .error-message {
          color: #ef4444;
          font-size: 0.875rem;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .success-message {
          text-align: center;
          padding: 1.5rem 0;
        }

        .success-message h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #0a0a0a;
          margin-bottom: 0.75rem;
          font-family: 'Poppins', sans-serif;
        }

        .login-page.dark .success-message h3 {
          color: #ededed;
        }

        .success-message p {
          color: #636e72;
          font-size: 0.875rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .login-page.dark .success-message p {
          color: #94a3b8;
        }

        .login-btn {
          margin-top: 1rem;
          padding: 1rem;
          background: linear-gradient(135deg, #7C3AED 0%, #9F7AEA 100%);
          color: white;
          border: none;
          border-radius: 1rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Poppins', sans-serif;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.4);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
        }

        .login-link {
          text-decoration: none;
          color: #636e72;
          font-size: 0.875rem;
          transition: color 0.3s ease;
        }

        .login-page.dark .login-link {
          color: #94a3b8;
        }

        .login-link p {
          margin: 0;
          text-align: center;
        }

        .login-link span {
          color: #7C3AED;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .login-link:hover span {
          color: #9F7AEA;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default Register;
