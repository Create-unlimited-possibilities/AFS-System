// web/app/admin/langgraph/components/FlowTabs.tsx
'use client';

import { cn } from '@/lib/utils';
import { GitBranch, MessageSquareHeart, User } from 'lucide-react';

interface FlowTab {
  flowId: string;
  flowName: string;
  icon: React.ReactNode;
}

const flowTabs: FlowTab[] = [
  { flowId: 'rolecard', flowName: 'AI角色卡对话', icon: <User className="w-4 h-4" /> },
  { flowId: 'xiaoshudong', flowName: '小树洞对话', icon: <MessageSquareHeart className="w-4 h-4" /> },
];

interface FlowTabsProps {
  activeFlowId: string;
  onFlowChange: (flowId: string) => void;
}

export function FlowTabs({ activeFlowId, onFlowChange }: FlowTabsProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
      {flowTabs.map((tab) => (
        <button
          key={tab.flowId}
          onClick={() => onFlowChange(tab.flowId)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeFlowId === tab.flowId
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          {tab.icon}
          {tab.flowName}
        </button>
      ))}
    </div>
  );
}
