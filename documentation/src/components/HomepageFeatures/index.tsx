import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
  icon: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: '数字记忆保存',
    icon: '📚',
    description: (
      <>
        结构化存储老人的人生故事和珍贵记忆，支持基础层次和情感层次的问题体系，
        让每一个故事都被完整记录。
      </>
    ),
  },
  {
    title: 'AI 陪伴对话',
    icon: '🤖',
    description: (
      <>
        基于 LangGraph 的个性化 AI 对话体验，AI 能记住你是谁、理解你的故事，
        以熟悉的方式与你交流。
      </>
    ),
  },
  {
    title: '家庭协作',
    icon: '👨‍👩‍👧‍👦',
    description: (
      <>
        支持多人协作完善记忆档案，家人和朋友可以协助回答问题，
        共同构建完整的人生记录。
      </>
    ),
  },
  {
    title: '角色卡生成',
    icon: '🎭',
    description: (
      <>
        AI 自动分析用户回答，生成个性化角色描述，包含性格特征、背景故事、
        兴趣爱好等维度。
      </>
    ),
  },
  {
    title: 'RAG 检索',
    icon: '🔍',
    description: (
      <>
        使用 ChromaDB 向量数据库进行语义检索，实现基于个人记忆的
        智能问答和上下文构建。
      </>
    ),
  },
  {
    title: '权限管理',
    icon: '🔐',
    description: (
      <>
        完善的 RBAC 权限控制系统，保护用户隐私，确保只有授权人员
        才能访问敏感记忆数据。
      </>
    ),
  },
];

function Feature({title, description, icon}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <div className={styles.featureIcon}>{icon}</div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
