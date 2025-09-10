import requests
import jieba.posseg as pseg
import random
import json
import os
import hashlib
import time
import argparse
from configparser import ConfigParser, NoSectionError, NoOptionError

from flask import Flask, request, jsonify
from flask_cors import CORS

# ==============================================================================
# 1. 统一且可扩展的 API 提供者
# ==============================================================================


class TranslationProvider:
    """
    一个完全由配置驱动的通用翻译 API 提供者。
    支持自定义请求头和网络代理。
    """

    def __init__(self, provider_name, config: ConfigParser):
        if not config.has_section(provider_name):
            raise ValueError(
                f"配置错误: 在 config.ini 中未找到名为 '[{provider_name}]' 的配置节"
            )

        provider_config = config[provider_name]
        default_config = config["DEFAULT"]

        self.provider_name = provider_name
        self.api_url = provider_config.get("api_url")
        self.model = provider_config.get("model", fallback="default")
        self.api_key = provider_config.get("api_key", fallback="")
        self.use_system_role = provider_config.getboolean("use_system_role", True)

        # 优先使用 provider_config 的 system_prompt，否则回退到 default_config
        self.system_prompt = provider_config.get(
            "system_prompt", default_config.get("system_prompt")
        )

        # 优先使用 provider_config 的 proxy，否则回退到 default_config
        self.proxy = provider_config.get("proxy", default_config.get("proxy", None))

        # 解析所有以 'header_' 开头的自定义请求头
        self.custom_headers = {}
        for key, value in provider_config.items():
            if key.startswith("header_"):
                # 将 'header_http-referer' 转换为 'HTTP-Referer'
                header_name = key[len("header_") :].replace("_", "-").title()
                self.custom_headers[header_name] = value

        print(
            f"[{self.provider_name}] 提供者已初始化。模型: {self.model}, 使用代理: {self.proxy or '无'}"
        )

    def _build_headers(self):
        """构建请求头"""
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_key != "no-key-required":
            headers["Authorization"] = f"Bearer {self.api_key}"
        # 添加所有自定义头
        headers.update(self.custom_headers)
        return headers

    def _build_payload(self, prompt):
        """构建请求体"""
        messages = []
        if self.use_system_role:
            messages.append({"role": "system", "content": self.system_prompt})
            messages.append({"role": "user", "content": prompt})
        else:
            # 对于不支持 system 角色的模型，将 system prompt 手动加到 user prompt 前面
            full_prompt = f"{self.system_prompt}\n\n---\n\n{prompt}"
            messages.append({"role": "user", "content": full_prompt})

        return {"model": self.model, "messages": messages}

    def _parse_response(self, response_json):
        """默认的响应解析器，适用于OpenAI格式的API"""
        return response_json["choices"][0]["message"]["content"]

    def translate(self, sentence, target_word):
        """执行翻译的完整流程"""
        prompt = f"翻译下面句子中的「{target_word}」：{sentence}"

        headers = self._build_headers()
        payload = self._build_payload(prompt)

        # 配置网络代理
        proxies = None
        if self.proxy:
            proxies = {"http": self.proxy, "https": self.proxy}

        try:
            response = requests.post(
                self.api_url, headers=headers, json=payload, proxies=proxies
            )
            response.raise_for_status()

            translated_content = self._parse_response(response.json())
            if len(translated_content) > 30:
                raise ValueError("翻译结果过长")
            return translated_content

        except requests.exceptions.RequestException as e:
            print(f"[{self.provider_name}] 调用 API 失败: {e}")
            raise
        except (KeyError, IndexError, ValueError) as e:
            print(f"[{self.provider_name}] 解析响应失败: {e}")
            raise


# ==============================================================================
# 2. 缓存系统 (未改变)
# ==============================================================================


