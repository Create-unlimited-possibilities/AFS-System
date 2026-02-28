// web/app/admin/langgraph/components/FlowCanvas.tsx
'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeTypes,
  useNodesState,
  useEdgesState,
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
  // Convert to ReactFlow format
  const flowNodes: Node[] = useMemo(() =>
    nodes.map((node) => ({
      id: node.nodeId,
      type: 'custom',
      position: { x: node.position.x, y: node.position.y },
      data: {
        label: node.nodeName,
        nodeType: node.nodeType,
        promptType: node.promptType,
        llmEnabled: node.llmEnabled,
      },
    })),
    [nodes]
  );

  const flowEdges: Edge[] = useMemo(() =>
    edges.map((edge, index) => ({
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
    })),
    [edges]
  );

  const [reactNodes, setReactNodes, onNodesChange] = useNodesState(flowNodes);
  const [reactEdges, setReactEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes when props change
  useMemo(() => {
    setReactNodes(flowNodes);
  }, [flowNodes, setReactNodes]);

  useMemo(() => {
    setReactEdges(flowEdges);
  }, [flowEdges, setReactEdges]);

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const originalNode = nodes.find((n) => n.nodeId === node.id);
      if (originalNode) {
        onNodeClick(originalNode);
      }
    },
    [nodes, onNodeClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={reactNodes}
        edges={reactEdges}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
