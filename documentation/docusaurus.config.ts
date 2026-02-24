import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// AFS System Documentation Configuration
// Design System: Accessible & Ethical (Healthcare/Family-oriented)
// Colors: Cyan primary (#0891B2), Green CTA (#059669)
// Typography: Figtree / Noto Sans (Chinese-friendly)

const config: Config = {
  title: 'AFS System',
  tagline: '面向老年人的数字记忆传承系统 - 技术文档',

  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://afs-system.example.com',
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'Create-unlimited-possibilities',
  projectName: 'AFS-System',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Chinese language support
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
    localeConfigs: {
      'zh-Hans': {
        label: '简体中文',
        direction: 'ltr',
      },
      en: {
        label: 'English',
        direction: 'ltr',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'content',
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          editUrl: 'https://github.com/Create-unlimited-possibilities/AFS-System/tree/main/documentation/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Project branding
    image: 'img/afs-social-card.png',

    // Color mode configuration
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    // Metadata
    metadata: [
      {name: 'description', content: 'AFS System - 面向老年人的数字记忆传承系统技术文档'},
      {name: 'keywords', content: 'AFS System, 数字记忆, 老年人, AI对话, LangGraph, RAG'},
    ],

    // Navigation bar
    navbar: {
      title: 'AFS System',
      logo: {
        alt: 'AFS System Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '文档',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API',
        },
        {
          type: 'docSidebar',
          sidebarId: 'deploymentSidebar',
          position: 'left',
          label: '部署',
        },
        {
          href: 'https://github.com/Create-unlimited-possibilities/AFS-System',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },

    // Footer
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '快速开始',
              to: '/docs/getting-started/installation',
            },
            {
              label: '系统架构',
              to: '/docs/architecture/overview',
            },
            {
              label: 'API 参考',
              to: '/docs/api/overview',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/Create-unlimited-possibilities/AFS-System',
            },
            {
              label: '问题反馈',
              href: 'https://github.com/Create-unlimited-possibilities/AFS-System/issues',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '贡献指南',
              href: 'https://github.com/Create-unlimited-possibilities/AFS-System/blob/main/CONTRIBUTING.md',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AFS System. 面向老年人的数字记忆传承系统.`,
    },

    // Code highlighting
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['javascript', 'typescript', 'python', 'bash', 'json', 'yaml', 'docker', 'nginx', 'mongodb'],
    },

    // Table of contents
    toc: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },

    // Search (Algolia DocSearch - optional)
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_API_KEY',
    //   indexName: 'afs-system',
    // },

    // Announcement bar
    announcementBar: {
      id: 'announcement-v2',
      content: 'AFS System v2.0.0 已发布 - 后端模块化架构重构完成！',
      backgroundColor: '#0891B2',
      textColor: '#ffffff',
      isCloseable: true,
    },

    // Docs configuration
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
  } satisfies Preset.ThemeConfig,

  // Plugins
  plugins: [],

  // Custom fields for theming
  customFields: {
    // Design system colors (for reference)
    colors: {
      primary: '#0891B2',
      secondary: '#22D3EE',
      cta: '#059669',
      background: '#ECFEFF',
      text: '#164E63',
    },
  },
};

export default config;
