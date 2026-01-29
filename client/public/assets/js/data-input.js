const currentElderCode = 
  localStorage.getItem('elderCode') || 
  localStorage.getItem('afs-code') || 
  new URLSearchParams(window.location.search).get('code') || 
  '';

// 统一读取当前登录者的角色（elder / family / friend）
const currentRole = 
  localStorage.getItem('role') || 
  localStorage.getItem('afs-role') || 
  'family'; // 默认给家属看

// 如果没有编号，强制跳回登录
if (!currentElderCode || currentElderCode === 'null') {
  alert('请先登录');
  window.location.href = 'login.html';
}

// 统一的请求头（自动带 token）
const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('afs-token') || ''}`
};


//#layers-container 动态注入进度
async function loadProgress() {
  const container = $('#layers-container');
  
  try {
    const res = await fetch(
      `/api/questions/progress?elderCode=${currentElderCode}&role=${currentRole}`,
      { headers: authHeaders }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log('进度数据已加载：', data);

    // 清空加载中状态，动态生成三个层次的进度卡片
    container.empty();

    const layers = [
      { key: 'basic', name: '基础层次', color: 'primary' },
      { key: 'emotional', name: '情感与行为层次', color: 'success' },
      { key: 'ethics', name: '伦理与验证层次', color: 'warning' }
    ];

    layers.forEach(l => {
      const info = data[l.key] || { total: 0, answered: 0, progress: 0 };
      const html = `
        <div class="mb-4 p-3 border rounded bg-light">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0 text-${l.color} fw-bold">${l.name}</h6>
            <span class="badge bg-${l.color} fs-6">${info.answered}/${info.total}</span>
          </div>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar bg-${l.color}" 
                 style="width: ${info.progress}%">
              <span class="text-dark fw-bold">${info.progress}%</span>
            </div>
          </div>
        </div>
      `;
      container.append(html);
    });

  } catch (err) {
    container.html(`
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle text-danger fa-2x"></i>
        <p class="mt-3 text-danger">加载进度失败</p>
        <button class="btn btn-sm btn-outline-primary" onclick="loadProgress()">重试</button>
      </div>
    `);
    console.error('加载进度失败', err);
  }
}

// 加载当前层次的题目
async function loadQuestions(layer = 'basic') {
  $('#questions-container').html(
    '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>加载中...</p></div>'
  );

  try {
    const res = await fetch(
      `/api/questions?layer=${layer}&elderCode=${currentElderCode}&role=${currentRole}`,
      { headers: authHeaders }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || '加载失败');

    let html = '';
    data.questions.forEach(q => {
      html += `
        <div class="question-card mb-4 p-4 border rounded bg-white shadow-sm">
          <h6 class="mb-3 text-primary fw-bold">${q.order}. ${q.question}</h6>
          <textarea class="form-control answer-input" data-order="${q.order}" rows="5"
            placeholder="${q.placeholder || '在这里写下您的回忆...'}">${q.answer || ''}</textarea>
          <small class="text-success d-block mt-2">已自动保存</small>
        </div>`;
    });

    $('#questions-container').html(html || '<p class="text-center text-muted">此层次暂无题目</p>');
    $('#layer-title').text({
      basic: '基础层次',
      emotional: '情感与行为层次',
      ethics: '伦理与验证层次'
    }[layer]);
    $('#counter').text(`${data.answered}/${data.total}`);

    // 自动保存（失去焦点时）
    $('.answer-input').off('blur').on('blur', function () {
      const order = $(this).data('order');
      const answer = $(this).val().trim();
      if (answer) saveAnswer(order, answer, layer);
    });

  } catch (err) {
    $('#questions-container').html(`
      <div class="alert alert-danger text-center">
        加载失败：${err.message}<br>
        <button class="btn btn-sm btn-primary mt-3" onclick="loadQuestions('${layer}')">重新加载</button>
      </div>
    `);
    console.error('加载题目失败', err);
  }
}

// 保存单条答案
async function saveAnswer(order, answer, layer) {
  try {
    await fetch('/api/questions/answer', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        questionOrder: order,
        answer,
        layer,
        elderCode: currentElderCode
      })
    });
    loadProgress(); // 实时更新进度条
  } catch (err) {
    console.error('保存失败', err);
  }
}

// Tab 切换
$(document).on('click', '.layer-tab', function () {
  $('.layer-tab').removeClass('active');
  $(this).addClass('active');
  const layer = $(this).data('layer');
  loadQuestions(layer);
});

// 初始化入口
$(document).ready(() => {
  console.log('资料输入页初始化', { currentElderCode, currentRole });
  loadProgress();
  loadQuestions('basic');
});