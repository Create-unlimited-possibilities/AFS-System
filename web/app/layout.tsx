import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { PermissionProvider } from "@/components/providers/PermissionProvider"
import { NavbarWrapper } from "@/components/NavbarWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "传家之宝 AFS System",
  description: "面向老年人的数字记忆传承系统",
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <PermissionProvider>
            <NavbarWrapper>
              {children}
            </NavbarWrapper>
          </PermissionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