class TranslationCache:
    """翻译缓存类，用于管理翻译结果的缓存和持久化，以及词语选择频率跟踪"""

    def __init__(
        self, cache_file="translation_cache.json", frequency_file="word_frequency.json"
    ):
        self.cache_file = cache_file
        self.frequency_file = frequency_file
        self.cache = {}
        self.word_frequency = {}  # 记录每个词语被选择的次数
        self.load_cache()
        self.load_frequency()

    def _generate_key(self, sentence, target_word):
        """根据句子和目标词生成缓存键"""
        key_string = f"{sentence}|{target_word}"
        return hashlib.md5(key_string.encode("utf-8")).hexdigest()

    def load_cache(self):
        """从文件加载缓存"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, "r", encoding="utf-8") as f:
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
                with open(self.frequency_file, "r", encoding="utf-8") as f:
                    self.word_frequency = json.load(f)
                print(
                    f"词语频率已从 {self.frequency_file} 加载，共 {len(self.word_frequency)} 个词语"
                )
            else:
                print(f"频率文件 {self.frequency_file} 不存在，将创建新的频率记录")
        except Exception as e:
            print(f"加载频率失败: {e}")
            self.word_frequency = {}

    def save_cache(self):
        """将缓存保存到文件"""
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
            print(f"缓存已保存到 {self.cache_file}")
        except Exception as e:
            print(f"保存缓存失败: {e}")

    def save_frequency(self):
        """将词语选择频率保存到文件"""
        try:
            with open(self.frequency_file, "w", encoding="utf-8") as f:
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
            "sentence": sentence,
            "target_word": target_word,
            "translation": translation,
            "timestamp": int(time.time()),
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


# ==============================================================================
# 3. Flask 应用
# ==============================================================================

app = Flask(__name__)
CORS(app)

# 全局变量
translation_cache = TranslationCache()
translation_provider = None  # 将在 main 函数中初始化


@app.route("/translate", methods=["POST"])
def translate_word():
    data = request.json
    if not data or "sentence" not in data:
        return jsonify({"error": "请输入有效的JSON，并包含 'sentence' 字段"}), 400

    context_sentence = data["sentence"]
    words = pseg.lcut(context_sentence)
    result = [
        word for word, flag in words if flag.startswith("n") or flag.startswith("v")
    ]

    if not result:
        return jsonify({"error": "句子中未找到可翻译的名词或动词"}), 404

    target_word = translation_cache.weighted_choice(result)
    translation_cache.increment_word_frequency(target_word)

    cached = translation_cache.get(context_sentence, target_word)
    if cached:
        print(f"从缓存命中: {target_word} -> {cached['translation']}")
        return jsonify(
            {
                "target_word": target_word,
                "translation": cached["translation"],
                "from_cache": True,
            }
        )

    try:
        print(f"通过 [{translation_provider.provider_name}] API 翻译: {target_word}")
        translated_content = translation_provider.translate(
            context_sentence, target_word
        )

        translation_cache.set(context_sentence, target_word, translated_content)
        print(f"翻译结果已缓存: {target_word} -> {translated_content}")

        return jsonify(
            {
                "target_word": target_word,
                "translation": translated_content,
                "from_cache": False,
            }
        )

    except Exception as e:
        return jsonify({"error": f"处理翻译请求时发生错误: {e}"}), 502


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="启动 TransLens 后端翻译服务。")
    parser.add_argument(
        "--provider",
        type=str,
        help="指定要使用的 API 提供者 (必须在 config.ini 中定义)。",
    )
    args = parser.parse_args()

    config = ConfigParser()
    config.read("config.ini", encoding="utf-8")

    provider_name = args.provider or config.get(
        "DEFAULT", "provider", fallback="local_llama"
    )
    print("-" * 50)
    print(f"准备启动服务，使用 API 提供者: '{provider_name}'")

    try:
        translation_provider = TranslationProvider(provider_name, config)
    except (ValueError, NoSectionError, NoOptionError) as e:
        print(f"\n[错误] 初始化提供者失败: {e}")
        print("请检查您的命令行参数和 config.ini 文件是否正确。\n")
        exit(1)
    print("-" * 50)

    app.run(debug=True, port=5000)
