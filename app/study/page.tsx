'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StudyPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/notes') }, [router])
  return null
}
