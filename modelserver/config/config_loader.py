"""
配置加载器 - 统一管理所有配置参数
支持动态加载、路径替换、多环境配置
"""
import os
import yaml
from typing import Dict, Any
from pathlib import Path


class ConfigLoader:
    """配置加载器单例类"""
    _instance = None
    _config: Dict[str, Any] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigLoader, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._config is None:
            self.reload()
    
    def reload(self):
        """重新加载配置文件"""
        config_path = Path(__file__).parent / "training_config.yaml"
        with open(config_path, 'r', encoding='utf-8') as f:
            self._config = yaml.safe_load(f)
        
        # 处理路径模板变量替换
        self._process_path_templates()
    
    def _process_path_templates(self):
        """处理配置中的路径模板变量（如 {{model_dir}}）"""
        model_dir = self._config.get('model_dir', '/app/models/base')
        
        # 替换 base_models 中的路径模板
        if 'base_models' in self._config:
            for model_key, model_config in self._config['base_models'].items():
                if 'hf_path' in model_config:
                    model_config['hf_path'] = model_config['hf_path'].replace('{{model_dir}}', model_dir)
                if 'gguf_path' in model_config:
                    model_config['gguf_path'] = model_config['gguf_path'].replace('{{model_dir}}', model_dir)
    
    def get(self, key: str, default=None):
        """获取配置项（支持点号分隔的嵌套键）"""
        keys = key.split('.')
        value = self._config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        
        return value
    
    def get_training_config(self) -> Dict[str, Any]:
        """获取训练配置"""
        return self._config.get('training', {})
    
    def get_ollama_config(self) -> Dict[str, Any]:
        """获取 Ollama 配置"""
        return self._config.get('ollama', {})
    
    def get_paths(self) -> Dict[str, str]:
        """获取所有路径配置"""
        return self._config.get('paths', {})
    
    def get_current_model(self) -> Dict[str, Any]:
        """获取当前选中的基础模型配置"""
        current_model_key = self._config.get('current_model', 'qwen2.5-14b-instruct')
        base_models = self._config.get('base_models', {})
        
        if current_model_key not in base_models:
            # 如果当前模型不存在，使用第一个可用模型
            current_model_key = list(base_models.keys())[0] if base_models else None
        
        model_config = base_models.get(current_model_key, {})
        model_config['key'] = current_model_key
        return model_config
    
    def get_prompt_template(self) -> str:
        """获取 system prompt 模板"""
        return self._config.get('prompt_template', '')
    
    def get_lora_config(self) -> Dict[str, Any]:
        """获取 LoRA 配置"""
        return self._config.get('training', {}).get('lora', {})
    
    def is_debug_mode(self) -> bool:
        """是否开启调试模式"""
        return self._config.get('debug', False)
    
    def get_max_training_minutes(self) -> int:
        """获取最大训练时长限制（分钟）"""
        return self._config.get('max_training_minutes', 60)
    
    @property
    def config(self) -> Dict[str, Any]:
        """获取完整配置字典"""
        return self._config


# 全局配置实例
config = ConfigLoader()


if __name__ == '__main__':
    # 测试配置加载
    print("=== 配置加载测试 ===")
    print(f"当前模型: {config.get_current_model()}")
    print(f"训练配置: {config.get_training_config()}")
    print(f"路径配置: {config.get_paths()}")
    print(f"Ollama 配置: {config.get_ollama_config()}")
    print(f"调试模式: {config.is_debug_mode()}")
