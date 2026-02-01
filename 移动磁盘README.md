# AFS System 演示磁盘

## 📁 内容说明

本磁盘包含完整的 AFS 系统演示环境和演示数据。

## 📋 演示步骤

1. **复制项目到演示电脑**
   - 将 `AFS-System/` 文件夹复制到 `C:\`
   - 复制 `afs-demo-backup.tar.gz` 到 `C:\AFS-System\`

2. **启动 Docker**
   - 打开 Docker Desktop
   - 等待 Docker 启动完成

3. **运行演示系统**
   ```bash
   cd C:\AFS-System
   docker-compose up -d
   ```
   等待约 1-2 分钟

4. **导入演示数据**
   ```bash
   scripts\import-demo-data.bat
   ```

5. **访问系统**
   - 打开浏览器访问 http://localhost:8080

6. **验证功能**
   ```bash
   scripts\test-demo-functionality.bat
   ```

## 🔧 问题排查

### Docker 无法启动
检查 Docker Desktop 是否安装并运行

### 端口被占用
修改 `docker-compose.yml` 中的端口映射

### 数据导入失败
检查 `afs-demo-backup.tar.gz` 文件是否完整

## ⚠️ 注意事项

- 演示结束后请从演示电脑删除敏感数据
- 移动磁盘请妥善保管
- 演示数据包含用户隐私信息，仅用于演示

## 📞 支持

如遇到问题，请查看 `docs/演示准备指南.md` 详细文档