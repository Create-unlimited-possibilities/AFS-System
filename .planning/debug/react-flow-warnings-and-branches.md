---
status: awaiting_human_verify
trigger: "react-flow-warnings-and-branches"
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:25:00Z
---

## Current Focus
hypothesis: Fixes applied - need user verification
test: User verifies: 1) No more React Flow warnings, 2) Click "重置为默认" to restore missing branch
expecting: Clean console, 3 branches visible after reset
next_action: Wait for user confirmation

## Symptoms
expected:
- 无 React Flow 警告
- 显示3条分支：普通聊天、倾诉模式、算命预测
- 边连接正常显示

actual:
- React Flow 警告一直刷新
- 只显示2条分支
- 边连接不可见

errors:
- React Flow警告: FlowCanvas.tsx:262 - "It looks like you've created a new nodeTypes or edgeTypes object"

started: Unknown - ongoing issue

## Eliminated

## Evidence
- timestamp: 2026-03-25T00:00:00Z
  checked: Backend data
  found: 后端数据正确：12个节点，15条边，包含"算命预测"分支
  implication: Backend is working correctly, issue is frontend-specific

- timestamp: 2026-03-25T00:00:00Z
  checked: Frontend code modifications
  found: nodeTypes 在组件外部定义，minimapNodeColor 使用 useCallback
  implication: Code has been modified but user still sees warnings

- timestamp: 2026-03-25T00:00:00Z
  checked: Warning line number
  found: React Flow warning reports line 262, but this may not match current code
  implication: Frontend may be running stale compiled code

- timestamp: 2026-03-25T00:05:00Z
  checked: FlowCanvas.tsx current code (lines 80-84)
  found: nodeTypes is correctly defined OUTSIDE component at line 81-83, should be stable
  implication: nodeTypes is stable - warning source is elsewhere

- timestamp: 2026-03-25T00:05:00Z
  checked: FlowCanvas.tsx line 262
  found: Line 262 is closing tag of ReactFlow component `>`, line 252-262 is ReactFlow opening
  implication: Warning is triggered by ReactFlow component itself, not our code directly

- timestamp: 2026-03-25T00:05:00Z
  checked: FlowCanvas.tsx edgeTypes
  found: No edgeTypes prop passed to ReactFlow - this is GOOD (uses defaults)
  implication: edgeTypes is not the problem

- timestamp: 2026-03-25T00:05:00Z
  checked: FlowCanvas.tsx minimapNodeColor (lines 227-237)
  found: Already wrapped in useCallback with correct dependencies [nodes, selectedNodeId]
  implication: minimapNodeColor should be stable

- timestamp: 2026-03-25T00:05:00Z
  checked: BranchLegend component (lines 86-129)
  found: Uses useMemo for branchLabels, correctly memoized
  implication: BranchLegend is not causing re-renders

- timestamp: 2026-03-25T00:10:00Z
  checked: Backend controller (controller.js lines 20-31)
  found: getFlowById calls langGraphService.getFlowById which uses configLoader
  implication: Data comes from configLoader, not directly from defaults

- timestamp: 2026-03-25T00:10:00Z
  checked: configLoader.js initialization (lines 26-57)
  found: Loads config from MongoDB (saved.toObject()), only creates from defaults if not found
  implication: If DB has old config without '算命预测', it will persist

- timestamp: 2026-03-25T00:10:00Z
  checked: defaults/rolecard.js edges (lines 194-215)
  found: Edge at line 214 has '算命预测' label: { source: 'token_monitor', target: 'chart_rag_retriever', conditionType: 'conditional', label: '算命预测' }
  implication: Default config is correct, but DB may have stale version

- timestamp: 2026-03-25T00:10:00Z
  checked: service.js resetFlowConfig (lines 111-127)
  found: Deletes existing config and creates new from defaults, then reloads
  implication: Calling resetFlowConfig will fix missing '算命预测' edge

## Resolution
root_cause: TWO ISSUES IDENTIFIED:
1. Missing '算命预测' branch: MongoDB contains stale config created before the '算命预测' edge was added to defaults/rolecard.js. configLoader loads from DB on startup, not from defaults.
2. React Flow warnings: The flowEdges useMemo depended on highlightedBranch state, which changed every 2.5 seconds due to auto-cycling effect. This caused edge objects to be recreated continuously, triggering React Flow warning.

fix:
1. Missing branch: User must click "重置为默认" button in admin UI to call resetFlowConfig endpoint
2. React Flow warnings: Removed highlightedBranch state and auto-cycling useEffect; simplified edge rendering to always animate conditional edges with stable useMemo dependencies

verification:
1. After reset: API should return 15 edges including one with label '算命预测'
2. After code fix: No more React Flow warnings in console, edges remain stable

files_changed: [web/app/admin/langgraph/components/FlowCanvas.tsx]
