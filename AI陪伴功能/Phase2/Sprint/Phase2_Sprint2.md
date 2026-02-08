# Phase 2 Sprint 2：角色卡生成器

---

### **Sprint 目标**

实现角色卡生成器，基于用户 A 套题答案，使用 LLM 生成个人画像，并保存到双重存储系统。

---

### **小总结**

本 Sprint 实现核心业务逻辑 - 角色卡生成。包含数据收集、令牌计数、LLM 调用、数据持久化等完整流程。预计时间 15 小时。

---

### **任务列表**

#### **任务 2.1：数据收集模块**（3 小时）

**方法**：扩展 `RoleCardGenerator` 类

**功能**：
1. A 套题进度检查
   - 调用 Answer.getProgress(userId, 'A', 'basic')
   - 判断完成度 >= 80% 可生成

2. A 套题答案收集
   - 查询所有 A 套题答案
   - 按问题顺序排序
   - 返回答案数组

**实施要点**：
- 复用现有 Answer 和 Question 模型
- 进度判断逻辑可配置（默认 80%）
- 错误处理和日志记录

**验收标准**：
- 进度检查正确
- 答案收集完整
- 性能符合预期（<1s）
- 错误处理完善

---

#### **任务 2.2：令牌计数器**（2 小时）

**方法**：扩展 `RoleCardGenerator` 类

**功能**：
1. 简单计数：中文字符 × 1.5 + 英文单词 × 1
2. 缓存机制：避免重复计算
3. 预留扩展：支持 tokenizer API

**实施要点**：
- 字符串分析使用正则表达式
- 缓存基于问题和答案组合
- 日志记录计数结果

**验收标准**：
- 计数准确度合理
- 缓存有效提升性能
- 日志清晰
- 支持扩展到 tokenizer API

---

#### **任务 2.3：个人画像生成**（5 小时）

**方法**：扩展 `RoleCardGenerator` 类

**功能**：
1. 提示词构建
   - 总结 Q&A
   - 包含生成说明
   - JSON 格式要求

2. LLM 调用
   - 使用 MultiLLMClient
   - 控制 maxTokens（1500）和 temperature（0.7）
   - 降级策略自动执行

3. 响应解析
   - JSON 提取
   - 字段完整性验证
   - 默认值填充

4. 陌生人初始好感度计算
   - 基于 personality 关键词调整
   - 范围限制 0-100，默认 50

**实施要点**：
- 提示词模板化，避免硬编码
- 字段验证确保必需字段存在
- 降级策略：API → 本地 Ollama
- 错误处理和重试机制

**验收标准**：
- LLM 调用成功
- 响应解析正确
- 所有字段都有值
- 好感度计算合理
- 错误处理完善

---

#### **任务 2.4：数据持久化**（3 小时）

**方法**：扩展 `RoleCardGenerator` 类

**功能**：
1. 双重存储保存
   - 保存到 MongoDB（User.companionChat.roleCard）
   - 保存到文件系统（/app/storage/userdata/{userId}/rolecard.json）

2. MongoDB 更新
   - 更新 roleCard
   - 更新 currentMode（基于令牌数）
   - 更新 modelStatus.hasBaseModel = true

3. 状态同步
   - 确保两个存储一致
   - 错误回滚机制

**实施要点**：
- 使用 DualStorage.saveAssistantsGuidelines 保存到文件
- 使用 User.updateOne 更新 MongoDB
- 事务概念：先文件后数据库，失败时回滚
- 详细的日志记录

**验收标准**：
- 文件系统保存成功
- MongoDB 更新成功
- 数据一致性验证通过
- 错误处理和回滚有效

---

#### **任务 2.5：API 接口**（2 小时）

**文件**：`server/controllers/companionship.js`、`server/routes/companionship.js`

**API 路由**：
- POST /api/companionship/generate-rolecard
  - 触发角色卡生成
  - 返回生成的角色卡和元数据

**实施要点**：
- 使用 RoleCardGenerator 服务
- 请求验证（userId 必需）
- 进度检查：未完成返回 400
- 错误处理和友好提示

**验收标准**：
- API 正常响应
- 错误提示清晰
- 性能符合预期（<5s）
- 日志记录完善

---

### **文件结构**

```
server/src/services/langchain/
└── roleCardGenerator.js             # 新增

server/controllers/
└── companionship.js                  # 新增

server/routes/
└── companionship.js                    # 新增

tests/integration/
└── roleCardGenerator.test.js         # 新增
```

---

### **依赖关系**

- 依赖：Sprint 1（multiLLMClient、llmConfig）
- 被依赖：Sprint 3（角色卡是对话准则预处理的输入）

---

### **技术要点**

**LLM 调用策略**：
- maxTokens: 1500（控制输出长度）
- temperature: 0.7（平衡创造性和一致性）
- 提示词明确要求 JSON 格式

**角色卡 8 个维度**：
1. personality（性格特点）
2. background（生活背景）
3. interests（兴趣爱好）
4. communicationStyle（沟通风格）
5. values（价值观）
6. emotionalNeeds（情感需求）
7. lifeMilestones（人生里程碑）
8. preferences（偏好）

**好感度计算规则**：
- 开朗/外向：+10
- 内向/安静：-5
- 友善/温和：+10
- 严肃/严厉：-10
- 最终范围：0-100

---

### **时间线**

- Day 1-2：任务 2.1 + 2.2（5 小时）
- Day 3-4：任务 2.3（5 小时）
- Day 5：任务 2.4（3 小时）
- Day 6：任务 2.5 + 集成测试（3 小时）

---

### **风险和缓解**

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 响应格式错误 | 高 | 多重验证、默认值填充、错误重试 |
| A 套题数据不完整 | 中 | 数据清洗、默认值策略 |
| 双重存储不一致 | 高 | 事务概念、详细日志、数据验证 |
| 令牌计数不准确 | 低 | 多种方法、缓存、预留扩展接口 |
| 文件系统权限问题 | 中 | 降级到仅 MongoDB、详细日志 |

---

**END OF SPRINT 2**