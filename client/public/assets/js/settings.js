// settings.js - 个人设置专用逻辑
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.querySelector('.btn-primary');
  
  // 加载已有设置（模拟）
  const settings = {
    publicBasic: true,
    familyEmotional: true,
    emailNotify: true
  };

  // 恢复设置
  Object.keys(settings).forEach(key => {
    const el = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (el) el.checked = settings[key];
  });

  saveBtn.addEventListener('click', () => {
    // 真实保存接口（等后端完成）
    // await afsAPI.request('/settings', { method: 'POST', body: JSON.stringify(newSettings) });

    // 成功动画
    saveBtn.textContent = '已保存！';
    saveBtn.disabled = true;
    saveBtn.style.background = 'linear-gradient(45deg, #00d4ff, #e6b800)';

    setTimeout(() => {
      saveBtn.textContent = '保存设置';
      saveBtn.disabled = false;
      saveBtn.style.background = '';
    }, 2000);
  });
});