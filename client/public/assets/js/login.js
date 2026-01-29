// client/public/assets/js/login.js - 重构版（统一登录）

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 隐藏之前的错误消息
    errorMessage.classList.add('d-none');

    // 获取表单数据
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // 显示加载状态
    submitBtn.disabled = true;
    btnText.classList.add('d-none');
    btnLoading.classList.remove('d-none');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存token和用户信息
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // 跳转到个人档案页面
        window.location.href = 'profile.html';

      } else {
        // 显示错误消息
        errorMessage.textContent = data.message || '登录失败，请检查邮箱和密码';
        errorMessage.classList.remove('d-none');
        
        // 恢复按钮状态
        submitBtn.disabled = false;
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
      }

    } catch (error) {
      console.error('登录错误:', error);
      errorMessage.textContent = '网络错误，请检查您的连接';
      errorMessage.classList.remove('d-none');
      
      // 恢复按钮状态
      submitBtn.disabled = false;
      btnText.classList.remove('d-none');
      btnLoading.classList.add('d-none');
    }
  });
});
