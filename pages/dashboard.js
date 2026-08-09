import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '◈' },
  { href: '/build-story', label: 'My Story', icon: '✦' },
  { href: '/planner', label: 'Content Planner', icon: '◉' },
  { href: '/scripts', label: 'Scripts', icon: '❋' },
  { href: '/teleprompter', label: 'Teleprompter', icon: '▶' },
  { href: '/captions', label: 'Captions', icon: '◇' },
  { href: '/library', label: 'Library', icon: '◆' },
]

const QUICK_ACTIONS = [
  {
    title: 'Build Your Story',
    desc: 'Answer 6 questions once — power every piece of content after',
    icon: '✦',
    href: '/build-story',
    color: 'gold',
    featured: true,
  },
  {
    title: 'Generate Content Ideas',
    desc: 'Get 30 days of personalized content ideas',
    icon: '◉',
    href: '/planner',
    color: 'electric',
  },
  {
    title: 'Write a Script',
    desc: 'Turn your idea into a natural speaking script',
    icon: '❋',
    href: '/scripts',
    color: 'gold',
  },
  {
    title: 'Open Teleprompter',
    desc: 'Record naturally without memorizing',
    icon: '▶',
    href: '/teleprompter',
    color: 'electric',
  },
  {
    title: 'Generate Captions',
    desc: 'Export captions for your content',
    icon: '◇',
    href: '/captions',
    color: 'gold',
  },
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scripts, setScripts] = useState([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const loadDashboard = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUser(user)

      // Load profile
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      // Load recent scripts
      const { data: scriptsData } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      setScripts(scriptsData || [])
      setLoading(false)
    }

    loadDashboard()
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-secondary text-sm">Loading your studio...</p>
        </div>
      </div>
    )
  }

  const firstName = profile?.email?.split('@')[0] || 'Creator'
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)

  return (
    <>
      <Head>
        <title>Dashboard — NillaFlow Studio™.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex">

        {/* ── Sidebar — Desktop ── */}
        <aside className="hidden md:flex flex-col w-60 border-r border-border bg-graphite fixed left-0 top-0 bottom-0 z-40">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="14" y1="14" x2="14" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><line x1="14" y1="14" x2="66" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><line x1="66" y1="14" x2="66" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><path d="M14 40 C24 28 34 52 40 40 C46 28 56 52 66 40" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none"/><path d="M14 52 C24 40 34 64 40 52 C46 40 56 64 66 52" stroke="#C8A96E" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
              </div>
              <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-lg font-medium">
                NillaFlow Studio™
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  router.pathname === item.href
                    ? 'bg-electric/10 text-electric-glow border border-electric/20'
                    : 'text-secondary hover:text-primary hover:bg-white/4'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-electric/20 flex items-center justify-center">
                <span className="text-electric-glow text-xs font-medium">
                  {displayName.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-xs font-medium truncate">{displayName}</p>
                <p className="text-tertiary text-xs truncate">{profile?.subscription_tier || 'free'} plan</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-tertiary text-xs hover:text-secondary transition-colors rounded-lg hover:bg-white/4"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Mobile Header ── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-graphite border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="14" y1="14" x2="14" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><line x1="14" y1="14" x2="66" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><line x1="66" y1="14" x2="66" y2="66" stroke="white" strokeWidth="10" strokeLinecap="round"/><path d="M14 40 C24 28 34 52 40 40 C46 28 56 52 66 40" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none"/><path d="M14 52 C24 40 34 64 40 52 C46 40 56 64 66 52" stroke="#C8A96E" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>
            </div>
            <span style={{fontFamily: 'var(--font-display)'}} className="text-primary text-base font-medium">
              NillaFlow Studio™
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-secondary p-1"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-graphite pt-14">
            <nav className="px-4 py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-secondary hover:text-primary hover:bg-white/4 transition-all"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-tertiary text-sm hover:text-secondary transition-colors"
              >
                Sign out
              </button>
            </nav>
          </div>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 md:ml-60 pt-14 md:pt-0">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">

            {/* Welcome */}
            <div className="mb-10">
              <p className="text-tertiary text-sm mb-1">Hi,</p>
              <h1 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light">
                {displayName}. Ready to flow?
              </h1>
              {profile?.niche && (
                <p className="text-secondary text-sm mt-2">
                  {profile.niche} · {profile.preferred_platform} · {profile.tone} tone
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mb-10">
              <h2 className="text-secondary text-xs uppercase tracking-widest mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className={`glass rounded-2xl p-5 hover:border-electric/20 transition-all duration-200 group ${
                      action.featured ? 'sm:col-span-2 bg-electric/5 border-electric/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        action.featured ? 'bg-electric/20' : 'bg-white/4'
                      }`}>
                        <span className={`text-lg ${action.featured ? 'text-electric-glow' : 'text-secondary'}`}>
                          {action.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium mb-1 group-hover:text-primary transition-colors ${
                          action.featured ? 'text-primary' : 'text-secondary'
                        }`}>
                          {action.title}
                        </h3>
                        <p className="text-tertiary text-xs leading-relaxed">{action.desc}</p>
                      </div>
                      <span className="text-tertiary group-hover:text-secondary transition-colors text-sm">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Scripts */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-secondary text-xs uppercase tracking-widest">Recent Scripts</h2>
                <Link href="/scripts" className="text-electric-glow text-xs hover:underline">
                  View all →
                </Link>
              </div>

              {scripts.length > 0 ? (
                <div className="space-y-3">
                  {scripts.map((script) => (
                    <div key={script.id} className="glass rounded-xl px-5 py-4 flex items-center justify-between group hover:border-electric/20 transition-all">
                      <div>
                        <p className="text-primary text-sm font-medium">{script.title}</p>
                        <p className="text-tertiary text-xs mt-0.5">
                          {new Date(script.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        href={`/teleprompter?script=${script.id}`}
                        className="text-tertiary text-xs hover:text-electric-glow transition-colors"
                      >
                        Open →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 text-center">
                  <p className="text-tertiary text-sm mb-4">No scripts yet. Create your first one.</p>
                  <Link href="/scripts" className="btn-electric px-6 py-2.5 rounded-xl text-sm font-medium inline-block">
                    Write First Script
                  </Link>
                </div>
              )}
            </div>

            {/* Upgrade banner for free users */}
            {profile?.subscription_tier === 'free' && (
              <div className="glass rounded-2xl p-6 border-gold/20 bg-gold/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 style={{fontFamily: 'var(--font-display)'}} className="text-xl text-primary font-medium mb-1">
                      Go unlimited.
                    </h3>
                    <p className="text-secondary text-sm">
                      Unlock unlimited scripts, teleprompter, and captions for $17/month.
                    </p>
                  </div>
                  <Link
                    href="/settings/billing"
                    className="flex-shrink-0 bg-gold/20 border border-gold/30 text-gold px-4 py-2 rounded-xl text-sm font-medium hover:bg-gold/30 transition-colors whitespace-nowrap"
                  >
                    Upgrade →
                  </Link>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  )
}