/**
 * Web 布局适配器
 * 为移动端页面提供 Web 端的布局容器（如侧边栏、头部等）
 */

import React from 'react';
import { View } from 'react-native-web';

export function WebLayoutAdapter({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {children}
    </View>
  );
}
