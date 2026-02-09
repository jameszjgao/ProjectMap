import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RecordsList from './pages/RecordsList';
import RecordDetail from './pages/RecordDetail';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import './App.css';

function App() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Initial session check
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (mounted) {
                if (error) {
                    console.error('Error checking session:', error);
                }
                setSession(session);
                setLoading(false);
            }
        }).catch(err => {
            console.error('Unexpected error checking session:', err);
            if (mounted) setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) setSession(session);
        });

        // Timeout fallback
        const timeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Session check timed out');
                setLoading(false);
            }
        }, 5000);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loader"></div>
                <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading Vouchap...</p>
            </div>
        );
    }

    return (
        <Router>
            <div className="app-container">
                {session ? (
                    <div className="dashboard-layout">
                        <Sidebar user={session.user} />
                        <div className="main-content">
                            <div className="page-content">
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/expenditure" element={<RecordsList type="expenditure" />} />
                                    <Route path="/income" element={<RecordsList type="income" />} />
                                    <Route path="/inbound" element={<RecordsList type="inbound" />} />
                                    <Route path="/outbound" element={<RecordsList type="outbound" />} />
                                    <Route path="/detail/:type/:id" element={<RecordDetail />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                )}
            </div>
        </Router>
    );
}

export default App;
