import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../../lib/supabase/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()
      
      // Give Supabase time to process the token from URL
      const { data: { session }, error } = await supabase.auth.getSession()
      
      console.log('CALLBACK SESSION:', session)
      console.log('CALLBACK ERROR:', error)

      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .single()

        if (!profile?.onboarding_complete) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
      } else {
        // No session found - redirect to login
        router.push('/login')
      }
    }

    // Small delay to let Supabase process the URL hash
    setTimeout(handleCallback, 500)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '2px solid #3b82f6',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p>Signing you in...</p>
      </div>
    </div>
  )
}