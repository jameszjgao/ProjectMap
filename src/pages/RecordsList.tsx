import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter, MoreHorizontal,
    ArrowRight, Calendar, Tag, CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RecordsListProps {
    type: 'expenditure' | 'income' | 'inbound' | 'outbound';
}

const RecordsList = ({ type }: RecordsListProps) => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const config = {
        expenditure: { title: 'Expenditure Records', table: 'receipts', color: '#ec4899' },
        income: { title: 'Income Records', table: 'invoices', color: '#6366f1' },
        inbound: { title: 'Inbound Vouchers', table: 'inbound', color: '#22c55e' },
        outbound: { title: 'Outbound Vouchers', table: 'outbound', color: '#eab308' },
    };

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from(config[type].table)
                .select('*')
                .order('date', { ascending: false });

            if (data) setRecords(data);
            setLoading(false);
        };

        fetchRecords();
    }, [type]);

    const getStatusBadge = (status: string) => {
        const colors: any = {
            pending: 'rgba(234, 179, 8, 0.1), #eab308',
            confirmed: 'rgba(34, 197, 94, 0.1), #22c55e',
            processing: 'rgba(99, 102, 241, 0.1), #6366f1',
        };
        const [bg, fg] = (colors[status] || 'rgba(148, 163, 184, 0.1), #94a3b8').split(', ');
        return <span className="status-badge" style={{ backgroundColor: bg, color: fg }}>{status}</span>;
    };

    return (
        <div className="records-page">
            <div className="list-header">
                <div>
                    <h1>{config[type].title}</h1>
                    <p>Showing latest {records.length} records</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <Plus size={20} /> Add New
                </button>
            </div>

            <div className="toolbar glass-card">
                <div className="search-box">
                    <Search size={18} />
                    <input type="text" placeholder="Search by name, ID or date..." />
                </div>
                <div className="filter-actions">
                    <button className="btn-secondary flex items-center gap-2">
                        <Filter size={18} /> Filter
                    </button>
                </div>
            </div>

            <div className="table-container glass-card">
                {loading ? (
                    <div className="table-loading">Loading data...</div>
                ) : (
                    <table className="records-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>{type === 'expenditure' || type === 'inbound' ? 'Supplier' : 'Customer'}</th>
                                <th>Amount/Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => (
                                <tr key={record.id} onClick={() => navigate(`/detail/${type}/${record.id}`)}>
                                    <td>
                                        <div className="td-date">
                                            <Calendar size={14} />
                                            {record.date}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="td-name">
                                            {record.store_name || record.customer_name || record.supplier_name || 'N/A'}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="td-amount">
                                            <CreditCard size={14} />
                                            ${Number(record.total_amount).toLocaleString()}
                                        </div>
                                    </td>
                                    <td>{getStatusBadge(record.status)}</td>
                                    <td>
                                        <button className="icon-btn-sm">
                                            <ArrowRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="empty-state">No records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
        .records-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .flex { display: flex; }
        .items-center { align-items: center; }
        .gap-2 { gap: 0.5rem; }

        .toolbar {
          display: flex;
          justify-content: space-between;
          padding: 1rem 1.5rem;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(15, 23, 42, 0.4);
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          width: 300px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .search-box input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          width: 100%;
        }

        .table-container {
          padding: 0;
          overflow: hidden;
        }

        .records-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .records-table th {
          padding: 1.25rem 1.5rem;
          background: rgba(255, 255, 255, 0.02);
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .records-table td {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          color: #f1f5f9;
          font-size: 0.9375rem;
        }

        .records-table tr {
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .records-table tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .td-date, .td-amount {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #94a3b8;
        }

        .td-name {
          font-weight: 500;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .icon-btn-sm {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
        }

        .empty-state {
          text-align: center;
          padding: 4rem;
          color: #64748b;
        }

        .table-loading {
          padding: 4rem;
          text-align: center;
          color: #94a3b8;
        }
      `}</style>
        </div>
    );
};

export default RecordsList;
