# Ollama API 代理服务
# 用于 Chat-Beta 模型推理

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import json
import socket
from typing import Optional
import sys
import os

app = FastAPI(title="Ollama Proxy", version="1.0.0")

OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'localhost')
OLLAMA_PORT = int(os.getenv('OLLAMA_PORT', '11435'))
OLLAMA_BASE_URL = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}"

class GenerateRequest(BaseModel):
    model: str
    prompt: str
    stream: Optional[bool] = False
    options: Optional[dict] = None

class ChatRequest(BaseModel):
    model: str
    messages: list
    stream: Optional[bool] = False

def check_ollama_available():
    """检查 Ollama 服务是否可用"""
    try:
        with socket.create_connection((OLLAMA_HOST, OLLAMA_PORT), timeout=2):
            return True
    except Exception:
        return False

@app.get("/")
async def root():
    """健康检查"""
    return {
        "service": "Ollama Proxy",
        "status": "online",
        "ollama_available": check_ollama_available()
    }

@app.get("/api/tags")
async def list_models():
    """列出可用模型"""
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Failed to list models")
        
        lines = result.stdout.strip().split('\n')
        models = []
        for line in lines[1:]:  # 跳过标题行
            if line.strip():
                parts = line.split()
                models.append({
                    "name": parts[0],
                    "size": parts[1] if len(parts) > 1 else "0B",
                    "modified": parts[2] if len(parts) > 2 else ""
                })
        
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate(req: GenerateRequest):
    """生成文本"""
    if not check_ollama_available():
        raise HTTPException(status_code=503, detail="Ollama service unavailable")
    
    try:
        cmd = ["ollama", "run", req.model]
        
        if req.options:
            for key, value in req.options.items():
                cmd.extend([f"--{key}", str(value)])
        
        if req.stream:
            return {'mode': 'stream_not_supported_yet'}
        
        # 非流式生成
        result = subprocess.run(
            cmd,
            input=req.prompt,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Generation failed")
        
        return {
            "model": req.model,
            "response": result.stdout,
            "done": True
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Generation timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(req: ChatRequest):
    """聊天接口"""
    if not check_ollama_available():
        raise HTTPException(status_code=503, detail="Ollama service unavailable")
    
    try:
        # 将消息转换为 prompt
        prompt_parts = []
        for msg in req.messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            prompt_parts.append(f"{role}: {content}")
        
        full_prompt = "\n".join(prompt_parts)
        
        cmd = ["ollama", "run", req.model]
        
        if req.stream:
            return {'mode': 'stream_not_supported_yet'}
        
        result = subprocess.run(
            cmd,
            input=full_prompt,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Chat failed")
        
        return {
            "model": req.model,
            "message": {
                "role": "assistant",
                "content": result.stdout
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8500)