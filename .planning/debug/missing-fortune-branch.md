---
status: investigating
trigger: "用户已重构，但 AI角色卡对话 仍然只显示2条分支（普通聊天、倾诉模式），缺少\"算命预测\"分支。"
created: 2026-03-25T00:00:00.000Z
updated: 2026-03-25T00:00:00.000Z
---

## Current Focus

hypothesis: 前端页面默认选择的是 xiaoshudong flow，而 xiaoshudong 只有两个分支（倾听阶段、分析阶段），没有算命预测分支
test: 对比 xiaoshudong 和 rolecard 两个 flow 的边定义
expecting: xiaoshudong 确实没有算命预测分支，rolecard 有
next_action: 确认用户是否在查看正确的 flow tab（应该选择 AI角色卡对话 而不是 小树洞对话）

## Symptoms

expected:
- AI角色卡对话 显示3条分支：普通聊天、倾诉模式、算命预测
- 边连接正常显示

actual:
- 只显示2条分支
- 算命预测分支缺失

errors: 无明确错误信息

reproduction:
- 打开 AI角色卡对话 页面
- 查看分支选项
- 算命预测分支不显示

started: 重构后出现

## Eliminated

<!-- APPEND only -->

## Evidence

- timestamp: 2026-03-25T00:00:00.000Z
  checked: 用户之前的调查
  found: 后端 defaults/rolecard.js 有15条边，包含算命预测；MongoDB 中可能有旧配置；用户已点击"重置为默认"
  implication: 需要验证重置逻辑是否正确工作

- timestamp: 2026-03-25T00:00:01.000Z
  checked: defaults/rolecard.js 第194-215行
  found: edges 数组包含15条边，其中第214行明确有 { source: 'token_monitor', target: 'chart_rag_retriever', conditionType: 'conditional', label: '算命预测' }
  implication: 默认配置中确实包含"算命预测"分支

- timestamp: 2026-03-25T00:00:02.000Z
  checked: service.js resetFlowConfig 方法（第111-127行）
  found: 重置逻辑正确 - 删除现有配置，从 defaults 重新创建，并调用 configLoader.reloadConfig
  implication: 重置逻辑本身没问题

- timestamp: 2026-03-25T00:00:03.000Z
  checked: page.tsx 第31行
  found: const [activeFlowId, setActiveFlowId] = useState<string>('xiaoshudong');
  implication: 默认选中的是 xiaoshudong flow，不是 rolecard！用户可能没有切换到 AI角色卡对话 tab

- timestamp: 2026-03-25T00:00:04.000Z
  checked: defaults/xiaoshudong.js 第152-159行
  found: xiaoshudong flow 的 edges 只有6条边，label 分别是：倾听阶段、分析阶段、以及4条无label的always边
  implication: xiaoshudong flow 确实只有2个分支（倾听阶段、分析阶段），没有算命预测分支

- timestamp: 2026-03-25T00:00:05.000Z
  checked: FlowTabs.tsx 第13-16行
  found: flowTabs 数组定义了两个 tab：rolecard (AI角色卡对话) 和 xiaoshudong (小树洞对话)
  implication: 用户需要点击 AI角色卡对话 tab 才能看到算命预测分支

## Resolution

root_cause:
fix:
verification:
files_changed: []
