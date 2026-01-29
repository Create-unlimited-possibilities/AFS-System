"""
聊天相关的 API 路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests

from core import ModelManager
from utils import logger
from config.config_loader import config

# 创建路由器实例
router = APIRouter()

# 初始化组件
model_manager = ModelManager()


# ==================== Pydantic 模型定义 ====================

class ChatRequest(BaseModel):
    """聊天请求模型"""
    elder_id: str
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None


class ChatResponse(BaseModel):
    """聊天响应模型"""
    elder_id: str
    message: str
    response: str
    model_name: str


# ==================== 聊天相关端点 ====================

@router.post("/chat")
async def chat_with_elder(request: ChatRequest):
    """
    与老人模型聊天
    """
    try:
        # 检查模型是否存在
        if not model_manager.model_exists(request.elder_id):
            raise HTTPException(
                status_code=404,
                detail=f"老人 {request.elder_id} 的模型不存在，请先训练模型"
            )
        
        model_name = f"{model_manager.model_prefix}{request.elder_id}"
        
        # 调用 Ollama API 进行推理
        ollama_api = config.get_ollama_config().get('api_base', 'http://localhost:11434')
        
        # 构建消息历史
        messages = []
        if request.conversation_history:
            messages.extend(request.conversation_history)
        messages.append({"role": "user", "content": request.message})
        
        # 调用 Ollama chat API
        response = requests.post(
            f"{ollama_api}/api/chat",
            json={
                "model": model_name,
                "messages": messages,
                "stream": False
            },
            timeout=60
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama API 调用失败: {response.text}"
            )
        
        result = response.json()
        assistant_message = result.get('message', {}).get('content', '')
        
        return {
            "elder_id": request.elder_id,
            "message": request.message,
            "response": assistant_message,
            "model_name": model_name
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"聊天失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))