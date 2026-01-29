"""
ModelServer FastAPI 主应用
提供训练、聊天、模型管理等 API 接口
通过模块化路由实现更好的代码组织
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import OllamaTrainer
from utils import logger
from api.routes import train_routes, chat_routes, model_routes, progress_routes

# 创建 FastAPI 应用
app = FastAPI(
    title="传家之宝 - ModelServer API",
    description="LLM 模型训练和推理服务",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(train_routes.router)
app.include_router(chat_routes.router)
app.include_router(model_routes.router)
app.include_router(progress_routes.router)

# 初始化组件
trainer = OllamaTrainer()


@app.get("/")
async def root():
    """根路径，返回 API 信息"""
    return {
        "name": "传家之宝 ModelServer",
        "version": "1.0.0",
        "status": "running",
        "ollama_available": trainer.check_ollama_available()
    }


# ==================== 启动和关闭事件 ====================

@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("ModelServer API 启动中...")
    logger.info(f"Ollama 状态: {'可用' if trainer.check_ollama_available() else '不可用'}")
    logger.info("ModelServer API 已启动")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("ModelServer API 正在关闭...")
    # 清理资源
    from core.progress_tracker import progress_tracker
    progress_tracker.cleanup_old_jobs()
    logger.info("ModelServer API 已关闭")


if __name__ == "__main__":
    import uvicorn
    from config.config_loader import config
    
    # 运行服务器
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=config.is_debug_mode()
    )
