# 向量存储管理
import os
import chromadb
import logging
from typing import List, Dict, Optional
from chromadb.config import Settings

logger = logging.getLogger(__name__)

class VectorStore:
    """
    向量存储管理
    - 管理ChromaDB集合（每个用户一个集合）
    - 提供添加、更新、删除向量的方法
    - 实现批量操作优化
    """
    
    def __init__(self, persist_directory: str = "./vector_db"):
        # 初始化ChromaDB客户端
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collections = {}
        
    def get_collection(self, collection_name: str):
        """获取或创建集合"""
        if collection_name not in self.collections:
            try:
                # 尝试获取已存在的集合
                self.collections[collection_name] = self.client.get_collection(collection_name)
            except:
                # 如果集合不存在，则创建新集合
                self.collections[collection_name] = self.client.create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"}  # 使用余弦距离
                )
        return self.collections[collection_name]
    
    def add_vectors(self, 
                   collection_name: str, 
                   documents: List[str], 
                   metadatas: List[Dict], 
                   ids: List[str]) -> bool:
        """
        添加向量到指定集合
        
        Args:
            collection_name: 集合名称
            documents: 文档列表
            metadatas: 元数据列表
            ids: ID列表
            
        Returns:
            是否成功添加
        """
        try:
            collection = self.get_collection(collection_name)
            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            return True
        except Exception as e:
            logger.error(f"添加向量到集合 {collection_name} 出错: {str(e)}")
            return False
    
    def search(self, 
              collection_name: str, 
              query_embedding: List[float], 
              top_k: int = 5) -> List[Dict]:
        """
        在指定集合中搜索相似向量
        
        Args:
            collection_name: 集合名称
            query_embedding: 查询向量
            top_k: 返回前k个结果
            
        Returns:
            搜索结果列表
        """
        try:
            collection = self.get_collection(collection_name)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            # 格式化结果
            formatted_results = []
            for i in range(len(results['documents'][0])):
                result = {
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'id': results['ids'][0][i],
                    'distance': results['distances'][0][i] if results['distances'] else None
                }
                # 计算相似度（如果距离存在）
                if result['distance'] is not None:
                    # 将距离转换为相似度（余弦距离转换为相似度）
                    similarity = 1 - result['distance']
                    result['similarity'] = max(0, min(1, similarity))  # 限制在[0,1]范围内
                formatted_results.append(result)
                
            return formatted_results
        except Exception as e:
            logger.error(f"搜索集合 {collection_name} 出错: {str(e)}")
            return []
    
    def update_vectors(self, 
                      collection_name: str, 
                      documents: List[str], 
                      metadatas: List[Dict], 
                      ids: List[str]) -> bool:
        """
        更新向量（实际上是删除旧向量并添加新向量）
        
        Args:
            collection_name: 集合名称
            documents: 文档列表
            metadatas: 元数据列表
            ids: ID列表
            
        Returns:
            是否成功更新
        """
        try:
            collection = self.get_collection(collection_name)
            collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            return True
        except Exception as e:
            logger.error(f"更新集合 {collection_name} 的向量出错: {str(e)}")
            return False
    
    def delete_vectors(self, collection_name: str, ids: List[str]) -> bool:
        """
        删除指定ID的向量
        
        Args:
            collection_name: 集合名称
            ids: 要删除的向量ID列表
            
        Returns:
            是否成功删除
        """
        try:
            collection = self.get_collection(collection_name)
            collection.delete(ids=ids)
            return True
        except Exception as e:
            logger.error(f"删除集合 {collection_name} 的向量出错: {str(e)}")
            return False
    
    def get_collection_count(self, collection_name: str) -> int:
        """获取集合中的向量数量"""
        try:
            collection = self.get_collection(collection_name)
            return collection.count()
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 数量出错: {str(e)}")
            return 0
    
    def delete_collection(self, collection_name: str) -> bool:
        """删除整个集合"""
        try:
            self.client.delete_collection(name=collection_name)
            if collection_name in self.collections:
                del self.collections[collection_name]
            return True
        except Exception as e:
            logger.error(f"删除集合 {collection_name} 出错: {str(e)}")
            return False