import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { supabase } from './lib/supabase';
import './App.css';

// 路由级懒加载，减小首屏 bundle 体积（Recharts 等大型库只在 Dashboard 路由加载）
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthConfirm = lazy(() => import('./pages/AuthConfirm'));
const SetPassword = lazy(() => import('./pages/SetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const RecordsList = lazy(() => import('./pages/RecordsList'));
const RecordDetail = lazy(() => import('./pages/RecordDetail'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const SpaceManage = lazy(() => import('./pages/SpaceManage'));
const ProjectMap = lazy(() => import('./pages/ProjectMap'));
const MindMapEditor = lazy(() => import('./pages/MindMapEditor'));
const Sidebar = lazy(() => import('./components/layout/Sidebar'));
const Header = lazy(() => import('./components/layout/Header'));
const AiInventory = lazy(() => import('./pages/AiInventory'));
const Management = lazy(() => import('./pages/Management'));
const CategoriesManage = lazy(() => import('./pages/CategoriesManage'));
const PurposesManage = lazy(() => import('./pages/PurposesManage'));
const AccountsManage = lazy(() => import('./pages/AccountsManage'));
const SuppliersManage = lazy(() => import('./pages/SuppliersManage'));
const CustomersManage = lazy(() => import('./pages/CustomersManage'));
const WarehouseManage = lazy(() => import('./pages/WarehouseManage'));
const SkusManage = lazy(() => import('./pages/SkusManage'));
const SpaceMembers = lazy(() => import('./pages/SpaceMembers'));
const ManualEntry = lazy(() => import('./pages/ManualEntry'));
const VoiceInput = lazy(() => import('./pages/VoiceInput'));
const SpaceSelect = lazy(() => import('./pages/SpaceSelect'));
const SetupSpace = lazy(() => import('./pages/SetupSpace'));
const HandleInvitations = lazy(() => import('./pages/HandleInvitations'));
const Invite = lazy(() => import('./pages/Invite'));

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
                <Suspense
                    fallback={
                        <div className="loading-container">
                            <div className="loader"></div>
                            <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading Vouchap...</p>
                        </div>
                    }
                >
                    {session ? (
                        <div className="dashboard-layout">
                            <Sidebar user={session.user} />
                            <div className="main-content">
                                <div className="page-content">
                                    <Routes>
                                        <Route path="/" element={<Dashboard />} />
                                        <Route path="/expenditure" element={<RecordsList type="expenditure" />} />
                                        <Route path="/expenses" element={<RecordsList type="expenditure" />} />
                                        <Route path="/income" element={<RecordsList type="income" />} />
                                        <Route path="/inbound" element={<RecordsList type="inbound" />} />
                                        <Route path="/outbound" element={<RecordsList type="outbound" />} />
                                        <Route path="/ai-inventory" element={<AiInventory />} />
                                        <Route path="/management" element={<Management />} />
                                        <Route path="/categories-manage" element={<CategoriesManage />} />
                                        <Route path="/purposes-manage" element={<PurposesManage />} />
                                        <Route path="/accounts-manage" element={<AccountsManage />} />
                                        <Route path="/suppliers-manage" element={<SuppliersManage />} />
                                        <Route path="/customers-manage" element={<CustomersManage />} />
                                        <Route path="/warehouse-manage" element={<WarehouseManage />} />
                                        <Route path="/skus-manage" element={<SkusManage />} />
                                        <Route path="/space-members" element={<SpaceMembers />} />
                                        <Route path="/detail/:type/:id" element={<RecordDetail />} />
                                        <Route path="/receipt-details/:id" element={<RecordDetail />} />
                                        <Route path="/invoice-details/:id" element={<RecordDetail />} />
                                        <Route path="/inbound-details/:id" element={<RecordDetail />} />
                                        <Route path="/outbound-details/:id" element={<RecordDetail />} />
                                        <Route path="/manual-entry" element={<ManualEntry />} />
                                        <Route path="/voice-input" element={<VoiceInput />} />
                                        <Route path="/space-select" element={<SpaceSelect />} />
                                        <Route path="/setup-space" element={<SetupSpace />} />
                                        <Route path="/handle-invitations" element={<HandleInvitations />} />
                                        <Route path="/invite/:id" element={<Invite />} />
                                        <Route path="/profile" element={<UserProfile />} />
                                        <Route path="/space-manage" element={<SpaceManage />} />
                                        <Route path="/project-map" element={<ProjectMap />} />
                                        <Route path="/project-map/map/:id" element={<ReactFlowProvider><MindMapEditor /></ReactFlowProvider>} />
                                        <Route path="/auth/confirm" element={<AuthConfirm />} />
                                        <Route path="/set-password" element={<SetPassword />} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/auth/confirm" element={<AuthConfirm />} />
                            <Route path="/set-password" element={<SetPassword />} />
                            <Route path="*" element={<Navigate to="/login" replace />} />
                        </Routes>
                    )}
                </Suspense>
            </div>
        </Router>
    );
}

export default App;
