// Chrome插件共享配置文件
// 所有默认配置统一在此管理

const DEFAULT_CONFIG = {
    serverUrl: 'http://127.0.0.1:5000',
    apiUrl: 'http://localhost:8080/v1/chat/completions',
    apiKey: '',
    modelName: '',
    systemPrompt: '你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。你只需返回目标词汇的意思，不要有任何多余的内容。',
    userPromptTemplate: '翻译下面句子中的「{target_word}」：{context_sentence}',
    selectionPercentage: 10
};

// 导出配置供其他模块使用
if (typeof window !== 'undefined') {
    // 浏览器环境（content script, popup）
    window.DEFAULT_CONFIG = DEFAULT_CONFIG;
} else if (typeof self !== 'undefined') {
    // Service Worker 环境（background script）
    self.DEFAULT_CONFIG = DEFAULT_CONFIG;
}
