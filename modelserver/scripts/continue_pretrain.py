#!/usr/bin/env python3
"""
继续预训练脚本 - 用于 Chat-Beta Mode 3

使用方法：
python continue_pretrain.py \
    --task_id cpt_task_123 \
    --dataset /path/to/pretrain_data.json \
    --output /output/path \
    --base_model Qwen/Qwen2.5-14B
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
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_config(config_path):
    """加载配置文件"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser(description='Chat-Beta 继续预训练')
    parser.add_argument('--task_id', required=True, help='任务 ID')
    parser.add_argument('--dataset', required=True, help='预训练数据集路径')
    parser.add_argument('--output', required=True, help='输出模型路径')
    parser.add_argument('--base_model', default='Qwen/Qwen2.5-14B', help='基础模型')
    parser.add_argument('--config', default='configs/continue_pretrain_config.yaml', help='配置文件')
    
    args = parser.parse_args()
    
    logger.info(f"继续预训练任务 {args.task_id} 开始...")
    logger.info(f"数据集: {args.dataset}")
    
    # 加载配置
    config = {}
    if os.path.exists(args.config):
        config = load_config(args.config)
    
    # 加载数据集
    logger.info("加载数据集...")
    dataset = load_dataset('json', data_files=args.dataset, split='train')
    
    # 加载 tokenizer
    logger.info(f"加载 tokenizer: {args.base_model}")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    
    # 数据预处理
    block_size = config.get('data', {}).get('block_size', 1024)
    
    def preprocess_function(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            padding='max_length',
            max_length=block_size,
            return_overflowing_tokens=True
        )
    
    tokenized_dataset = dataset.map(preprocess_function, remove_columns=['text'])
    
    # 数据整理
    block_size = block_size
    def group_texts(examples):
        concatenated = {k: [] for k in examples[0]}
        
        for k in examples[0]:
            for i in range(len(examples[k])):
                for j in range(len(examples[k][i]) // block_size + 1):
                    start = j * block_size
                    end = start + block_size
                    concatenated[k].append(examples[k][i][start:end])
        
        result = {k: sum(concatenated[k], []) for k in examples[0]}
        # 添加 attention mask
        result['attention_mask'] = [[1] * len(text) for text in result['input_ids']]
        return result
    
    lm_datasets = tokenized_dataset.map(group_texts, batched=True)
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    
    # 加载模型
    logger.info(f"加载基础模型: {args.base_model}")
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch.bfloat16,
        device_map='auto',
        trust_remote_code=True
    )
    
    # 训练参数
    batch_size = config.get('training', {}).get('batch_size', 2)
    epochs = config.get('training', {}).get('num_epochs', 1)
    
    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=config.get('training', {}).get('gradient_accumulation_steps', 4),
        learning_rate=config.get('training', {}).get('learning_rate', 1e-4),
        weight_decay=config.get('training', {}).get('weight_decay', 0.01),
        warmup_ratio=config.get('training', {}).get('warmup_ratio', 0.03),
        max_grad_norm=config.get('training', {}).get('max_grad_norm', 1.0),
        logging_steps=50,
        save_steps=config.get('training', {}).get('save_steps', 1000),
        fp16=True,
        logging_dir=f'{args.output}/logs',
        report_to='none'
    )
    
    # 创建 Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=lm_datasets,
        data_collator=data_collator
    )
    
    # 开始训练
    logger.info("开始继续预训练...")
    trainer.train()
    
    # 保存模型
    logger.info("保存模型...")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    
    logger.info(f"继续预训练完成，模型已保存到: {args.output}")


if __name__ == '__main__':
    main()