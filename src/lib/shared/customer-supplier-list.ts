import { Customer, Supplier } from '@/types';
import { getCustomers, getCustomersForOptions } from './customers';
import { getSuppliers, getSuppliersForOptions } from './suppliers';

/** 客户列表项：来自 customers 表或来自 suppliers 表（is_customer=true） */
export type CustomerListItem =
  | (Customer & { source: 'customer' })
  | (Supplier & { source: 'supplier' });

/** 供应商列表项：来自 suppliers 表或来自 customers 表（is_supplier=true） */
export type SupplierListItem =
  | (Supplier & { source: 'supplier' })
  | (Customer & { source: 'customer' });

/** 客户管理页用：客户表全部 + 标记为客户的供应商（同一条数据，编辑时改供应商表） */
export async function getCustomerListForManage(): Promise<CustomerListItem[]> {
  const [customers, suppliers] = await Promise.all([getCustomers(), getSuppliers()]);
  const fromCustomers: CustomerListItem[] = customers.map((c) => ({ ...c, source: 'customer' as const }));
  const fromSuppliers: CustomerListItem[] = suppliers
    .filter((s) => s.isCustomer)
    .map((s) => ({ ...s, source: 'supplier' as const }));
  return [...fromCustomers, ...fromSuppliers].sort((a, b) => a.name.localeCompare(b.name));
}

/** 供应商管理页用：供应商表全部 + 标记为供应商的客户（同一条数据，编辑时改客户表） */
export async function getSupplierListForManage(): Promise<SupplierListItem[]> {
  const [suppliers, customers] = await Promise.all([getSuppliers(), getCustomers()]);
  const fromSuppliers: SupplierListItem[] = suppliers.map((s) => ({ ...s, source: 'supplier' as const }));
  const fromCustomers: SupplierListItem[] = customers
    .filter((c) => c.isSupplier)
    .map((c) => ({ ...c, source: 'customer' as const }));
  return [...fromSuppliers, ...fromCustomers].sort((a, b) => a.name.localeCompare(b.name));
}

/** 选客户用（发票等）：仅“无指向”的客户+供应商，选单与前端展示一致；大模型用 getCustomersForOptions/getSuppliersForOptions 取全部 */
export async function getCustomerOptions(): Promise<{ id: string; name: string; source: 'customer' | 'supplier' }[]> {
  const list = await getCustomerListForManage();
  return list.map((it) => ({ id: it.id, name: it.name, source: it.source }));
}

/** 选供应商用（小票等）：仅“无指向”的供应商+客户，选单与前端展示一致；大模型用 getSuppliersForOptions/getCustomersForOptions 取全部 */
export async function getSupplierOptions(): Promise<{ id: string; name: string; source: 'supplier' | 'customer' }[]> {
  const list = await getSupplierListForManage();
  return list.map((it) => ({ id: it.id, name: it.name, source: it.source }));
}

/** 名称重复判断用：含已合并指向的供应商+客户，便于按名称找到任意一条并解析到最终目标 */
export async function getSupplierOptionsForDuplicateCheck(): Promise<{ id: string; name: string; source: 'supplier' | 'customer' }[]> {
  const [suppliers, customers] = await Promise.all([getSuppliersForOptions(), getCustomersForOptions()]);
  const fromSuppliers = suppliers.map((s) => ({ id: s.id, name: s.name, source: 'supplier' as const }));
  const fromCustomers = customers.filter((c) => c.isSupplier).map((c) => ({ id: c.id, name: c.name, source: 'customer' as const }));
  return [...fromSuppliers, ...fromCustomers];
}

/** 名称重复判断用：含已合并指向的客户+供应商，便于按名称找到任意一条并解析到最终目标 */
export async function getCustomerOptionsForDuplicateCheck(): Promise<{ id: string; name: string; source: 'customer' | 'supplier' }[]> {
  const [customers, suppliers] = await Promise.all([getCustomersForOptions(), getSuppliersForOptions()]);
  const fromCustomers = customers.map((c) => ({ id: c.id, name: c.name, source: 'customer' as const }));
  const fromSuppliers = suppliers.filter((s) => s.isCustomer).map((s) => ({ id: s.id, name: s.name, source: 'supplier' as const }));
  return [...fromCustomers, ...fromSuppliers];
}
