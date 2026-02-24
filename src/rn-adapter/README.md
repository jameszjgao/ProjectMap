# React Native 到 Web 适配层

## 目的

这个适配层允许**直接复用移动端的 React Native 页面组件**，无需重写。只需要做布局适配，业务逻辑和页面结构完全复用。

## 工作原理

1. **react-native-web**: 将 React Native 组件（View, Text, TouchableOpacity 等）转换为 Web DOM 元素
2. **路由适配**: expo-router → react-router-dom
3. **图标适配**: @expo/vector-icons → lucide-react
4. **平台特定功能适配**: 
   - ImagePicker → Web 文件选择器
   - SwipeableRow → Web 悬停菜单
   - Alert → window.alert/confirm

## 使用方法

### 方式1：直接导入移动端页面（推荐）

```tsx
// src/pages/Expenses.tsx
import ReceiptsScreen from '../../Vouchap/app/receipts';
export default ReceiptsScreen;
```

### 方式2：创建适配包装器

如果页面需要特殊处理，可以创建包装器：

```tsx
// src/pages/Expenses.tsx
import ReceiptsScreen from '../../Vouchap/app/receipts';
import { WebLayoutAdapter } from '../rn-adapter/layout';

export default function ExpensesPage() {
  return (
    <WebLayoutAdapter>
      <ReceiptsScreen />
    </WebLayoutAdapter>
  );
}
```

## 已适配的模块

- ✅ react-native → react-native-web
- ✅ expo-router → react-router-dom
- ✅ @expo/vector-icons → lucide-react
- ✅ expo-image-picker → Web 文件选择器
- ✅ SwipeableRow → Web 悬停菜单
- ✅ Alert → window.alert/confirm
- ✅ Constants → Web 常量
- ✅ AsyncStorage → localStorage

## 待适配的模块

- ⚠️ DocumentScanner: Web 端不支持，需要禁用或使用替代方案
- ⚠️ 相机功能: Web 端使用文件选择器替代
- ⚠️ 某些原生动画: 可能需要 CSS 动画替代

## 注意事项

1. **样式**: React Native 的 StyleSheet 会转换为内联样式，某些复杂样式可能需要调整
2. **性能**: react-native-web 会有一定性能开销，但对于大多数页面影响不大
3. **平台检测**: 使用 `Platform.OS === 'web'` 来检测平台并做条件渲染
