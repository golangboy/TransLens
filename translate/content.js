// Chrome插件内容脚本 - DOM遍历器

(function() {
    'use strict';

    console.log('[DOM遍历插件] 内容脚本已加载');
    
    let hasExecuted = false; // 防止重复执行

    // 执行主要功能
    function executeMain() {
        if (hasExecuted) {
            console.log('[DOM遍历插件] 已经执行过，跳过');
            return;
        }
        hasExecuted = true;
        
        console.log('done');
        traverseAllNodes();
        
        // 新增：提取中文内容并进行翻译
        setTimeout(() => {
            extractAndTranslateChinese();
        }, 1000); // 等待DOM遍历完成后再执行
    }

    // 等待页面完全加载 - 多种触发机制
    function waitForPageLoad() {
        console.log(`[DOM遍历插件] 当前页面状态: ${document.readyState}`);
        
        // 方法1: 如果页面已经加载完成
        if (document.readyState === 'complete') {
            console.log('[DOM遍历插件] 页面已完成加载');
            setTimeout(executeMain, 100); // 稍微延迟确保所有资源加载完成
            return;
        }
        
        // 方法2: 监听 DOMContentLoaded 事件
        if (document.readyState === 'loading') {
            console.log('[DOM遍历插件] 等待DOM加载完成...');
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[DOM遍历插件] DOM内容已加载');
                setTimeout(executeMain, 500);
            });
        }
        
        // 方法3: 监听 window.load 事件
        window.addEventListener('load', function() {
            console.log('[DOM遍历插件] 窗口加载完成');
            setTimeout(executeMain, 100);
        });
        
        // 方法4: 备用延迟执行（确保一定会执行）
        setTimeout(function() {
            if (!hasExecuted) {
                console.log('[DOM遍历插件] 备用触发机制执行');
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
        
        // 随机选择20%的中文句子
        const selectedTexts = randomSelectTexts(chineseTexts, 0.4);
        console.log(`随机选择了 ${selectedTexts.length} 个中文句子进行翻译：`);
        
        // 输出选中的句子
        selectedTexts.forEach((textData, index) => {
            console.log(`${index + 1}. "${textData.text}"`);
        });
        
        // 对选中的句子进行翻译
        translateSelectedTexts(selectedTexts);
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
    
    // 调用翻译API
    async function callTranslateAPI(sentence) {
        const apiUrl = 'http://127.0.0.1:5000/translate';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sentence: sentence
                })
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
            
            // 尝试创建带样式的HTML标注
            if (textData.parent && textData.parent.innerHTML !== undefined) {
                // 如果父元素支持innerHTML，使用HTML样式
                const styledAnnotation = `<span style="color: #ff6b35; font-weight: bold; background-color: #fff3cd; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; margin-left: 2px;">【${translation}】</span>`;
                const currentHTML = textData.parent.innerHTML;
                const newHTML = currentHTML.replace(new RegExp(targetWord, 'g'), `${targetWord}${styledAnnotation}`);
                
                try {
                    textData.parent.innerHTML = newHTML;
                    console.log(`  ✅ 成功添加带样式的英文标注`);
                    console.log(`  标注后: "${targetWord}【${translation}】"`);
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

    // 开始执行
    waitForPageLoad();
  
})();
