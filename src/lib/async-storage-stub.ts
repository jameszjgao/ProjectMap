/**
 * AsyncStorage的web端存根
 * 使用localStorage作为替代
 */

const AsyncStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // 忽略错误
        }
    },
    async removeItem(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            // 忽略错误
        }
    },
    async clear(): Promise<void> {
        try {
            localStorage.clear();
        } catch (e) {
            // 忽略错误
        }
    },
    async getAllKeys(): Promise<string[]> {
        try {
            return Object.keys(localStorage);
        } catch (e) {
            return [];
        }
    },
};

export default AsyncStorage;
