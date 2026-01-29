// index.js - 欢迎页专属逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 角色卡片悬浮动画增强
  const cards = document.querySelectorAll('.role-card');
  cards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.2}s`;
    card.classList.add('fade-in');
  });

  // 动态打字效果（标题）
  const title = document.querySelector('.hero-section h1');
  if (title) {
    const text = title.textContent;
    title.textContent = '';
    title.style.opacity = '1';
    let i = 0;
    const typeInterval = setInterval(() => {
      title.textContent += text[i];
      i++;
      if (i >= text.length) clearInterval(typeInterval);
    }, 100);
  }

  // 背景粒子效果（轻量级）
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';
  canvas.style.opacity = '0.3';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.2
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 212, 255, 0.8)';
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      p.y -= p.speed;
      if (p.y < 0) p.y = canvas.height;
    });
    requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
});