/**
 * Manage Suppliers - 与移动端 app/suppliers-manage.tsx 一一对应，复用 shared lib
 * 包含完整的merge功能：merge模式、选择、merge历史、使用统计、展开/折叠、Quick Clean、重复名称处理等
 * 注意：SuppliersManage需要处理supplier和customer两种来源
 */
import { useState, useEffect, useRef } from 'react';
import {
  getSupplierListForManage,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  mergeSupplier,
  unmergeSupplier,
  getSuppliersForMergeHistory,
  getSupplierUsageCounts,
  updateCustomer,
  mergeCustomer,
  type SuppliersMergeHistoryData,
  type SupplierUsageCounts,
  type SupplierListItem,
} from '../lib/shared/index';
import { Supplier } from '../types';
import './ManageList.css';
import './AccountsManage.css'; // 复用AccountsManage的样式

export default function SuppliersManage() {
  const [list, setList] = useState<SupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<'supplier' | 'customer'>('supplier');
  const [editName, setEditName] = useState('');
  const [editTaxNumber, setEditTaxNumber] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editIsCustomer, setEditIsCustomer] = useState(false);
  const [editIsSupplier, setEditIsSupplier] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTaxNumber, setNewTaxNumber] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newIsCustomer, setNewIsCustomer] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [mergeHistoryData, setMergeHistoryData] = useState<SuppliersMergeHistoryData | null>(null);
  const [usageCounts, setUsageCounts] = useState<SupplierUsageCounts | null>(null);
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(new Set());
  const [showDuplicateNameModal, setShowDuplicateNameModal] = useState(false);
  const [duplicateNameModalPayload, setDuplicateNameModalPayload] = useState<{
    code: string;
    duplicateName: string;
    targetId?: string;
    targetSource?: 'supplier' | 'customer';
    editingId: string;
    editingSource: 'supplier' | 'customer';
  } | null>(null);
  const [showQuickCleanModal, setShowQuickCleanModal] = useState(false);
  const [showMergeTargetModal, setShowMergeTargetModal] = useState(false);
  const [mergeTargetModalSuppliers, setMergeTargetModalSuppliers] = useState<Supplier[] | null>(null);
  const [mergeTargetSelectedId, setMergeTargetSelectedId] = useState<string | null>(null);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [deleteSelectedModalSuppliers, setDeleteSelectedModalSuppliers] = useState<Supplier[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, duration: number = 1500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, duration);
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadList = async () => {
    try {
      setLoading(true);
      const [data, counts] = await Promise.all([
        getSupplierListForManage(),
        getSupplierUsageCounts(),
      ]);
      const sorted = [...data].sort((a, b) => {
        const ua = a.source === 'supplier' ? (counts.receiptCountBySupplierId[a.id] ?? 0) : 0;
        const ub = b.source === 'supplier' ? (counts.receiptCountBySupplierId[b.id] ?? 0) : 0;
        if (ub !== ua) return ub - ua;
        return a.name.localeCompare(b.name);
      });
      setList(sorted);
    } catch (error) {
      console.error('Error loading supplier list:', error);
      showToast('Failed to load list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!newName.trim()) {
      showToast('Please enter supplier name');
      return;
    }

    try {
      const newSupplier = await createSupplier(
        newName.trim(),
        false,
        newTaxNumber.trim() || undefined,
        newPhone.trim() || undefined,
        newAddress.trim() || undefined,
        newIsCustomer
      );
      setList(prev => [...prev, { ...newSupplier, source: 'supplier' as const }]);
      setNewName('');
      setNewTaxNumber('');
      setNewPhone('');
      setNewAddress('');
      setNewIsCustomer(false);
      setShowAddForm(false);
      showToast('Supplier created');
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      showToast(error.message || 'Failed to create supplier');
      loadList();
    }
  };

  const handleUpdate = async (id: string, source: 'supplier' | 'customer') => {
    if (!editName.trim()) {
      showToast('Please enter name');
      return;
    }
    try {
      if (source === 'supplier') {
        await updateSupplier(id, {
          name: editName.trim(),
          taxNumber: editTaxNumber.trim() || undefined,
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          isCustomer: editIsCustomer,
        });
      } else {
        await updateCustomer(id, {
          name: editName.trim(),
          taxNumber: editTaxNumber.trim() || undefined,
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          isSupplier: editIsSupplier,
        });
      }
      await loadList();
      setEditingId(null);
      setEditName('');
      setEditTaxNumber('');
      setEditPhone('');
      setEditAddress('');
      setEditIsCustomer(false);
      setEditIsSupplier(false);
    } catch (error: any) {
      const code = error?.code;
      const targetId = error?.targetId as string | undefined;
      const targetSource = error?.targetSource as 'supplier' | 'customer' | undefined;
      if (code === 'SUPPLIER_NAME_EXISTS' || code === 'CUSTOMER_NAME_EXISTS') {
        setDuplicateNameModalPayload({
          code,
          duplicateName: (error?.duplicateName ?? editName) || '',
          targetId,
          targetSource,
          editingId: id,
          editingSource: source,
        });
        setShowDuplicateNameModal(true);
        return;
      }
      console.error('Error updating:', error);
      showToast(error.message || 'Failed to update');
      loadList();
    }
  };

  const handleDuplicateNameCloseOnly = () => {
    setShowDuplicateNameModal(false);
    setDuplicateNameModalPayload(null);
  };

  const handleDuplicateNameKeepEditing = () => {
    setShowDuplicateNameModal(false);
    setDuplicateNameModalPayload(null);
  };

  const handleDuplicateNameDontChange = () => {
    setShowDuplicateNameModal(false);
    setDuplicateNameModalPayload(null);
    setEditingId(null);
    setEditName('');
    setEditTaxNumber('');
    setEditPhone('');
    setEditAddress('');
    setEditIsCustomer(false);
    setEditIsSupplier(false);
  };

  const handleDuplicateNameMerge = async () => {
    const payload = duplicateNameModalPayload;
    if (!payload?.targetId || payload.targetSource == null) {
      setShowDuplicateNameModal(false);
      setDuplicateNameModalPayload(null);
      showToast('Cannot merge: target not found.');
      return;
    }
    if (payload.editingSource !== payload.targetSource) {
      setShowDuplicateNameModal(false);
      setDuplicateNameModalPayload(null);
      showToast('Current and target types differ. Cannot merge.');
      return;
    }
    setShowDuplicateNameModal(false);
    setDuplicateNameModalPayload(null);
    try {
      if (payload.editingSource === 'supplier') {
        await mergeSupplier([payload.editingId], payload.targetId);
      } else {
        await mergeCustomer([payload.editingId], payload.targetId);
      }
      setEditingId(null);
      setEditName('');
      setEditTaxNumber('');
      setEditPhone('');
      setEditAddress('');
      setEditIsCustomer(false);
      setEditIsSupplier(false);
      loadList();
    } catch (e: any) {
      showToast(e?.message ?? 'Merge failed');
      loadList();
    }
  };

  const handleDelete = async (item: SupplierListItem) => {
    if (item.source === 'supplier') {
      if (!window.confirm(`Delete "${item.name}"?`)) return;
      try {
        await deleteSupplier(item.id);
        setList(prev => prev.filter(it => !(it.id === item.id && it.source === 'supplier')));
        showToast('Supplier deleted');
      } catch (e: any) {
        showToast(e.message || 'Failed to delete');
        loadList();
      }
    } else {
      if (!window.confirm(`Unmark "${item.name}" as supplier? It will stay in customer list.`)) return;
      try {
        await updateCustomer(item.id, { isSupplier: false });
        setList(prev => prev.filter(it => !(it.id === item.id && it.source === 'customer')));
        showToast('Removed from supplier list');
      } catch (e: any) {
        showToast(e.message || 'Failed');
        loadList();
      }
    }
  };

  const startEdit = (item: SupplierListItem) => {
    setEditingId(item.id);
    setEditingSource(item.source);
    setEditName(item.name);
    setEditTaxNumber(item.taxNumber || '');
    setEditPhone(item.phone || '');
    setEditAddress(item.address || '');
    setEditIsCustomer(item.source === 'supplier' ? (item.isCustomer ?? false) : false);
    setEditIsSupplier(item.source === 'customer' ? (item.isSupplier ?? false) : false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditTaxNumber('');
    setEditPhone('');
    setEditAddress('');
    setEditIsCustomer(false);
    setEditIsSupplier(false);
  };

  const toggleSupplierSelection = (supplierId: string) => {
    const newSelected = new Set(selectedSupplierIds);
    if (newSelected.has(supplierId)) {
      newSelected.delete(supplierId);
    } else {
      newSelected.add(supplierId);
    }
    setSelectedSupplierIds(newSelected);
  };

  const handleStartMerge = async () => {
    setMergeMode(true);
    setSelectedSupplierIds(new Set());
    setEditingId(null);
    setShowAddForm(false);
    setExpandedRootIds(new Set());
    try {
      const [historyData, counts] = await Promise.all([
        getSuppliersForMergeHistory(),
        getSupplierUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
    } catch (e: any) {
      console.error('Error loading merge data:', e);
      showToast(e?.message ?? 'Failed to load merge data');
    }
  };

  const handleCancelMerge = () => {
    setMergeMode(false);
    setSelectedSupplierIds(new Set());
    setMergeHistoryData(null);
    setUsageCounts(null);
    setExpandedRootIds(new Set());
    loadList();
  };

  const directReceipts = (id: string) => usageCounts?.receiptCountBySupplierId[id] ?? 0;
  const totalCount = (root: Supplier, children: Supplier[]) =>
    directReceipts(root.id) + children.reduce((s, c) => s + directReceipts(c.id), 0);
  const directCount = (id: string) => directReceipts(id);

  /** 与非 merge 列表一致：按直接用量降序、名称升序 */
  const sortedMergeRoots = (() => {
    if (!mergeHistoryData || !usageCounts) return [];
    return [...mergeHistoryData.roots].sort((a, b) => {
      const ua = directReceipts(a.id);
      const ub = directReceipts(b.id);
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
  })();
  /** merge 下先同步切 UI，无数据时用当前 list 当 roots，数据到达后刷新数字与展开 */
  const mergeDisplayRoots = mergeHistoryData ? sortedMergeRoots : list.filter(item => item.source === 'supplier') as Supplier[];

  const cleanableRoots = (() => {
    if (!mergeHistoryData || !usageCounts) return [];
    return mergeHistoryData.roots.filter((root) => {
      const children = mergeHistoryData.childrenByRootId.get(root.id) ?? [];
      const hasUsage = directReceipts(root.id) > 0;
      const hasChildUsage = children.some((c) => directReceipts(c.id) > 0);
      const hasChildren = children.length > 0;
      return !hasUsage && !hasChildUsage && !hasChildren;
    });
  })();

  const handleCleanEmpty = () => {
    if (cleanableRoots.length === 0) {
      showToast('No empty suppliers to clean.');
      return;
    }
    setShowQuickCleanModal(true);
  };

  const doQuickCleanConfirm = async () => {
    if (cleanableRoots.length === 0) return;
    setShowQuickCleanModal(false);
    try {
      for (const root of cleanableRoots) {
        await deleteSupplier(root.id);
      }
      await loadList();
      const [historyData, counts] = await Promise.all([
        getSuppliersForMergeHistory(),
        getSupplierUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      showToast(`Cleaned ${cleanableRoots.length} empty supplier(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to clean');
    }
  };

  const setMergeTargetSelection = (supplierId: string) => setMergeTargetSelectedId(supplierId);
  const confirmMergeTarget = () => {
    if (!mergeTargetSelectedId) return;
    const sourceIds = Array.from(selectedSupplierIds).filter((id) => id !== mergeTargetSelectedId);
    setShowMergeTargetModal(false);
    setMergeTargetModalSuppliers(null);
    setMergeTargetSelectedId(null);
    performMerge(sourceIds, mergeTargetSelectedId);
  };

  const handleConfirmMerge = () => {
    if (selectedSupplierIds.size < 2) {
      showToast('Please select at least 2 suppliers to merge');
      return;
    }
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((s) => selectedSupplierIds.has(s.id));
    setMergeTargetModalSuppliers(selected);
    setMergeTargetSelectedId(null);
    setShowMergeTargetModal(true);
  };

  const performMerge = async (sourceSupplierIds: string[], targetSupplierId: string) => {
    try {
      await mergeSupplier(sourceSupplierIds, targetSupplierId);
      await loadList();
      const [historyData, counts] = await Promise.all([
        getSuppliersForMergeHistory(),
        getSupplierUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSupplierIds(new Set());
      setExpandedRootIds(new Set());
      showToast('Suppliers merged successfully');
    } catch (error: any) {
      console.error('Error merging suppliers:', error);
      showToast(error.message || 'Failed to merge suppliers');
    }
  };

  const handleUnmerge = async (childId: string) => {
    try {
      await unmergeSupplier(childId);
      await loadList();
      const [historyData, counts] = await Promise.all([
        getSuppliersForMergeHistory(),
        getSupplierUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSupplierIds((prev) => {
        const next = new Set(prev);
        next.delete(childId);
        return next;
      });
      showToast('Unmerged');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to unmerge');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedSupplierIds.size === 0) return;
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((s) => selectedSupplierIds.has(s.id));
    setDeleteSelectedModalSuppliers(selected);
    setShowDeleteSelectedModal(true);
  };

  const doDeleteSelectedConfirm = async () => {
    const selected = deleteSelectedModalSuppliers;
    setShowDeleteSelectedModal(false);
    setDeleteSelectedModalSuppliers(null);
    if (!selected || selected.length === 0) return;
    try {
      for (const s of selected) {
        await deleteSupplier(s.id);
      }
      await loadList();
      const [historyData, counts] = await Promise.all([
        getSuppliersForMergeHistory(),
        getSupplierUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSupplierIds(new Set());
      showToast(`Deleted ${selected.length} supplier(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete');
    }
  };

  const toggleExpand = (rootId: string) => {
    setExpandedRootIds((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="page-common manage-list-page">
        <div className="manage-list-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-common manage-list-page">
      {toastMessage && (
        <div className="toast-wrapper">
          <div className="toast">{toastMessage}</div>
        </div>
      )}

      {/* Duplicate Name Modal */}
      {showDuplicateNameModal && (
        <div className="modal-overlay" onClick={handleDuplicateNameCloseOnly}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🏪</div>
              <h3>Duplicate {duplicateNameModalPayload?.editingSource === 'supplier' ? 'supplier' : 'customer'} name:</h3>
            </div>
            <div className="modal-message-block">
              <div className="duplicate-name-container">
                <span className="duplicate-name-text">{duplicateNameModalPayload?.duplicateName || '—'}</span>
              </div>
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={handleDuplicateNameKeepEditing}>
                Keep editing
              </button>
              <button className="btn btn-warning" onClick={handleDuplicateNameMerge}>
                Merge into existing
              </button>
              <button className="btn btn-secondary" onClick={handleDuplicateNameDontChange}>
                Do not modify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Clean Modal */}
      {showQuickCleanModal && (
        <div className="modal-overlay" onClick={() => setShowQuickCleanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Quick Clean</h3>
              <p>Delete {cleanableRoots.length} empty supplier(s):</p>
              <p className="modal-subtitle">(no linked data, not merged)</p>
            </div>
            <div className="modal-list">
              {cleanableRoots.map((r) => (
                <div key={r.id} className="modal-list-item">
                  <span>{r.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => setShowQuickCleanModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={doQuickCleanConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Target Modal */}
      {showMergeTargetModal && (
        <div className="modal-overlay" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalSuppliers(null); setMergeTargetSelectedId(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🔀</div>
              <h3>Choose which supplier to keep,</h3>
              <p>Others will be merged into it.</p>
            </div>
            <div className="modal-list">
              {(mergeTargetModalSuppliers ?? []).map((s) => (
                <div
                  key={s.id}
                  className={`modal-list-item-tappable ${mergeTargetSelectedId === s.id ? 'selected' : ''}`}
                  onClick={() => setMergeTargetSelection(s.id)}
                >
                  <span>{s.name}</span>
                  {mergeTargetSelectedId === s.id ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="circle-icon">○</span>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalSuppliers(null); setMergeTargetSelectedId(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmMergeTarget} disabled={!mergeTargetSelectedId}>
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Modal */}
      {showDeleteSelectedModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalSuppliers(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Delete {deleteSelectedModalSuppliers?.length ?? 0} selected supplier(s)?</h3>
            </div>
            <div className="modal-list">
              {(deleteSelectedModalSuppliers ?? []).map((s) => (
                <div key={s.id} className="modal-list-item">
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalSuppliers(null); }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={doDeleteSelectedConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {mergeMode ? (
        <div className="manage-list-header merge-header">
          <div className="merge-header-text">
            Select two or more, then choose which to keep, others will be merged into it.
          </div>
          <div className="header-table-row">
            <div className="checkbox-container" />
            <div className="header-table-row-name-cell">
              <span>Supplier</span>
              <span className="header-selected-count">
                （{selectedSupplierIds.size}/{mergeHistoryData ? mergeHistoryData.roots.length : mergeDisplayRoots.length}）
              </span>
            </div>
            <div className="counts-cell">
              <span>Records</span>
            </div>
            <div className="expand-placeholder-small" />
          </div>
        </div>
      ) : (
        <div className="manage-list-header">
          <h1>Suppliers for receipts and inbound, AI-recognized and collected.</h1>
        </div>
      )}

      {/* Suppliers List */}
      <div className="manage-list-content">
        {mergeMode ? (
          // Merge Mode: 显示复选框列表，支持展开/折叠
          mergeDisplayRoots.map((root) => {
            const children = mergeHistoryData?.childrenByRootId?.get(root.id) ?? [];
            const expanded = expandedRootIds.has(root.id);
            const hasChildren = children.length > 0;
            return (
              <div key={root.id} className="account-card">
                <div
                  className={`account-row ${selectedSupplierIds.has(root.id) ? 'selected' : ''}`}
                >
                  <div
                    className="merge-row-selection-area"
                    onClick={() => toggleSupplierSelection(root.id)}
                  >
                    <div className="checkbox-container">
                      {selectedSupplierIds.has(root.id) ? (
                        <span className="checkbox-checked">✓</span>
                      ) : (
                        <span className="checkbox-unchecked">○</span>
                      )}
                    </div>
                    <span className="account-name">{root.name}</span>
                    <div className="counts-cell">
                      <span>{usageCounts ? (expanded ? directCount(root.id) : totalCount(root, children)) : '0'}</span>
                    </div>
                  </div>
                  {hasChildren ? (
                    <button
                      className="expand-button-small"
                      onClick={() => toggleExpand(root.id)}
                    >
                      {expanded ? '▼' : '▶'}
                    </button>
                  ) : (
                    <div className="expand-placeholder-small" />
                  )}
                </div>
                {expanded &&
                  children.map((child) => (
                    <div
                      key={child.id}
                      className={`child-row ${selectedSupplierIds.has(child.id) ? 'selected' : ''}`}
                    >
                      <div
                        className="merge-row-selection-area"
                        onClick={() => toggleSupplierSelection(child.id)}
                      >
                        <div className="checkbox-container">
                          {selectedSupplierIds.has(child.id) ? (
                            <span className="checkbox-checked">✓</span>
                          ) : (
                            <span className="checkbox-unchecked">○</span>
                          )}
                        </div>
                        <span className="child-name">{child.name}</span>
                        <div className="counts-cell">
                          <span>{usageCounts ? directCount(child.id) : '0'}</span>
                        </div>
                      </div>
                      {mergeHistoryData && (
                        <button
                          className="child-row-unmerge-button"
                          onClick={() => handleUnmerge(child.id)}
                        >
                          Unmerge
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            );
          })
        ) : (
          // Normal Mode: Show regular supplier list
          list.map((item) => (
            <div key={`${item.source}-${item.id}`} className="manage-list-li">
              {editingId === item.id && editingSource === item.source ? (
                // Edit Mode
                <div className="edit-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.875rem', color: '#6C5CE7', fontWeight: 600 }}>
                      {editingSource === 'supplier' ? '🏪 Supplier' : '👤 Customer'}
                    </span>
                    {editingSource === 'supplier' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editIsCustomer} onChange={(e) => setEditIsCustomer(e.target.checked)} />
                        <span>Also a customer</span>
                      </label>
                    ) : (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editIsSupplier} onChange={(e) => setEditIsSupplier(e.target.checked)} />
                        <span>Also a supplier</span>
                      </label>
                    )}
                  </div>
                  <input
                    className="manage-list-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={editingSource === 'supplier' ? 'Supplier name *' : 'Customer name *'}
                  />
                  <input
                    className="manage-list-input"
                    value={editTaxNumber}
                    onChange={(e) => setEditTaxNumber(e.target.value)}
                    placeholder="Tax number (optional)"
                  />
                  <input
                    className="manage-list-input"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    type="tel"
                  />
                  <textarea
                    className="manage-list-input"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Address (optional)"
                    rows={2}
                  />
                  <div className="edit-row-buttons">
                    <button className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => handleUpdate(item.id, item.source)}>
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="account-row-display">
                  <div className="account-indicator">
                    <span>{item.source === 'supplier' ? '🏪' : '👤'}</span>
                    {'isAiRecognized' in item && item.isAiRecognized && (
                      <span className="ai-badge">AI</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="manage-list-item-name">{item.name}</span>
                    {item.source === 'supplier' && item.isCustomer && (
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6C5CE7' }}>👤</span>
                    )}
                    {item.source === 'customer' && (
                      <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6C5CE7' }}>🏪</span>
                    )}
                  </div>
                  <div className="account-actions">
                    <button className="btn btn-icon" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button className="btn btn-icon danger" onClick={() => handleDelete(item)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Add Supplier Form */}
        {showAddForm && (
          <div className="manage-list-form card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: '#6C5CE7', fontWeight: 600 }}>🏪 Supplier</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={newIsCustomer} onChange={(e) => setNewIsCustomer(e.target.checked)} />
                <span>Also a customer</span>
              </label>
            </div>
            <input
              className="manage-list-input"
              placeholder="Supplier name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="manage-list-input"
              placeholder="Tax number (optional)"
              value={newTaxNumber}
              onChange={(e) => setNewTaxNumber(e.target.value)}
            />
            <input
              className="manage-list-input"
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              type="tel"
            />
            <textarea
              className="manage-list-input"
              placeholder="Address (optional)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              rows={2}
            />
            <div className="manage-list-form-actions">
              <button className="btn btn-secondary" onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewTaxNumber('');
                setNewPhone('');
                setNewAddress('');
                setNewIsCustomer(false);
              }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddSupplier}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Add + Merge buttons */}
      {!showAddForm && !mergeMode && (
        <div className="action-bar">
          <button className="btn btn-secondary" onClick={() => setShowAddForm(true)}>
            + Add
          </button>
          <button className="btn btn-primary" onClick={handleStartMerge}>
            Merge & Clean
          </button>
        </div>
      )}

      {/* Merge Mode Bottom Bar */}
      {mergeMode && (
        <div className="action-bar">
          {selectedSupplierIds.size === 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleCleanEmpty}>
                Quick Clean
              </button>
            </>
          )}
          {selectedSupplierIds.size === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
          {selectedSupplierIds.size >= 2 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmMerge}>
                Merge
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
