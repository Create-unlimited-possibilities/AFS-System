"""
进度跟踪相关的 API 路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from core import progress_tracker
from utils import logger

# 创建路由器实例
router = APIRouter()


# ==================== Pydantic 模型定义 ====================

class ProgressResponse(BaseModel):
    """进度响应模型"""
    job_id: str
    elder_id: str
    status: str
    progress: int
    current_epoch: int
    total_epochs: int
    eta: Optional[str]
    error: Optional[str]


# ==================== 进度跟踪相关端点 ====================

@router.get("/train/progress/{job_id}")
async def get_training_progress(job_id: str):
    """
    查询训练进度
    """
    try:
        progress = progress_tracker.get_progress(job_id)
        
        if not progress:
            raise HTTPException(status_code=404, detail="训练任务不存在")
        
        return progress
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"查询训练进度失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/train/progress/elder/{elder_id}")
async def get_elder_training_progress(elder_id: str):
    """
    查询指定老人的最新训练进度
    """
    try:
        progress = progress_tracker.get_elder_latest_job(elder_id)
        
        if not progress:
            return {
                "elder_id": elder_id,
                "status": "no_training",
                "message": "没有找到训练记录"
            }
        
        return progress
    
    except Exception as e:
        logger.exception(f"查询训练进度失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/active")
async def list_active_jobs():
    """
    列出所有活跃的训练任务
    """
    try:
        jobs = progress_tracker.list_active_jobs()
        return {
            "total": len(jobs),
            "jobs": jobs
        }
    
    except Exception as e:
        logger.exception(f"列出活跃任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))