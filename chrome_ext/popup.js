// Chrome插件设置页面脚本
(function() {
    'use strict';
    
    // 默认配置
    const DEFAULT_CONFIG = {
        serverUrl: 'http://127.0.0.1:5000',
        apiUrl: '',
        apiKey: '',
        modelName: '',
        systemPrompt: '你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。',
        userPromptTemplate: '翻译下面句子中的「{target_word}」：{context_sentence}'
    };
    
    // DOM元素
    let serverUrlInput;
    let apiUrlInput;
    let apiKeyInput;
    let modelNameInput;
    let systemPromptInput;
    let userPromptTemplateInput;
    let saveBtn;
    let resetBtn;
    let testBtn;
    let statusDiv;
    let currentServerUrlDiv;
    let currentApiUrlDiv;
    let currentModelDiv;
    let currentApiKeyDiv;
    let currentSystemPromptDiv;
    let currentUserPromptTemplateDiv;
    
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        initializeElements();
        loadCurrentSettings();
        bindEvents();
    });
    
    // 初始化DOM元素
    function initializeElements() {
        serverUrlInput = document.getElementById('serverUrl');
        apiUrlInput = document.getElementById('apiUrl');
        apiKeyInput = document.getElementById('apiKey');
        modelNameInput = document.getElementById('modelName');
        systemPromptInput = document.getElementById('systemPrompt');
        userPromptTemplateInput = document.getElementById('userPromptTemplate');
        saveBtn = document.getElementById('saveBtn');
        resetBtn = document.getElementById('resetBtn');
        testBtn = document.getElementById('testBtn');
        statusDiv = document.getElementById('status');
        currentServerUrlDiv = document.getElementById('currentServerUrl');
        currentApiUrlDiv = document.getElementById('currentApiUrl');
        currentModelDiv = document.getElementById('currentModel');
        currentApiKeyDiv = document.getElementById('currentApiKey');
        currentSystemPromptDiv = document.getElementById('currentSystemPrompt');
        currentUserPromptTemplateDiv = document.getElementById('currentUserPromptTemplate');
    }
    
    // 加载当前设置
    async function loadCurrentSettings() {
        try {
            const config = await getStoredConfig();
            serverUrlInput.value = config.serverUrl || '';
            apiUrlInput.value = config.apiUrl || '';
            apiKeyInput.value = config.apiKey || '';
            modelNameInput.value = config.modelName || '';
            systemPromptInput.value = config.systemPrompt || '';
            userPromptTemplateInput.value = config.userPromptTemplate || '';
            
            currentServerUrlDiv.textContent = config.serverUrl || '未设置';
            currentApiUrlDiv.textContent = config.apiUrl || '未设置';
            currentModelDiv.textContent = config.modelName || '未设置';
            currentApiKeyDiv.textContent = config.apiKey ? '已设置' : '未设置';
            currentSystemPromptDiv.textContent = (config.systemPrompt || '未设置').substring(0, 20) + '...';
            currentUserPromptTemplateDiv.textContent = (config.userPromptTemplate || '未设置').substring(0, 20) + '...';
        } catch (error) {
            console.error('加载设置失败:', error);
            showStatus('加载设置失败', 'error');
        }
    }
    
    // 绑定事件
    function bindEvents() {
        saveBtn.addEventListener('click', saveSettings);
        resetBtn.addEventListener('click', resetSettings);
        testBtn.addEventListener('click', testConnection);
        
        // 输入框变化时更新预览
        serverUrlInput.addEventListener('input', updatePreview);
        apiUrlInput.addEventListener('input', updateApiPreview);
        modelNameInput.addEventListener('input', updateApiPreview);
        apiKeyInput.addEventListener('input', updateApiPreview);
        systemPromptInput.addEventListener('input', updatePromptPreview);
        userPromptTemplateInput.addEventListener('input', updatePromptPreview);
        
        // 回车键保存
        serverUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveSettings();
            }
        });
        
        apiUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveSettings();
            }
        });
        
        apiKeyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveSettings();
            }
        });
        
        modelNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                saveSettings();
            }
        });
        
        systemPromptInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) { // Ctrl+Enter 保存
                saveSettings();
            }
        });
        
        userPromptTemplateInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) { // Ctrl+Enter 保存
                saveSettings();
            }
        });
    }
    
    // 更新预览
    function updatePreview() {
        const url = serverUrlInput.value.trim() || '未设置';
        currentServerUrlDiv.textContent = url;
    }
    
    // 更新API配置预览
    function updateApiPreview() {
        const apiUrl = apiUrlInput.value.trim() || '未设置';
        const modelName = modelNameInput.value.trim() || '未设置';
        const apiKey = apiKeyInput.value.trim();
        
        currentApiUrlDiv.textContent = apiUrl;
        currentModelDiv.textContent = modelName;
        currentApiKeyDiv.textContent = apiKey ? '已设置' : '未设置';
    }
    
    // 更新提示词配置预览
    function updatePromptPreview() {
        const systemPrompt = systemPromptInput.value.trim() || '未设置';
        const userPromptTemplate = userPromptTemplateInput.value.trim() || '未设置';
        
        currentSystemPromptDiv.textContent = systemPrompt.substring(0, 20) + '...';
        currentUserPromptTemplateDiv.textContent = userPromptTemplate.substring(0, 20) + '...';
    }
    
    // 保存设置
    async function saveSettings() {
        const serverUrl = serverUrlInput.value.trim();
        const apiUrl = apiUrlInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const modelName = modelNameInput.value.trim();
        const systemPrompt = systemPromptInput.value.trim();
        const userPromptTemplate = userPromptTemplateInput.value.trim();
        
        // 验证必填项
        if (!serverUrl) {
            showStatus('请输入后端服务地址', 'error');
            return;
        }
        
        if (!isValidUrl(serverUrl)) {
            showStatus('请输入有效的后端服务URL地址', 'error');
            return;
        }
        
        if (apiUrl && !isValidUrl(apiUrl)) {
            showStatus('请输入有效的API URL地址', 'error');
            return;
        }
        
        // 验证用户提示词模板格式
        if (userPromptTemplate && !userPromptTemplate.includes('{target_word}')) {
            showStatus('用户提示词模板必须包含 {target_word} 占位符', 'error');
            return;
        }
        
        if (userPromptTemplate && !userPromptTemplate.includes('{context_sentence}')) {
            showStatus('用户提示词模板必须包含 {context_sentence} 占位符', 'error');
            return;
        }
        
        try {
            const config = {
                serverUrl: serverUrl,
                apiUrl: apiUrl,
                apiKey: apiKey,
                modelName: modelName,
                systemPrompt: systemPrompt,
                userPromptTemplate: userPromptTemplate,
                lastUpdated: Date.now()
            };
            
            await chrome.storage.sync.set({ translatorConfig: config });
            showStatus('设置保存成功！', 'success');
            
            // 更新当前设置显示
            currentServerUrlDiv.textContent = config.serverUrl;
            currentApiUrlDiv.textContent = config.apiUrl || '未设置';
            currentModelDiv.textContent = config.modelName || '未设置';
            currentApiKeyDiv.textContent = config.apiKey ? '已设置' : '未设置';
            currentSystemPromptDiv.textContent = (config.systemPrompt || '未设置').substring(0, 20) + '...';
            currentUserPromptTemplateDiv.textContent = (config.userPromptTemplate || '未设置').substring(0, 20) + '...';
            
            // 通知content script配置已更新
            notifyConfigUpdate();
            
        } catch (error) {
            console.error('保存设置失败:', error);
            showStatus('保存设置失败', 'error');
        }
    }
    
    // 重置设置
    async function resetSettings() {
        try {
            serverUrlInput.value = DEFAULT_CONFIG.serverUrl;
            apiUrlInput.value = DEFAULT_CONFIG.apiUrl;
            apiKeyInput.value = DEFAULT_CONFIG.apiKey;
            modelNameInput.value = DEFAULT_CONFIG.modelName;
            systemPromptInput.value = DEFAULT_CONFIG.systemPrompt;
            userPromptTemplateInput.value = DEFAULT_CONFIG.userPromptTemplate;
            
            await chrome.storage.sync.set({ 
                translatorConfig: { 
                    ...DEFAULT_CONFIG, 
                    lastUpdated: Date.now() 
                }
            });
            showStatus('设置已重置为默认值', 'success');
            updatePreview();
            updateApiPreview();
            updatePromptPreview();
            notifyConfigUpdate();
        } catch (error) {
            console.error('重置设置失败:', error);
            showStatus('重置设置失败', 'error');
        }
    }
    
    // 测试连接
    async function testConnection() {
        const serverUrl = serverUrlInput.value.trim();
        
        if (!serverUrl) {
            showStatus('请先输入后端服务地址', 'error');
            return;
        }
        
        if (!isValidUrl(serverUrl)) {
            showStatus('请输入有效的URL地址', 'error');
            return;
        }
        
        showStatus('正在测试翻译服务...', 'testing');
        testBtn.disabled = true;
        
        try {
            const testUrl = `${serverUrl}/translate`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时，翻译需要更多时间
            
            // 使用一个包含中文的测试句子
            const testSentence = '这是一个测试句子，用来验证翻译服务是否正常工作。';
            const requestBody = {
                sentence: testSentence
            };
            
            // 如果有API配置，添加到请求中
            const apiUrl = apiUrlInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            const modelName = modelNameInput.value.trim();
            const systemPrompt = systemPromptInput.value.trim();
            const userPromptTemplate = userPromptTemplateInput.value.trim();
            
            if (apiUrl || apiKey || modelName || systemPrompt || userPromptTemplate) {
                requestBody.api_config = {
                    api_url: apiUrl,
                    api_key: apiKey,
                    model_name: modelName,
                    system_prompt: systemPrompt || '你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。',
                    user_prompt_template: userPromptTemplate || '翻译下面句子中的「{target_word}」：{context_sentence}'
                };
            }
            
            console.log('发送翻译测试请求:', requestBody);
            
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const result = await response.json();
                console.log('翻译测试响应:', result);
                
                if (result && result.target_word && result.translation) {
                    showStatus(`翻译测试成功！ ✅\n发现词汇: "${result.target_word}" → "${result.translation}"`, 'success');
                } else if (result && result.message) {
                    showStatus(`服务连接成功，但翻译结果异常: ${result.message}`, 'error');
                } else {
                    showStatus('服务连接成功，但未返回有效的翻译结果', 'error');
                }
            } else {
                const errorText = await response.text();
                showStatus(`翻译服务调用失败: HTTP ${response.status}\n${errorText}`, 'error');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                showStatus('翻译服务请求超时，请检查服务器配置或网络连接', 'error');
            } else {
                showStatus(`翻译服务测试失败: ${error.message}`, 'error');
            }
            console.error('翻译服务测试失败:', error);
        } finally {
            testBtn.disabled = false;
        }
    }
    
    // 获取存储的配置
    async function getStoredConfig() {
        try {
            const result = await chrome.storage.sync.get('translatorConfig');
            const config = result.translatorConfig || {};
            return {
                ...DEFAULT_CONFIG,
                ...config,
                lastUpdated: config.lastUpdated || Date.now()
            };
        } catch (error) {
            console.error('获取配置失败:', error);
            return { ...DEFAULT_CONFIG, lastUpdated: Date.now() };
        }
    }
    
    // 验证URL格式
    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }
    
    // 显示状态消息
    function showStatus(message, type) {
        // 处理多行消息，将\n转换为<br>
        if (message.includes('\n')) {
            statusDiv.innerHTML = message.replace(/\n/g, '<br>');
        } else {
            statusDiv.textContent = message;
        }
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // 成功消息显示更长时间，错误消息不自动隐藏
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000); // 延长到5秒
        }
    }
    
    // 通知content script配置已更新
    function notifyConfigUpdate() {
        // 向所有标签页的content script发送配置更新消息
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'configUpdated',
                        timestamp: Date.now()
                    }).catch(() => {
                        // 忽略无法发送消息的标签页（可能没有content script）
                    });
                }
            });
        });
    }
    
    
})();



