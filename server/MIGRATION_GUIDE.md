# 数据迁移到新的双重存储系统

## 概述
将现有的MongoDB答案数据同步到新的文件系统存储中。

## 迁移步骤

### 1. 确认数据存在

```bash
# 检查MongoDB中的答案数量
docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.answers.countDocuments()"
```

### 2. 执行迁移

```bash
# 在server容器中执行迁移脚本
docker exec -it afs-system-server-1 node migrate-to-new-storage.js
```

### 3. 验证迁移结果

```bash
# 查看文件系统中的用户数据
docker exec afs-system-server-1 ls -la /app/storage/userdata

# 检查特定用户的记忆文件
docker exec afs-system-server-1 find /app/storage/userdata -name "*.json" | head -10
```

## 迁移脚本功能

- ✓ 从MongoDB读取所有Answer记录
- ✓ 关联Question和User信息
- ✓ 将数据写入文件系统（按目录结构）
- ✓ 自动处理用户自己回答和协助回答的区别
- ✓ 进度显示（每50条记录）
- ✓ 错误统计和报告

## 文件系统结构

```
/app/storage/userdata/
└── {userId}/
    ├── A_set/
    │   └── self/
    │       ├── basic/
    │       │   └── question_{order}.json
    │       └── emotional/
    │           └── question_{order}.json
    ├── B_sets/
    │   └── {helperId}_{helperName}/
    │       ├── basic/
    │       └── emotional/
    └── C_sets/
        └── {helperId}_{helperName}/
            ├── basic/
            └── emotional/
```

## 注意事项

1. **仅执行一次** - 迁移脚本会覆盖已存在的文件
2. **备份数据** - 执行前建议备份MongoDB数据
3. **停止服务** - 迁移期间建议停止前端访问，避免数据不一致
4. **检查结果** - 迁移完成后检查成功/失败数量

## 回滚方法

如果迁移有问题，可以：
1. 重新运行迁移脚本（会覆盖）
2. 或删除文件系统数据重新迁移

```bash
# 删除文件系统数据
docker exec afs-system-server-1 rm -rf /app/storage/userdata/*
```

## 故障排查

### 连接失败
```bash
# 检查MongoDB连接
docker exec afs-system-server-1 cat /app/.env | grep MONGO_URI
```

### 权限错误
```bash
# 检查文件系统权限
docker exec afs-system-server-1 ls -la /app/storage/
```

### 数据缺失
```bash
# 检查MongoDB数据
docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.answers.countDocuments()"
```
