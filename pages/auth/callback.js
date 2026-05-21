import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // Exchange the code in URL for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      )

      if (error) {
        console.error('Auth callback error:', error)
        router.push('/login?error=auth_callback_failed')
        return
      }

      if (data.session) {
        // Check if onboarding is complete
        const { data: profile } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', data.session.user.id)
          .single()

        if (!profile?.onboarding_complete) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-secondary text-sm">Confirming your account...</p>
      </div>
    </div>
  )
}
