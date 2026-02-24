/**
 * Manage SKU - 与移动端 app/skus-manage.tsx 一一对应，复用 shared lib
 * 包含完整的merge功能：merge模式、选择、merge历史、使用统计、展开/折叠、Quick Clean等
 */
import { useState, useEffect, useRef } from 'react';
import {
  getSkus,
  createSku,
  updateSku,
  deleteSku,
  mergeSkus,
  unmergeSku,
  getSkusForMergeHistory,
  getSkuUsageCounts,
  type SkusMergeHistoryData,
  type SkuUsageCounts,
} from '../lib/shared/index';
import { Sku } from '../types';
import './ManageList.css';
import './AccountsManage.css'; // 复用AccountsManage的样式

export default function SkusManage() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('件');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('件');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [mergeHistoryData, setMergeHistoryData] = useState<SkusMergeHistoryData | null>(null);
  const [usageCounts, setUsageCounts] = useState<SkuUsageCounts | null>(null);
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(new Set());
  const [showQuickCleanModal, setShowQuickCleanModal] = useState(false);
  const [showMergeTargetModal, setShowMergeTargetModal] = useState(false);
  const [mergeTargetModalSkus, setMergeTargetModalSkus] = useState<Sku[] | null>(null);
  const [mergeTargetSelectedId, setMergeTargetSelectedId] = useState<string | null>(null);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [deleteSelectedModalSkus, setDeleteSelectedModalSkus] = useState<Sku[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const data = await getSkus();
      setSkus([...data].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Load skus error:', e);
      showToast('Failed to load SKUs');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      showToast('Please enter SKU name');
      return;
    }
    try {
      const item = await createSku({ name: newName.trim(), unit: newUnit.trim() || '件' });
      setSkus(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewUnit('件');
      setShowAddForm(false);
      showToast('SKU created');
    } catch (e: any) {
      console.error('Error creating SKU:', e);
      showToast(e.message || 'Failed to create');
      load();
    }
  };

  const handleSave = async (id: string) => {
    if (!editName.trim()) {
      showToast('Please enter SKU name');
      return;
    }
    try {
      await updateSku(id, { name: editName.trim(), unit: editUnit.trim() || '件' });
      setSkus(prev => prev.map((x) => (x.id === id ? { ...x, name: editName.trim(), unit: editUnit || '件' } : x)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditName('');
      setEditUnit('件');
    } catch (e: any) {
      console.error('Error updating SKU:', e);
      showToast(e.message || 'Failed to update');
      load();
    }
  };

  const handleDelete = async (sku: Sku) => {
    if (!window.confirm(`Delete "${sku.name}"?`)) return;
    try {
      await deleteSku(sku.id);
      setSkus(prev => prev.filter((x) => x.id !== sku.id));
      showToast('SKU deleted');
    } catch (e: any) {
      console.error('Error deleting SKU:', e);
      showToast(e.message || 'Failed to delete');
      load();
    }
  };

  const startEdit = (sku: Sku) => {
    setEditingId(sku.id);
    setEditName(sku.name);
    setEditUnit(sku.unit || '件');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditUnit('件');
  };

  const toggleSkuSelection = (skuId: string) => {
    const newSelected = new Set(selectedSkuIds);
    if (newSelected.has(skuId)) {
      newSelected.delete(skuId);
    } else {
      newSelected.add(skuId);
    }
    setSelectedSkuIds(newSelected);
  };

  const handleStartMerge = async () => {
    setMergeMode(true);
    setSelectedSkuIds(new Set());
    setEditingId(null);
    setShowAddForm(false);
    setExpandedRootIds(new Set());
    try {
      const [historyData, counts] = await Promise.all([
        getSkusForMergeHistory(),
        getSkuUsageCounts(),
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
    setSelectedSkuIds(new Set());
    setMergeHistoryData(null);
    setUsageCounts(null);
    setExpandedRootIds(new Set());
    load();
  };

  const directUsage = (id: string) => usageCounts?.usageCountBySkuId[id] ?? 0;
  const totalCount = (root: Sku, children: Sku[]) =>
    directUsage(root.id) + children.reduce((s, c) => s + directUsage(c.id), 0);
  const directCount = (id: string) => directUsage(id);

  /** 与非 merge 一致：按直接用量降序、名称升序 */
  const sortedMergeDisplayRoots = (() => {
    const arr = mergeHistoryData?.roots ?? skus;
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
      showToast('No empty SKUs to clean.');
      return;
    }
    setShowQuickCleanModal(true);
  };

  const doQuickCleanConfirm = async () => {
    if (cleanableRoots.length === 0) return;
    setShowQuickCleanModal(false);
    try {
      for (const root of cleanableRoots) {
        await deleteSku(root.id);
      }
      await load();
      const [historyData, counts] = await Promise.all([
        getSkusForMergeHistory(),
        getSkuUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      showToast(`Cleaned ${cleanableRoots.length} empty SKU(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to clean');
    }
  };

  const setMergeTargetSelection = (skuId: string) => setMergeTargetSelectedId(skuId);
  const confirmMergeTarget = () => {
    if (!mergeTargetSelectedId) return;
    const sourceIds = Array.from(selectedSkuIds).filter((id) => id !== mergeTargetSelectedId);
    setShowMergeTargetModal(false);
    setMergeTargetModalSkus(null);
    setMergeTargetSelectedId(null);
    performMerge(sourceIds, mergeTargetSelectedId);
  };

  const handleConfirmMerge = () => {
    if (selectedSkuIds.size < 2) {
      showToast('Please select at least 2 SKUs to merge');
      return;
    }
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((s) => selectedSkuIds.has(s.id));
    setMergeTargetModalSkus(selected);
    setMergeTargetSelectedId(null);
    setShowMergeTargetModal(true);
  };

  const performMerge = async (sourceSkuIds: string[], targetSkuId: string) => {
    try {
      await mergeSkus(sourceSkuIds, targetSkuId);
      await load();
      const [historyData, counts] = await Promise.all([
        getSkusForMergeHistory(),
        getSkuUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSkuIds(new Set());
      setExpandedRootIds(new Set());
      showToast('SKUs merged successfully');
    } catch (error: any) {
      console.error('Error merging SKUs:', error);
      showToast(error.message || 'Failed to merge SKUs');
    }
  };

  const handleUnmerge = async (childId: string) => {
    try {
      await unmergeSku(childId);
      await load();
      const [historyData, counts] = await Promise.all([
        getSkusForMergeHistory(),
        getSkuUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSkuIds((prev) => {
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
    if (selectedSkuIds.size === 0) return;
    const allInMerge = mergeHistoryData
      ? [...mergeHistoryData.roots, ...Array.from(mergeHistoryData.childrenByRootId.values()).flat()]
      : [];
    const selected = allInMerge.filter((s) => selectedSkuIds.has(s.id));
    setDeleteSelectedModalSkus(selected);
    setShowDeleteSelectedModal(true);
  };

  const doDeleteSelectedConfirm = async () => {
    const selected = deleteSelectedModalSkus;
    setShowDeleteSelectedModal(false);
    setDeleteSelectedModalSkus(null);
    if (!selected || selected.length === 0) return;
    try {
      for (const s of selected) {
        await deleteSku(s.id);
      }
      await load();
      const [historyData, counts] = await Promise.all([
        getSkusForMergeHistory(),
        getSkuUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedSkuIds(new Set());
      showToast(`Deleted ${selected.length} SKU(s).`);
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

  if (loading && skus.length === 0 && !mergeMode) {
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
              <p>Delete {cleanableRoots.length} empty SKU(s):</p>
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
        <div className="modal-overlay" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalSkus(null); setMergeTargetSelectedId(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🔀</div>
              <h3>Choose which SKU to keep,</h3>
              <p>Others will be merged into it.</p>
            </div>
            <div className="modal-list">
              {(mergeTargetModalSkus ?? []).map((s) => (
                <div
                  key={s.id}
                  className={`modal-list-item-tappable ${mergeTargetSelectedId === s.id ? 'selected' : ''}`}
                  onClick={() => setMergeTargetSelection(s.id)}
                >
                  <span>{s.name} {s.unit ? `(${s.unit})` : ''}</span>
                  {mergeTargetSelectedId === s.id ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="circle-icon">○</span>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalSkus(null); setMergeTargetSelectedId(null); }}>
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
        <div className="modal-overlay" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalSkus(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Delete {deleteSelectedModalSkus?.length ?? 0} selected SKU(s)?</h3>
            </div>
            <div className="modal-list">
              {(deleteSelectedModalSkus ?? []).map((s) => (
                <div key={s.id} className="modal-list-item">
                  <span>{s.name} {s.unit ? `(${s.unit})` : ''}</span>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalSkus(null); }}>
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
              <span>SKU</span>
              <span className="header-selected-count">
                （{selectedSkuIds.size}/{mergeHistoryData ? mergeHistoryData.roots.length : sortedMergeDisplayRoots.length}）
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
          <h1>SKU Management</h1>
        </div>
      )}

      {/* SKUs List */}
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
                  className={`account-row ${selectedSkuIds.has(root.id) ? 'selected' : ''}`}
                >
                  <div
                    className="merge-row-selection-area"
                    onClick={() => toggleSkuSelection(root.id)}
                  >
                    <div className="checkbox-container">
                      {selectedSkuIds.has(root.id) ? (
                        <span className="checkbox-checked">✓</span>
                      ) : (
                        <span className="checkbox-unchecked">○</span>
                      )}
                    </div>
                    <span className="account-name">{root.name} {root.unit ? `(${root.unit})` : ''}</span>
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
                      className={`child-row ${selectedSkuIds.has(child.id) ? 'selected' : ''}`}
                    >
                      <div
                        className="merge-row-selection-area"
                        onClick={() => toggleSkuSelection(child.id)}
                      >
                        <div className="checkbox-container">
                          {selectedSkuIds.has(child.id) ? (
                            <span className="checkbox-checked">✓</span>
                          ) : (
                            <span className="checkbox-unchecked">○</span>
                          )}
                        </div>
                        <span className="child-name">{child.name} {child.unit ? `(${child.unit})` : ''}</span>
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
          // Normal Mode: Show regular SKU list
          skus.map((item) => (
            <div key={item.id} className="manage-list-li">
              {editingId === item.id ? (
                // Edit Mode
                <div className="edit-row">
                  <input
                    className="manage-list-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="SKU name"
                  />
                  <input
                    className="manage-list-input"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="Unit (e.g. 件)"
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
                    <span>📦</span>
                    {item.isAiRecognized && (
                      <span className="ai-badge">AI</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="manage-list-item-name">{item.name}</span>
                    {item.unit && <span className="manage-list-meta" style={{ marginLeft: '8px' }}>{item.unit}</span>}
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

        {/* Add SKU Form */}
        {showAddForm && (
          <div className="manage-list-form card">
            <input
              className="manage-list-input"
              placeholder="SKU name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="manage-list-input"
              placeholder="Unit (e.g. 件)"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
            <div className="manage-list-form-actions">
              <button className="btn btn-secondary" onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewUnit('件');
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
          {selectedSkuIds.size === 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleCleanEmpty}>
                Quick Clean
              </button>
            </>
          )}
          {selectedSkuIds.size === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
          {selectedSkuIds.size >= 2 && (
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
