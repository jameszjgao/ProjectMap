/**
 * Expenses 页面 - 直接复用移动端的 receipts.tsx
 * 
 * 这个文件展示了如何复用移动端的页面组件：
 * 1. 直接导入移动端的页面组件
 * 2. 适配层会自动处理 React Native → Web 的转换
 * 3. 业务逻辑和页面结构完全复用，无需重写
 * 
 * 注意：移动端的页面组件通过符号链接访问：
 * ../../Vouchap/app/receipts.tsx
 */

// 方式1：直接导入（需要确保所有依赖都已适配）
// import ReceiptsScreen from '../../Vouchap/app/receipts';
// export default ReceiptsScreen;

// 方式2：暂时使用现有的 RecordsList，逐步迁移到复用移动端组件
// 当适配层完善后，可以切换到方式1
import RecordsList from './RecordsList';

export default function Expenses() {
  return <RecordsList type="expenditure" />;
}
