import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '../lib/supabase/client'

const CREATOR_AGENTS = [
  { id: 'marketing_director', label: 'Marketing Director', desc: 'Campaign strategy & positioning' },
  { id: 'brand_strategist', label: 'Brand Strategist', desc: 'Voice, identity & authority' },
  { id: 'copywriter', label: 'Copywriter', desc: 'Tight, conversion-focused writing' },
  { id: 'storyteller', label: 'Storytelling Expert', desc: 'Narrative-driven emotional content' },
  { id: 'viral_creator', label: 'Viral Creator', desc: 'Scroll-stopping pattern interrupts' },
  { id: 'sales_consultant', label: 'Sales Consultant', desc: 'Desire building & CTA mastery' },
  { id: 'business_coach', label: 'Business Coach', desc: 'Mindset & transformation language' },
  { id: 'social_media_manager', label: 'Social Media Manager', desc: 'Platform-native community growth' },
  { id: 'research_analyst', label: 'Research Analyst', desc: 'Data-driven credibility building' },
  { id: 'content_strategist', label: 'Content Strategist', desc: 'Topic angles & audience journey' },
]

const SCRIPT_MODES = [
  { id: 'educational', label: 'Educational' },
  { id: 'storytelling', label: 'Story' },
  { id: 'motivational', label: 'Motivational' },
  { id: 'promotional', label: 'Promotional' },
  { id: 'controversial', label: 'Hot Take' },
  { id: 'listicle', label: 'List' },
]

const CONTENT_GOALS = [
  { id: 'engagement', label: 'Engagement', desc: 'Comments & shares' },
  { id: 'authority', label: 'Authority', desc: 'Build credibility' },
  { id: 'leads', label: 'Leads', desc: 'Generate interest' },
  { id: 'sales', label: 'Sales', desc: 'Drive conversions' },
  { id: 'community', label: 'Community', desc: 'Grow your tribe' },
]

const OFFER_TYPES = [
  'Product', 'Service', 'Consultation', 'Community', 'Membership',
  'Course', 'Event', 'Newsletter', 'Affiliate Opportunity', 'Business Opportunity', 'Other',
]

const AUDIENCE_PROBLEMS = [
  'Burnout', 'Time Constraints', 'Income Constraints', 'Career Growth',
  'Leadership Challenges', 'Business Growth', 'AI Confusion', 'Productivity',
  'Visibility', 'Client Acquisition', 'Other',
]

const CTA_OBJECTIVES = [
  'Comment', 'DM', 'Follow', 'Book Call', 'Apply',
  'Join Community', 'Download Resource', 'Register', 'Subscribe', 'Visit Website',
]

