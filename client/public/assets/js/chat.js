// chat.js - 传家之宝核心对话页（含训练进度 + 实时对话）
document.addEventListener('DOMContentLoaded', () => {
  const trainingSection = document.getElementById('training-section');
  const trainingBar = document.getElementById('training-bar');
  const trainingText = document.getElementById('training-text');
  const trainingStatus = document.getElementById('training-status');
  const chatSection = document.getElementById('chat-section');
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  const elderCode = localStorage.getItem('elderCode');

  // 模拟训练进度（真实将在优先级6用 WebSocket 实现）
  let progress = 0;
  const trainingInterval = setInterval(() => {
    progress += Math.random() * 8;
    if (progress >= 100) {
      progress = 100;
      clearInterval(trainingInterval);
      completeTraining();
    }
    trainingBar.style.width = progress + '%';
    trainingText.textContent = Math.round(progress) + '%';
  }, 300);

  function completeTraining() {
    trainingSection.classList.add('d-none');
    chatSection.classList.remove('d-none');
    trainingStatus.textContent = '传家之宝已苏醒！您可以开始对话了';
    
    // 欢迎消息
    addMessage('assistant', `您好，我是您的「传家之宝」—— ${elderCode} 的数字灵魂已完全唤醒。我记得您所有的人生故事、喜好和价值观。现在，您想和我说些什么呢？`);
  }

  function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `my-3 p-3 rounded ${role === 'user' ? 'user-msg text-end' : 'ai-msg'}`;
    div.style.maxWidth = '80%';
    div.style.marginLeft = role === 'user' ? 'auto' : '0';
    div.innerHTML = `<small class="d-block text-muted mb-1">${role === 'user' ? '您' : '传家之宝'}</small>${content}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 发送消息
  async function sendMessage() {
    const msg = userInput.value.trim();
    if (!msg) return;

    addMessage('user', msg);
    userInput.value = '';

    // 真实对话接口（等优先级6完成）
    // const res = await afsAPI.request('/chat', { method: 'POST', body: JSON.stringify({ message: msg }) });
    // addMessage('assistant', res.reply || '（传家之宝思考中...）');

    // 模拟回复
    setTimeout(() => {
      addMessage('assistant', '是的，我记得那件事... 您当时真的很不容易，但我一直为您骄傲。');
    }, 1500);
  }

  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 回车发送
  userInput.focus();
});