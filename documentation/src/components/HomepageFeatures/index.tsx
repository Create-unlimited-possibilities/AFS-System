import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
  icon: string;
  link?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'User System',
    icon: '👤',
    link: '/docs/core/user/overview',
    description: (
      <>
        完整的用户认证系统，支持注册、登录、角色权限管理和家庭协助关系。
        基于 JWT 的安全认证，完善的 RBAC 权限控制。
      </>
    ),
  },
  {
    title: 'Questionnaire',
    icon: '📋',
    link: '/docs/core/questionnaire/overview',
    description: (
      <>
        结构化问卷系统，支持多层次问题设计。答案处理与评分机制，
        灵活的问题类型配置，完善的问卷管理功能。
      </>
    ),
  },
  {
    title: 'AI Chat',
    icon: '🤖',
    link: '/docs/core/chat/overview',
    description: (
      <>
        基于 LangGraph 的智能对话编排系统。支持多节点处理流程、
        RAG 检索增强生成，个性化 AI 陪伴对话体验。
      </>
    ),
  },
  {
    title: 'Memory',
    icon: '🧠',
    link: '/docs/core/memory/overview',
    description: (
      <>
        智能记忆系统，支持记忆提取、压缩和向量存储。
        使用 ChromaDB 进行语义检索，实现基于上下文的智能问答。
      </>
    ),
  },
  {
    title: 'RoleCard',
    icon: '🎭',
    link: '/docs/core/rolecard/overview',
    description: (
      <>
        V2 分层角色卡系统，包含基础层、性格层、背景层等。
        自动组装生成个性化 AI 角色描述，支持多维度角色定制。
      </>
    ),
  },
  {
    title: 'Admin Panel',
    icon: '🔧',
    link: '/docs/admin/overview',
    description: (
      <>
        功能完善的管理后台，支持用户管理、问卷管理、记忆管理和角色权限管理。
        现代化 UI 设计，响应式布局，高效的数据管理工具。
      </>
    ),
  },
];

function Feature({title, description, icon, link}: FeatureItem) {
  const content = (
    <>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3" className={styles.featureTitle}>
        {title}
      </Heading>
      <p className={styles.featureDescription}>{description}</p>
    </>
  );

  if (link) {
    return (
      <Link to={link} className={styles.featureLink}>
        <div className={styles.featureCard}>{content}</div>
      </Link>
    );
  }

  return <div className={styles.featureCard}>{content}</div>;
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.featuresGrid}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
