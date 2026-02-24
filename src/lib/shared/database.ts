import { supabase } from './supabase';
import { Receipt, ReceiptItem, ReceiptStatus } from '@/types';
import { getCurrentUser } from './auth';
import { findCategoryByName } from './categories';
import { findOrCreateAccount, getAccountMergeMap, getAccountById } from './accounts';
import { updateSupplier, getSupplierMergeMap, getSupplierById, resolveSupplierId, findOrCreateSupplier } from './suppliers';
import { updateCustomer, getCustomerMergeMap, getCustomerById, resolveCustomerId } from './customers';
import { getSupplierOptions, getSupplierOptionsForDuplicateCheck } from './customer-supplier-list';
import { normalizeNameForCompare } from './name-utils';

// 将日期数据转换为 YYYY-MM-DD 格式的字符串，完全忠实于票面日期，不做任何时区转换
function normalizeDate(dateValue: any): string {
  if (!dateValue) {
    // 如果日期为空，返回今天的日期（使用本地时区）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 优先处理字符串，因为这是数据库 DATE 字段的原始格式
  if (typeof dateValue === 'string') {
    // 如果是 ISO 字符串（如 "2024-01-15T00:00:00Z"），只取日期部分，不进行时区转换
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // 如果已经是 YYYY-MM-DD 格式，直接返回，不做任何转换
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
  }

  // 如果是 Date 对象，需要小心处理时区问题
  // 为了避免时区转换问题，我们使用 UTC 方法而不是本地时区方法
  // 这样可以确保日期与数据库存储的日期一致
  if (dateValue instanceof Date) {
    // 使用 UTC 方法，确保与数据库 DATE 字段的存储方式一致
    // PostgreSQL DATE 类型不包含时区信息，总是按字面值存储
    const year = dateValue.getUTCFullYear();
    const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 其他情况，尝试转换为字符串
  return String(dateValue);
}

// 保存小票到数据库
export async function saveReceipt(receipt: Receipt): Promise<string> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('User not logged in when trying to save receipt');
      throw new Error('Not logged in: Please sign in before saving receipt');
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      console.error('User has no space ID');
      throw new Error('User not associated with space account, please sign in again');
    }

    // 供应商：要么来自 suppliers 表（supplier_id），要么来自“标记也是供应商”的客户（supplier_customer_id）
    let supplierId: string | null = receipt.supplierId ?? null;
    const supplierCustomerId = receipt.supplierCustomerId ?? null;
    const supplierName = receipt.supplierName || receipt.storeName;

    if (supplierCustomerId) {
      supplierId = null; // 二选一
    } else if (!supplierId && supplierName) {
      const trimmedSupplierName = supplierName.trim();
      const invalidNames = ['processing', 'processing...', 'pending', 'pending...', 'loading', 'loading...', '识别中', '处理中', '待处理'];
      const isValidName = !invalidNames.includes(trimmedSupplierName.toLowerCase());
      if (isValidName) {
        try {
          const supplier = await findOrCreateSupplier(trimmedSupplierName, true);
          supplierId = supplier.id;
        } catch (error) {
          console.warn('Failed to create or find supplier:', error);
        }
      }
    } else if (!supplierId && receipt.supplier) {
      supplierId = receipt.supplier.id;
    } else if (!supplierId && receipt.supplierCustomer) {
      // 已由 supplierCustomerId 处理
    }

    // 处理支付账户ID
    let accountId = receipt.accountId;
    if (!accountId && receipt.account) {
      const account = await findOrCreateAccount(receipt.account.name || receipt.account.id, true);
      accountId = account.id;
    }

    // 先保存小票主记录（名称以 ID 为准，不写 supplier_name；若表仍有该列可为空）
    const insertPayload: Record<string, unknown> = {
      space_id: spaceId,
      supplier_id: supplierId,
      supplier_customer_id: supplierCustomerId || null,
      total_amount: receipt.totalAmount,
      currency: receipt.currency,
      tax: receipt.tax,
      date: receipt.date,
      account_id: accountId,
      status: receipt.status,
      image_url: receipt.imageUrl,
      input_type: receipt.inputType || 'image',
      confidence: receipt.confidence,
      processed_by: receipt.processedBy,
      created_by: user.id,
    };
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert(insertPayload)
      .select()
      .single();

    if (receiptError) {
      console.error('Receipt insert error:', receiptError);
      console.error('User info:', {
        userId: user.id,
        spaceId: spaceId,
        email: user.email,
      });
      console.error('Receipt data being inserted:', {
        space_id: spaceId,
        total_amount: receipt.totalAmount,
        date: receipt.date,
      });

      if (receiptError.message?.includes('row-level security') || receiptError.code === '42501') {
        throw new Error(
          'Database permission error: Unable to save receipt\n\n' +
          'Possible causes:\n' +
          '1. RLS policy not configured correctly - Please execute fix-receipts-rls-force.sql in Supabase\n' +
          '2. get_user_space_id() function returns NULL - Check if user has associated space\n' +
          '3. space_id mismatch - Please sign in again\n\n' +
          'Current user info:\n' +
          `- User ID: ${user.id}\n` +
          `- Space ID: ${spaceId || 'NULL (not associated)'}\n` +
          `- Email: ${user.email}\n\n` +
          'Please execute diagnose-rls-issue.sql script to view detailed status'
        );
      }
      throw receiptError;
    }

    const receiptId = receiptData.id;

    // 保存商品项（需要将分类名称匹配到分类ID）
    console.log('Saving receipt items:', receipt.items?.length || 0, 'items');
    if (receipt.items && receipt.items.length > 0) {
      const itemsToInsert: any[] = [];

      for (const item of receipt.items) {
        let categoryId: string | null | undefined = item.categoryId;

        // 如果没有categoryId但有category对象，使用category.id
        if (!categoryId && item.category) {
          categoryId = item.category.id;
        }

        // 如果还是没有，尝试通过名称查找（兼容旧代码）
        if (!categoryId) {
          const category = await findCategoryByName(item.name || 'Other');
          categoryId = category?.id || null;
        }

        if (!categoryId) {
          // 如果仍然找不到，尝试获取默认分类
          console.warn(`商品 "${item.name}" 的分类未找到，使用默认分类`);

          // 尝试按优先级查找默认分类
          const defaultCategoryNames = ['购物', '食品', 'Other', 'Grocery'];
          let defaultCategory = null;

          for (const defaultName of defaultCategoryNames) {
            defaultCategory = await findCategoryByName(defaultName);
            if (defaultCategory) break;
          }

          if (!defaultCategory) {
            // 如果都找不到，尝试获取第一个默认分类
            const { data: defaultCategories } = await supabase
              .from('categories')
              .select('id')
              .eq('space_id', spaceId)
              .eq('is_default', true)
              .limit(1);

            if (!defaultCategories || defaultCategories.length === 0) {
              // 如果连默认分类都没有，尝试获取任何第一个分类
              const { data: anyCategories } = await supabase
                .from('categories')
                .select('id')
                .eq('space_id', spaceId)
                .limit(1);

              if (!anyCategories || anyCategories.length === 0) {
                throw new Error(
                  'No categories found.\n\n' +
                  'Please do one of the following:\n' +
                  '1. Execute add-default-categories-for-existing-users.sql in Supabase SQL Editor\n' +
                  '2. Or manually create at least one category in the app\n\n' +
                  'Current user space ID: ' + (spaceId || 'Unknown')
                );
              }
              categoryId = anyCategories[0].id;
            } else {
              categoryId = defaultCategories[0].id;
            }
          } else {
            categoryId = defaultCategory.id;
          }
        }

        itemsToInsert.push({
          receipt_id: receiptId,
          name: item.name,
          category_id: categoryId,
          purpose_id: item.purposeId ?? null,
          price: item.price,
          is_asset: item.isAsset !== undefined ? item.isAsset : false, // 确保 isAsset 不为 null
          confidence: item.confidence,
        });
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('receipt_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Receipt items insert error:', itemsError);
          if (itemsError.message?.includes('row-level security') || itemsError.code === '42501') {
            throw new Error('Database permission error: Unable to save items, please check RLS policy');
          }
          throw itemsError;
        }
      }
    }

    return receiptId;
  } catch (error) {
    console.error('Error saving receipt:', error);
    throw error;
  }
}

