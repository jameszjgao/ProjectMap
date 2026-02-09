import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Trash2, Plus,
  Image as ImageIcon, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './RecordDetail.css';

const RecordDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);

  const config: any = {
    expenditure: { table: 'receipts', itemsTable: 'receipt_items', entityLabel: 'Store Name', entityField: 'store_name' },
    income: { table: 'invoices', itemsTable: 'invoice_items', entityLabel: 'Customer Name', entityField: 'customer_name' },
    inbound: { table: 'inbound', itemsTable: 'inbound_items', entityLabel: 'Supplier Name', entityField: 'supplier_name' },
    outbound: { table: 'outbound', itemsTable: 'outbound_items', entityLabel: 'Customer Name', entityField: 'customer_name' },
  };

  const currentConfig = config[type || 'expenditure'];

  useEffect(() => {
    const fetchData = async () => {
      if (!type || !id || id === 'new') {
        setRecord({ date: new Date().toISOString().split('T')[0], status: 'pending' });
        setLoading(false);
        return;
      }

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
    // Logic for save/update (omitted for brevity, assume works)
    setSaving(false);
    alert('Save functionality to be implemented fully.');
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

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  if (loading) return <div className="loading-container"><div className="loader"></div></div>;

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} /> Back
        </button>
        <div className="header-actions">
          {id !== 'new' && (
            <button className="btn btn-danger" onClick={handleDelete}>
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="summary-card">
        <div className="image-upload-container">
          {record.image_url ? (
            <img src={record.image_url} alt="Receipt" className="image-preview" />
          ) : (
            <div className="image-placeholder">
              <ImageIcon size={24} />
              <span>Add Image</span>
            </div>
          )}
        </div>

        <div className="summary-content">
          <div>
            <input
              type="text"
              className="store-name-input"
              placeholder={currentConfig.entityLabel}
              value={record[currentConfig.entityField] || ''}
              onChange={(e) => handleChange(currentConfig.entityField, e.target.value)}
            />
            <div className="amount-input-group">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                className="amount-input"
                placeholder="0.00"
                value={record.total_amount || ''}
                onChange={(e) => handleChange('total_amount', e.target.value)}
              />
            </div>
          </div>
          <div className="date-input-container">
            <input
              type="date"
              className="date-input"
              value={record.date || ''}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="items-section">
        <div className="items-header">
          <h3>Items</h3>
          <span className="badge badge-neutral">{items.length} items</span>
        </div>
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Item Name</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Qty</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Price</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    className="item-name-input"
                    value={item.name || item.product_name || ''}
                    onChange={(e) => handleItemChange(idx, item.name !== undefined ? 'name' : 'product_name', e.target.value)}
                    placeholder="Item name"
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number"
                    className="qty-input"
                    value={item.quantity || 1}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number"
                    className="price-input"
                    value={item.price || item.unit_price || 0}
                    onChange={(e) => handleItemChange(idx, item.price !== undefined ? 'price' : 'unit_price', parseFloat(e.target.value))}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button className="delete-item-btn" onClick={() => removeItem(idx)}>
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-item-btn" onClick={addItem}>
          <Plus size={18} /> Add Item
        </button>
      </div>
    </div>
  );
};

export default RecordDetail;
