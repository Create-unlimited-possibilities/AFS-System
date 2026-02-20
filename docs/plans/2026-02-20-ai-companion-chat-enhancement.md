# AI 陪伴聊天功能增强计划

## 日期
2026-02-20

## 当前状态

### 后端 (已完成)
- ✅ LangGraph 风格编排系统 (`orchestrator.js`)
- ✅ 角色卡 V2 动态组装 (`assembler.js`)
- ✅ ChromaDB 向量记忆检索 (`chroma.js`)
- ✅ LLM 集成 (Ollama + ChatOllama)
- ✅ Token 监控 (60% 警告, 70% 终止)
- ✅ 会话管理 (30 分钟超时)
- ✅ 协助者关系检查 (`AssistRelation`)

### 前端 (待修复)
- ⚠️ `/chat/new` - 有输入框但没调用 API
- ⚠️ 侧边栏 - 显示假数据
- ❌ `/chat/[sessionId]` - 路由不存在 (404)

---

## 用户设计方案

### 流程
1. 用户 B 输入用户 A 的特殊编号（类似加好友）
2. 检测用户 A 是否有角色卡
3. 检测用户 B 是否为协助者（目前仅支持协助者对话）
4. 若满足条件，侧边栏显示用户 A 的名字
5. 点击后展开对话（WhatsApp 风格界面）

### 差距分析
| 功能 | 状态 | 改动量 |
|------|------|--------|
| 输入编号 + 调用 API | 需修复 | 小 |
| 检测目标用户角色卡 | 需添加 | 小 |
| 检测协助者关系 | ✅ 已有 | 无 |
| 侧边栏用户列表 | 需添加 | 中 |
| 聊天页面路由 | 需添加 | 小 |
| WhatsApp 风格 UI | 需改进 | 中 |

---

## 三项增强架构（后续实现）

### 1. 记忆检索更智能
- **多轮对话记忆关联** - 根据对话上下文动态调整检索策略
- **时间权重** - 最近记忆权重更高
- **情感关联** - 根据对话情感色彩检索相关记忆
- **话题追踪** - 连续对话中保持话题连贯性

### 2. 对话体验更自然
- **情感连贯** - 保持对话中的情感状态一致性
- **主动提问** - AI 主动发起话题延伸
- **话题延伸** - 根据用户兴趣自然过渡话题
- **个性化开场** - 根据关系类型定制问候语

### 3. 个性化程度更深
- **角色卡特征调整** - 根据角色卡动态调整回复风格
  - `communicationStyle` → 语气、用词
  - `personality` → 性格表现
  - `emotionalNeeds` → 情感回应方式
- **关系层适配** - 根据具体关系调整互动模式
  - 家人 vs 朋友 vs 陌生人
- **动态角色卡更新** - 根据对话积累持续优化

---

## 实施计划

### Phase 1: 最小可用修复 (当前)
1. 修复 `/chat/[sessionId]` 路由
2. 让 `/chat/new` 正确调用后端 API
3. 确保基础对话功能可用

### Phase 2: 完善用户设计
1. 添加目标用户角色卡检测
2. 实现侧边栏用户列表
3. WhatsApp 风格聊天界面

### Phase 3: 三项增强
1. 智能记忆检索
2. 自然对话体验
3. 深度个性化

---

## 技术参考

### 关键文件
- `server/src/modules/chat/orchestrator.js` - 对话编排
- `server/src/modules/chat/controller.js` - API 控制器
- `server/src/modules/chat/nodes/ragRetriever.js` - 记忆检索
- `server/src/modules/chat/nodes/responseGenerator.js` - 响应生成
- `web/app/chat/new/page.tsx` - 创建会话页面
- `web/app/chat/page.tsx` - 聊天页面（需重构）

### API 端点
- `POST /api/chat/sessions/by-code` - 通过编号创建会话
- `POST /api/chat/sessions/:sessionId/messages` - 发送消息
- `GET /api/chat/sessions/:sessionId/messages` - 获取历史
- `POST /api/chat/sessions/:sessionId/end` - 结束会话
- `GET /api/chat/sessions/active` - 获取活跃会话
