import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'

// ── Icons (inline SVG to avoid import overhead) ──
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8L6.5 11.5L13 4.5" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M6 4L16 10L6 16V4Z" fill="currentColor"/>
  </svg>
)

// ── Data ──
const PAIN_POINTS = [
  "I hate how I sound on camera.",
  "I keep doing endless retakes.",
  "I forget everything the moment I hit record.",
  "I know what I want to say — I just can't flow.",
  "Recording feels mentally exhausting.",
  "I never post consistently because of this.",
]

const WORKFLOW_STEPS = [
  { step: "01", label: "Idea", desc: "AI generates 30 days of personalized content ideas for your niche." },
  { step: "02", label: "Script", desc: "Your idea becomes a natural, conversational speaking script — not robotic text." },
  { step: "03", label: "Record", desc: "Flow Teleprompter™ scrolls your script smoothly while you speak naturally." },
  { step: "04", label: "Post", desc: "Export captions, finish content, and post — without leaving the app." },
]

const FEATURES = [
  {
    icon: "✦",
    title: "Flow Teleprompter™",
    desc: "Cinematic, smooth-scrolling teleprompter built for mobile recording. Adjustable speed, fullscreen mode, mirror mode. Record naturally without memorizing a single word.",
    tag: "Hero Feature"
  },
  {
    icon: "◈",
    title: "AI Content Planner",
    desc: "30-day personalized content calendar generated from your niche, tone, and goals. Never stare at a blank page again.",
    tag: "Content Engine"
  },
  {
    icon: "❋",
    title: "AI Script Generator",
    desc: "Scripts that sound like you — conversational, emotionally paced, with natural breathing rhythm. Not corporate AI text.",
    tag: "Script Engine"
  },
  {
    icon: "◉",
    title: "Creator Library",
    desc: "Every script, hook, idea, and caption — saved, organized, accessible. Your entire content archive in one place.",
    tag: "Organization"
  },
]

