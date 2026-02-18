# 角色卡管理弹窗实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建角色卡管理弹窗，允许用户查看各层生成状态并单独触发每个层的生成。

**Architecture:** 后端新增 4 个 API 端点（1 个状态查询 + 3 个 SSE 生成端点），前端创建 RegenerateModal 组件复用现有 Modal，实现 SSE 进度显示。

**Tech Stack:** Express.js (SSE), Next.js App Router, Tailwind CSS, 现有 Modal 组件

---

## Task 1: 后端 - 获取各层状态 API

**Files:**
- Modify: `server/src/modules/rolecard/route.js`
- Modify: `server/src/modules/rolecard/controller.js`

**Step 1: 在 route.js 添加状态查询路由**

```javascript
// 在现有路由后添加
router.get('/layers/status', protect, (req, res) => {
  rolecardController.getLayersStatus(req, res);
});
```

**Step 2: 在 controller.js 添加 getLayersStatus 方法**

```javascript
/**
 * 获取各层生成状态
 */
async getLayersStatus(req, res) {
  const userId = req.user.id;

  try {
    // 获取核心层状态
    const coreLayer = await this.dualStorage.loadCoreLayer(userId);

    // 获取关系层状态
    const relationLayers = await this.dualStorage.loadAllRelationLayers(userId);

    // 获取所有协助关系
    const relations = await mongoose.model('AssistRelation').find({ targetId: userId })
      .populate('assistantId', 'name');

    // 获取每个协助者的答案数量
    const relationsWithStatus = await Promise.all(relations.map(async (relation) => {
      const relationId = relation._id.toString();
      const assistantId = relation.assistantId?._id?.toString();

      // 统计答案数量
      const answerCount = await mongoose.model('Answer').countDocuments({
        userId: assistantId,
        targetUserId: userId,
        isSelfAnswer: false
      });

      const existingLayer = relationLayers[relationId];

      let status;
      if (existingLayer) {
        status = 'generated';
      } else if (answerCount < 3) {
        status = 'insufficient_answers';
      } else {
        status = 'not_generated';
      }

      return {
        relationId,
        assistantId,
        assistantName: relation.assistantId?.name || '协助者',
        specificRelation: relation.specificRelation || '',
        relationshipType: relation.relationshipType,
        status,
        answerCount,
        generatedAt: existingLayer?.generatedAt
      };
    }));

    res.json({
      success: true,
      data: {
        coreLayer: {
          exists: !!coreLayer,
          generatedAt: coreLayer?.generatedAt
        },
        calibrationLayer: {
          exists: !!coreLayer // 校准层跟随核心层
        },
        safetyGuardrails: {
          loaded: true // 全局配置始终加载
        },
        relations: relationsWithStatus
      }
    });
  } catch (error) {
    logger.error('[RoleCardController] 获取层状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

**Step 3: 重启服务器测试**

```bash
cd F:/FPY/AFS-System && docker compose restart server
```

**Step 4: 验证 API**

使用浏览器或 curl 测试:
```
GET http://localhost:3001/api/rolecard/layers/status
```

**Step 5: Commit**

```bash
git add server/src/modules/rolecard/route.js server/src/modules/rolecard/controller.js
git commit -m "feat: add layers status API for regenerate modal"
```

---

## Task 2: 后端 - 单独生成核心层 API（SSE）

**Files:**
- Modify: `server/src/modules/rolecard/route.js`
- Modify: `server/src/modules/rolecard/controller.js`

**Step 1: 在 route.js 添加核心层生成路由**

```javascript
// 单独生成核心层（SSE）
router.post('/layers/core/stream', protect, (req, res) => {
  rolecardController.generateCoreLayerStream(req, res);
});
```

**Step 2: 在 controller.js 添加 generateCoreLayerStream 方法**

```javascript
/**
 * 单独生成核心层（SSE）
 */
