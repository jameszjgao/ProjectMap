/**
 * SwipeableRow 适配层
 * Web 端使用鼠标悬停或点击菜单替代滑动操作
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native-web';
import { MoreHorizontal, Trash2 } from 'lucide-react';

export function SwipeableRow({
  children,
  onDelete,
  onEdit,
  rightActions,
}: {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  rightActions?: React.ReactNode;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={{ position: 'relative' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0 1rem',
          backgroundColor: '#fff',
        }}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {showMenu && (
          <>
            {onEdit && (
              <button onClick={onEdit} style={{ padding: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                Edit
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} style={{ padding: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
                <Trash2 size={18} />
              </button>
            )}
            {rightActions}
          </>
        )}
        {!showMenu && <MoreHorizontal size={18} />}
      </div>
    </View>
  );
}
