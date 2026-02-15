import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * AFS System 文档侧边栏配置
 */

const sidebars: SidebarsConfig = {
  // 主文档侧边栏
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        'getting-started/installation',
      ],
    },
    {
      type: 'category',
      label: '系统架构',
      collapsed: true,
      items: [
        'architecture/overview',
      ],
    },
    'tech-stack',
  ],

  // API 侧边栏
  apiSidebar: [
    'api/overview',
    {
      type: 'category',
      label: '认证 API',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'api/overview',
          label: '认证接口',
        },
      ],
    },
  ],

  // 模块侧边栏
  modulesSidebar: [
    'modules/overview',
    {
      type: 'category',
      label: '核心模块',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'modules/overview',
          label: '认证模块 (Auth)',
        },
        {
          type: 'doc',
          id: 'modules/overview',
          label: '用户模块 (User)',
        },
        {
          type: 'doc',
          id: 'modules/overview',
          label: '问答模块 (QA)',
        },
        {
          type: 'doc',
          id: 'modules/overview',
          label: '协助关系模块 (Assist)',
        },
      ],
    },
    {
      type: 'category',
      label: 'AI 模块',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'ai/langgraph',
          label: '对话模块 (Chat)',
        },
        {
          type: 'doc',
          id: 'ai/rolecard-v2',
          label: '角色卡模块 V2 (RoleCard)',
        },
        {
          type: 'doc',
          id: 'modules/overview',
          label: '好感度模块 (Sentiment)',
        },
      ],
    },
  ],

  // 旧版兼容侧边栏
  tutorialSidebar: [
    'intro',
    'project-overview',
    'architecture/overview',
    'tech-stack',
  ],
};

export default sidebars;
