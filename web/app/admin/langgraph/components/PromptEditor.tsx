// web/app/admin/langgraph/components/PromptEditor.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info, FileText } from 'lucide-react';
import type { DynamicSource } from '../hooks/useLangGraph';

interface PromptEditorProps {
  promptType: 'static' | 'dynamic' | 'none';
  staticPrompt: string;
  dynamicSources: DynamicSource[];
  editableSection: string;
  onChange: (value: string) => void;
}

export function PromptEditor({
  promptType,
  staticPrompt,
  dynamicSources,
  editableSection,
  onChange,
}: PromptEditorProps) {
  const [value, setValue] = useState(
    promptType === 'static' ? staticPrompt : editableSection
  );

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(newValue);
  };

  if (promptType === 'none') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-sm">
        此节点的 Prompt 由系统动态生成，不可编辑
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Prompt Type Badge */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full',
            promptType === 'static'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          )}
        >
          {promptType === 'static' ? '📝 静态 Prompt' : '⚡ 动态 Prompt'}
        </span>
      </div>

      {/* Dynamic Sources Info */}
      {promptType === 'dynamic' && dynamicSources.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
            <Info className="w-4 h-4" />
            动态数据来源
          </div>
          <ul className="space-y-1">
            {dynamicSources.map((source, index) => (
              <li key={index} className="text-sm text-purple-600">
                • <strong>{source.name}</strong>: {source.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prompt Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {promptType === 'static' ? 'Prompt 内容' : '可编辑部分'}
        </label>
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full h-64 p-3 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="在此编辑 Prompt..."
        />
      </div>
    </div>
  );
}
