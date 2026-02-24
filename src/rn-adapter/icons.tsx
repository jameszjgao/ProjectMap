/**
 * @expo/vector-icons 适配层
 * 将 Ionicons 适配为 lucide-react 图标
 */

import * as LucideIcons from 'lucide-react';
import React from 'react';

const iconMap: Record<string, React.ComponentType<any>> = {
  'search': LucideIcons.Search,
  'search-outline': LucideIcons.Search,
  'add': LucideIcons.Plus,
  'add-outline': LucideIcons.Plus,
  'trash': LucideIcons.Trash2,
  'trash-outline': LucideIcons.Trash2,
  'close': LucideIcons.X,
  'close-outline': LucideIcons.X,
  'chevron-down': LucideIcons.ChevronDown,
  'chevron-up': LucideIcons.ChevronUp,
  'chevron-back': LucideIcons.ChevronLeft,
  'chevron-forward': LucideIcons.ChevronRight,
  'chevron-back-outline': LucideIcons.ChevronLeft,
  'chevron-forward-outline': LucideIcons.ChevronRight,
  'calendar': LucideIcons.Calendar,
  'calendar-outline': LucideIcons.Calendar,
  'time': LucideIcons.Clock,
  'time-outline': LucideIcons.Clock,
  'wallet': LucideIcons.Wallet,
  'wallet-outline': LucideIcons.Wallet,
  'person': LucideIcons.User,
  'person-outline': LucideIcons.User,
  'storefront': LucideIcons.Store,
  'storefront-outline': LucideIcons.Store,
  'filter': LucideIcons.Filter,
  'filter-outline': LucideIcons.Filter,
  'checkmark': LucideIcons.Check,
  'checkmark-outline': LucideIcons.Check,
  'checkmark-circle': LucideIcons.CheckCircle,
  'checkmark-circle-outline': LucideIcons.CheckCircle,
  'close-circle': LucideIcons.XCircle,
  'close-circle-outline': LucideIcons.XCircle,
  'camera': LucideIcons.Camera,
  'camera-outline': LucideIcons.Camera,
  'image': LucideIcons.Image,
  'image-outline': LucideIcons.Image,
  'settings': LucideIcons.Settings,
  'settings-outline': LucideIcons.Settings,
  'menu': LucideIcons.Menu,
  'menu-outline': LucideIcons.Menu,
  'ellipsis-horizontal': LucideIcons.MoreHorizontal,
  'ellipsis-horizontal-outline': LucideIcons.MoreHorizontal,
  'ellipsis-vertical': LucideIcons.MoreVertical,
  'ellipsis-vertical-outline': LucideIcons.MoreVertical,
};

export const Ionicons = Object.keys(iconMap).reduce((acc, name) => {
  acc[name] = (props: any) => {
    const Icon = iconMap[name] || LucideIcons.Circle;
    return React.createElement(Icon, { ...props, size: props.size || 24 });
  };
  return acc;
}, {} as Record<string, React.ComponentType<any>>);
