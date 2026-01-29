"""
JSONL 数据集构建器
从 MongoDB 拉取老人的记忆数据，格式化为标准 JSONL 训练格式
"""
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from pymongo import MongoClient

from .logger import logger
from config.config_loader import config


class JSONLBuilder:
    """JSONL 数据集构建器"""
    
    def __init__(self, mongo_uri: str = None):
        """
        初始化构建器
        :param mongo_uri: MongoDB 连接字符串，默认从环境变量读取
        """
        self.mongo_uri = mongo_uri or os.getenv('MONGODB_URI', 'mongodb://mongoserver:27017/afs')
        self.client = None
        self.db = None
    
    def connect(self):
        """连接到 MongoDB"""
        try:
            self.client = MongoClient(self.mongo_uri)
            # 从 URI 中提取数据库名
            db_name = self.mongo_uri.split('/')[-1].split('?')[0] or 'afs'
            self.db = self.client[db_name]
            logger.info(f"成功连接到 MongoDB: {db_name}")
        except Exception as e:
            logger.error(f"MongoDB 连接失败: {e}")
            raise
    
    def disconnect(self):
        """断开 MongoDB 连接"""
        if self.client:
            self.client.close()
            logger.info("MongoDB 连接已关闭")
    
    def fetch_elder_memories(self, elder_id: str) -> List[Dict[str, Any]]:
        """
        拉取指定老人的所有记忆数据
        :param elder_id: 老人 ID
        :return: 记忆数据列表
        """
        if not self.db:
            self.connect()
        
        try:
            # 从 answers 集合获取老人的回答数据
            answers = list(self.db.answers.find({
                'elderId': elder_id,
                'answer': {'$exists': True, '$ne': ''}
            }))
            
            logger.info(f"为老人 {elder_id} 拉取到 {len(answers)} 条记忆数据")
            
            # 关联问题信息
            memories = []
            for answer in answers:
                question_id = answer.get('questionId')
                if question_id:
                    question = self.db.questions.findOne({'_id': question_id})
                    if question:
                        memories.append({
                            'question': question.get('questionText', ''),
                            'answer': answer.get('answer', ''),
                            'category': question.get('category', 'general'),
                            'timestamp': answer.get('createdAt', datetime.now())
                        })
            
            return memories
        except Exception as e:
            logger.error(f"拉取老人记忆数据失败: {e}")
            return []
    
    def format_to_chat_template(self, memories: List[Dict[str, Any]], 
                                elder_name: str = "长辈") -> List[str]:
        """
        将记忆数据格式化为 Ollama 聊天模板格式
        格式: <|system|>...<|user|>...<|assistant|>...<|eot_id|>
        
        :param memories: 记忆数据列表
        :param elder_name: 老人姓名
        :return: 格式化后的文本列表
        """
        from .system_prompt import SystemPromptGenerator
        
        # 生成 system prompt
        prompt_gen = SystemPromptGenerator()
        system_prompt = prompt_gen.generate(elder_name, memories[:5])  # 使用前5条记忆生成prompt
        
        formatted_texts = []
        for memory in memories:
            question = memory.get('question', '').strip()
            answer = memory.get('answer', '').strip()
            
            if not question or not answer:
                continue
            
            # 构建聊天格式（适配 Qwen/DeepSeek 模型）
            text = (
                f"<|system|>\n{system_prompt}\n"
                f"<|user|>\n{question}\n"
                f"<|assistant|>\n{answer}\n"
                f"<|eot_id|>"
            )
            formatted_texts.append(text)
        
        return formatted_texts
    
    def build_jsonl(self, elder_id: str, output_dir: str = None, 
                   elder_name: str = "长辈") -> str:
        """
        为指定老人构建 JSONL 数据集文件
        
        :param elder_id: 老人 ID
        :param output_dir: 输出目录，默认从配置读取
        :param elder_name: 老人姓名
        :return: 生成的 JSONL 文件路径
        """
        # 获取输出目录
        if not output_dir:
            output_dir = config.get_paths().get('jsonl_output', '/app/data/jsonl')
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # 拉取记忆数据
        logger.info(f"开始为老人 {elder_id} 构建 JSONL 数据集...")
        memories = self.fetch_elder_memories(elder_id)
        
        if not memories:
            logger.warning(f"老人 {elder_id} 没有可用的记忆数据")
            return None
        
        # 格式化为聊天模板
        formatted_texts = self.format_to_chat_template(memories, elder_name)
        
        # 写入 JSONL 文件
        jsonl_file = output_path / f"{elder_id}_training.jsonl"
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            for text in formatted_texts:
                json_obj = {"text": text}
                f.write(json.dumps(json_obj, ensure_ascii=False) + '\n')
        
        logger.info(f"JSONL 数据集已生成: {jsonl_file} ({len(formatted_texts)} 条数据)")
        return str(jsonl_file)
    
    def export_jsonl(self, elder_id: str, output_path: str = None) -> Optional[str]:
        """
        导出老人的 JSONL 数据集（API 调用接口）
        
        :param elder_id: 老人 ID
        :param output_path: 输出文件路径
        :return: 生成的文件路径
        """
        try:
            result = self.build_jsonl(elder_id, output_path)
            return result
        except Exception as e:
            logger.exception(f"导出 JSONL 失败: {e}")
            return None
        finally:
            self.disconnect()
    
    def __enter__(self):
        """支持 with 语句"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """支持 with 语句"""
        self.disconnect()


if __name__ == '__main__':
    # 测试 JSONL 构建
    builder = JSONLBuilder()
    
    with builder:
        # 示例：为老人 "LXM19580312M" 构建数据集
        result = builder.build_jsonl(
            elder_id="LXM19580312M",
            elder_name="李小明"
        )
        print(f"生成的 JSONL 文件: {result}")
