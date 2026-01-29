"""
训练相关的 API 路由
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional
import threading
import requests

from core import OllamaTrainer, ModelManager, progress_tracker
from utils import logger
from config.config_loader import config

# 创建路由器实例
router = APIRouter()

# 初始化组件
trainer = OllamaTrainer()
model_manager = ModelManager()


# ==================== Pydantic 模型定义 ====================

class TrainRequest(BaseModel):
    """训练请求模型"""
    elder_id: str
    elder_name: str = "长辈"
    force_retrain: bool = False  # 是否强制重新训练（即使模型已存在）


# ==================== 训练相关端点 ====================

@router.post("/train/start")
async def start_training(request: TrainRequest, background_tasks: BackgroundTasks):
    """
    启动模型训练
    
    如果模型已存在且 force_retrain=False，则跳过训练
    """
    try:
        logger.info(f"收到训练请求: elder_id={request.elder_id}, elder_name={request.elder_name}")
        
        # 检查模型是否已存在
        if not request.force_retrain and model_manager.model_exists(request.elder_id):
            logger.info(f"模型已存在，跳过训练: {request.elder_id}")
            return {
                "success": True,
                "message": "模型已存在，无需重新训练",
                "elder_id": request.elder_id,
                "model_name": f"{model_manager.model_prefix}{request.elder_id}"
            }
        
        # 创建进度跟踪任务
        total_epochs = config.get_training_config().get('epochs', 3)
        job_id = progress_tracker.start_tracking(request.elder_id, total_epochs)
        
        # 在后台执行训练
        def train_task():
            try:
                progress_tracker.update_progress(job_id, status='training')
                result = trainer.train(request.elder_id, request.elder_name)
                
                if result['success']:
                    progress_tracker.complete_tracking(job_id, success=True)
                else:
                    progress_tracker.complete_tracking(job_id, success=False, error=result.get('error'))
            
            except Exception as e:
                logger.exception(f"训练任务执行失败: {e}")
                progress_tracker.complete_tracking(job_id, success=False, error=str(e))
        
        # 添加到后台任务
        background_tasks.add_task(train_task)
        
        return {
            "success": True,
            "message": "训练任务已启动",
            "job_id": job_id,
            "elder_id": request.elder_id
        }
    
    except Exception as e:
        logger.exception(f"启动训练失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """健康检查端点"""
    ollama_ok = trainer.check_ollama_available()
    return {
        "status": "healthy" if ollama_ok else "degraded",
        "ollama": "available" if ollama_ok else "unavailable",
        "active_jobs": len(progress_tracker.list_active_jobs())
    }


@router.get("/config")
async def get_config():
    """
    获取当前配置信息
    """
    try:
        return {
            "current_model": config.get_current_model(),
            "training_config": config.get_training_config(),
            "ollama_config": config.get_ollama_config(),
            "paths": config.get_paths()
        }
    
    except Exception as e:
        logger.exception(f"获取配置失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))