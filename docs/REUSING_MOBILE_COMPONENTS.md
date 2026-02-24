# 复用移动端页面组件指南

## 核心理念

**Web 端应该直接复用移动端的页面组件代码，而不是重写。** 只需要做布局适配，业务逻辑和页面结构完全复用。

## 当前状态

### ✅ 已完成

1. **业务逻辑复用**：
   - 通过符号链接 `src/lib/shared/` → `../../Vouchap/lib/` 复用所有业务逻辑
   - 移动端的改进自动同步到 web 端

2. **适配层基础**：
   - `react-native-web` 已安装
   - 路由适配：`expo-router` → `react-router-dom`
   - 图标适配：`@expo/vector-icons` → `lucide-react`
   - 平台功能适配：ImagePicker, SwipeableRow, Alert 等

### 🚧 进行中

1. **页面组件复用**：
   - 适配层已创建，但还需要完善
   - 移动端的页面组件（如 `receipts.tsx`）可以直接导入使用

### 📋 待完成

1. **所有移动端页面组件**：
   - `receipts.tsx` (Expenses)
   - `invoices.tsx` (Income)
   - `inbound.tsx` (Inbound)
   - `outbound.tsx` (Outbound)
   - `receipt-details/[id].tsx` (Expenses Details)
   - `invoice-details/[id].tsx` (Income Details)
   - `inbound-details/[id].tsx` (Inbound Details)
   - `outbound-details/[id].tsx` (Outbound Details)
   - `categories-manage.tsx`
   - `purposes-manage.tsx`
   - `accounts-manage.tsx`
   - `suppliers-manage.tsx`
   - `customers-manage.tsx`
   - `warehouse-manage.tsx`
   - `skus-manage.tsx`
   - `space-manage.tsx`
   - `space-members.tsx`
   - `profile.tsx`
   - `management.tsx`
   - `ai-inventory.tsx`
   - `manual-entry.tsx`
   - `voice-input.tsx` (Web 端可能需要禁用或简化)

## 复用步骤

### 步骤1：创建适配包装器（如果需要）

```tsx
// src/pages/Expenses.tsx
import ReceiptsScreen from '../../Vouchap/app/receipts';
export default ReceiptsScreen;
```

### 步骤2：添加路由

```tsx
// src/App.tsx
const Expenses = lazy(() => import('./pages/Expenses'));
<Route path="/expenses" element={<Expenses />} />
```

### 步骤3：处理平台差异

如果页面中有平台特定的代码，使用 `Platform.OS` 检测：

```tsx
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  // Web 端特定逻辑
} else {
  // 移动端特定逻辑（如相机）
}
```

## 适配层说明

### 已适配的模块

| 移动端模块 | Web 端适配 | 位置 |
|-----------|-----------|------|
| `react-native` | `react-native-web` | vite.config.ts alias |
| `expo-router` | `react-router-dom` | `src/rn-adapter/router.tsx` |
| `@expo/vector-icons` | `lucide-react` | `src/rn-adapter/icons.tsx` |
| `expo-image-picker` | Web 文件选择器 | `src/rn-adapter/image-picker.tsx` |
| `SwipeableRow` | Web 悬停菜单 | `src/rn-adapter/swipeable-row.tsx` |
| `Alert` | `window.alert/confirm` | `src/rn-adapter/index.tsx` |
| `Constants` | Web 常量 | `src/lib/expo-constants-stub.ts` |
| `AsyncStorage` | `localStorage` | `src/lib/async-storage-stub.ts` |

### 需要特殊处理的模块

1. **DocumentScanner**: Web 端不支持，需要禁用或使用替代方案
2. **相机功能**: Web 端使用文件选择器替代
3. **某些原生动画**: 可能需要 CSS 动画替代

## 优势

1. **代码一致性**: Web 端和移动端使用完全相同的业务逻辑和页面结构
2. **维护成本低**: 只需维护一份代码
3. **自动同步**: 移动端的改进自动同步到 web 端
4. **开发效率高**: 不需要重写页面组件

## 注意事项

1. **样式**: React Native 的 StyleSheet 会转换为内联样式，某些复杂样式可能需要调整
2. **性能**: react-native-web 会有一定性能开销，但对于大多数页面影响不大
3. **平台检测**: 使用 `Platform.OS === 'web'` 来检测平台并做条件渲染
4. **测试**: 复用后需要在 web 端充分测试，确保所有功能正常
