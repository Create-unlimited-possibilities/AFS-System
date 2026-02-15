'use client';

import { usePathname } from 'next/navigation';
import { Github, BookOpen, Heart } from 'lucide-react';

const authPaths = ['/login', '/register'];

// Bilingual text support
const text = {
  'zh-CN': {
    technicalSupport: '技术支援',
    documentation: '文档站点',
    github: 'GitHub 仓库',
    madeWith: '用爱制作',
    copyright: '传家之宝 AFS System',
  },
  'en': {
    technicalSupport: 'Technical Support',
    documentation: 'Documentation',
    github: 'GitHub Repository',
    madeWith: 'Made with',
    copyright: 'AFS System - Family Treasure',
  },
};

export function Footer() {
  const pathname = usePathname();
  const showFooter = !authPaths.some(path => pathname?.startsWith(path));

  // Detect language from pathname or default to Chinese
  const isEnglish = pathname?.startsWith('/en');
  const locale = isEnglish ? 'en' : 'zh-CN';
  const t = text[locale];

  // Get URLs from environment variables or use defaults
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3003';
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/Create-unlimited-possibilities/AFS-System';

  if (!showFooter) {
    return null;
  }

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Technical Support Links */}
          <div className="flex items-center gap-6">
            <span className="text-sm text-muted-foreground font-medium">
              {t.technicalSupport}
            </span>
            <div className="flex items-center gap-4">
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span>{t.documentation}</span>
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>{t.github}</span>
              </a>
            </div>
          </div>

          {/* Copyright */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{t.madeWith}</span>
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            <span className="mx-1">|</span>
            <span>&copy; {new Date().getFullYear()} {t.copyright}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
