# Web 端与移动端对齐说明

## 原则

- **移动端**：各模块开发进展为主线，业务逻辑与数据契约以移动端为准。
- **Web 端**：只做**页面兼容**（布局、路由、响应式、交互适配），**不重新定义、不重复实现业务逻辑**。

## 模块分类

### ✅ 需要与移动端对齐的模块（业务逻辑需对齐）

以下模块的**业务逻辑和交互响应**应与移动端对齐，Web 仅做页面适配：

1. **支出（Expenditure）** - `pages/RecordsList.tsx` (type='expenditure') / `pages/RecordDetail.tsx`
2. **收入（Income）** - `pages/RecordsList.tsx` (type='income') / `pages/RecordDetail.tsx`
3. **入库（Inbound）** - `pages/RecordsList.tsx` (type='inbound') / `pages/RecordDetail.tsx`
4. **出库（Outbound）** - `pages/RecordsList.tsx` (type='outbound') / `pages/RecordDetail.tsx`
5. **空间基础数据设置**
   - 空间管理（Space Manage）- `pages/SpaceManage.tsx`
   - 成员管理（Members）
   - 分类管理（Categories）
   - 账户管理（Accounts）
   - 其他基础数据设置页面

**对齐要求**：
- 业务逻辑（查询、创建、更新、删除、状态流转、校验规则）与移动端一致
- 交互响应（确认、错误提示、加载状态）与移动端一致
- 数据模型与类型定义与移动端一致
- Web 只负责：桌面端布局、表格展示、批量操作等浏览器特有交互

### 🌐 Web 端独有模块（无需对齐）

以下模块是 Web 端特有，可独立开发：

1. **项目地图（Project Map）** - `pages/ProjectMap.tsx`
2. **脑图编辑器（Mind Map Editor）** - `pages/MindMapEditor.tsx`
3. **BI Dashboard** - `pages/Dashboard.tsx`

这些模块的业务逻辑可在 Web 端独立定义，不受移动端约束。

## Web 端职责边界

| 归属 | 内容 | 说明 |
|------|------|------|
| **Web 做** | 页面与布局 | 路由、侧栏、导航、桌面端/平板端适配 |
| **Web 做** | UI 组件与样式 | 与设计一致的展示与交互（不包含业务规则） |
| **Web 做** | 调用统一能力 | 仅通过 `src/lib/` 暴露的 API/类型与移动端对齐 |
| **Web 不做** | 业务逻辑重写 | 不在此单独定义与移动端不一致的规则、状态机、校验 |
| **Web 不做** | 新接口/新契约 | 新能力由移动端或后端统一定义，Web 只接入 |

## 代码分层约定

```
src/
├── lib/          # 与移动端对齐的业务/数据层（API、类型、共享逻辑）
│                 # 需要对齐的模块：inbound.ts, outbound.ts, invoices.ts, receipts.ts,
│                 #                categories.ts, accounts.ts, space-members.ts 等
│                 # 新增能力时应对齐移动端或后端契约，不在此处重新发明
├── pages/        # 仅做页面兼容：布局、路由、调用 lib、展示与简单交互
│                 # 需要对齐的页面：RecordsList, RecordDetail, SpaceManage 等
│                 # Web 独有：ProjectMap, MindMapEditor, Dashboard
├── components/   # 通用 UI 组件，不包含业务规则
└── ...
```

- **`lib/`**：Supabase/HTTP 调用、数据类型、与移动端一致的业务辅助函数。需要对齐的模块应从移动端（`/Users/macbook/Vouchap/lib/`）迁移或对齐业务逻辑。
- **`pages/`**：只负责组装 UI、调用 `lib`、处理路由与本地 UI 状态（如 loading、error），不在此处写与移动端不一致的业务规则。

## 当前状态与迁移计划

### 当前问题

需要对齐的模块（支出、收入、入库、出库）目前**业务逻辑在页面中**（`RecordsList.tsx`、`RecordDetail.tsx`），未提取到 `lib/`，与移动端不一致。

### 迁移步骤

1. **对齐业务逻辑层**：
   - 从移动端（`/Users/macbook/Vouchap/lib/`）迁移或对齐以下文件到 Web 的 `src/lib/`：
     - `inbound.ts` → `src/lib/inbound.ts`
     - `outbound.ts` → `src/lib/outbound.ts`
     - `invoices.ts` → `src/lib/invoices.ts`
     - `receipts.ts` → `src/lib/receipts.ts`
     - `categories.ts` → `src/lib/categories.ts`
     - `accounts.ts` → `src/lib/accounts.ts`
     - `space-members.ts` → `src/lib/space-members.ts`
   - 适配 Web 端的依赖（如 `@/types` → `../types`，`getCurrentUser` → `getCurrentUserInfo`）

2. **重构页面层**：
   - `RecordsList.tsx`：移除直接 Supabase 查询，改为调用 `lib/inbound.ts`、`lib/outbound.ts`、`lib/invoices.ts`、`lib/receipts.ts`
   - `RecordDetail.tsx`：移除业务逻辑，改为调用对应的 `lib` 函数
   - 空间管理相关页面：使用 `lib/categories.ts`、`lib/accounts.ts`、`lib/space-members.ts`

3. **确保交互一致**：
   - 错误提示、确认对话框、加载状态等交互响应与移动端对齐
   - 数据校验规则与移动端一致

## 开发新功能时

### 对于需要对齐的模块

1. **先对齐**：确认移动端已有的接口、类型、行为。
2. **Web 只接**：在 `lib/` 中封装调用与类型（或复用移动端实现），在 `pages/` 中做布局与调用，不新增一套业务逻辑。
3. **有分歧时**：以移动端/后端为准，Web 仅做兼容与展示。

### 对于 Web 独有模块

- Project Map、Mind Map Editor、Dashboard 可独立开发，不受移动端约束。

## 与移动端共享的演进方向

- 若后续将业务逻辑抽到**共享包**（如 `@vouchap/core` 或 monorepo 内 `packages/core`），Web 应改为依赖该包，`src/lib/` 中仅保留 Web 特有适配（如 Supabase 初始化），业务逻辑不再在 Web 仓库内重复实现。
