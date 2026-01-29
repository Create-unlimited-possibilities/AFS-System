// client/public/assets/js/i18n.js
const supportedLanguages = [
  { code: 'ZH', name: '简体中文', flag: 'CN' },
  { code: 'EN', name: 'English', flag: 'US' },
  { code: 'JA', name: '日本語', flag: 'JP' }
];

class AFS_i18n {
  constructor() {
    this.currentLang = localStorage.getItem('afs-lang') || 'ZH';
    this.initLanguageSelector();
    this.applySavedLanguage();
  }

  applySavedLanguage() {
    const saved = localStorage.getItem('afs-lang');
    if (saved && supportedLanguages.find(l => l.code === saved)) {
      this.setLanguage(saved);
    } else {
      this.autoDetectLanguage();
    }
  }

  autoDetectLanguage() {
    if (localStorage.getItem('afs-lang')) return;
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.toUpperCase().split('-')[0];
    const matched = supportedLanguages.find(l => l.code === langCode)?.code || 'ZH';
    this.setLanguage(matched);
    this.translateCurrentPage();
  }

  async translateCurrentPage() {
    const elements = document.querySelectorAll('[data-i18n]');
    for (const el of elements) {
        let original = el.dataset.i18nOriginal;
        if (!original) {
        original = el.innerText.trim();
        el.dataset.i18nOriginal = original;
        }

        if (this.currentLang === 'ZH') {
        el.innerText = original;
        } else {
        el.innerText = await afsAPI.translate(original, this.currentLang);
        }
    }
}

  initLanguageSelector() {
    // 动态插入语言选择器到页面（所有页面通用）
    if (document.getElementById('afs-language-selector')) return;

    const selectorHTML = `
      <div id="afs-language-selector" class="position-fixed bottom-0 end-0 m-3 z-1000">
        <div class="dropdown">
          <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <span id="current-lang-flag">CN</span> <span id="current-lang-name">简体中文</span>
          </button>
          <ul class="dropdown-menu">
            ${supportedLanguages.map(lang => `
              <li><a class="dropdown-item" href="#" data-lang="${lang.code}">
                ${lang.flag} ${lang.name}
              </a></li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', selectorHTML);

    // 绑定事件
    document.querySelectorAll('[data-lang]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const lang = item.getAttribute('data-lang');
        await this.setLanguage(lang);
      });
    });
  }

  async setLanguage(langCode) {
    if (this.currentLang === langCode) return;
    this.currentLang = langCode;

    localStorage.setItem('afs-lang', langCode);

    document.documentElement.lang = langCode.toLowerCase();
    document.getElementById('current-lang-flag').textContent = 
      supportedLanguages.find(l => l.code === langCode)?.flag || 'CN';
    document.getElementById('current-lang-name').textContent = 
      supportedLanguages.find(l => l.code === langCode)?.name || '中文';

    // 翻译页面上所有 data-i18n 标记的元素
    const elements = document.querySelectorAll('[data-i18n]');
    for (const el of elements) {
      let original = el.dataset.i18nOriginal;
      if (!original) {
        original = el.innerText.trim();
        el.dataset.i18nOriginal = original;
      }

      if (langCode === 'ZH') {
        el.innerText = original;
      } else {
        el.innerText = await afsAPI.translate(original, langCode);
      }
    }

    // 触发自定义事件，供各页面监听
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: langCode }));
  }
}

// 全局初始化
document.addEventListener('DOMContentLoaded', () => {
  window.afsI18n = new AFS_i18n();
});