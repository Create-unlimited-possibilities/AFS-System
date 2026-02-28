// web/app/admin/langgraph/components/FlowCanvas.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const isEditable = data.promptType !== 'none' || data.llmEnabled;

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[120px] text-center transition-all',
        selected ? 'border-orange-500 shadow-lg' : 'border-gray-300',
        isEditable ? 'bg-white cursor-pointer hover:border-orange-400' : 'bg-gray-100 cursor-default',
        data.nodeType === 'condition' && 'rounded-full'
      )}
    >
      <div className="font-medium text-sm">{data.label}</div>
      {isEditable && (
        <div className="text-xs text-gray-500 mt-1">
          {data.promptType === 'static' && '📝 静态Prompt'}
          {data.promptType === 'dynamic' && '⚡ 动态Prompt'}
          {data.promptType === 'none' && '🤖 仅模型'}
        </div>
      )}
    </div>
  );
}

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

  // Update edges when props change
  useEffect(() => {
    const converted: Edge[] = edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      animated: edge.conditionType === 'conditional',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: {
        stroke: edge.conditionType === 'conditional' ? '#f97316' : '#94a3b8',
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
            return '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
