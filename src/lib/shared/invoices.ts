import { supabase } from './supabase';
import { Invoice, InvoiceItem } from '@/types';
import { getCurrentUser } from './auth';
import { findOrCreateCustomer, updateCustomer, getCustomerMergeMap, getCustomerById, resolveCustomerId } from './customers';
import { updateSupplier, getSupplierMergeMap, getSupplierById, resolveSupplierId } from './suppliers';
import { getAccountMergeMap, getAccountById, getAccountOptionsForDuplicateCheck, resolveAccountId, normalizeAccountName } from './accounts';
import { getCustomerOptions, getCustomerOptionsForDuplicateCheck } from './customer-supplier-list';
import { normalizeNameForCompare } from './name-utils';

function rowToInvoice(row: any, items: InvoiceItem[] = []): Invoice {
  const customerName =
    row.customer_name || row.customers?.name || row.suppliers?.name;
  return {
    id: row.id,
    spaceId: row.space_id,
    customerName,
    customerId: row.customer_id ?? undefined,
    customerSupplierId: row.customer_supplier_id ?? undefined,
    customer: row.customers ? {
      id: row.customers.id,
      spaceId: row.customers.space_id,
      name: row.customers.name,
      taxNumber: row.customers.tax_number,
      phone: row.customers.phone,
      address: row.customers.address,
      isAiRecognized: row.customers.is_ai_recognized,
      isSupplier: row.customers.is_supplier || false,
      createdAt: row.customers.created_at,
      updatedAt: row.customers.updated_at,
    } : undefined,
    customerSupplier: row.suppliers ? {
      id: row.suppliers.id,
      spaceId: row.suppliers.space_id,
      name: row.suppliers.name,
      taxNumber: row.suppliers.tax_number,
      phone: row.suppliers.phone,
      address: row.suppliers.address,
      isAiRecognized: row.suppliers.is_ai_recognized,
      isCustomer: row.suppliers.is_customer || false,
      createdAt: row.suppliers.created_at,
      updatedAt: row.suppliers.updated_at,
    } : undefined,
    totalAmount: Number(row.total_amount),
    currency: row.currency ?? undefined,
    tax: row.tax != null ? Number(row.tax) : undefined,
    date: row.date,
    accountId: row.account_id ?? undefined,
    account: row.accounts ? {
      id: row.accounts.id,
      spaceId: row.accounts.space_id,
      name: row.accounts.name,
      isAiRecognized: row.accounts.is_ai_recognized,
      createdAt: row.accounts.created_at,
      updatedAt: row.accounts.updated_at,
    } : undefined,
    status: row.status ?? 'pending',
    imageUrl: row.image_url ?? undefined,
    inputType: row.input_type ?? 'image',
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    processedBy: row.processed_by ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdByUser: row.created_by_user ? {
      id: row.created_by_user.id,
      email: row.created_by_user.email,
      name: row.created_by_user.name,
      spaceId: row.created_by_user.current_space_id ?? null,
    } : undefined,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 首屏极速加载：仅 invoices 表、limit 15、无 join，用于立即渲染，合计后续更新 */
const FIRST_PAINT_LIMIT = 15;

export async function getInvoicesForListFirstPaint(): Promise<Invoice[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');
  const spaceId = user.currentSpaceId || user.spaceId;
  if (!spaceId) throw new Error('No space selected');

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, space_id, customer_id, customer_supplier_id, customer_name, total_amount, currency, tax, date, account_id, status, image_url, input_type, confidence, processed_by, created_at, updated_at, created_by,
      customers (name),
      suppliers!invoices_customer_supplier_id_fkey (name),
      created_by_user:users!created_by (id, email, name, current_space_id)
    `)
    .eq('space_id', spaceId)
    .order('date', { ascending: false })
    .limit(FIRST_PAINT_LIMIT);

  if (error) throw error;
  const rows = data || [];
  return rows.map((r: any) => {
    const customerName = r.customer_name || r.customers?.name || r.suppliers?.name || '';
    return {
    id: r.id,
    spaceId: r.space_id,
    customerName,
    customerId: r.customer_id ?? undefined,
    customerSupplierId: r.customer_supplier_id ?? undefined,
    customer: undefined,
    customerSupplier: undefined,
    totalAmount: Number(r.total_amount),
    currency: r.currency ?? undefined,
    tax: r.tax != null ? Number(r.tax) : undefined,
    date: r.date,
    accountId: r.account_id ?? undefined,
    account: r.account_id ? { id: r.account_id, spaceId, name: '', isAiRecognized: false, createdAt: '', updatedAt: '' } : undefined,
    status: r.status ?? 'pending',
    imageUrl: r.image_url ?? undefined,
    inputType: r.input_type ?? 'image',
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    processedBy: r.processed_by ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdByUser: r.created_by_user ? {
      id: r.created_by_user.id,
      email: r.created_by_user.email,
      name: r.created_by_user.name,
      spaceId: r.created_by_user.current_space_id ?? null,
    } : undefined,
    items: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  });
}

/** 获取当前空间下所有发票（列表用，含 merge 解析，不含 items） */
export async function getAllInvoicesForList(): Promise<Invoice[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');
  const spaceId = user.currentSpaceId || user.spaceId;
  if (!spaceId) throw new Error('No space selected');

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers (*),
      suppliers!invoices_customer_supplier_id_fkey (*),
      accounts (*),
      created_by_user:users!created_by (id, email, name, current_space_id)
    `)
    .eq('space_id', spaceId)
    .order('date', { ascending: false });

  if (error) throw error;
  const rows = data || [];
  const [customerMergeMap, supplierMergeMap, accountMergeMap] = await Promise.all([
    getCustomerMergeMap(spaceId),
    getSupplierMergeMap(spaceId),
    getAccountMergeMap(spaceId),
  ]);
  const resolve = (map: Map<string, string>, id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (map.has(current) && !seen.has(current)) {
      seen.add(current);
      current = map.get(current)!;
    }
    return current;
  };
  
  // 优化：只查询 join 中缺失的数据
  const needCustomer = new Set<string>();
  const needSupplier = new Set<string>();
  const needAccount = new Set<string>();
  for (const r of rows) {
    if (r.customer_id) {
      const resolvedId = resolve(customerMergeMap, r.customer_id);
      if (!r.customers || r.customers.id !== resolvedId) {
        needCustomer.add(resolvedId);
      }
    }
    if (r.customer_supplier_id) {
      const resolvedId = resolve(supplierMergeMap, r.customer_supplier_id);
      if (!r.suppliers || r.suppliers.id !== resolvedId) {
        needSupplier.add(resolvedId);
      }
    }
    if (r.account_id) {
      const resolvedId = resolve(accountMergeMap, r.account_id);
      if (!r.accounts || r.accounts.id !== resolvedId) {
        needAccount.add(resolvedId);
      }
    }
  }
  
  const [customerCache, supplierCache, accountCache] = await Promise.all([
    needCustomer.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getCustomerById>>>();
      await Promise.all(Array.from(needCustomer).map(async (id) => { const c = await getCustomerById(id); if (c) m.set(id, c); }));
      return m;
    })() : Promise.resolve(new Map()),
    needSupplier.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getSupplierById>>>();
      await Promise.all(Array.from(needSupplier).map(async (id) => { const s = await getSupplierById(id); if (s) m.set(id, s); }));
      return m;
    })() : Promise.resolve(new Map()),
    needAccount.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getAccountById>>>();
      await Promise.all(Array.from(needAccount).map(async (id) => { const a = await getAccountById(id); if (a) m.set(id, a); }));
      return m;
    })() : Promise.resolve(new Map()),
  ]);
  
  return rows.map((r: any) => {
    const rc = { ...r };
    if (r.customer_id) {
      const resolvedId = resolve(customerMergeMap, r.customer_id);
      if (!r.customers || r.customers.id !== resolvedId) {
        rc.customers = customerCache.get(resolvedId);
      }
    }
    if (r.customer_supplier_id) {
      const resolvedId = resolve(supplierMergeMap, r.customer_supplier_id);
      if (!r.suppliers || r.suppliers.id !== resolvedId) {
        rc.suppliers = supplierCache.get(resolvedId);
      }
    }
    if (r.account_id) {
      const resolvedId = resolve(accountMergeMap, r.account_id);
      if (!r.accounts || r.accounts.id !== resolvedId) {
        rc.accounts = accountCache.get(resolvedId);
      }
    }
    return rowToInvoice(rc, []); // 列表页不加载 items
  });
}

