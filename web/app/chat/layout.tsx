import Navbar from '@/components/navbar'
import { Footer } from '@/components/Footer'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <Footer />
    </div>
  )
}
