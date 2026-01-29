"""
模型管理器
管理 Ollama 模型的生命周期：创建、列出、删除、设置默认模型等
"""
import subprocess
import json
from typing import List, Dict, Any, Optional
from pathlib import Path

from utils.logger import logger
from config.config_loader import config


class ModelManager:
    """Ollama 模型管理器"""
    
    def __init__(self):
        """初始化管理器"""
        self.ollama_config = config.get_ollama_config()
        self.paths = config.get_paths()
        self.model_prefix = self.ollama_config.get('default_model_name_prefix', 'afs_elder_')
    
    def list_models(self, filter_afs_only: bool = True) -> List[Dict[str, Any]]:
        """
        列出所有模型
        
        :param filter_afs_only: 是否只列出 AFS 专属模型
        :return: 模型列表
        """
        try:
            result = subprocess.run(
                ['ollama', 'list'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"列出模型失败: {result.stderr}")
                return []
            
            # 解析输出
            models = []
            lines = result.stdout.strip().split('\n')[1:]  # 跳过表头
            
            for line in lines:
                parts = line.split()
                if len(parts) >= 2:
                    model_name = parts[0]
                    
                    # 如果需要过滤，只返回 AFS 模型
                    if filter_afs_only and not model_name.startswith(self.model_prefix):
                        continue
                    
                    models.append({
                        'name': model_name,
                        'id': model_name.replace(self.model_prefix, ''),
                        'size': parts[1] if len(parts) > 1 else 'unknown',
                        'modified': ' '.join(parts[2:]) if len(parts) > 2 else 'unknown'
                    })
            
            logger.info(f"找到 {len(models)} 个模型")
            return models
        
        except Exception as e:
            logger.exception(f"列出模型时发生错误: {e}")
            return []
    
    def get_elder_model(self, elder_id: str) -> Optional[Dict[str, Any]]:
        """
        获取指定老人的模型信息
        
        :param elder_id: 老人 ID
        :return: 模型信息字典
        """
        model_name = f"{self.model_prefix}{elder_id}"
        models = self.list_models(filter_afs_only=False)
        
        for model in models:
            if model['name'] == model_name:
                return model
        
        return None
    
    def model_exists(self, elder_id: str) -> bool:
        """
        检查指定老人的模型是否存在
        
        :param elder_id: 老人 ID
        :return: 是否存在
        """
        return self.get_elder_model(elder_id) is not None
    
    def delete_model(self, elder_id: str) -> bool:
        """
        删除指定老人的模型
        
        :param elder_id: 老人 ID
        :return: 是否成功
        """
        model_name = f"{self.model_prefix}{elder_id}"
        
        try:
            logger.info(f"删除模型: {model_name}")
            
            result = subprocess.run(
                ['ollama', 'rm', model_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"删除模型失败: {result.stderr}")
                return False
            
            logger.info(f"模型已删除: {model_name}")
            return True
        
        except Exception as e:
            logger.exception(f"删除模型时发生错误: {e}")
            return False
    
    def show_model_info(self, elder_id: str) -> Optional[Dict[str, Any]]:
        """
        显示模型详细信息
        
        :param elder_id: 老人 ID
        :return: 模型详细信息
        """
        model_name = f"{self.model_prefix}{elder_id}"
        
        try:
            result = subprocess.run(
                ['ollama', 'show', model_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"获取模型信息失败: {result.stderr}")
                return None
            
            # 解析输出
            info = {
                'name': model_name,
                'elder_id': elder_id,
                'details': result.stdout
            }
            
            return info
        
        except Exception as e:
            logger.exception(f"获取模型信息时发生错误: {e}")
            return None
    
    def pull_base_model(self, model_name: str) -> bool:
        """
        从 Ollama 仓库拉取基础模型
        
        :param model_name: 模型名称
        :return: 是否成功
        """
        try:
            logger.info(f"拉取基础模型: {model_name}")
            
            result = subprocess.run(
                ['ollama', 'pull', model_name],
                capture_output=True,
                text=True,
                timeout=1800  # 30分钟超时（模型可能很大）
            )
            
            if result.returncode != 0:
                logger.error(f"拉取模型失败: {result.stderr}")
                return False
            
            logger.info(f"模型已拉取: {model_name}")
            return True
        
        except subprocess.TimeoutExpired:
            logger.error("拉取模型超时")
            return False
        
        except Exception as e:
            logger.exception(f"拉取模型时发生错误: {e}")
            return False
    
    def copy_model(self, source_elder_id: str, target_elder_id: str) -> bool:
        """
        复制一个老人的模型到另一个老人
        
        :param source_elder_id: 源老人 ID
        :param target_elder_id: 目标老人 ID
        :return: 是否成功
        """
        source_model = f"{self.model_prefix}{source_elder_id}"
        target_model = f"{self.model_prefix}{target_elder_id}"
        
        try:
            logger.info(f"复制模型: {source_model} -> {target_model}")
            
            result = subprocess.run(
                ['ollama', 'cp', source_model, target_model],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                logger.error(f"复制模型失败: {result.stderr}")
                return False
            
            logger.info(f"模型已复制: {target_model}")
            return True
        
        except Exception as e:
            logger.exception(f"复制模型时发生错误: {e}")
            return False
    
    def cleanup_old_adapters(self, keep_latest: int = 5) -> int:
        """
        清理旧的 Adapter 文件
        
        :param keep_latest: 保留最新的 N 个 Adapter
        :return: 清理的文件数量
        """
        adapter_dir = Path(self.paths.get('adapters_output', '/app/models/adapters'))
        
        if not adapter_dir.exists():
            logger.info("Adapter 目录不存在，无需清理")
            return 0
        
        try:
            # 获取所有 .gguf 文件并按修改时间排序
            adapters = list(adapter_dir.glob('*.gguf'))
            adapters.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # 删除旧文件
            deleted_count = 0
            for adapter in adapters[keep_latest:]:
                logger.info(f"删除旧 Adapter: {adapter}")
                adapter.unlink()
                deleted_count += 1
            
            logger.info(f"清理完成，删除了 {deleted_count} 个旧 Adapter")
            return deleted_count
        
        except Exception as e:
            logger.exception(f"清理 Adapter 时发生错误: {e}")
            return 0
    
    def get_model_size(self, elder_id: str) -> Optional[str]:
        """
        获取模型文件大小
        
        :param elder_id: 老人 ID
        :return: 文件大小（字符串格式）
        """
        model_info = self.get_elder_model(elder_id)
        if model_info:
            return model_info.get('size', 'unknown')
        return None
    
    def export_model(self, elder_id: str, export_path: str) -> bool:
        """
        导出模型到指定路径
        
        :param elder_id: 老人 ID
        :param export_path: 导出路径
        :return: 是否成功
        """
        # 注意：Ollama 可能不直接支持导出，这里提供框架
        logger.warning("模型导出功能需要根据 Ollama 版本实现")
        return False


if __name__ == '__main__':
    # 测试模型管理器
    manager = ModelManager()
    
    # 列出所有 AFS 模型
    models = manager.list_models(filter_afs_only=True)
    print(f"=== AFS 模型列表 ({len(models)} 个) ===")
    for model in models:
        print(f"- {model['name']} ({model['size']})")
    
    # 检查特定模型是否存在
    test_elder_id = "LXM19580312M"
    if manager.model_exists(test_elder_id):
        print(f"\n✓ 模型 {test_elder_id} 存在")
    else:
        print(f"\n✗ 模型 {test_elder_id} 不存在")
