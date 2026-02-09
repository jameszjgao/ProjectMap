import { useState, useEffect } from 'react';
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

            // Add relations based on type
            if (type === 'expenditure') {
                query = supabase
                    .from(config[type].table)
                    .select('*, supplier:supplier_id(name), supplierCustomer:supplier_customer_id(name), account:account_id(name)')
                    .order('date', { ascending: false });
            } else if (type === 'income') {
                query = supabase
                    .from(config[type].table)
                    .select('*, customer:customer_id(name), customerSupplier:customer_supplier_id(name), account:account_id(name)')
                    .order('date', { ascending: false });
            } else if (type === 'inbound') {
                query = supabase
                    .from(config[type].table)
                    .select('*, supplier:supplier_id(name)')
                    .order('date', { ascending: false });
            } else if (type === 'outbound') {
                query = supabase
                    .from(config[type].table)
                    .select('*, customer:customer_id(name)')
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

    // Group records by date
    const groupedRecords = records.reduce((groups: any, record) => {
        const date = record.date ? new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(record);
        return groups;
    }, {});

    return (
        <div className="records-page compact">
            <div className="compact-header">
                <div>
                    <h1>{config[type].title}</h1>
                </div>
                <div className="header-actions">
                    <button className="icon-btn">
                        <Search size={20} />
                    </button>
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
                    Object.keys(groupedRecords).map((date) => (
                        <div key={date} className="date-section">
                            <div className="section-header">{date}</div>
                            <div className="section-items">
                                {groupedRecords[date].map((record: any) => {
                                    const statusStyle = getStatusStyle(record.status);
                                    return (
                                        <div
                                            key={record.id}
                                            className="mobile-record-item"
                                            onClick={() => navigate(`/detail/${type}/${record.id}`)}
                                        >
                                            <div className="item-left">
                                                <div className="item-title">{getDisplayName(record)}</div>
                                                <div className="item-subtitle">
                                                    <span className="account-tag">{record.account?.name || 'No Account'}</span>
                                                    <span className="status-dot" style={{ backgroundColor: statusStyle.color }}></span>
                                                    <span className="status-text" style={{ color: statusStyle.color }}>{statusStyle.text}</span>
                                                </div>
                                            </div>
                                            <div className="item-right">
                                                <div className="item-amount">
                                                    <span className="currency">$</span>
                                                    {Number(record.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                                <div className="item-time">
                                                    {record.created_at ? new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
                {!loading && records.length === 0 && (
                    <div className="empty-state">No records found.</div>
                )}
            </div>
        </div>
    );
};

export default RecordsList;
