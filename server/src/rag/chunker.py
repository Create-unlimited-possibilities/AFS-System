# 文本分块器
import json
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class Chunker:
    """
    文本分块器
    - 将问答对按问题-回答单元进行分块
    - 为每个chunk添加元数据
    - 支持chunk的序列化和反序列化
    """
    
    def __init__(self, max_chunk_size: int = 1000):
        self.max_chunk_size = max_chunk_size
    
    def create_chunk_from_answer(self, answer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        从答案数据创建chunk
        
        Args:
            answer_data: 答案数据字典
            
        Returns:
            chunk数据字典
        """
        # 构建chunk文本内容 - 结合问题和答案
        question_text = answer_data.get('question', '')
        answer_text = answer_data.get('answer', '')
        chunk_text = f"问题: {question_text}\n答案: {answer_text}"
        
        # 生成chunk ID
        chunk_id = answer_data.get('_id', answer_data.get('id', ''))
        if not chunk_id:
            # 如果没有ID，则使用问题和答案的哈希值
            import hashlib
            chunk_id = hashlib.md5(chunk_text.encode()).hexdigest()
        
        # 创建元数据
        metadata = {
            'question_id': answer_data.get('questionId', ''),
            'question': question_text,
            'answer': answer_text,
            'userId': answer_data.get('userId', ''),
            'relationshipType': answer_data.get('relationshipType', ''),
            'createdAt': answer_data.get('createdAt', datetime.now().isoformat()),
            'updatedAt': answer_data.get('updatedAt', datetime.now().isoformat()),
            'source': 'answer',
            'chunk_type': 'qa_pair'
        }
        
        # 添加其他可能的字段
        for key, value in answer_data.items():
            if key not in ['_id', 'id', 'question', 'answer', 'questionId', 'userId', 
                          'relationshipType', 'createdAt', 'updatedAt']:
                metadata[key] = value
        
        return {
            'id': str(chunk_id),
            'text': chunk_text,
            'metadata': metadata,
            'type': 'qa_pair'
        }
    
    def create_chunks_from_answers(self, answers_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        从答案列表创建多个chunks
        
        Args:
            answers_list: 答案数据列表
            
        Returns:
            chunks列表
        """
        chunks = []
        for answer in answers_list:
            chunk = self.create_chunk_from_answer(answer)
            chunks.append(chunk)
        return chunks
    
    def create_chunk_from_qa_pair(self, 
                                 question: str, 
                                 answer: str, 
                                 metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        从问题-答案对直接创建chunk
        
        Args:
            question: 问题文本
            answer: 答案文本
            metadata: 额外的元数据
            
        Returns:
            chunk数据字典
        """
        chunk_text = f"问题: {question}\n答案: {answer}"
        
        # 生成chunk ID
        import hashlib
        chunk_id = hashlib.md5(chunk_text.encode()).hexdigest()
        
        # 合并元数据
        chunk_metadata = {
            'question': question,
            'answer': answer,
            'source': 'qa_pair',
            'chunk_type': 'qa_pair'
        }
        if metadata:
            chunk_metadata.update(metadata)
        
        return {
            'id': chunk_id,
            'text': chunk_text,
            'metadata': chunk_metadata,
            'type': 'qa_pair'
        }
    
    def split_large_text(self, text: str, max_chunk_size: int = None) -> List[str]:
        """
        将大文本分割成较小的块
        
        Args:
            text: 要分割的文本
            max_chunk_size: 最大块大小，默认使用实例设置
            
        Returns:
            文本块列表
        """
        if max_chunk_size is None:
            max_chunk_size = self.max_chunk_size
            
        if len(text) <= max_chunk_size:
            return [text]
        
        # 按句子分割
        sentences = self._split_by_sentences(text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk + sentence) <= max_chunk_size:
                current_chunk += sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _split_by_sentences(self, text: str) -> List[str]:
        """
        按句子分割文本
        
        Args:
            text: 输入文本
            
        Returns:
            句子列表
        """
        import re
        # 匹配中文句号、英文句号、感叹号、问号等作为句子结束符
        sentences = re.split(r'([。！？!?]+)', text)
        
        # 重新组合句子（将标点符号加回到句子末尾）
        combined_sentences = []
        for i in range(0, len(sentences) - 1, 2):
            sentence = sentences[i]
            if i + 1 < len(sentences):
                sentence += sentences[i + 1]
            combined_sentences.append(sentence)
        
        # 过滤掉空字符串
        return [s for s in combined_sentences if s.strip()]
    
    def serialize_chunk(self, chunk: Dict[str, Any]) -> str:
        """
        序列化chunk为JSON字符串
        
        Args:
            chunk: chunk数据字典
            
        Returns:
            JSON字符串
        """
        return json.dumps(chunk, ensure_ascii=False)
    
    def deserialize_chunk(self, chunk_str: str) -> Dict[str, Any]:
        """
        反序列化JSON字符串为chunk
        
        Args:
            chunk_str: JSON字符串
            
        Returns:
            chunk数据字典
        """
        return json.loads(chunk_str)
    
    def validate_chunk(self, chunk: Dict[str, Any]) -> bool:
        """
        验证chunk格式是否正确
        
        Args:
            chunk: chunk数据字典
            
        Returns:
            是否有效
        """
        required_fields = ['id', 'text', 'metadata', 'type']
        for field in required_fields:
            if field not in chunk:
                logger.warning(f"Chunk缺少必需字段: {field}")
                return False
        
        if not isinstance(chunk['id'], str) or not chunk['id'].strip():
            logger.warning("Chunk ID无效")
            return False
        
        if not isinstance(chunk['text'], str) or not chunk['text'].strip():
            logger.warning("Chunk文本无效")
            return False
        
        if not isinstance(chunk['metadata'], dict):
            logger.warning("Chunk元数据必须是字典类型")
            return False
        
        if chunk['type'] != 'qa_pair':
            logger.warning("Chunk类型必须是qa_pair")
            return False
        
        return True