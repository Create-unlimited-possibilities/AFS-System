// web/app/admin/langgraph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import { useLangGraph } from './hooks/useLangGraph';
import { FlowTabs } from './components/FlowTabs';
import { FlowCanvas } from './components/FlowCanvas';
import { NodeEditor } from './components/NodeEditor';
import { NodeInfo } from './components/NodeInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitBranch, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import type { LangGraphNode } from './hooks/useLangGraph';

export default function LangGraphPage() {
  const { can } = usePermissionStore();
  const {
    flows,
    currentFlow,
    models,
    isLoading,
    error,
    fetchFlows,
    fetchFlowDetail,
    updateNodeConfig,
    fetchModels,
    resetFlowConfig,
  } = useLangGraph();

  const [activeFlowId, setActiveFlowId] = useState<string>('xiaoshudong');
  const [selectedNode, setSelectedNode] = useState<LangGraphNode | null>(null);

  useEffect(() => {
    if (can('langgraph:edit')) {
      fetchFlows();
      fetchModels();
    }
  }, [can, fetchFlows, fetchModels]);

  useEffect(() => {
    if (activeFlowId) {
      fetchFlowDetail(activeFlowId);
      setSelectedNode(null);
    }
  }, [activeFlowId, fetchFlowDetail]);

  const handleFlowChange = (flowId: string) => {
    setActiveFlowId(flowId);
  };

  const handleNodeClick = (node: LangGraphNode) => {
    // All nodes can be clicked to view details
    setSelectedNode(node);
  };

  const handleSaveNode = async (updates: {
    staticPrompt?: string;
    editableSection?: string;
    llmConfig?: any;
    hideFortuneTerms?: boolean;
  }) => {
    if (!selectedNode) return;

    const result = await updateNodeConfig(activeFlowId, selectedNode.nodeId, updates);
    if (result.success) {
      // Show success message
      alert('配置已保存，重启服务后生效');
    } else {
      alert('保存失败: ' + result.message);
    }
  };

  const handleResetFlow = async () => {
    if (!confirm(`确定要重置「${currentFlow?.flowName || activeFlowId}」流程为默认配置吗？\n\n这将删除所有自定义配置！`)) {
      return;
    }

    const result = await resetFlowConfig(activeFlowId);
    if (result.success) {
      alert(result.message || '重置成功');
      setSelectedNode(null);
    } else {
      alert('重置失败: ' + result.message);
    }
  };

  if (!can('langgraph:edit')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限访问 LangGraph 管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-orange-500" />
            LangGraph 管理
          </h1>
          <p className="text-gray-600">可视化编辑 LangGraph 流程配置</p>
        </div>
      </div>

      {/* Flow Tabs */}
      <FlowTabs activeFlowId={activeFlowId} onFlowChange={handleFlowChange} />

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow Canvas */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {currentFlow?.flowName || '流程图'}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFlow}
                  disabled={isLoading}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  重置为默认
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-[520px] p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : currentFlow ? (
                <FlowCanvas
                  nodes={currentFlow.nodes}
                  edges={currentFlow.edges}
                  selectedNodeId={selectedNode?.nodeId ?? null}
                  onNodeClick={handleNodeClick}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  选择一个流程查看
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Node Editor Panel */}
        <div className="lg:col-span-1">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedNode ? selectedNode.nodeName : '节点编辑'}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto h-[520px]">
              {selectedNode ? (
                // 判断节点是否可完全编辑（有静态或动态prompt）
                selectedNode.promptType !== 'none' ? (
                  <NodeEditor
                    node={selectedNode}
                    models={models}
                    onSave={handleSaveNode}
                    onCancel={() => setSelectedNode(null)}
                  />
                ) : (
                  <NodeInfo
                    node={selectedNode}
                    models={models}
                    onSave={handleSaveNode}
                    onClose={() => setSelectedNode(null)}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <GitBranch className="w-12 h-12 mb-2" />
                  <p>点击流程图中的节点进行编辑</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
