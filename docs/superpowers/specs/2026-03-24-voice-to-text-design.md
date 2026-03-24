# 语音转文字 + 粤语翻译功能设计文档

> 创建日期: 2026-03-24
> 状态: 已确认

## 1. 功能概述

为问卷回答和 AI 对话界面添加语音转文字功能，并支持粤语口语自动翻译为普通话书面语。

### 1.1 核心功能

| 功能 | 描述 |
|------|------|
| 语音转文字 | 实时转录用户语音，自动填入文本框 |
| 粤语检测 | 检测文本是否包含粤语口语特征 |
| 粤语翻译 | 将粤语口语翻译为普通话书面语 |
| 翻译开关 | 用户可自主启用/禁用翻译功能 |

### 1.2 使用场景

- 个人问答页面 (`/questions`)
- 协助者问答页面 (`/questions/assist`)
- AI 对话界面 (`/chat`)

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          前端 (Next.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  问卷页面 (questions, questions/assist)                          │
│  聊天界面 (chat)                                                 │
│  ┌─────────────────┐                                             │
│  │ VoiceRecorder   │  ← 麦克风按钮组件                            │
│  │ - 点击切换录音   │                                             │
│  │ - 实时显示转录   │                                             │
│  │ - 追加到文本框   │                                             │
│  └────────┬────────┘                                             │
└───────────┼─────────────────────────────────────────────────────┘
            │ WebSocket (实时音频流)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python FastAPI 服务                           │
│                    (server/transcription/)                       │
├─────────────────────────────────────────────────────────────────┤
│  /ws/transcribe  ← WebSocket 端点                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ faster-whisper (large-v3-turbo)                          │    │
│  │ - 实时转录音频流                                          │    │
│  │ - 自动检测语言 (zh/en/yue)                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

            保存答案时 (HTTP)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js Server                                │
├─────────────────────────────────────────────────────────────────┤
│  /answers/batch-self  /answers/batch-assist                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 粤语检测 + 翻译服务                                        │    │
│  │ CantoneseLLMChat-7B (硬编码)                              │    │
│  │ - 检测是否含粤语口语                                       │    │
│  │ - 翻译为普通话书面语                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 组件设计

### 3.1 VoiceRecorder 组件

**文件位置**: `web/components/ui/voice-recorder.tsx`

```typescript
interface VoiceRecorderProps {
  onTranscript: (text: string) => void  // 转录文字回调（追加到文本框）
  disabled?: boolean
}
```

**功能**:
- 麦克风按钮（点击开始/停止录音）
- 录音状态指示器（红色圆点动画）
- 实时显示转录中的文字
- WebSocket 连接到 Node.js 代理

**交互流程**:
1. 用户点击麦克风按钮 → 开始录音
2. 音频流通过 WebSocket 发送到转录服务
3. 转录服务返回文字 → 追加到文本框
4. 用户再次点击 → 停止录音

### 3.2 翻译开关

**位置**: 用户设置页面 (`/settings`)

**UI 设计**:
```
┌────────────────────────────────────────────────────┐
│  🎤 语音输入                                        │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │ 粤语口语翻译                                  │  │
│  │ 自动将粤语口语翻译为普通话书面语               │  │
│  │                                    [○ 开关]  │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## 4. Python FastAPI 转录服务

### 4.1 服务结构

```
server/transcription/
├── main.py              # FastAPI 应用入口
├── websocket_handler.py # WebSocket 处理逻辑
├── transcriber.py       # faster-whisper 封装
├── config.py            # 配置（模型路径、设备等）
└── requirements.txt     # Python 依赖
```

### 4.2 核心实现

```python
# main.py
from fastapi import FastAPI, WebSocket
from faster_whisper import WhisperModel

app = FastAPI()
model = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = []

    async for message in websocket.iter_bytes():
        # 接收音频块 (PCM 16kHz mono)
        audio_buffer.append(message)

        # 每累积 1 秒音频进行转录
        if len(audio_buffer) >= CHUNK_SIZE:
            segments, _ = model.transcribe(
                b"".join(audio_buffer),
                language=None  # 自动检测语言
            )
            text = " ".join([s.text for s in segments])
            await websocket.send_json({"text": text, "final": False})
            audio_buffer = []

    # 连接关闭时发送最终结果
    await websocket.send_json({"text": "", "final": True})
```

### 4.3 依赖

```
# requirements.txt
faster-whisper>=1.0.0
fastapi>=0.109.0
uvicorn>=0.27.0
websockets>=12.0
numpy>=1.24.0
```

### 4.4 启动命令

```bash
cd server/transcription
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 5. 粤语检测与翻译服务

### 5.1 模型信息

- **模型**: CantoneseLLMChat-7B
- **下载命令**: `ollama run humblemat/hon9kon9ize_CantoneseLLMChat-v1.0-7B-F16.gguf.q8_0`
- **硬编码**: 不可替换

### 5.2 服务结构

```
server/src/modules/translation/
├── service.js           # 粤语检测与翻译服务
├── prompts.js           # 翻译 prompt 模板
└── model.js             # Ollama 模型调用封装
```

### 5.3 输出格式

```
需要翻译：tans{true} text{"翻译后的文本"}
不需要翻译：tans{false} text{""}
```

### 5.4 核心逻辑

```javascript
// service.js
const CANTONESE_MODEL = 'humblemat/hon9kon9ize_CantoneseLLMChat-v1.0-7B-F16.gguf.q8_0';

async function detectAndTranslate(text) {
  const prompt = buildTranslationPrompt(text);

  const response = await ollamaClient.generate(CANTONESE_MODEL, prompt, {
    format: 'json',
    temperature: 0.1  // 低温度确保稳定输出
  });

  // 解析输出格式
  const result = parseTranslationResponse(response);

  if (result.needsTranslation) {
    return result.translatedText;
  }
  return text;  // 不需要翻译，返回原文
}

// 批量处理答案
async function processAnswersForTranslation(answers, userId) {
  // 检查用户是否开启翻译开关
  const userPreference = await getUserPreference(userId);
  if (!userPreference.cantoneseTranslationEnabled) {
    return answers;  // 未开启，返回原答案
  }

  // 逐一检测并翻译
  const processedAnswers = [];
  for (const answer of answers) {
    const translatedText = await detectAndTranslate(answer.answer);
    processedAnswers.push({
      ...answer,
      answer: translatedText
    });
  }

  return processedAnswers;
}
```

## 6. 数据模型

### 6.1 用户偏好设置扩展

在 `server/src/modules/user/model.js` 中添加:

```javascript
preferences: {
  // 粤语口语翻译开关
  cantoneseTranslationEnabled: {
    type: Boolean,
    default: false
  },
  // 语音输入设置
  voiceInput: {
    enabled: { type: Boolean, default: true },
    language: { type: String, default: 'auto' }  // auto, zh, yue, en
  },

  updatedAt: { type: Date, default: Date.now }
}
```

## 7. API 设计

### 7.1 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/user/preferences` | GET | 获取用户偏好设置 |
| `/api/user/preferences` | PUT | 更新用户偏好设置 |
| `/api/transcription/ws` | WS | WebSocket 转录服务（Node.js 代理） |

### 7.2 WebSocket 代理

Node.js 代理到 Python FastAPI 服务:

```javascript
// server/src/modules/transcription/route.js
router.ws('/ws', (ws, req) => {
  const pythonWs = new WebSocket('ws://localhost:8001/ws/transcribe');

  ws.on('message', (msg) => pythonWs.send(msg));
  pythonWs.on('message', (msg) => ws.send(msg));
});
```

## 8. 工作流程

### 8.1 语音输入流程

```
1. 用户点击麦克风按钮
   ↓
2. 前端请求麦克风权限
   ↓
3. 开始录音，音频流通过 WebSocket 发送
   ↓
4. Python 服务实时转录，返回文字
   ↓
5. 前端追加文字到文本框
   ↓
6. 用户再次点击，停止录音
```

### 8.2 翻译流程（保存时）

```
1. 用户点击"保存回答"
   ↓
2. 检查用户是否开启翻译开关
   ↓ (是)
3. 逐一检测答案是否含粤语
   ↓ (是)
4. 调用 CantoneseLLMChat-7B 翻译
   ↓
5. 替换原答案内容
   ↓
6. 保存到数据库
```

## 9. 文件变更清单

### 9.1 新建文件

| 文件 | 说明 |
|------|------|
| `server/transcription/main.py` | FastAPI 应用入口 |
| `server/transcription/websocket_handler.py` | WebSocket 处理 |
| `server/transcription/transcriber.py` | faster-whisper 封装 |
| `server/transcription/config.py` | 配置文件 |
| `server/transcription/requirements.txt` | Python 依赖 |
| `server/src/modules/translation/service.js` | 粤语检测与翻译服务 |
| `server/src/modules/translation/prompts.js` | 翻译 prompt 模板 |
| `server/src/modules/translation/model.js` | Ollama 模型调用 |
| `server/src/modules/transcription/route.js` | WebSocket 代理路由 |
| `web/components/ui/voice-recorder.tsx` | 语音录制组件 |

### 9.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `server/src/modules/user/model.js` | 添加 preferences 字段 |
| `server/src/modules/user/route.js` | 添加偏好设置 API |
| `server/src/modules/user/controller.js` | 添加偏好设置处理方法 |
| `server/src/modules/qa/controller.js` | 保存答案时调用翻译服务 |
| `web/app/questions/page.tsx` | 集成语音录制组件 |
| `web/app/questions/assist/page.tsx` | 集成语音录制组件 |
| `web/app/chat/components/ChatPanel.tsx` | 集成语音录制组件 |
| `web/app/settings/page.tsx` | 添加翻译开关 |

## 10. 部署要求

### 10.1 硬件要求

- GPU: 推荐 NVIDIA GPU（用于 faster-whisper 加速）
- CPU: 支持 GPU 时可使用 CPU
- 内存: 至少 8GB

### 10.2 软件要求

- Python 3.10+
- Node.js 18+
- Ollama（用于 CantoneseLLMChat-7B）
- CUDA（可选，用于 GPU 加速）

### 10.3 模型下载

```bash
# 下载粤语翻译模型
ollama run humblemat/hon9kon9ize_CantoneseLLMChat-v1.0-7B-F16.gguf.q8_0

# faster-whisper 模型会在首次运行时自动下载
```

## 11. 测试计划

### 11.1 功能测试

- [ ] 语音录制开始/停止
- [ ] 实时转录显示
- [ ] 文字追加到文本框
- [ ] 粤语检测准确性
- [ ] 粤语翻译准确性
- [ ] 翻译开关生效

### 11.2 集成测试

- [ ] 问卷页面语音输入
- [ ] 聊天界面语音输入
- [ ] 保存时自动翻译
- [ ] 多语言混合处理

## 12. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 语音识别准确率 | 使用 large-v3-turbo 模型，支持粤语 |
| 翻译质量不稳定 | 低温度参数，严格的输出格式 |
| GPU 资源占用 | 支持降级到 CPU 模式 |
| WebSocket 连接断开 | 自动重连机制 |
