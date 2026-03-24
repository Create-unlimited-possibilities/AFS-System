'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { QuestionRole, QuestionLayer } from '@/lib/admin-api';

export type ExportFormat = 'json' | 'docx';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportFilters {
  role: QuestionRole | 'all';
  layer: QuestionLayer | 'all';
  format: ExportFormat;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [filters, setFilters] = useState<ExportFilters>({
    role: 'all',
    layer: 'all',
    format: 'json',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportCount, setExportCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedPath, setSavedPath] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setErrorMessage('');
    setSavedPath('');

    try {
      const params = new URLSearchParams();
      if (filters.role !== 'all') params.append('role', filters.role);
      if (filters.layer !== 'all') params.append('layer', filters.layer);
      params.append('format', filters.format);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/questions/export?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `导出失败 (${response.status})`);
      }

      const format = filters.format;
      const timestamp = new Date().toISOString().slice(0, 10);
      const defaultFileName = `questions-${timestamp}.${format}`;

      let blob: Blob;
      let count = 0;

      if (format === 'json') {
        const data = await response.json();
        count = (data.questions || data)?.length || 0;
        const dataStr = JSON.stringify(data.questions || data, null, 2);
        blob = new Blob([dataStr], { type: 'application/json' });
      } else {
        blob = await response.blob();
        count = 1;
      }

      // Try to use File System Access API for user-selected save location
      let saved = false;

      if ('showSaveFilePicker' in window) {
        try {
          const pickerOpts = {
            suggestedName: defaultFileName,
            types: format === 'json'
              ? [{
                  description: 'JSON 文件',
                  accept: { 'application/json': ['.json'] }
                }]
              : [{
                  description: 'Word 文档',
                  accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
                }],
          };

          const handle = await (window as any).showSaveFilePicker(pickerOpts);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          saved = true;
          setSavedPath(handle.name || '您选择的位置');
        } catch (pickerError: any) {
          if (pickerError.name !== 'AbortError') {
            console.log('File picker cancelled or not available, using download fallback');
          }
        }
      }

      // Fallback to traditional download if File System API not used
      if (!saved) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSavedPath('下载文件夹');
      }

      setExportStatus('success');
      setExportCount(count);

    } catch (error: any) {
      console.error('Export error:', error);
      setExportStatus('error');
      setErrorMessage(error.message || '导出过程中发生错误');
    } finally {
      setIsExporting(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      role: 'all',
      layer: 'all',
      format: 'json',
    });
    setExportStatus('idle');
    setErrorMessage('');
    setSavedPath('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetFilters();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>导出问卷</DialogTitle>
          <DialogDescription>
            选择导出的角色、层级和文件格式，可选择保存位置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>角色</Label>
            <Select
              value={filters.role}
              onValueChange={(value: QuestionRole | 'all') =>
                setFilters({ ...filters, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="elder">老人</SelectItem>
                <SelectItem value="family">家人</SelectItem>
                <SelectItem value="friend">朋友</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>层级</Label>
            <Select
              value={filters.layer}
              onValueChange={(value: QuestionLayer | 'all') =>
                setFilters({ ...filters, layer: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="basic">基础层</SelectItem>
                <SelectItem value="emotional">情感层</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>格式</Label>
            <Select
              value={filters.format}
              onValueChange={(value: ExportFormat) =>
                setFilters({ ...filters, format: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (用于导入)</SelectItem>
                <SelectItem value="docx">DOCX (用于分发)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            {filters.format === 'json' ? (
              <p>JSON 格式可用于备份或导入到其他系统</p>
            ) : (
              <p>DOCX 格式适合打印和分发给用户</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              支持选择保存位置（需要现代浏览器）
            </p>
          </div>

          {/* Export Status Feedback */}
          {exportStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  {filters.format === 'json'
                    ? `成功导出 ${exportCount} 个问题！`
                    : 'Word 文档导出成功！'}
                </p>
                {savedPath && (
                  <p className="text-sm text-green-600">保存位置：{savedPath}</p>
                )}
              </div>
            </div>
          )}

          {exportStatus === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            {exportStatus === 'success' ? '关闭' : '取消'}
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                导出中...
              </>
            ) : (
              '导出'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
