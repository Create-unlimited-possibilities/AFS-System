// dashboard.js - 档案主页专用逻辑
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('elder-list');
  const token = localStorage.getItem('afs-token');

  // 模拟数据（等后端完成后再替换）
  const mockElders = [
    { name: '李明', code: 'LM19451015M', progress: 78, lastUpdate: '2025-12-09' },
    { name: '王芳', code: 'WF19520322F', progress: 45, lastUpdate: '2025-12-05' },
    { name: '张伟', code: 'ZW19380801M', progress: 92, lastUpdate: '2025-12-10' }
  ];

  // 真实接口（等优先级6完成后启用）
  /*
  const res = await fetch('/api/elders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const elders = res.ok ? await res.json() : mockElders;
  */

  const elders = mockElders;

  container.innerHTML = elders.map(elder => `
    <div class="col-md-4 mb-4">
      <div class="card elder-card text-center h-100">
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h5>${elder.name}</h5>
            <p class="text-muted">编号：${elder.code}</p>
            <div class="progress my-3">
              <div class="progress-bar" style="width: ${elder.progress}%"></div>
            </div>
            <p><small>完成度 ${elder.progress}%</small></p>
            <p class="text-muted"><small>最后更新：${elder.lastUpdate}</small></p>
          </div>
          <a href="data-input.html?code=${elder.code}" class="btn btn-outline-primary mt-3">
            继续填写
          </a>
        </div>
      </div>
    </div>
  `).join('');

  // 添加卡片动画
  document.querySelectorAll('.elder-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(50px)';
    setTimeout(() => {
      card.style.transition = 'all 0.8s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 200);
  });
});