async generateCoreLayerStream(req, res) {
  const userId = req.user.id;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (data) => {
    try {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error('[RoleCardController] SSE 写入失败:', error);
    }
  };

  try {
    sendProgress({ stage: 'start', message: '开始生成核心层', percentage: 0 });

    const coreLayer = await this.coreGenerator.generate(userId, (progress) => {
      sendProgress({
        stage: 'extracting',
        message: `提取答案 ${progress.current}/${progress.total}`,
        percentage: Math.round(progress.current / progress.total * 80),
        detail: progress
      });
    });

    // 保存核心层
    await this.dualStorage.saveCoreLayer(userId, coreLayer);

    // 创建并保存校准层
    const calibration = CalibrationLayerManager.createInitialCalibrationLayer(coreLayer);
    await this.dualStorage.saveCalibrationLayer?.(userId, calibration);

    sendProgress({ stage: 'complete', message: '核心层生成完成', percentage: 100 });

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('[RoleCardController] 核心层生成失败:', error);
    sendProgress({ stage: 'error', message: error.message, percentage: 0 });
    res.end();
  }
}
```

**Step 3: 重启并测试**

```bash
cd F:/FPY/AFS-System && docker compose restart server
```

**Step 4: Commit**

```bash
git add server/src/modules/rolecard/route.js server/src/modules/rolecard/controller.js
git commit -m "feat: add core layer SSE generation API"
```

---

## Task 3: 后端 - 单独生成关系层 API（SSE）

**Files:**
- Modify: `server/src/modules/rolecard/route.js`
- Modify: `server/src/modules/rolecard/controller.js`

**Step 1: 在 route.js 添加关系层生成路由**

```javascript
// 单独生成某个关系层（SSE）
router.post('/layers/relation/:relationId/stream', protect, (req, res) => {
  rolecardController.generateRelationLayerStream(req, res);
});
```

**Step 2: 在 controller.js 添加 generateRelationLayerStream 方法**

```javascript
/**
 * 单独生成某个关系层（SSE）
 */
async generateRelationLayerStream(req, res) {
  const userId = req.user.id;
  const { relationId } = req.params;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (data) => {
    try {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error('[RoleCardController] SSE 写入失败:', error);
    }
  };

  try {
    // 获取协助关系
    const relation = await mongoose.model('AssistRelation').findOne({
      _id: relationId,
      targetId: userId
    }).populate('assistantId');

    if (!relation) {
      throw new Error('协助关系不存在');
    }

    sendProgress({ stage: 'start', message: `开始生成 ${relation.assistantId?.name} 的关系层`, percentage: 0 });

    const layer = await this.relationGenerator.generateOne(userId, relation, (progress) => {
      sendProgress({
        stage: 'extracting',
        message: `处理答案 ${progress.current}/${progress.total}`,
        percentage: Math.round(progress.current / progress.total * 80),
        detail: progress
      });
    });

    if (!layer) {
      sendProgress({ stage: 'error', message: '答案不足，无法生成', percentage: 0 });
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ success: false, error: 'insufficient_answers' })}\n\n`);
      res.end();
      return;
    }

    // 保存关系层
    await this.dualStorage.saveRelationLayer(userId, relationId, layer);

    sendProgress({ stage: 'complete', message: '关系层生成完成', percentage: 100 });

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('[RoleCardController] 关系层生成失败:', error);
    sendProgress({ stage: 'error', message: error.message, percentage: 0 });
    res.end();
  }
}
```

**Step 3: 重启并测试**

```bash
cd F:/FPY/AFS-System && docker compose restart server
```

**Step 4: Commit**

```bash
git add server/src/modules/rolecard/route.js server/src/modules/rolecard/controller.js
git commit -m "feat: add relation layer SSE generation API"
```

---

## Task 4: 后端 - 批量生成 API（SSE）

**Files:**
- Modify: `server/src/modules/rolecard/route.js`
- Modify: `server/src/modules/rolecard/controller.js`

**Step 1: 在 route.js 添加批量生成路由**

```javascript
// 批量生成未生成的层（SSE）
router.post('/layers/batch/stream', protect, (req, res) => {
  rolecardController.generateBatchStream(req, res);
});
```

**Step 2: 在 controller.js 添加 generateBatchStream 方法**