const PLANS = [
  {
    name: "Monthly",
    price: "17",
    period: "/month",
    desc: "3-day free trial",
    features: [
      "Unlimited AI scripts",
      "Unlimited teleprompter",
      "30-day content calendar",
      "AI captions export",
      "Premium script modes",
      "Creator voice profiles",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/signup?plan=pro",
    highlight: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  },
  {
    name: "Annual",
    price: "144",
    period: "/year",
    desc: "3-day free trial",
    yearlyNote: "Just $12/mo — save $60",
    highlight: true,
    features: [
      "Unlimited AI scripts",
      "Unlimited teleprompter",
      "30-day content calendar",
      "AI captions export",
      "Premium script modes",
      "Creator voice profiles",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/signup?plan=pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
  },
]

// ── Component ──
export default function Landing() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const handleCheckout = async (priceId) => {
  window.location.href = '/signup?plan=pro'
}
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <Head>
        <title>CreatorFlow Studio™ — Create. Speak. Record. Flow.</title>
        <meta name="description" content="Stop doing endless retakes. CreatorFlow Studio helps you move from idea to recorded content naturally, without memorization or mental exhaustion." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta property="og:title" content="CreatorFlow Studio™" />
        <meta property="og:description" content="Create. Speak. Record. Flow." />
      </Head>

      <div className="min-h-screen bg-void grain">

        {/* ── Nav ── */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-electric flex items-center justify-center">
                <span className="text-white text-xs font-bold">CFS</span>
              </div>
              <span style={{fontFamily: 'var(--font-display)'}} className="text-white text-xl font-semibold tracking-wide">
                CreatorFlow Studio™
              </span>
            </div>

            {/* Nav links — desktop */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#workflow" className="text-secondary text-sm hover:text-primary transition-colors">How it works</a>
              <a href="#features" className="text-secondary text-sm hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="text-secondary text-sm hover:text-primary transition-colors">Pricing</a>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-secondary text-sm hover:text-primary transition-colors hidden md:block">
                Sign in
              </Link>
              <Link href="/signup" className="btn-electric px-4 py-2 rounded-lg text-sm font-medium">
                Start Free
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="relative pt-32 pb-24 px-6 overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 60%)'}} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-electric/5 blur-[120px] pointer-events-none" />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-electric/20 bg-electric/5 text-electric-glow text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-electric-glow animate-pulse" />
              AI-Powered Creator Confidence System
            </div>

            {/* Headline */}
            <h1 style={{fontFamily: 'var(--font-display)'}} className="text-5xl md:text-7xl lg:text-8xl font-light text-primary leading-[1.05] tracking-tight mb-6">
              Record Naturally.
              <br />
              <em className="text-electric-glow italic">Without Memorizing.</em>
            </h1>

            {/* Sub */}
            <p className="text-secondary text-lg md:text-xl font-light max-w-2xl mx-auto mb-10 leading-relaxed">
              The AI creator studio that takes you from blank page to confident recording — scripts, teleprompter, captions. All in one flow.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/signup" className="btn-electric w-full sm:w-auto px-8 py-4 rounded-xl text-base font-medium inline-flex items-center justify-center gap-2">
                Start Free — Create. Speak. Record. Flow.
              </Link>
              <a href="#workflow" className="btn-ghost w-full sm:w-auto px-8 py-4 rounded-xl text-base inline-flex items-center justify-center gap-2">
                <PlayIcon />
                See how it works
              </a>
            </div>

            {/* Social proof */}
            <p className="text-tertiary text-sm">
              Stop overthinking. Start creating.{" "}
              <span className="text-secondary">flow</span>.
            </p>
          </div>
        </section>

        {/* ── Pain Points ── */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-tertiary text-sm uppercase tracking-widest mb-3">Sound familiar?</p>
              <h2 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light">
                Every creator has said this.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PAIN_POINTS.map((pain, i) => (
                <div key={i} className="glass rounded-xl px-5 py-4 flex items-start gap-3">
                  <span className="text-tertiary mt-0.5 text-lg leading-none">"</span>
                  <p className="text-secondary text-sm leading-relaxed">{pain}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <div className="divider-glow mb-8" />
              <p style={{fontFamily: 'var(--font-display)'}} className="text-2xl md:text-3xl text-primary font-light italic">
                CreatorFlow Studio™ fixes all of this.
              </p>
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section id="workflow" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-tertiary text-sm uppercase tracking-widest mb-3">The System</p>
              <h2 style={{fontFamily: 'var(--font-display)'}} className="text-4xl md:text-5xl text-primary font-light mb-4">
                One smooth flow.
              </h2>
              <p className="text-secondary text-lg font-light">Idea → Script → Record → Post</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKFLOW_STEPS.map((item, i) => (
                <div key={i} className="relative">
                  {/* Connector line */}
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-4 h-px bg-gradient-to-r from-border to-transparent z-10" />
                  )}

                  <div className="glass rounded-2xl p-6 h-full hover:border-electric/20 transition-colors duration-300 group">
                    <div className="text-electric-glow/40 text-xs font-mono mb-4 group-hover:text-electric-glow transition-colors">
                      {item.step}
                    </div>
                    <h3 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium mb-3">
                      {item.label}
                    </h3>
                    <p className="text-secondary text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gold-glow pointer-events-none" />
          <div className="relative max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-tertiary text-sm uppercase tracking-widest mb-3">Core Features</p>
              <h2 style={{fontFamily: 'var(--font-display)'}} className="text-4xl md:text-5xl text-primary font-light">
                Everything you need. Nothing you don't.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <div key={i} className={`glass rounded-2xl p-8 group hover:border-electric/20 transition-all duration-300 ${i === 0 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
                  <div className="flex items-start justify-between mb-6">
                    <span className="text-2xl text-electric-glow">{f.icon}</span>
                    <span className="text-xs text-tertiary border border-border rounded-full px-3 py-1">
                      {f.tag}
                    </span>
                  </div>
                  <h3 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium mb-3">
                    {f.title}
                  </h3>
                  <p className="text-secondary text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Teleprompter Showcase ── */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
              {/* Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-electric/10 blur-3xl pointer-events-none" />

              <div className="relative text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs mb-6">
                  ✦ Flow Teleprompter™
                </div>
                <h2 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-5xl text-primary font-light mb-4">
                  Record without fear.
                </h2>
                <p className="text-secondary text-base font-light max-w-xl mx-auto">
                  Your script scrolls smoothly at exactly your pace. You read naturally. The camera sees confidence.
                </p>
              </div>

              {/* Mock teleprompter UI */}
              <div className="relative bg-void/80 rounded-2xl border border-border overflow-hidden max-w-sm mx-auto">
                <div className="bg-surface px-4 py-3 flex items-center justify-between border-b border-border">
                  <span className="text-tertiary text-xs font-mono">Flow Teleprompter™</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-success text-xs">Ready</span>
                  </div>
                </div>
                <div className="p-6 relative overflow-hidden" style={{height: '220px'}}>
                  <div className="absolute inset-0 bg-gradient-to-b from-void/80 via-transparent to-void/80 z-10 pointer-events-none" />
                  <p className="teleprompter-text text-primary/30 text-lg leading-loose mb-4">
                    Hey, have you ever felt like you know exactly what you want to say...
                  </p>
                  <p className="teleprompter-text text-primary text-xl leading-loose mb-4 relative z-0">
                    But the moment you hit record, your mind just goes completely blank?
                  </p>
                  <p className="teleprompter-text text-primary/30 text-lg leading-loose">
                    That's exactly why I created this — and why you need to hear this...
                  </p>
                </div>
                <div className="bg-surface px-4 py-3 flex items-center justify-between border-t border-border">
                  <span className="text-tertiary text-xs">Speed: 1.0x</span>
                  <div className="flex items-center gap-3">
                    <button className="w-8 h-8 rounded-full bg-electric flex items-center justify-center">
                      <span className="text-white text-xs">▐▐</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Founder Story ── */}
        <section className="py-20 px-6 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-3xl p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <p className="text-tertiary text-sm uppercase tracking-widest mb-4">Why CreatorFlow exists</p>
                  <h2 style={{fontFamily: 'var(--font-display)'}} className="text-3xl md:text-4xl text-primary font-light mb-6 leading-tight">
                    "I've been a creator since 2021.
                    <br />
                    <em className="text-electric-glow">For 5 years, I struggled."</em>
                  </h2>
                  <div className="space-y-4 text-secondary text-base leading-relaxed">
                    <p>Memorizing scripts made me rigid. I stuttered. I missed lines. I started over. Days. Hours. Sometimes weeks lost to endless retakes.</p>
                    <p>When I finally discovered teleprompters, it gave me a new lease of life. But I still had to jump between apps — one for ideas, one for scripts, one for recording, one for captions.</p>
                    <p>So I built CreatorFlow Studio™ — a complete virtual studio in your pocket. This morning I went from idea to posted in under 10 minutes.</p>
                    <p className="text-primary font-medium">"I don't recall the last time I moved that fast."</p>
                  </div>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-electric/20 border border-electric/30 flex items-center justify-center">
                      <span className="text-electric-glow font-bold">L</span>
                    </div>
                    <div>
                      <p className="text-primary text-sm font-medium">Leonilla Addeh</p>
                      <p className="text-tertiary text-xs">Founder, CreatorFlow Studio™ · Nurse · Creator</p>
                    </div>
                  </div>
                </div>
                <div className="md:w-64 glass rounded-2xl p-6 border border-electric/20">
                  <p className="text-electric-glow text-xs uppercase tracking-widest mb-4">The transformation</p>
                  <div className="space-y-3">
                    {['❌ Hours lost to retakes', '❌ Rigid from memorizing', '❌ Switching between apps', '❌ Inconsistent posting', '✅ Idea to posted in 10 mins', '✅ Natural confident delivery', '✅ Everything in one flow'].map((item, i) => (
                      <p key={i} className={`text-sm ${item.startsWith('✅') ? 'text-primary' : 'text-tertiary line-through'}`}>{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-tertiary text-sm uppercase tracking-widest mb-3">Pricing</p>
              <h2 style={{fontFamily: 'var(--font-display)'}} className="text-4xl md:text-5xl text-primary font-light mb-4">
                Simple. Honest. Creator-first.
              </h2>
              <p className="text-secondary font-light">Start free. Upgrade when you're ready to go unlimited.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PLANS.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-8 relative overflow-hidden transition-all duration-300 ${
                    plan.highlight
                      ? 'bg-electric/10 border border-electric/30 shadow-electric'
                      : 'glass'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric to-transparent" />
                  )}

                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 style={{fontFamily: 'var(--font-display)'}} className="text-2xl text-primary font-medium">
                        {plan.name}
                      </h3>
                      {plan.highlight && (
                        <span className="text-xs bg-electric/20 text-electric-glow px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl text-primary font-light">${plan.price}</span>
                      <span className="text-secondary text-sm">{plan.period}</span>
                    </div>
                    {plan.yearlyNote && (
                      <p className="text-tertiary text-xs mt-1">{plan.yearlyNote}</p>
                    )}
                    <p className="text-electric-glow text-sm mt-2">{plan.desc}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-3">
                        <CheckIcon />
                        <span className="text-secondary text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
  onClick={() => handleCheckout(plan.priceId)}
  className={`w-full py-3 rounded-xl text-sm ${
    plan.highlight
      ? 'btn-electric'
      : 'btn-ghost'
  }`}
>
  {plan.cta}
</button>
                </div>
              ))}
            </div>

            <p className="text-center text-tertiary text-xs mt-6">
              Cancel anytime. No commitments. Your creative flow, on your terms.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-electric-glow pointer-events-none" />
          <div className="relative max-w-3xl mx-auto text-center">
            <h2 style={{fontFamily: 'var(--font-display)'}} className="text-4xl md:text-6xl text-primary font-light mb-6 leading-tight">
              You already know what to say.
              <br />
              <em className="text-electric-glow italic">Let's help you say it.</em>
            </h2>
            <p className="text-void text-lg font-light mb-10">
              Join creators who stopped overthinking, stopped retaking, and started flowing.
            </p>
            <Link href="/signup" className="btn-electric px-10 py-4 rounded-xl text-base font-medium inline-block">
              Start Free — Create. Speak. Record. Flow.
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border py-10 px-6">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-electric flex items-center justify-center">
                <span className="text-white text-xs font-bold">CFS</span>
              </div>
              <span style={{fontFamily: 'var(--font-display)'}} className="text-secondary text-sm">
                CreatorFlow Studio™
              </span>
            </div>
            <p className="text-tertiary text-xs">
              © 2026 CreatorFlow Studio™. Built for creators who flow.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-tertiary text-xs hover:text-secondary transition-colors">Privacy</Link>
              <Link href="/terms" className="text-tertiary text-xs hover:text-secondary transition-colors">Terms</Link>
              <Link href="/login" className="text-tertiary text-xs hover:text-secondary transition-colors">Sign in</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
