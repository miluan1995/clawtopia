'use client'
import { useState } from 'react'
import Landing from '@/components/Landing'
import Town from '@/components/Town'

export default function Home() {
  const [page, setPage] = useState<'landing'|'guide'|'town'>('landing')
  if (page === 'town') return <Town onBack={() => setPage('landing')} />
  return <Landing currentPage={page} onNavigate={setPage} />
}
