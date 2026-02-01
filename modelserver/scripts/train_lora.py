#!/usr/bin/env python3
"""
训练 LoRA 模型 - 用于 Chat-Beta Mode 2

使用方法：
python train_lora.py \
    --task_id task_123 \
    --dataset /path/to/sft_data.json \
    --output /output/path \
    --base_model Qwen/Qwen2.5-7B-Instruct \
    --epochs 3
"""

import argparse
import json
import os
import yaml
import torch
from pathlib import Path
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_config(config_path):
    """加载配置文件"""
    default_config = {
        'lora': {
            'rank': 8,
            'alpha': 16,
            'dropout': 0.05,
            'target_modules': [
                'q_proj', 'v_proj', 'k_proj', 'o_proj',
                'gate_proj', 'up_proj', 'down_proj', 'lm_head'
            ]
        },
        'training': {
            'num_epochs': 3,
            'batch_size': 4,
            'learning_rate': 2e-4,
            'weight_decay': 0.01,
            'warmup_steps': 100,
            'max_grad_norm': 1.0
        }
    }
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    return {**default_config, **config}


def main():
    parser = argparse.ArgumentParser(description='训练 Chat-Beta LoRA 模型')
    parser.add_argument('--task_id', required=True, help='任务 ID')
    parser.add_argument('--dataset', required=True, help='SFT 数据集路径')
    parser.add_argument('--output', required=True, help='输出模型路径')
    parser.add_argument('--base_model', default='Qwen/Qwen2.5-7B-Instruct', help='基础模型')
    parser.add_argument('--config', default='configs/lora_config.yaml', help='配置文件路径')
    parser.add_argument('--epochs', type=int, default=3, help='训练轮数')
    parser.add_argument('--batch_size', type=int, default=4, help='批次大小')
    parser.add_argument('--learning_rate', type=float, default=2e-4, help='学习率')
    
    args = parser.parse_args()
    
    logger.info(f"任务 {args.task_id} 开始训练")
    logger.info(f"数据集: {args.dataset}")
    logger.info(f"输出路径: {args.output}")
    
    # 加载配置
    if os.path.exists(args.config):
        config = load_config(args.config)
    else:
        logger.warning(f"配置文件不存在: {args.config}, 使用默认配置")
        config = {}
    
    # 加载数据集
    logger.info("加载数据集...")
    dataset = load_dataset('json', data_files=args.dataset, split='train')
    
    # 加载 tokenizer
    logger.info(f"加载 tokenizer: {args.base_model}")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    
    # 数据预处理
    def preprocess_function(examples):
        return tokenizer(
            examples['messages'],
            truncation=True,
            padding='max_length',
            max_length=512
        )
    
    tokenized_dataset = dataset.map(preprocess_function, batched=True, remove_columns=['messages'])
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    
    # 加载模型
    logger.info(f"加载基础模型: {args.base_model}")
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch.bfloat16,
        device_map='auto',
        trust_remote_code=True
    )
    
    # LoRA 配置
    lora_config = LoraConfig(
        r=config.get('lora', {}).get('rank', 8),
        lora_alpha=config.get('lora', {}).get('alpha', 16),
        lora_dropout=config.get('lora', {}).get('dropout', 0.05),
        target_modules=config.get('lora', {}).get('target_modules', [
            'q_proj', 'v_proj', 'k_proj', 'o_proj'
        ]),
        bias='none',
        task_type='CAUSAL_LM'
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs or config.get('training', {}).get('num_epochs', 3),
        per_device_train_batch_size=args.batch_size or config.get('training', {}).get('batch_size', 4),
        gradient_accumulation_steps=config.get('training', {}).get('gradient_accumulation_steps', 1),
        learning_rate=args.learning_rate or config.get('training', {}).get('learning_rate', 2e-4),
        weight_decay=config.get('training', {}).get('weight_decay', 0.01),
        warmup_steps=config.get('training', {}).get('warmup_steps', 100),
        max_grad_norm=config.get('training', {}).get('max_grad_norm', 1.0),
        logging_steps=config.get('training', {}).get('logging_steps', 10),
        save_steps=config.get('training', {}).get('save_steps', 500),
        save_total_limit=config.get('training', {}).get('save_total_limit', 3),
        fp16=True,
        logging_dir=f'{args.output}/logs',
        report_to='none'
    )
    
    # 创建 Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=data_collator
    )
    
    # 开始训练
    logger.info("开始训练...")
    trainer.train()
    
    # 保存模型
    logger.info("保存模型...")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    
    logger.info(f"训练完成，模型已保存到: {args.output}")


if __name__ == '__main__':
    main()