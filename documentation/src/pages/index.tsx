import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className={styles.heroBackground}></div>
      <div className="container">
        <div className={styles.heroContent}>
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <p className={styles.heroDescription}>
            面向开发者的技术文档 - 深入了解系统架构、API 接口和实现细节
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/docs/">
              开始阅读文档
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="https://github.com/yourusername/AFS-System"
              target="_blank">
              GitHub 仓库
            </Link>
          </div>
        </div>
      </div>
      {/* Animated gradient orbs */}
      <div className={styles.orb} style={{top: '10%', left: '10%', animationDelay: '0s'}}></div>
      <div className={styles.orb} style={{top: '60%', right: '10%', animationDelay: '2s'}}></div>
      <div className={styles.orb} style={{bottom: '20%', left: '20%', animationDelay: '4s'}}></div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="首页"
      description="AFS System - 面向老年人的数字记忆传承系统技术文档">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
