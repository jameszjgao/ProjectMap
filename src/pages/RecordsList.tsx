import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter,
    Calendar
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
        expenditure: { title: 'Expenditure Records', table: 'receipts' },
        income: { title: 'Income Records', table: 'invoices' },
        inbound: { title: 'Inbound Vouchers', table: 'inbound' },
        outbound: { title: 'Outbound Vouchers', table: 'outbound' },
    };

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            let query = supabase
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

    const getStatusBadge = (status: string) => {
        let className = 'badge badge-neutral';
        switch (status) {
            case 'confirmed': className = 'badge badge-success'; break;
            case 'processing': className = 'badge badge-warning'; break;
            case 'rejected': className = 'badge badge-danger'; break;
        }
        return <span className={className}>{status}</span>;
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

    return (
        <div className="records-page">
            <div className="list-header">
                <div>
                    <h1>{config[type].title}</h1>
                    <p>Showing latest {records.length} records</p>
                </div>
                <button className="btn btn-primary flex items-center gap-2" onClick={() => navigate(`/detail/${type}/new`)}>
                    <Plus size={20} /> Add New
                </button>
            </div>

            <div className="toolbar">
                <div className="search-box">
                    <Search size={18} className="text-secondary" />
                    <input type="text" placeholder="Search by name..." />
                </div>
                <button className="btn btn-outline flex items-center gap-2">
                    <Filter size={18} /> Filter
                </button>
            </div>

            <div className="records-list-container">
                <div className="records-header-row">
                    <div>{type === 'expenditure' || type === 'inbound' ? 'Supplier / Store' : 'Customer'}</div>
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Status</div>
                </div>

                {loading ? (
                    <div className="loading-container" style={{ height: '300px' }}>
                        <div className="loader" style={{ width: '32px', height: '32px' }}></div>
                    </div>
                ) : (
                    <div className="records-list">
                        {records.map((record) => (
                            <div
                                key={record.id}
                                className="record-item"
                                onClick={() => navigate(`/detail/${type}/${record.id}`)}
                            >
                                <div className="record-name">
                                    {getDisplayName(record)}
                                </div>
                                <div className="record-date">
                                    <Calendar size={14} />
                                    {record.date ? new Date(record.date).toLocaleDateString() : '-'}
                                </div>
                                <div className="record-amount">
                                    ${Number(record.total_amount || 0).toLocaleString()}
                                </div>
                                <div>{getStatusBadge(record.status)}</div>
                            </div>
                        ))}
                        {records.length === 0 && (
                            <div className="empty-state">No records found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecordsList;
