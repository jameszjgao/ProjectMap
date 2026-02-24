/**
 * React Native模块的web端存根
 * 移动端的代码导入了react-native，但web端使用React
 * 这里提供一个兼容层
 */

// Platform存根
export const Platform = {
    OS: 'web',
    select: (obj: any) => obj.web || obj.default,
};

// 其他React Native API的存根
export const View = 'div';
export const Text = 'span';
export const StyleSheet = {
    create: (styles: any) => styles,
};

// 导出空对象作为默认导出
export default {};
