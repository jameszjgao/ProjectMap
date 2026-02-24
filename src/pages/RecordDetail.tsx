import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Save, ArrowLeft, Trash2, Plus, Edit,
  Image as ImageIcon, X, Calculator
} from 'lucide-react';
import { 
  getReceiptById, 
  getInvoiceById, 
  getInboundById, 
  getOutboundById,
  saveReceipt,
  updateReceipt,
  saveInvoice,
  saveInbound,
  saveOutbound,
  deleteReceipt,
  deleteInvoice,
  deleteInbound,
  deleteOutbound,
  getCategories,
  getPurposes,
  getAccounts
} from '../lib/shared/index';
import './RecordDetail.css';

const RecordDetail = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // 支持 /detail/:type/:id 与 /receipt-details/:id、/invoice-details/:id 等
  const typeFromPath = location.pathname.startsWith('/receipt-details')
    ? 'expenditure'
    : location.pathname.startsWith('/invoice-details')
    ? 'income'
    : location.pathname.startsWith('/inbound-details')
    ? 'inbound'
    : location.pathname.startsWith('/outbound-details')
    ? 'outbound'
    : null;
  const type = params.type || typeFromPath || 'expenditure';
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<any>({});
  const [editedRecord, setEditedRecord] = useState<any>({});
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
        // 使用共享的lib函数获取元数据，确保与移动端对齐
        const [cats, purps, accs] = await Promise.all([
          getCategories(),
          getPurposes(),
          getAccounts()
        ]);

        setCategories(cats);
        setPurposes(purps);
        setAccounts(accs);

        if (!type || !id || id === 'new') {
          setRecord({
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            items: [],
            tax: 0,
            totalAmount: 0
          });
          setLoading(false);
          return;
        }

        // 使用共享的lib函数获取记录，确保业务逻辑与移动端对齐
        let recordData: any = null;
        if (type === 'expenditure') {
          recordData = await getReceiptById(id);
        } else if (type === 'income') {
          recordData = await getInvoiceById(id);
        } else if (type === 'inbound') {
          recordData = await getInboundById(id);
        } else if (type === 'outbound') {
          recordData = await getOutboundById(id);
        }

        if (!recordData) {
          throw new Error('Record not found');
        }

        setRecord(recordData);
        setEditedRecord(recordData);
        setItems(recordData.items || []);
        setImageError(false);
        
        // 如果是新创建，自动进入编辑模式
        if (id === 'new') {
          setEditing(true);
        }

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
      const price = item.price || item.unitPrice || item.unit_price || 0;
      const quantity = item.quantity || 1;
      const amount = item.amount || (price * quantity);
      return sum + amount;
    }, 0);
    return itemsSum + (currentTax || 0);
  };

  const handleSave = async () => {
    if (!editedRecord || !id) return;
    
    setSaving(true);
    try {
      // 使用共享的lib函数保存记录，确保业务逻辑与移动端对齐
      const recordToSave = {
        ...editedRecord,
        items: items,
        id: id === 'new' ? undefined : id,
        status: 'confirmed' as const,
      };

      let savedId: string;
      if (type === 'expenditure') {
        if (id === 'new') {
          savedId = await saveReceipt(recordToSave);
        } else {
          await updateReceipt(id, recordToSave);
          savedId = id;
        }
      } else if (type === 'income') {
        savedId = await saveInvoice(recordToSave);
      } else if (type === 'inbound') {
        savedId = await saveInbound(recordToSave);
      } else if (type === 'outbound') {
        savedId = await saveOutbound(recordToSave);
      } else {
        throw new Error('Invalid record type');
      }

      setEditing(false);
      // 重新加载数据
      const recordData = id === 'new' && savedId
        ? (type === 'expenditure' ? await getReceiptById(savedId) :
           type === 'income' ? await getInvoiceById(savedId) :
           type === 'inbound' ? await getInboundById(savedId) :
           await getOutboundById(savedId))
        : recordToSave;
      setRecord(recordData);
      setEditedRecord(recordData);
      setItems(recordData.items || []);

      // 如果是新建，导航到新ID
      if (id === 'new' && savedId) {
        navigate(`/${type}/${savedId}`, { replace: true });
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedRecord(record);
    setItems(record.items || []);
  };

  const handleStartEdit = () => {
    setEditedRecord({ ...record });
    setEditing(true);
  };

  const handleDelete = async () => {
    if (!id || id === 'new') return;
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        // 使用共享的lib函数删除记录，确保业务逻辑与移动端对齐
        if (type === 'expenditure') {
          await deleteReceipt(id);
        } else if (type === 'income') {
          await deleteInvoice(id);
        } else if (type === 'inbound') {
          await deleteInbound(id);
        } else if (type === 'outbound') {
          await deleteOutbound(id);
        }
        navigate(-1);
      } catch (e) {
        console.error(e);
        alert('Failed to delete: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    }
  };

  const handleChange = (field: string, value: any) => {
    if (!editing) return;
    
    const updatedRecord = { ...editedRecord, [field]: value };

    // Auto-recalculate if tax changes
    if (field === 'tax') {
      const newTotal = calculateTotal(items, parseFloat(value) || 0);
      updatedRecord.totalAmount = newTotal;
      updatedRecord.total_amount = newTotal;
    }

    setEditedRecord(updatedRecord);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    if (!editing) return;
    
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);

    // Auto-recalculate total
    if (field === 'price' || field === 'unit_price' || field === 'unitPrice' || field === 'quantity') {
      const newTotal = calculateTotal(newItems, editedRecord.tax || 0);
      setEditedRecord((prev: any) => ({ ...prev, totalAmount: newTotal, total_amount: newTotal }));
    }
  };

  const addItem = () => {
    if (!editing) return;
    
    const newItem: any = {
      name: '',
      quantity: 1,
      price: 0,
    };
    if (type === 'expenditure' || type === 'income') {
      newItem.categoryId = categories[0]?.id;
      newItem.purposeId = purposes[0]?.id;
    }
    const newItems = [...items, newItem];
    setItems(newItems);
    const newTotal = calculateTotal(newItems, editedRecord.tax || 0);
    setEditedRecord((prev: any) => ({ ...prev, totalAmount: newTotal, total_amount: newTotal }));
  };

  const removeItem = (index: number) => {
    if (!editing) return;
    
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    const newTotal = calculateTotal(newItems, editedRecord.tax || 0);
    setEditedRecord((prev: any) => ({ ...prev, totalAmount: newTotal, total_amount: newTotal }));
  };

  if (loading) return <div className="loading-container"><div className="loader"></div></div>;

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} /> Back
        </button>
        <div className="header-actions">
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={18} /> {saving ? 'Saving...' : 'Confirm'}
              </button>
            </>
          ) : (
            <>
              {id !== 'new' && (
                <button className="btn btn-danger" onClick={handleDelete}>
                  <Trash2 size={18} /> Delete
                </button>
              )}
              <button className="btn btn-primary" onClick={handleStartEdit}>
                <Edit size={18} /> Edit
              </button>
            </>
          )}
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
            {editing ? (
              <input
                type="text"
                className="store-name-input"
                placeholder={currentConfig.entityLabel}
                value={
                  type === 'expenditure' ? (editedRecord.supplierName || editedRecord.storeName || '') :
                  type === 'income' ? (editedRecord.customerName || '') :
                  type === 'inbound' ? (editedRecord.supplierName || '') :
                  (editedRecord.customerName || '')
                }
                onChange={(e) => {
                  const field = type === 'expenditure' ? 'supplierName' :
                    type === 'income' ? 'customerName' :
                    type === 'inbound' ? 'supplierName' :
                    'customerName';
                  handleChange(field, e.target.value);
                }}
              />
            ) : (
              <div className="field-readonly">
                {type === 'expenditure' ? (record.supplierName || record.storeName || '—') :
                 type === 'income' ? (record.customerName || '—') :
                 type === 'inbound' ? (record.supplierName || '—') :
                 (record.customerName || '—')}
              </div>
            )}

            <div className="form-row">
              <div className="field-group">
                <label className="field-label">Date</label>
                {editing ? (
                  <input
                    type="date"
                    className="date-input"
                    value={editedRecord.date || ''}
                    onChange={(e) => handleChange('date', e.target.value)}
                  />
                ) : (
                  <div className="field-readonly">
                    {record.date ? new Date(record.date).toLocaleDateString() : '—'}
                  </div>
                )}
              </div>
              <div className="field-group">
                <label className="field-label">Account</label>
                {editing ? (
                  <select
                    className="select-input"
                    value={editedRecord.account_id || editedRecord.accountId || ''}
                    onChange={(e) => handleChange('account_id', e.target.value)}
                  >
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="field-readonly">
                    {accounts.find(acc => acc.id === (record.account_id || record.accountId))?.name || '—'}
                  </div>
                )}
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-item">
                <label>Tax</label>
                {editing ? (
                  <div className="input-with-prefix">
                    <span>$</span>
                    <input
                      type="number"
                      value={editedRecord.tax || 0}
                      onChange={(e) => handleChange('tax', e.target.value)}
                      className="stat-input"
                    />
                  </div>
                ) : (
                  <div className="field-readonly">
                    ${Number(record.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="stat-item total">
                <label>Total Amount</label>
                <div className="amount-display">
                  ${Number((editing ? editedRecord : record).totalAmount || (editing ? editedRecord : record).total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
        {editing && (
          <button className="btn btn-secondary add-item-btn" onClick={addItem}>
            <Plus size={18} /> Add Item
          </button>
        )}
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Item Name</th>
              {(type === 'expenditure' || type === 'income') && (
                <>
                  <th style={{ width: '20%' }}>Category</th>
                  <th style={{ width: '20%' }}>Purpose</th>
                </>
              )}
              {(type === 'inbound' || type === 'outbound') && (
                <th style={{ width: '40%' }} colSpan={2}>Product / SKU</th>
              )}
              <th style={{ width: '10%', textAlign: 'right' }}>Qty</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Price</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  {editing ? (
                    <input
                      type="text"
                      className="item-name-input"
                      value={item.name || item.productName || item.product_name || ''}
                      onChange={(e) => {
                        const field = item.name !== undefined ? 'name' : 
                          item.productName !== undefined ? 'productName' : 'product_name';
                        handleItemChange(idx, field, e.target.value);
                      }}
                      placeholder="Item name"
                    />
                  ) : (
                    <span>{item.name || item.productName || item.product_name || '—'}</span>
                  )}
                </td>
                {(type === 'expenditure' || type === 'income') && (
                  <>
                    <td>
                      {editing ? (
                        <select
                          className="table-select"
                          value={item.categoryId || item.category_id || ''}
                          onChange={(e) => handleItemChange(idx, 'categoryId', e.target.value)}
                        >
                          <option value="">Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{categories.find(c => c.id === (item.categoryId || item.category_id))?.name || '—'}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <select
                          className="table-select"
                          value={item.purposeId || item.purpose_id || ''}
                          onChange={(e) => handleItemChange(idx, 'purposeId', e.target.value)}
                        >
                          <option value="">Purpose</option>
                          {purposes.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{purposes.find(p => p.id === (item.purposeId || item.purpose_id))?.name || '—'}</span>
                      )}
                    </td>
                  </>
                )}
                {type === 'inbound' && (
                  <>
                    <td colSpan={2}>
                      {editing ? (
                        <input
                          type="text"
                          className="item-name-input"
                          placeholder="SKU / Product"
                          value={item.productName || item.product_name || ''}
                          onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                        />
                      ) : (
                        <span>{item.productName || item.product_name || '—'}</span>
                      )}
                    </td>
                  </>
                )}
                {type === 'outbound' && (
                  <>
                    <td colSpan={2}>
                      {editing ? (
                        <input
                          type="text"
                          className="item-name-input"
                          placeholder="SKU / Product"
                          value={item.productName || ''}
                          onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                        />
                      ) : (
                        <span>{item.productName || '—'}</span>
                      )}
                    </td>
                  </>
                )}
                <td style={{ textAlign: 'right' }}>
                  {editing ? (
                    <input
                      type="number"
                      className="qty-input"
                      value={item.quantity || 1}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                    />
                  ) : (
                    <span>{item.quantity || 1}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {editing ? (
                    <input
                      type="number"
                      className="price-input"
                      value={item.price || item.unitPrice || item.unit_price || 0}
                      onChange={(e) => {
                        const field = item.price !== undefined ? 'price' : 
                          item.unitPrice !== undefined ? 'unitPrice' : 'unit_price';
                        handleItemChange(idx, field, parseFloat(e.target.value));
                      }}
                    />
                  ) : (
                    <span>${Number(item.price || item.unitPrice || item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {editing && (
                    <button className="delete-item-btn" onClick={() => removeItem(idx)}>
                      <X size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecordDetail;
