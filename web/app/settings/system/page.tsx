'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { SystemSettings, SystemInfo } from '@/types';

export default function SystemPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'site' | 'features' | 'limits' | 'model'>('site');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSystemInfo();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setSettings(data.settings);
      setFormValues(data.settings);
    }
    setLoading(false);
  };

  const fetchSystemInfo = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/settings/info', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) {
      setSystemInfo(data.info);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/settings/${activeTab}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formValues[activeTab])
    });
    const data = await response.json();
    if (data.success) {
      setSettings(data.settings);
      alert('保存成功');
    }
    setSaving(false);
  };

  const renderForm = () => {
    if (!settings) return null;

    switch (activeTab) {
      case 'site':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="site-name">网站名称</Label>
              <Input
                id="site-name"
                value={formValues.site?.name || ''}
                onChange={(e) => setFormValues({
                  ...formValues,
                  site: { ...formValues.site, name: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="site-description">网站描述</Label>
              <Input
                id="site-description"
                value={formValues.site?.description || ''}
                onChange={(e) => setFormValues({
                  ...formValues,
                  site: { ...formValues.site, description: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="site-logo">Logo URL</Label>
              <Input
                id="site-logo"
                value={formValues.site?.logo || ''}
                onChange={(e) => setFormValues({
                  ...formValues,
                  site: { ...formValues.site, logo: e.target.value }
                })}
              />
            </div>
          </div>
        );
      case 'features':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="registration-enabled"
                checked={formValues.features?.registrationEnabled || false}
                onChange={(e) => setFormValues({
                  ...formValues,
                  features: { ...formValues.features, registrationEnabled: e.target.checked }
                })}
                className="w-4 h-4"
              />
              <Label htmlFor="registration-enabled">启用用户注册</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="email-verification"
                checked={formValues.features?.emailVerificationRequired || false}
                onChange={(e) => setFormValues({
                  ...formValues,
                  features: { ...formValues.features, emailVerificationRequired: e.target.checked }
                })}
                className="w-4 h-4"
              />
              <Label htmlFor="email-verification">需要邮箱验证</Label>
            </div>
            <div>
              <Label htmlFor="max-upload-size">最大上传大小 (字节)</Label>
              <Input
                id="max-upload-size"
                type="number"
                value={formValues.features?.maxUploadSize || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  features: { ...formValues.features, maxUploadSize: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        );
      case 'limits':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="max-questions">每个用户最大问题数</Label>
              <Input
                id="max-questions"
                type="number"
                value={formValues.limits?.maxQuestionsPerUser || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  limits: { ...formValues.limits, maxQuestionsPerUser: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label htmlFor="max-answers">每个用户最大回答数</Label>
              <Input
                id="max-answers"
                type="number"
                value={formValues.limits?.maxAnswersPerUser || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  limits: { ...formValues.limits, maxAnswersPerUser: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label htmlFor="max-relationships">每个用户最大关系数</Label>
              <Input
                id="max-relationships"
                type="number"
                value={formValues.limits?.maxRelationshipsPerUser || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  limits: { ...formValues.limits, maxRelationshipsPerUser: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        );
      case 'model':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="default-model">默认模型</Label>
              <Input
                id="default-model"
                value={formValues.model?.defaultModel || ''}
                onChange={(e) => setFormValues({
                  ...formValues,
                  model: { ...formValues.model, defaultModel: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="max-tokens">最大 Token 数</Label>
              <Input
                id="max-tokens"
                type="number"
                value={formValues.model?.maxTokens || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  model: { ...formValues.model, maxTokens: parseInt(e.target.value) }
                })}
              />
            </div>
            <div>
              <Label htmlFor="temperature">温度参数 (0-1)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={formValues.model?.temperature || 0}
                onChange={(e) => setFormValues({
                  ...formValues,
                  model: { ...formValues.model, temperature: parseFloat(e.target.value) }
                })}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">加载中...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">系统设置</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <Card className="p-4">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('site')}
                className={`w-full text-left px-4 py-2 rounded ${activeTab === 'site' ? 'bg-blue-100' : ''}`}
              >
                网站设置
              </button>
              <button
                onClick={() => setActiveTab('features')}
                className={`w-full text-left px-4 py-2 rounded ${activeTab === 'features' ? 'bg-blue-100' : ''}`}
              >
                功能设置
              </button>
              <button
                onClick={() => setActiveTab('limits')}
                className={`w-full text-left px-4 py-2 rounded ${activeTab === 'limits' ? 'bg-blue-100' : ''}`}
              >
                限制设置
              </button>
              <button
                onClick={() => setActiveTab('model')}
                className={`w-full text-left px-4 py-2 rounded ${activeTab === 'model' ? 'bg-blue-100' : ''}`}
              >
                模型设置
              </button>
            </nav>
          </Card>

          {systemInfo && (
            <Card className="p-4 mt-4">
              <h3 className="font-semibold mb-4">系统信息</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">用户数:</span> {systemInfo.users}</div>
                <div><span className="text-gray-600">问题数:</span> {systemInfo.questions}</div>
                <div><span className="text-gray-600">回答数:</span> {systemInfo.answers}</div>
                <div><span className="text-gray-600">运行时间:</span> {Math.floor(systemInfo.uptime / 3600)} 小时</div>
                <div><span className="text-gray-600">内存使用:</span> {systemInfo.memory.used} MB / {systemInfo.memory.total} MB</div>
                <div><span className="text-gray-600">平台:</span> {systemInfo.platform}</div>
                <div><span className="text-gray-600">Node 版本:</span> {systemInfo.nodeVersion}</div>
              </div>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2 p-6">
          <h2 className="text-xl font-semibold mb-4">
            {activeTab === 'site' && '网站设置'}
            {activeTab === 'features' && '功能设置'}
            {activeTab === 'limits' && '限制设置'}
            {activeTab === 'model' && '模型设置'}
          </h2>

          {renderForm()}

          <PermissionGate permissions={['system:update']}>
            <div className="mt-6">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </PermissionGate>
        </Card>
      </div>
    </div>
  );
}
