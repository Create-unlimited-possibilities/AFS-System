// timeline.js - 记忆时间线专用逻辑
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('timeline-container');
  const token = localStorage.getItem('afs-token');

  // 模拟记忆数据（真实数据等后端完成）
  const mockMemories = [
    {
      title: "2023年重阳节家庭聚会",
      date: "2023-10-23",
      contributor: "孙女小明",
      contributorRole: "family",
      content: "爷爷那天讲了年轻时下乡插队的经历，大家都听哭了...",
      tags: ["家庭", "情感"],
      visibility: "public"
    },
    {
      title: "与老战友喝茶忆当年",
      date: "2023-08-15",
      contributor: "老朋友老张",
      contributorRole: "friend",
      content: "我们聊起当年一起扛枪的日子，笑得眼泪都出来了。",
      tags: ["友谊", "回忆"],
      visibility: "family"
    },
    {
      title: "我年轻时的创业故事",
      date: "2023-06-20",
      contributor: "李明（本人）",
      contributorRole: "elder",
      content: "那时候白手起家，开了一间小小的修理铺，没想到能做到今天这样...",
      tags: ["奋斗", "创业"],
      visibility: "public"
    }
  ];

  // 真实接口（等后端完成再启用）
  /*
  const res = await fetch('/api/memories', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const memories = res.ok ? await res.json() : mockMemories;
  */

  const memories = mockMemories.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = memories.map((m, i) => `
    <div class="timeline-item fade-in" style="animation-delay: ${i * 0.2}s">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <h5>${m.title}</h5>
        <span class="text-success">${m.visibility === 'public' ? '公开' : '家人可见'}</span>
      </div>
      <p class="text-muted mb-2">
        ${m.date} · 由 ${m.contributor}（${m.contributorRole === 'elder' ? '本人' : m.contributorRole === 'family' ? '家属' : '朋友'}）贡献
      </p>
      <p class="mb-3">${m.content}</p>
      <div>
        ${m.tags.map(tag => `<span class="badge bg-primary me-1">${tag}</span>`).join('')}
      </div>
    </div>
  `).join('');
});