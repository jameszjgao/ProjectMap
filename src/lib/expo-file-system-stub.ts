/**
 * Expo FileSystem的web端存根
 */

const FileSystem = {
    documentDirectory: null,
    cacheDirectory: null,
    bundleDirectory: null,
    readAsStringAsync: async (fileUri: string) => {
        // Web端使用fetch读取文件
        const response = await fetch(fileUri);
        return await response.text();
    },
    writeAsStringAsync: async (fileUri: string, contents: string) => {
        // Web端不支持文件系统写入
        throw new Error('FileSystem.writeAsStringAsync is not supported on web');
    },
    deleteAsync: async (fileUri: string) => {
        // Web端不支持文件系统删除
        throw new Error('FileSystem.deleteAsync is not supported on web');
    },
    makeDirectoryAsync: async (fileUri: string) => {
        // Web端不支持创建目录
        throw new Error('FileSystem.makeDirectoryAsync is not supported on web');
    },
    getInfoAsync: async (fileUri: string) => {
        // Web端返回基本信息
        return {
            exists: false,
            isDirectory: false,
            uri: fileUri,
        };
    },
};

export default FileSystem;
export * from './expo-file-system-stub';
