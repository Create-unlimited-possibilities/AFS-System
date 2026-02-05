# 音频转写服务 API 文档

## 概述

本服务提供基于 OpenAI Whisper 的音频转写和翻译功能，支持将音频文件转换为文本。

## API 端点

### 1. 音频转写

将音频文件转写为文本。

**请求:**
```
POST /api/audio/transcribe
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**参数:**
- `audio` (file, required): 音频文件。支持格式: mp3, mp4, mpeg, mpga, m4a, wav, webm
- `language` (string, optional): 目标语言代码 (默认: 'zh')

**请求示例 (cURL):**
```bash
curl -X POST http://localhost:3000/api/audio/transcribe \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "audio=@/path/to/your/audio.mp3" \
  -F "language=zh"
```

**请求示例 (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('language', 'zh');

const response = await fetch('http://localhost:3000/api/audio/transcribe', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
console.log(result.data.text);
```

**成功响应:**
```json
{
  "success": true,
  "message": "转录成功",
  "data": {
    "text": "转录的文本内容",
    "language": "chinese",
    "duration": 45.6,
    "segments": [
      {
        "id": 0,
        "seek": 0,
        "start": 0.0,
        "end": 2.5,
        "text": "转录的第一段文本",
        "tokens": [...],
        "temperature": 0.0,
        "avg_logprob": -0.245,
        "compression_ratio": 1.2,
        "no_speech_prob": 0.05
      }
    ]
  }
}
```

### 2. 音频翻译

将音频文件翻译为英文。

**请求:**
```
POST /api/audio/translate
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**参数:**
- `audio` (file, required): 音频文件

**请求示例 (cURL):**
```bash
curl -X POST http://localhost:3000/api/audio/translate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "audio=@/path/to/your/audio.mp3"
```

**成功响应:**
```json
{
  "success": true,
  "message": "翻译成功",
  "data": {
    "text": "Translated text in English"
  }
}
```

## 错误响应

**文件未上传:**
```json
{
  "success": false,
  "message": "请上传音频文件",
  "errors": null
}
```

**不支持的文件类型:**
```json
{
  "success": false,
  "message": "不支持的文件类型: .flac. 支持的格式: .mp3, .mp4, .mpeg, .mpga, .m4a, .wav, .webm",
  "errors": null
}
```

**文件过大:**
```json
{
  "success": false,
  "message": "File too large",
  "errors": null
}
```

## 配置

需要在 `.env` 文件中配置:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

获取 API Key: https://platform.openai.com/api-keys

## 限制

- 文件大小限制: 25 MB
- 支持的音频格式: mp3, mp4, mpeg, mpga, m4a, wav, webm
- 默认转写语言: 中文 (zh)

## 前端集成示例

### HTML 表单示例

```html
<form id="audioForm" enctype="multipart/form-data">
  <input type="file" id="audioFile" accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm" required>
  <select id="language">
    <option value="zh">中文</option>
    <option value="en">English</option>
    <option value="es">Español</option>
  </select>
  <button type="submit">转写</button>
</form>

<div id="result"></div>

<script>
const token = localStorage.getItem('token');

document.getElementById('audioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('audio', document.getElementById('audioFile').files[0]);
  formData.append('language', document.getElementById('language').value);
  
  try {
    const response = await fetch('http://localhost:3000/api/audio/transcribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('result').innerHTML = `
        <h3>转写结果:</h3>
        <p>${result.data.text}</p>
        <p>时长: ${result.data.duration.toFixed(2)} 秒</p>
        <p>检测语言: ${result.data.language}</p>
      `;
    } else {
      document.getElementById('result').innerHTML = `<p style="color: red;">${result.message}</p>`;
    }
  } catch (error) {
    document.getElementById('result').innerHTML = `<p style="color: red;">错误: ${error.message}</p>`;
  }
});
</script>
```

## 使用场景

1. **老人语音输入**: 老年用户可以通过语音回答问题，系统自动转写为文本
2. **访谈记录**: 记录老人访谈内容并自动转写
3. **回忆整理**: 将老人的口述回忆整理为文本档案
4. **多语言支持**: 支持多种语言的音频转写

## 注意事项

1. 确保已配置有效的 OpenAI API Key
2. 确保音频文件清晰，转写效果与音频质量直接相关
3. 大文件转写可能需要较长时间，建议在前端添加加载提示
4. OpenAI API 按使用量计费，请合理使用以控制成本
