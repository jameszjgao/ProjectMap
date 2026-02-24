import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/types': path.resolve(__dirname, './src/types'),
            // 让移动端的lib代码能正确解析导入路径
            // 移动端的代码使用 './auth'，我们重定向到web端的适配层
            '../auth': path.resolve(__dirname, './src/lib/auth-adapter'),
            './auth': path.resolve(__dirname, './src/lib/auth-adapter'),
            // 移动端的代码使用 './supabase'，重定向到web端的实现
            '../supabase': path.resolve(__dirname, './src/lib/supabase'),
            './supabase': path.resolve(__dirname, './src/lib/supabase'),
            // React Native Web 适配
            'react-native': 'react-native-web',
            '@react-native-async-storage/async-storage': path.resolve(__dirname, './src/lib/async-storage-stub'),
            'expo-constants': path.resolve(__dirname, './src/lib/expo-constants-stub'),
            'expo-file-system': path.resolve(__dirname, './src/lib/expo-file-system-stub'),
            'expo-router': path.resolve(__dirname, './src/rn-adapter/router'),
            '@expo/vector-icons': path.resolve(__dirname, './src/rn-adapter/icons'),
            'expo-image-picker': path.resolve(__dirname, './src/rn-adapter/image-picker'),
            './SwipeableRow': path.resolve(__dirname, './src/rn-adapter/swipeable-row'),
        },
    },
    optimizeDeps: {
        exclude: [
            'react-native',
            '@react-native-async-storage/async-storage',
            'expo-constants',
            '@react-native-community/masked-view',
        ],
    },
    server: {
        fs: {
            // 允许访问父目录（用于符号链接）
            allow: ['..'],
        },
    },
})
