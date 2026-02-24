# Web端代码复用架构说明

## 核心原则

**Web端直接复用移动端（Vouchap项目）的业务逻辑代码，而不是迁移或复制。**

## 实现方式

### 1. 符号链接复用

通过符号链接将移动端的lib目录链接到web端：

```
vouchap-web/src/lib/shared/ -> ../../Vouchap/lib/
```

### 2. 适配层

由于web端和移动端在某些依赖上有差异，创建了最小化的适配层：

- **auth-adapter.ts**: 将web端的`getCurrentUserInfo()`适配为移动端期望的`getCurrentUser()`接口
- **shared/auth.ts**: 覆盖文件，重定向到`auth-adapter.ts`
- **shared/supabase.ts**: 覆盖文件，重定向到web端的supabase客户端

### 3. 路径别名配置

在`tsconfig.json`和`vite.config.ts`中配置路径别名，让移动端代码中的`@/types`能正确解析：

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@/types": ["./src/types"]
  }
}
```

## 优势

1. **自动同步**：移动端的任何改进都会自动同步到web端，无需手动迁移
2. **代码一致性**：确保web端和移动端使用完全相同的业务逻辑
3. **维护成本低**：只需维护一份业务逻辑代码

## 使用方式

在页面中导入共享的业务逻辑：

```typescript
// ✅ 正确：从shared目录导入
import { 
  getAllReceiptsForList, 
  getAllInvoicesForList,
  getCategories,
  getPurposes 
} from '../lib/shared';
```

## 注意事项

1. **不要修改移动端代码**：所有业务逻辑改进应在移动端进行
2. **适配层最小化**：只在必要时创建适配层
3. **类型兼容**：移动端代码可能使用数据库原始格式（snake_case），TypeScript配置已允许这些差异

## 文件结构

```
vouchap-web/src/lib/
├── shared/                    # 符号链接到移动端lib（直接复用）
│   ├── accounts.ts -> ../../Vouchap/lib/accounts.ts
│   ├── categories.ts -> ../../Vouchap/lib/categories.ts
│   ├── customers.ts -> ../../Vouchap/lib/customers.ts
│   ├── invoices.ts -> ../../Vouchap/lib/invoices.ts
│   ├── inbound.ts -> ../../Vouchap/lib/inbound.ts
│   ├── outbound.ts -> ../../Vouchap/lib/outbound.ts
│   ├── receipts.ts (重新导出database.ts中的receipts函数)
│   ├── database.ts -> ../../Vouchap/lib/database.ts
│   ├── auth.ts (覆盖文件)
│   └── supabase.ts (覆盖文件)
├── auth-adapter.ts            # 适配层
├── auth-helper.ts             # Web端特有的auth函数
├── supabase.ts                # Web端supabase客户端
└── index.ts                   # 统一导出入口
```
