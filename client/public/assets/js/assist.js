// client/public/assets/js/assist.js - 协助页面逻辑

document.addEventListener('DOMContentLoaded', async () => {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 加载已有的协助关系
  await loadExistingRelations();

  // 表单提交事件
  document.getElementById('assistForm').addEventListener('submit', handleSubmit);

  // 退出登录
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
  });
});

// 处理表单提交
async function handleSubmit(e) {
  e.preventDefault();

  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');

  // 隐藏之前的消息
  errorMessage.classList.add('d-none');
  successMessage.classList.add('d-none');

  // 获取表单数据
  const targetCode = document.getElementById('targetCode').value.trim();
  const targetEmail = document.getElementById('targetEmail').value.trim();
  const relationshipType = document.getElementById('relationshipType').value;

  // 验证
  if (!targetCode || !targetEmail || !relationshipType) {
    errorMessage.textContent = '请填写所有必填项';
    errorMessage.classList.remove('d-none');
    return;
  }

  // 显示加载状态
  submitBtn.disabled = true;
  btnText.classList.add('d-none');
  btnLoading.classList.remove('d-none');

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/auth/assist/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetCode,
        targetEmail,
        relationshipType
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // 显示成功消息
      successMessage.innerHTML = `
        <strong>成功！</strong><br>
        已建立与 <strong>${data.relation.targetUser.name}</strong> 的协助关系。<br>
        您现在可以协助对方回答问题。
      `;
      successMessage.classList.remove('d-none');

      // 清空表单
      document.getElementById('assistForm').reset();

      // 重新加载协助关系列表
      setTimeout(() => {
        loadExistingRelations();
      }, 1000);

    } else {
      // 显示错误消息
      errorMessage.textContent = data.message || '验证失败，请检查信息是否正确';
      errorMessage.classList.remove('d-none');
    }

  } catch (error) {
    console.error('验证失败:', error);
    errorMessage.textContent = '网络错误，请检查您的连接';
    errorMessage.classList.remove('d-none');
  } finally {
    // 恢复按钮状态
    submitBtn.disabled = false;
    btnText.classList.remove('d-none');
    btnLoading.classList.add('d-none');
  }
}

// 加载已有的协助关系
async function loadExistingRelations() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/api/auth/assist/relations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const existingRelationsDiv = document.getElementById('existingRelations');
      
      if (data.relations.length === 0) {
        existingRelationsDiv.innerHTML = `
          <div class="text-center text-muted py-3">
            <p>您还未协助任何人</p>
          </div>
        `;
      } else {
        let html = '<div class="list-group">';
        
        data.relations.forEach(relation => {
          const relationshipText = relation.relationshipType === 'family' ? '亲人' : '朋友';
          const relationshipClass = relation.relationshipType === 'family' ? 'primary' : 'success';
          const createdDate = new Date(relation.createdAt).toLocaleDateString('zh-CN');
          
          html += `
            <div class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">${relation.targetUser.name}</h6>
                  <small class="text-muted">
                    编号: ${relation.targetUser.uniqueCode}<br>
                    邮箱: ${relation.targetUser.email}<br>
                    建立时间: ${createdDate}
                  </small>
                </div>
                <div class="text-end">
                  <span class="badge bg-${relationshipClass} mb-2">${relationshipText}</span><br>
                  <a href="answer-questions.html?targetUserId=${relation.targetUser.id}" 
                     class="btn btn-sm btn-outline-primary">
                    协助回答
                  </a>
                </div>
              </div>
            </div>
          `;
        });
        
        html += '</div>';
        existingRelationsDiv.innerHTML = html;
      }
    }
  } catch (error) {
    console.error('加载协助关系失败:', error);
    document.getElementById('existingRelations').innerHTML = `
      <div class="text-center text-danger py-3">
        <p>加载失败，请刷新重试</p>
      </div>
    `;
  }
}