```javascript
/**
 * 批量生成未生成的层（SSE）
 */
async generateBatchStream(req, res) {
  const userId = req.user.id;
  const { layers } = req.body; // ['relation:xxx', 'relation:yyy']

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (data) => {
    try {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error('[RoleCardController] SSE 写入失败:', error);
    }
  };

  try {
    const total = layers.length;
    let completed = 0;

    sendProgress({ stage: 'start', message: `开始批量生成 ${total} 个层`, percentage: 0, current: 0, total });

    for (const layerSpec of layers) {
      const [type, id] = layerSpec.split(':');

      if (type === 'relation') {
        const relation = await mongoose.model('AssistRelation').findOne({
          _id: id,
          targetId: userId
        }).populate('assistantId');

        if (relation) {
          sendProgress({
            stage: 'generating',
            message: `正在生成 ${relation.assistantId?.name} 的关系层`,
            percentage: Math.round(completed / total * 100),
            current: completed,
            total
          });

          const layer = await this.relationGenerator.generateOne(userId, relation);
          if (layer) {
            await this.dualStorage.saveRelationLayer(userId, id, layer);
          }
        }
      }

      completed++;
      sendProgress({
        stage: 'progress',
        message: `完成 ${completed}/${total}`,
        percentage: Math.round(completed / total * 100),
        current: completed,
        total
      });
    }

    sendProgress({ stage: 'complete', message: '批量生成完成', percentage: 100, current: total, total });

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ success: true })}\n\n`);
    res.end();
  } catch (error) {
    logger.error('[RoleCardController] 批量生成失败:', error);
    sendProgress({ stage: 'error', message: error.message, percentage: 0 });
    res.end();
  }
}
```

**Step 3: 重启并测试**

```bash
cd F:/FPY/AFS-System && docker compose restart server
```

**Step 4: Commit**

```bash
git add server/src/modules/rolecard/route.js server/src/modules/rolecard/controller.js
git commit -m "feat: add batch layer SSE generation API"
```

---

## Task 5: 前端 - 创建 API 调用函数

**Files:**
- Modify: `web/lib/api.ts`

**Step 1: 添加 API 调用函数**

```typescript
// 在 api.ts 中添加

// 获取各层状态
export async function getLayersStatus(): Promise<{
  success: boolean;
  data?: {
    coreLayer: { exists: boolean; generatedAt?: string };
    calibrationLayer: { exists: boolean };
    safetyGuardrails: { loaded: boolean };
    relations: Array<{
      relationId: string;
      assistantId: string;
      assistantName: string;
      specificRelation: string;
      relationshipType: 'family' | 'friend';
      status: 'generated' | 'not_generated' | 'insufficient_answers';
      answerCount: number;
      generatedAt?: string;
    }>;
  };
  error?: string;
}> {
  return api.get('/rolecard/layers/status');
}

// SSE 生成函数
export function generateLayerWithSSE(
  endpoint: string,
  onProgress: (data: any) => void,
  onComplete: () => void,
  onError: (error: string) => void
): () => void {
  const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    withCredentials: true
  });

  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    onProgress(data);
  });

  eventSource.addEventListener('done', () => {
    eventSource.close();
    onComplete();
  });

  eventSource.onerror = (error) => {
    eventSource.close();
    onError('连接失败');
  };

  return () => eventSource.close();
}
```

**Step 2: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat: add layer status and SSE generation API functions"
```

---

## Task 6: 前端 - 创建 RegenerateModal 组件

**Files:**
- Create: `web/app/rolecard/components/RegenerateModal.tsx`

**Step 1: 创建组件**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { getLayersStatus, generateLayerWithSSE } from '@/lib/api'
import { Loader2, CheckCircle, AlertCircle, Settings } from 'lucide-react'

interface LayersStatus {
  coreLayer: { exists: boolean; generatedAt?: string }
  calibrationLayer: { exists: boolean }
  safetyGuardrails: { loaded: boolean }
  relations: Array<{
    relationId: string
    assistantId: string
    assistantName: string
    specificRelation: string
    relationshipType: 'family' | 'friend'
    status: 'generated' | 'not_generated' | 'insufficient_answers'
    answerCount: number
    generatedAt?: string
  }>
}

interface RegenerateModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function RegenerateModal({ isOpen, onClose, onComplete }: RegenerateModalProps) {
  const [status, setStatus] = useState<LayersStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<{
    type: 'core' | 'relation' | 'batch' | null
    targetId?: string
    progress: number
    message: string
    current?: number
    total?: number
  } | null>(null)

