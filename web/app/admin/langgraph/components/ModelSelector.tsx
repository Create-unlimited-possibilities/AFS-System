// web/app/admin/langgraph/components/ModelSelector.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Cpu, Cloud } from 'lucide-react';
import type { AvailableModels, LLMConfig } from '../hooks/useLangGraph';

interface ModelSelectorProps {
  config: LLMConfig;
  models: AvailableModels | null;
  onChange: (config: Partial<LLMConfig>) => void;
}

export function ModelSelector({ config, models, onChange }: ModelSelectorProps) {
  const [source, setSource] = useState<'ollama' | 'api'>(config.source);

  const handleSourceChange = (newSource: 'ollama' | 'api') => {
    setSource(newSource);
    onChange({ source: newSource });
  };

  const handleModelChange = (model: string) => {
    onChange({ model });
  };

  const handleProviderChange = (provider: 'deepseek' | 'openai') => {
    onChange({ apiProvider: provider });
  };

  return (
    <div className="space-y-4">
      {/* Model Source Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          模型来源
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleSourceChange('ollama')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
              source === 'ollama'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Cpu className="w-4 h-4" />
            Ollama (本地)
          </button>
          <button
            onClick={() => handleSourceChange('api')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
              source === 'api'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Cloud className="w-4 h-4" />
            API (远程)
          </button>
        </div>
      </div>

      {/* Ollama Model Selection */}
      {source === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ollama 模型
          </label>
          <select
            value={config.model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="">选择模型...</option>
            {models?.ollama?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {(!models?.ollama || models.ollama.length === 0) && (
            <p className="mt-1 text-xs text-gray-500">
              无法获取 Ollama 模型列表，请手动输入
            </p>
          )}
        </div>
      )}

      {/* API Provider Selection */}
      {source === 'api' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 提供商
            </label>
            <select
              value={config.apiProvider || 'deepseek'}
              onChange={(e) => handleProviderChange(e.target.value as 'deepseek' | 'openai')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 模型
            </label>
            <select
              value={config.model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">选择模型...</option>
              {config.apiProvider === 'openai'
                ? models?.api?.openai?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                : models?.api?.deepseek?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
            </select>
          </div>
        </>
      )}

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Temperature: {config.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>精确 (0)</span>
          <span>创意 (2)</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max Tokens
        </label>
        <input
          type="number"
          min="50"
          max="8192"
          value={config.maxTokens}
          onChange={(e) => onChange({ maxTokens: parseInt(e.target.value) })}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
