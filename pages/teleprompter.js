import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

export default function Teleprompter() {
  const [script, setScript] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [fontSize, setFontSize] = useState(32)
  const [mirror, setMirror] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const scrollRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    // Load script from localStorage if coming from scripts page
    const saved = localStorage.getItem('teleprompter_script')
    if (saved) {
      setScript(saved)
      localStorage.removeItem('teleprompter_script')
    }
  }, [])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += speed
          // Stop at end
          if (scrollRef.current.scrollTop + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight) {
            setIsPlaying(false)
          }
        }
      }, 50)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed])

  const togglePlay = () => setIsPlaying(!isPlaying)

  const resetScroll = () => {
    setIsPlaying(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <>
      <Head>
        <title>Flow Teleprompter™ — CreatorFlow Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-void flex flex-col">

        {/* Header */}
        {!isFullscreen && (
          <nav className="sticky top-0 z-40 bg-graphite border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-tertiary hover:text-secondary transition-colors text-sm">
                ← Dashboard
              </Link>
              <span className="text-border">|</span>
              <span className="text-primary text-sm font-medium">Flow Teleprompter™</span>
            </div>
            <button
              onClick={toggleFullscreen}
              className="text-tertiary text-xs hover:text-secondary transition-colors"
            >
              ⛶ Fullscreen
            </button>
          </nav>
        )}

        <div className="flex-1 flex flex-col md:flex-row">

          {/* ── Controls Panel ── */}
          {!isFullscreen && (
            <div className="md:w-72 border-b md:border-b-0 md:border-r border-border bg-graphite p-6 flex flex-col gap-6">

              {/* Script input */}
              <div>
                <label className="block text-secondary text-xs uppercase tracking-widest mb-3">
                  Your Script
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Paste your script here or generate one from the Scripts page..."
                  rows={8}
                  className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none"
                />
              </div>

              {/* Speed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-secondary text-xs uppercase tracking-widest">Speed</label>
                  <span className="text-electric-glow text-xs font-mono">{speed}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-electric"
                />
                <div className="flex justify-between text-tertiary text-xs mt-1">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </div>

              {/* Font size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-secondary text-xs uppercase tracking-widest">Text Size</label>
                  <span className="text-electric-glow text-xs font-mono">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-electric"
                />
              </div>

              {/* Mirror mode */}
              <div className="flex items-center justify-between">
                <label className="text-secondary text-xs uppercase tracking-widest">Mirror Mode</label>
                <button
                  onClick={() => setMirror(!mirror)}
                  className={`w-12 h-6 rounded-full transition-all duration-200 ${mirror ? 'bg-electric' : 'bg-border'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-all duration-200 ${mirror ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-3 mt-auto">
                <button
                  onClick={resetScroll}
                  className="btn-ghost flex-1 py-3 rounded-xl text-sm"
                >
                  ↺ Reset
                </button>
                <button
                  onClick={togglePlay}
                  className="btn-electric flex-1 py-3 rounded-xl text-sm font-medium"
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              </div>

            </div>
          )}

          {/* ── Teleprompter Display ── */}
          <div className="flex-1 relative bg-void overflow-hidden">

            {/* Gradient overlays for focus line effect */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-void to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-void to-transparent z-10 pointer-events-none" />

            {/* Focus line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-electric/20 z-10 pointer-events-none" />

            {/* Script text */}
            <div
              ref={scrollRef}
              className="h-full overflow-y-scroll teleprompter-scroll px-8 md:px-16 py-32"
              style={{
                transform: mirror ? 'scaleX(-1)' : 'none',
              }}
            >
              {script ? (
                <p
                  className="teleprompter-text text-primary leading-loose text-center max-w-3xl mx-auto"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {script}
                </p>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-tertiary text-lg mb-4">No script loaded.</p>
                    <p className="text-tertiary text-sm mb-6">Paste your script in the panel or generate one.</p>
                    <Link href="/scripts" className="btn-electric px-6 py-3 rounded-xl text-sm font-medium inline-block">
                      Generate a Script
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen controls */}
            {isFullscreen && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                <button onClick={resetScroll} className="btn-ghost px-6 py-3 rounded-xl text-sm">
                  ↺
                </button>
                <button onClick={togglePlay} className="btn-electric px-8 py-3 rounded-xl text-sm font-medium">
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button onClick={() => setSpeed(s => Math.max(1, s - 1))} className="btn-ghost px-4 py-3 rounded-xl text-sm">
                  −
                </button>
                <span className="text-secondary text-xs">{speed}x</span>
                <button onClick={() => setSpeed(s => Math.min(8, s + 1))} className="btn-ghost px-4 py-3 rounded-xl text-sm">
                  +
                </button>
                <button onClick={toggleFullscreen} className="btn-ghost px-4 py-3 rounded-xl text-sm">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}