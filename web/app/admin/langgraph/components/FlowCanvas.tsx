// web/app/admin/langgraph/components/FlowCanvas.tsx
'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
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

// Custom node component
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  // 可编辑：有静态prompt 或 动态prompt 或 LLM可配置
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

export function FlowCanvas({ nodes, edges, selectedNodeId, onNodeClick }: FlowCanvasProps) {
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  // Update nodes when props change
  useEffect(() => {
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
    setFlowNodes(converted);
  }, [nodes]);

  // Update edges when props change - all edges animated for flow visualization
  useEffect(() => {
    // Filter out edges with invalid source/target
    const validEdges = edges.filter(edge => edge.source && edge.target);

    const converted: Edge[] = validEdges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      animated: true, // Always animate to show flow direction
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.conditionType === 'conditional' ? '#f97316' : '#22c55e',
      },
      style: {
        stroke: edge.conditionType === 'conditional' ? '#f97316' : '#22c55e',
        strokeWidth: 2,
      },
    }));
    setFlowEdges(converted);
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
  if (nodes.length === 0) {
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
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.id === selectedNodeId) return '#f97316';
            // Match the node colors
            const nodeData = nodes.find(n => n.nodeId === node.id);
            if (nodeData && (nodeData.promptType !== 'none' || nodeData.llmEnabled)) {
              return '#22c55e'; // Green for editable
            }
            return '#9ca3af'; // Gray for non-editable
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
