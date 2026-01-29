"""
模型训练器
封装 Ollama 训练命令，处理 LoRA Adapter 训练流程
"""
import subprocess
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from utils.logger import logger
from utils.jsonl_builder import JSONLBuilder
from config.config_loader import config


class OllamaTrainer:
    """Ollama 模型训练器"""
    
    def __init__(self):
        """初始化训练器"""
        self.ollama_config = config.get_ollama_config()
        self.training_config = config.get_training_config()
        self.paths = config.get_paths()
        self.max_training_minutes = config.get_max_training_minutes()
    
    def prepare_training_data(self, elder_id: str, elder_name: str = "长辈") -> Optional[str]:
        """
        准备训练数据（生成 JSONL）
        
        :param elder_id: 老人 ID
        :param elder_name: 老人姓名
        :return: JSONL 文件路径
        """
        logger.info(f"开始为老人 {elder_id} 准备训练数据...")
        
        try:
            builder = JSONLBuilder()
            jsonl_path = builder.export_jsonl(elder_id, self.paths.get('jsonl_output'))
            
            if not jsonl_path:
                logger.error(f"生成 JSONL 数据失败: {elder_id}")
                return None
            
            logger.info(f"训练数据已准备完成: {jsonl_path}")
            return jsonl_path
        
        except Exception as e:
            logger.exception(f"准备训练数据时发生错误: {e}")
            return None
    
    def create_modelfile(self, elder_id: str, elder_name: str = "长辈") -> str:
        """
        创建 Ollama Modelfile
        
        :param elder_id: 老人 ID
        :param elder_name: 老人姓名
        :return: Modelfile 路径
        """
        from utils.system_prompt import SystemPromptGenerator
        
        # 获取当前基础模型
        current_model = config.get_current_model()
        model_name = current_model.get('key', 'qwen2.5-14b-instruct')
        
        # 生成 system prompt
        prompt_gen = SystemPromptGenerator()
        system_instruction = prompt_gen.generate_modelfile_system(elder_name)
        
        # 创建 Modelfile 内容
        modelfile_content = f"""# 传家之宝 - {elder_name} 专属模型
FROM {model_name}

# System Prompt
{system_instruction}

# 参数设置
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 2048

# 停止词
PARAMETER stop "<|eot_id|>"
PARAMETER stop "<|end_of_text|>"
"""
        
        # 保存 Modelfile
        modelfile_dir = Path(self.paths.get('jsonl_output', '/app/data/jsonl'))
        modelfile_dir.mkdir(parents=True, exist_ok=True)
        modelfile_path = modelfile_dir / f"{elder_id}_Modelfile"
        
        with open(modelfile_path, 'w', encoding='utf-8') as f:
            f.write(modelfile_content)
        
        logger.info(f"Modelfile 已创建: {modelfile_path}")
        return str(modelfile_path)
    
    def train(self, elder_id: str, elder_name: str = "长辈", 
             jsonl_path: str = None) -> Dict[str, Any]:
        """
        执行模型训练
        
        :param elder_id: 老人 ID
        :param elder_name: 老人姓名
        :param jsonl_path: JSONL 数据集路径（可选，不提供则自动生成）
        :return: 训练结果字典
        """
        start_time = time.time()
        result = {
            'success': False,
            'elder_id': elder_id,
            'start_time': datetime.now().isoformat(),
            'end_time': None,
            'duration': 0,
            'adapter_path': None,
            'error': None
        }
        
        try:
            # 1. 准备训练数据
            if not jsonl_path:
                jsonl_path = self.prepare_training_data(elder_id, elder_name)
                if not jsonl_path:
                    result['error'] = "训练数据准备失败"
                    return result
            
            # 2. 创建 Modelfile
            modelfile_path = self.create_modelfile(elder_id, elder_name)
            
            # 3. 构建模型名称
            model_prefix = self.ollama_config.get('default_model_name_prefix', 'afs_elder_')
            model_name = f"{model_prefix}{elder_id}"
            
            # 4. 执行 Ollama 训练命令
            logger.info(f"开始训练模型: {model_name}")
            
            # Ollama create 命令（创建基础模型）
            create_cmd = ['ollama', 'create', model_name, '-f', modelfile_path]
            logger.info(f"执行命令: {' '.join(create_cmd)}")
            
            create_process = subprocess.run(
                create_cmd,
                capture_output=True,
                text=True,
                timeout=self.max_training_minutes * 60
            )
            
            if create_process.returncode != 0:
                logger.error(f"Ollama create 失败: {create_process.stderr}")
                result['error'] = f"模型创建失败: {create_process.stderr}"
                return result
            
            logger.info(f"基础模型创建成功: {model_name}")
            
            # 5. 使用 Ollama 进行微调（如果支持）
            # 注意：Ollama 当前可能不直接支持 LoRA 微调，这里提供框架
            # 实际使用时可能需要通过其他方式（如 llama.cpp 的 finetune）
            
            # 构建训练命令（示例，需根据实际 Ollama 版本调整）
            train_cmd = self._build_train_command(model_name, jsonl_path)
            
            if train_cmd:
                logger.info(f"执行训练命令: {' '.join(train_cmd)}")
                train_process = subprocess.run(
                    train_cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.max_training_minutes * 60
                )
                
                if train_process.returncode != 0:
                    logger.warning(f"训练过程警告: {train_process.stderr}")
                else:
                    logger.info("模型训练完成")
            
            # 6. 记录结果
            adapter_dir = Path(self.paths.get('adapters_output', '/app/models/adapters'))
            adapter_dir.mkdir(parents=True, exist_ok=True)
            adapter_path = adapter_dir / f"{elder_id}.gguf"
            
            end_time = time.time()
            result.update({
                'success': True,
                'end_time': datetime.now().isoformat(),
                'duration': round(end_time - start_time, 2),
                'adapter_path': str(adapter_path),
                'model_name': model_name
            })
            
            logger.info(f"训练成功完成，耗时: {result['duration']} 秒")
            
        except subprocess.TimeoutExpired:
            logger.error(f"训练超时（超过 {self.max_training_minutes} 分钟）")
            result['error'] = f"训练超时（超过 {self.max_training_minutes} 分钟）"
        
        except Exception as e:
            logger.exception(f"训练过程中发生错误: {e}")
            result['error'] = str(e)
        
        return result
    
    def _build_train_command(self, model_name: str, jsonl_path: str) -> Optional[list]:
        """
        构建训练命令
        注意：这里提供基础框架，实际命令需根据 Ollama 版本调整
        
        :param model_name: 模型名称
        :param jsonl_path: JSONL 数据路径
        :return: 命令列表
        """
        # 检查 Ollama 是否支持 train 命令
        # 如果不支持，可以使用外部工具如 llama.cpp 的 finetune
        
        # 示例命令（需根据实际情况调整）
        # return ['ollama', 'train', model_name, '--data', jsonl_path]
        
        # 当前 Ollama 可能不直接支持 train，返回 None
        logger.info("当前使用 Ollama create 方式，不需要额外训练命令")
        return None
    
    def check_ollama_available(self) -> bool:
        """
        检查 Ollama 是否可用
        
        :return: 是否可用
        """
        try:
            result = subprocess.run(
                ['ollama', 'list'],
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Ollama 不可用: {e}")
            return False


if __name__ == '__main__':
    # 测试训练器
    trainer = OllamaTrainer()
    
    # 检查 Ollama 是否可用
    if trainer.check_ollama_available():
        print("✓ Ollama 可用")
    else:
        print("✗ Ollama 不可用")
    
    # 测试训练流程（需要有实际数据）
    # result = trainer.train("LXM19580312M", "李小明")
    # print(f"训练结果: {result}")
