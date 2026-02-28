// web/app/admin/langgraph/components/NodeEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { PromptEditor } from './PromptEditor';
import { ModelSelector } from './ModelSelector';
import { Button } from '@/components/ui/button';
import { Save, X, AlertTriangle } from 'lucide-react';
import type { LangGraphNode, AvailableModels, LLMConfig } from '../hooks/useLangGraph';

interface NodeEditorProps {
  node: LangGraphNode;
  models: AvailableModels | null;
  onSave: (updates: {
    staticPrompt?: string;
    editableSection?: string;
    llmConfig?: Partial<LLMConfig>;
  }) => void;
  onCancel: () => void;
}

export function NodeEditor({ node, models, onSave, onCancel }: NodeEditorProps) {
  const [promptValue, setPromptValue] = useState(
    node.promptType === 'static' ? node.staticPrompt : node.editableSection
  );
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(node.llmConfig);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPromptValue(
      node.promptType === 'static' ? node.staticPrompt : node.editableSection
    );
    setLlmConfig(node.llmConfig);
    setHasChanges(false);
  }, [node]);

  const handlePromptChange = (value: string) => {
    setPromptValue(value);
    setHasChanges(true);
  };

  const handleLLMConfigChange = (updates: Partial<LLMConfig>) => {
    setLlmConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: any = {};

    if (node.promptType === 'static') {
      updates.staticPrompt = promptValue;
    } else if (node.promptType === 'dynamic') {
      updates.editableSection = promptValue;
    }

    if (node.llmEnabled) {
      updates.llmConfig = llmConfig;
    }

    onSave(updates);
  };

  return (
    <div className="space-y-6">
      {/* Node Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="font-medium">{node.nodeName}</div>
        <div className="text-sm text-gray-500">ID: {node.nodeId}</div>
      </div>

      {/* Prompt Editor (if applicable) */}
      {node.promptType !== 'none' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Prompt 配置</h3>
          <PromptEditor
            promptType={node.promptType}
            staticPrompt={node.staticPrompt}
            dynamicSources={node.dynamicSources}
            editableSection={node.editableSection}
            onChange={handlePromptChange}
          />
        </div>
      )}

      {/* LLM Config (if enabled) */}
      {node.llmEnabled && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">LLM 模型配置</h3>
          <ModelSelector
            config={llmConfig}
            models={models}
            onChange={handleLLMConfigChange}
          />
        </div>
      )}

      {/* Restart Warning */}
      <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-700">
          <strong>注意:</strong> 配置保存后需要重启服务才能生效
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
        >
          <Save className="w-4 h-4 mr-2" />
          保存配置
        </Button>
      </div>
    </div>
  );
}
