/**
 * Manage Accounts - 与移动端 app/accounts-manage.tsx 一一对应，复用 shared lib
 * 包含完整的merge功能：merge模式、选择、merge历史、使用统计、展开/折叠、Quick Clean、重复名称处理等
 */
import { useState, useEffect, useRef } from 'react';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  mergeAccount,
  unmergeAccount,
  getAccountsForMergeHistory,
  getAccountUsageCounts,
  type AccountsMergeHistoryData,
  type AccountUsageCounts,
} from '../lib/shared/index';
import { Account } from '../types';
import './ManageList.css';
import './AccountsManage.css';

export default function AccountsManage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [mergeHistoryData, setMergeHistoryData] = useState<AccountsMergeHistoryData | null>(null);
  const [usageCounts, setUsageCounts] = useState<AccountUsageCounts | null>(null);
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(new Set());
  const [showDuplicateNameModal, setShowDuplicateNameModal] = useState(false);
  const [duplicateNameModalPayload, setDuplicateNameModalPayload] = useState<{
    duplicateName: string;
    targetId: string;
    editingId: string;
  } | null>(null);
  const [showQuickCleanModal, setShowQuickCleanModal] = useState(false);
  const [showMergeTargetModal, setShowMergeTargetModal] = useState(false);
  const [mergeTargetModalAccounts, setMergeTargetModalAccounts] = useState<Account[] | null>(null);
  const [mergeTargetSelectedId, setMergeTargetSelectedId] = useState<string | null>(null);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [deleteSelectedModalAccounts, setDeleteSelectedModalAccounts] = useState<Account[] | null>(null);
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
    loadAccounts();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await getAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      showToast('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newName.trim()) {
      showToast('Please enter account name');
      return;
    }

    try {
      const newAccount = await createAccount(newName.trim(), false);
      setAccounts(prev => [...prev, newAccount]);
      setNewName('');
      setShowAddForm(false);
      showToast('Account created');
    } catch (error: any) {
      console.error('Error creating account:', error);
      if (error?.code === 'ACCOUNT_NAME_EXISTS') {
        setDuplicateNameModalPayload({
          duplicateName: (error?.duplicateName ?? newName) || '',
          targetId: error?.targetId ?? '',
          editingId: '',
        });
        setShowDuplicateNameModal(true);
        return;
      }
      showToast(error.message || 'Failed to create account');
      loadAccounts();
    }
  };

  const handleUpdateAccount = async (accountId: string) => {
    if (!editName.trim()) {
      showToast('Please enter account name');
      return;
    }

    try {
      await updateAccount(accountId, {
        name: editName.trim(),
      });
      setAccounts(prev => prev.map(acc =>
        acc.id === accountId
          ? { ...acc, name: editName.trim() }
          : acc
      ));
      setEditingId(null);
      setEditName('');
    } catch (error: any) {
      if (error?.code === 'ACCOUNT_NAME_EXISTS') {
        setDuplicateNameModalPayload({
          duplicateName: (error?.duplicateName ?? editName) || '',
          targetId: error?.targetId ?? '',
          editingId: accountId,
        });
        setShowDuplicateNameModal(true);
        return;
      }
      console.error('Error updating account:', error);
      showToast(error.message || 'Failed to update account');
      loadAccounts();
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
  };

  const handleDuplicateNameMerge = async () => {
    const payload = duplicateNameModalPayload;
    if (!payload?.targetId || !payload?.editingId) return;
    setShowDuplicateNameModal(false);
    setDuplicateNameModalPayload(null);
    try {
      await mergeAccount([payload.editingId], payload.targetId);
      setEditingId(null);
      setEditName('');
      loadAccounts();
    } catch (e: any) {
      showToast(e?.message ?? 'Merge failed');
      loadAccounts();
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!window.confirm(`Are you sure you want to delete "${account.name}"?`)) return;
    try {
      await deleteAccount(account.id);
      setAccounts(prev => prev.filter(acc => acc.id !== account.id));
      showToast('Account deleted');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      showToast(error.message || 'Failed to delete account');
      loadAccounts();
    }
  };

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setEditName(account.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const toggleAccountSelection = (accountId: string) => {
    const newSelected = new Set(selectedAccountIds);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccountIds(newSelected);
  };

  const handleStartMerge = async () => {
    setMergeMode(true);
    setSelectedAccountIds(new Set());
    setEditingId(null);
    setShowAddForm(false);
    setExpandedRootIds(new Set());
    try {
      const [historyData, counts] = await Promise.all([
        getAccountsForMergeHistory(),
        getAccountUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setAccounts(historyData.roots);
    } catch (e: any) {
      console.error('Error loading merge history:', e);
      showToast(e?.message ?? 'Failed to load merge data');
    }
  };

  const handleCancelMerge = () => {
    setMergeMode(false);
    setSelectedAccountIds(new Set());
    setMergeHistoryData(null);
    setUsageCounts(null);
    setExpandedRootIds(new Set());
    loadAccounts();
  };

  const handleConfirmMerge = () => {
    if (selectedAccountIds.size < 2) {
      showToast('Please select at least 2 accounts to merge');
      return;
    }
    const allAccountsInMergeMode = mergeHistoryData
      ? [
          ...mergeHistoryData.roots,
          ...Array.from(mergeHistoryData.childrenByRootId.values()).flat(),
        ]
      : accounts;
    const selectedAccounts = allAccountsInMergeMode.filter((acc) =>
      selectedAccountIds.has(acc.id)
    );
    setMergeTargetModalAccounts(selectedAccounts);
    setMergeTargetSelectedId(null);
    setShowMergeTargetModal(true);
  };

  const setMergeTargetSelection = (accountId: string) => {
    setMergeTargetSelectedId(accountId);
  };

  const confirmMergeTarget = () => {
    if (!mergeTargetSelectedId) return;
    const sourceIds = Array.from(selectedAccountIds).filter((id) => id !== mergeTargetSelectedId);
    setShowMergeTargetModal(false);
    setMergeTargetModalAccounts(null);
    setMergeTargetSelectedId(null);
    performMerge(sourceIds, mergeTargetSelectedId);
  };

  const handleUnmerge = async (childId: string) => {
    try {
      await unmergeAccount(childId);
      await loadAccounts();
      const [historyData, counts] = await Promise.all([
        getAccountsForMergeHistory(),
        getAccountUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedAccountIds((prev) => {
        const next = new Set(prev);
        next.delete(childId);
        return next;
      });
      showToast('Unmerged');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to unmerge');
    }
  };

  const performMerge = async (sourceAccountIds: string[], targetAccountId: string) => {
    try {
      await mergeAccount(sourceAccountIds, targetAccountId);
      await loadAccounts();
      const [historyData, counts] = await Promise.all([
        getAccountsForMergeHistory(),
        getAccountUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedAccountIds(new Set());
      setExpandedRootIds(new Set());
      showToast('Accounts merged successfully');
    } catch (error: any) {
      console.error('Error merging accounts:', error);
      showToast(error.message || 'Failed to merge accounts');
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

  const directReceipts = (id: string) => usageCounts?.receiptCountByAccountId[id] ?? 0;
  const directInvoices = (id: string) => usageCounts?.invoiceCountByAccountId[id] ?? 0;

  /** 可清理的账户：根账户、无关联数据、无子账户（未被合并且没有合并进自己的） */
  const cleanableRoots = (() => {
    if (!mergeHistoryData || !usageCounts) return [];
    return mergeHistoryData.roots.filter((root) => {
      const children = mergeHistoryData.childrenByRootId.get(root.id) ?? [];
      const hasUsage = directReceipts(root.id) + directInvoices(root.id) > 0;
      const hasChildUsage = children.some(
        (c) => directReceipts(c.id) + directInvoices(c.id) > 0
      );
      const hasChildren = children.length > 0;
      return !hasUsage && !hasChildUsage && !hasChildren;
    });
  })();

  const handleCleanEmpty = () => {
    if (cleanableRoots.length === 0) {
      showToast('No empty accounts to clean.');
      return;
    }
    setShowQuickCleanModal(true);
  };

  const doQuickCleanConfirm = async () => {
    if (cleanableRoots.length === 0) return;
    setShowQuickCleanModal(false);
    try {
      for (const root of cleanableRoots) {
        await deleteAccount(root.id);
      }
      await loadAccounts();
      const [historyData, counts] = await Promise.all([
        getAccountsForMergeHistory(),
        getAccountUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      showToast(`Cleaned ${cleanableRoots.length} empty account(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to clean');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedAccountIds.size === 0) return;
    const allInMerge = mergeHistoryData
      ? [
          ...mergeHistoryData.roots,
          ...Array.from(mergeHistoryData.childrenByRootId.values()).flat(),
        ]
      : [];
    const selected = allInMerge.filter((a) => selectedAccountIds.has(a.id));
    setDeleteSelectedModalAccounts(selected);
    setShowDeleteSelectedModal(true);
  };

  const doDeleteSelectedConfirm = async () => {
    const selected = deleteSelectedModalAccounts;
    setShowDeleteSelectedModal(false);
    setDeleteSelectedModalAccounts(null);
    if (!selected || selected.length === 0) return;
    try {
      for (const acc of selected) {
        await deleteAccount(acc.id);
      }
      await loadAccounts();
      const [historyData, counts] = await Promise.all([
        getAccountsForMergeHistory(),
        getAccountUsageCounts(),
      ]);
      setMergeHistoryData(historyData);
      setUsageCounts(counts);
      setSelectedAccountIds(new Set());
      showToast(`Deleted ${selected.length} account(s).`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete');
    }
  };

  const totalCount = (root: Account, children: Account[]) => {
    return (
      directReceipts(root.id) +
      directInvoices(root.id) +
      children.reduce((s, c) => s + directReceipts(c.id) + directInvoices(c.id), 0)
    );
  };
  const directCount = (id: string) => directReceipts(id) + directInvoices(id);

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
              <div className="modal-icon">💰</div>
              <h3>Duplicate account name:</h3>
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
              <p>Delete {cleanableRoots.length} empty account(s):</p>
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
        <div className="modal-overlay" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalAccounts(null); setMergeTargetSelectedId(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🔀</div>
              <h3>Choose which account to keep,</h3>
              <p>Others will be merged into it.</p>
            </div>
            <div className="modal-list">
              {(mergeTargetModalAccounts ?? []).map((acc) => (
                <div
                  key={acc.id}
                  className={`modal-list-item-tappable ${mergeTargetSelectedId === acc.id ? 'selected' : ''}`}
                  onClick={() => setMergeTargetSelection(acc.id)}
                >
                  <span>{acc.name}</span>
                  {mergeTargetSelectedId === acc.id ? (
                    <span className="check-icon">✓</span>
                  ) : (
                    <span className="circle-icon">○</span>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowMergeTargetModal(false); setMergeTargetModalAccounts(null); setMergeTargetSelectedId(null); }}>
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
        <div className="modal-overlay" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalAccounts(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">🗑️</div>
              <h3>Delete {deleteSelectedModalAccounts?.length ?? 0} selected account(s)?</h3>
            </div>
            <div className="modal-list">
              {(deleteSelectedModalAccounts ?? []).map((acc) => (
                <div key={acc.id} className="modal-list-item">
                  <span>{acc.name}</span>
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteSelectedModal(false); setDeleteSelectedModalAccounts(null); }}>
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
              <span>Account</span>
              <span className="header-selected-count">
                （{selectedAccountIds.size}/{mergeHistoryData
                  ? mergeHistoryData.roots.length
                  : accounts.length}）
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
          <h1>Accounts for receipts & invoices, support merged accounts.</h1>
        </div>
      )}

      {/* Accounts List */}
      <div className="manage-list-content">
        {mergeMode ? (
          // Merge Mode: 显示复选框列表，支持展开/折叠
          accounts.map((account) => {
            const children = mergeHistoryData?.childrenByRootId?.get(account.id) ?? [];
            const expanded = expandedRootIds.has(account.id);
            const hasChildren = children.length > 0;
            return (
              <div key={account.id} className="account-card">
                <div
                  className={`account-row ${selectedAccountIds.has(account.id) ? 'selected' : ''}`}
                >
                  <div
                    className="merge-row-selection-area"
                    onClick={() => toggleAccountSelection(account.id)}
                  >
                    <div className="checkbox-container">
                      {selectedAccountIds.has(account.id) ? (
                        <span className="checkbox-checked">✓</span>
                      ) : (
                        <span className="checkbox-unchecked">○</span>
                      )}
                    </div>
                    <span className="account-name">{account.name}</span>
                    <div className="counts-cell">
                      <span>{expanded ? directCount(account.id) : totalCount(account, children)}</span>
                    </div>
                  </div>
                  {hasChildren ? (
                    <button
                      className="expand-button-small"
                      onClick={() => toggleExpand(account.id)}
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
                      className={`child-row ${selectedAccountIds.has(child.id) ? 'selected' : ''}`}
                    >
                      <div
                        className="merge-row-selection-area"
                        onClick={() => toggleAccountSelection(child.id)}
                      >
                        <div className="checkbox-container">
                          {selectedAccountIds.has(child.id) ? (
                            <span className="checkbox-checked">✓</span>
                          ) : (
                            <span className="checkbox-unchecked">○</span>
                          )}
                        </div>
                        <span className="child-name">{child.name}</span>
                        <div className="counts-cell">
                          <span>{directCount(child.id)}</span>
                        </div>
                      </div>
                      <button
                        className="child-row-unmerge-button"
                        onClick={() => handleUnmerge(child.id)}
                      >
                        Unmerge
                      </button>
                    </div>
                  ))}
              </div>
            );
          })
        ) : (
          // Normal Mode: Show regular account list
          accounts.map((account) => (
            <div key={account.id} className="manage-list-li">
              {editingId === account.id ? (
                // Edit Mode
                <div className="edit-row">
                  <input
                    className="manage-list-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Account name"
                  />
                  <div className="edit-row-buttons">
                    <button className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => handleUpdateAccount(account.id)}>
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                // Display Mode
                <div className="account-row-display">
                  <div className="account-indicator">
                    <span>💳</span>
                    {account.isAiRecognized && (
                      <span className="ai-badge">AI</span>
                    )}
                  </div>
                  <span className="manage-list-item-name">{account.name}</span>
                  <div className="account-actions">
                    <button className="btn btn-icon" onClick={() => startEdit(account)}>
                      Edit
                    </button>
                    <button className="btn btn-icon danger" onClick={() => handleDeleteAccount(account)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Add Account Form */}
        {showAddForm && (
          <div className="manage-list-form card">
            <input
              className="manage-list-input"
              placeholder="Account name"
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
              <button className="btn btn-primary" onClick={handleAddAccount}>
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
          {selectedAccountIds.size === 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleCleanEmpty}>
                Quick Clean
              </button>
            </>
          )}
          {selectedAccountIds.size === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleCancelMerge}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSelected}>
                Delete
              </button>
            </>
          )}
          {selectedAccountIds.size >= 2 && (
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
