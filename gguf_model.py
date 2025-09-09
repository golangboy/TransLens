import requests
import jieba.posseg as pseg
import random
import json
import os
import hashlib
import time
from flask import Flask, request, jsonify

from flask_cors import CORS  # 导入 CORS

app = Flask(__name__)
CORS(app)  # 启用 CORS，允许所有来源访问所有路由

# 外部 API 的 URL
API_URL = 'http://localhost:8080/v1/chat/completions'

# 外部 API 请求头
HEADERS = {
    'Content-Type': 'application/json',
}


class TranslationCache:
    """翻译缓存类，用于管理翻译结果的缓存和持久化，以及词语选择频率跟踪"""
    
    def __init__(self, cache_file='translation_cache.json', frequency_file='word_frequency.json'):
        self.cache_file = cache_file
        self.frequency_file = frequency_file
        self.cache = {}
        self.word_frequency = {}  # 记录每个词语被选择的次数
        self.load_cache()
        self.load_frequency()
    
    def _generate_key(self, sentence, target_word):
        """根据句子和目标词生成缓存键"""
        key_string = f"{sentence}|{target_word}"
        return hashlib.md5(key_string.encode('utf-8')).hexdigest()
    
    def load_cache(self):
        """从文件加载缓存"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.cache = json.load(f)
                print(f"缓存已从 {self.cache_file} 加载，共 {len(self.cache)} 条记录")
            else:
                print(f"缓存文件 {self.cache_file} 不存在，将创建新的缓存")
        except Exception as e:
            print(f"加载缓存失败: {e}")
            self.cache = {}
    
    def load_frequency(self):
        """从文件加载词语选择频率"""
        try:
            if os.path.exists(self.frequency_file):
                with open(self.frequency_file, 'r', encoding='utf-8') as f:
                    self.word_frequency = json.load(f)
                print(f"词语频率已从 {self.frequency_file} 加载，共 {len(self.word_frequency)} 个词语")
            else:
                print(f"频率文件 {self.frequency_file} 不存在，将创建新的频率记录")
        except Exception as e:
            print(f"加载频率失败: {e}")
            self.word_frequency = {}

    def save_cache(self):
        """将缓存保存到文件"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
            print(f"缓存已保存到 {self.cache_file}")
        except Exception as e:
            print(f"保存缓存失败: {e}")
    
    def save_frequency(self):
        """将词语选择频率保存到文件"""
        try:
            with open(self.frequency_file, 'w', encoding='utf-8') as f:
                json.dump(self.word_frequency, f, ensure_ascii=False, indent=2)
            print(f"词语频率已保存到 {self.frequency_file}")
        except Exception as e:
            print(f"保存频率失败: {e}")
    
    def get(self, sentence, target_word):
        """获取缓存的翻译结果"""
        key = self._generate_key(sentence, target_word)
        return self.cache.get(key)
    
    def set(self, sentence, target_word, translation):
        """设置缓存的翻译结果"""
        key = self._generate_key(sentence, target_word)
        self.cache[key] = {
            'sentence': sentence,
            'target_word': target_word,
            'translation': translation,
            'timestamp': int(time.time())
        }
        self.save_cache()
    
    def increment_word_frequency(self, word):
        """增加词语被选择的次数"""
        if word in self.word_frequency:
            self.word_frequency[word] += 1
        else:
            self.word_frequency[word] = 1
        self.save_frequency()
        print(f"词语 '{word}' 选择次数更新为: {self.word_frequency[word]}")
    
    def get_word_frequency(self, word):
        """获取词语被选择的次数"""
        return self.word_frequency.get(word, 0)
    
    def weighted_choice(self, words):
        """基于反向权重选择词语，被选择次数越多的词语权重越低"""
        if not words:
            return None
        
        if len(words) == 1:
            return words[0]
        
        # 计算每个词语的权重（反向权重）
        weights = []
        for word in words:
            frequency = self.get_word_frequency(word)
            # 使用反向权重公式：1/(frequency + 1)
            # 这样频率为0的词语权重为1，频率越高权重越低
            weight = 1.0 / (frequency + 1)
            weights.append(weight)
        
        # 计算累积权重
        total_weight = sum(weights)
        cumulative_weights = []
        cumulative_sum = 0
        for weight in weights:
            cumulative_sum += weight / total_weight
            cumulative_weights.append(cumulative_sum)
        
        # 生成随机数并选择对应的词语
        rand = random.random()
        for i, cumulative_weight in enumerate(cumulative_weights):
            if rand <= cumulative_weight:
                return words[i]
        
        # fallback，理论上不应该到达这里
        return words[-1]


# 初始化翻译缓存
translation_cache = TranslationCache()


@app.route('/translate', methods=['POST'])
def translate_word():
    """
    接收一个中文句子，提取其中的名词和动词，随机选择一个，
    然后调用外部翻译接口返回该词的英文翻译。
    现在包含缓存功能，避免重复翻译相同的词汇。
    """
    data = request.json
    if not data or 'sentence' not in data:
        return jsonify({"error": "请输入有效的JSON，并包含 'sentence' 字段"}), 400

    context_sentence = data['sentence']

    # 使用 jieba.posseg 提取名词和动词
    words = pseg.lcut(context_sentence)
    result = [word for word, flag in words if flag.startswith('n') or flag.startswith('v')]

    if not result:
        return jsonify({"error": "句子中未找到可翻译的名词或动词"}), 404

    # 使用加权选择，被选择次数多的词语权重更低
    target_word = translation_cache.weighted_choice(result)
    
    # 增加该词语的选择次数
    translation_cache.increment_word_frequency(target_word)

    # 检查缓存中是否已有该翻译
    cached_translation = translation_cache.get(context_sentence, target_word)
    if cached_translation:
        print(f"从缓存中获取翻译: {target_word} -> {cached_translation['translation']}")
        return jsonify({
            "target_word": target_word,
            "translation": cached_translation['translation'],
            "from_cache": True,
            "word_frequency": translation_cache.get_word_frequency(target_word)
        })

    # 构造发送给外部翻译接口的 prompt
    prompt = f"翻译下面句子中的「{target_word}」：{context_sentence}"

    # 构造请求体
    json_data = {
        'messages': [
            {"role": "system", "content": "你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。"},
            {"role": "user", "content": prompt}
        ],
    }

    try:
        # 调用外部翻译接口
        print(f"调用外部API翻译: {target_word}")
        response = requests.post(API_URL, headers=HEADERS, json=json_data)
        response.raise_for_status()  # 检查请求是否成功

        # 解析并获取翻译结果
        translated_content = response.json()["choices"][0]["message"]["content"]
        if len(translated_content)>30:
            return jsonify({"error": "翻译结果过长，可能不准确，请尝试其他句子"}), 502
        
        # 将翻译结果保存到缓存
        translation_cache.set(context_sentence, target_word, translated_content)
        print(f"翻译结果已缓存: {target_word} -> {translated_content}")
        
        return jsonify({
            "target_word": target_word,
            "translation": translated_content,
            "from_cache": False,
            "word_frequency": translation_cache.get_word_frequency(target_word)
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"调用外部翻译接口失败: {e}"}), 502
    except (KeyError, IndexError) as e:
        return jsonify({"error": f"解析外部接口响应失败: {e}"}), 502


if __name__ == '__main__':
    # 运行 Flask 应用
    app.run(debug=True, port=5000)