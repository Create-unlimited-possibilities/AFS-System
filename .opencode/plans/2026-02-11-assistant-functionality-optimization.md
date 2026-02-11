# 协助者功能优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化协助者功能，支持通过专属编号验证身份、选择关系类型、回答对应问题套（B套/C套），并正确存储到目标用户的档案中。

**Architecture:** 修改Answer模型添加关联字段，后端API添加重复关系验证和问题过滤逻辑，前端UI分离协助回答页面，双重存储路径根据问题套自动映射。

**Tech Stack:** Node.js + Express + MongoDB + Next.js + TypeScript

---

## 背景信息

### 问题套映射
| 问题套 | role字段 | 问题角色 | 文件存储路径 |
|-------|----------|---------|--------------|
| A套题 | "elder" | 老年人自己 | `{userId}/A_set/basic\|emotional\` |
| B套题 | "family" | 家人 | `{targetUserId}/Bste/helper_{helperId}/basic\|emotional\` |
| C套题 | "friend" | 朋友 | `{targetUserId}/Cste/helper_{helperId}/basic\|emotional\` |

### Answer模型字段变化
**删除字段：**
- `relationshipType` (通过assistRelationId关联查询)

**新增字段：**
- `assistRelationId` - 关联的AssistRelation记录ID
- `specificRelation` - 具体关系描述（妻子/女儿/朋友等）

---

## 任务分解

### Task 1: 修改Answer模型 - 添加关联字段

**文件：**
- Modify: `server/src/models/Answer.js`

**Step 1: 修改Answer模型**

删除 `relationshipType` 字段，添加 `assistRelationId` 和 `specificRelation` 字段。

**Step 2: 更新静态方法getAnswerStats**

修改聚合查询，使用 `$lookup` 通过 `assistRelationId` 获取 `relationshipType`。

**Step 3: 验证模型编译**

运行测试确保模型修改没有破坏现有功能。

---

### Task 2: 添加协助关系重复验证

**文件：**
- Modify: `server/src/services/assistService.js`
- Modify: `server/src/controllers/AssistController.js`

**Step 1: 在assistService中添加验证方法**

```javascript
async checkDuplicateRelation(assistantId, targetId) {
  const existingRelation = await AssistRelation.findOne({
    assistantId,
    targetId,
    isActive: true
  });

  if (existingRelation) {
    throw new Error('该用户已在您的协助列表中');
  }

  return false;
}
```

**Step 2: 在createRelation方法中调用验证**

在创建关系前调用 `checkDuplicateRelation` 方法。

**Step 3: 更新前端提示信息**

当返回重复关系错误时，前端提示"目标用户已被添加"。

---

### Task 3: 修改AnswerService - 保存协助答案

**文件：**
- Modify: `server/src/services/AnswerService.js`

**Step 1: 修改saveAssistAnswer方法**

添加 `assistRelationId` 和 `specificRelation` 字段到新答案中。

```javascript
const newAnswer = await this.answerRepository.create({
  userId,
  targetUserId,
  questionId,
  questionLayer: question.layer,
  answer,
  isSelfAnswer: false,
  assistRelationId: relation._id,
  specificRelation: relation.specificRelation
});
```

**Step 2: 修改batchSaveAssistAnswers方法**

在bulkWrite操作中添加新字段。

```javascript
replacement: {
  // ... 其他字段
  assistRelationId: relation._id,
  specificRelation: relation.specificRelation,
  updatedAt: new Date()
}
```

**Step 3: 修改现有答案更新逻辑**

在 `saveAssistAnswer` 和 `batchSaveAssistAnswers` 的更新分支中添加新字段。

---

### Task 4: 添加获取协助问题API

**文件：**
- Modify: `server/src/controllers/AnswerController.js`
- Modify: `server/src/services/AnswerService.js`

**Step 1: 在AnswerService中添加方法**

```javascript
async getAssistQuestions(userId, targetUserId, relationType) {
  return await Question.find({
    role: relationType,
    active: true
  }).sort({ layer: 1, order: 1 });
}
```

**Step 2: 在AnswerController中添加端点**

```javascript
async getAssistQuestions(req, res) {
  const { targetUserId } = req.query;
  const userId = req.user.id;

  // 验证协助关系
  const relation = await AssistRelation.findOne({
    assistantId: userId,
    targetId: targetUserId,
    isActive: true
  });

  if (!relation) {
    return res.status(403).json({
      success: false,
      error: '您没有协助该用户的权限'
    });
  }

  // 根据关系类型获取对应问题
  const questions = await Question.find({
    role: relation.relationshipType,
    active: true
  }).sort({ layer: 1, order: 1 });

  // 获取已回答的问题
  const answeredQuestions = await answerService.getAssistAnswers(userId, targetUserId);

  const answerMap = {};
  answeredQuestions.forEach(a => {
    const questionId = a.questionId._id ? a.questionId._id.toString() : a.questionId.toString();
    answerMap[questionId] = a.answer;
  });

  const formattedQuestions = questions.map(q => ({
    _id: q._id.toString(),
    order: q.order,
    category: q.layer,
    questionText: q.question,
    questionType: q.type || 'textarea',
    placeholder: q.placeholder || '',
    answer: answerMap[q._id.toString()] || ''
  }));

  res.json({
    success: true,
    data: {
      questions: formattedQuestions,
      targetUser: relation.targetId,
      relationType: relation.relationshipType,
      specificRelation: relation.specificRelation
    }
  });
}
```

**Step 3: 添加路由**

在 `server/src/routes/answers.js` 中添加：

```javascript
router.get('/questions/assist', protect, (req, res) => {
  answerController.getAssistQuestions(req, res);
});
```

**Step 4: 添加getAssistAnswers方法**

在AnswerService中添加获取已回答的协助问题方法。

---

### Task 5: 修改getAnswersFromOthers方法

**文件：**
- Modify: `server/src/services/AnswerService.js`

**Step 1: 查询时populate assistRelationId**

```javascript
const answers = await this.answerRepository.find({
  targetUserId: targetUserId,
  userId: { $ne: targetUserId }
}).populate('assistRelationId');
```

**Step 2: 从assistRelation获取关系类型和具体关系**

```javascript
const relationshipType = answer.assistRelationId?.relationshipType || 'unknown';
const specificRelation = answer.assistRelationId?.specificRelation || '';
```

**Step 3: 更新groupedByContributor对象**

添加 `specificRelation` 字段到返回数据。

---

### Task 6: 添加删除协助者答案方法

**文件：**
- Modify: `server/src/services/AnswerService.js`
- Modify: `server/src/controllers/AssistController.js`

**Step 1: 在AnswerService中添加方法**

```javascript
async deleteAssistAnswers(assistRelationId) {
  return await this.answerRepository.deleteMany({
    assistRelationId: assistRelationId
  });
}
```

**Step 2: 在AssistController中调用**

在 `deleteRelation` 方法中添加删除关联答案的逻辑。

---

### Task 7: 前端 - 修改协助页面

**文件：**
- Modify: `web/app/assist/page.tsx`

**Step 1: 修改用户搜索逻辑**

使用专属编号搜索用户。

```typescript
const handleSearchUser = async () => {
  if (!searchCode) return;

  try {
    const res = await api.get<{ user: any }>(`/auth/assist/search?code=${searchCode}`);
    if (res.success && res.data?.user) {
      setFoundUser(res.data.user);
    } else {
      alert('未找到该用户');
      setFoundUser(null);
    }
  } catch (error) {
    console.error('搜索用户失败:', error);
    alert('搜索失败，请检查编号是否正确');
  }
};
```

**Step 2: 添加关系类型选择**

添加Radio按钮或Select选择family/friend。

**Step 3: 添加具体关系输入框**

添加文本输入框让用户填写具体关系。

**Step 4: 添加"回答问题"按钮**

在每个被协助者卡片旁边添加按钮，点击跳转到 `/questions/assist?targetId=xxx`。

---

### Task 8: 前端 - 创建协助回答页面

**文件：**
- Create: `web/app/questions/assist/page.tsx`

**Step 1: 创建页面组件**

复制 `/questions/page.tsx` 的结构，修改数据获取逻辑。

**Step 2: 从URL获取targetId**

```typescript
const searchParams = useSearchParams();
const targetId = searchParams.get('targetId');
```

**Step 3: 调用getAssistQuestions API**

```typescript
const fetchQuestions = async () => {
  const res = await api.get(`/answers/questions/assist?targetUserId=${targetId}`);
  if (res.success) {
    setQuestions(res.data.questions);
    setTargetUser(res.data.targetUser);
    setRelationType(res.data.relationType);
    setSpecificRelation(res.data.specificRelation);
  }
};
```

**Step 4: 保存答案时调用saveAssistAnswer API**

```typescript
const handleSaveAnswer = async (questionId: string, answer: string) => {
  await api.post('/answers/assist', {
    targetUserId: targetId,
    questionId,
    answer
  });
};
```

**Step 5: 添加返回按钮**

返回到协助关系页面。

---

### Task 9: 前端类型定义更新

**文件：**
- Modify: `web/types/index.ts`

**Step 1: 更新Answer接口**

```typescript
export interface Answer {
  _id: string;
  userId: string;
  targetUserId: string;
  questionId: string;
  question?: Question;
  questionLayer: 'basic' | 'emotional';
  answer: string;
  isSelfAnswer: boolean;
  assistRelationId?: string;  // 新增
  specificRelation?: string;   // 新增
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: 更新AssistRelation接口**

确保与后端一致。

---

### Task 10: 验证双重存储路径

**文件：**
- Test: 手动测试

**Step 1: 测试A套题保存**

用户A回答A套题，验证文件保存到 `{userId}/A_set/basic\|emotional\`

**Step 2: 测试B套题保存**

用户B（family）回答A的B套题，验证文件保存到 `{targetUserId}/Bste/helper_{userId}/basic\|emotional\`

**Step 3: 测试C套题保存**

用户C（friend）回答A的C套题，验证文件保存到 `{targetUserId}/Cste/helper_{userId}/basic\|emotional\`

---

### Task 11: 数据迁移脚本

**文件：**
- Create: `server/scripts/migrate-answer-relation.js`

**Step 1: 创建迁移脚本**

将现有的 `relationshipType` 数据迁移到新的 `assistRelationId` 和 `specificRelation` 字段。

**Step 2: 备份数据**

在迁移前备份MongoDB数据。

**Step 3: 执行迁移**

运行迁移脚本，更新Answer集合。

**Step 4: 验证数据**

验证迁移后的数据完整性。

---

## 测试计划

### 单元测试

1. **Answer模型测试**
   - 验证新增字段的Schema定义
   - 测试索引是否正确创建

2. **assistService测试**
   - 测试重复关系验证逻辑
   - 测试创建关系成功场景

3. **AnswerService测试**
   - 测试saveAssistAnswer是否保存新字段
   - 测试getAnswersFromOthers是否正确关联查询
   - 测试deleteAssistAnswers是否正确删除

### 集成测试

1. **协助关系创建流程**
   - 搜索用户（通过专属编号）
   - 选择关系类型
   - 填写具体关系
   - 验证重复关系被拒绝

2. **协助回答流程**
   - 进入协助回答页面
   - 验证只显示对应role的问题
   - 保存答案
   - 验证答案正确保存到目标用户档案

3. **数据存储验证**
   - 验证MongoDB中answer记录包含新字段
   - 验证文件系统路径正确
   - 验证token计数正确更新

### 端到端测试

1. **完整协助流程**
   - 用户B搜索用户A（通过专属编号）
   - 创建family关系（妻子）
   - 回答B套题
   - 验证用户A查看答案能看到妻子的回答

2. **多协助者场景**
   - 用户B（family）和用户C（friend）同时协助用户A
   - 验证两者的答案分别保存在B套和C套
   - 验证用户A能区分查看两人的答案

---

## 风险和注意事项

### 数据迁移风险
- 现有Answer记录中的 `relationshipType` 需要迁移
- 如果AssistRelation记录不存在，数据可能丢失
- **缓解措施**：执行前备份，保留 `relationshipType` 作为过渡字段

### 文件存储路径变更
- 现有文件路径与新路径可能不一致
- **缓解措施**：fileStorage.js已实现路径映射逻辑，无需手动迁移

### 向后兼容性
- 前端需要更新以支持新字段
- 旧版本API调用可能失败
- **缓解措施**：保留旧API端点一段时间

---

## 实施顺序

1. **后端模型和服务** (Task 1-6)
   - 优先修改数据模型
   - 然后修改服务和控制器

2. **数据迁移** (Task 11)
   - 在前端更新前执行数据迁移
   - 确保现有数据与新结构兼容

3. **前端UI更新** (Task 7-9)
   - 更新协助页面
   - 创建协助回答页面
   - 更新类型定义

4. **测试验证** (Task 10)
   - 手动测试双重存储路径
   - 运行自动化测试

---

## 完成标准

- [ ] Answer模型包含 `assistRelationId` 和 `specificRelation` 字段
- [ ] 创建协助关系时验证重复
- [ ] 协助回答页面只显示对应role的问题
- [ ] 答案保存时包含 `assistRelationId` 和 `specificRelation`
- [ ] 文件系统路径正确映射（A_set/Bste/Cste）
- [ ] 删除关系时级联删除关联答案
- [ ] 所有测试通过
- [ ] 数据迁移成功，无数据丢失
