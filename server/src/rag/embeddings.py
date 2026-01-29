# 嵌入模型管理
import os
import logging
import numpy as np
from typing import List, Union
from transformers import AutoTokenizer, AutoModel
import torch

logger = logging.getLogger(__name__)

class EmbeddingManager:
    """
    嵌入模型管理
    - 管理嵌入模型的加载和卸载
    - 提供文本向量化接口
    - 实现批量向量化优化
    """
    
    def __init__(self, model_name: str = "intfloat/multilingual-e5-large"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.cache = {}  # 简单的嵌入缓存
        self.load_model()
    
    def load_model(self):
        """加载嵌入模型"""
        try:
            logger.info(f"正在加载嵌入模型: {self.model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModel.from_pretrained(self.model_name)
            self.model.to(self.device)
            self.model.eval()  # 设置为评估模式
            logger.info(f"嵌入模型加载成功: {self.model_name}")
        except Exception as e:
            logger.error(f"加载嵌入模型失败: {str(e)}")
            # 尝试备用模型
            try:
                self.model_name = "BAAI/bge-large-zh-v1.5"  # 中文优化模型
                logger.info(f"尝试加载备用模型: {self.model_name}")
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
                self.model = AutoModel.from_pretrained(self.model_name)
                self.model.to(self.device)
                self.model.eval()
                logger.info(f"备用嵌入模型加载成功: {self.model_name}")
            except Exception as e2:
                logger.error(f"备用模型加载也失败: {str(e2)}")
                raise
    
    def embed_text(self, text: str, normalize: bool = True) -> List[float]:
        """
        将单个文本转换为嵌入向量
        
        Args:
            text: 输入文本
            normalize: 是否标准化向量
            
        Returns:
            嵌入向量
        """
        # 检查缓存
        cache_key = f"{text}_{normalize}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            # 对于multilingual-e5-large模型，需要添加特殊前缀
            if "e5" in self.model_name.lower():
                text = f"query: {text}"
            
            inputs = self.tokenizer(
                text,
                padding=True,
                truncation=True,
                return_tensors="pt",
                max_length=512
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                # 使用最后一层的池化输出
                embeddings = outputs.last_hidden_state[:, 0, :]  # CLS token
                
                if normalize:
                    embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
                
                embedding = embeddings.cpu().numpy()[0].tolist()
            
            # 存入缓存
            self.cache[cache_key] = embedding
            return embedding
        except Exception as e:
            logger.error(f"文本嵌入失败: {str(e)}")
            # 返回零向量作为默认值
            return [0.0] * 1024  # 假设模型输出1024维向量
    
    def embed_texts(self, texts: List[str], normalize: bool = True) -> List[List[float]]:
        """
        批量将多个文本转换为嵌入向量
        
        Args:
            texts: 输入文本列表
            normalize: 是否标准化向量
            
        Returns:
            嵌入向量列表
        """
        embeddings = []
        for text in texts:
            embedding = self.embed_text(text, normalize)
            embeddings.append(embedding)
        return embeddings
    
    def embed_documents(self, documents: List[str], normalize: bool = True) -> List[List[float]]:
        """
        将文档列表转换为嵌入向量（与embed_texts功能类似，但语义更清晰）
        
        Args:
            documents: 文档列表
            normalize: 是否标准化向量
            
        Returns:
            嵌入向量列表
        """
        return self.embed_texts(documents, normalize)
    
    def similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        计算两个向量之间的余弦相似度
        
        Args:
            vec1: 第一个向量
            vec2: 第二个向量
            
        Returns:
            相似度分数 (0-1之间)
        """
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        # 计算余弦相似度
        cosine_similarity = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
        
        # 确保相似度在[0,1]范围内（由于浮点精度可能导致略大于1或小于-1）
        return float(max(0, min(1, (cosine_similarity + 1) / 2)))
    
    def unload_model(self):
        """卸载模型释放内存"""
        self.model = None
        self.tokenizer = None
        self.cache.clear()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
    
    def get_embedding_dimension(self) -> int:
        """
        获取嵌入向量的维度
        
        Returns:
            向量维度
        """
        try:
            # 通过测试输入获取模型输出维度
            test_embedding = self.embed_text("test")
            return len(test_embedding)
        except:
            # 默认返回常见维度
            return 1024