  // 加载状态
  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLayersStatus()
      if (res.success && res.data) {
        setStatus(res.data)
      }
    } catch (error) {
      console.error('加载状态失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadStatus()
    }
  }, [isOpen, loadStatus])

  // 生成核心层
  const generateCore = () => {
    setGenerating({ type: 'core', progress: 0, message: '开始生成...' })

    // 使用 POST 请求创建 SSE
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rolecard/layers/core/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }).then(response => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const read = () => {
        reader?.read().then(({ done, value }) => {
          if (done) {
            setGenerating(null)
            loadStatus()
            onComplete()
            return
          }

          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                setGenerating(prev => prev ? { ...prev, progress: data.percentage, message: data.message } : null)
              } catch (e) {}
            }
          }

          read()
        })
      }

      read()
    }).catch(error => {
      console.error('生成失败:', error)
      setGenerating(null)
    })
  }

  // 生成单个关系层
  const generateRelation = (relationId: string, assistantName: string) => {
    setGenerating({ type: 'relation', targetId: relationId, progress: 0, message: `开始生成 ${assistantName} 的关系层...` })

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rolecard/layers/relation/${relationId}/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }).then(response => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const read = () => {
        reader?.read().then(({ done, value }) => {
          if (done) {
            setGenerating(null)
            loadStatus()
            onComplete()
            return
          }

          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                setGenerating(prev => prev ? { ...prev, progress: data.percentage, message: data.message } : null)
              } catch (e) {}
            }
          }

          read()
        })
      }

      read()
    }).catch(error => {
      console.error('生成失败:', error)
      setGenerating(null)
    })
  }

  // 批量生成
  const generateBatch = () => {
    if (!status) return

    const pendingRelations = status.relations
      .filter(r => r.status === 'not_generated')
      .map(r => `relation:${r.relationId}`)

    if (pendingRelations.length === 0) return

    setGenerating({ type: 'batch', progress: 0, message: '开始批量生成...', total: pendingRelations.length, current: 0 })

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rolecard/layers/batch/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layers: pendingRelations })
    }).then(response => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const read = () => {
        reader?.read().then(({ done, value }) => {
          if (done) {
            setGenerating(null)
            loadStatus()
            onComplete()
            return
          }

          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                setGenerating(prev => prev ? {
                  ...prev,
                  progress: data.percentage,
                  message: data.message,
                  current: data.current,
                  total: data.total
                } : null)
              } catch (e) {}
            }
          }

          read()
        })
      }

      read()
    }).catch(error => {
      console.error('批量生成失败:', error)
      setGenerating(null)
    })
  }

  // 全部重新生成
  const regenerateAll = () => {
    // 先生成核心层，再生成所有关系层
    // 这里简化处理：调用完整的 generate/stream
    generateCore()
  }

  if (!isOpen) return null

  const pendingRelations = status?.relations.filter(r => r.status !== 'generated') || []
  const generatedRelations = status?.relations.filter(r => r.status === 'generated') || []
  const hasPending = pendingRelations.some(r => r.status === 'not_generated')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={generating ? undefined : onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] mx-4 max-h-[70vh] sm:max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">管理角色卡</h2>
          <button
            onClick={generating ? undefined : onClose}
            disabled={!!generating}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : status ? (
            <>
              {/* 核心层区域 */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-500">核心层</h3>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">核心层</span>
                    <StatusBadge status={status.coreLayer.exists ? 'generated' : 'not_generated'} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateCore}
                    disabled={!!generating}
                  >
                    {generating?.type === 'core' ? <Loader2 className="w-4 h-4 animate-spin" /> : '重新生成'}
                  </Button>
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">校准层</span>
                    <StatusBadge status={status.calibrationLayer.exists ? 'generated' : 'not_generated'} />
                  </div>
                  <span className="text-xs text-gray-400">自动跟随核心层</span>
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">安全护栏</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">已加载</span>
                  </div>
                  <span className="text-xs text-gray-400">全局配置</span>
                </div>
              </div>

              <div className="border-t" />

              {/* 未生成的关系层 */}
              {pendingRelations.length > 0 && (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-500">关系层 - 待生成</h3>

                    {pendingRelations.map((relation) => (
                      <div key={relation.relationId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{relation.assistantName}</span>
                          <span className="text-xs text-gray-400">({relation.specificRelation})</span>
                          <StatusBadge
                            status={relation.status}
                            answerCount={relation.answerCount}
                          />
                        </div>
                        {relation.status === 'insufficient_answers' ? (
                          <Button size="sm" variant="outline" disabled className="opacity-50">
                            --
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                            onClick={() => generateRelation(relation.relationId, relation.assistantName)}
                            disabled={!!generating}
                          >
                            {generating?.type === 'relation' && generating?.targetId === relation.relationId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '生成'
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {hasPending && (
                    <Button
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                      onClick={generateBatch}
                      disabled={!!generating}
                    >
                      {generating?.type === 'batch' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          生成中...
                        </>
                      ) : (
                        '生成全部未生成的关系层'
                      )}
                    </Button>
                  )}

                  <div className="border-t" />
                </>
              )}

              {/* 已生成的关系层 */}
              {generatedRelations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500">关系层 - 已生成</h3>

                  {generatedRelations.map((relation) => (
                    <div key={relation.relationId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{relation.assistantName}</span>
                        <span className="text-xs text-gray-400">({relation.specificRelation})</span>
                        <StatusBadge status="generated" />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateRelation(relation.relationId, relation.assistantName)}
                        disabled={!!generating}
                      >
                        {generating?.type === 'relation' && generating?.targetId === relation.relationId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          '重新生成'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* 进度条 */}
        {generating && (
          <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${generating.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{generating.message}</p>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="p-4 border-t flex-shrink-0">
          <Button
            className="w-full"
            variant="outline"
            onClick={regenerateAll}
            disabled={!!generating}
          >
            {generating?.type === 'core' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                生成中...
              </>
            ) : (
              '全部重新生成'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// 状态标签组件
function StatusBadge({ status, answerCount }: { status: string; answerCount?: number }) {
  switch (status) {
    case 'generated':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">已生成</span>
    case 'not_generated':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">待生成</span>
    case 'insufficient_answers':
      return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">答案不足 ({answerCount}/3)</span>
    default:
      return null
  }
}
```

**Step 2: Commit**

```bash
git add web/app/rolecard/components/RegenerateModal.tsx
git commit -m "feat: create RegenerateModal component"
```

---

## Task 7: 前端 - 集成到角色卡页面

**Files:**
- Modify: `web/app/rolecard/page.tsx`

**Step 1: 添加 Modal 状态和导入**

在文件顶部添加导入:
```tsx
import RegenerateModal from './components/RegenerateModal'
import { Settings } from 'lucide-react'
```

在组件内添加状态:
```tsx
const [showRegenerateModal, setShowRegenerateModal] = useState(false)
```

**Step 2: 添加管理按钮（在生成按钮旁边）**

在 GenerateButton 旁边添加:
```tsx
{/* 管理角色卡按钮 */}
<Button
  variant="outline"
  size="lg"
  className="gap-2"
  onClick={() => setShowRegenerateModal(true)}
>
  <Settings className="h-5 w-5" />
  <span>管理角色卡</span>
</Button>

{/* 管理弹窗 */}
<RegenerateModal
  isOpen={showRegenerateModal}
  onClose={() => setShowRegenerateModal(false)}
  onComplete={fetchData}
/>
```

**Step 3: 测试构建**

```bash
cd F:/FPY/AFS-System/web && npm run build
```

**Step 4: 重启容器**

```bash
cd F:/FPY/AFS-System && docker compose restart web
```

**Step 5: Commit**

```bash
git add web/app/rolecard/page.tsx
git commit -m "feat: integrate RegenerateModal into rolecard page"
```

---

## Task 8: 集成测试

**Step 1: 测试状态 API**

```bash
curl http://localhost:3001/api/rolecard/layers/status -H "Authorization: Bearer <token>"
```

**Step 2: 测试前端弹窗**

1. 打开角色卡页面
2. 点击"管理角色卡"按钮
3. 验证弹窗显示各层状态

**Step 3: 测试单独生成**

1. 在弹窗中点击某个"生成"按钮
2. 验证进度条显示
3. 验证生成完成后状态更新

**Step 4: 测试批量生成**

1. 点击"生成全部未生成的关系层"
2. 验证批量进度显示
3. 验证所有状态更新

**Step 5: 测试响应式**

1. 在手机端宽度测试弹窗
2. 验证可滚动列表
3. 验证按钮布局

**Step 6: Final Commit**

```bash
git add -A
git commit -m "feat: complete rolecard regenerate modal implementation"
```
