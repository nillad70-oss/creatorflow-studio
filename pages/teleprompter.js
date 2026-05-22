import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

export default function Teleprompter() {
  const [script, setScript] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [fontSize, setFontSize] = useState(32)
  const [mirror, setMirror] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const scrollRef = useRef(null)
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const playingRef = useRef(false)
  const speedRef = useRef(3)

  useEffect(() => {
    const saved = localStorage.getItem('teleprompter_script')
    if (saved) {
      setScript(saved)
      localStorage.removeItem('teleprompter_script')
    }
  }, [])

  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    if (!isPlaying) return
    let id
    const step = () => {
      const el = scrollRef.current
      if (!el || !playingRef.current) return
      el.scrollTop = el.scrollTop + speedRef.current * 0.5
      if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        setIsPlaying(false)
        return
      }
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [isPlaying])

  const togglePlay = () => setIsPlaying(p => !p)
  const resetScroll = () => {
    setIsPlaying(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  const startCamera = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      })
      streamRef.current = stream
      setCameraActive(true)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 100)
    } catch (err) { alert('Camera access denied.') }
  }

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraActive(false); setIsRecording(false)
  }

  const startRecording = () => {
    let count = 3
    setCountdown(count)
    const timer = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(timer); setCountdown(null); chunksRef.current = []
        const recorder = new MediaRecorder(streamRef.current)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = e => chunksRef.current.push(e.data)
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'creatorflow-recording.webm'; a.click()
          URL.revokeObjectURL(url)
        }
        recorder.start(); setIsRecording(true); setIsPlaying(true)
      } else { setCountdown(count) }
    }, 1000)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop()
    setIsRecording(false); setIsPlaying(false)
  }

  return (
    <>
      <Head>
        <title>Flow Teleprompter - CreatorFlow Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`html { scroll-behavior: auto !important; }`}</style>
      </Head>
      <div style={{ height: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <nav style={{ background: '#111', borderBottom: '1px solid #222', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/dashboard" style={{ color: '#666', fontSize: '14px', textDecoration: 'none' }}>Back</Link>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>Flow Teleprompter</span>
          </div>
        </nav>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '280px', flexShrink: 0, background: '#111', borderRight: '1px solid #222', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div>
              <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>Script</label>
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Paste your script here..."
                rows={8}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '12px', color: 'white', fontSize: '13px', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px' }}>Speed</label>
                <span style={{ color: '#3b82f6', fontSize: '12px' }}>{speed}</span>
              </div>
              <input type="range" min="1" max="10" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px' }}>Font Size</label>
                <span style={{ color: '#3b82f6', fontSize: '12px' }}>{fontSize}px</span>
              </div>
              <input type="range" min="20" max="72" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px' }}>Mirror</label>
              <button onClick={() => setMirror(m => !m)} style={{ width: '48px', height: '24px', borderRadius: '12px', background: mirror ? '#3b82f6' : '#333', border: 'none', cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: mirror ? '26px' : '2px', transition: 'left 0.2s' }} />
              </button>
            </div>
            <div style={{ borderTop: '1px solid #222', paddingTop: '16px' }}>
              <label style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '10px' }}>Record</label>
              {cameraActive && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'black', aspectRatio: '16/9', marginBottom: '10px' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                  {countdown && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
                      <span style={{ color: 'white', fontSize: '64px', fontWeight: 'bold' }}>{countdown}</span>
                    </div>
                  )}
                  {isRecording && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '4px 8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ color: 'white', fontSize: '11px' }}>REC</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {!cameraActive ? (
                  <button onClick={startCamera} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: '#1a1a1a', border: '1px solid #333', color: 'white', fontSize: '12px', cursor: 'pointer' }}>Start Camera</button>
                ) : !isRecording ? (
                  <button onClick={startRecording} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: '#ef4444', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Record</button>
                ) : (
                  <button onClick={stopRecording} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: '#991b1b', border: 'none', color: 'white', fontSize: '12px', cursor: 'pointer' }}>Stop and Save</button>
                )}
                {cameraActive && (
                  <button onClick={stopCamera} style={{ padding: '10px 14px', borderRadius: '12px', background: '#1a1a1a', border: '1px solid #333', color: 'white', fontSize: '12px', cursor: 'pointer' }}>X</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '16px' }}>
              <button onClick={resetScroll} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#1a1a1a', border: '1px solid #333', color: 'white', fontSize: '14px', cursor: 'pointer' }}>Reset</button>
              <button onClick={togglePlay} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: isPlaying ? '#1d4ed8' : '#3b82f6', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#050505' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, #050505, transparent)', zIndex: 10, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, #050505, transparent)', zIndex: 10, pointerEvents: 'none' }} />
            <div
              ref={scrollRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'scroll', padding: '45vh 64px', boxSizing: 'border-box', transform: mirror ? 'scaleX(-1)' : 'none', scrollBehavior: 'auto' }}
            >
              {script ? (
                <p style={{ fontSize: fontSize + 'px', lineHeight: 2, textAlign: 'center', maxWidth: '800px', margin: '0 auto', color: 'white', fontWeight: '300' }}>
                  {script}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '20vh', textAlign: 'center' }}>
                  <p style={{ color: '#444', fontSize: '18px' }}>Paste your script to begin.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
