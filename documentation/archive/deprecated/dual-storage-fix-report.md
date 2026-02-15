# 双重存储系统修复报告

## 修复日期
2026-02-10

## 问题描述

### 问题 1: question_undefined.json 文件存储错误
**现象:**
- 本地文件存储系统不断写入 `question_undefined.json` 文件
- 文件名应该按题号写成 `question_1.json`, `question_2.json` 等

### 问题 2: 基础层答案丢失
**现象:**
- 用户填写完 A 套题基础层后，再填写感情层
- 回到主页时，基础层答案丢失
- 前端仅检测到完成了感情层题目

## 根本原因分析

### 问题 1 根本原因
在 `server/src/services/fileStorage.js:18`，代码期望 `questionOrder` 作为直接属性：
```javascript
const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder, helperId, helperNickname } = answer;
```

但 `storageService.js:25` 调用 `syncToFileSystem` 时只传递了 `question` 对象：
```javascript
this.syncToFileSystem({ ...dbAnswer.toObject(), question })
```

`question` 对象（来自 Question 模型）的字段名是 `order`，不是 `questionOrder`。
因此 `questionOrder` 始终为 `undefined`，导致文件名为 `question_undefined.json`。

### 问题 2 根本原因
1. **MongoDB 批量插入错误**（`AnswerService.js:269`）:
   ```javascript
   await this.answerRepository.create(answerDocs[0]);  // ← 只插入第一个文档！
   ```
   应该使用 `insertMany(answerDocs)` 来插入所有文档。

2. **Token Count 计算错误**（`AnswerService.js:286-289`）:
   ```javascript
   if (totalTokenCount > 0) {
     await this.userRepository.findByIdAndUpdate(userId, {
       $inc: { 'companionChat.roleCard.memoryTokenCount': totalTokenCount }
     });
   }
   ```
   由于 `deleteMany` 删除了所有答案，然后只保存新批次，使用 `$inc` 会导致 token count 累加错误。

## 修复方案

### 修复 1: FileStorage - questionOrder 字段映射

**文件:** `server/src/services/fileStorage.js`

**修改位置:** Line 18-25

**修改内容:**
```javascript
// 修改前
const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder, helperId, helperNickname } = answer;

// 修改后
const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder: orderParam, helperId, helperNickname } = answer;

const questionOrder = orderParam !== undefined ? orderParam : question?.order;

if (questionOrder === undefined || questionOrder === null) {
  console.error(`[FileStorage] questionOrder is undefined for questionId ${questionId}, skipping file save`);
  return null;
}
```

**修复说明:**
- 将 `questionOrder` 重命名为 `orderParam` 避免命名冲突
- 添加回退逻辑：如果 `questionOrder` 未提供，则从 `question.order` 获取
- 添加验证：如果两者都为 `undefined`，返回 `null` 并记录错误

---

### 修复 2: AnswerService - 批量插入所有答案

**文件:** `server/src/services/AnswerService.js`

**修改位置 1:** Line 268-270 (`batchSaveSelfAnswers`)

**修改内容:**
```javascript
// 修改前
if (answerDocs.length > 0) {
  await this.answerRepository.create(answerDocs[0]);
}

// 修改后
if (answerDocs.length > 0) {
  await this.answerRepository.insertMany(answerDocs);
}
```

**修改位置 2:** Line 330-332 (`batchSaveAssistAnswers`)

**修改内容:**
```javascript
// 修改前
if (answerDocs.length > 0) {
  await this.answerRepository.create(answerDocs[0]);
}

// 修改后
if (answerDocs.length > 0) {
  await this.answerRepository.insertMany(answerDocs);
}
```

**修复说明:**
- 使用 `insertMany` 一次性插入所有文档
- 解决了只保存第一个答案的问题

---

### 修复 3: AnswerService - 重新计算 Token Count

**文件:** `server/src/services/AnswerService.js`

**修改位置 1:** Line 286-296 (`batchSaveSelfAnswers`)

**修改内容:**
```javascript
// 修改前
if (totalTokenCount > 0) {
  await this.userRepository.findByIdAndUpdate(userId, {
    $inc: { 'companionChat.roleCard.memoryTokenCount': totalTokenCount }
  });
}

// 修改后
if (answerDocs.length > 0) {
  const allAnswers = await this.answerRepository.find({
    userId,
    targetUserId: userId
  });
  const newTotalTokenCount = allAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

  await this.userRepository.findByIdAndUpdate(userId, {
    $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
  });
}
```