// 更新小票（不创建新供应商/客户：有关联则更新实体名称，无关联则仅更新小票上的商家名称文本）
// autoResolveDuplicate: 如果为 true，遇到重复名称时自动使用已存在的ID，不抛出异常（用于后台处理场景）
export async function updateReceipt(receiptId: string, receipt: Partial<Receipt>, autoResolveDuplicate: boolean = false): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    let supplierCustomerId = receipt.supplierCustomerId ?? undefined;
    let supplierId = receipt.supplierId;
    const supplierName = receipt.supplierName ?? receipt.storeName ?? '';
    const trimmedSupplierName = supplierName.trim();
    const invalidNames = ['processing', 'processing...', 'pending', 'pending...', 'loading', 'loading...', '识别中', '处理中', '待处理'];
    const isValidName = trimmedSupplierName.length > 0 && !invalidNames.includes(trimmedSupplierName.toLowerCase());

    if (!supplierCustomerId && receipt.supplier && !supplierId) {
      supplierId = receipt.supplier.id;
    }

    // 名称有效时：先按名称检查是否与已有供应商/客户重复（含已合并指向的），再决定是抛错（触发三选项）还是执行重命名
    if (isValidName) {
      const options = await getSupplierOptionsForDuplicateCheck();
      const foundByName = options.find((o) => normalizeNameForCompare(o.name) === normalizeNameForCompare(trimmedSupplierName));
      const currentResolvedId = supplierCustomerId
        ? (await resolveCustomerId(spaceId, supplierCustomerId))
        : supplierId
          ? (await resolveSupplierId(spaceId, supplierId))
          : null;

      if (foundByName) {
        // 解析到最终目标，避免 A→B→C 链；合并时 A 直接指向 C
        const targetId = foundByName.source === 'supplier'
          ? await resolveSupplierId(spaceId, foundByName.id)
          : await resolveCustomerId(spaceId, foundByName.id);
        if (targetId !== currentResolvedId) {
          // 如果 autoResolveDuplicate 为 true（后台处理场景），自动使用已存在的ID
          // 如果 autoResolveDuplicate 为 false（UI 交互场景），抛出异常触发三选项弹窗
          if (autoResolveDuplicate) {
            // 后台处理场景：自动使用已存在的供应商/客户ID
            if (foundByName.source === 'supplier') {
              supplierId = targetId;
              supplierCustomerId = undefined; // 清除 customerId，确保只关联 supplier
            } else {
              // foundByName.source === 'customer'
              supplierCustomerId = targetId;
              supplierId = undefined; // 清除 supplierId，确保只关联 customer
            }
            // 继续执行，不抛出异常
            console.log(`供应商/客户名称已存在，自动使用已存在的ID: ${foundByName.source} ${targetId}`);
          } else {
            // UI 交互场景：已有关联，需要用户选择如何处理，抛出异常触发三选项弹窗
            const code = foundByName.source === 'customer' ? ('CUSTOMER_NAME_EXISTS' as const) : ('SUPPLIER_NAME_EXISTS' as const);
            throw Object.assign(new Error(foundByName.source === 'customer' ? '客户名称已存在' : '供应商名称已存在'), {
              code,
              duplicateName: trimmedSupplierName,
              targetId,
              targetSource: foundByName.source,
            });
          }
        }
      }

      // 未重复或与当前同一条：更新“最终指向”的那条名称
      if (supplierCustomerId) {
        try {
          const targetId = await resolveCustomerId(spaceId, supplierCustomerId);
          await updateCustomer(targetId, { name: trimmedSupplierName });
        } catch (e) {
          if (e instanceof Error && e.message === '客户名称已存在') {
            // 如果 autoResolveDuplicate = true，静默处理，不抛出异常
            if (autoResolveDuplicate) {
              console.log('客户名称已存在，跳过名称更新（已自动使用已存在的ID）');
            } else {
              throw Object.assign(new Error(e.message), { code: 'CUSTOMER_NAME_EXISTS' as const, duplicateName: trimmedSupplierName });
            }
          } else {
            console.warn('Failed to update customer name:', e);
          }
        }
      } else if (supplierId) {
        try {
          const targetId = await resolveSupplierId(spaceId, supplierId);
          await updateSupplier(targetId, { name: trimmedSupplierName });
        } catch (e) {
          if (e instanceof Error && e.message === '供应商名称已存在') {
            // 如果 autoResolveDuplicate = true，静默处理，不抛出异常
            if (autoResolveDuplicate) {
              console.log('供应商名称已存在，跳过名称更新（已自动使用已存在的ID）');
            } else {
              throw Object.assign(new Error(e.message), { code: 'SUPPLIER_NAME_EXISTS' as const, duplicateName: trimmedSupplierName });
            }
          } else {
            console.warn('Failed to update supplier name:', e);
          }
        }
      }
    }

    // 处理支付账户ID
    let accountId = receipt.accountId;
    if (!accountId && receipt.account) {
      const account = await findOrCreateAccount(receipt.account.name || receipt.account.id, true);
      accountId = account.id;
    }

    // 更新小票主记录（名称以 ID 为准；更换 ID 由详情页在用户选“更换”后再次调用并传入新 supplierId/supplierCustomerId）
    // 仅当有 truthy 的 supplierId/supplierCustomerId 或显式传 null 清空时才更新；否则保留现有 supplier（避免聊天窗确认时置空）
    const updateData: any = {};
    if (supplierCustomerId) {
      updateData.supplier_customer_id = supplierCustomerId;
      updateData.supplier_id = null;
    } else if (supplierId) {
      updateData.supplier_id = supplierId;
      updateData.supplier_customer_id = null;
    } else if (receipt.supplierId === null && receipt.supplierCustomerId === null) {
      updateData.supplier_id = null;
      updateData.supplier_customer_id = null;
    }
    // 否则不写入 supplier 字段，保留库内原值
    if (receipt.totalAmount !== undefined) updateData.total_amount = receipt.totalAmount;
    if (receipt.currency !== undefined) updateData.currency = receipt.currency;
    if (receipt.tax !== undefined) updateData.tax = receipt.tax;
    if (receipt.date !== undefined) updateData.date = receipt.date;
    if (accountId !== undefined) updateData.account_id = accountId;
    if (receipt.status !== undefined) updateData.status = receipt.status;
    if (receipt.confidence !== undefined) updateData.confidence = receipt.confidence;
    if (receipt.imageUrl !== undefined) updateData.image_url = receipt.imageUrl;

    const { error: receiptError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receiptId)
                .eq('space_id', spaceId);

    if (receiptError) throw receiptError;

    // 如果更新了商品项，先删除旧的再插入新的
    if (receipt.items !== undefined) {
      // 删除旧商品项
      await supabase
        .from('receipt_items')
        .delete()
        .eq('receipt_id', receiptId);

      // 插入新商品项
      if (receipt.items.length > 0) {
        const itemsToInsert: any[] = [];

        for (const item of receipt.items) {
          let categoryId = item.categoryId;
          if (!categoryId && item.category) {
            categoryId = item.category.id;
          }
          if (!categoryId) {
            throw new Error(`Item "${item.name}" is missing category ID`);
          }

          itemsToInsert.push({
            receipt_id: receiptId,
            name: item.name,
            category_id: categoryId,
            purpose_id: item.purposeId ?? null,
            price: item.price,
            is_asset: item.isAsset !== undefined ? item.isAsset : false, // 确保 isAsset 不为 null
            confidence: item.confidence,
          });
        }

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('receipt_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }
    }
  } catch (error: any) {
    // 如果 autoResolveDuplicate = true，不应该再抛出这些业务分支异常
    // 如果 autoResolveDuplicate = false（UI 交互场景），抛出异常触发三选项弹窗
    if (error?.code === 'SUPPLIER_NAME_EXISTS' || error?.code === 'CUSTOMER_NAME_EXISTS') {
      if (autoResolveDuplicate) {
        // 后台处理场景：不应该到达这里，但如果到达了，静默处理
        console.warn('Unexpected duplicate name error in auto-resolve mode, ignoring:', error);
        return; // 静默返回，不抛出异常
      } else {
        throw error; // UI 交互场景：抛出异常触发三选项弹窗
      }
    }
    console.error('Error updating receipt:', error);
    throw error;
  }
}

