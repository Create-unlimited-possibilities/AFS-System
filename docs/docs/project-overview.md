---
id: project-overview
title: 项目概览
sidebar_label: 项目概览
slug: /project-overview
---

# AFS 系统项目概览

## 📋 项目简介

AFS（Advanced Family System）是一个基于Web的家庭互动系统，旨在通过结构化的问题和答案收集，帮助家庭成员更好地了解彼此。系统采用现代化的技术栈，提供完整的用户管理、数据存储和AI辅助功能。

## 🏗️ 技术架构

### 核心组件

- **前端 (client)**: React + TypeScript 构建的现代化用户界面
- **后端服务 (server)**: Node.js + Express 提供API服务
- **数据库服务 (mongoserver)**: MongoDB 存储结构化数据
- **AI模型服务 (modelserver)**: Ollama 提供本地AI模型服务
- **容器化部署**: Docker + Docker Compose 实现一键部署

### 数据存储架构

采用**双重存储架构**，结合MongoDB和文件系统的优势：

- **MongoDB**: 存储用户、问题、答案等结构化数据
- **文件系统**: 存储记忆JSON文件，用于RAG检索和角色卡生成
- **ChromaDB**: 向量数据库，支持语义检索

## 🎯 主要功能

### 1. 用户管理
- 用户注册与登录
- 用户资料管理
- 权限控制

### 2. 问题回答系统
- 多层级问题结构
- 答案提交与保存
- 进度跟踪

### 3. 数据存储
- 双重存储架构
- 数据持久化
- 数据备份与恢复

### 4. AI辅助功能
- RAG检索
- 角色卡生成
- 智能建议

### 5. 可视化展示
- 进度图表
- 数据统计
- 响应式设计

## 📊 项目统计

- **用户数**: 13
- **答案记录**: 270条
- **记忆文件**: 270个JSON
- **存储空间**: MongoDB约XX MB + 文件系统约XX MB

## 🔧 开发环境

- **操作系统**: Windows 10/11
- **开发工具**: VS Code
- **版本控制**: Git
- **容器技术**: Docker Desktop

## 🚀 部署方式

### 本地开发
```bash
cd F:\FPY\AFS-System
docker-compose up -d
```

### 演示环境
使用1TB移动磁盘传输完整项目，包含数据备份和恢复脚本。

## 📚 文档结构

本项目文档采用Docusaurus构建，包含以下主要部分：

- [项目概览](/docs/project-overview)
- [双重存储架构](/docs/dual-storage-architecture)
- [数据存储说明](/docs/data-storage)
- [演示准备指南](/docs/demo-preparation)
- [英文演示脚本指南](/docs/demo-scripts-en)

## 🤝 贡献指南

欢迎提交问题报告和功能建议。请确保：

1. 遵循项目代码规范
2. 添加适当的测试
3. 更新相关文档
4. 提交清晰的commit信息

## 📧 联系方式

- 项目维护者: 项目团队
- 最后更新: 2026-02-03

---

**注意**: 本文档使用Docusaurus构建，支持Markdown格式，易于维护和扩展。