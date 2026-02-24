/**
 * Web端lib入口文件
 * 重新导出移动端的共享业务逻辑，确保移动端的改进自动同步到web端
 */

// 直接导出移动端的所有业务逻辑
export * from './shared/accounts';
export * from './shared/categories';
export * from './shared/customers';
export * from './shared/customer-supplier-list';
export * from './shared/inbound';
export * from './shared/invoices';
export * from './shared/name-utils';
export * from './shared/outbound';
export * from './shared/purposes';
export * from './shared/receipts'; // 从database.ts重新导出
export * from './shared/skus';
export * from './shared/suppliers';
export * from './shared/warehouse';
export * from './shared/space-members';

// 导出web端特有的适配和工具
export * from './auth-helper';
export * from './supabase';
