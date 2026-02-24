/**
 * Expo Constants的web端存根
 */

const Constants = {
    expoConfig: null,
    manifest: null,
    executionEnvironment: 'standalone',
    appOwnership: null,
    sessionId: null,
    installationId: null,
    deviceId: null,
    deviceName: null,
    deviceYearClass: null,
    isDevice: false,
    platform: {
        ios: {
            platform: 'ios',
            model: null,
            userInterfaceIdiom: null,
        },
        android: {
            platform: 'android',
            versionCode: null,
        },
        web: {
            platform: 'web',
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
    },
    getWebViewUserAgentAsync: async () => {
        return typeof navigator !== 'undefined' ? navigator.userAgent : '';
    },
};

export default Constants;
