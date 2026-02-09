import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, ArrowLeft, Trash2, Calendar,
    DollarSign, User, FileText, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const RecordDetail = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [record, setRecord] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);

    const config: any = {
        expenditure: { table: 'receipts', itemsTable: 'receipt_items', entityLabel: 'Store/Supplier', entityField: 'store_name' },
        income: { table: 'invoices', itemsTable: 'invoice_items', entityLabel: 'Customer', entityField: 'customer_name' },
        inbound: { table: 'inbound', itemsTable: 'inbound_items', entityLabel: 'Supplier', entityField: 'supplier_name' },
        outbound: { table: 'outbound', itemsTable: 'outbound_items', entityLabel: 'Customer', entityField: 'customer_name' },
    };

    const currentConfig = config[type || 'expenditure'];

    useEffect(() => {
        const fetchData = async () => {
            if (!type || !id) return;

            const { data: recordData, error } = await supabase
                .from(currentConfig.table)
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching record:', error);
                return;
            }

            setRecord(recordData);

            // Fetch items if applicable
            const { data: itemsData } = await supabase
                .from(currentConfig.itemsTable)
                .select('*')
                .eq(type === 'expenditure' ? 'receipt_id' : type === 'income' ? 'invoice_id' : type === 'inbound' ? 'inbound_id' : 'outbound_id', id);

            if (itemsData) setItems(itemsData);

            setLoading(false);
        };

        fetchData();
    }, [type, id]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from(currentConfig.table)
            .update(record)
            .eq('id', id);

        setSaving(false);
        if (!error) {
            alert('Record updated successfully');
        } else {
            alert('Error updating record');
        }
    };

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this record?')) {
            await supabase.from(currentConfig.table).delete().eq('id', id);
            navigate(-1);
        }
    };

    const handleChange = (field: string, value: any) => {
        setRecord({ ...record, [field]: value });
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading details...</div>;

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="header-actions">
                    <button className="btn-danger" onClick={handleDelete}>
                        <Trash2 size={18} /> Delete
                    </button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="detail-content">
                <div className="form-section glass-card">
                    <h2>General Information</h2>
                    <div className="form-grid">
                        <div className="form-group">
                            <label><Calendar size={16} /> Date</label>
                            <input
                                type="date"
                                value={record.date || ''}
                                onChange={(e) => handleChange('date', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label><User size={16} /> {currentConfig.entityLabel}</label>
                            <input
                                type="text"
                                value={record[currentConfig.entityField] || ''}
                                onChange={(e) => handleChange(currentConfig.entityField, e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label><DollarSign size={16} /> Total Amount</label>
                            <input
                                type="number"
                                value={record.total_amount || 0}
                                onChange={(e) => handleChange('total_amount', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label><FileText size={16} /> Status</label>
                            <select
                                value={record.status || 'pending'}
                                onChange={(e) => handleChange('status', e.target.value)}
                            >
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="image-section glass-card">
                    <h2><ImageIcon size={20} /> Receipt Image</h2>
                    {record.image_url ? (
                        <div className="image-preview">
                            <img src={record.image_url} alt="Receipt" />
                        </div>
                    ) : (
                        <div className="no-image">
                            <ImageIcon size={48} />
                            <p>No image attached</p>
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="items-section glass-card">
                        <h2>Line Items ({items.length})</h2>
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td>{item.name || item.product_name}</td>
                                        <td>{item.quantity || 1}</td>
                                        <td>{item.price || item.unit_price}</td>
                                        <td>{((item.quantity || 1) * (item.price || item.unit_price || 0)).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
        .detail-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 4rem;
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 500;
          transition: color 0.2s;
        }

        .back-btn:hover {
          color: white;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .detail-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        .form-section {
          grid-column: 1 / -1;
        }

        @media (min-width: 1024px) {
          .detail-content {
            grid-template-columns: 2fr 1fr;
          }
          .form-section {
            grid-column: span 1;
          }
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #94a3b8;
          font-size: 0.875rem;
        }

        .form-group input, .form-group select {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.75rem;
          border-radius: 0.75rem;
          color: white;
          outline: none;
        }

        .form-group input:focus, .form-group select:focus {
          border-color: #6366f1;
          background: rgba(15, 23, 42, 0.8);
        }

        .image-preview img {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .no-image {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #64748b;
          border: 2px dashed rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
        }

        .items-section {
          grid-column: 1 / -1;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }

        .items-table th {
          text-align: left;
          padding: 1rem;
          color: #94a3b8;
          font-size: 0.875rem;
          background: rgba(255, 255, 255, 0.02);
        }

        .items-table td {
          padding: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          color: #f1f5f9;
        }
      `}</style>
        </div>
    );
};

export default RecordDetail;
