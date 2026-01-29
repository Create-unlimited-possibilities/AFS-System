// client/public/assets/js/answer-questions.js - 问题回答页面逻辑

let allQuestions = [];
let originalAnswers = {};  // 原始答案（用于对比）
let currentAnswers = {};   // 当前答案
let targetUserId = null;   // 协助目标用户ID
let isAssisting = false;   // 是否在协助他人
let userRole = 'elder';    // 用户角色：elder(老人), family(家属), friend(朋友)

document.addEventListener('DOMContentLoaded', async () => {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 检查URL参数，判断是否在协助他人
  const urlParams = new URLSearchParams(window.location.search);
  targetUserId = urlParams.get('targetUserId');
  
  if (targetUserId) {
    isAssisting = true;
    document.getElementById('pageTitle').textContent = '协助回答问题';
    document.getElementById('pageSubtitle').textContent = '协助他人回答问题';
  }

  // 加载问题和答案
  await loadQuestionsAndAnswers();

  // 提交按钮事件
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);

  // 确认保存按钮事件
  document.getElementById('confirmSaveBtn').addEventListener('click', confirmSave);

  // 退出登录
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
  });
});

// 加载问题和答案
async function loadQuestionsAndAnswers() {
  try {
    const token = localStorage.getItem('token');
    
    // 确定用户角色
    if (isAssisting) {
      // 协助他人时，需要获取关系类型来确定角色
      const relationResponse = await fetch(`${API_BASE_URL}/api/auth/assist/relations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const relationData = await relationResponse.json();
      if (relationResponse.ok && relationData.success) {
        // 查找与目标用户的关系
        const relation = relationData.relations.find(r => r.targetUser.id === targetUserId);
        if (relation) {
          userRole = relation.relationshipType; // 'family' 或 'friend'
        }
      }
    } else {
      // 回答自己的问题时，角色为 elder
      userRole = 'elder';
    }
    
    // 加载问题（根据角色过滤）
    const questionsResponse = await fetch(`${API_BASE_URL}/api/questions?role=${userRole}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const questionsData = await questionsResponse.json();
    
    if (!questionsResponse.ok || !questionsData.success) {
      throw new Error('加载问题失败');
    }
    
    allQuestions = questionsData.questions;

    // 加载已有的答案
    let answersResponse;
    if (isAssisting) {
      answersResponse = await fetch(`${API_BASE_URL}/api/answers/assist/${targetUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } else {
      answersResponse = await fetch(`${API_BASE_URL}/api/answers/self`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    const answersData = await answersResponse.json();
    
    if (answersResponse.ok && answersData.success) {
      // 将答案转换为以questionId为键的对象
      answersData.answers.forEach(answer => {
        originalAnswers[answer.id] = answer.answer;
        currentAnswers[answer.id] = answer.answer;
      });
    }

    // 渲染问题列表
    renderQuestions();
    
    // 更新进度
    updateProgress();
    
    // 显示提交按钮
    document.getElementById('submitBtn').style.display = 'inline-block';

  } catch (error) {
    console.error('加载失败:', error);
    document.getElementById('questionsContainer').innerHTML = `
      <div class="alert alert-danger text-center">
        <h5>加载失败</h5>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">重新加载</button>
      </div>
    `;
  }
}

// 渲染问题列表
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  
  // 按层级分组
  const basicQuestions = allQuestions.filter(q => q.layer === 'basic');
  const emotionalQuestions = allQuestions.filter(q => q.layer === 'emotional');
  
  let html = '';
  
  // 渲染基础层面
  if (basicQuestions.length > 0) {
    html += `
      <div class="mb-4">
        <h4 class="mb-3">
          <span class="badge bg-primary">基础层面</span>
        </h4>
        <div class="row g-3">
    `;
    
    basicQuestions.forEach((q, index) => {
      html += renderQuestionCard(q, index);
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // 渲染情感层面
  if (emotionalQuestions.length > 0) {
    html += `
      <div class="mb-4">
        <h4 class="mb-3">
          <span class="badge bg-info">情感及行为层面</span>
        </h4>
        <div class="row g-3">
    `;
    
    emotionalQuestions.forEach((q, index) => {
      html += renderQuestionCard(q, index);
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // 为所有textarea添加事件监听
  document.querySelectorAll('textarea[data-question-id]').forEach(textarea => {
    textarea.addEventListener('input', handleAnswerChange);
  });
}

// 渲染单个问题卡片
function renderQuestionCard(question, index) {
  const answer = currentAnswers[question._id] || '';
  const hasAnswer = answer.trim() !== '';
  const cardClass = hasAnswer ? 'answered' : '';
  const layerColor = question.layer === 'basic' ? 'primary' : 'info';
  
  return `
    <div class="col-12">
      <div class="card question-card ${cardClass} mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge bg-${layerColor} layer-badge me-2">
                ${question.layer === 'basic' ? '基础' : '情感'}
              </span>
              <span class="badge bg-secondary layer-badge">问题 ${question.order}</span>
            </div>
            ${hasAnswer ? '<span class="badge bg-success">已回答</span>' : '<span class="badge bg-warning text-dark">未回答</span>'}
          </div>
          <h6 class="mb-3">${question.question}</h6>
          <textarea 
            class="form-control" 
            rows="4" 
            data-question-id="${question._id}"
            data-layer="${question.layer}"
            placeholder="${question.placeholder || '请输入您的回答...'}"
          >${answer}</textarea>
          <small class="text-muted mt-2 d-block">
            字数: <span id="count-${question._id}">${answer.length}</span>
          </small>
        </div>
      </div>
    </div>
  `;
}

// 处理答案变化
function handleAnswerChange(e) {
  const textarea = e.target;
  const questionId = textarea.dataset.questionId;
  const answer = textarea.value;
  
  // 更新当前答案
  currentAnswers[questionId] = answer;
  
  // 更新字数统计
  const countEl = document.getElementById(`count-${questionId}`);
  if (countEl) {
    countEl.textContent = answer.length;
  }
  
  // 更新卡片样式
  const card = textarea.closest('.question-card');
  if (answer.trim() !== '') {
    card.classList.add('answered');
    card.classList.remove('empty-answer');
  } else {
    card.classList.remove('answered');
  }
  
  // 更新进度
  updateProgress();
}

// 更新进度显示
function updateProgress() {
  const basicQuestions = allQuestions.filter(q => q.layer === 'basic');
  const emotionalQuestions = allQuestions.filter(q => q.layer === 'emotional');
  
  // 计算基础层面进度
  const basicAnswered = basicQuestions.filter(q => {
    const answer = currentAnswers[q._id];
    return answer && answer.trim() !== '';
  }).length;
  const basicPercentage = basicQuestions.length > 0 
    ? Math.round((basicAnswered / basicQuestions.length) * 100) 
    : 0;
  
  // 计算情感层面进度
  const emotionalAnswered = emotionalQuestions.filter(q => {
    const answer = currentAnswers[q._id];
    return answer && answer.trim() !== '';
  }).length;
  const emotionalPercentage = emotionalQuestions.length > 0 
    ? Math.round((emotionalAnswered / emotionalQuestions.length) * 100) 
    : 0;
  
  // 更新UI
  document.getElementById('basicProgress').style.width = `${basicPercentage}%`;
  document.getElementById('basicProgress').textContent = `${basicPercentage}%`;
  document.getElementById('basicAnswered').textContent = basicAnswered;
  document.getElementById('basicTotal').textContent = basicQuestions.length;
  
  document.getElementById('emotionalProgress').style.width = `${emotionalPercentage}%`;
  document.getElementById('emotionalProgress').textContent = `${emotionalPercentage}%`;
  document.getElementById('emotionalAnswered').textContent = emotionalAnswered;
  document.getElementById('emotionalTotal').textContent = emotionalQuestions.length;
}

// 处理提交
function handleSubmit() {
  // 检测更改
  const changes = detectChanges();
  
  if (changes.length === 0) {
    alert('没有检测到任何更改');
    return;
  }
  
  // 显示确认弹窗
  showConfirmModal(changes);
}

// 检测更改
function detectChanges() {
  const changes = [];
  
  allQuestions.forEach(question => {
    const questionId = question._id;
    const originalAnswer = originalAnswers[questionId] || '';
    const currentAnswer = currentAnswers[questionId] || '';
    
    if (originalAnswer !== currentAnswer) {
      changes.push({
        questionId,
        question: question.question,
        layer: question.layer,
        order: question.order,
        originalAnswer,
        currentAnswer,
        type: determineChangeType(originalAnswer, currentAnswer)
      });
    }
  });
  
  return changes;
}

// 确定更改类型
function determineChangeType(original, current) {
  if (!original && current) return 'new';
  if (original && !current) return 'deleted';
  if (original && current) return 'modified';
  return 'none';
}

// 显示确认弹窗
function showConfirmModal(changes) {
  const changesContent = document.getElementById('changesContent');
  
  let html = `
    <div class="alert alert-warning">
      <h6 class="alert-heading">检测到 ${changes.length} 项更改</h6>
      <p class="mb-0">请仔细检查以下更改，确认无误后点击"确认更改"按钮。</p>
    </div>
  `;
  
  // 分类显示更改
  const newAnswers = changes.filter(c => c.type === 'new');
  const modifiedAnswers = changes.filter(c => c.type === 'modified');
  const deletedAnswers = changes.filter(c => c.type === 'deleted');
  
  if (newAnswers.length > 0) {
    html += `
      <div class="mb-3">
        <h6 class="text-success">
          <i class="bi bi-plus-circle-fill me-2"></i>新增回答 (${newAnswers.length})
        </h6>
        <div class="list-group">
    `;
    
    newAnswers.forEach(change => {
      html += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <strong>${change.question}</strong>
            <span class="badge bg-${change.layer === 'basic' ? 'primary' : 'info'}">
              ${change.layer === 'basic' ? '基础' : '情感'} - 问题${change.order}
            </span>
          </div>
          <div class="alert alert-success mb-0">
            <small><strong>新答案:</strong></small>
            <p class="mb-0">${change.currentAnswer.substring(0, 100)}${change.currentAnswer.length > 100 ? '...' : ''}</p>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  if (modifiedAnswers.length > 0) {
    html += `
      <div class="mb-3">
        <h6 class="text-primary">
          <i class="bi bi-pencil-fill me-2"></i>修改回答 (${modifiedAnswers.length})
        </h6>
        <div class="list-group">
    `;
    
    modifiedAnswers.forEach(change => {
      html += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <strong>${change.question}</strong>
            <span class="badge bg-${change.layer === 'basic' ? 'primary' : 'info'}">
              ${change.layer === 'basic' ? '基础' : '情感'} - 问题${change.order}
            </span>
          </div>
          <div class="alert alert-secondary mb-2">
            <small><strong>原答案:</strong></small>
            <p class="mb-0">${change.originalAnswer.substring(0, 100)}${change.originalAnswer.length > 100 ? '...' : ''}</p>
          </div>
          <div class="alert alert-primary mb-0">
            <small><strong>新答案:</strong></small>
            <p class="mb-0">${change.currentAnswer.substring(0, 100)}${change.currentAnswer.length > 100 ? '...' : ''}</p>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  if (deletedAnswers.length > 0) {
    html += `
      <div class="mb-3">
        <h6 class="text-danger">
          <i class="bi bi-trash-fill me-2"></i>删除回答 (${deletedAnswers.length})
        </h6>
        <div class="alert alert-warning">
          <p class="mb-2">以下问题的回答将被删除，问题将回退为空状态：</p>
        </div>
        <div class="list-group">
    `;
    
    deletedAnswers.forEach(change => {
      html += `
        <div class="list-group-item">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <strong>${change.question}</strong>
            <span class="badge bg-${change.layer === 'basic' ? 'primary' : 'info'}">
              ${change.layer === 'basic' ? '基础' : '情感'} - 问题${change.order}
            </span>
          </div>
          <div class="alert alert-danger mb-0">
            <small><strong>原答案:</strong></small>
            <p class="mb-0">${change.originalAnswer.substring(0, 100)}${change.originalAnswer.length > 100 ? '...' : ''}</p>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  changesContent.innerHTML = html;
  
  // 显示弹窗
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  modal.show();
}

// 确认保存
async function confirmSave() {
  const confirmBtn = document.getElementById('confirmSaveBtn');
  const confirmText = document.getElementById('confirmText');
  const confirmLoading = document.getElementById('confirmLoading');
  
  // 显示加载状态
  confirmBtn.disabled = true;
  confirmText.classList.add('d-none');
  confirmLoading.classList.remove('d-none');
  
  try {
    const token = localStorage.getItem('token');
    
    // 准备要提交的数据
    const answersToSubmit = [];
    
    allQuestions.forEach(question => {
      const answer = currentAnswers[question._id];
      if (answer && answer.trim() !== '') {
        answersToSubmit.push({
          questionId: question._id,
          answer: answer.trim(),
          layer: question.layer
        });
      }
    });
    
    // 提交到后端（批量保存）
    const endpoint = isAssisting ? '/api/answers/batch-assist' : '/api/answers/batch-self';
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetUserId: isAssisting ? targetUserId : undefined,
        answers: answersToSubmit
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.message || '保存失败');
    }
    
    // 更新原始答案为当前答案
    originalAnswers = { ...currentAnswers };
    
    // 关闭确认弹窗
    const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
    confirmModal.hide();
    
    // 显示成功弹窗
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    successModal.show();
    
    // 重新加载数据
    setTimeout(() => {
      location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败: ' + error.message);
  } finally {
    // 恢复按钮状态
    confirmBtn.disabled = false;
    confirmText.classList.remove('d-none');
    confirmLoading.classList.add('d-none');
  }
}
