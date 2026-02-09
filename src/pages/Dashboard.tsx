import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    TrendingUp, TrendingDown, Package, CreditCard,
    ChevronUp, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState({
        expenditure: 0,
        income: 0,
        inboundCount: 0,
        outboundCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 并行查询优化：使用 Promise.all 同时发起所有请求，减少等待时间
                // 注意：理想情况下应该使用 Supabase RPC 函数进行数据库端聚合，避免传输全表数据
                const [
                    { data: receipts },
                    { data: invoices },
                    { count: inboundCount },
                    { count: outboundCount },
                ] = await Promise.all([
                    supabase.from('receipts').select('total_amount'),
                    supabase.from('invoices').select('total_amount'),
                    supabase.from('inbound').select('*', { count: 'exact', head: true }),
                    supabase.from('outbound').select('*', { count: 'exact', head: true }),
                ]);

                const totalExp = receipts?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0;
                const totalInc = invoices?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0;

                setStats({
                    expenditure: totalExp,
                    income: totalInc,
                    inboundCount: inboundCount || 0,
                    outboundCount: outboundCount || 0
                });
            } catch (error) {
                console.error('Failed to load dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const data = [
        { name: 'Mon', exp: 4000, inc: 2400 },
        { name: 'Tue', exp: 3000, inc: 1398 },
        { name: 'Wed', exp: 2000, inc: 9800 },
        { name: 'Thu', exp: 2780, inc: 3908 },
        { name: 'Fri', exp: 1890, inc: 4800 },
        { name: 'Sat', exp: 2390, inc: 3800 },
        { name: 'Sun', exp: 3490, inc: 4300 },
    ];

    const inventoryData = [
        { name: 'SKU A', value: 400 },
        { name: 'SKU B', value: 300 },
        { name: 'SKU C', value: 300 },
        { name: 'SKU D', value: 200 },
        { name: 'SKU E', value: 278 },
    ];

    return (
        <div className="dashboard-page">
            <div className="page-header">
                <h1>BI Analytics Dashboard</h1>
                <p>Real-time overview of your business performance</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon exp">
                        <TrendingDown size={24} />
                    </div>
                    <div className="stat-info">
                        <label>Total Expenditure</label>
                        <h3>${stats.expenditure.toLocaleString()}</h3>
                        <span className="trend positive">
                            <ChevronDown size={16} /> 12% vs last month
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon inc">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-info">
                        <label>Total Income</label>
                        <h3>${stats.income.toLocaleString()}</h3>
                        <span className="trend positive">
                            <ChevronUp size={16} /> 8.4% vs last month
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon in">
                        <Package size={24} />
                    </div>
                    <div className="stat-info">
                        <label>Inbound Requests</label>
                        <h3>{stats.inboundCount}</h3>
                        <span className="trend neutral">
                            Stable performance
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon out">
                        <CreditCard size={24} />
                    </div>
                    <div className="stat-info">
                        <label>Outbound Orders</label>
                        <h3>{stats.outboundCount}</h3>
                        <span className="trend negative">
                            <ChevronDown size={16} /> 2.1% slow down
                        </span>
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container main-chart">
                    <h3>Cash Flow Trend</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#1e293b' }}
                                />
                                <Area type="monotone" dataKey="inc" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                                <Area type="monotone" dataKey="exp" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Inventory Distribution</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={inventoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#1e293b' }}
                                />
                                <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Dashboard;
