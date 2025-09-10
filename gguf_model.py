import requests
import jieba.posseg as pseg
import random
import json
import os
import hashlib
import time
import argparse
import sqlite3
from configparser import ConfigParser, NoSectionError, NoOptionError
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# ==============================================================================
# 1. 统一且可扩展的 API 提供者
# ==============================================================================


class TranslationProvider:
    """
    一个完全由配置驱动的通用翻译 API 提供者。
    支持自定义请求头、网络代理和环境变量占位符。
    """

    def __init__(self, provider_name, config: ConfigParser):
        if not config.has_section(provider_name):
            raise ValueError(
                f"配置错误: 在 config.ini 中未找到名为 '[{provider_name}]' 的配置节"
            )

        provider_config = config[provider_name]
        default_config = config["DEFAULT"]

        # 环境变量解析辅助函数
        def get_config_value(section, key, fallback=""):
            """从配置中获取值，并解析环境变量。"""
            # ConfigParser 默认支持环境变量插值，但我们需要更灵活的处理
            # 使用 os.path.expandvars 来解析 ${VAR} 或 $VAR 格式
            raw_value = section.get(key, fallback)
            return os.path.expandvars(raw_value)

        self.provider_name = provider_name
        self.api_url = get_config_value(provider_config, "api_url")
        self.model = get_config_value(provider_config, "model", fallback="default")
        self.api_key = get_config_value(provider_config, "api_key", fallback="")
        self.use_system_role = provider_config.getboolean("use_system_role", True)

        # 优先使用 provider_config 的 system_prompt，否则回退到 default_config
        self.system_prompt = get_config_value(
            provider_config,
            "system_prompt",
            fallback=get_config_value(default_config, "system_prompt"),
        )

        # 优先使用 provider_config 的 proxy，否则回退到 default_config
        self.proxy = get_config_value(
            provider_config,
            "proxy",
            fallback=get_config_value(default_config, "proxy", None),
        )

        # 解析所有以 'header_' 开头的自定义请求头
        self.custom_headers = {}
        for key, value in provider_config.items():
            if key.startswith("header_"):
                # 将 'header_http-referer' 转换为 'HTTP-Referer'
                header_name = key[len("header_") :].replace("_", "-").title()
                # 同样解析环境变量
                self.custom_headers[header_name] = os.path.expandvars(value)

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
    """
    翻译缓存类，使用 SQLite 数据库进行持久化存储，
    并跟踪词语选择频率。
    """

    def __init__(self, db_file="translens_data.db"):
        self.db_file = db_file
        self.conn = None
        try:
            self.conn = sqlite3.connect(self.db_file, check_same_thread=False)
            print(f"数据库连接成功: {self.db_file}")
            self._init_db()
        except sqlite3.Error as e:
            print(f"数据库错误: {e}")
            exit(1)  # 如果数据库无法连接，则终止程序

    def _init_db(self):
        """初始化数据库，创建所需的表"""
        cursor = self.conn.cursor()
        # 创建翻译缓存表
        # key 是 sentence 和 target_word 的 MD5 哈希值，确保唯一性
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS translation_cache (
            key TEXT PRIMARY KEY,
            sentence TEXT NOT NULL,
            target_word TEXT NOT NULL,
            translation TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )
        """)
        # 创建词频表
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_frequency (
            word TEXT PRIMARY KEY,
            frequency INTEGER NOT NULL DEFAULT 0
        )
        """)
        self.conn.commit()
        print("数据库表初始化完成。")

    def _generate_key(self, sentence, target_word):
        """根据句子和目标词生成缓存键"""
        key_string = f"{sentence}|{target_word}"
        return hashlib.md5(key_string.encode("utf-8")).hexdigest()

    # 不再需要 load_cache 和 save_cache，数据库会自动处理
    # 不再需要 load_frequency 和 save_frequency

    def get(self, sentence, target_word):
        """从数据库获取缓存的翻译结果"""
        key = self._generate_key(sentence, target_word)
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT translation, sentence, target_word, timestamp FROM translation_cache WHERE key = ?",
            (key,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "translation": row[0],
                "sentence": row[1],
                "target_word": row[2],
                "timestamp": row[3],
            }
        return None

    def set(self, sentence, target_word, translation):
        """向数据库设置缓存的翻译结果"""
        key = self._generate_key(sentence, target_word)
        timestamp = int(time.time())
        cursor = self.conn.cursor()
        # 使用 INSERT OR REPLACE 实现存在即更新，不存在即插入
        cursor.execute(
            """
        INSERT OR REPLACE INTO translation_cache (key, sentence, target_word, translation, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """,
            (key, sentence, target_word, translation, timestamp),
        )
        self.conn.commit()

    def increment_word_frequency(self, word):
        """增加词语被选择的次数"""
        cursor = self.conn.cursor()
        # 首先尝试更新，如果词语不存在，则插入
        cursor.execute(
            "UPDATE word_frequency SET frequency = frequency + 1 WHERE word = ?",
            (word,),
        )
        if cursor.rowcount == 0:
            cursor.execute(
                "INSERT INTO word_frequency (word, frequency) VALUES (?, 1)", (word,)
            )
        self.conn.commit()

        # 打印更新后的频率以供调试
        new_freq = self.get_word_frequency(word)
        print(f"词语 '{word}' 选择次数更新为: {new_freq}")

    def get_word_frequency(self, word):
        """从数据库获取词语被选择的次数"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT frequency FROM word_frequency WHERE word = ?", (word,))
        row = cursor.fetchone()
        return row[0] if row else 0

    def weighted_choice(self, words):
        """基于反向权重选择词语，被选择次数越多的词语权重越低"""
        if not words:
            return None

        if len(words) == 1:
            return words[0]

        weights = []
        for word in words:
            frequency = self.get_word_frequency(word)
            # 使用反向权重公式：1/(frequency + 1)
            weight = 1.0 / (frequency + 1)
            weights.append(weight)

        # 使用 random.choices 进行带权重的随机选择，更简洁
        chosen_word = random.choices(words, weights=weights, k=1)[0]
        return chosen_word

    def __del__(self):
        """在对象销毁时关闭数据库连接"""
        if self.conn:
            self.conn.close()
            print("数据库连接已关闭。")

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

# ==============================================================================
# 4. 主程序入口
# ==============================================================================

if __name__ == "__main__":
    # 2. 在程序开始时加载 .env 文件
    # 这会把 .env 文件中的键值对加载到环境变量中
    load_dotenv()
    print("已加载 .env 文件中的环境变量。")

    parser = argparse.ArgumentParser(description="启动 TransLens 后端翻译服务。")
    parser.add_argument(
        "--provider",
        type=str,
        help="指定要使用的 API 提供者 (必须在 config.ini 中定义)。",
    )
    args = parser.parse_args()

    # 3. 修改 ConfigParser，使其能够处理环境变量
    # 我们将在 TranslationProvider 内部使用 os.path.expandvars，
    # 所以这里的 ConfigParser 不需要特殊设置。
    config = ConfigParser()
    config.read("config.ini", encoding="utf-8")

    # 命令行参数 > config.ini [DEFAULT] provider > fallback
    default_provider_from_config = os.path.expandvars(
        config.get("DEFAULT", "provider", fallback="local_llama")
    )
    provider_name = args.provider or default_provider_from_config

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