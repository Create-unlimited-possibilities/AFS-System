'use client'

import { useState } from 'react';
import { ChevronUp, ChevronDown, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { AdminQuestion, QuestionRole, QuestionLayer } from '@/lib/admin-api';

interface QuestionListProps {
  questions: AdminQuestion[];
  isLoading: boolean;
  onEdit: (question: AdminQuestion) => void;
  onDelete: (questionId: string) => Promise<void>;
  onToggleStatus: (questionId: string, active: boolean) => Promise<void>;
  onMoveUp?: (questionId: string) => Promise<void>;
  onMoveDown?: (questionId: string) => Promise<void>;
}

const ROLE_LABELS: Record<string, string> = {
  elder: '老人',
  family: '家人',
  friend: '朋友',
};

const LAYER_LABELS: Record<string, string> = {
  basic: '基础层',
  emotional: '情感层',
};

const TYPE_LABELS: Record<string, string> = {
  text: '单行文本',
  textarea: '多行文本',
  voice: '语音输入',
};

const ROLE_COLORS: Record<string, string> = {
  elder: 'bg-blue-100 text-blue-700 border-blue-300',
  family: 'bg-green-100 text-green-700 border-green-300',
  friend: 'bg-purple-100 text-purple-700 border-purple-300',
};

export function QuestionList({
  questions,
  isLoading,
  onEdit,
  onDelete,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
}: QuestionListProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    questionId: string;
    questionText: string;
    action: 'delete' | 'activate' | 'deactivate';
  }>({
    isOpen: false,
    questionId: '',
    questionText: '',
    action: 'delete',
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async (questionId: string, questionText: string) => {
    setConfirmDialog({
      isOpen: true,
      questionId,
      questionText,
      action: 'delete',
    });
  };

  const handleToggleStatus = (questionId: string, active: boolean, questionText: string) => {
    setConfirmDialog({
      isOpen: true,
      questionId,
      questionText,
      action: active ? 'deactivate' : 'activate',
    });
  };

  const handleConfirmAction = async () => {
    setIsProcessing(true);
    try {
      if (confirmDialog.action === 'delete') {
        await onDelete(confirmDialog.questionId);
      } else if (confirmDialog.action === 'activate') {
        await onToggleStatus(confirmDialog.questionId, true);
      } else if (confirmDialog.action === 'deactivate') {
        await onToggleStatus(confirmDialog.questionId, false);
      }
      setConfirmDialog({
        isOpen: false,
        questionId: '',
        questionText: '',
        action: 'delete',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">暂无问题</p>
          <p className="text-sm text-gray-400 mt-1">点击"添加问题"创建第一个问题</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {questions.map((question, index) => (
          <Card
            key={question._id}
            className={`transition-all ${
              !question.active ? 'opacity-60 bg-gray-50' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Order Number and Move Buttons */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-gray-500">#{question.order}</span>
                  {onMoveUp && onMoveDown && (
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onMoveUp(question._id)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onMoveDown(question._id)}
                        disabled={index === questions.length - 1}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Question Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={ROLE_COLORS[question.role]}>
                      {ROLE_LABELS[question.role]}
                    </Badge>
                    <Badge variant="outline">
                      {LAYER_LABELS[question.layer]}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {TYPE_LABELS[question.type]}
                    </Badge>
                    {question.active ? (
                      <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                        启用
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-gray-100 text-gray-600 border-gray-300">
                        禁用
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-900 font-medium">{question.question}</p>
                  {question.placeholder && (
                    <p className="text-sm text-gray-500 mt-1">
                      提示: {question.placeholder}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleStatus(question._id, question.active, question.question)}
                    title={question.active ? '禁用' : '启用'}
                  >
                    {question.active ? (
                      <PowerOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Power className="w-4 h-4 text-green-500" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(question)}>
                        <Edit className="w-4 h-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(question._id, question.active, question.question)}
                      >
                        {question.active ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-2" />
                            禁用
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-2" />
                            启用
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(question._id, question.question)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={
          confirmDialog.action === 'delete'
            ? '删除问题'
            : confirmDialog.action === 'activate'
            ? '启用问题'
            : '禁用问题'
        }
        description={
          confirmDialog.action === 'delete'
            ? `确定要删除问题 "${confirmDialog.questionText}" 吗？此操作不可撤销。`
            : confirmDialog.action === 'activate'
            ? `确定要启用问题 "${confirmDialog.questionText}" 吗？`
            : `确定要禁用问题 "${confirmDialog.questionText}" 吗？`
        }
        confirmText={
          confirmDialog.action === 'delete'
            ? '删除'
            : confirmDialog.action === 'activate'
            ? '启用'
            : '禁用'
        }
        variant={confirmDialog.action === 'delete' ? 'danger' : 'warning'}
        isLoading={isProcessing}
      />
    </>
  );
}