// 获取所有小票（当前家庭的）

/** 首屏极速加载：仅 receipts 表、limit 15、无 join，用于立即渲染，合计后续更新 */
const FIRST_PAINT_LIMIT = 15;

export async function getReceiptsForListFirstPaint(): Promise<Receipt[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');
  const spaceId = user.currentSpaceId || user.spaceId;
  if (!spaceId) throw new Error('No space selected');

  const { data, error } = await supabase
    .from('receipts')
    .select(`
      id, space_id, supplier_id, supplier_customer_id, total_amount, currency, tax, date, account_id, status, image_url, input_type, confidence, processed_by, created_at, updated_at, created_by,
      suppliers (name),
      customers!receipts_supplier_customer_id_fkey (name),
      created_by_user:users!created_by (id, email, name, current_space_id)
    `)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(FIRST_PAINT_LIMIT);

  if (error) throw error;
  const rows = data || [];
  return rows.map((row: any) => {
    const supplierName = row.suppliers?.name || row.customers?.name || '';
    return {
    id: row.id,
    spaceId: row.space_id,
    supplierName,
    storeName: supplierName,
    supplierId: row.supplier_id ?? undefined,
    supplierCustomerId: row.supplier_customer_id ?? undefined,
    supplier: undefined,
    supplierCustomer: undefined,
    totalAmount: row.total_amount,
    currency: row.currency,
    tax: row.tax,
    date: normalizeDate(row.date),
    accountId: row.account_id,
    account: row.account_id ? { id: row.account_id, spaceId, name: '', isAiRecognized: false, createdAt: '', updatedAt: '' } : undefined,
    status: row.status as ReceiptStatus,
    imageUrl: row.image_url,
    inputType: row.input_type || (row.image_url ? 'image' : 'text'),
    confidence: row.confidence,
    processedBy: row.processed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    createdByUser: row.created_by_user ? {
      id: row.created_by_user.id,
      email: row.created_by_user.email,
      name: row.created_by_user.name,
      spaceId: row.created_by_user.current_space_id,
    } : undefined,
    items: [],
  };
  });
}

