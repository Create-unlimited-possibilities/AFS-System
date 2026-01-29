#!/usr/bin/env bash
# 传家之宝 ModelServer 启动脚本 - Docker 优化版
# 同时启动 Ollama serve（后台）和 FastAPI（前台）

set -euo pipefail

echo "======================================"
echo "传家之宝 ModelServer 启动中..."
echo "======================================"

# ========================
# 启动 Ollama 服务（后台）
# ========================
echo "启动 Ollama 服务..."

# 创建日志文件，确保可写
mkdir -p /app/logs
OLLAMA_LOG="/app/logs/ollama.log"

ollama serve > "$OLLAMA_LOG" 2>&1 &
OLLAMA_PID=$!

# 更健壮的等待 Ollama 就绪（最多等 60 秒）
echo "等待 Ollama 服务就绪 (最多 60 秒)..."
timeout=60
elapsed=0

until curl -s --fail http://127.0.0.1:11434/api/version > /dev/null; do
    if [ $elapsed -ge $timeout ]; then
        echo "错误: Ollama 服务在 ${timeout} 秒内未就绪"
        cat "$OLLAMA_LOG"
        exit 1
    fi
    sleep 2
    ((elapsed += 2))
    echo -n "."
done

echo -e "\n✓ Ollama 服务已启动 (PID: $OLLAMA_PID)"

# ========================
# 启动 FastAPI 应用（前台，使用 exec）
# ========================
echo "启动 FastAPI 应用..."

cd /app || { echo "无法进入 /app 目录"; exit 1; }



echo "=== 调试信息 ==="
echo "当前目录: $(/bin/pwd)"
echo "PYTHONPATH: $PYTHONPATH"
python3 -c "import sys; print('sys.path:', sys.path)" 

echo "检查 api 目录是否存在:"
ls -la /app/api/ 2>&1 || echo "api 目录不存在或无法访问"

echo "检查 main.py 是否存在:"
ls -la /app/api/main.py 2>&1 || echo "main.py 不存在"

echo "尝试手动导入 api.main:"
python3 -c "import sys; sys.path.insert(0, '/app'); import api.main; print('成功导入 api.main，app 类型:', type(api.main.app))" || echo "导入失败！请看上面错误"

echo "=== 调试结束 ==="

# 再启动 uvicorn
exec python3 -c "
import sys
sys.path.insert(0, '/app')
from api.main import app
import uvicorn
uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
"


# 用 exec 替换当前 shell 进程，让 FastAPI 成为 PID 1
# 这样 Docker stop 时能正确收到 SIGTERM 并优雅关闭
exec python3 -m uvicorn api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    --workers 1   # 根据 CPU 核心数调整，生产建议 2-4

# 注意：下面这行永远不会执行到，因为 exec 替换了进程
# 如果你想同时监控 ollama，可以考虑 supervisor/multitool，但会更复杂