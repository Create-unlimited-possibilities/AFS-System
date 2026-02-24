'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { X, Save } from 'lucide-react';
import type { QuestionFormData, QuestionRole, QuestionLayer, QuestionType } from '@/lib/admin-api';

interface QuestionFormProps {
  initialData?: (Partial<QuestionFormData> & { _id?: string }) | null;
  onSubmit: (data: QuestionFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const ROLE_LABELS: Record<QuestionRole, string> = {
  elder: '老人',
  family: '家人',
  friend: '朋友',
};

const LAYER_LABELS: Record<QuestionLayer, string> = {
  basic: '基础层',
  emotional: '情感层',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  text: '单行文本',
  textarea: '多行文本',
  voice: '语音输入',
};

export function QuestionForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = '保存问题',
}: QuestionFormProps) {
  const [formData, setFormData] = useState<QuestionFormData>({
    role: initialData?.role || 'elder',
    layer: initialData?.layer || 'basic',
    question: initialData?.question || '',
    placeholder: initialData?.placeholder || '',
    type: initialData?.type || 'textarea',
    active: initialData?.active ?? true,
    order: initialData?.order,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        role: initialData.role || 'elder',
        layer: initialData.layer || 'basic',
        question: initialData.question || '',
        placeholder: initialData.placeholder || '',
        type: initialData.type || 'textarea',
        active: initialData.active ?? true,
        order: initialData.order,
      });
    }
  }, [initialData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.question.trim()) {
      newErrors.question = '请输入问题内容';
    }

    if (!formData.role) {
      newErrors.role = '请选择问题角色';
    }

    if (!formData.layer) {
      newErrors.layer = '请选择问题层级';
    }

    if (!formData.type) {
      newErrors.type = '请选择问题类型';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (!result.success) {
        setErrors({ form: result.error || '保存失败' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{initialData?._id ? '编辑问题' : '创建新问题'}</CardTitle>
        <CardDescription>
          填写问题信息，设置目标角色和问题层级
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">
              问题角色 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: QuestionRole) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger id="role" className={errors.role ? 'border-red-500' : ''}>
                <SelectValue placeholder="选择问题角色" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
          </div>

          {/* Layer Selection */}
          <div className="space-y-2">
            <Label htmlFor="layer">
              问题层级 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.layer}
              onValueChange={(value: QuestionLayer) =>
                setFormData({ ...formData, layer: value })
              }
            >
              <SelectTrigger id="layer" className={errors.layer ? 'border-red-500' : ''}>
                <SelectValue placeholder="选择问题层级" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.layer && <p className="text-sm text-red-500">{errors.layer}</p>}
            <p className="text-xs text-gray-500">
              {formData.layer === 'basic' && '基础层问题用于收集基本信息'}
              {formData.layer === 'emotional' && '情感层问题用于深入了解情感和回忆'}
            </p>
          </div>

          {/* Question Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              问题类型 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: QuestionType) =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger id="type" className={errors.type ? 'border-red-500' : ''}>
                <SelectValue placeholder="选择问题类型" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
          </div>

          {/* Question Content */}
          <div className="space-y-2">
            <Label htmlFor="question">
              问题内容 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="question"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="请输入问题内容..."
              rows={3}
              className={errors.question ? 'border-red-500' : ''}
            />
            {errors.question && <p className="text-sm text-red-500">{errors.question}</p>}
          </div>

          {/* Placeholder */}
          <div className="space-y-2">
            <Label htmlFor="placeholder">输入提示</Label>
            <Input
              id="placeholder"
              value={formData.placeholder}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="可选的输入提示文本"
            />
            <p className="text-xs text-gray-500">
              为用户提供输入提示，例如："请详细描述..."
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <Label htmlFor="active" className="cursor-pointer">
              启用此问题
            </Label>
          </div>

          {/* Form Error */}
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errors.form}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
