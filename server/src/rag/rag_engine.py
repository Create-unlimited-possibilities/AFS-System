# RAG核心引擎 (Python版本 - 供模型服务器使用)
import os
import logging
from typing import List, Dict, Optional
from .vector_store import VectorStore
from .embeddings import EmbeddingManager
from .indexer import IndexManager

logger = logging.getLogger(__name__)

class RAGEngine:
    """
    RAG核心引擎
    - 初始化向量数据库连接
    - 提供问答对搜索接口
    - 管理用户级索引
    """
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.embedding_manager = EmbeddingManager()
        self.index_manager = IndexManager(self.vector_store, self.embedding_manager)
        self.cache = {}
        
    def search(self, 
               query_text: str, 
               unique_code: str, 
               top_k: int = 5, 
               similarity_threshold: float = 0.5) -> List[Dict]:
        """
        搜索与查询最相关的问答对
        
        Args:
            query_text: 查询文本
            unique_code: 用户唯一编码
            top_k: 返回前k个结果
            similarity_threshold: 相似度阈值
            
        Returns:
            匹配的问答对列表
        """
        try:
            # 检查缓存
            cache_key = f"{unique_code}:{query_text}"
            if cache_key in self.cache:
                return self.cache[cache_key]
            
            # 向量化查询文本
            query_embedding = self.embedding_manager.embed_text(query_text)
            
            # 在指定用户的向量索引中搜索
            results = self.vector_store.search(
                collection_name=unique_code,
                query_embedding=query_embedding,
                top_k=top_k
            )
            
            # 过滤低于相似度阈值的结果
            filtered_results = [
                result for result in results 
                if result.get('similarity', 0) >= similarity_threshold
            ]
            
            # 缓存结果
            self.cache[cache_key] = filtered_results
            
            return filtered_results
        except Exception as e:
            logger.error(f"RAG搜索出错: {str(e)}")
            return []
    
    def update_user_index(self, unique_code: str) -> bool:
        """
        更新特定用户的索引
        
        Args:
            unique_code: 用户唯一编码
            
        Returns:
            是否成功更新
        """
        try:
            success = self.index_manager.update_user_index(unique_code)
            # 清除相关缓存
            self._clear_cache_for_user(unique_code)
            return success
        except Exception as e:
            logger.error(f"更新用户索引出错: {str(e)}")
            return False
    
    def _clear_cache_for_user(self, unique_code: str):
        """清除指定用户的缓存"""
        keys_to_remove = [key for key in self.cache.keys() if key.startswith(unique_code)]
        for key in keys_to_remove:
            del self.cache[key]
    
    def batch_update_indices(self, unique_codes: List[str]) -> Dict[str, bool]:
        """批量更新多个用户的索引"""
        results = {}
        for code in unique_codes:
            results[code] = self.update_user_index(code)
        return results
