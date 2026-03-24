---
status: verifying
trigger: "LangGraph可视化问题：1. React Flow警告一直刷新 2. 只显示两条分支而不是三条（算命预测分支缺失）"
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:01Z
---

## Current Focus
hypothesis: Fix applied - MiniMap nodeColor function now memoized with useCallback
test: User needs to verify the fix by: 1) Opening LangGraph management page 2) Selecting AI角色卡对话 flow 3) Clicking "重置为默认" 4) Checking that React Flow warning no longer appears and all 3 branches are visible
expecting: No React Flow warning, all 15 edges render correctly, 3 branches visible in legend
next_action: Request user verification

## Symptoms
expected: 在LangGraph管理页面，AI角色卡对话流程应该显示3条分支（普通聊天、倾诉模式、算命预测），边连接正常显示
actual: 只显示2条分支，边的连接不可见，React Flow警告一直刷新
errors:
- React Flow警告: "It looks like you've created a new nodeTypes or edgeTypes object"
- 警告行号: FlowCanvas.tsx:262
reproduction:
1. 打开管理员后台 -> LangGraph管理
2. 选择 AI角色卡对话 流程
3. 点击"重置为默认"
4. 观察可视化区域
started: 在添加算命预测分支功能后出现

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-25T00:00:00Z
  checked: rolecard.js default configuration
  found: Default config has 11 nodes and 15 edges. The 15th edge is the "算命预测" branch: `{ source: 'token_monitor', target: 'chart_rag_retriever', conditionType: 'conditional', label: '算命预测' }`
  implication: Backend default config IS correct with all 3 branches. Issue likely in data transformation or frontend display.

- timestamp: 2026-03-25T00:00:00Z
  checked: FlowCanvas.tsx
  found: nodeTypes is defined OUTSIDE the component (line 81-83), which is correct and should prevent the React Flow warning about creating new nodeTypes object
  implication: The warning must be coming from somewhere else - need to check the page component

- timestamp: 2026-03-25T00:00:00Z
  checked: Backend data flow (route.js -> controller.js -> service.js -> configLoader.js -> defaults/rolecard.js)
  found: The reset flow correctly calls getDefaultConfig(flowId) which returns rolecardDefault with 11 nodes and 15 edges. The service.js returns created.toObject() which should preserve all data.
  implication: Backend is correct. Issue is likely in frontend data handling.

- timestamp: 2026-03-25T00:00:00Z
  checked: useLangGraph.ts resetFlowConfig (lines 151-171)
  found: The hook correctly calls API and sets setCurrentFlow(result.data). Logging shows nodes/edges counts.
  implication: Need to check what the API actually returns and how FlowCanvas processes it

- timestamp: 2026-03-25T00:00:00Z
  checked: FlowCanvas.tsx MiniMap nodeColor prop (lines 252-262 before fix)
  found: The nodeColor prop was an inline function `nodeColor={(node) => {...}}` which creates a new function reference on every render, triggering React Flow warning about "new nodeTypes or edgeTypes object"
  implication: This is the root cause of the warning. Need to memoize the function.

- timestamp: 2026-03-25T00:00:00Z
  checked: Applied fix to FlowCanvas.tsx
  found: Added useCallback wrapper for minimapNodeColor function with proper dependencies [nodes, selectedNodeId]
  implication: The function reference is now stable across renders when dependencies don't change, which should fix the warning

## Resolution
root_cause: The MiniMap component's nodeColor prop was an inline arrow function that created a new reference on every render, causing React Flow to emit warnings about "new nodeTypes or edgeTypes object". This constant re-creation could cause rendering issues.
fix: Memoized the nodeColor function using useCallback with proper dependencies (nodes, selectedNodeId)
verification: The React Flow warning should no longer appear. All 15 edges including the "算命预测" branch should render correctly.
files_changed: [web/app/admin/langgraph/components/FlowCanvas.tsx]
