import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter,
    Calendar, MoreHorizontal, X,
    Mic, Menu, Camera, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import {
    getReceiptsForListFirstPaint,
    getAllReceiptsForList,
    getAllReceipts,
    getAllInvoicesForList,
    getAllInbound,
    getAllOutbound
} from '../lib/shared/index';
import './RecordsList.css';

// 与移动端一致的分组类型
type GroupByType = 'month' | 'recordDate' | 'paymentAccount' | 'createdBy' | 'supplier';

// 与移动端一致的状态文案与颜色
const statusStyles: Record<string, { text: string; color: string; bg: string }> = {
    pending: { text: 'Pending', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
    processing: { text: 'Processing', color: '#9B59B6', bg: 'rgba(155, 89, 182, 0.1)' },
    confirmed: { text: 'Confirmed', color: '#00B894', bg: 'rgba(0, 184, 148, 0.1)' },
    needs_retake: { text: 'Needs Retake', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.1)' },
    duplicate: { text: 'Duplicate', color: '#95A5A6', bg: 'rgba(149, 165, 166, 0.1)' },
    rejected: { text: 'Rejected', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.1)' },
};

interface RecordsListProps {
    type: 'expenditure' | 'income' | 'inbound' | 'outbound';
}

/** 解析 YYYY-MM-DD 为本地日期，与移动端一致 */
function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

interface SectionData {
    title: string;
    monthKey: string;
    data: any[];
}

const RecordsList = ({ type }: RecordsListProps) => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullDataLoaded, setFullDataLoaded] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    const config: Record<string, { title: string; table: string }> = {
        expenditure: { title: 'Expenses', table: 'receipts' },
        income: { title: 'Income', table: 'invoices' },
        inbound: { title: 'Inbound', table: 'inbound' },
        outbound: { title: 'Outbound', table: 'outbound' },
    };

    const getDisplayName = (record: any) => {
        if (type === 'expenditure') {
            return record.supplier?.name || record.supplierCustomer?.name || record.supplierName || record.storeName || 'N/A';
        } else if (type === 'income') {
            return record.customer?.name || record.customerSupplier?.name || record.customerName || 'N/A';
        } else if (type === 'inbound') {
            return record.supplierName || 'N/A';
        } else {
            return record.customerName || 'N/A';
        }
    };

    const isExpenses = type === 'expenditure';

    // 分步加载：首屏用 firstPaint，后台再拉全量（与移动端一致）
    const loadRecords = useCallback(async (options?: { full?: boolean }) => {
        const full = options?.full ?? false;
        if (isExpenses) {
            try {
                setFullDataLoaded(false);
                if (full) {
                    const data = await getAllReceipts();
                    setRecords(data);
                    setFullDataLoaded(true);
                    setLoading(false);
                    setRefreshing(false);
                } else {
                    const data = await getReceiptsForListFirstPaint();
                    setRecords(data);
                    setFullDataLoaded(false);
                    setLoading(false);
                    setRefreshing(false);
                    getAllReceiptsForList().then(fullList => {
                        setRecords(fullList);
                        setFullDataLoaded(true);
                    }).catch(() => setFullDataLoaded(true));
                    getAllReceipts().then(fullWithItems => {
                        setRecords(prev => {
                            const idToItems = new Map<string, any[]>();
                            fullWithItems.forEach((r: any) => {
                                if (r.id && r.items?.length) idToItems.set(r.id, r.items);
                            });
                            if (idToItems.size === 0) return prev;
                            return prev.map(r => ({
                                ...r,
                                items: idToItems.get(r.id) ?? r.items ?? [],
                            }));
                        });
                    }).catch(() => {});
                }
            } catch (e) {
                console.error('Load expenses failed:', e);
                setLoading(false);
                setRefreshing(false);
            }
        } else {
            setLoading(true);
            try {
                let data: any[] = [];
                if (type === 'income') data = await getAllInvoicesForList();
                else if (type === 'inbound') data = await getAllInbound();
                else if (type === 'outbound') data = await getAllOutbound();
                setRecords(data || []);
                setFullDataLoaded(true);
            } catch (e) {
                console.error('Error fetching records:', e);
                setRecords([]);
            } finally {
                setLoading(false);
            }
        }
    }, [type, isExpenses]);

    useEffect(() => {
        loadRecords();
    }, [type]);

    // 筛选状态（仅支出与移动端一致）
    const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
    const [selectedRecordDates, setSelectedRecordDates] = useState<Set<string>>(new Set());
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
    const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [filterSubMenu, setFilterSubMenu] = useState<'main' | 'month' | 'recordDate' | 'account' | 'creator'>('main');

    const [groupingDim, setGroupingDim] = useState<GroupByType>('recordDate');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showFabActions, setShowFabActions] = useState(false);

    const filterCount = selectedMonths.size + selectedRecordDates.size + selectedAccounts.size + selectedCreators.size;

    const getStatusStyle = (status: string) => {
        return statusStyles[status] || statusStyles.pending;
    };

    // 筛选选项（从当前 records 推导，仅支出时用）
    const filterOptions = useMemo(() => {
        if (!isExpenses || records.length === 0) {
            return { months: [], recordDates: [], accounts: [], creators: [] };
        }
        const months = new Set<string>();
        const recordDates = new Set<string>();
        const accounts = new Map<string, string>();
        const creators = new Map<string, string>();
        records.forEach((receipt: any) => {
            try {
                const d = parseLocalDate(receipt.date);
                months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            } catch {}
            if (receipt.createdAt) {
                const c = new Date(receipt.createdAt);
                recordDates.add(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`);
            }
            const acc = receipt.account;
            accounts.set(acc?.id || 'none', acc?.name || 'Not Set');
            const uid = receipt.createdBy || 'unknown';
            const uname = receipt.createdByUser?.name || receipt.createdByUser?.email?.split('@')[0] || 'Unknown';
            creators.set(uid, uname);
        });
        const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
        const sortedRecordDates = Array.from(recordDates).sort((a, b) => b.localeCompare(a));
        return {
            months: sortedMonths.map(key => {
                const [y, m] = key.split('-');
                return { key, label: format(new Date(parseInt(y), parseInt(m) - 1), 'MMMM yyyy') };
            }),
            recordDates: sortedRecordDates.map(key => {
                const [y, m, d] = key.split('-');
                return { key, label: format(new Date(parseInt(y), parseInt(m) - 1, parseInt(d)), 'MMM dd, yyyy') };
            }),
            accounts: Array.from(accounts.entries()).map(([id, name]) => ({ id, name })),
            creators: Array.from(creators.entries()).map(([id, name]) => ({ id, name })),
        };
    }, [isExpenses, records]);

    // 筛选后的列表（与移动端一致：按交易月、记录日、账户、提交人）
    const filteredRecords = useMemo(() => {
        if (!isExpenses) {
            if (!searchQuery.trim()) return records;
            const q = searchQuery.trim().toLowerCase();
            return records.filter(r => {
                const name = getDisplayName(r).toLowerCase();
                const amount = (r.totalAmount ?? r.total_amount)?.toString() ?? '';
                const account = r.account?.name?.toLowerCase() ?? '';
                return name.includes(q) || amount.includes(q) || account.includes(q);
            });
        }
        let filtered = records;
        if (selectedMonths.size > 0) {
            filtered = filtered.filter((r: any) => {
                try {
                    const d = parseLocalDate(r.date);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return selectedMonths.has(key);
                } catch { return false; }
            });
        }
        if (selectedRecordDates.size > 0) {
            filtered = filtered.filter((r: any) => {
                if (!r.createdAt) return false;
                const c = new Date(r.createdAt);
                const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
                return selectedRecordDates.has(key);
            });
        }
        if (selectedAccounts.size > 0) {
            filtered = filtered.filter((r: any) => {
                const id = r.account?.id ?? 'none';
                return selectedAccounts.has(id);
            });
        }
        if (selectedCreators.size > 0) {
            filtered = filtered.filter((r: any) => selectedCreators.has(r.createdBy ?? 'unknown'));
        }
        return filtered;
    }, [isExpenses, records, searchQuery, selectedMonths, selectedRecordDates, selectedAccounts, selectedCreators]);

    // 搜索：支出时与移动端一致，等 fullDataLoaded 后再搜；其他类型直接搜
    const searchedRecords = useMemo(() => {
        if (!searchQuery.trim()) return filteredRecords;
        if (isExpenses && !fullDataLoaded) return filteredRecords;
        const q = searchQuery.trim().toLowerCase();
        return filteredRecords.filter((r: any) => {
            const supplierName = (r.supplier?.name ?? r.supplierName ?? '').toLowerCase();
            const accountName = (r.account?.name ?? '').toLowerCase();
            const amountMatch = (r.totalAmount ?? r.total_amount)?.toString().includes(q) ?? false;
            const itemsMatch = r.items?.length > 0 && r.items.some((i: any) => i.name?.toLowerCase().includes(q));
            return supplierName.includes(q) || accountName.includes(q) || amountMatch || itemsMatch;
        });
    }, [filteredRecords, searchQuery, isExpenses, fullDataLoaded]);

    // 分组逻辑（与移动端一致：month / recordDate / paymentAccount / createdBy / supplier）
    const groupByMonth = useCallback((list: any[]): SectionData[] => {
        const grouped = new Map<string, any[]>();
        list.forEach((r: any) => {
            try {
                const d = parseLocalDate(r.date);
                const key = `month-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(r);
            } catch {}
        });
        return Array.from(grouped.entries())
            .map(([monthKey, data]) => {
                const d = parseLocalDate(data[0].date);
                return {
                    title: format(d, 'MMMM yyyy'),
                    monthKey,
                    data: data.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
                };
            })
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    }, []);

    const groupByRecordDate = useCallback((list: any[]): SectionData[] => {
        const grouped = new Map<string, any[]>();
        list.forEach((r: any) => {
            if (!r.createdAt) return;
            const c = new Date(r.createdAt);
            const key = `record-${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
        });
        return Array.from(grouped.entries())
            .map(([dayKey, data]) => {
                const base = data[0].createdAt ? new Date(data[0].createdAt) : parseLocalDate(data[0].date);
                return {
                    title: format(base, 'MMM dd, yyyy'),
                    monthKey: dayKey,
                    data: data.sort((a: any, b: any) => (b.createdAt ? new Date(b.createdAt).getTime() : parseLocalDate(b.date).getTime()) - (a.createdAt ? new Date(a.createdAt).getTime() : parseLocalDate(a.date).getTime())),
                };
            })
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    }, []);

    const groupByAccount = useCallback((list: any[]): SectionData[] => {
        const grouped = new Map<string, any[]>();
        list.forEach((r: any) => {
            const name = r.account?.name || 'Not Set';
            const key = `account-${r.account?.id || 'none'}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
        });
        return Array.from(grouped.entries())
            .map(([k, data]) => ({
                title: data[0].account?.name || 'Not Set',
                monthKey: k,
                data: data.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
            }))
            .sort((a, b) => (a.title === 'Not Set' ? 1 : b.title === 'Not Set' ? -1 : a.title.localeCompare(b.title)));
    }, []);

    const groupByCreatedBy = useCallback((list: any[]): SectionData[] => {
        const grouped = new Map<string, any[]>();
        list.forEach((r: any) => {
            const name = r.createdByUser?.name || r.createdByUser?.email?.split('@')[0] || 'Unknown';
            const key = `user-${r.createdBy || 'unknown'}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
        });
        return Array.from(grouped.entries())
            .map(([k, data]) => ({
                title: data[0].createdByUser?.name || data[0].createdByUser?.email?.split('@')[0] || 'Unknown',
                monthKey: k,
                data: data.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, []);

    const groupBySupplier = useCallback((list: any[]): SectionData[] => {
        const grouped = new Map<string, any[]>();
        list.forEach((r: any) => {
            const name = r.supplier?.name || r.supplierName || 'Unknown Supplier';
            const key = `supplier-${r.supplier?.id ?? r.supplierId ?? 'none'}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
        });
        return Array.from(grouped.entries())
            .map(([k, data]) => ({
                title: data[0].supplier?.name || data[0].supplierName || 'Unknown Supplier',
                monthKey: k,
                data: data.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
            }))
            .sort((a, b) => (a.title === 'Unknown Supplier' ? 1 : b.title === 'Unknown Supplier' ? -1 : a.title.localeCompare(b.title)));
    }, []);

    const getSections = useCallback((list: any[]): SectionData[] => {
        switch (groupingDim) {
            case 'month': return groupByMonth(list);
            case 'recordDate': return groupByRecordDate(list);
            case 'paymentAccount': return groupByAccount(list);
            case 'createdBy': return groupByCreatedBy(list);
            case 'supplier': return groupBySupplier(list);
            default: return groupByRecordDate(list);
        }
    }, [groupingDim, groupByMonth, groupByRecordDate, groupByAccount, groupByCreatedBy, groupBySupplier]);

    const sections = getSections(searchedRecords);

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleFilterMonth = (key: string) => {
        setSelectedMonths(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const toggleFilterRecordDate = (key: string) => {
        setSelectedRecordDates(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const toggleFilterAccount = (id: string) => {
        setSelectedAccounts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleFilterCreator = (id: string) => {
        setSelectedCreators(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearFilters = () => {
        setSelectedMonths(new Set());
        setSelectedRecordDates(new Set());
        setSelectedAccounts(new Set());
        setSelectedCreators(new Set());
    };

    const amount = (r: any) => Number(r.totalAmount ?? r.total_amount ?? 0);
    const createdAt = (r: any) => r.createdAt ?? r.created_at;
    const creatorName = (r: any) => r.createdByUser?.name ?? r.createdByUser?.email ?? '-';

    // 点击外部关闭fab actions
    useEffect(() => {
        if (showFabActions) {
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (!target.closest('.fab-main-btn') && !target.closest('.fab-actions-container')) {
                    setShowFabActions(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showFabActions]);

    return (
        <div className="records-page compact">
            <div className="compact-header">
                <div className="header-left">
                    <h1>{config[type].title}</h1>
                    <div className="grouping-controls">
                        <select
                            value={groupingDim}
                            onChange={(e) => setGroupingDim(e.target.value as GroupByType)}
                            className="grouping-select"
                        >
                            <option value="recordDate">Group by Record Date</option>
                            <option value="month">Group by Transaction Month</option>
                            <option value="paymentAccount">Group by Account</option>
                            <option value="createdBy">Group by User</option>
                            {isExpenses && <option value="supplier">Group by Supplier</option>}
                        </select>
                    </div>
                </div>
                <div className="header-actions">
                    <div className="header-search-container">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="header-search-input"
                        />
                        {searchQuery && (
                            <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {isExpenses && (
                        <div className="filter-wrap">
                            <button
                                type="button"
                                className={`icon-btn ${filterCount > 0 ? 'has-badge' : ''}`}
                                onClick={() => { setShowFilterMenu(true); setFilterSubMenu('main'); }}
                            >
                                <Filter size={20} />
                                {filterCount > 0 && <span className="filter-badge">{filterCount}</span>}
                            </button>
                            {showFilterMenu && (
                                <div className="filter-modal-overlay" onClick={() => setShowFilterMenu(false)}>
                                    <div className="filter-modal" onClick={e => e.stopPropagation()}>
                                        <div className="filter-modal-header">
                                            {filterSubMenu === 'main' ? 'Filter' : filterSubMenu === 'month' ? 'Select Transaction Months' : filterSubMenu === 'recordDate' ? 'Select Record Dates' : filterSubMenu === 'account' ? 'Select Accounts' : 'Select Recorders'}
                                            <button type="button" className="filter-modal-close" onClick={() => setShowFilterMenu(false)}><X size={18} /></button>
                                        </div>
                                        {filterSubMenu === 'main' ? (
                                            <div className="filter-main-options">
                                                <button type="button" className="filter-main-option" onClick={() => setFilterSubMenu('month')}>
                                                    <span>Transaction Month</span>
                                                    {selectedMonths.size > 0 && <span className="filter-count-badge">{selectedMonths.size}</span>}
                                                </button>
                                                <button type="button" className="filter-main-option" onClick={() => setFilterSubMenu('recordDate')}>
                                                    <span>Record Date</span>
                                                    {selectedRecordDates.size > 0 && <span className="filter-count-badge">{selectedRecordDates.size}</span>}
                                                </button>
                                                <button type="button" className="filter-main-option" onClick={() => setFilterSubMenu('account')}>
                                                    <span>Account</span>
                                                    {selectedAccounts.size > 0 && <span className="filter-count-badge">{selectedAccounts.size}</span>}
                                                </button>
                                                <button type="button" className="filter-main-option" onClick={() => setFilterSubMenu('creator')}>
                                                    <span>Recorder</span>
                                                    {selectedCreators.size > 0 && <span className="filter-count-badge">{selectedCreators.size}</span>}
                                                </button>
                                                {filterCount > 0 && (
                                                    <button type="button" className="filter-clear-all" onClick={clearFilters}>Clear all</button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="filter-sub-options">
                                                <button type="button" className="filter-back" onClick={() => setFilterSubMenu('main')}>← Back</button>
                                                {filterSubMenu === 'month' && filterOptions.months.map(({ key, label }) => (
                                                    <label key={key} className="filter-check-label">
                                                        <input type="checkbox" checked={selectedMonths.has(key)} onChange={() => toggleFilterMonth(key)} />
                                                        <span>{label}</span>
                                                    </label>
                                                ))}
                                                {filterSubMenu === 'recordDate' && filterOptions.recordDates.map(({ key, label }) => (
                                                    <label key={key} className="filter-check-label">
                                                        <input type="checkbox" checked={selectedRecordDates.has(key)} onChange={() => toggleFilterRecordDate(key)} />
                                                        <span>{label}</span>
                                                    </label>
                                                ))}
                                                {filterSubMenu === 'account' && filterOptions.accounts.map(({ id, name }) => (
                                                    <label key={id} className="filter-check-label">
                                                        <input type="checkbox" checked={selectedAccounts.has(id)} onChange={() => toggleFilterAccount(id)} />
                                                        <span>{name}</span>
                                                    </label>
                                                ))}
                                                {filterSubMenu === 'creator' && filterOptions.creators.map(({ id, name }: { id: string; name: string }) => (
                                                    <label key={id} className="filter-check-label">
                                                        <input type="checkbox" checked={selectedCreators.has(id)} onChange={() => toggleFilterCreator(id)} />
                                                        <span>{name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {showFabActions ? (
                        <div className="fab-actions-container">
                            <button 
                                className="fab-action-btn"
                                onClick={() => {
                                    setShowFabActions(false);
                                    navigate('/voice-input', { state: { voucherType: type === 'expenditure' ? 'receipt' : type === 'income' ? 'invoice' : type === 'inbound' ? 'inbound' : 'outbound' } });
                                }}
                                title="Chat to Log"
                            >
                                <MessageSquare size={20} />
                            </button>
                            <button 
                                className="fab-action-btn"
                                onClick={() => {
                                    setShowFabActions(false);
                                    navigate(`/detail/${type}/new`);
                                }}
                                title="Manual Entry"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    ) : (
                        <button 
                            className="btn btn-primary compact-add-btn fab-main-btn" 
                            onClick={() => setShowFabActions(true)}
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="records-list-scroll">
                {loading ? (
                    <div className="loading-container">
                        <div className="loader"></div>
                    </div>
                ) : (
                    <div className="records-table-container">
                        <table className="records-table compact-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '30%' }}>Title / Supplier</th>
                                    <th style={{ width: '10%' }}>Currency</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Status</th>
                                    <th style={{ width: '15%' }}>Creator</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!(refreshing && searchQuery.trim()) && sections.flatMap((section) => [
                                    <tr key={`h-${section.monthKey}`}>
                                        <td colSpan={6} className="section-header-cell">
                                            <button
                                                type="button"
                                                className="section-header-btn"
                                                onClick={() => toggleGroup(section.monthKey)}
                                            >
                                                <span className={`section-chevron ${collapsedGroups.has(section.monthKey) ? 'collapsed' : ''}`}>▼</span>
                                                <span className="section-title">{section.title}</span>
                                                <span className="section-count">{section.data.length} records</span>
                                            </button>
                                        </td>
                                    </tr>,
                                    ...(collapsedGroups.has(section.monthKey) ? [] : section.data.map((record: any) => {
                                        const statusStyle = getStatusStyle(record.status);
                                        return (
                                            <tr
                                                key={record.id}
                                                className="record-row"
                                                onClick={() => navigate(`/detail/${type}/${record.id}`)}
                                            >
                                                <td>
                                                    <div className="cell-primary">{getDisplayName(record)}</div>
                                                    <div className="cell-secondary">{record.account?.name || 'No Account'}</div>
                                                </td>
                                                <td>
                                                    <span className="currency-badge">{record.currency || 'USD'}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <span className="amount-cell">
                                                        {amount(record).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {record.status === 'confirmed' ? (
                                                        <div className="confirmed-status-container">
                                                            <div className="confirmed-badge" style={{ backgroundColor: statusStyle.color }}>
                                                                {record.inputType === 'audio' ? <Mic size={12} /> :
                                                                 record.inputType === 'text' ? <Menu size={12} /> :
                                                                 <Camera size={12} />}
                                                            </div>
                                                            {record.createdByUser && (
                                                                <span className="confirmed-by-text">
                                                                    by {record.createdByUser.name || record.createdByUser.email?.split('@')[0] || 'Unknown'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="status-text-mobile" style={{ color: statusStyle.color }}>
                                                            {statusStyle.text}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="meta-text">{creatorName(record)}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <span className="meta-text">
                                                        {createdAt(record) ? format(new Date(createdAt(record)), 'HH:mm') : ''}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })),
                                ])}
                            </tbody>
                        </table>
                        {!loading && records.length === 0 && (
                            <div className="empty-state">No records found.</div>
                        )}
                        {isExpenses && searchQuery.trim() && !fullDataLoaded && searchedRecords.length === 0 && (
                            <div className="empty-state">Loading… search when complete.</div>
                        )}
                        {searchQuery.trim() && fullDataLoaded && searchedRecords.length === 0 && (
                            <div className="empty-state">No search result.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecordsList;