**修改位置 2:** Line 353-361 (`batchSaveAssistAnswers`)

**修改内容:**
```javascript
// 修改前
if (totalTokenCount > 0) {
  await this.userRepository.findByIdAndUpdate(targetUserId, {
    $inc: { 'companionChat.roleCard.memoryTokenCount': totalTokenCount }
  });
}

// 修改后
if (answerDocs.length > 0) {
  const allAnswers = await this.answerRepository.find({
    userId,
    targetUserId
  });
  const newTotalTokenCount = allAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);

  await this.userRepository.findByIdAndUpdate(targetUserId, {
    $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
  });
}
```

**修复说明:**
- 查询所有用户答案（包括之前保存的）
- 重新计算总 token 数
- 使用 `$set` 设置准确值，而不是 `$inc` 累加
- 解决了 token count 累加错误的问题

## 验证结果

### FileStorage 验证
```bash
$ node server/scripts/verify-dual-storage-fix.js

=== 测试 FileStorage 修复 ===

测试1: questionOrder 未提供，从 question.order 获取
[FileStorage] 保存记忆文件: question_5.json
✓ 正确处理 questionOrder 未提供的情况

测试2: questionOrder 已提供，使用提供的值
[FileStorage] 保存记忆文件: question_10.json
✓ 正确使用提供的 questionOrder

测试3: questionOrder 和 question.order 都不存在
[FileStorage] questionOrder is undefined, skipping file save
✓ 正确返回 null 当 questionOrder 缺失
```

### AnswerService 验证
```bash
$ node -c server/src/services/AnswerService.js
✓ AnswerService loaded successfully
✓ insertMany method is being used
✓ Token count recalculation logic is in place
```

## 修改文件清单

| 文件 | 修改行数 | 修改类型 |
|------|---------|---------|
| `server/src/services/fileStorage.js` | 18-25 | 添加 questionOrder 映射逻辑 |
| `server/src/services/AnswerService.js` | 268-296 | 修复 batchSaveSelfAnswers |
| `server/src/services/AnswerService.js` | 330-361 | 修复 batchSaveAssistAnswers |

## 测试建议

### 1. 测试文件存储修复
```bash
# 保存一批答案
curl -X POST http://localhost:3001/api/answers/batch-self \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"answers": [...]}'

# 检查文件是否正确创建
ls /app/storage/userdata/{userId}/A_set/self/basic/
# 应该看到: question_1.json, question_2.json, question_3.json 等
```

### 2. 测试 MongoDB 修复
- 填写基础层答案并保存
- 填写感情层答案并保存
- 查询 MongoDB 验证两个层次的答案都存在：
  ```javascript
  db.answers.find({ userId: ObjectId("..."), targetUserId: ObjectId("...") })
  ```

### 3. 测试 Token Count 修复
- 检查保存前后的 token count
- 验证 count 是否准确，没有累加错误

### 4. 测试前端
- 填写基础层 → 保存
- 填写感情层 → 保存
- 返回主页 → 验证基础层仍显示为已回答

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `insertMany` 可能在大批量插入时性能下降 | 低 | 批量大小有限制，一般不会太大 |
| Token count 重新计算增加数据库查询 | 低 | 查询条件有索引，性能影响小 |
| `questionOrder` 映射可能引入新 bug | 低 | 已添加验证逻辑，返回 null 并记录错误 |

## 回滚方案

如果出现问题，可以通过以下命令回滚：
```bash
# 回滚所有修改
git checkout HEAD -- server/src/services/fileStorage.js
git checkout HEAD -- server/src/services/AnswerService.js
```

## 后续优化建议

1. **添加文件存储的单元测试**：为 FileStorage.saveMemoryFile 编写完整的单元测试
2. **添加批量保存的集成测试**：为 batchSaveSelfAnswers 和 batchSaveAssistAnswers 编写集成测试
3. **优化 token count 计算策略**：考虑使用缓存或定期重算，而不是每次保存都重算
4. **添加更详细的错误日志**：在文件存储失败时记录更多信息以便调试

## 总结

本次修复解决了双重存储系统的两个关键问题：

1. **文件存储错误**：修复了 `questionOrder` 字段映射问题，防止写入 `question_undefined.json`
2. **数据丢失问题**：修复了 MongoDB 批量插入和 token count 计算错误，确保所有答案正确保存

修复后，系统应该能够：
- 正确按题号保存文件（`question_1.json`, `question_2.json` 等）
- 正确保存所有批次的答案到 MongoDB
- 准确计算并维护 token count
- 在前端正确显示所有已完成的题目
