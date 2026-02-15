---
id: demo-preparation
title: 演示准备指南
sidebar_label: 演示准备指南
slug: /demo-preparation
---

# AFS 系统演示准备完整指南

## 📋 说明

本文档详细说明如何将已开发的 AFS 系统（包含用户数据和答案）从本机迁移到演示环境（如学校电脑），包括数据导出、传输和导入的完整流程。

## 🎯 适用场景

- 本机开发完成，需要在其他电脑演示
- 演示电脑已安装 Docker 环境
- 演示需要展示完整系统功能及用户数据
- 使用 1T 容量移动磁盘传输

## 📊 测试环境要求

### 本机要求
- Windows 操作系统
- Docker Desktop 已安装并运行
- AFS 系统项目完整可用

### 演示环境要求
- Windows 操作系统（建议 Windows 10/11）
- Docker Desktop 已安装
- 至少 8GB 可用内存
- 10GB 可用磁盘空间

## 📁 文件结构

### 项目目录
```
AFS-System/
├── .gitignore
├── docker-compose.yml
├── client/
├── server/
├── mongoserver/
├── modelserver/
├── scripts/
│   ├── export-demo-data.bat
│   ├── import-demo-data.bat
│   ├── verify-backup.bat
│   └── test-demo-functionality.bat
├── docs/
│   └── 演示准备指南.md
└── afs-demo-backup.tar.gz
```

### 移动磁盘目录
```
移动磁盘根目录/
├── AFS-System/
├── afs-demo-backup.tar.gz
├── docs/
│   └── 演示准备指南.md
└── README.md
```

## 📦 第一阶段：本机数据导出

### 1. 确保系统正常运行

#### 检查 Docker 运行状态
```bash
docker --version
docker ps
```

#### 检查容器状态
```bash
cd F:\FPY\AFS-System
docker-compose ps
```

#### 验证数据库数据
```bash
docker exec -it afs-system-mongoserver-1 mongosh afs_db
> db.users.countDocuments()
> exit
```

### 2. 导出演示数据

#### 使用自动化脚本导出
```bash
cd F:\FPY\AFS-System
scripts\export-demo-data.bat
```

### 3. 验证备份完整性

```bash
scripts\verify-backup.bat
```

### 4. 运行功能测试

```bash
scripts\test-demo-functionality.bat
```

### 5. 复制到移动磁盘

将项目目录和 afs-demo-backup.tar.gz 复制到 1T 移动磁盘

## 🏫 第二阶段：演示现场部署

### 1. 复制项目到演示电脑

从移动磁盘复制 AFS-System/ 到 C:\

### 2. 检查演示环境

```bash
docker --version
docker ps
```

### 3. 启动 AFS 系统

```bash
cd C:\AFS-System
docker-compose up -d
timeout /t 120 /nobreak
```

### 4. 导入演示数据

```bash
scripts\import-demo-data.bat afs-demo-backup.tar.gz
```

### 5. 验证演示数据

```bash
scripts\test-demo-functionality.bat
```

### 6. 访问演示系统

打开浏览器访问：http://localhost:8080

## 🧪 第三阶段：演示前测试

### 运行自动化测试脚本

```bash
scripts\test-demo-functionality.bat
```

### 手动测试关键功能

1. 用户登录测试
2. 问题回答功能
3. 进度显示
4. 数据持久化
5. 响应式设计

## 🎯 第四阶段：正式演示

### 演示准备工作

- [ ] 系统已启动并运行
- [ ] 演示数据已导入
- [ ] 自动化测试全部通过
- [ ] 浏览器已打开系统主页
- [ ] 已准备好演示流程
- [ ] 备用方案已准备

### 演示流程建议

1. 介绍项目背景
2. 展示系统架构
3. 用户登录流程
4. 问题回答功能
5. 数据持久化
6. 技术亮点展示
7. 问答阶段

## 🧹 第五阶段：演示后清理

### 删除演示数据

```bash
docker-compose down
docker-compose down -v
docker system prune -a
```

### 删除项目文件

```bash
rmdir /s /q C:\AFS-System
```

### 隐私保护

确保所有演示数据已删除：
```bash
docker volume rm $(docker volume ls -q | grep afs)
```

## 🚨 紧急情况处理

### Docker 无法启动
重启 Docker Desktop

### 数据导入失败
使用 verify-backup.bat 检查文件完整性

### 端口被占用
修改 docker-compose.yml 中的端口映射

## 📞 技术支持信息

### Docker 常用命令
```bash
docker ps
docker-compose ps
docker-compose up -d
docker-compose down
docker logs <container>
```

### MongoDB 常用命令
```bash
docker exec -it afs-system-mongoserver-1 mongosh afs_db
db.getCollectionNames()
db.users.find().limit(10)
```

### 重要路径

- 数据库主机：localhost:27018
- 数据库名：afs_db
- 前端地址：http://localhost:8080
- API 地址：http://localhost:3001

---

**文档版本**: 1.0  
**最后更新**: 2024年2月1日