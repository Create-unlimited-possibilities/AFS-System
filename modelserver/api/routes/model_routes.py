"""
模型管理相关的 API 路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import ModelManager
from utils import logger, JSONLBuilder

# 创建路由器实例
router = APIRouter()

# 初始化组件
model_manager = ModelManager()


# ==================== 模型管理相关端点 ====================

@router.get("/models")
async def list_models(filter_afs_only: bool = True):
    """
    列出所有模型
    """
    try:
        models = model_manager.list_models(filter_afs_only=filter_afs_only)
        return {
            "total": len(models),
            "models": models
        }
    
    except Exception as e:
        logger.exception(f"列出模型失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{elder_id}")
async def get_model_info(elder_id: str):
    """
    获取指定老人的模型信息
    """
    try:
        model_info = model_manager.show_model_info(elder_id)
        
        if not model_info:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        return model_info
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"获取模型信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/models/{elder_id}")
async def delete_model(elder_id: str):
    """
    删除指定老人的模型
    """
    try:
        success = model_manager.delete_model(elder_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="删除模型失败")
        
        return {
            "success": True,
            "message": f"模型 {elder_id} 已删除"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"删除模型失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export-jsonl/{elder_id}")
async def export_jsonl(elder_id: str):
    """
    导出老人的 JSONL 数据集
    """
    try:
        builder = JSONLBuilder()
        jsonl_path = builder.export_jsonl(elder_id)
        
        if not jsonl_path:
            raise HTTPException(status_code=404, detail="没有找到数据或导出失败")
        
        return {
            "success": True,
            "elder_id": elder_id,
            "jsonl_path": jsonl_path
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"导出 JSONL 失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))