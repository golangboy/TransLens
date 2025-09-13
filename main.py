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

# 默认配置参数
DEFAULT_API_URL = 'http://localhost:8080/v1/chat/completions'
DEFAULT_API_KEY = ''  # 默认为空，用户可以设置
DEFAULT_MODEL_NAME = 'gpt-3.5-turbo'  # 默认模型名称
DEFAULT_SYSTEM_PROMPT = '你是一个英语翻译专家，精通于根据中文上下文去翻译词汇的意思。'
DEFAULT_USER_PROMPT_TEMPLATE = '翻译下面句子中的「{target_word}」：{context_sentence}'

# 当前配置参数（可通过API修改）
API_URL = DEFAULT_API_URL
API_KEY = DEFAULT_API_KEY
MODEL_NAME = DEFAULT_MODEL_NAME
SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT
USER_PROMPT_TEMPLATE = DEFAULT_USER_PROMPT_TEMPLATE


class ConfigManager:
    """配置管理类，用于管理API配置参数的持久化"""
    
    def __init__(self, config_file='data/api_config.json'):
        self.config_file = config_file
        # 确保data目录存在
        os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
        self.load_config()
    
    def load_config(self):
        """从文件加载配置"""
        global API_URL, API_KEY, MODEL_NAME, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                API_URL = config.get('api_url', DEFAULT_API_URL)
                API_KEY = config.get('api_key', DEFAULT_API_KEY)
                MODEL_NAME = config.get('model_name', DEFAULT_MODEL_NAME)
                SYSTEM_PROMPT = config.get('system_prompt', DEFAULT_SYSTEM_PROMPT)
                USER_PROMPT_TEMPLATE = config.get('user_prompt_template', DEFAULT_USER_PROMPT_TEMPLATE)
                print(f"配置已从 {self.config_file} 加载")
            else:
                print(f"配置文件 {self.config_file} 不存在，使用默认配置")
        except Exception as e:
            print(f"加载配置失败: {e}，使用默认配置")
            API_URL = DEFAULT_API_URL
            API_KEY = DEFAULT_API_KEY
            MODEL_NAME = DEFAULT_MODEL_NAME
            SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT
            USER_PROMPT_TEMPLATE = DEFAULT_USER_PROMPT_TEMPLATE
    
    def save_config(self):
        """将配置保存到文件"""
        try:
            config = {
                'api_url': API_URL,
                'api_key': API_KEY,
                'model_name': MODEL_NAME,
                'system_prompt': SYSTEM_PROMPT,
                'user_prompt_template': USER_PROMPT_TEMPLATE
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print(f"配置已保存到 {self.config_file}")
        except Exception as e:
            print(f"保存配置失败: {e}")
    
    def update_config(self, api_url=None, api_key=None, model_name=None, system_prompt=None, user_prompt_template=None):
        """更新配置参数"""
        global API_URL, API_KEY, MODEL_NAME, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
        if api_url is not None:
            API_URL = api_url
        if api_key is not None:
            API_KEY = api_key
        if model_name is not None:
            MODEL_NAME = model_name
        if system_prompt is not None:
            SYSTEM_PROMPT = system_prompt
        if user_prompt_template is not None:
            USER_PROMPT_TEMPLATE = user_prompt_template
        self.save_config()
    
    def get_config(self):
        """获取当前配置"""
        return {
            'api_url': API_URL,
            'api_key': API_KEY,
            'model_name': MODEL_NAME,
            'system_prompt': SYSTEM_PROMPT,
            'user_prompt_template': USER_PROMPT_TEMPLATE
        }


class TranslationCache:
    """翻译缓存类，用于管理翻译结果的缓存和持久化，以及词语选择频率跟踪"""
    
    def __init__(self, cache_file='data/translation_cache.json', frequency_file='data/word_frequency.json'):
        self.cache_file = cache_file
        self.frequency_file = frequency_file
        # 确保data目录存在
        os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
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


# 初始化翻译缓存和配置管理器
translation_cache = TranslationCache()
config_manager = ConfigManager()


@app.route('/config', methods=['POST'])
def update_config():
    """
    更新API配置参数
    接受JSON数据，可包含以下字段：
    - api_url: API服务器地址
    - api_key: API密钥
    - model_name: 模型名称
    """
    data = request.json
    if not data:
        return jsonify({"error": "请提供有效的JSON数据"}), 400
    
    # 验证请求字段
    allowed_fields = ['api_url', 'api_key', 'model_name', 'system_prompt', 'user_prompt_template']
    invalid_fields = [field for field in data.keys() if field not in allowed_fields]
    if invalid_fields:
        return jsonify({
            "error": f"不支持的字段: {', '.join(invalid_fields)}",
            "allowed_fields": allowed_fields
        }), 400
    
    try:
        # 更新配置
        config_manager.update_config(
            api_url=data.get('api_url'),
            api_key=data.get('api_key'),
            model_name=data.get('model_name'),
            system_prompt=data.get('system_prompt'),
            user_prompt_template=data.get('user_prompt_template')
        )
        
        # 返回更新后的配置
        return jsonify({
            "message": "配置更新成功",
            "config": config_manager.get_config()
        })
    
    except Exception as e:
        return jsonify({"error": f"更新配置失败: {e}"}), 500


@app.route('/config', methods=['GET'])
def get_config():
    """
    获取当前API配置参数
    """
    try:
        config = config_manager.get_config()
        # 为了安全，不返回完整的API密钥，只返回前几位
        safe_config = config.copy()
        if safe_config['api_key']:
            safe_config['api_key'] = safe_config['api_key'][:4] + '*' * max(0, len(safe_config['api_key']) - 4)
        
        return jsonify({
            "config": safe_config
        })
    
    except Exception as e:
        return jsonify({"error": f"获取配置失败: {e}"}), 500


@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """
    清空翻译缓存和词语频率数据
    """
    try:
        # 清空缓存数据
        translation_cache.cache = {}
        translation_cache.word_frequency = {}
        
        # 保存空的缓存和频率数据到文件
        translation_cache.save_cache()
        translation_cache.save_frequency()
        
        print("缓存和词语频率数据已清空")
        
        return jsonify({
            "message": "缓存清空成功",
            "cache_cleared": True,
            "frequency_cleared": True
        })
    
    except Exception as e:
        print(f"清空缓存失败: {e}")
        return jsonify({"error": f"清空缓存失败: {e}"}), 500


@app.route('/cache/status', methods=['GET'])
def get_cache_status():
    """
    获取缓存状态信息
    """
    try:
        cache_count = len(translation_cache.cache)
        frequency_count = len(translation_cache.word_frequency)
        
        return jsonify({
            "cache_entries": cache_count,
            "frequency_entries": frequency_count,
            "cache_file": translation_cache.cache_file,
            "frequency_file": translation_cache.frequency_file
        })
    
    except Exception as e:
        return jsonify({"error": f"获取缓存状态失败: {e}"}), 500


@app.route('/translate', methods=['POST'])
def translate_word():
    """
    接收一个中文句子，提取其中的名词和动词，随机选择一个，
    然后调用外部翻译接口返回该词的英文翻译。
    现在包含缓存功能，避免重复翻译相同的词汇。
    支持从请求中接收API配置参数。
    """
    data = request.json
    if not data or 'sentence' not in data:
        return jsonify({"error": "请输入有效的JSON，并包含 'sentence' 字段"}), 400

    context_sentence = data['sentence']
    
    # 从请求中获取API配置，如果没有则使用默认配置
    api_config = data.get('api_config', {})
    current_api_url = api_config.get('api_url', API_URL)
    current_api_key = api_config.get('api_key', API_KEY)
    current_model_name = api_config.get('model_name', MODEL_NAME)
    current_system_prompt = api_config.get('system_prompt', SYSTEM_PROMPT)
    current_user_prompt_template = api_config.get('user_prompt_template', USER_PROMPT_TEMPLATE)
    
    print(f"使用API配置: URL={current_api_url}, Model={current_model_name}, HasKey={bool(current_api_key)}")
    print(f"使用提示词配置: SystemPrompt='{current_system_prompt[:50]}...', UserTemplate='{current_user_prompt_template[:50]}...'")

    # 使用 jieba.posseg 提取名词和动词
    words = pseg.lcut(context_sentence)
    result = [
        word for word, flag in words
        if (
            flag.startswith('n')      # 名词
            or flag.startswith('v')   # 动词
            or flag == 'a'            # 形容词
            or flag == 'nr'           # 人名
            or flag == 'nw'           # 作品名
            or flag == 'LOC'          # 地名
        )
    ]

    if not result:
        return jsonify({"error": "句子中未找到可翻译的词语"}), 404

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
    # 使用模板字符串格式化用户提示词
    try:
        user_prompt = current_user_prompt_template.format(
            target_word=target_word,
            context_sentence=context_sentence
        )
    except (KeyError, ValueError) as e:
        print(f"用户提示词模板格式错误: {e}，使用默认模板")
        user_prompt = f"翻译下面句子中的「{target_word}」：{context_sentence}"

    # 构造请求体
    json_data = {
        'messages': [
            {"role": "system", "content": current_system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        'model': current_model_name,  # 使用当前配置的模型名称
    }

    try:
        # 构造请求头
        headers = {
            'Content-Type': 'application/json',
        }
        # 如果配置了API密钥，添加到请求头中
        if current_api_key:
            headers['Authorization'] = f'Bearer {current_api_key}'
        
        # 调用外部翻译接口
        print(f"调用外部API翻译: {target_word} (使用模型: {current_model_name})")
        response = requests.post(current_api_url, headers=headers, json=json_data)
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