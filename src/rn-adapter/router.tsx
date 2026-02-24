/**
 * Expo Router 适配层
 * 将 expo-router 的 API 适配为 react-router-dom
 */

import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// useRouter 适配
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    canGoBack: () => window.history.length > 1,
    setParams: (params: Record<string, string>) => {
      const location = window.location;
      const searchParams = new URLSearchParams(location.search);
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
      navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    },
  };
}

// useFocusEffect 适配
export function useFocusEffect(callback: () => void | (() => void)) {
  const location = useLocation();
  useEffect(() => {
    return callback();
  }, [location.pathname]);
}

// useLocalSearchParams 适配
export function useLocalSearchParams() {
  const params = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const search: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    search[key] = value;
  });
  return { ...params, ...search };
}

// Stack 组件适配（用于 _layout.tsx）
export function Stack({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

Stack.Screen = function Screen({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
};
