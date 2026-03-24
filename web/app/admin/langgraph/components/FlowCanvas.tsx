// web/app/admin/langgraph/components/FlowCanvas.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '@/lib/utils';
import type { LangGraphNode, LangGraphEdge } from '../hooks/useLangGraph';

interface FlowCanvasProps {
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  selectedNodeId: string | null;
  onNodeClick: (node: LangGraphNode) => void;
}

// Branch color configuration - each branch has distinct color
const BRANCH_COLORS: Record<string, { color: string; label: string }> = {
  '普通聊天': { color: '#22c55e', label: '普通聊天' },
  '倾诉模式': { color: '#8b5cf6', label: '倾诉模式' },
  '算命预测': { color: '#f59e0b', label: '算命预测' },
  '涉及记忆': { color: '#06b6d4', label: '涉及记忆' },
  '无需检索': { color: '#10b981', label: '无需检索' },
  '继续倾听': { color: '#a855f7', label: '继续倾听' },
  '进入分析': { color: '#f97316', label: '进入分析' },
};

// Get branch color from edge label
function getBranchColor(label: string): string {
  if (label && BRANCH_COLORS[label]) {
    return BRANCH_COLORS[label].color;
  }
  return '#6b7280'; // Gray for unlabeled
}

// Custom node component
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const hasStaticPrompt = data.promptType === 'static';
  const hasDynamicPrompt = data.promptType === 'dynamic';
  const hasLLMConfig = data.llmEnabled;
  const isEditable = hasStaticPrompt || hasDynamicPrompt || hasLLMConfig;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[140px] text-center transition-all',
        selected ? 'border-orange-500 shadow-lg ring-2 ring-orange-200' : '',
        isEditable
          ? 'bg-green-50 border-green-400 cursor-pointer hover:border-green-500 hover:shadow-md'
          : 'bg-gray-100 border-gray-300 cursor-pointer hover:border-gray-400',
        data.nodeType === 'condition' && 'rounded-full'
      )}
    >
      <div className="font-medium text-sm">{data.label}</div>
      <div className="text-xs mt-1 flex flex-wrap gap-1 justify-center">
        {hasStaticPrompt && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">📝 静态</span>
        )}
        {hasDynamicPrompt && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">⚡ 动态</span>
        )}
        {hasLLMConfig && !hasStaticPrompt && !hasDynamicPrompt && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">🤖 模型</span>
        )}
        {!isEditable && (
          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">🔒 只读</span>
        )}
      </div>
    </div>
  );
}

// Define nodeTypes outside component to prevent recreation
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Dynamic Branch Legend - shows branches from actual edges
function BranchLegend({ edges }: { edges: LangGraphEdge[] }) {
  // Extract unique branch labels from edges
  const branchLabels = [...new Set(edges.map(e => e.label).filter(Boolean))];

  // Only show main branches that exist in this flow
  const mainBranchPriority = ['普通聊天', '倾诉模式', '算命预测'];
  const displayedBranches = mainBranchPriority.filter(b => branchLabels.includes(b));

  if (displayedBranches.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10 border border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-2">分支图例</div>
      <div className="space-y-1.5">
        {displayedBranches.map((branch) => {
          const config = BRANCH_COLORS[branch];
          if (!config) return null;
          return (
            <div key={branch} className="flex items-center gap-2">
              <div
                className="w-6 h-0.5 rounded"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-xs text-gray-600">{config.label}</span>
            </div>
          );
        })}
        <div className="border-t border-gray-200 mt-2 pt-2">
          <div className="flex items-center gap-2">
            <svg width="24" height="4" className="text-gray-400">
              <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            <span className="text-xs text-gray-500">条件分支</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-0.5 bg-gray-400 rounded" />
            <span className="text-xs text-gray-500">必经路径</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FlowCanvas({ nodes, edges, selectedNodeId, onNodeClick }: FlowCanvasProps) {
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [highlightedBranch, setHighlightedBranch] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('[FlowCanvas] Props - nodes:', nodes?.length, 'edges:', edges?.length);
    if (edges?.length > 0) {
      console.log('[FlowCanvas] Edge samples:', edges.slice(0, 3));
    }
  }, [nodes, edges]);

  // Update nodes when props change
  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      setFlowNodes([]);
      return;
    }

    const converted: Node[] = nodes.map((node) => ({
      id: node.nodeId,
      type: 'custom',
      position: { x: node.position?.x || 0, y: node.position?.y || 0 },
      data: {
        label: node.nodeName,
        nodeType: node.nodeType,
        promptType: node.promptType,
        llmEnabled: node.llmEnabled,
      },
    }));
    console.log('[FlowCanvas] Converted nodes:', converted.length);
    setFlowNodes(converted);
  }, [nodes]);

  // Update edges with branch-specific styling
  useEffect(() => {
    if (!edges || edges.length === 0) {
      setFlowEdges([]);
      return;
    }

    // Filter out edges with invalid source/target
    const validEdges = edges.filter(edge => edge.source && edge.target);
    console.log('[FlowCanvas] Valid edges:', validEdges.length, 'of', edges.length);

    const converted: Edge[] = validEdges.map((edge, index) => {
      const isConditional = edge.conditionType === 'conditional';
      const branchColor = edge.label ? getBranchColor(edge.label) : '#6b7280';
      const isHighlighted = highlightedBranch === edge.label;

      return {
        id: `edge-${index}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || undefined,
        labelStyle: {
          fill: isConditional ? branchColor : '#374151',
          fontWeight: 600,
          fontSize: 11,
        },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        // Animate highlighted conditional edges
        animated: isConditional && isHighlighted,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: branchColor,
        },
        style: {
          stroke: branchColor,
          strokeWidth: isHighlighted ? 3.5 : 2.5,
          // Dashed line for conditional edges (proper format)
          strokeDasharray: isConditional ? '5 5' : 'none',
          opacity: highlightedBranch && !isHighlighted && edge.label ? 0.3 : 1,
        },
      };
    });

    console.log('[FlowCanvas] Converted edges:', converted.length);
    setFlowEdges(converted);
  }, [edges, highlightedBranch]);

  // Auto-cycle through branches to highlight them
  useEffect(() => {
    if (!edges || edges.length === 0) return;

    const branches = [...new Set(edges.map(e => e.label).filter(Boolean))];
    console.log('[FlowCanvas] Branches found:', branches);

    if (branches.length <= 1) {
      setHighlightedBranch(null);
      return;
    }

    let currentIndex = 0;
    setHighlightedBranch(branches[0]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % branches.length;
      setHighlightedBranch(branches[currentIndex]);
    }, 2500); // Switch every 2.5 seconds

    return () => clearInterval(interval);
  }, [edges]);

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const originalNode = nodes.find((n) => n.nodeId === node.id);
      if (originalNode) {
        onNodeClick(originalNode);
      }
    },
    [nodes, onNodeClick]
  );

  // Show placeholder if no nodes
  if (!nodes || nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">暂无流程数据</p>
          <p className="text-sm mt-2">请检查后端服务是否正常运行</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.id === selectedNodeId) return '#f97316';
            const nodeData = nodes.find(n => n.nodeId === node.id);
            if (nodeData && (nodeData.promptType !== 'none' || nodeData.llmEnabled)) {
              return '#22c55e';
            }
            return '#9ca3af';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
      <BranchLegend edges={edges} />
    </div>
  );
}
