# Phase 2 Sprint 3：协助者对话准则预处理器

---

### **Sprint 目标**

实现协助者对话准则预处理器，收集并预处理所有协助者的对话准则，使用 LLM 压缩答案并生成对话准则，保存到双重存储系统。

---

### **小总结**

本 Sprint 实现第二个核心业务逻辑 - 对话准则预处理。包含关系获取、答案收集、答案压缩、准则生成、双重存储保存等完整流程。预计时间 15 小时。

---

### **任务列表**

#### **任务 3.1：协助者关系获取**（2 小时）

**方法**：扩展 `AssistantsGuidelinesPreprocessor` 类

**功能**：
1. 获取所有协助者关系
   - 查询 AssistRelation.find({ assistantId: userId })
   - populate 目标用户信息
   - 过滤已回答了问题的协助者

2. 数据分组和排序
   - 按 relationshipType 分组
   - 按 guidelinesGenerated 排序（未生成的优先）

**实施要点**：
- 复用现有 AssistRelation 模型
- 使用 populate 获取关联数据
- 添加 answerSummary 字段到返回结果

**验收标准**：
- 关系查询正确
- 数据过滤有效
- 排序逻辑正确
- 性能符合预期

---

#### **任务 3.2：B/C 套题答案收集**（3 小时）

**方法**：扩展 `AssistantsGuidelinesPreprocessor` 类

**功能**：
1. B 套题答案收集（basic 层）
   - Answer.aggregate 按 questionId 分组
   - 每个问题收集所有回答

2. C 套题答案收集（emotional 层）
   - Answer.aggregate 按 questionId 分组
   - 每个问题收集所有回答

3. 答案数据处理
   - 提取关键信息
   - 过滤无效回答
   - 去重

**实施要点**：
- 使用 MongoDB aggregation 优化查询
- 分组逻辑确保正确聚合
- 数据清洗和验证

**验收标准**：
- B/C 套题收集正确
- 聚合查询高效
- 数据质量验证通过
- 性能符合预期

---

#### **任务 3.3：答案压缩**（5 小时）

**方法**：扩展 `AssistantsGuidelinesPreprocessor` 类

**功能**：
1. 压缩提示词构建
   - 问题文本 + 多个答案
   - 角色卡参考信息
   - 压缩要求说明

2. LLM 压缩
   - 使用 MultiLLMClient
   - 每个 questionId 一个 LLM 调用
   - 串行处理，避免并发压力

3. 压缩结果解析
   - 提取关键点（2-5 个）
   - 原始答案保留
   - 压缩时间记录

**实施要点**：
- 提示词明确要求 2-5 个关键点
- 串行处理，逐个压缩
- 错误时保留原始答案
- 压缩结果记录详细日志

**验收标准**：
- LLM 调用成功
- 压缩质量合理
- 原始答案保留
- 错误处理完善

---

#### **任务 3.4：对话准则生成**（3 小时）

**方法**：扩展 `AssistantsGuidelinesPreprocessor` 类

**功能**：
1. 准则生成提示词构建
   - 协助者基本信息
   - 目标用户角色卡
   - 压缩答案摘要
   - 生成要求（300-600 字）

2. LLM 生成
   - 使用 MultiLLMClient
   - 控制 maxTokens（1000）和 temperature（0.7）
   - 降级策略自动执行

3. 准则格式化
   - 300-600 字对话准则
   - 语气、风格、话题建议

**实施要点**：
- 提示词模板化
- 降级策略：API → 本地 Ollama
- 生成后检查长度和格式

**验收标准**：
- LLM 调用成功
- 准则长度符合要求
- 内容逻辑清晰
- 错误处理完善

---

#### **任务 3.5：双重存储保存**（2 小时）

**方法**：扩展 `AssistantsGuidelinesPreprocessor` 类

**功能**：
1. 单个准则保存
   - 保存到文件系统
   - 更新 MongoDB 单个准则

2. 批量保存
   - 保存所有准则到文件
   - 更新 MongoDB 所有准则

3. 状态标记
   - 更新 AssistRelation.guidelinesGenerated = true
   - 更新 User.companionChat.modelStatus.hasBaseModel = true

**实施要点**：
- 使用 DualStorage 的 saveAssistantsGuidelines 方法
- MongoDB 使用 updateMany 批量更新
- 错误处理和回滚

**验收标准**：
- 文件系统保存成功
- MongoDB 更新成功
- 状态标记正确
- 错误处理完善

---

### **文件结构**

```
server/src/services/langchain/
└── assistantsGuidelinesPreprocessor.js  # 新增

tests/integration/
└── assistantsGuidelinesPreprocessor.test.js  # 新增
```

---

### **依赖关系**

- 依赖：Sprint 1（multiLLMClient）、Sprint 2（RoleCardGenerator）
- 被依赖：Sprint 4（API 路由整合）

---

### **技术要点**

**答案压缩策略**：
- 每个 questionId 压缩一次
- 提取 2-5 个关键点
- 原始答案保留，便于调试
- 压缩结果包含 originalAnswer

**对话准则生成规则**：
- 长度：300-600 字
- 语气：温和、友好
- 风格：适合日常对话
- 话题：3-5 条建议和避免

**降级策略**：
- API LLM 优先（响应快、质量高）
- 本地 Ollama 作为降级（免费、可控）
- 压缩和准则生成都支持降级

---

### **时间线**

- Day 1-2：任务 3.1 + 3.2（5 小时）
- Day 3-4：任务 3.3（5 小时）
- Day 5：任务 3.4（3 小时）
- Day 6：任务 3.5 + 集成测试（2 小时）

---

### **风险和缓解**

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| B/C 套题答案过多 | 高 | 串行处理、分批加载 |
| LLM 压缩效果不佳 | 中 | 优化提示词、多轮测试 |
| 双重存储不一致 | 高 | 事务概念、数据验证 |
| 大量 LLM 调用超时 | 中 | 设置合理超时、降级策略 |

---

**END OF SPRINT 3**