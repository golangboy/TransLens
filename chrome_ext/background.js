// Chrome插件后台脚本 - 智能翻译助手

// 引入共享配置
importScripts('config.js');

// 插件安装或启动时初始化
chrome.runtime.onInstalled.addListener(async function(details) {
    console.log('[翻译助手] 插件已安装/更新:', details.reason);
    
    try {
        // 检查是否已有配置
        const result = await chrome.storage.sync.get('translatorConfig');
        
        if (!result.translatorConfig) {
            // 首次安装，设置默认配置
            const defaultConfig = {
                ...DEFAULT_CONFIG,
                lastUpdated: Date.now(),
                firstInstall: true
            };
            
            await chrome.storage.sync.set({ translatorConfig: defaultConfig });
            console.log('[翻译助手] 默认配置已设置');
            
            // 显示欢迎页面或设置页面
            if (details.reason === 'install') {
                // 新安装时打开设置页面
                chrome.tabs.create({
                    url: chrome.runtime.getURL('settings.html')
                });
            }
        } else {
            console.log('[翻译助手] 配置已存在，当前设置:', result.translatorConfig);
        }
    } catch (error) {
        console.error('[翻译助手] 初始化配置失败:', error);
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'getConfig') {
        // 获取当前配置
        chrome.storage.sync.get('translatorConfig').then(result => {
            const config = result.translatorConfig || {};
            const mergedConfig = {
                ...DEFAULT_CONFIG,
                ...config,
                lastUpdated: config.lastUpdated || Date.now()
            };
            sendResponse({
                success: true,
                config: mergedConfig
            });
        }).catch(error => {
            sendResponse({
                success: false,
                error: error.message
            });
        });
        return true; // 表示异步响应
    }
    
    if (request.action === 'testConnection') {
        // 测试服务器连接
        testServerConnection(request.serverUrl, request.endpoint).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({
                success: false,
                error: error.message
            });
        });
        return true; // 表示异步响应
    }
});

// 测试服务器连接
async function testServerConnection(serverUrl, endpoint = '/translate') {
    try {
        const testUrl = `${serverUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
        
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sentence: '连接测试'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 监听标签页更新，向新页面注入配置
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && 
        (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
        
        // 向页面发送当前配置
        chrome.storage.sync.get('translatorConfig').then(result => {
            if (result.translatorConfig) {
                chrome.tabs.sendMessage(tabId, {
                    action: 'configUpdate',
                    config: result.translatorConfig
                }).catch(() => {
                    // 忽略无法发送消息的情况（页面可能没有content script）
                });
            }
        });
    }
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(function(tab) {
    // 打开设置页面在新标签页
    chrome.tabs.create({
        url: chrome.runtime.getURL('settings.html')
    });
});

console.log('[翻译助手] 后台脚本已加载');