/** 获取当前空间下所有小票（列表用，含 merge 解析，不加载 items 明细） */
export async function getAllReceiptsForList(): Promise<Receipt[]> {
  try {
    console.log('📊 [getAllReceiptsForList] 开始查询小票数据（含 merge 解析）...');
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        suppliers (*),
        accounts (*),
        customers!receipts_supplier_customer_id_fkey (*),
        created_by_user:users!created_by (id, email, name, current_space_id)
      `)
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // merge maps 和 getById 解析（后加载阶段）
    const rows = data || [];
    const [mergeMap, customerMergeMap, accountMergeMap] = await Promise.all([
      getSupplierMergeMap(spaceId),
      getCustomerMergeMap(spaceId),
      getAccountMergeMap(spaceId),
    ]);
    
    const resolveSupplier = (sid: string) => {
      let current = sid;
      const seen = new Set<string>();
      while (mergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = mergeMap.get(current)!;
      }
      return current;
    };
    const resolveCustomer = (cid: string) => {
      let current = cid;
      const seen = new Set<string>();
      while (customerMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = customerMergeMap.get(current)!;
      }
      return current;
    };
    const resolveAccount = (aid: string) => {
      let current = aid;
      const seen = new Set<string>();
      while (accountMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = accountMergeMap.get(current)!;
      }
      return current;
    };

    // 优化：只查询 join 中缺失的数据
    const needResolvedSupplier = new Set<string>();
    const needResolvedCustomer = new Set<string>();
    const needResolvedAccount = new Set<string>();
    for (const row of rows) {
      if (row.supplier_id) {
        const resolvedId = resolveSupplier(row.supplier_id);
        // 如果 join 的数据不存在或 ID 不匹配，才需要额外查询
        if (!row.suppliers || row.suppliers.id !== resolvedId) {
          needResolvedSupplier.add(resolvedId);
        }
      }
      if (row.supplier_customer_id) {
        const resolvedId = resolveCustomer(row.supplier_customer_id);
        if (!row.customers || row.customers.id !== resolvedId) {
          needResolvedCustomer.add(resolvedId);
        }
      }
      if (row.account_id) {
        const resolvedId = resolveAccount(row.account_id);
        if (!row.accounts || row.accounts.id !== resolvedId) {
          needResolvedAccount.add(resolvedId);
        }
      }
    }

    const [resolvedSupplierCache, resolvedCustomerCache, resolvedAccountCache] = await Promise.all([
      needResolvedSupplier.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getSupplierById>>>();
        await Promise.all(
          Array.from(needResolvedSupplier).map(async (id) => {
            const s = await getSupplierById(id);
            if (s) m.set(id, s);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
      needResolvedCustomer.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getCustomerById>>>();
        await Promise.all(
          Array.from(needResolvedCustomer).map(async (id) => {
            const c = await getCustomerById(id);
            if (c) m.set(id, c);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
      needResolvedAccount.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getAccountById>>>();
        await Promise.all(
          Array.from(needResolvedAccount).map(async (id) => {
            const a = await getAccountById(id);
            if (a) m.set(id, a);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
    ]);

    const mappedReceipts = rows.map((row: any) => {
      const resolvedSupplierId = row.supplier_id ? resolveSupplier(row.supplier_id) : null;
      const resolvedCustomerId = row.supplier_customer_id ? resolveCustomer(row.supplier_customer_id) : null;
      const resolvedAccountId = row.account_id ? resolveAccount(row.account_id) : null;
      const supplierRow = (resolvedSupplierId ? resolvedSupplierCache.get(resolvedSupplierId) : null) ?? row.suppliers;
      const customerRow = (resolvedCustomerId ? resolvedCustomerCache.get(resolvedCustomerId) : null) ?? row.customers;
      const accountRow = (resolvedAccountId ? resolvedAccountCache.get(resolvedAccountId) : null) ?? row.accounts;
      const supplierName = supplierRow?.name || customerRow?.name || row.supplier_name;
      return {
        id: row.id,
        spaceId: row.space_id,
        supplierName,
        storeName: supplierRow?.name ?? customerRow?.name ?? row.supplier_name,
        supplierId: row.supplier_id ?? undefined,
        supplierCustomerId: row.supplier_customer_id ?? undefined,
        supplier: supplierRow ? {
          id: supplierRow.id,
          spaceId: supplierRow.space_id,
          name: supplierRow.name,
          taxNumber: supplierRow.tax_number,
          phone: supplierRow.phone,
          address: supplierRow.address,
          isAiRecognized: supplierRow.is_ai_recognized,
          isCustomer: (supplierRow as any).is_customer ?? false,
          createdAt: supplierRow.created_at,
          updatedAt: supplierRow.updated_at,
        } : undefined,
        supplierCustomer: customerRow ? {
          id: customerRow.id,
          spaceId: customerRow.space_id,
          name: customerRow.name,
          taxNumber: customerRow.tax_number,
          phone: customerRow.phone,
          address: customerRow.address,
          isAiRecognized: customerRow.is_ai_recognized,
          isSupplier: customerRow.is_supplier || false,
          createdAt: customerRow.created_at,
          updatedAt: customerRow.updated_at,
        } : undefined,
        totalAmount: row.total_amount,
        currency: row.currency,
        tax: row.tax,
        date: normalizeDate(row.date),
        accountId: row.account_id,
        account: accountRow ? {
          id: accountRow.id,
          spaceId: accountRow.space_id,
          name: accountRow.name,
          isAiRecognized: accountRow.is_ai_recognized,
          createdAt: accountRow.created_at,
          updatedAt: accountRow.updated_at,
        } : undefined,
        status: row.status as ReceiptStatus,
        imageUrl: row.image_url,
        inputType: row.input_type || (row.image_url ? 'image' : 'text'),
        confidence: row.confidence,
        processedBy: row.processed_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        createdByUser: row.created_by_user ? {
          id: row.created_by_user.id,
          email: row.created_by_user.email,
          name: row.created_by_user.name,
          spaceId: row.created_by_user.current_space_id,
        } : undefined,
        items: [], // 列表页不加载 items，提升性能
      };
    });
    
    console.log(`✅ [getAllReceiptsForList] 数据映射完成，返回 ${mappedReceipts.length} 条小票（轻量级）`);
    return mappedReceipts;
  } catch (error) {
    console.error('❌ [getAllReceiptsForList] 查询失败:', error);
    throw error;
  }
}

/** 获取当前空间下所有小票（完整数据，包含 items，用于详情页等需要完整数据的场景） */
export async function getAllReceipts(): Promise<Receipt[]> {
  try {
    console.log('📊 [getAllReceipts] 开始查询小票数据（完整数据）...');
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        suppliers (*),
        accounts (*),
        customers!receipts_supplier_customer_id_fkey (*),
        created_by_user:users!created_by (
          id,
          email,
          name,
          current_space_id
        ),
        receipt_items (
          *,
          categories (*),
          purposes (*)
        )
      `)
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'receipt_items', ascending: true });

    if (error) throw error;

    const [mergeMap, customerMergeMap, accountMergeMap] = await Promise.all([
      getSupplierMergeMap(spaceId),
      getCustomerMergeMap(spaceId),
      getAccountMergeMap(spaceId),
    ]);
    const resolveSupplier = (sid: string) => {
      let current = sid;
      const seen = new Set<string>();
      while (mergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = mergeMap.get(current)!;
      }
      return current;
    };
    const resolveCustomer = (cid: string) => {
      let current = cid;
      const seen = new Set<string>();
      while (customerMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = customerMergeMap.get(current)!;
      }
      return current;
    };
    const resolveAccount = (aid: string) => {
      let current = aid;
      const seen = new Set<string>();
      while (accountMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = accountMergeMap.get(current)!;
      }
      return current;
    };

    const rows = data || [];
    const needResolvedSupplier = new Set<string>();
    const needResolvedCustomer = new Set<string>();
    const needResolvedAccount = new Set<string>();
    for (const row of rows) {
      if (row.supplier_id) {
        const resolvedId = resolveSupplier(row.supplier_id);
        if (!row.suppliers || row.suppliers.id !== resolvedId) {
          needResolvedSupplier.add(resolvedId);
        }
      }
      if (row.supplier_customer_id) {
        const resolvedId = resolveCustomer(row.supplier_customer_id);
        if (!row.customers || row.customers.id !== resolvedId) {
          needResolvedCustomer.add(resolvedId);
        }
      }
      if (row.account_id) {
        const resolvedId = resolveAccount(row.account_id);
        if (!row.accounts || row.accounts.id !== resolvedId) {
          needResolvedAccount.add(resolvedId);
        }
      }
    }
    const [resolvedSupplierCache, resolvedCustomerCache, resolvedAccountCache] = await Promise.all([
      needResolvedSupplier.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getSupplierById>>>();
        await Promise.all(
          Array.from(needResolvedSupplier).map(async (id) => {
            const s = await getSupplierById(id);
            if (s) m.set(id, s);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
      needResolvedCustomer.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getCustomerById>>>();
        await Promise.all(
          Array.from(needResolvedCustomer).map(async (id) => {
            const c = await getCustomerById(id);
            if (c) m.set(id, c);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
      needResolvedAccount.size > 0 ? (async () => {
        const m = new Map<string, Awaited<ReturnType<typeof getAccountById>>>();
        await Promise.all(
          Array.from(needResolvedAccount).map(async (id) => {
            const a = await getAccountById(id);
            if (a) m.set(id, a);
          })
        );
        return m;
      })() : Promise.resolve(new Map()),
    ]);

    const mappedReceipts = rows.map((row: any) => {
      const resolvedSupplierId = row.supplier_id ? resolveSupplier(row.supplier_id) : null;
      const resolvedCustomerId = row.supplier_customer_id ? resolveCustomer(row.supplier_customer_id) : null;
      const resolvedAccountId = row.account_id ? resolveAccount(row.account_id) : null;
      const supplierRow = (resolvedSupplierId ? resolvedSupplierCache.get(resolvedSupplierId) : null) ?? row.suppliers;
      const customerRow = (resolvedCustomerId ? resolvedCustomerCache.get(resolvedCustomerId) : null) ?? row.customers;
      const accountRow = (resolvedAccountId ? resolvedAccountCache.get(resolvedAccountId) : null) ?? row.accounts;
      const supplierName = supplierRow?.name || customerRow?.name || row.supplier_name;
      return {
        id: row.id,
        spaceId: row.space_id,
        supplierName,
        storeName: supplierRow?.name ?? customerRow?.name ?? row.supplier_name,
        supplierId: row.supplier_id ?? undefined,
        supplierCustomerId: row.supplier_customer_id ?? undefined,
        supplier: supplierRow ? {
          id: supplierRow.id,
          spaceId: supplierRow.space_id,
          name: supplierRow.name,
          taxNumber: supplierRow.tax_number,
          phone: supplierRow.phone,
          address: supplierRow.address,
          isAiRecognized: supplierRow.is_ai_recognized,
          isCustomer: (supplierRow as any).is_customer ?? false,
          createdAt: supplierRow.created_at,
          updatedAt: supplierRow.updated_at,
        } : undefined,
        supplierCustomer: customerRow ? {
          id: customerRow.id,
          spaceId: customerRow.space_id,
          name: customerRow.name,
          taxNumber: customerRow.tax_number,
          phone: customerRow.phone,
          address: customerRow.address,
          isAiRecognized: customerRow.is_ai_recognized,
          isSupplier: customerRow.is_supplier || false,
          createdAt: customerRow.created_at,
          updatedAt: customerRow.updated_at,
        } : undefined,
        totalAmount: row.total_amount,
        currency: row.currency,
        tax: row.tax,
        date: normalizeDate(row.date),
        accountId: row.account_id,
        account: accountRow ? {
          id: accountRow.id,
          spaceId: accountRow.space_id,
          name: accountRow.name,
          isAiRecognized: accountRow.is_ai_recognized,
          createdAt: accountRow.created_at,
          updatedAt: accountRow.updated_at,
        } : undefined,
        status: row.status as ReceiptStatus,
        imageUrl: row.image_url,
        inputType: row.input_type || (row.image_url ? 'image' : 'text'),
        confidence: row.confidence,
        processedBy: row.processed_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        createdByUser: row.created_by_user ? {
          id: row.created_by_user.id,
          email: row.created_by_user.email,
          name: row.created_by_user.name,
          spaceId: row.created_by_user.current_space_id,
        } : undefined,
        items: (row.receipt_items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          categoryId: item.category_id,
          category: item.categories ? {
            id: item.categories.id,
            spaceId: item.categories.space_id,
            name: item.categories.name,
            color: item.categories.color,
            isDefault: item.categories.is_default,
            createdAt: item.categories.created_at,
            updatedAt: item.categories.updated_at,
          } : undefined,
          purposeId: item.purpose_id ?? null,
          purpose: item.purposes ? {
            id: item.purposes.id,
            spaceId: item.purposes.space_id,
            name: item.purposes.name,
            color: item.purposes.color,
            isDefault: item.purposes.is_default,
            createdAt: item.purposes.created_at,
            updatedAt: item.purposes.updated_at,
          } : undefined,
          price: item.price,
          isAsset: item.is_asset,
          confidence: item.confidence,
        })),
      };
    });
    
    console.log(`✅ [getAllReceipts] 数据映射完成，返回 ${mappedReceipts.length} 条小票（完整数据）`);
    return mappedReceipts;
  } catch (error) {
    console.error('❌ [getAllReceipts] 查询失败:', error);
    throw error;
  }
}

// 更新单个商品项的某个字段
export async function updateReceiptItem(
  receiptId: string,
  itemId: string,
  field: 'categoryId' | 'purposeId' | 'isAsset',
  value: any
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 构建更新数据
    const updateData: any = {};
    if (field === 'categoryId') {
      updateData.category_id = value;
    } else if (field === 'purposeId') {
      updateData.purpose_id = value;
    } else if (field === 'isAsset') {
      updateData.is_asset = value;
    }

    // 更新商品项（直接使用 itemId，不依赖索引）
    const { error } = await supabase
      .from('receipt_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('receipt_id', receiptId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating receipt item:', error);
    throw error;
  }
}

// 获取用户历史小票中最频繁的币种
export async function getMostFrequentCurrency(): Promise<string | null> {
  const currencies = await getCurrenciesByUsage();
  return currencies.length > 0 ? currencies[0] : null;
}

// 获取用户历史小票中所有币种（按使用频率降序排列）
export async function getCurrenciesByUsage(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 查询当前家庭的所有小票，统计币种出现频次
    const { data, error } = await supabase
      .from('receipts')
      .select('currency')
      .eq('space_id', spaceId)
      .not('currency', 'is', null);

    if (error) {
      console.warn('Error fetching currency statistics:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 统计币种出现频次
    const currencyCount: Record<string, number> = {};
    data.forEach((receipt: any) => {
      const currency = receipt.currency;
      if (currency) {
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
      }
    });

    // 按使用频率降序排列
    const sortedCurrencies = Object.entries(currencyCount)
      .sort((a, b) => b[1] - a[1])
      .map(([currency]) => currency);

    return sortedCurrencies;
  } catch (error) {
    console.warn('Error getting currencies by usage:', error);
    return [];
  }
}

// 根据ID获取小票
export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        suppliers (*),
        accounts (*),
        customers!receipts_supplier_customer_id_fkey (*),
        created_by_user:users!created_by (
          id,
          email,
          name,
          current_space_id
        ),
        receipt_items (
          *,
          categories (*),
          purposes (*)
        )
      `)
      .eq('id', receiptId)
                .eq('space_id', spaceId)
      .order('created_at', { foreignTable: 'receipt_items', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    if (!data) return null;

    // 有 supplier_id 时始终按 merge 解析到最终目标，再取目标行展示名称（避免合并后仍显示源名称）
    let supplierRow: Awaited<ReturnType<typeof getSupplierById>> | undefined;
    if (data.supplier_id) {
      const mergeMap = await getSupplierMergeMap(spaceId);
      let current = data.supplier_id;
      const seen = new Set<string>();
      while (mergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = mergeMap.get(current)!;
      }
      supplierRow = (await getSupplierById(current)) ?? undefined;
    }
    if (!supplierRow && data.suppliers) supplierRow = data.suppliers;

    // 有 supplier_customer_id 时始终按 merge 解析到最终目标再展示名称
    let customerRow: Awaited<ReturnType<typeof getCustomerById>> | undefined;
    if (data.supplier_customer_id) {
      const customerMergeMap = await getCustomerMergeMap(spaceId);
      let current = data.supplier_customer_id;
      const seen = new Set<string>();
      while (customerMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = customerMergeMap.get(current)!;
      }
      customerRow = (await getCustomerById(current)) ?? undefined;
    }
    if (!customerRow && data.customers) customerRow = data.customers;

    // 有 account_id 时始终按 merge 解析到最终目标再展示名称
    let accountRow: Awaited<ReturnType<typeof getAccountById>> | undefined;
    if (data.account_id) {
      const accountMergeMap = await getAccountMergeMap(spaceId);
      let current = data.account_id;
      const seen = new Set<string>();
      while (accountMergeMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = accountMergeMap.get(current)!;
      }
      accountRow = (await getAccountById(current)) ?? undefined;
    }
    if (!accountRow && data.accounts) accountRow = data.accounts;

    return {
      id: data.id,
      spaceId: data.space_id,
      supplierName: supplierRow?.name ?? customerRow?.name ?? data.supplier_name,
      storeName: supplierRow?.name ?? customerRow?.name ?? data.supplier_name,
      supplierId: data.supplier_id ?? undefined,
      supplierCustomerId: data.supplier_customer_id ?? undefined,
      supplier: supplierRow ? {
        id: supplierRow.id,
        spaceId: supplierRow.space_id,
        name: supplierRow.name,
        taxNumber: supplierRow.tax_number,
        phone: supplierRow.phone,
        address: supplierRow.address,
        isAiRecognized: supplierRow.is_ai_recognized,
        isCustomer: (supplierRow as any).is_customer ?? false,
        createdAt: supplierRow.created_at,
        updatedAt: supplierRow.updated_at,
      } : undefined,
      supplierCustomer: customerRow ? {
        id: customerRow.id,
        spaceId: customerRow.space_id,
        name: customerRow.name,
        taxNumber: customerRow.tax_number,
        phone: customerRow.phone,
        address: customerRow.address,
        isAiRecognized: customerRow.is_ai_recognized,
        isSupplier: customerRow.is_supplier || false,
        createdAt: customerRow.created_at,
        updatedAt: customerRow.updated_at,
      } : undefined,
      totalAmount: data.total_amount,
      currency: data.currency,
      tax: data.tax,
      date: normalizeDate(data.date),
      accountId: data.account_id,
      account: accountRow ? {
        id: accountRow.id,
        spaceId: accountRow.space_id,
        name: accountRow.name,
        isAiRecognized: accountRow.is_ai_recognized,
        createdAt: accountRow.created_at,
        updatedAt: accountRow.updated_at,
      } : undefined,
      status: data.status as ReceiptStatus,
      imageUrl: data.image_url,
      inputType: data.input_type || (data.image_url ? 'image' : 'text'),
      confidence: data.confidence,
      processedBy: data.processed_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by,
      createdByUser: data.created_by_user ? {
        id: data.created_by_user.id,
        email: data.created_by_user.email,
        name: data.created_by_user.name,
        spaceId: data.created_by_user.current_space_id,
      } : undefined,
      items: (data.receipt_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        category: item.categories ? {
          id: item.categories.id,
          spaceId: item.categories.space_id,
          name: item.categories.name,
          color: item.categories.color,
          isDefault: item.categories.is_default,
          createdAt: item.categories.created_at,
          updatedAt: item.categories.updated_at,
        } : undefined,
        purposeId: item.purpose_id ?? null,
        purpose: item.purposes ? {
          id: item.purposes.id,
          spaceId: item.purposes.space_id,
          name: item.purposes.name,
          color: item.purposes.color,
          isDefault: item.purposes.is_default,
          createdAt: item.purposes.created_at,
          updatedAt: item.purposes.updated_at,
        } : undefined,
        price: item.price,
        isAsset: item.is_asset,
        confidence: item.confidence,
      })),
    };
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
}

// 删除小票
export async function deleteReceipt(receiptId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 先获取小票信息，以便删除关联的文件和清理孤立数据
    const receipt = await getReceiptById(receiptId);
    if (!receipt) {
      console.warn('Receipt not found, nothing to delete');
      return;
    }

    const supplierId = receipt.supplierId;
    const accountId = receipt.accountId;

    // 1. 删除关联的图片
    if (receipt.imageUrl) {
      try {
        const urlParts = receipt.imageUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        const fileName = lastPart.split('?')[0];

        let filePaths: string[] = [];
        if (fileName && fileName.length > 0) {
          filePaths.push(fileName);
        }

        // 备选：使用 receiptId 构建可能的文件名
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        for (const ext of extensions) {
          const testPath = `${receiptId}.${ext}`;
          if (!filePaths.includes(testPath)) {
            filePaths.push(testPath);
          }
        }

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('receipts')
            .remove(filePaths);

          if (storageError) {
            console.warn('Failed to delete image from storage:', storageError);
          } else {
            console.log('Successfully deleted image(s):', filePaths);
          }
        }
      } catch (imageError) {
        console.warn('Error deleting image:', imageError);
      }
    }

    // 2. 删除关联的录音文件（从 ai_chat_logs 获取）
    try {
      const { data: chatLogs } = await supabase
        .from('ai_chat_logs')
        .select('audio_url')
        .eq('receipt_id', receiptId)
        .not('audio_url', 'is', null);

      if (chatLogs && chatLogs.length > 0) {
        const audioFilePaths: string[] = [];
        for (const log of chatLogs) {
          if (log.audio_url) {
            // 从 URL 提取文件名
            const urlParts = log.audio_url.split('/');
            const fileName = urlParts[urlParts.length - 1].split('?')[0];
            if (fileName) {
              audioFilePaths.push(fileName);
            }
          }
        }

        if (audioFilePaths.length > 0) {
          const { error: audioError } = await supabase.storage
            .from('chat-audio')
            .remove(audioFilePaths);

          if (audioError) {
            console.warn('Failed to delete audio from storage:', audioError);
          } else {
            console.log('Successfully deleted audio file(s):', audioFilePaths);
          }
        }
      }
    } catch (audioError) {
      console.warn('Error deleting audio files:', audioError);
    }

    // 3. 删除小票记录（会级联删除商品项）
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('space_id', spaceId);

    if (error) throw error;

    // 4. 清理孤立的供应商（如果未被其他小票引用）
    if (supplierId) {
      try {
        const { count: supplierRefCount } = await supabase
          .from('receipts')
          .select('id', { count: 'exact', head: true })
          .eq('supplier_id', supplierId);

        if (supplierRefCount === 0) {
          // 检查是否有其他供应商的 merged_into_id 指向该供应商
          const { count: pointedCount } = await supabase
            .from('suppliers')
            .select('id', { count: 'exact', head: true })
            .eq('merged_into_id', supplierId);

          if (!pointedCount || pointedCount === 0) {
            const { error: deleteSupplierError } = await supabase
              .from('suppliers')
              .delete()
              .eq('id', supplierId);

            if (deleteSupplierError) {
              console.warn('Failed to delete orphan supplier:', deleteSupplierError);
            } else {
              console.log('Deleted orphan supplier:', supplierId);
            }
          }
        }
      } catch (supplierError) {
        console.warn('Error cleaning up supplier:', supplierError);
      }
    }

    // 5. 清理孤立的账户（若未被 receipts/invoices 引用）
    if (accountId) {
      try {
        const { count: receiptRefCount } = await supabase
          .from('receipts')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId);
        const { count: invoiceRefCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId);

        if (receiptRefCount === 0 && invoiceRefCount === 0) {
          const { count: pointedCount } = await supabase
            .from('accounts')
            .select('id', { count: 'exact', head: true })
            .eq('merged_into_id', accountId);
          if (!pointedCount || pointedCount === 0) {
            const { error: deleteAccountError } = await supabase
              .from('accounts')
              .delete()
              .eq('id', accountId);
            if (deleteAccountError) {
              console.warn('Failed to delete orphan account:', deleteAccountError);
            } else {
              console.log('Deleted orphan account:', accountId);
            }
          }
        }
      } catch (accountError) {
        console.warn('Error cleaning up account:', accountError);
      }
    }

    console.log('Receipt deleted successfully with cleanup:', receiptId);
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
}
