'use client'

import { useState, useCallback, useRef } from 'react';
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
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { batchImportQuestions, type QuestionFormData } from '@/lib/admin-api';

export type ImportMode = 'replace' | 'append';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ question: string; error: string }>;
}

export function ImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>('append');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<QuestionFormData[] | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setParseError('');
    setImportResult(null);

    if (!selectedFile.name.endsWith('.json')) {
      setParseError('请选择 JSON 格式文件');
      setFile(null);
      setParsedData(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          setParseError('JSON 文件格式错误：根元素必须是数组');
          setParsedData(null);
          return;
        }

        if (data.length === 0) {
          setParseError('JSON 文件为空');
          setParsedData(null);
          return;
        }

        const validData = data.filter((item) => {
          return item.role && item.layer && item.question;
        });

        if (validData.length === 0) {
          setParseError('未找到有效的问题数据（需要包含 role、layer、question 字段）');
          setParsedData(null);
          return;
        }

        setParsedData(validData);
        setFile(selectedFile);

        if (validData.length < data.length) {
          setParseError(`已过滤 ${data.length - validData.length} 条无效数据`);
        } else {
          setParseError('');
        }
      } catch {
        setParseError('JSON 文件解析失败');
        setParsedData(null);
      }
    };

    reader.readAsText(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) {
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await batchImportQuestions(parsedData);
      if (result.success) {
        setImportResult({
          imported: result.imported || 0,
          failed: result.failed || 0,
          errors: result.errors || [],
        });

        if ((result.imported || 0) > 0) {
          onSuccess();
        }
      } else {
        setParseError(result.error || '导入失败');
      }
    } catch (error) {
      setParseError('导入过程中发生错误');
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFile(null);
      setParsedData(null);
      setParseError('');
      setImportResult(null);
      setMode('append');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(open);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      elder: '老人',
      family: '家人',
      friend: '朋友',
    };
    return labels[role] || role;
  };

  const getLayerLabel = (layer: string) => {
    const labels: Record<string, string> = {
      basic: '基础层',
      emotional: '情感层',
    };
    return labels[layer] || layer;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>导入问卷</DialogTitle>
          <DialogDescription>
            上传 JSON 文件批量导入问题
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>导入模式</Label>
            <Select
              value={mode}
              onValueChange={(value: ImportMode) => setMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">追加 - 保留现有问题</SelectItem>
                <SelectItem value="replace">覆盖 - 先删除所有问题</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {mode === 'append'
                ? '新问题将添加到现有问题列表末尾'
                : '导入前将删除所有现有问题，请谨慎操作'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>选择文件</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={handleUploadClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileInputChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <FileJson className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    拖拽文件到此处或点击上传
                  </p>
                  <p className="text-xs text-gray-400">仅支持 .json 格式</p>
                </div>
              )}
            </div>
          </div>

          {parseError && (
            <div className={`flex items-start gap-2 p-3 rounded-md ${
              parsedData ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800'
            }`}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{parseError}</p>
            </div>
          )}

          {parsedData && parsedData.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm font-medium text-blue-900 mb-2">
                预览：共 {parsedData.length} 个问题
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parsedData.slice(0, 5).map((q, i) => (
                  <p key={i} className="text-xs text-blue-800">
                    {getRoleLabel(q.role)} - {getLayerLabel(q.layer)}: {q.question}
                  </p>
                ))}
                {parsedData.length > 5 && (
                  <p className="text-xs text-blue-600">
                    ... 还有 {parsedData.length - 5} 个问题
                  </p>
                )}
              </div>
            </div>
          )}

          {importResult && (
            <div className={`p-4 rounded-lg ${
              importResult.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className="font-medium text-sm">
                导入完成：{importResult.imported} 个成功，{importResult.failed} 个失败
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">错误详情：</p>
                  <ul className="list-disc list-inside max-h-24 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err.question}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            {importResult && importResult.imported > 0 ? '关闭' : '取消'}
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            onClick={handleImport}
            disabled={isImporting || !parsedData || parsedData.length === 0}
          >
            {isImporting ? '导入中...' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
