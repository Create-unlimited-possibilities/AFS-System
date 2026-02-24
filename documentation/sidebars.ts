import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * AFS System Documentation Sidebar Configuration
 *
 * Structure follows the new documentation site restructure:
 * - Getting Started: Quick introduction and setup
 * - Core Features: Deep dive into user, questionnaire, chat, memory, and rolecard systems
 * - Admin Panel: Administrative interface documentation
 * - API Reference: REST, WebSocket, and Admin API
 * - Reference: Tech stack, configuration, and FAQ
 */

const sidebars: SidebarsConfig = {
  // Main documentation sidebar
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/intro',
        'getting-started/project-overview',
        'getting-started/installation',
        'getting-started/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Core Features',
      collapsed: false,
      items: [
        'core/overview',
        {
          type: 'category',
          label: 'User System',
          collapsed: true,
          items: [
            'core/user/overview',
            'core/user/auth',
            'core/user/profile',
            'core/user/assist',
          ],
        },
        {
          type: 'category',
          label: 'Questionnaire',
          collapsed: true,
          items: [
            'core/questionnaire/overview',
            'core/questionnaire/questions',
            'core/questionnaire/answers',
            'core/questionnaire/frontend',
          ],
        },
        {
          type: 'category',
          label: 'Chat System',
          collapsed: true,
          items: [
            'core/chat/overview',
            'core/chat/langgraph',
            'core/chat/nodes',
            'core/chat/frontend',
          ],
        },
        {
          type: 'category',
          label: 'Memory System',
          collapsed: true,
          items: [
            'core/memory/overview',
            'core/memory/storage',
            'core/memory/extraction',
            'core/memory/compression',
          ],
        },
        {
          type: 'category',
          label: 'RoleCard',
          collapsed: true,
          items: [
            'core/rolecard/overview',
            'core/rolecard/v2-architecture',
            'core/rolecard/layers',
            'core/rolecard/assembler',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Admin Panel',
      collapsed: true,
      items: [
        'admin/overview',
        'admin/dashboard',
        'admin/user-management',
        'admin/questionnaire',
        'admin/memory',
        'admin/roles',
        'admin/settings',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: true,
      items: [
        'api/overview',
        'api/rest',
        'api/websocket',
        'api/admin',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        'reference/tech-stack',
        'reference/config',
        'reference/env',
        'reference/faq',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: true,
      items: [
        'architecture/overview',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      collapsed: true,
      items: [
        'deployment/docker',
      ],
    },
  ],

  // API sidebar (kept for backward compatibility)
  apiSidebar: [
    'api/overview',
    'api/rest',
    'api/websocket',
    'api/admin',
  ],

  // Deployment sidebar (kept for backward compatibility)
  deploymentSidebar: [
    'deployment/docker',
  ],

  // Tutorial sidebar (legacy, kept for backward compatibility)
  tutorialSidebar: [
    'getting-started/intro',
    'getting-started/project-overview',
    'architecture/overview',
    'reference/tech-stack',
  ],
};

export default sidebars;
