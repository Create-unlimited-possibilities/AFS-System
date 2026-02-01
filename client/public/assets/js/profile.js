// client/public/assets/js/profile.js - 个人档案页面逻辑

// API_BASE_URL已在api.js中定义，直接使用
const API_BASE_URL = window.API_BASE_URL || window.location.origin.replace(':8080', ':3001');

document.addEventListener('DOMContentLoaded', async () => {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 加载用户信息
  await loadUserInfo();
  
  // 加载回答进度
  await loadAnswerProgress();
  
  // 加载他人的回答
  await loadOthersAnswers();
  
  // 加载我协助的人
  await loadAssistRelations();

  // 复制按钮事件
  document.getElementById('copyCodeBtn').addEventListener('click', copyUniqueCode);
  
  // 退出登录按钮事件
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
  });
});

// 加载用户信息
async function loadUserInfo() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      document.getElementById('userName').textContent = data.user.name;
      document.getElementById('uniqueCode').textContent = data.user.uniqueCode;
      document.getElementById('userEmail').textContent = data.user.email;
    } else {
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
  }
}

// 复制专属编号
async function copyUniqueCode() {
  const uniqueCode = document.getElementById('uniqueCode').textContent;
  
  try {
    await navigator.clipboard.writeText(uniqueCode);
    
    // 显示成功提示
    const toast = new bootstrap.Toast(document.getElementById('copyToast'));
    toast.show();
  } catch (error) {
    console.error('复制失败:', error);
    alert('复制失败，请手动复制');
  }
}

// 加载回答进度
async function loadAnswerProgress() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/progress/self`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const { basic, emotional, overall } = data.progress;

      // 更新基础层面进度
      document.getElementById('basicProgressBar').style.width = `${basic.percentage}%`;
      document.getElementById('basicProgressBar').textContent = `${basic.percentage}%`;
      document.getElementById('basicAnswered').textContent = basic.answered;
      document.getElementById('basicTotal').textContent = basic.total;

      // 更新情感层面进度
      document.getElementById('emotionalProgressBar').style.width = `${emotional.percentage}%`;
      document.getElementById('emotionalProgressBar').textContent = `${emotional.percentage}%`;
      document.getElementById('emotionalAnswered').textContent = emotional.answered;
      document.getElementById('emotionalTotal').textContent = emotional.total;

      // 更新总体进度
      document.getElementById('overallProgress').innerHTML = `
        <div class="text-center">
          <div class="display-4 fw-bold text-primary">${overall.percentage}%</div>
          <div class="text-muted">总体完成度</div>
          <small class="text-muted">${overall.answered} / ${overall.total} 题</small>
        </div>
      `;

      // 添加点击事件
      setTimeout(() => {
        const cards = document.querySelectorAll('.layer-card');
        console.log('找到层面卡片:', cards.length);
        cards.forEach(card => {
          card.style.cursor = 'pointer';
          card.addEventListener('click', function(e) {
            e.preventDefault();
            const layer = this.getAttribute('data-layer');
            console.log('点击了层面:', layer);
            window.location.href = `answer-questions.html?layer=${layer}`;
          });
        });
      }, 100);
    }
  } catch (error) {
    console.error('加载进度失败:', error);
  }
}

// 加载他人的回答
async function loadOthersAnswers() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/answers/from-others`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const othersAnswersDiv = document.getElementById('othersAnswers');
      
      if (data.contributors.length === 0) {
        othersAnswersDiv.innerHTML = `
          <div class="text-center text-muted py-4">
            <p>暂无他人为您的回答</p>
            <small>您可以分享您的专属编号，让亲人或朋友协助回答问题</small>
          </div>
        `;
      } else {
        let html = '<div class="list-group">';
        
        data.contributors.forEach(contributor => {
          const relationshipText = contributor.relationshipType === 'family' ? '家人' : '朋友';
          const relationshipClass = contributor.relationshipType === 'family' ? 'badge-primary' : 'badge-success';
          
          html += `
            <div class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">${contributor.contributor.name}</h6>
                  <small class="text-muted">${contributor.contributor.email}</small>
                </div>
                <div class="text-end">
                  <span class="badge bg-${relationshipClass}">${relationshipText}</span>
                  <div class="mt-2">
                    <small class="text-muted">
                      基础: ${contributor.basicCount} 题 | 
                      情感: ${contributor.emotionalCount} 题
                    </small>
                  </div>
                  <a href="view-answers.html?contributorId=${contributor.contributor.id}" class="btn btn-sm btn-outline-primary mt-2">
                    查看详情
                  </a>
                </div>
              </div>
            </div>
          `;
        });
        
        html += '</div>';
        othersAnswersDiv.innerHTML = html;
      }
    }
  } catch (error) {
    console.error('加载他人回答失败:', error);
    document.getElementById('othersAnswers').innerHTML = `
      <div class="text-center text-danger py-4">
        <p>加载失败，请刷新重试</p>
      </div>
    `;
  }
}

// 加载我协助的人
async function loadAssistRelations() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/auth/assist/relations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const assistListDiv = document.getElementById('assistList');
      
      if (data.relations.length === 0) {
        assistListDiv.innerHTML = `
          <div class="text-center text-muted py-4">
            <p>您还未协助任何人</p>
            <a href="assist.html" class="btn btn-primary mt-2">开始协助</a>
          </div>
        `;
      } else {
        let html = '<div class="list-group">';
        
        data.relations.forEach(relation => {
          const relationshipText = relation.relationshipType === 'family' ? '家人' : '朋友';
          const relationshipClass = relation.relationshipType === 'family' ? 'primary' : 'success';
          
          html += `
            <div class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">${relation.targetUser.name}</h6>
                  <small class="text-muted">编号: ${relation.targetUser.uniqueCode}</small>
                </div>
                <div class="text-end">
                  <span class="badge bg-${relationshipClass}">${relationshipText}</span>
                  <div class="mt-2">
                    <a href="answer-questions.html?targetUserId=${relation.targetUser.id}" class="btn btn-sm btn-outline-primary">
                      协助回答
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `;
        });
        
        html += '</div>';
        assistListDiv.innerHTML = html;
      }
    }
  } catch (error) {
    console.error('加载协助关系失败:', error);
    document.getElementById('assistList').innerHTML = `
      <div class="text-center text-danger py-4">
        <p>加载失败，请刷新重试</p>
      </div>
    `;
  }
}