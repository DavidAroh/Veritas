'use client'

import Header from '@/components/Header'
import Hero from '@/components/Hero'
import AnalyzerDemo from '@/components/AnalyzerDemo'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />
      <Hero />
      <AnalyzerDemo />
      <HowItWorks />
      <Features />
      <Footer />
    </main>
  )
}
