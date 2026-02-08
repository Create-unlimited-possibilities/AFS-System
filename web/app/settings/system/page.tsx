'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import type { SystemSettings, SystemInfo } from '@/types';
import { Server, Globe, Zap, Sliders, Cpu, HardDrive, Clock, CheckCircle } from 'lucide-react';
import CloudPattern from '@/components/decorations/CloudPattern'

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
    return (
      <div className="min-h-screen gradient-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto relative">
          <div className="absolute top-10 left-10 opacity-10 animate-float">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
                <p className="text-gray-600 mt-1">配置系统参数和选项</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6 animate-slide-up">
              <Card className="hover:shadow-xl transition-all duration-300">
                <CardContent className="p-4">
                  <nav className="space-y-2">
                    <button
                      onClick={() => setActiveTab('site')}
                      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-300 ${
                        activeTab === 'site'
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                          : 'hover:bg-purple-50 text-gray-700'
                      }`}
                    >
                      <Globe className="h-5 w-5" />
                      网站设置
                    </button>
                    <button
                      onClick={() => setActiveTab('features')}
                      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-300 ${
                        activeTab === 'features'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                          : 'hover:bg-blue-50 text-gray-700'
                      }`}
                    >
                      <Zap className="h-5 w-5" />
                      功能设置
                    </button>
                    <button
                      onClick={() => setActiveTab('limits')}
                      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-300 ${
                        activeTab === 'limits'
                          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                          : 'hover:bg-green-50 text-gray-700'
                      }`}
                    >
                      <Sliders className="h-5 w-5" />
                      限制设置
                    </button>
                    <button
                      onClick={() => setActiveTab('model')}
                      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-300 ${
                        activeTab === 'model'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                          : 'hover:bg-orange-50 text-gray-700'
                      }`}
                    >
                      <Cpu className="h-5 w-5" />
                      模型设置
                    </button>
                  </nav>
                </CardContent>
              </Card>

              {systemInfo && (
                <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Server className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold text-xl text-gray-900">系统信息</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600">用户数</span>
                        <span className="font-bold text-purple-700">{systemInfo.users}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600">问题数</span>
                        <span className="font-bold text-purple-700">{systemInfo.questions}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600">回答数</span>
                        <span className="font-bold text-purple-700">{systemInfo.answers}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          运行时间
                        </span>
                        <span className="font-bold text-purple-700">{Math.floor(systemInfo.uptime / 3600)} 小时</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600 flex items-center gap-2">
                          <HardDrive className="h-4 w-4" />
                          内存使用
                        </span>
                        <span className="font-bold text-purple-700">
                          {systemInfo.memory.used} MB / {systemInfo.memory.total} MB
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600">平台</span>
                        <span className="font-bold text-purple-700">{systemInfo.platform}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-purple-100">
                        <span className="text-gray-600">Node 版本</span>
                        <span className="font-bold text-purple-700">{systemInfo.nodeVersion}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="lg:col-span-2 hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 bg-gradient-to-br ${
                    activeTab === 'site' ? 'from-purple-500 to-purple-600' :
                    activeTab === 'features' ? 'from-blue-500 to-blue-600' :
                    activeTab === 'limits' ? 'from-green-500 to-green-600' :
                    'from-orange-500 to-orange-600'
                  } rounded-lg flex items-center justify-center`}>
                    {activeTab === 'site' && <Globe className="h-5 w-5 text-white" />}
                    {activeTab === 'features' && <Zap className="h-5 w-5 text-white" />}
                    {activeTab === 'limits' && <Sliders className="h-5 w-5 text-white" />}
                    {activeTab === 'model' && <Cpu className="h-5 w-5 text-white" />}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {activeTab === 'site' && '网站设置'}
                    {activeTab === 'features' && '功能设置'}
                    {activeTab === 'limits' && '限制设置'}
                    {activeTab === 'model' && '模型设置'}
                  </h2>
                </div>

                <div className="space-y-4">
                  {renderForm()}
                </div>

                <PermissionGate permissions={['system:update']}>
                  <div className="mt-8 pt-6 border-t-2 border-gray-200">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {saving ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          保存中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          保存设置
                        </>
                      )}
                    </Button>
                  </div>
                </PermissionGate>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
