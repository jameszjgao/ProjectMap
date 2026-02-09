import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter,
    Calendar, MoreHorizontal
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './RecordsList.css';

interface RecordsListProps {
    type: 'expenditure' | 'income' | 'inbound' | 'outbound';
}

const RecordsList = ({ type }: RecordsListProps) => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const config: any = {
        expenditure: { title: 'Expenditure', table: 'receipts' },
        income: { title: 'Income', table: 'invoices' },
        inbound: { title: 'Inbound', table: 'inbound' },
        outbound: { title: 'Outbound', table: 'outbound' },
    };

    const getDisplayName = (record: any) => {
        if (type === 'expenditure') {
            return record.supplier?.name || record.supplierCustomer?.name || record.supplier_name || record.store_name || 'N/A';
        } else if (type === 'income') {
            return record.customer?.name || record.customerSupplier?.name || record.customer_name || 'N/A';
        } else if (type === 'inbound') {
            return record.supplier?.name || record.supplier_name || 'N/A';
        } else {
            return record.customer?.name || record.customer_name || 'N/A';
        }
    };

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            let query: any = supabase
                .from(config[type].table)
                .select('*')
                .order('date', { ascending: false });

            // 精简 select 字段：只查询列表实际使用的字段，减少数据传输量
            if (type === 'expenditure') {
                query = supabase
                    .from(config[type].table)
                    .select('id, date, total_amount, currency, status, created_at, account:account_id(name), supplier:supplier_id(name), supplierCustomer:supplier_customer_id(name), created_by_user:created_by(email)')
                    .order('date', { ascending: false });
            } else if (type === 'income') {
                query = supabase
                    .from(config[type].table)
                    .select('id, date, total_amount, currency, status, created_at, account:account_id(name), customer:customer_id(name), customerSupplier:customer_supplier_id(name), created_by_user:created_by(email)')
                    .order('date', { ascending: false });
            } else if (type === 'inbound') {
                query = supabase
                    .from(config[type].table)
                    .select('id, date, total_amount, currency, status, created_at, supplier:supplier_id(name), created_by_user:created_by(email)')
                    .order('date', { ascending: false });
            } else if (type === 'outbound') {
                query = supabase
                    .from(config[type].table)
                    .select('id, date, total_amount, currency, status, created_at, customer:customer_id(name), created_by_user:created_by(email)')
                    .order('date', { ascending: false });
            }

            const { data, error } = await query;

            if (data) setRecords(data);
            setLoading(false);
        };

        fetchRecords();
    }, [type]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'confirmed': return { text: 'Confirmed', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
            case 'processing': return { text: 'Processing', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.1)' };
            case 'rejected': return { text: 'Rejected', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
            default: return { text: 'Pending', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
        }
    };

    const [groupingDim, setGroupingDim] = useState<'month' | 'recordDate' | 'paymentAccount' | 'createdBy' | 'none'>('recordDate');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // 使用 useMemo 优化过滤逻辑，避免每次渲染都重新计算
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const name = getDisplayName(record).toLowerCase();
            const amount = record.total_amount?.toString() || '';
            const account = record.account?.name?.toLowerCase() || '';
            return name.includes(query) || amount.includes(query) || account.includes(query);
        });
    }, [records, searchQuery, type]);

    // 使用 useMemo 优化分组逻辑，避免每次渲染都重新计算
    const groupedRecords = useMemo(() => {
        return filteredRecords.reduce((groups: Record<string, { items: any[]; sortValue: number }>, record) => {
            let key = 'All Records';
            let sortValue = 0;

            if (groupingDim === 'month') {
                const date = record.date ? new Date(record.date) : new Date();
                key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                sortValue = date.getTime();
            } else if (groupingDim === 'recordDate') {
                const date = record.created_at ? new Date(record.created_at) : (record.date ? new Date(record.date) : new Date());
                key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                sortValue = date.getTime();
            } else if (groupingDim === 'paymentAccount') {
                key = record.account?.name || 'No Account';
                sortValue = key.localeCompare('');
            } else if (groupingDim === 'createdBy') {
                key = record.created_by_user?.name || record.created_by_user?.email || 'Unknown User';
                sortValue = key.localeCompare('');
            }

            if (!groups[key]) {
                groups[key] = { items: [], sortValue };
            }
            groups[key].items.push(record);
            return groups;
        }, {});
    }, [filteredRecords, groupingDim]);

    const sortedGroupKeys = Object.keys(groupedRecords).sort((a, b) => {
        if (groupingDim === 'month' || groupingDim === 'recordDate') {
            return groupedRecords[b].sortValue - groupedRecords[a].sortValue;
        }
        return a.localeCompare(b);
    });

    const toggleGroup = (groupKey: string) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(groupKey)) {
            newCollapsed.delete(groupKey);
        } else {
            newCollapsed.add(groupKey);
        }
        setCollapsedGroups(newCollapsed);
    };

    return (
        <div className="records-page compact">
            <div className="compact-header">
                <div className="header-left">
                    <h1>{config[type].title}</h1>
                    <div className="grouping-controls">
                        <select
                            value={groupingDim}
                            onChange={(e) => setGroupingDim(e.target.value as any)}
                            className="grouping-select"
                        >
                            <option value="recordDate">Group by Record Date</option>
                            <option value="month">Group by Transaction Month</option>
                            <option value="paymentAccount">Group by Account</option>
                            <option value="createdBy">Group by User</option>
                            <option value="none">No Grouping</option>
                        </select>
                    </div>
                </div>
                <div className="header-actions">
                    <div className="header-search-container">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="header-search-input"
                        />
                    </div>
                    <button className="icon-btn">
                        <Filter size={20} />
                    </button>
                    <button className="btn btn-primary compact-add-btn" onClick={() => navigate(`/detail/${type}/new`)}>
                        <Plus size={18} /> New
                    </button>
                </div>
            </div>

            <div className="records-list-scroll">
                {loading ? (
                    <div className="loading-container">
                        <div className="loader"></div>
                    </div>
                ) : (
                    <div className="records-table-container">
                        <table className="records-table compact-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '30%' }}>Title / Supplier</th>
                                    <th style={{ width: '10%' }}>Currency</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                                    <th style={{ width: '15%' }}>Creator</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedGroupKeys.map((groupKey) => (
                                    <>
                                        {groupingDim !== 'none' && (
                                            <tr
                                                key={`header-${groupKey}`}
                                                className="date-header-row"
                                                onClick={() => toggleGroup(groupKey)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td colSpan={6}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ transform: collapsedGroups.has(groupKey) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                            ▼
                                                        </span>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                                                            {groupKey}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 'normal', marginLeft: 'auto' }}>
                                                            {groupedRecords[groupKey].items.length} records
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {(!collapsedGroups.has(groupKey) || groupingDim === 'none') && groupedRecords[groupKey].items.map((record: any) => {
                                            const statusStyle = getStatusStyle(record.status);
                                            return (
                                                <tr
                                                    key={record.id}
                                                    className="record-row"
                                                    onClick={() => navigate(`/detail/${type}/${record.id}`)}
                                                >
                                                    <td>
                                                        <div className="cell-primary">{getDisplayName(record)}</div>
                                                        <div className="cell-secondary">{record.account?.name || 'No Account'}</div>
                                                    </td>
                                                    <td>
                                                        <span className="currency-badge">{record.currency || 'USD'}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="amount-cell">
                                                            {Number(record.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span
                                                            className="status-text-mobile"
                                                            style={{ color: statusStyle.color }}
                                                        >
                                                            {statusStyle.text}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="meta-text">{record.created_by_user?.email || '-'}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="meta-text">
                                                            {record.created_at ? new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                ))}
                            </tbody>
                        </table>
                        {!loading && records.length === 0 && (
                            <div className="empty-state">No records found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecordsList;
