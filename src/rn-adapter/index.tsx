/**
 * React Native 到 Web 的适配层
 * 将移动端的 React Native 组件适配到 Web 环境
 */

// 导出 react-native-web 的组件
export {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  SectionList,
  FlatList,
  Image,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native-web';

// 导出样式创建函数
export { StyleSheet as RNStyleSheet } from 'react-native-web';

// 路由适配：将 expo-router 的 useRouter 适配为 react-router-dom
import { useNavigate, useParams as useRouterParams } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    canGoBack: () => window.history.length > 1,
  };
}

// useFocusEffect 适配：在 web 端使用 useEffect
import { useEffect } from 'react';
export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(callback, []);
}

// useParams 适配
export function useParams() {
  return useRouterParams();
}

// Ionicons 适配：使用 lucide-react 图标
import * as LucideIcons from 'lucide-react';

const iconMap: Record<string, any> = {
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
  'close-circle': LucideIcons.XCircle,
  'close-circle-outline': LucideIcons.XCircle,
};

export const Ionicons = {
  get: (name: string, props?: any) => {
    const Icon = iconMap[name] || LucideIcons.Circle;
    return <Icon {...props} />;
  },
};

// 创建 Ionicons 组件
export function createIonicons() {
  return Object.keys(iconMap).reduce((acc, name) => {
    acc[name] = (props: any) => {
      const Icon = iconMap[name] || LucideIcons.Circle;
      return <Icon {...props} />;
    };
    return acc;
  }, {} as Record<string, any>);
}

// ImagePicker 适配：web 端使用文件输入
export const ImagePicker = {
  launchImageLibraryAsync: async (options?: any) => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            cancelled: false,
            assets: [{
              uri: event.target?.result as string,
              width: 0,
              height: 0,
              type: file.type,
              fileName: file.name,
            }],
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },
  launchCameraAsync: async (options?: any) => {
    // Web 端不支持相机，使用文件选择器
    return ImagePicker.launchImageLibraryAsync(options);
  },
};

// Constants 适配
export const Constants = {
  appOwnership: 'standalone',
  expoConfig: null,
  platform: {
    ios: false,
    android: false,
    web: true,
  },
};

// Alert 适配：使用浏览器 alert/confirm
export const Alert = {
  alert: (title: string, message?: string, buttons?: any[]) => {
    if (buttons && buttons.length > 0) {
      const result = window.confirm(message ? `${title}\n${message}` : title);
      if (result && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(message ? `${title}\n${message}` : title);
    }
  },
  prompt: (title: string, message?: string, callbackOrButtons?: any, type?: string, defaultValue?: string, keyboardType?: string) => {
    const result = window.prompt(message ? `${title}\n${message}` : title, defaultValue);
    if (callbackOrButtons && typeof callbackOrButtons === 'function') {
      callbackOrButtons({ text: result || '' });
    }
  },
};
