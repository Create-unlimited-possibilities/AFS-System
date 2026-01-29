# 传家之宝 - ModelServer 模块

## 概述

ModelServer 是传家之宝系统的 LLM 模型训练和推理服务，基于 Ollama + Python 生态构建。提供完整的模型训练、管理和推理 API。

## 架构设计

### 模块化结构（6 个核心模块）

```
modelserver/
├── config/              # 配置模块
│   ├── training_config.yaml   # 全局配置文件
│   └── config_loader.py       # 配置加载器
├── utils/               # 工具函数模块
│   ├── logger.py              # 统一日志记录
│   ├── jsonl_builder.py       # JSONL 数据集构建
│   └── system_prompt.py       # System Prompt 生成器
├── core/                # 核心业务逻辑模块
│   ├── trainer.py             # 模型训练器
│   ├── model_manager.py       # 模型管理器
│   └── progress_tracker.py    # 进度跟踪器
├── api/                 # API 接口模块
│   └── main.py                # FastAPI 应用
├── train-notebooks/     # 调试实验模块
│   └── train_adapter_example.ipynb  # 训练实验 Notebook
└── models/              # 模型存储模块
    ├── base/                  # 基础模型（HF 格式）
    └── adapters/              # LoRA Adapter 输出
```

## 技术栈

- **核心框架**: Ollama 0.3.14 + Python 3.12
- **API 服务**: FastAPI 0.115.0 + Uvicorn
- **数据处理**: PyMongo 4.10.0 + Pandas 2.2.0
- **配置管理**: PyYAML 6.0.0
- **调试工具**: Jupyter Notebook 7.0.0

## 快速开始

### 1. 环境准备

确保已安装：
- Docker 和 Docker Compose
- Python 3.12+（如果本地运行）
- Ollama（容器内已包含）

### 2. 配置文件

编辑 `config/training_config.yaml` 设置训练参数：

```yaml
# 基础模型设置
current_model: "qwen2.5-14b-instruct"

# 训练超参数
training:
  epochs: 3
  batch_size: 4
  learning_rate: 5e-5
  lora:
    rank: 16
    alpha: 32
```

### 3. 启动服务

#### Docker 方式（推荐）

```bash
# 在项目根目录
docker-compose up modelserver -d

# 查看日志
docker-compose logs -f modelserver
```

#### 本地开发方式

```bash
cd modelserver

# 安装依赖
pip install -r requirements.txt

# 启动 Ollama（后台）
ollama serve &

# 启动 FastAPI
python -m uvicorn api.main:app --reload --port 8000
```

### 4. 验证服务

访问以下地址：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health
- Ollama API: http://localhost:11434/api/version

## API 使用指南

### 1. 启动训练

```bash
curl -X POST "http://localhost:8000/train/start" \
  -H "Content-Type: application/json" \
  -d '{
    "elder_id": "LXM19580312M",
    "elder_name": "李小明",
    "force_retrain": false
  }'
```

响应：
```json
{
  "success": true,
  "message": "训练任务已启动",
  "job_id": "LXM19580312M_1734512345",
  "elder_id": "LXM19580312M"
}
```

### 2. 查询训练进度

```bash
curl "http://localhost:8000/train/progress/{job_id}"
```

响应：
```json
{
  "job_id": "LXM19580312M_1734512345",
  "elder_id": "LXM19580312M",
  "status": "training",
  "progress": 67,
  "current_epoch": 2,
  "total_epochs": 3,
  "eta": "5分钟"
}
```

### 3. 聊天推理

```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "elder_id": "LXM19580312M",
    "message": "你还记得小时候的事情吗？",
    "conversation_history": []
  }'
```

### 4. 模型管理

```bash
# 列出所有模型
curl "http://localhost:8000/models"

# 获取模型详情
curl "http://localhost:8000/models/LXM19580312M"

# 删除模型
curl -X DELETE "http://localhost:8000/models/LXM19580312M"
```

### 5. 导出数据集

```bash
curl "http://localhost:8000/export-jsonl/LXM19580312M"
```

## 核心功能说明

### 1. 配置模块 (config/)

**功能**：集中管理所有训练参数
- 支持多基础模型切换
- 动态路径模板替换
- LoRA 参数配置
- System Prompt 模板

**示例**：
```python
from config.config_loader import config

# 获取当前模型
current_model = config.get_current_model()

# 获取训练配置
training_config = config.get_training_config()
```

