# 索引管理器
import os
import json
import logging
from typing import List, Dict, Any
from .vector_store import VectorStore
from .embeddings import EmbeddingManager
from .chunker import Chunker

logger = logging.getLogger(__name__)

class IndexManager:
    """
    索引管理器
    - 从JSONL文件构建用户向量索引
    - 管理索引的增量更新
    - 提供索引重建接口
    """
    
    def __init__(self, vector_store: VectorStore, embedding_manager: EmbeddingManager):
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager
        self.chunker = Chunker()
        self.training_data_dir = "./training-data"  # 默认训练数据目录
    
    def update_user_index(self, unique_code: str) -> bool:
        """
        更新特定用户的索引
        
        Args:
            unique_code: 用户唯一编码
            
        Returns:
            是否成功更新
        """
        try:
            jsonl_path = os.path.join(self.training_data_dir, f"{unique_code}.jsonl")
            
            if not os.path.exists(jsonl_path):
                logger.warning(f"JSONL文件不存在: {jsonl_path}")
                # 创建一个空的集合，以便后续可以添加数据
                self.vector_store.get_collection(unique_code)
                return True
            
            # 读取JSONL文件并解析数据
            chunks = self._load_jsonl_file(jsonl_path)
            
            if not chunks:
                logger.info(f"JSONL文件为空: {jsonl_path}")
                return True
            
            # 批量处理chunks并添加到向量数据库
            success = self._process_and_add_chunks(chunks, unique_code)
            
            if success:
                logger.info(f"用户 {unique_code} 的索引更新成功，共处理 {len(chunks)} 个chunks")
            else:
                logger.error(f"用户 {unique_code} 的索引更新失败")
            
            return success
        except Exception as e:
            logger.error(f"更新用户索引出错 ({unique_code}): {str(e)}")
            return False
    
    def _load_jsonl_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        从JSONL文件加载数据
        
        Args:
            file_path: JSONL文件路径
            
        Returns:
            解析后的数据列表
        """
        chunks = []
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                for line_num, line in enumerate(file, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = self.chunker.create_chunk_from_answer(data)
                        if self.chunker.validate_chunk(chunk):
                            chunks.append(chunk)
                        else:
                            logger.warning(f"跳过无效chunk (行 {line_num})")
                    except json.JSONDecodeError as e:
                        logger.warning(f"JSON解析错误 (行 {line_num}): {str(e)}")
        except FileNotFoundError:
            logger.warning(f"文件未找到: {file_path}")
        except Exception as e:
            logger.error(f"读取文件出错 {file_path}: {str(e)}")
        
        return chunks
    
    def _process_and_add_chunks(self, chunks: List[Dict[str, Any]], collection_name: str) -> bool:
        """
        处理并添加chunks到向量数据库
        
        Args:
            chunks: chunks列表
            collection_name: 集合名称
            
        Returns:
            是否成功处理
        """
        try:
            # 提取文档、元数据和ID
            documents = []
            metadatas = []
            ids = []
            
            for chunk in chunks:
                documents.append(chunk['text'])
                metadatas.append(chunk['metadata'])
                ids.append(chunk['id'])
            
            # 批量添加到向量数据库
            success = self.vector_store.add_vectors(
                collection_name=collection_name,
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            return success
        except Exception as e:
            logger.error(f"处理chunks并添加到集合 {collection_name} 出错: {str(e)}")
            return False
    
    def rebuild_all_indices(self, unique_codes: List[str]) -> Dict[str, bool]:
        """
        重建所有用户的索引
        
        Args:
            unique_codes: 用户唯一编码列表
            
        Returns:
            每个用户索引重建结果的字典
        """
        results = {}
        for code in unique_codes:
            results[code] = self.update_user_index(code)
        return results
    
    def update_single_chunk(self, unique_code: str, chunk_data: Dict[str, Any]) -> bool:
        """
        更新单个chunk（增量更新）
        
        Args:
            unique_code: 用户唯一编码
            chunk_data: chunk数据
            
        Returns:
            是否成功更新
        """
        try:
            # 验证chunk格式
            if not self.chunker.validate_chunk(chunk_data):
                logger.error("传入的chunk数据格式无效")
                return False
            
            # 向量化文档
            document = chunk_data['text']
            metadata = chunk_data['metadata']
            chunk_id = chunk_data['id']
            
            # 更新向量数据库中的单个向量
            success = self.vector_store.update_vectors(
                collection_name=unique_code,
                documents=[document],
                metadatas=[metadata],
                ids=[chunk_id]
            )
            
            return success
        except Exception as e:
            logger.error(f"更新单个chunk出错: {str(e)}")
            return False
    
    def delete_chunk(self, unique_code: str, chunk_id: str) -> bool:
        """
        删除指定的chunk
        
        Args:
            unique_code: 用户唯一编码
            chunk_id: chunk的ID
            
        Returns:
            是否成功删除
        """
        try:
            success = self.vector_store.delete_vectors(
                collection_name=unique_code,
                ids=[chunk_id]
            )
            return success
        except Exception as e:
            logger.error(f"删除chunk出错: {str(e)}")
            return False
    
    def get_index_stats(self, unique_code: str) -> Dict[str, Any]:
        """
        获取索引统计信息
        
        Args:
            unique_code: 用户唯一编码
            
        Returns:
            统计信息字典
        """
        try:
            count = self.vector_store.get_collection_count(unique_code)
            return {
                'collection_name': unique_code,
                'vector_count': count,
                'status': 'ready' if count >= 0 else 'error'
            }
        except Exception as e:
            logger.error(f"获取索引统计信息出错: {str(e)}")
            return {
                'collection_name': unique_code,
                'vector_count': 0,
                'status': 'error',
                'error': str(e)
            }
    
    def set_training_data_dir(self, dir_path: str):
        """
        设置训练数据目录
        
        Args:
            dir_path: 目录路径
        """
        self.training_data_dir = dir_path