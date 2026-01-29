// client/public/assets/js/register.js - 重构版（统一注册）

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoading = document.getElementById('btnLoading');

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 隐藏之前的消息
    errorMessage.classList.add('d-none');
    successMessage.classList.add('d-none');

    // 获取表单数据
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证密码
    if (password !== confirmPassword) {
      errorMessage.textContent = '两次输入的密码不一致';
      errorMessage.classList.remove('d-none');
      return;
    }

    if (password.length < 6) {
      errorMessage.textContent = '密码长度至少为6个字符';
      errorMessage.classList.remove('d-none');
      return;
    }

    // 显示加载状态
    submitBtn.disabled = true;
    btnText.classList.add('d-none');
    btnLoading.classList.remove('d-none');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存token和用户信息
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // 显示成功消息
        successMessage.innerHTML = `
          <strong>注册成功！</strong><br>
          您的专属编号：<strong>${data.user.uniqueCode}</strong><br>
          正在跳转到个人档案...
        `;
        successMessage.classList.remove('d-none');

        // 2秒后跳转到个人档案页面
        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 2000);

      } else {
        // 显示错误消息
        errorMessage.textContent = data.message || '注册失败，请重试';
        errorMessage.classList.remove('d-none');
        
        // 恢复按钮状态
        submitBtn.disabled = false;
        btnText.classList.remove('d-none');
        btnLoading.classList.add('d-none');
      }

    } catch (error) {
      console.error('注册错误:', error);
      errorMessage.textContent = '网络错误，请检查您的连接';
      errorMessage.classList.remove('d-none');
      
      // 恢复按钮状态
      submitBtn.disabled = false;
      btnText.classList.remove('d-none');
      btnLoading.classList.add('d-none');
    }
  });
});
