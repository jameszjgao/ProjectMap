# Web端业务逻辑库

## 架构说明

Web端的业务逻辑**直接复用**移动端（Vouchap项目）的代码，通过符号链接实现：

```
src/lib/shared/ -> ../../Vouchap/lib/
```

### 复用机制

1. **符号链接**：`src/lib/shared/` 目录中的所有文件都是指向移动端 `Vouchap/lib/` 的符号链接
2. **自动同步**：移动端的任何改进都会自动同步到web端，无需手动迁移
3. **适配层**：通过 `auth-adapter.ts` 和覆盖文件处理web端和移动端的差异

### 文件结构

```
src/lib/
├── shared/              # 符号链接到移动端lib（直接复用）
│   ├── accounts.ts -> ../../Vouchap/lib/accounts.ts
│   ├── categories.ts -> ../../Vouchap/lib/categories.ts
│   ├── customers.ts -> ../../Vouchap/lib/customers.ts
│   ├── invoices.ts -> ../../Vouchap/lib/invoices.ts
│   ├── inbound.ts -> ../../Vouchap/lib/inbound.ts
│   ├── outbound.ts -> ../../Vouchap/lib/outbound.ts
│   ├── receipts.ts (重新导出database.ts中的receipts函数)
│   ├── database.ts -> ../../Vouchap/lib/database.ts
│   ├── auth.ts (覆盖文件，重定向到auth-adapter)
│   └── supabase.ts (覆盖文件，重定向到web端supabase)
├── auth-adapter.ts      # 适配层：将web端auth-helper适配为移动端auth接口
├── auth-helper.ts       # Web端特有的auth函数
├── supabase.ts          # Web端supabase客户端
└── index.ts             # 统一导出入口

```

### 使用方法

在页面中导入时，使用统一入口：

```typescript
// ✅ 正确：使用统一入口
import { getAllReceiptsForList, getAllInvoicesForList } from '../lib/shared';

// ❌ 错误：不要直接导入shared目录
import { getAllReceiptsForList } from '../lib/shared/receipts';
```

### 适配说明

- **Auth模块**：移动端使用 `getCurrentUser()`，web端使用 `getCurrentUserInfo()`
  - 通过 `auth-adapter.ts` 提供 `getCurrentUser()` 函数，内部调用 `getCurrentUserInfo()` 并转换格式
  - `shared/auth.ts` 覆盖文件重定向到 `auth-adapter.ts`

- **Supabase客户端**：两个项目使用相同的supabase实例
  - `shared/supabase.ts` 覆盖文件重定向到web端的 `supabase.ts`

- **类型定义**：使用 `@/types` 路径别名，指向 `src/types/index.ts`

### 注意事项

1. **不要修改移动端代码**：所有业务逻辑改进应在移动端进行，web端自动同步
2. **适配层最小化**：只在必要时创建适配层，尽量保持代码一致性
3. **类型兼容**：移动端代码可能使用数据库原始格式（snake_case），TypeScript配置已允许这些差异