function MultiSelect({ options, selected, onChange, label }) {
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }
  return (
    <div className="mb-4">
      <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
              selected.includes(opt) ? 'bg-electric/20 border border-electric/50 text-primary' : 'glass text-secondary hover:border-electric/20'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Scripts() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedScripts, setSavedScripts] = useState([])
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [topic, setTopic] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("viral_creator")
  const [scriptMode, setScriptMode] = useState("promotional")
  const [contentGoal, setContentGoal] = useState("engagement")
  const [offerTypes, setOfferTypes] = useState([])
  const [audienceProblems, setAudienceProblems] = useState([])
  const [ctaObjectives, setCtaObjectives] = useState([])
  const [generatedScript, setGeneratedScript] = useState(null)

  // Safe null-guarded charCount — never crashes
  const hook = (generatedScript && generatedScript.hook) ? generatedScript.hook : ""
  const body = (generatedScript && generatedScript.body) ? generatedScript.body : ""
  const cta = (generatedScript && generatedScript.cta) ? generatedScript.cta : ""
  const charCount = generatedScript ? (hook + " " + body + " " + cta).length : 0

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUser(user)
      const { data: profileData } = await supabase.from("users").select("*").eq("id", user.id).single()
      setProfile(profileData)
      const { data: scripts } = await supabase.from("scripts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
      setSavedScripts(scripts || [])
      setLoading(false)
      // Safe localStorage reads — all inside try-catch, all inside useEffect
      try {
        const savedTopic = localStorage.getItem("script_topic")
        if (savedTopic) { setTopic(savedTopic); localStorage.removeItem("script_topic") }
        const lastScript = localStorage.getItem("last_script")
        if (lastScript) {
          const parsed = JSON.parse(lastScript)
          if (parsed && typeof parsed === "object") setGeneratedScript(parsed)
        }
      } catch (e) {
        // Silent fail — localStorage not available or data corrupt
      }
    }
    load()
  }, [router])

  const handleGenerate = async () => {
    if (!topic.trim()) { setError("Please enter a topic."); return }
    setError("")
    setGenerating(true)
    setGeneratedScript(null)
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          niche: profile?.niche,
          audience: profile?.audience,
          tone: profile?.tone,
          platform: profile?.preferred_platform,
          script_mode: scriptMode,
          content_goal: contentGoal,
          creator_agent: selectedAgent,
          offer_types: offerTypes,
          audience_problems: audienceProblems,
          cta_objectives: ctaObjectives,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Failed to generate script.")
        setGenerating(false)
        return
      }
      if (data.script) {
        setGeneratedScript(data.script)
        // Persist last script safely
        try { localStorage.setItem("last_script", JSON.stringify(data.script)) } catch (e) {}
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    }
    setGenerating(false)
  }

  const handleClear = () => {
    setGeneratedScript(null)
    setTopic("")
    try { localStorage.removeItem("last_script") } catch (e) {}
  }

  const handleSave = async () => {
    if (!generatedScript) return
    setSaving(true)
    const supabase = createClient()
    const { data, error: saveError } = await supabase.from("scripts").insert({
      user_id: user.id,
      title: generatedScript.title || topic,
      topic,
      hook: generatedScript.hook || "",
      body: generatedScript.body || "",
      cta: generatedScript.cta || "",
      pacing: generatedScript.pacing || "",
      script_mode: scriptMode,
      platform: profile?.preferred_platform,
    }).select().single()
    if (!saveError && data) setSavedScripts(prev => [data, ...prev])
    setSaving(false)
  }

  const handleCopy = () => {
    if (!generatedScript) return
    const hashtags = generatedScript.hashtags
      ? (Array.isArray(generatedScript.hashtags) ? generatedScript.hashtags.join(" ") : generatedScript.hashtags)
      : ""
    const fullScript = [hook, body, cta, hashtags].filter(Boolean).join("\n\n")
    navigator.clipboard.writeText(fullScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenInTeleprompter = () => {
    if (!generatedScript) return
    try {
      localStorage.setItem("teleprompter_script", [hook, body, cta].filter(Boolean).join("\n\n"))
    } catch (e) {}
    router.push("/teleprompter")
  }

  if (loading) return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <>
      <Head>
        <title>Creator Intelligence Studio™ — NillaFlow Studio.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen bg-void">
        <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">← Dashboard</Link>
            <span className="text-border">|</span>
            <h1 className="text-primary text-sm font-medium">Creator Intelligence Studio™</h1>
          </div>
          <span className="text-tertiary text-xs hidden md:block">{profile?.niche} · {profile?.tone}</span>
        </nav>

        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── Left Column — Input ── */}
            <div>
              <div className="mb-6">
                <h2 style={{fontFamily: "var(--font-display)"}} className="text-2xl text-primary font-light mb-1">Creator Intelligence Studio™</h2>
                <p className="text-secondary text-sm">Select your agent. Enter your topic. Generate elite content.</p>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">Creator Agent</label>
                <div className="grid grid-cols-2 gap-2">
                  {CREATOR_AGENTS.map((agent) => (
                    <button key={agent.id} onClick={() => setSelectedAgent(agent.id)}
                      className={`px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        selectedAgent === agent.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${selectedAgent === agent.id ? "text-primary" : "text-secondary"}`}>{agent.label}</p>
                      <p className="text-tertiary text-xs mt-0.5">{agent.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-2 tracking-wide uppercase">Your topic or idea</label>
                <textarea
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); setError("") }}
                  placeholder="e.g. Why nurses should join an online digital business"
                  rows={3}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-3 tracking-wide uppercase">Content Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {SCRIPT_MODES.map((mode) => (
                    <button key={mode.id} onClick={() => setScriptMode(mode.id)}
                      className={`px-3 py-2.5 rounded-xl text-center transition-all duration-200 ${
                        scriptMode === mode.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${scriptMode === mode.id ? "text-primary" : "text-secondary"}`}>{mode.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-secondary text-xs mb-3 tracking-wide uppercase">Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_GOALS.map((goal) => (
                    <button key={goal.id} onClick={() => setContentGoal(goal.id)}
                      className={`px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        contentGoal === goal.id ? "bg-electric/20 border border-electric/50" : "glass hover:border-electric/20"
                      }`}>
                      <p className={`text-xs font-medium ${contentGoal === goal.id ? "text-primary" : "text-secondary"}`}>{goal.label}</p>
                      <p className="text-tertiary text-xs mt-0.5">{goal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass border border-electric/20 hover:border-electric/50 transition-all duration-200 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-electric-glow text-sm">⚙</span>
                  <span className="text-primary text-xs font-medium tracking-wide">Advanced Settings</span>
                  {(offerTypes.length + audienceProblems.length + ctaObjectives.length) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-electric/20 text-electric-glow text-xs">
                      {offerTypes.length + audienceProblems.length + ctaObjectives.length} selected
                    </span>
                  )}
                </div>
                <span className="text-electric-glow text-xs">{showAdvanced ? "▾ Hide" : "▸ Show"}</span>
              </button>

              {showAdvanced && (
                <div className="glass rounded-2xl p-4 mb-5">
                  <MultiSelect label="What are you promoting?" options={OFFER_TYPES} selected={offerTypes} onChange={setOfferTypes} />
                  <MultiSelect label="Audience Pain Points" options={AUDIENCE_PROBLEMS} selected={audienceProblems} onChange={setAudienceProblems} />
                  <MultiSelect label="Desired Audience Action" options={CTA_OBJECTIVES} selected={ctaObjectives} onChange={setCtaObjectives} />
                </div>
              )}

              {error && (
                <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-electric w-full py-4 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Writing your script...
                  </span>
                ) : "✦ Generate Script"}
              </button>

              {profile?.niche && (
                <p className="text-tertiary text-xs text-center mt-3">
                  Generating for {profile.niche} · {profile.audience}
                </p>
              )}

              {savedScripts.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-secondary text-xs uppercase tracking-widest mb-3">Saved Scripts</h3>
                  <div className="space-y-2">
                    {savedScripts.map((script) => (
                      <div
                        key={script.id}
                        onClick={() => setGeneratedScript({
                          title: script.title,
                          hook: script.hook || "",
                          body: script.body || "",
                          cta: script.cta || "",
                          pacing: script.pacing || "",
                        })}
                        className="glass rounded-xl px-4 py-3 flex items-center justify-between group cursor-pointer hover:border-electric/20 transition-all">
                        <div>
                          <p className="text-primary text-xs font-medium">{script.title}</p>
                          <p className="text-tertiary text-xs">{new Date(script.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-tertiary text-xs group-hover:text-electric-glow transition-colors">Load →</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Column — Output ── */}
            <div>
              {generatedScript ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 style={{fontFamily: "var(--font-display)"}} className="text-xl text-primary font-light">Your Script</h2>
                      <p className={`text-xs mt-0.5 ${charCount > 600 ? "text-error" : "text-secondary"}`}>{charCount} / 600 characters</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleClear} className="btn-ghost px-3 py-2 rounded-lg text-xs">✕ Clear</button>
                      <button onClick={handleSave} disabled={saving} className="btn-ghost px-4 py-2 rounded-lg text-xs disabled:opacity-50">{saving ? "Saving..." : "↓ Save"}</button>
                      <button onClick={handleOpenInTeleprompter} className="btn-electric px-4 py-2 rounded-lg text-xs">▶ Teleprompter</button>
                      <button onClick={handleCopy} className="btn-ghost px-3 py-2 rounded-lg text-xs">{copied ? "Copied!" : "Copy"}</button>
                    </div>
                  </div>

                  {hook && (
                    <div className="glass rounded-2xl p-5 mb-3 border-electric/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Hook</span>
                        <span className="text-tertiary text-xs">— stops the scroll</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{hook}</p>
                    </div>
                  )}

                  {body && (
                    <div className="glass rounded-2xl p-5 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Body</span>
                        <span className="text-tertiary text-xs">— core value</span>
                      </div>
                      <div className="text-primary text-sm leading-relaxed space-y-2">
                        {body.split("\n").map((line, i) => line.trim() ? <p key={i}>{line}</p> : null)}
                      </div>
                    </div>
                  )}

                  {cta && (
                    <div className="glass rounded-2xl p-5 mb-3 border-gold/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-gold text-xs font-mono uppercase tracking-widest">CTA</span>
                        <span className="text-tertiary text-xs">— call to action</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{cta}</p>
                    </div>
                  )}

                  {generatedScript.hashtags && (
                    <div className="glass rounded-2xl p-5 mb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Hashtags</span>
                        <span className="text-tertiary text-xs">— exactly 5</span>
                      </div>
                      <p className="text-primary text-sm">
                        {Array.isArray(generatedScript.hashtags) ? generatedScript.hashtags.join(" ") : generatedScript.hashtags}
                      </p>
                    </div>
                  )}

                  {generatedScript.solution_stack && generatedScript.solution_stack.length > 0 && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-electric/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-electric-glow text-xs font-mono uppercase tracking-widest">Solution Stack</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generatedScript.solution_stack.map((tool, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-electric/10 text-electric-glow text-xs border border-electric/20">{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedScript.creator_response && (
                    <div className="glass rounded-2xl p-5 mb-3 border border-gold/20 bg-gold/5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-mono uppercase tracking-widest" style={{color: "#C8A96E"}}>Creator Response</span>
                        <span className="text-tertiary text-xs">— send this when someone engages</span>
                      </div>
                      <p className="text-primary text-sm leading-relaxed">{generatedScript.creator_response}</p>
                    </div>
                  )}

                  <div className="glass rounded-2xl p-5 mt-3 border border-electric/20">
                    <p className="text-xs font-mono uppercase tracking-widest text-electric-glow mb-1">Post Preview</p>
                    <p className="text-tertiary text-xs mb-3">How your hook looks as a post</p>
                    <div className="rounded-xl p-4 mb-3" style={{background: "linear-gradient(135deg, #1a1200 0%, #2a1f08 100%)"}}>
                      <p className="text-xs uppercase tracking-widest mb-2" style={{color: "#C8A96E"}}>Hook</p>
                      <p className="text-white text-sm font-medium leading-relaxed">{hook}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{background: "#111"}}>
                      <p className="text-xs uppercase tracking-widest mb-2 text-tertiary">Caption</p>
                      <p className="text-secondary text-xs leading-relaxed">{body ? body.substring(0, 120) + "..." : ""}</p>
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-5 mt-3 border border-electric/20">
                    <p className="text-xs font-mono uppercase tracking-widest text-electric-glow mb-1">Publish</p>
                    <p className="text-tertiary text-xs mb-3">Schedule this post to all your platforms instantly</p>
                    <Link href="https://blotato.com/?ref=leonilla" className="btn-electric w-full py-3 rounded-xl text-sm font-medium text-center block">Schedule with Blotato</Link>
                  </div>

                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4 text-border">❋</div>
                    <p className="text-tertiary text-sm">Your script will appear here.</p>
                    <p className="text-tertiary text-xs mt-1">Select your agent and click Generate.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
