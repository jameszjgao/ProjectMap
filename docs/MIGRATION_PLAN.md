# Web 端业务逻辑对齐迁移计划

## 目标

将需要对齐的模块（支出、收入、入库、出库、空间基础数据设置）的业务逻辑从页面层迁移到 `lib/`，与移动端对齐。

## 迁移清单

### 第一阶段：核心业务模块

- [ ] **入库（Inbound）**
  - 源：`/Users/macbook/Vouchap/lib/inbound.ts`
  - 目标：`src/lib/inbound.ts`
  - 影响页面：`pages/RecordsList.tsx` (type='inbound'), `pages/RecordDetail.tsx`
  - 迁移内容：`getInboundForListFirstPaint`, `getAllInbound`, `getInboundById`, `createInbound`, `updateInbound`, `deleteInbound` 等

- [ ] **出库（Outbound）**
  - 源：`/Users/macbook/Vouchap/lib/outbound.ts`
  - 目标：`src/lib/outbound.ts`
  - 影响页面：`pages/RecordsList.tsx` (type='outbound'), `pages/RecordDetail.tsx`
  - 迁移内容：`getOutboundForListFirstPaint`, `getAllOutbound`, `getOutboundById`, `createOutbound`, `updateOutbound`, `deleteOutbound` 等

- [ ] **收入（Income/Invoices）**
  - 源：`/Users/macbook/Vouchap/lib/invoices.ts`
  - 目标：`src/lib/invoices.ts`
  - 影响页面：`pages/RecordsList.tsx` (type='income'), `pages/RecordDetail.tsx`
  - 迁移内容：`getInvoicesForListFirstPaint`, `getAllInvoices`, `getInvoiceById`, `createInvoice`, `updateInvoice`, `deleteInvoice` 等

- [ ] **支出（Expenditure/Receipts）**
  - 源：`/Users/macbook/Vouchap/lib/receipts.ts`（需确认路径）
  - 目标：`src/lib/receipts.ts`
  - 影响页面：`pages/RecordsList.tsx` (type='expenditure'), `pages/RecordDetail.tsx`
  - 迁移内容：列表、详情、创建、更新、删除等函数

### 第二阶段：基础数据设置

- [ ] **分类管理（Categories）**
  - 源：`/Users/macbook/Vouchap/lib/categories.ts`
  - 目标：`src/lib/categories.ts`
  - 影响页面：分类管理页面（待创建或已存在）
  - 迁移内容：`getCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `mergeCategories` 等

- [ ] **账户管理（Accounts）**
  - 源：`/Users/macbook/Vouchap/lib/accounts.ts`
  - 目标：`src/lib/accounts.ts`
  - 影响页面：账户管理页面（待创建或已存在）
  - 迁移内容：`getAccounts`, `createAccount`, `updateAccount`, `deleteAccount`, `mergeAccounts` 等

- [ ] **空间成员管理（Space Members）**
  - 源：`/Users/macbook/Vouchap/lib/space-members.ts`
  - 目标：`src/lib/space-members.ts`
  - 影响页面：成员管理页面（待创建或已存在）
  - 迁移内容：`getSpaceMembers`, `inviteMember`, `removeMember`, `updateMemberRole` 等

## 迁移步骤（每个模块）

1. **创建类型定义**（如需要）：
   - 从移动端 `types/index.ts` 复制相关类型到 `src/types/index.ts`
   - 确保类型定义与移动端完全一致（如 `Receipt`, `Invoice`, `Inbound`, `Outbound`, `Category`, `Account` 等）

2. **复制并适配业务逻辑**：
   - 从移动端复制 `lib/[module].ts` 到 `src/lib/[module].ts`
   - 修改导入路径：
     - `@/types` → `../types`（需先创建 `src/types/index.ts`）
     - `getCurrentUser()` → `getCurrentUserInfo()`（来自 `auth-helper.ts`）
     - `user.currentSpaceId || user.spaceId` → `userInfo.currentSpaceId`（`getCurrentUserInfo()` 返回的格式）
   - 移除移动端特有依赖（如 `expo-constants`, `auth-cache` 等）

2. **创建类型定义**（如需要）：
   - 从移动端 `types/index.ts` 复制相关类型到 `src/types/index.ts`
   - 确保类型定义与移动端一致

3. **重构页面**：
   - **RecordsList.tsx**：
     - 移除 `useEffect` 中的直接 Supabase 查询（第 38-76 行）
     - 改为调用 `lib/inbound.ts`、`lib/outbound.ts`、`lib/invoices.ts`、`lib/receipts.ts` 中的列表函数
     - 保持分组、搜索、筛选等 UI 逻辑，但数据获取通过 `lib`
   - **RecordDetail.tsx**：
     - 移除直接 Supabase 查询和保存逻辑（第 33-100 行）
     - 改为调用对应 `lib` 模块的 `getById`、`create`、`update`、`delete` 函数
     - 保持表单 UI 和本地状态管理，但数据操作通过 `lib`
   - 确保页面只负责：UI 布局、路由、调用 `lib`、展示与简单交互

4. **适配差异**：
   - **用户信息**：移动端 `getCurrentUser()` 返回 `User`（有 `currentSpaceId` 和 `spaceId`），Web 端 `getCurrentUserInfo()` 返回 `UserInfo`（只有 `currentSpaceId`）
   - **类型定义**：创建 `src/types/index.ts`，从移动端 `types/index.ts` 复制相关类型
   - **错误处理**：确保错误提示、异常处理与移动端一致
   - **交互响应**：确认对话框、加载状态、成功提示等应与移动端一致

5. **测试对齐**：
   - 确保业务逻辑、数据模型、校验规则与移动端一致
   - 确保错误处理、加载状态、交互响应与移动端一致
   - 确保数据查询、创建、更新、删除的行为与移动端一致

## 注意事项

- **保持业务逻辑一致**：不要修改移动端的业务规则，只做路径和 API 适配
- **类型对齐**：确保类型定义与移动端完全一致
- **错误处理**：错误提示、异常处理应与移动端对齐
- **交互响应**：确认对话框、加载状态、成功提示等应与移动端一致

## 优先级

1. **高优先级**：入库、出库、收入、支出（核心业务模块）
2. **中优先级**：分类管理、账户管理（基础数据，影响其他模块）
3. **低优先级**：空间成员管理（已有部分实现，需完善）