### 2. 工具模块 (utils/)

#### JSONLBuilder
从 MongoDB 拉取数据并生成标准 JSONL 格式：

```python
from utils import JSONLBuilder

builder = JSONLBuilder()
with builder:
    jsonl_path = builder.build_jsonl("LXM19580312M", "李小明")
```

#### SystemPromptGenerator
生成个性化 system prompt：

```python
from utils import SystemPromptGenerator

generator = SystemPromptGenerator()
prompt = generator.generate("李小明", memories[:5])
```

### 3. 核心模块 (core/)

#### OllamaTrainer
封装完整训练流程：

```python
from core import OllamaTrainer

trainer = OllamaTrainer()
result = trainer.train("LXM19580312M", "李小明")
```

#### ModelManager
管理模型生命周期：

```python
from core import ModelManager

manager = ModelManager()
models = manager.list_models(filter_afs_only=True)
manager.delete_model("LXM19580312M")
```

#### ProgressTracker
实时跟踪训练进度：

```python
from core import progress_tracker

job_id = progress_tracker.start_tracking("LXM19580312M", total_epochs=3)
progress_tracker.update_progress(job_id, current_epoch=2)
```

## 调试和开发

### 使用 Jupyter Notebook

```bash
cd modelserver/train-notebooks
jupyter notebook train_adapter_example.ipynb
```

Notebook 包含：
1. ✅ 配置验证
2. ✅ JSONL 数据生成测试
3. ✅ System Prompt 测试
4. ✅ 模型管理测试
5. ✅ 训练流程测试
6. ✅ 进度跟踪测试
7. ✅ 数据分析工具

### 日志查看

日志文件位置：`/app/logs/modelserver_YYYYMMDD.log`

```bash
# Docker 环境
docker exec -it modelserver tail -f /app/logs/modelserver_$(date +%Y%m%d).log

# 本地环境
tail -f logs/modelserver_$(date +%Y%m%d).log
```

## 数据流程

```
MongoDB (老人记忆数据)
    ↓
JSONLBuilder (拉取 & 格式化)
    ↓
JSONL 文件 (标准训练格式)
    ↓
OllamaTrainer (创建 Modelfile + 训练)
    ↓
Ollama 专属模型 (afs_elder_XXX)
    ↓
推理 API (聊天对话)
```

## 配置参数说明

### 训练超参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| epochs | 3 | 训练轮数（2-5 推荐） |
| batch_size | 4 | 批次大小 |
| learning_rate | 5e-5 | 学习率 |
| max_seq_length | 512 | 最大序列长度 |

### LoRA 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| rank | 16 | LoRA 秩（8-32） |
| alpha | 32 | 缩放因子（rank × 2） |
| dropout | 0.05 | Dropout 率 |

### 路径配置

| 路径 | 说明 |
|------|------|
| /app/data/jsonl | JSONL 临时存储 |
| /app/models/adapters | LoRA Adapter 输出 |
| /app/models/base | 基础模型目录 |
| /app/logs | 日志目录 |

## 性能优化建议

1. **显存不足**：降低 `batch_size` 到 2
2. **训练太慢**：增加 `gradient_accumulation_steps`
3. **模型太大**：使用量化参数 `q4_k_m`
4. **精度要求高**：使用 `q8_0` 量化

## 故障排查

### 问题：Ollama 服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep 11434

# 重启 Ollama
docker-compose restart modelserver
```

### 问题：训练数据为空

检查 MongoDB 中是否有该老人的 Answer 数据：

```javascript
db.answers.find({ elderId: "LXM19580312M" }).count()
```

### 问题：模型推理失败

确保模型已成功创建：

```bash
curl http://localhost:11434/api/tags
```

## 扩展开发

### 添加新基础模型

编辑 `config/training_config.yaml`：

```yaml
base_models:
  llama3.1-8b:
    name: "Llama3.1-8B"
    hf_path: "{{model_dir}}/llama3.1-8b"
    gguf_path: "{{model_dir}}/llama3.1-8b.gguf"
    description: "轻量版：省资源"
```

### 自定义 System Prompt

修改 `config/training_config.yaml` 中的 `prompt_template`。

### 添加新 API 端点

在 `api/main.py` 中添加新路由：

```python
@app.get("/custom-endpoint")
async def custom_endpoint():
    return {"message": "Custom response"}
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目采用 MIT 许可证。

## 联系方式

- 项目维护者: AFS Team
- 版本: 1.0.0
