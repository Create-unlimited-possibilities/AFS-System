// web/app/admin/langgraph/components/NodeInfo.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Info, Database, Cpu, X } from 'lucide-react';
import type { LangGraphNode, AvailableModels } from '../hooks/useLangGraph';
import { ModelSelector } from './ModelSelector';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface NodeInfoProps {
  node: LangGraphNode;
  models: AvailableModels | null;
  onSave: (updates: { llmConfig?: any; hideFortuneTerms?: boolean }) => void;
  onClose: () => void;
}

export function NodeInfo({ node, models, onSave, onClose }: NodeInfoProps) {
  const [llmConfig, setLlmConfig] = useState(node.llmConfig);
  const [hideFortuneTerms, setHideFortuneTerms] = useState(node.hideFortuneTerms !== false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLlmConfig(node.llmConfig);
    setHideFortuneTerms(node.hideFortuneTerms !== false);
    setHasChanges(false);
  }, [node]);

  const handleLLMConfigChange = (updates: any) => {
    setLlmConfig((prev: any) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleHideFortuneTermsChange = (checked: boolean) => {
    setHideFortuneTerms(checked);
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: any = {};
    if (node.llmEnabled) {
      updates.llmConfig = llmConfig;
    }
    if (node.nodeId === 'role_translator') {
      updates.hideFortuneTerms = hideFortuneTerms;
    }
    onSave(updates);
  };

  return (
    <div className="space-y-4">
      {/* Node Info Header */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="font-medium">{node.nodeName}</div>
        <div className="text-sm text-gray-500">ID: {node.nodeId}</div>
        <div className="text-xs text-gray-400 mt-1">类型: {node.nodeType}</div>
      </div>

      {/* Dynamic Sources Info */}
      {node.promptType === 'none' && node.dynamicSources && node.dynamicSources.length > 0 && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 text-purple-700 font-medium mb-3">
            <Database className="w-4 h-4" />
            动态数据来源
          </div>
          <p className="text-sm text-purple-600 mb-3">
            此节点的 Prompt 由以下数据动态组合生成：
          </p>
          <div className="space-y-2">
            {node.dynamicSources.map((source, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-white rounded border border-purple-100"
              >
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                  {`{${source.name}}`}
                </Badge>
                <span className="text-sm text-gray-600">{source.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Prompt Info */}
      {node.promptType === 'dynamic' && node.dynamicSources && node.dynamicSources.length > 0 && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 text-purple-700 font-medium mb-3">
            <Database className="w-4 h-4" />
            动态数据来源
          </div>
          <div className="space-y-2">
            {node.dynamicSources.map((source, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-white rounded border border-purple-100"
              >
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                  {`{${source.name}}`}
                </Badge>
                <span className="text-sm text-gray-600">{source.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Translator Config */}
      {node.nodeId === 'role_translator' && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">命理术语显示设置</div>
          <div className="flex items-center space-x-3">
            <Switch
              id="hideFortuneTerms"
              checked={hideFortuneTerms}
              onCheckedChange={handleHideFortuneTermsChange}
            />
            <Label htmlFor="hideFortuneTerms" className="cursor-pointer">
              {hideFortuneTerms ? '隐藏命理术语' : '显示命理术语'}
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            开启后以纯角色口吻输出，关闭后会显示命理分析内容
          </p>
        </div>
      )}

      {/* LLM Config (if enabled) */}
      {node.llmEnabled && (
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Cpu className="w-4 h-4" />
            LLM 模型配置
          </div>
          <ModelSelector
            config={llmConfig}
            models={models}
            onChange={handleLLMConfigChange}
          />
        </div>
      )}

      {/* Info Notice */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <strong>提示:</strong> 此节点的 Prompt 由系统动态生成，仅可调整模型配置。
        </div>
      </div>

      {/* Action Buttons */}
      {node.llmEnabled || node.nodeId === 'role_translator' ? (
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            关闭
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 bg-orange-500 hover:bg-orange-600"
          >
            保存配置
          </Button>
        </div>
      ) : (
        <div className="flex pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            关闭
          </Button>
        </div>
      )}
    </div>
  );
}
