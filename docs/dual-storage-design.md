# 双重存储系统设计文档

## 设计原则

所有网站上生成和获取的资料都应该进入**双重存储系统**：
1. **MongoDB** - 主数据库，用于查询和实时数据
2. **本地文件系统** - 备份存储，用于数据持久化和恢复

只有**RAG记忆库**单独存储在本地文件系统（作为向量索引）。

---

## 存储分类

### 1. 进入双重存储系统的资料

| 资料类型 | MongoDB位置 | 文件系统位置 |
|---------|------------|-------------|
| 用户资料 | `User` 集合 | `/app/storage/userdata/{userId}/profile.json` |
| 角色卡 | `User.chatBeta.roleCard` | `/app/storage/userdata/{userId}/rolecard.json` |
| 协助关系 | `AssistRelation` 集合 | `/app/storage/userdata/{userId}/assist-relations.json` |
| 问答记录 | `Answer` 集合 | `/app/storage/userdata/{userId}/A_set/`, `B_sets/`, `C_sets/` |

### 2. 单独存储在文件系统的资料

| 资料类型 | 文件系统位置 |
|---------|-------------|
| RAG向量索引 | `/app/storage/userdata/chroma_db/user_{userId}` |
| ChromaDB元数据 | `/app/storage/userdata/chroma_db/` |

---

## 文件系统结构

```
/app/storage/userdata/
├── {userId1}/
│   ├── profile.json                    # 用户资料（双重存储）
│   ├── rolecard.json                   # 角色卡（双重存储）
│   ├── assist-relations.json           # 协助关系（双重存储）
│   ├── A_set/                         # A套问题（问答记录，双重存储）
│   │   └── self/
│   │       ├── basic/
│   │       │   ├── question_1.json
│   │       │   └── question_2.json
│   │       └── emotional/
│   │           ├── question_1.json
│   │           └── question_2.json
│   ├── B_sets/                        # B套问题（双重存储）
│   │   ├── {helperId}_{nickname}/
│   │   │   ├── basic/
│   │   │   └── emotional/
│   │   └── {helperId2}_{nickname2}/
│   └── C_sets/                        # C套问题（双重存储）
│       ├── {helperId}_{nickname}/
│       │   ├── basic/
│       │   └── emotional/
│       └── {helperId2}_{nickname2}/
├── {userId2}/
│   └── ...
└── chroma_db/                         # RAG向量索引（文件系统独有）
    ├── chroma.sqlite3
    ├── user_{userId1}/
    │   └── {collection_data}
    └── user_{userId2}/
        └── {collection_data}
```

---

## DualStorage 服务

`server/src/services/dualStorage.js` 提供双重存储功能：

### 主要方法

```javascript
// 角色
saveRoleCard(userId, roleCard)      // 保存角色卡到文件系统
loadRoleCard(userId)                // 从文件系统加载角色卡

// 用户资料
saveUserProfile(userId, userData)     // 保存用户资料到文件系统
loadUserProfile(userId)              // 从文件系统加载用户资料

// 协助关系
saveAssistRelation(userId, relation) // 保存协助关系到文件系统
loadAssistRelations(userId)         // 从文件系统加载协助关系

// 数据管理
deleteUserFiles(userId)              // 删除用户的所有文件系统数据
```

---

## 实现示例

### 示例1：角色卡生成（双重存储）

```javascript
// 1. 生成角色卡
const roleCard = await roleCardGenerator.generateRoleCard(userId);

// 2. 存储到MongoDB
await User.findByIdAndUpdate(userId, {
  $set: { 'chatBeta.roleCard': roleCard }
});

// 3. 存储到文件系统
await dualStorage.saveRoleCard(userId, roleCard);

// 4. 触发RAG索引重建
await vectorService.rebuildIndex(userId);
```

### 示例2：用户注册（双重存储）

```javascript
// 1. 创建用户
const user = new User({ email, password, name });
await user.save();

// 2. 保存用户资料到文件系统
await dualStorage.saveUserProfile(user._id, {
  id: user._id,
  email: user.email,
  name: user.name,
  uniqueCode: user.uniqueCode,
  createdAt: user.createdAt
});
```

### 示例3：协助关系创建（双重存储）

```javascript
// 1. 创建协助关系到MongoDB
const relation = new AssistRelation(relationData);
await relation.save();

// 2. 保存协助关系到文件系统
await dualStorage.saveAssistRelation(relation.assistantId, {
  relationId: relation._id,
  targetId: relation.targetId,
  relationshipType: relation.relationshipType,
  specificRelation: relation.specificRelation,
  createdAt: relation.createdAt
});
```

---

## 数据同步策略

### 写入顺序

1. **优先写入MongoDB** - 确保数据一致性
2. **异步写入文件系统** - 不影响用户响应速度
3. **记录错误** - 如果文件系统写入失败，记录日志但不中断流程

### 读取策略

1. **优先从MongoDB读取** - 主数据源
2. **文件系统作为备份** - 数据恢复使用
3. **定期同步检查** - 检查数据一致性

---

## 数据恢复流程

### 场景：MongoDB数据丢失

1. 扫描文件系统，恢复用户资料
2. 从 `profile.json` 重建User文档
3. 从 `rolecard.json` 恢复角色卡
4. 从 `assist-relations.json` 恢复协助关系
5. 从问答记录JSON文件恢复Answer文档

### 场景：文件系统数据丢失

1. 从MongoDB导出用户数据
2. 重新生成文件系统文件
3. 重新构建RAG索引

---

## 文件修改清单

### 新增文件

1. `server/src/services/dualStorage.js` - 双重存储服务
2. `docs/dual-storage-design.md` - 本文档

### 修改文件

1. `server/src/routes/chatbeta.js`
   - 导入DualStorage
   - 角色卡生成时使用双重存储
   - 角色卡更新时使用双重存储

2. `server/src/services/roleCardGenerator.js`
   - 修复返回对象结构

### 待修改文件（建议）

1. `server/src/routes/auth/auth.js`
   - 注册时保存用户资料到文件系统

2. `server/src/routes/auth/assist.js`
   - 创建协助关系时保存到文件系统

3. `server/src/services/assistService.js`
   - 集成DualStorage

---

## 性能考虑

- **文件系统写入**：异步执行，不阻塞响应
- **MongoDB优先**：读取优先从MongoDB
- **错误处理**：文件系统失败不影响主流程
- **定期清理**：定期删除过期或无效的文件

---

## 安全考虑

- **文件权限**：限制文件系统访问权限
- **路径验证**：防止目录遍历攻击
- **数据加密**：敏感数据考虑加密存储
- **备份策略**：定期备份文件系统数据
