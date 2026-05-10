// web/app/admin/langgraph/hooks/useLangGraph.ts
import { useState, useCallback } from 'react';
import { adminApiRequest } from '@/lib/admin-api';

export interface LangGraphFlow {
  flowId: string;
  flowName: string;
  nodeCount: number;
}

export interface DynamicSource {
  name: string;
  description: string;
}

export interface LLMConfig {
  source: 'ollama' | 'api';
  model: string;
  apiProvider?: 'deepseek' | 'openai' | null;
  temperature: number;
  maxTokens: number;
}

export interface LangGraphNode {
  nodeId: string;
  nodeName: string;
  nodeType: 'start' | 'process' | 'condition' | 'end';
  promptType: 'static' | 'dynamic' | 'none';
  staticPrompt: string;
  dynamicSources: DynamicSource[];
  editableSection: string;
  llmEnabled: boolean;
  llmConfig: LLMConfig;
  position: { x: number; y: number };
  hideFortuneTerms?: boolean;
}

export interface LangGraphEdge {
  source: string;
  target: string;
  label: string;
  conditionType: 'always' | 'conditional';
}

export interface LangGraphFlowDetail {
  flowId: string;
  flowName: string;
  description: string;
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableModels {
  ollama: string[];
  api: {
    deepseek: string[];
    openai: string[];
  };
}

export function useLangGraph() {
  const [flows, setFlows] = useState<LangGraphFlow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<LangGraphFlowDetail | null>(null);
  const [models, setModels] = useState<AvailableModels | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; data: LangGraphFlow[] }>('/admin/langgraph/flows');
      if (result.success && result.data) {
        setFlows(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFlowDetail = useCallback(async (flowId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; data: LangGraphFlowDetail }>(`/admin/langgraph/flows/${flowId}`);
      console.log('[useLangGraph] API result:', result);
      console.log('[useLangGraph] Nodes:', result.data?.nodes?.length);
      console.log('[useLangGraph] Edges:', result.data?.edges?.length);
      if (result.success && result.data) {
        setCurrentFlow(result.data);
      } else {
        setError((result as any).error || 'Failed to load flow data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flow detail');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateNodeConfig = useCallback(async (
    flowId: string,
    nodeId: string,
    updates: {
      staticPrompt?: string;
      editableSection?: string;
      llmConfig?: Partial<LLMConfig>;
      hideFortuneTerms?: boolean;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; message: string; data: any }>(
        `/admin/langgraph/flows/${flowId}/nodes/${nodeId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      if (result.success) {
        // Refresh flow detail
        await fetchFlowDetail(flowId);
        return { success: true, message: result.message };
      }
      return { success: false, message: 'Update failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update node';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [fetchFlowDetail]);

  const fetchModels = useCallback(async () => {
    try {
      const result = await adminApiRequest<{ success: boolean; data: AvailableModels }>('/admin/langgraph/models');
      if (result.success && result.data) {
        setModels(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  }, []);

  const resetFlowConfig = useCallback(async (flowId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; data: LangGraphFlowDetail; message: string }>(
        `/admin/langgraph/flows/${flowId}/reset`,
        { method: 'POST' }
      );
      if (result.success && result.data) {
        setCurrentFlow(result.data);
        return { success: true, message: result.message };
      }
      return { success: false, message: (result as any).error || 'Reset failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset flow';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
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
  };
}
