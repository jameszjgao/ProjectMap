/**
 * expo-image-picker 适配层
 * Web 端使用文件输入替代相机
 */

export const ImagePicker = {
  launchImageLibraryAsync: async (options?: {
    mediaTypes?: 'images' | 'videos' | 'all';
    allowsEditing?: boolean;
    quality?: number;
  }) => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options?.mediaTypes === 'videos' ? 'video/*' : 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve({ cancelled: true });
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
              fileSize: file.size,
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
