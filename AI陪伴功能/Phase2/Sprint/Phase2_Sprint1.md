# Phase 2 Sprint 1：基础架构和 LLM 配置

---

### **Sprint 目标**

建立 Phase 2 的基础架构，实现 LLM 配置管理和统一调用接口，支持 API KEY 和本地 Ollama 两种方式。

---

### **小总结**

本 Sprint 主要搭建基础设施，不涉及业务逻辑。实现 LLM 配置管理器、多 LLM 客户端，为后续的角色卡生成和对话准则预处理提供统一的 LLM 调用能力。预计时间 8 小时。

---

### **任务列表**

#### **任务 1.1：LLM 配置管理器**（2 小时）

**文件**：`server/src/services/langchain/llmConfig.js`

**功能**：
- 环境变量检测和验证
- 配置结构定义
- 降级策略配置
- 配置验证方法

**实施要点**：
- 使用 dotenv 加载环境变量
- 配置 USE_API_LLM、API_LLM_KEY 等环境变量
- 降级策略支持 api-local、local-api、none 三种
- 配置验证确保至少一种方式可用

**验收标准**：
- 环境变量正确加载
- 配置验证通过
- 降级策略正常工作
- 日志输出清晰

---

#### **任务 1.2：多 LLM 客户端**（4 小时）

**文件**：`server/src/services/langchain/multiLLMClient.js`

**功能**：
- 统一的 LLM 调用接口
- API 客户端初始化（占位）
- 本地 Ollama 客户端初始化
- 自动降级机制
- 流式生成支持

**实施要点**：
- 复用现有的 LLMClient
- API 客户端先实现占位，后续扩展
- 降级策略基于配置自动执行
- 错误处理和日志记录

**验收标准**：
- generate() 方法正常工作
- 降级机制有效
- 错误处理完善
- 日志输出清晰

---

#### **任务 1.3：集成测试**（2 小时）

**文件**：`server/tests/integration/llmConfig.test.js`

**测试场景**：
- 环境变量加载测试
- 配置验证测试
- 降级策略测试
- 生成功能测试

**实施要点**：
- 使用内存数据库
- 测试不同配置组合
- 验证降级逻辑
- 性能基准测试

**验收标准**：
- 所有测试通过
- 覆盖率 80%+
- 性能符合预期

---

#### **任务 1.4：文档和配置示例**（2 小时）

**文件**：`.env.example`

**内容**：
- 环境变量示例
- 配置说明文档
- 使用指南

**实施要点**：
- 提供完整的配置示例
- 文档说明清楚
- 包含降级策略说明

**验收标准**：
- 配置文件完整
- 文档清晰易懂
- 示例可直接使用

---

### **文件结构**

```
server/src/services/langchain/
├── llmConfig.js                    # 新增
└── multiLLMClient.js                # 新增

server/tests/integration/
└── llmConfig.test.js                # 新增

.env.example                             # 新增
```

---

### **依赖关系**

- 依赖：无（基础设施）
- 被依赖：Sprint 2、Sprint 3

---

### **技术要点**

**LLM 配置**：
- 优先使用 API KEY（USE_API_LLM=true）
- 降级到本地 Ollama（USE_API_LLM=false 或 API 失败）
- 本地 Ollama 配置：OLLAMA_BASE_URL、OLLAMA_MODEL、OLLAMA_MODEL_PATH

**降级策略**：
- api-local：优先 API，失败后本地
- local-api：优先本地，失败后 API
- none：只使用配置的方式

---

### **时间线**

- Day 1-2：任务 1.1 + 1.2（6 小时）
- Day 3：任务 1.3（2 小时）
- Day 4：任务 1.4（2 小时）

---

### **风险和缓解**

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 环境变量配置错误 | 高 | 提供详细配置示例和文档 |
| 本地 Ollama 连接失败 | 中 | 提供清晰的错误信息和降级策略 |
| API 客户端未实现 | 低 | 本地 Ollama 作为主要方式，占位 API |
| 测试环境不一致 | 低 | 使用内存数据库确保一致性 |

---

**END OF SPRINT 1**