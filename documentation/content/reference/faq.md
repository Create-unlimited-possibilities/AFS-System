---
sidebar_position: 4
---

# 常见问题

本文档收集了 AFS System 使用过程中的常见问题及解决方案。

## 安装与部署

### Q: Docker 启动失败，提示端口被占用

**A:** 检查端口占用情况并修改配置：

```bash
# Windows 查看端口占用
netstat -ano | findstr :3001

# 停止占用端口的进程或修改 docker-compose.yml 中的端口映射
```

### Q: 容器启动后立即退出

**A:** 查看容器日志排查问题：

```bash
# 查看所有容器状态
docker-compose ps

# 查看特定容器日志
docker-compose logs server
docker-compose logs web
```

常见原因：
- 环境变量配置错误
- 数据库连接失败
- 端口冲突

### Q: MongoDB 数据持久化失败

**A:** 确认卷挂载配置正确：

```bash
# 检查卷是否创建
docker volume ls

# 查看 mongodb_data 卷详情
docker volume inspect afs-system_mongodb_data

# 确认 mongoserver 配置中有正确的卷挂载
volumes:
  - ./mongoserver/mongodb_data:/data/db
```

## 配置问题

### Q: 如何修改默认管理员账户？

**A:** 编辑 `.env` 文件中的以下变量：

```bash
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your-secure-password
ADMIN_INVITE_CODE=your-secure-invite-code
```

注意：修改后需要重启服务器容器，且已创建的管理员账户不会自动更新。

### Q: 前端无法连接到后端 API

**A:** 检查以下配置：

1. 确认 `NEXT_PUBLIC_API_URL` 正确：
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

2. 检查后端服务是否运行：
   ```bash
   curl http://localhost:3001/api/health
   ```

3. 查看 Docker 网络配置：
   ```bash
   docker network inspect afs-system_afs-network
   ```

### Q: 如何切换 LLM 后端？

**A:** 修改 `.env` 文件：

```bash
# 使用本地 Ollama
LLM_BACKEND=ollama
OLLAMA_BASE_URL=http://modelserver:11434
OLLAMA_MODEL=deepseek-r1:14b

# 使用 DeepSeek API
LLM_BACKEND=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_MODEL=deepseek-chat
```

修改后重启 server 容器：
```bash
docker-compose restart server
```

## AI 模型问题

### Q: Ollama 模型加载时间过长

**A:** 大型模型需要较长的加载时间，可以增加超时时间：

```bash
OLLAMA_TIMEOUT=60000  # 增加到 60 秒
```

或者使用更小的模型：
```bash
OLLAMA_MODEL=deepseek-chat:7b
```

### Q: AI 回复质量不佳

**A:** 尝试以下优化：

1. 调整温度参数：
   ```bash
   LLM_TEMPERATURE=0.7  # 范围 0.0-2.0
   ```

2. 切换到更大的模型：
   ```bash
   OLLAMA_MODEL=deepseek-r1:14b
   ```

3. 检查 RAG 检索配置：
   - 确认 ChromaDB 正常运行
   - 检查嵌入模型配置

### Q: 如何下载新的 Ollama 模型？

**A:** 进入 modelserver 容器并下载：

```bash
# 进入容器
docker exec -it afs-system-modelserver-1 bash

# 下载模型
ollama pull qwen2.5:7b

# 退出容器
exit

# 更新 .env 配置
OLLAMA_MODEL=qwen2.5:7b
```

## 开发问题

### Q: 前端代码修改后不生效

**A:** 检查 Docker 卷挂载配置：

`docker-compose.yml` 中应该有：
```yaml
volumes:
  - ./web/app:/app/app
  - ./web/lib:/app/lib
  - ./web/components:/app/components
```

如果还是不生效，尝试重启 web 容器：
```bash
docker-compose restart web
```

### Q: 后端代码修改后不生效

**A:** Nodemon 应该自动重启，如果没有：

1. 检查 `server/nodemon.json` 配置
2. 查看 server 容器日志：
   ```bash
   docker-compose logs -f server
   ```
3. 手动重启容器：
   ```bash
   docker-compose restart server
   ```

### Q: 如何运行测试？

**A:** 进入相应目录执行测试命令：

```bash
# 后端测试
docker exec -it afs-system-server-1 npm test

# 前端测试
docker exec -it afs-system-web-1 npm test
```

## 性能问题

### Q: 系统响应缓慢

**A:** 可能的原因和解决方案：

1. **数据库查询慢**
   - 检查 MongoDB 索引
   - 使用 `explain()` 分析查询

2. **LLM 推理慢**
   - 考虑使用 GPU 加速
   - 减小模型大小
   - 增加 `LLM_TIMEOUT`

3. **网络延迟**
   - 检查 Docker 网络配置
   - 优化服务间通信

### Q: 内存占用过高

**A:** 优化建议：

1. 限制 Docker 容器资源：
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

2. 使用更小的模型
3. 清理 ChromaDB 旧数据
4. 重启服务释放内存

## 数据管理

### Q: 如何备份 MongoDB 数据？

**A:** 使用 mongodump 工具：

```bash
# 备份到本地
docker exec afs-system-mongoserver-1 mongodump --out /data/db/backup

# 从容器复制到主机
docker cp afs-system-mongoserver-1:/data/db/backup ./mongodb_backup
```

### Q: 如何重置系统数据？

**A:** 警告：此操作会删除所有数据！

```bash
# 停止所有服务
docker-compose down

# 删除数据卷
docker volume rm afs-system_mongodb_data
docker volume rm afs-system_chroma_data

# 重新启动
docker-compose up -d
```

### Q: 如何清理 ChromaDB 数据？

**A:** ChromaDB 数据存储在 `server/storage/chroma_db`：

```bash
# 停止服务
docker-compose stop chromaserver

# 删除数据
rm -rf server/storage/chroma_db

# 重启服务
docker-compose start chromaserver
```

## 浏览器问题

### Q: 页面显示空白

**A:** 检查浏览器控制台错误：

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的错误信息
3. 查看 Network 标签页的请求状态

常见原因：
- JavaScript 加载失败
- API 请求失败
- 路由配置错误

### Q: 无法上传文件

**A:** 检查以下配置：

1. 文件大小限制（server.js 中）：
   ```javascript
   app.use(express.json({ limit: '50mb' }));
   ```

2. 存储目录权限：
   ```bash
   chmod -R 755 server/storage
   ```

3. 前端上传配置

## 安全问题

### Q: 如何启用 HTTPS？

**A:** 建议使用反向代理（Nginx）：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3002;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
    }
}
```

### Q: 如何防止 API 滥用？

**A:** 实施速率限制：

```javascript
// 在 server.js 中添加
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100 // 每个用户最多 100 次请求
});

app.use('/api/', limiter);
```

## 更多帮助

如果以上问题未能解决您的问题，请：

1. 查看 [GitHub Issues](https://github.com/Create-unlimited-possibilities/AFS-System/issues)
2. 阅读详细文档
3. 提交新的 Issue 并附上：
   - 系统环境信息
   - 错误日志
   - 复现步骤

## 相关文档

- [技术栈](./tech-stack.md)
- [环境变量配置](./env.md)
- [配置文件说明](./config.md)