/** 获取当前空间下所有发票（含 items 明细，用于列表页搜索等需要明细的场景） */
export async function getAllInvoicesWithItems(): Promise<Invoice[]> {
  const invoices = await getAllInvoices();
  const ids = invoices.map(inv => inv.id).filter((id): id is string => !!id);
  if (ids.length === 0) return invoices;
  const { data: itemRows } = await supabase
    .from('invoice_items')
    .select('id, name, price, invoice_id, category_id, purpose_id')
    .in('invoice_id', ids)
    .order('id', { ascending: true });
  const itemsByInvoice = new Map<string, InvoiceItem[]>();
  (itemRows || []).forEach((r: any) => {
    const list = itemsByInvoice.get(r.invoice_id) ?? [];
    list.push({ id: r.id, name: r.name, price: r.price });
    itemsByInvoice.set(r.invoice_id, list);
  });
  return invoices.map(inv =>
    inv.id && itemsByInvoice.has(inv.id)
      ? { ...inv, items: itemsByInvoice.get(inv.id)! }
      : inv
  );
}

/** 获取当前空间下所有发票（完整数据，不含 items；含 items 请用 getAllInvoicesWithItems） */
export async function getAllInvoices(): Promise<Invoice[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');
  const spaceId = user.currentSpaceId || user.spaceId;
  if (!spaceId) throw new Error('No space selected');

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customers (*),
      suppliers!invoices_customer_supplier_id_fkey (*),
      accounts (*),
      created_by_user:users!created_by (
        id,
        email,
        name,
        current_space_id
      )
    `)
    .eq('space_id', spaceId)
    .order('date', { ascending: false });

  if (error) throw error;
  const rows = data || [];
  const [customerMergeMap, supplierMergeMap, accountMergeMap] = await Promise.all([
    getCustomerMergeMap(spaceId),
    getSupplierMergeMap(spaceId),
    getAccountMergeMap(spaceId),
  ]);
  const resolve = (map: Map<string, string>, id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (map.has(current) && !seen.has(current)) {
      seen.add(current);
      current = map.get(current)!;
    }
    return current;
  };
  const needCustomer = new Set<string>();
  const needSupplier = new Set<string>();
  const needAccount = new Set<string>();
  for (const r of rows) {
    if (r.customer_id) {
      const resolvedId = resolve(customerMergeMap, r.customer_id);
      if (!r.customers || r.customers.id !== resolvedId) {
        needCustomer.add(resolvedId);
      }
    }
    if (r.customer_supplier_id) {
      const resolvedId = resolve(supplierMergeMap, r.customer_supplier_id);
      if (!r.suppliers || r.suppliers.id !== resolvedId) {
        needSupplier.add(resolvedId);
      }
    }
    if (r.account_id) {
      const resolvedId = resolve(accountMergeMap, r.account_id);
      if (!r.accounts || r.accounts.id !== resolvedId) {
        needAccount.add(resolvedId);
      }
    }
  }
  const [customerCache, supplierCache, accountCache] = await Promise.all([
    needCustomer.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getCustomerById>>>();
      await Promise.all(Array.from(needCustomer).map(async (id) => { const c = await getCustomerById(id); if (c) m.set(id, c); }));
      return m;
    })() : Promise.resolve(new Map()),
    needSupplier.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getSupplierById>>>();
      await Promise.all(Array.from(needSupplier).map(async (id) => { const s = await getSupplierById(id); if (s) m.set(id, s); }));
      return m;
    })() : Promise.resolve(new Map()),
    needAccount.size > 0 ? (async () => {
      const m = new Map<string, Awaited<ReturnType<typeof getAccountById>>>();
      await Promise.all(Array.from(needAccount).map(async (id) => { const a = await getAccountById(id); if (a) m.set(id, a); }));
      return m;
    })() : Promise.resolve(new Map()),
  ]);
  return rows.map((r: any) => {
    const rc = { ...r };
    if (r.customer_id) {
      const resolvedId = resolve(customerMergeMap, r.customer_id);
      if (!r.customers || r.customers.id !== resolvedId) {
        rc.customers = customerCache.get(resolvedId);
      }
    }
    if (r.customer_supplier_id) {
      const resolvedId = resolve(supplierMergeMap, r.customer_supplier_id);
      if (!r.suppliers || r.suppliers.id !== resolvedId) {
        rc.suppliers = supplierCache.get(resolvedId);
      }
    }
    if (r.account_id) {
      const resolvedId = resolve(accountMergeMap, r.account_id);
      if (!r.accounts || r.accounts.id !== resolvedId) {
        rc.accounts = accountCache.get(resolvedId);
      }
    }
    return rowToInvoice(rc, []);
  });
}

/** 根据 ID 获取发票（含明细、account、createdByUser、customer、items 的 category/purpose）；合并指向的客户/供应商会解析为最终目标展示 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const { data: inv, error: invError } = await supabase
    .from('invoices')
    .select(`
      *,
      customers (*),
      suppliers!invoices_customer_supplier_id_fkey (*),
      accounts (*),
      created_by_user:users!created_by (
        id,
        email,
        name,
        current_space_id
      )
    `)
    .eq('id', invoiceId)
    .single();
  if (invError || !inv) return null;

  const user = await getCurrentUser();
  const spaceId = user?.currentSpaceId || user?.spaceId;
  if (spaceId) {
    let customerRow = inv.customers;
    if (inv.customer_id && !customerRow) {
      const customerMergeMap = await getCustomerMergeMap(spaceId);
      let current = inv.customer_id;
      const seen = new Set<string>();
      while (customerMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = customerMergeMap.get(current)!;
      }
      customerRow = (await getCustomerById(current)) ?? undefined;
    }
    let supplierRow = inv.suppliers;
    if (inv.customer_supplier_id && !supplierRow) {
      const supplierMergeMap = await getSupplierMergeMap(spaceId);
      let current = inv.customer_supplier_id;
      const seen = new Set<string>();
      while (supplierMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = supplierMergeMap.get(current)!;
      }
      supplierRow = (await getSupplierById(current)) ?? undefined;
    }
    let accountRow = inv.accounts;
    if (inv.account_id && !accountRow) {
      const accountMergeMap = await getAccountMergeMap(spaceId);
      let current = inv.account_id;
      const seen = new Set<string>();
      while (accountMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = accountMergeMap.get(current)!;
      }
      accountRow = (await getAccountById(current)) ?? undefined;
    }
    inv.customers = customerRow;
    inv.suppliers = supplierRow;
    inv.accounts = accountRow;
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('invoice_items')
    .select(`
      *,
      categories (*),
      purposes (*)
    `)
    .eq('invoice_id', invoiceId)
    .order('id', { ascending: true });
  if (itemsError) return rowToInvoice(inv, []);

  const items: InvoiceItem[] = (itemRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id ?? undefined,
    category: r.categories ? {
      id: r.categories.id,
      spaceId: r.categories.space_id,
      name: r.categories.name,
      color: r.categories.color,
      isDefault: r.categories.is_default,
      createdAt: r.categories.created_at,
      updatedAt: r.categories.updated_at,
    } : undefined,
    purposeId: r.purpose_id ?? undefined,
    purpose: r.purposes ? {
      id: r.purposes.id,
      spaceId: r.purposes.space_id,
      name: r.purposes.name,
      color: r.purposes.color,
      isDefault: r.purposes.is_default,
      createdAt: r.purposes.created_at,
      updatedAt: r.purposes.updated_at,
    } : undefined,
    price: Number(r.price),
    isAsset: r.is_asset ?? false,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
  }));
  return rowToInvoice(inv, items);
}

/** 保存发票（新建或更新，含明细）— 占位实现，后续对接 AI 与完整 CRUD */
// autoResolveDuplicate: 如果为 true，遇到重复名称时自动使用已存在的ID，不抛出异常（用于后台处理场景）
export async function saveInvoice(invoice: Invoice, autoResolveDuplicate: boolean = false): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');
  const spaceId = user.currentSpaceId || user.spaceId;
  if (!spaceId) throw new Error('No space selected');

  // 客户：要么来自 customers 表（customer_id），要么来自“标记也是客户”的供应商（customer_supplier_id）
  let customerSupplierId = invoice.customerSupplierId ?? invoice.customerSupplier?.id ?? null;
  let customerId = invoice.customerId ?? invoice.customer?.id ?? null;
  const customerName = invoice.customerName ?? '';
  const trimmedCustomerName = customerName.trim();
  const invalidNames = ['processing', 'processing...', 'pending', 'pending...', 'loading', 'loading...', '识别中', '处理中', '待处理'];
  const isValidName = trimmedCustomerName.length > 0 && !invalidNames.includes(trimmedCustomerName.toLowerCase());

  const isUpdate = !!invoice.id;
  if (customerSupplierId) {
    customerId = null; // 二选一
  } else if (!customerId && invoice.customer) {
    customerId = invoice.customer.id;
  }
  // 仅新建时根据名称查找/创建客户；更新时不再创建新客户
  if (!isUpdate && !customerId && !customerSupplierId && isValidName) {
    try {
      const customer = await findOrCreateCustomer(trimmedCustomerName, true);
      customerId = customer.id;
    } catch (error) {
      console.warn('Failed to create or find customer:', error);
    }
  }

  if (invoice.id && spaceId) {
    if (isValidName) {
      const options = await getCustomerOptionsForDuplicateCheck();
      const foundByName = options.find((o) => normalizeNameForCompare(o.name) === normalizeNameForCompare(trimmedCustomerName));
      const currentResolvedId = customerSupplierId
        ? (await resolveSupplierId(spaceId, customerSupplierId))
        : customerId
          ? (await resolveCustomerId(spaceId, customerId))
          : null;

      if (foundByName) {
        const targetId = foundByName.source === 'supplier'
          ? await resolveSupplierId(spaceId, foundByName.id)
          : await resolveCustomerId(spaceId, foundByName.id);
        if (targetId !== currentResolvedId) {
          // 如果 autoResolveDuplicate = true（后台处理场景），自动使用已存在的ID
          // 如果 autoResolveDuplicate = false（UI 交互场景），抛出异常触发三选项弹窗
          if (autoResolveDuplicate) {
            // 后台处理场景：自动使用已存在的客户/供应商ID
            if (foundByName.source === 'supplier') {
              customerSupplierId = targetId ?? null;
              customerId = null;
            } else {
              customerId = targetId ?? null;
              customerSupplierId = null;
            }
            console.log(`客户/供应商名称已存在，自动使用已存在的ID: ${foundByName.source} ${targetId}`);
          } else {
            // UI 交互场景：已有关联，需要用户选择如何处理，抛出异常触发三选项弹窗
            const code = foundByName.source === 'customer' ? ('CUSTOMER_NAME_EXISTS' as const) : ('SUPPLIER_NAME_EXISTS' as const);
            throw Object.assign(new Error(foundByName.source === 'customer' ? '客户名称已存在' : '供应商名称已存在'), {
              code,
              duplicateName: trimmedCustomerName,
              targetId,
              targetSource: foundByName.source,
            });
          }
        }
      }

      if (customerSupplierId) {
        try {
          const targetId = await resolveSupplierId(spaceId, customerSupplierId);
          await updateSupplier(targetId, { name: trimmedCustomerName });
        } catch (e) {
          if (e instanceof Error && e.message === '供应商名称已存在') {
            // 如果 autoResolveDuplicate = true，静默处理，不抛出异常
            if (autoResolveDuplicate) {
              console.log('供应商名称已存在，跳过名称更新（已自动使用已存在的ID）');
            } else {
              throw Object.assign(new Error(e.message), { code: 'SUPPLIER_NAME_EXISTS' as const, duplicateName: trimmedCustomerName });
            }
          } else {
            console.warn('Failed to update supplier name for invoice:', e);
          }
        }
      } else if (customerId) {
        try {
          const targetId = await resolveCustomerId(spaceId, customerId);
          if (targetId) await updateCustomer(targetId, { name: trimmedCustomerName });
        } catch (e) {
          if (e instanceof Error && e.message === '客户名称已存在') {
            // 如果 autoResolveDuplicate = true，静默处理，不抛出异常
            if (autoResolveDuplicate) {
              console.log('客户名称已存在，跳过名称更新（已自动使用已存在的ID）');
            } else {
              throw Object.assign(new Error(e.message), { code: 'CUSTOMER_NAME_EXISTS' as const, duplicateName: trimmedCustomerName });
            }
          } else {
            console.warn('Failed to update customer name for invoice:', e);
          }
        }
      }
    }
    // 账户重复名校验（在客户校验之后，先处理客户再处理账户）
    if (invoice.accountId) {
      const accountName =
        ((invoice.account?.name ?? '').trim() || (await getAccountById(invoice.accountId))?.name) ?? '';
      if (accountName) {
        const accountOptions = await getAccountOptionsForDuplicateCheck();
        const currentResolvedId = await resolveAccountId(spaceId, invoice.accountId);
        const normalizedAccountName = normalizeAccountName(accountName);
        const found = accountOptions.find(
          (o) => o.id !== currentResolvedId && normalizeAccountName(o.name) === normalizedAccountName
        );
        if (found) {
          // 如果 autoResolveDuplicate = true（后台处理场景），自动使用已存在的账户ID
          // 如果 autoResolveDuplicate = false（UI 交互场景），抛出异常触发三选项弹窗
          if (autoResolveDuplicate) {
            // 后台处理场景：自动使用已存在的账户ID
            invoice.accountId = found.id;
            console.log(`账户名称已存在，自动使用已存在的ID: ${found.id}`);
          } else {
            // UI 交互场景：需要用户选择如何处理，抛出异常触发三选项弹窗
            throw Object.assign(new Error('账户名称已存在'), {
              code: 'ACCOUNT_NAME_EXISTS' as const,
              duplicateName: accountName,
              targetId: found.id,
            });
          }
        }
      }
    }
    await supabase
      .from('invoices')
      .update({
        customer_name: invoice.customerName,
        customer_id: customerId ?? null,
        customer_supplier_id: customerSupplierId ?? null,
        total_amount: invoice.totalAmount,
        currency: invoice.currency ?? null,
        tax: invoice.tax ?? null,
        date: invoice.date,
        account_id: invoice.accountId ?? null,
        status: invoice.status,
        image_url: invoice.imageUrl ?? null,
        input_type: invoice.inputType ?? 'image',
        confidence: invoice.confidence ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
    if (invoice.items?.length) {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      await supabase.from('invoice_items').insert(
        invoice.items.map((it) => ({
          invoice_id: invoice.id,
          name: it.name,
          category_id: it.categoryId ?? null,
          purpose_id: it.purposeId ?? null,
          price: it.price,
          is_asset: it.isAsset ?? false,
          confidence: it.confidence ?? null,
        }))
      );
    }
    return invoice.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('invoices')
    .insert({
      space_id: spaceId,
      customer_name: invoice.customerName,
      customer_id: customerId ?? null,
      customer_supplier_id: customerSupplierId ?? null,
      total_amount: invoice.totalAmount,
      currency: invoice.currency ?? null,
      tax: invoice.tax ?? null,
      date: invoice.date,
      account_id: invoice.accountId ?? null,
      status: invoice.status,
      image_url: invoice.imageUrl ?? null,
      input_type: invoice.inputType ?? 'image',
      confidence: invoice.confidence ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;
  const id = inserted.id;
  if (invoice.items?.length) {
    await supabase.from('invoice_items').insert(
      invoice.items.map((it) => ({
        invoice_id: id,
        name: it.name,
        category_id: it.categoryId ?? null,
        purpose_id: it.purposeId ?? null,
        price: it.price,
        is_asset: it.isAsset ?? false,
        confidence: it.confidence ?? null,
      }))
    );
  }
  return id;
}

/** 删除发票 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}

/** 更新发票单条明细的某个字段（用于详情页直接点选分类/用途/资产） */
export async function updateInvoiceItem(
  invoiceId: string,
  itemId: string,
  field: 'categoryId' | 'purposeId' | 'isAsset',
  value: any
): Promise<void> {
  const col = field === 'categoryId' ? 'category_id' : field === 'purposeId' ? 'purpose_id' : 'is_asset';
  const { error } = await supabase
    .from('invoice_items')
    .update({ [col]: value })
    .eq('id', itemId)
    .eq('invoice_id', invoiceId);
  if (error) throw error;
}
