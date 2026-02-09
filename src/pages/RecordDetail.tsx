import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, ArrowLeft, Trash2, Plus,
  Image as ImageIcon, X, Calculator
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
  const [imageError, setImageError] = useState(false);

  // Metadata state
  const [categories, setCategories] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const config: any = {
    expenditure: { table: 'receipts', itemsTable: 'receipt_items', entityLabel: 'Store Name', entityField: 'store_name' },
    income: { table: 'invoices', itemsTable: 'invoice_items', entityLabel: 'Customer Name', entityField: 'customer_name' },
    inbound: { table: 'inbound', itemsTable: 'inbound_items', entityLabel: 'Supplier Name', entityField: 'supplier_name' },
    outbound: { table: 'outbound', itemsTable: 'outbound_items', entityLabel: 'Customer Name', entityField: 'customer_name' },
  };

  const currentConfig = config[type || 'expenditure'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch metadata in parallel
        const [cats, purps, accs] = await Promise.all([
          supabase.from('categories').select('*'),
          supabase.from('purposes').select('*'),
          supabase.from('accounts').select('*')
        ]);

        if (cats.data) setCategories(cats.data);
        if (purps.data) setPurposes(purps.data);
        if (accs.data) setAccounts(accs.data);

        if (!type || !id || id === 'new') {
          setRecord({
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            items: [],
            tax: 0,
            total_amount: 0
          });
          setLoading(false);
          return;
        }

        const { data: recordData, error } = await supabase
          .from(currentConfig.table)
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setRecord(recordData);
        setImageError(false); // 重置图片错误状态

        // Fetch items
        // Depending on table, the foreign key might differ clearly
        const foreignKey = type === 'expenditure' ? 'receipt_id' :
          type === 'income' ? 'invoice_id' :
            type === 'inbound' ? 'inbound_id' : 'outbound_id';

        const { data: itemsData } = await supabase
          .from(currentConfig.itemsTable)
          .select('*')
          .eq(foreignKey, id);

        if (itemsData) setItems(itemsData);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type, id]);

  const calculateTotal = (currentItems: any[], currentTax: number) => {
    const itemsSum = currentItems.reduce((sum, item) => {
      const price = item.price || item.unit_price || 0;
      return sum + (price * (item.quantity || 1));
    }, 0);
    return itemsSum + (currentTax || 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update main record
      const { error: mainError } = await supabase
        .from(currentConfig.table)
        .upsert({ ...record, id: id === 'new' ? undefined : id }); // Handle new vs update

      if (mainError) throw mainError;

      // For items, simplistic approach: delete all and insert all (or intelligent merge)
      // Here we just alerting as real implementation needs care with IDs
      alert('Main record saved. Item syncing logic to be refined.');
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this record?')) {
      await supabase.from(currentConfig.table).delete().eq('id', id);
      navigate(-1);
    }
  };

  const handleChange = (field: string, value: any) => {
    const updatedRecord = { ...record, [field]: value };

    // Auto-recalculate if tax changes
    if (field === 'tax') {
      const newTotal = calculateTotal(items, parseFloat(value) || 0);
      updatedRecord.total_amount = newTotal;
    }

    setRecord(updatedRecord);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);

    // Auto-recalculate total
    if (field === 'price' || field === 'unit_price' || field === 'quantity') {
      const newTotal = calculateTotal(newItems, record.tax || 0);
      setRecord((prev: any) => ({ ...prev, total_amount: newTotal }));
    }
  };

  const addItem = () => {
    const newItem = {
      name: '',
      quantity: 1,
      price: 0,
      category_id: categories[0]?.id,
      purpose_id: purposes[0]?.id
    };
    const newItems = [...items, newItem];
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    const newTotal = calculateTotal(newItems, record.tax || 0);
    setRecord((prev: any) => ({ ...prev, total_amount: newTotal }));
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
          {record.image_url && !imageError ? (
            <img
              src={record.image_url}
              alt="Receipt"
              className="image-preview"
              loading="lazy"
              onError={() => setImageError(true)}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          ) : (
            <div className="image-placeholder">
              <ImageIcon size={24} />
              <span>Add Image</span>
            </div>
          )}
        </div>

        <div className="summary-content">
          <div>
            <label className="field-label">Store / Supplier</label>
            <input
              type="text"
              className="store-name-input"
              placeholder={currentConfig.entityLabel}
              value={record[currentConfig.entityField] || ''}
              onChange={(e) => handleChange(currentConfig.entityField, e.target.value)}
            />

            <div className="form-row">
              <div className="field-group">
                <label className="field-label">Date</label>
                <input
                  type="date"
                  className="date-input"
                  value={record.date || ''}
                  onChange={(e) => handleChange('date', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Account</label>
                <select
                  className="select-input"
                  value={record.account_id || ''}
                  onChange={(e) => handleChange('account_id', e.target.value)}
                >
                  <option value="">Select Account</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-item">
                <label>Tax</label>
                <div className="input-with-prefix">
                  <span>$</span>
                  <input
                    type="number"
                    value={record.tax || 0}
                    onChange={(e) => handleChange('tax', e.target.value)}
                    className="stat-input"
                  />
                </div>
              </div>
              <div className="stat-item total">
                <label>Total Amount</label>
                <div className="amount-display">
                  ${Number(record.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
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
              <th style={{ width: '30%' }}>Item Name</th>
              <th style={{ width: '20%' }}>Category</th>
              <th style={{ width: '20%' }}>Purpose</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Price</th>
              <th style={{ width: '5%' }}></th>
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
                <td>
                  <select
                    className="table-select"
                    value={item.category_id || ''}
                    onChange={(e) => handleItemChange(idx, 'category_id', e.target.value)}
                  >
                    <option value="">Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="table-select"
                    value={item.purpose_id || ''}
                    onChange={(e) => handleItemChange(idx, 'purpose_id', e.target.value)}
                  >
                    <option value="">Purpose</option>
                    {purposes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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
