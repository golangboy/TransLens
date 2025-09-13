// Chrome插件内容脚本 - 智能翻译助手

(function() {
    'use strict';

    console.log('[翻译助手] 内容脚本已加载');
    
    let hasExecuted = false; // 防止重复执行
    let translatorConfig = null; // 存储翻译配置
    
    // 默认配置
    const DEFAULT_CONFIG = {
        serverUrl: 'http://127.0.0.1:5000',
        apiUrl: '',
        apiKey: '',
        modelName: '',
        systemPrompt: '你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。',
        userPromptTemplate: '翻译下面句子中的「{target_word}」：{context_sentence}',
        selectionPercentage: 40
    };

    // 执行主要功能
    async function executeMain() {
        if (hasExecuted) {
            console.log('[翻译助手] 已经执行过，跳过');
            return;
        }
        hasExecuted = true;
        
        // 首先加载配置
        await loadTranslatorConfig();
        
        console.log('done');
        traverseAllNodes();
        
        // 新增：提取中文内容并进行翻译
        setTimeout(() => {
            extractAndTranslateChinese();
        }, 1000); // 等待DOM遍历完成后再执行
    }

    // 等待页面完全加载 - 多种触发机制
    function waitForPageLoad() {
        console.log(`[翻译助手] 当前页面状态: ${document.readyState}`);
        
        // 方法1: 如果页面已经加载完成
        if (document.readyState === 'complete') {
            console.log('[翻译助手] 页面已完成加载');
            setTimeout(executeMain, 100); // 稍微延迟确保所有资源加载完成
            return;
        }
        
        // 方法2: 监听 DOMContentLoaded 事件
        if (document.readyState === 'loading') {
            console.log('[翻译助手] 等待DOM加载完成...');
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[翻译助手] DOM内容已加载');
                setTimeout(executeMain, 500);
            });
        }
        
        // 方法3: 监听 window.load 事件
        window.addEventListener('load', function() {
            console.log('[翻译助手] 窗口加载完成');
            setTimeout(executeMain, 100);
        });
        
        // 方法4: 备用延迟执行（确保一定会执行）
        setTimeout(function() {
            if (!hasExecuted) {
                console.log('[翻译助手] 备用触发机制执行');
                executeMain();
            }
        }, 3000); // 3秒后强制执行
    }

    // 递归遍历所有DOM节点
    function traverseAllNodes() {
        console.log('开始递归遍历DOM节点...');
        
        let nodeCount = 0;
        
        function traverseNode(node, depth = 0) {
            nodeCount++;
            
            // 创建缩进以显示层级关系
            const indent = '  '.repeat(depth);
            
            // 根据节点类型输出不同信息
            switch(node.nodeType) {
                case Node.ELEMENT_NODE:
                    console.log(`${indent}元素节点: <${node.tagName.toLowerCase()}> ${getElementInfo(node)}`);
                    break;
                case Node.TEXT_NODE:
                    const text = node.textContent.trim();
                    if (text) {
                        console.log(`${indent}文本节点: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                    }
                    break;
                case Node.COMMENT_NODE:
                    console.log(`${indent}注释节点: <!-- ${node.textContent.substring(0, 30)}${node.textContent.length > 30 ? '...' : ''} -->`);
                    break;
                case Node.DOCUMENT_NODE:
                    console.log(`${indent}文档节点: ${node.nodeName}`);
                    break;
                case Node.DOCUMENT_TYPE_NODE:
                    console.log(`${indent}文档类型节点: <!DOCTYPE ${node.name}>`);
                    break;
                default:
                    console.log(`${indent}其他节点类型 (${node.nodeType}): ${node.nodeName}`);
            }
            
            // 递归遍历子节点
            for (let i = 0; i < node.childNodes.length; i++) {
                traverseNode(node.childNodes[i], depth + 1);
            }
        }
        
        // 获取元素节点的附加信息
        function getElementInfo(element) {
            const info = [];
            
            // ID
            if (element.id) {
                info.push(`id="${element.id}"`);
            }
            
            // 类名
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim();
                if (classes) {
                    info.push(`class="${classes}"`);
                }
            }
            
            // 部分重要属性
            const importantAttrs = ['src', 'href', 'type', 'name', 'value'];
            importantAttrs.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    const value = element.getAttribute(attr);
                    info.push(`${attr}="${value.length > 30 ? value.substring(0, 30) + '...' : value}"`);
                }
            });
            
            return info.length > 0 ? `(${info.join(', ')})` : '';
        }
        
        // 从文档根节点开始遍历
        traverseNode(document);
        
        console.log(`DOM遍历完成！总共遍历了 ${nodeCount} 个节点。`);
        
        // 输出统计信息
        outputStatistics();
    }
    
    // 输出DOM统计信息
    function outputStatistics() {
        console.log('\n=== DOM统计信息 ===');
        
        // 统计各类元素数量
        const elementCounts = {};
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
            const tagName = element.tagName.toLowerCase();
            elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
        });
        
        console.log(`总元素数量: ${allElements.length}`);
        console.log('元素类型统计:');
        
        // 按数量排序并显示
        Object.entries(elementCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10) // 只显示前10个最多的元素类型
            .forEach(([tag, count]) => {
                console.log(`  ${tag}: ${count}个`);
            });
        
        // 其他统计信息
        console.log(`文本节点数量: ${document.createTreeWalker(document, NodeFilter.SHOW_TEXT).nextNode() ? countTextNodes() : 0}`);
        console.log(`注释节点数量: ${countCommentNodes()}`);
        console.log(`页面标题: "${document.title}"`);
        console.log(`页面URL: ${window.location.href}`);
    }
    
    // 统计文本节点数量
    function countTextNodes() {
        let count = 0;
        const walker = document.createTreeWalker(
            document,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        while (walker.nextNode()) {
            count++;
        }
        return count;
    }
    
    // 统计注释节点数量
    function countCommentNodes() {
        let count = 0;
        const walker = document.createTreeWalker(
            document,
            NodeFilter.SHOW_COMMENT
        );
        
        while (walker.nextNode()) {
            count++;
        }
        return count;
    }
    
    // 提取中文内容并进行翻译
    function extractAndTranslateChinese() {
        console.log('\n=== 开始提取中文内容 ===');
        
        const chineseTexts = extractChineseTexts();
        console.log(`发现 ${chineseTexts.length} 个包含中文的文本节点`);
        
        if (chineseTexts.length === 0) {
            console.log('未发现中文内容');
            return;
        }
        
        // 根据配置选择中文句子
        const selectionPercentage = (translatorConfig?.selectionPercentage || DEFAULT_CONFIG.selectionPercentage) / 100;
        const selectedTexts = randomSelectTexts(chineseTexts, selectionPercentage);
        console.log(`按照 ${Math.round(selectionPercentage * 100)}% 的比例随机选择了 ${selectedTexts.length} 个中文句子进行翻译：`);
        
        // 输出选中的句子
        selectedTexts.forEach((textData, index) => {
            console.log(`${index + 1}. "${textData.text}"`);
        });
        
        // 对选中的句子进行翻译
        translateSelectedTexts(selectedTexts);
        
        // 为页面上已存在的可悬浮单词添加事件监听器
        setupExistingWordHoverEvents();
    }
    
    // 提取所有包含中文的文本节点
    function extractChineseTexts() {
        const chineseRegex = /[\u4e00-\u9fff]/;  // 中文字符范围
        const chineseTexts = [];
        
        const walker = document.createTreeWalker(
            document.body || document,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    const text = node.textContent.trim();
                    // 过滤掉空文本、只有标点符号的文本，以及过短的文本
                    if (text.length < 2) return NodeFilter.FILTER_REJECT;
                    
                    // 检查是否包含中文
                    if (chineseRegex.test(text)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
            const text = textNode.textContent.trim();
            if (text.length >= 2) {
                chineseTexts.push({
                    node: textNode,
                    text: text,
                    parent: textNode.parentNode
                });
            }
        }
        
        return chineseTexts;
    }
    
    // 随机选择指定比例的文本
    function randomSelectTexts(texts, percentage) {
        const count = Math.max(1, Math.floor(texts.length * percentage));
        const shuffled = [...texts].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
    
    // 对选中的文本进行翻译
    async function translateSelectedTexts(selectedTexts) {
        console.log('\n=== 开始翻译选中的句子 ===');
        
        for (let i = 0; i < selectedTexts.length; i++) {
            const textData = selectedTexts[i];
            console.log(`正在翻译第 ${i + 1} 个句子: "${textData.text}"`);
            
            try {
                const result = await callTranslateAPI(textData.text);
                if (result && result.target_word && result.translation) {
                    console.log(`  发现目标词汇: "${result.target_word}" -> "${result.translation}"`);
                    
                    // 在目标词汇后添加英文标注
                    annotateWordInText(textData, result.target_word, result.translation);
                } else {
                    console.log(`  翻译API未返回有效结果`);
                }
            } catch (error) {
                console.error(`  翻译失败:`, error);
            }
            
            // 添加延迟避免API请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('=== 翻译完成 ===');
    }
    
    // 加载翻译配置
    async function loadTranslatorConfig() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.sync.get('translatorConfig');
                const config = result.translatorConfig || {};
                translatorConfig = {
                    ...DEFAULT_CONFIG,
                    ...config,
                    lastUpdated: config.lastUpdated || Date.now()
                };
            } else {
                // 如果没有chrome.storage权限，使用默认配置
                translatorConfig = {
                    ...DEFAULT_CONFIG,
                    lastUpdated: Date.now()
                };
            }
            console.log('[翻译助手] 配置已加载:', translatorConfig);
        } catch (error) {
            console.error('[翻译助手] 加载配置失败，使用默认配置:', error);
            translatorConfig = {
                ...DEFAULT_CONFIG,
                lastUpdated: Date.now()
            };
        }
    }
    
    // 调用翻译API
    async function callTranslateAPI(sentence) {
        // 确保配置已加载
        if (!translatorConfig) {
            await loadTranslatorConfig();
        }
        
        const apiUrl = `${translatorConfig.serverUrl}/translate`;
        console.log(`[翻译助手] 调用API: ${apiUrl}`);
        console.log(`[翻译助手] API配置:`, {
            apiUrl: translatorConfig.apiUrl,
            modelName: translatorConfig.modelName,
            hasApiKey: !!translatorConfig.apiKey,
            systemPrompt: translatorConfig.systemPrompt ? translatorConfig.systemPrompt.substring(0, 30) + '...' : '未设置',
            userPromptTemplate: translatorConfig.userPromptTemplate ? translatorConfig.userPromptTemplate.substring(0, 30) + '...' : '未设置'
        });
        
        try {
            const requestBody = {
                sentence: sentence,
                api_config: {
                    api_url: translatorConfig.apiUrl,
                    api_key: translatorConfig.apiKey,
                    model_name: translatorConfig.modelName,
                    system_prompt: translatorConfig.systemPrompt,
                    user_prompt_template: translatorConfig.userPromptTemplate
                }
            };
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }
    
    // 在文本节点中的目标词汇后添加英文标注
    function annotateWordInText(textData, targetWord, translation) {
        const originalText = textData.text;
        
        // 检查原文本是否包含目标词汇
        if (originalText.includes(targetWord)) {
            console.log(`  标注前: "${originalText}"`);
            
            // 尝试创建带样式的HTML标注，包含点击功能
            if (textData.parent && textData.parent.innerHTML !== undefined) {
                // 创建可悬浮的单词元素
                const hoverableWordId = `translens-word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const hoverableWord = `<span id="${hoverableWordId}" class="translens-hoverable-word" style="cursor: pointer; color: #1e3a5f; font-weight: bold; text-decoration: underline; background-color: #e8f4f8; padding: 1px 2px; border-radius: 2px; transition: background-color 0.2s; position: relative;" data-word="${targetWord}" data-translation="${translation}">${targetWord}</span>`;
                
                // 如果父元素支持innerHTML，使用HTML样式
                const styledAnnotation = `<span style="color: #ff6b35; font-weight: bold; background-color: #fff3cd; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; margin-left: 2px;">【${translation}】</span>`;
                const currentHTML = textData.parent.innerHTML;
                const newHTML = currentHTML.replace(new RegExp(targetWord, 'g'), `${hoverableWord}${styledAnnotation}`);
                
                try {
                    textData.parent.innerHTML = newHTML;
                    console.log(`  ✅ 成功添加可悬浮的单词标注`);
                    console.log(`  标注后: "${targetWord}【${translation}】"`);
                    
                    // 为新创建的单词元素添加悬浮事件监听器
                    setTimeout(() => {
                        const wordElement = document.getElementById(hoverableWordId);
                        if (wordElement) {
                            setupWordHoverEvents(wordElement);
                            wordElement.dataset.hoverEventsSet = 'true';
                        }
                    }, 100);
                    
                    return;
                } catch (error) {
                    console.log(`  ⚠️  HTML样式标注失败，使用文本标注: ${error.message}`);
                }
            }
            
            // 如果HTML样式失败，使用更明显的文本标注
            const annotation = ` 【${translation}】`;
            const newText = originalText.replace(new RegExp(targetWord, 'g'), `${targetWord}${annotation}`);
            
            console.log(`  标注后: "${newText}"`);
            
            // 更新DOM节点的文本内容
            try {
                textData.node.textContent = newText;
                console.log(`  ✅ 成功添加文本标注`);
            } catch (error) {
                console.error(`  ❌ 添加标注失败:`, error);
            }
        } else {
            console.log(`  ⚠️  原文本中未找到目标词汇 "${targetWord}"`);
        }
    }

    // 全局tooltip状态管理
    let currentTooltipTimeouts = {
        show: null,
        hide: null
    };
    
    // 设置单词悬浮事件
    function setupWordHoverEvents(wordElement) {
        const word = wordElement.getAttribute('data-word');
        const translation = wordElement.getAttribute('data-translation');
        
        // 鼠标进入事件
        wordElement.addEventListener('mouseenter', function(e) {
            // 清除隐藏超时
            clearTimeout(currentTooltipTimeouts.hide);
            
            // 如果已经有tooltip显示，不需要重新显示
            if (document.getElementById('translens-word-tooltip')) {
                return;
            }
            
            // 延迟显示tooltip，避免快速划过时误触发
            currentTooltipTimeouts.show = setTimeout(() => {
                showWordTooltip(e.target, word, translation);
            }, 200);
        });
        
        // 鼠标离开事件
        wordElement.addEventListener('mouseleave', function(e) {
            clearTimeout(currentTooltipTimeouts.show);
            
            // 延迟隐藏，给用户时间移动到tooltip
            currentTooltipTimeouts.hide = setTimeout(() => {
                const tooltip = document.getElementById('translens-word-tooltip');
                if (tooltip && !tooltip.matches(':hover')) {
                    hideWordTooltip();
                }
            }, 100);
        });
    }
    
    // 为页面上已存在的可悬浮单词设置事件监听器
    function setupExistingWordHoverEvents() {
        const existingWords = document.querySelectorAll('.translens-hoverable-word');
        console.log(`[翻译助手] 为 ${existingWords.length} 个已存在的单词设置悬浮事件`);
        
        existingWords.forEach(wordElement => {
            // 检查是否已经设置了事件监听器
            if (!wordElement.dataset.hoverEventsSet) {
                setupWordHoverEvents(wordElement);
                wordElement.dataset.hoverEventsSet = 'true';
            }
        });
    }
    
    // 显示单词tooltip
    function showWordTooltip(targetElement, word, translation) {
        // 移除可能存在的旧tooltip
        hideWordTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'translens-word-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            z-index: 999999;
            background: white;
            border: 2px solid #1e3a5f;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            max-width: 200px;
            word-wrap: break-word;
        `;
        
        // 添加箭头样式
        const arrowStyle = document.createElement('style');
        arrowStyle.textContent = `
            #translens-word-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 6px solid transparent;
                border-top-color: #1e3a5f;
                z-index: 1000000;
            }
            #translens-word-tooltip.tooltip-below::after {
                top: -12px;
                border-top-color: transparent;
                border-bottom-color: #1e3a5f;
            }
        `;
        document.head.appendChild(arrowStyle);
        
        tooltip.innerHTML = `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: #1e3a5f; margin-bottom: 4px;">${word}</div>
                <div style="color: #666; font-size: 12px;">${translation}</div>
            </div>
            <button id="translens-mark-familiar" style="
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: all 0.2s ease;
            ">
                🚫 不再出现
            </button>
        `;
        
        // 计算tooltip位置
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        document.body.appendChild(tooltip);
        
        // 获取tooltip尺寸
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // 计算最佳位置（默认显示在单词上方，距离更近）
        let top = rect.top + scrollTop - tooltipRect.height - 3;
        let left = rect.left + scrollLeft + (rect.width / 2) - (tooltipRect.width / 2);
        
        // 边界检查和调整
        let isBelow = false;
        if (top < scrollTop + 10) {
            // 如果上方空间不够，显示在下方，距离更近
            top = rect.bottom + scrollTop + 3;
            isBelow = true;
        }
        
        if (left < scrollLeft + 10) {
            left = scrollLeft + 10;
        } else if (left + tooltipRect.width > scrollLeft + window.innerWidth - 10) {
            left = scrollLeft + window.innerWidth - tooltipRect.width - 10;
        }
        
        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
        
        // 根据位置添加相应的CSS类
        if (isBelow) {
            tooltip.classList.add('tooltip-below');
        }
        
        // 绑定按钮事件
        const markFamiliarBtn = tooltip.querySelector('#translens-mark-familiar');
        markFamiliarBtn.addEventListener('click', function() {
            markWordAsFamiliarFromTooltip(word, targetElement);
        });
        
        // 添加鼠标事件，让用户可以与tooltip交互
        tooltip.addEventListener('mouseenter', function() {
            // 清除隐藏超时
            clearTimeout(currentTooltipTimeouts.hide);
        });
        
        tooltip.addEventListener('mouseleave', function() {
            // 当鼠标离开tooltip时，延迟隐藏
            currentTooltipTimeouts.hide = setTimeout(hideWordTooltip, 100);
        });
        
        // 添加hover效果
        markFamiliarBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
            this.style.transform = 'translateY(-1px)';
        });
        
        markFamiliarBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            this.style.transform = 'translateY(0)';
        });
    }
    
    // 隐藏tooltip
    function hideWordTooltip() {
        const tooltip = document.getElementById('translens-word-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        
        // 清理可能残留的样式
        const arrowStyles = document.querySelectorAll('style');
        arrowStyles.forEach(style => {
            if (style.textContent.includes('#translens-word-tooltip::after')) {
                style.remove();
            }
        });
        
        // 清理超时
        clearTimeout(currentTooltipTimeouts.show);
        clearTimeout(currentTooltipTimeouts.hide);
    }
    
    // 从tooltip标记单词为熟悉
    async function markWordAsFamiliarFromTooltip(word, wordElement) {
        console.log(`[翻译助手] 用户标记单词为熟悉: ${word}`);
        
        try {
            await markWordAsFamiliar(word, wordElement.id);
            hideWordTooltip();
        } catch (error) {
            console.error('[翻译助手] 标记熟悉单词失败:', error);
            // 简单的错误提示
            showSuccessNotification('标记失败，请稍后重试', true);
        }
    }
    
    // 显示熟悉单词确认对话框（保留作为备用方案）
    function showFamiliarWordDialog(word, elementId) {
        // 创建对话框HTML
        const dialogHtml = `
            <div id="translens-familiar-dialog" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 999999;
                background: white;
                border: 2px solid #1e3a5f;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                min-width: 320px;
                max-width: 400px;
            ">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 8px 0; color: #1e3a5f; font-size: 18px; font-weight: 600;">单词熟悉度确认</h3>
                    <div style="color: #666; font-size: 14px;">您点击了单词：<strong style="color: #16a8b8;">${word}</strong></div>
                </div>
                
                <div style="margin-bottom: 20px; text-align: center;">
                    <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.5;">
                        您是否对这个单词非常熟悉，<br>希望以后不再显示翻译？
                    </p>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="translens-familiar-yes" style="
                        background: linear-gradient(135deg, #16a8b8 0%, #1e3a5f 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    ">
                        是，我很熟悉
                    </button>
                    <button id="translens-familiar-no" style="
                        background: white;
                        color: #666;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 10px 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    ">
                        继续显示翻译
                    </button>
                </div>
            </div>
            
            <div id="translens-dialog-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999998;
            "></div>
        `;
        
        // 如果已有对话框，先移除
        const existingDialog = document.getElementById('translens-familiar-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        const existingOverlay = document.getElementById('translens-dialog-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 添加对话框到页面
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        
        // 添加事件监听
        const yesButton = document.getElementById('translens-familiar-yes');
        const noButton = document.getElementById('translens-familiar-no');
        const overlay = document.getElementById('translens-dialog-overlay');
        
        // 点击"是，我很熟悉"
        yesButton.addEventListener('click', async function() {
            try {
                await markWordAsFamiliar(word, elementId);
                closeDialog();
            } catch (error) {
                console.error('[翻译助手] 标记熟悉单词失败:', error);
                alert('标记失败，请稍后重试');
            }
        });
        
        // 点击"继续显示翻译"或遮罩层
        noButton.addEventListener('click', closeDialog);
        overlay.addEventListener('click', closeDialog);
        
        // 添加按钮hover效果
        yesButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 4px 12px rgba(22, 168, 184, 0.3)';
        });
        yesButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
        
        noButton.addEventListener('mouseenter', function() {
            this.style.borderColor = '#16a8b8';
            this.style.color = '#16a8b8';
        });
        noButton.addEventListener('mouseleave', function() {
            this.style.borderColor = '#e2e8f0';
            this.style.color = '#666';
        });
        
        function closeDialog() {
            const dialog = document.getElementById('translens-familiar-dialog');
            const overlay = document.getElementById('translens-dialog-overlay');
            if (dialog) dialog.remove();
            if (overlay) overlay.remove();
        }
    }
    
    // 标记单词为熟悉并移除显示
    async function markWordAsFamiliar(word, elementId) {
        console.log(`[翻译助手] 标记单词为熟悉: ${word}`);
        
        // 确保配置已加载
        if (!translatorConfig) {
            await loadTranslatorConfig();
        }
        
        try {
            // 调用后端API添加熟悉单词
            const apiUrl = `${translatorConfig.serverUrl}/familiar-words`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ word: word })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`[翻译助手] 单词已标记为熟悉:`, result);
            
            // 从页面中移除该单词的标注
            removeWordAnnotation(elementId);
            
            // 显示成功提示
            showSuccessNotification(`单词"${word}"已添加到熟悉列表，今后不再显示翻译`);
            
        } catch (error) {
            console.error('[翻译助手] 标记熟悉单词失败:', error);
            throw error;
        }
    }
    
    // 移除单词标注
    function removeWordAnnotation(elementId) {
        const wordElement = document.getElementById(elementId);
        if (wordElement) {
            // 获取原始文本内容
            const originalText = wordElement.textContent;
            
            // 创建文本节点替换原来的元素
            const textNode = document.createTextNode(originalText);
            
            // 同时移除紧邻的翻译标注
            const nextSibling = wordElement.nextSibling;
            if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && 
                nextSibling.textContent.includes('【') && nextSibling.textContent.includes('】')) {
                nextSibling.remove();
            }
            
            wordElement.parentNode.replaceChild(textNode, wordElement);
            console.log(`[翻译助手] 已移除单词"${originalText}"的标注`);
        }
    }
    
    // 显示通知
    function showSuccessNotification(message, isError = false) {
        const notification = document.createElement('div');
        const bgColor = isError ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        const shadowColor = isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: ${bgColor};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px ${shadowColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 3000);
    }

    // 监听配置更新消息
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.action === 'configUpdated') {
                console.log('[翻译助手] 收到配置更新通知，重新加载配置');
                loadTranslatorConfig().then(() => {
                    console.log('[翻译助手] 配置已更新');
                });
                sendResponse({success: true});
            }
        });
    }
    
    // 开始执行
    waitForPageLoad();
  
})();
