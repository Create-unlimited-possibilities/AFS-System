import '../css/global.css';

class AFS_Common {
  constructor() {
    this.initNavbar();
    this.applySavedLanguage();
    this.setPageTitle();
  }

  // 统一页面标题
  setPageTitle() {
    document.title = "传家之宝 · Artificccial Flucctlight Simulation System";
  }

  // 导航高亮
  initNavbar() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === current);
    });
  }

  // 应用用户上次选择的语言
  applySavedLanguage() {
    const saved = localStorage.getItem('afs-lang') || 'ZH';
    if (window.afsI18n) {
      setTimeout(() => afsI18n.setLanguage(saved), 100); // 确保 i18n 已加载
    }
  }
}

// 全局初始化（所有页面自动执行）
document.addEventListener('DOMContentLoaded', () => {
  window.afsCommon = new AFS_Common();
});