/**
 * Manage Warehouse - 与移动端 app/warehouse-manage.tsx 一一对应，复用 shared lib
 * 包含完整的merge功能：merge模式、选择、merge历史、使用统计、展开/折叠、Quick Clean等
 */
import { useState, useEffect, useRef } from 'react';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  mergeWarehouses,
  unmergeWarehouse,
  getWarehousesForMergeHistory,
  getWarehouseUsageCounts,
  type WarehousesMergeHistoryData,
  type WarehouseUsageCounts,
} from '../lib/shared/index';
import { Warehouse } from '../types';
import './ManageList.css';
import './AccountsManage.css'; // 复用AccountsManage的样式

export default function WarehouseManage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<Set<string>>(new Set());
  const [mergeHistoryData, setMergeHistoryData] = useState<WarehousesMergeHistoryData | null>(null);
  const [usageCounts, setUsageCounts] = useState<WarehouseUsageCounts | null>(null);
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(new Set());
  const [showQuickCleanModal, setShowQuickCleanModal] = useState(false);
  const [showMergeTargetModal, setShowMergeTargetModal] = useState(false);
  const [mergeTargetModalWarehouses, setMergeTargetModalWarehouses] = useState<Warehouse[] | null>(null);
  const [mergeTargetSelectedId, setMergeTargetSelectedId] = useState<string | null>(null);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [deleteSelectedModalWarehouses, setDeleteSelectedModalWarehouses] = useState<Warehouse[] | null>(null);
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
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const list = await getWarehouses();
      setWarehouses([...list].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Load warehouses error:', e);
      showToast('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      showToast('Please enter warehouse name');
      return;
    }
    try {
      const item = await createWarehouse({ name: newName.trim() });
      setWarehouses(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setShowAddForm(false);
      showToast('Warehouse created');
    } catch (e: any) {
      console.error('Error creating warehouse:', e);
      showToast(e.message || 'Failed to create');
      load();
    }
  };

  const handleSave = async (id: string) => {
    if (!editName.trim()) {
      showToast('Please enter warehouse name');
      return;
    }
    try {
      await updateWarehouse(id, { name: editName.trim() });
      setWarehouses(prev => prev.map((x) => (x.id === id ? { ...x, name: editName.trim() } : x)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditName('');
    } catch (e: any) {
      console.error('Error updating warehouse:', e);
      showToast(e.message || 'Failed to update');
      load();
    }
  };

  const handleDelete = async (warehouse: Warehouse) => {
    if (!window.confirm(`Delete "${warehouse.name}"?`)) return;
    try {
      await deleteWarehouse(warehouse.id);
      setWarehouses(prev => prev.filter((x) => x.id !== warehouse.id));
      showToast('Warehouse deleted');
    } catch (e: any) {
      console.error('Error deleting warehouse:', e);
      showToast(e.message || 'Failed to delete');
      load();
    }
  };

  const startEdit = (warehouse: Warehouse) => {
    setEditingId(warehouse.id);
    setEditName(warehouse.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const toggleWarehouseSelection = (warehouseId: string) => {
    const newSelected = new Set(selectedWarehouseIds);
    if (newSelected.has(warehouseId)) {
      newSelected.delete(warehouseId);
    } else {
      newSelected.add(warehouseId);
    }
    setSelectedWarehouseIds(newSelected);
  };

  const handleStartMerge = async () => {
    setMergeMode(true);
    setSelectedWarehouseIds(new Set());
    setEditingId(null);
    setShowAddForm(false);
    setExpandedRootIds(new Set());
    try {
      const [historyData, counts] = await Promise.all([
        getWarehousesForMergeHistory(),
        getWarehouseUsageCounts(),
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
    setSelectedWarehouseIds(new Set());
    setMergeHistoryData(null);
    setUsageCounts(null);
    setExpandedRootIds(new Set());
    load();
  };

  const directUsage = (id: string) => usageCounts?.usageCountByWarehouseId[id] ?? 0;
  const totalCount = (root: Warehouse, children: Warehouse[]) =>
    directUsage(root.id) + children.reduce((s, c) => s + directUsage(c.id), 0);
  const directCount = (id: string) => directUsage(id);

  /** 与非 merge 一致：按直接用量降序、名称升序 */
  const sortedMergeDisplayRoots = (() => {
    const arr = mergeHistoryData?.roots ?? warehouses;
    return [...arr].sort((a, b) => {
      const ua = directUsage(a.id);
      const ub = directUsage(b.id);
      if (ub !== ua) return ub - ua;
      return a.name.localeCompare(b.name);
    });
  })();

  const cleanableRoots = (() => {
    if (!mergeHistoryData || !usageCounts) return [];
    return mergeHistoryData.roots.filter((root) => {
      const children = mergeHistoryData.childrenByRootId.get(root.id) ?? [];
      const hasUsage = directUsage(root.id) > 0;
      const hasChildUsage = children.some((c) => directUsage(c.id) > 0);
      const hasChildren = children.length > 0;
      return !hasUsage && !hasChildUsage && !hasChildren;
    });
  })();

  const handleCleanEmpty = () => {
    if (cleanableRoots.length === 0) {
      showToast('No empty warehouses to clean.');
      return;
    }
    setShowQuickCleanModal(true);
  };

  const doQuickCleanConfirm = async () => {
    if (cleanableRoots.length === 0) return;
    setShowQuickCleanModal(false);
    try {
      for (const root of cleanableRoots) {
        await deleteWarehouse(root.id);
      }
      await load();
      const [historyData, counts] = await Promise.all([
        getWarehousesForMergeHistory(),
        getWarehouseUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      showToast(`Cleaned ${cleanableRoots.length} empty warehouse(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to clean');
    }
  };

  const setMergeTargetSelection = (warehouseId: string) => setMergeTargetSelectedId(warehouseId);
  const confirmMergeTarget = () => {
    if (!mergeTargetSelectedId) return;
    const sourceIds = Array.from(selectedWarehouseIds).filter((id) => id !== mergeTargetSelectedId);
    setShowMergeTargetModal(false);
    setMergeTargetModalWarehouses(null);
    setMergeTargetSelectedId(null);
    performMerge(sourceIds, mergeTargetSelectedId);
  };

  const handleConfirmMerge = () => {
    if (selectedWarehouseIds.size < 2) {
      showToast('Please select at least 2 warehouses to merge');
      return;
    }
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((w) => selectedWarehouseIds.has(w.id));
    setMergeTargetModalWarehouses(selected);
    setMergeTargetSelectedId(null);
    setShowMergeTargetModal(true);
  };

  const performMerge = async (sourceWarehouseIds: string[], targetWarehouseId: string) => {
    try {
      await mergeWarehouses(sourceWarehouseIds, targetWarehouseId);
      await load();
      const [historyData, counts] = await Promise.all([
        getWarehousesForMergeHistory(),
        getWarehouseUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedWarehouseIds(new Set());
      setExpandedRootIds(new Set());
      showToast('Warehouses merged successfully');
    } catch (error: any) {
      console.error('Error merging warehouses:', error);
      showToast(error.message || 'Failed to merge warehouses');
    }
  };

  const handleUnmerge = async (childId: string) => {
    try {
      await unmergeWarehouse(childId);
      await load();
      const [historyData, counts] = await Promise.all([
        getWarehousesForMergeHistory(),
        getWarehouseUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedWarehouseIds((prev) => {
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
    if (selectedWarehouseIds.size === 0) return;
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((w) => selectedWarehouseIds.has(w.id));
    setDeleteSelectedModalWarehouses(selected);
    setShowDeleteSelectedModal(true);
  };

  const doDeleteSelectedConfirm = async () => {
    const selected = deleteSelectedModalWarehouses;
    setShowDeleteSelectedModal(false);
    setDeleteSelectedModalWarehouses(null);
    if (!selected || selected.length === 0) return;
    try {
      for (const w of selected) {
        await deleteWarehouse(w.id);
      }
      await load();
      const [historyData, counts] = await Promise.all([
        getWarehousesForMergeHistory(),
        getWarehouseUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedWarehouseIds(new Set());
      showToast(`Deleted ${selected.length} warehouse(s).`);
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

  if (loading && warehouses.length === 0 && !mergeMode) {
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

      {/* Quick Clean Modal */}
      {showQuickCleanModal && (
        <div className="modal-overlay" onClick={() => setShowQuickCleanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Quick Clean</h3>
              <p>Delete {cleanableRoots.length} empty warehouse(s):</p>
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
        <div className="modal-overlay" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalWarehouses(null); setMergeTargetSelectedId(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🔀</div>
              <h3>Choose which warehouse to keep,</h3>
              <p>Others will be merged into it.</p>
            </div>
            <div className="modal-list">
              {(mergeTargetModalWarehouses ?? []).map((w) => (
                <div
                  key={w.id}
                  className={`modal-list-item-tappable ${mergeTargetSelectedId === w.id ? 'selected' : ''}`}
                  onClick={() => setMergeTargetSelection(w.id)}
                >
                  <span>{w.name}</span>
                  {mergeTargetSelectedId === w.id ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="circle-icon">○</span>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalWarehouses(null); setMergeTargetSelectedId(null); }}>
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
        <div className="modal-overlay" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalWarehouses(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Delete {deleteSelectedModalWarehouses?.length ?? 0} selected warehouse(s)?</h3>
            </div>
            <div className="modal-list">
              {(deleteSelectedModalWarehouses ?? []).map((w) => (
                <div key={w.id} className="modal-list-item">
                  <span>{w.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalWarehouses(null); }}>
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
              <span>Warehouse</span>
              <span className="header-selected-count">
                （{selectedWarehouseIds.size}/{mergeHistoryData ? mergeHistoryData.roots.length : sortedMergeDisplayRoots.length}）
              </span>
            </div>
            <div className="counts-cell">
              <span>Usage</span>
            </div>
            <div className="expand-placeholder-small" />
          </div>
        </div>
      ) : (
        <div className="manage-list-header">
          <h1>Warehouse Management</h1>
        </div>
      )}

      {/* Warehouses List */}
      <div className="manage-list-content">
        {mergeMode ? (
          // Merge Mode: 显示复选框列表，支持展开/折叠
          sortedMergeDisplayRoots.map((root) => {
            const children = mergeHistoryData?.childrenByRootId?.get(root.id) ?? [];
            const expanded = expandedRootIds.has(root.id);
            const hasChildren = children.length > 0;
            return (
              <div key={root.id} className="account-card">
                <div
                  className={`account-row ${selectedWarehouseIds.has(root.id) ? 'selected' : ''}`}
                >
                  <div
                    className="merge-row-selection-area"
                    onClick={() => toggleWarehouseSelection(root.id)}
                  >
                    <div className="checkbox-container">
                      {selectedWarehouseIds.has(root.id) ? (
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
                      className={`child-row ${selectedWarehouseIds.has(child.id) ? 'selected' : ''}`}
                    >
                      <div
                        className="merge-row-selection-area"
                        onClick={() => toggleWarehouseSelection(child.id)}
                      >
                        <div className="checkbox-container">
                          {selectedWarehouseIds.has(child.id) ? (
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
          // Normal Mode: Show regular warehouse list
          warehouses.map((item) => (
            <div key={item.id} className="manage-list-li">
              {editingId === item.id ? (
                // Edit Mode
                <div className="edit-row">
                  <input
                    className="manage-list-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Warehouse name"
                  />
                  <div className="edit-row-buttons">
                    <button className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSave(item.id)}>
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="account-row-display">
                  <div className="account-indicator">
                    <span>🏭</span>
                    {item.isAiRecognized && (
                      <span className="ai-badge">AI</span>
                    )}
                  </div>
                  <span className="manage-list-item-name">{item.name}</span>
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

        {/* Add Warehouse Form */}
        {showAddForm && (
          <div className="manage-list-form card">
            <input
              className="manage-list-input"
              placeholder="Warehouse name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="manage-list-form-actions">
              <button className="btn btn-secondary" onClick={() => {
                setShowAddForm(false);
                setNewName('');
              }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdd}>
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
          {selectedWarehouseIds.size === 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleCleanEmpty}>
                Quick Clean
              </button>
            </>
          )}
          {selectedWarehouseIds.size === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
          {selectedWarehouseIds.size >= 2 && (
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
