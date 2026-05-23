import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase/client'
import { useRouter } from 'next/router'

export default function Teleprompter() {
  const [script, setScript] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [fontSize, setFontSize] = useState(28)
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef(null)
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const playingRef = useRef(false)
  const speedRef = useRef(3)
  const router = useRouter()

  useEffect(() => {
    const loadScript = async () => {
      const params = new URLSearchParams(window.location.search)
      const scriptId = params.get('script')
      if (scriptId) {
        const supabase = createClient()
        const { data } = await supabase.from('scripts').select('*').eq('id', scriptId).single()
        if (data) {
          const text = [data.hook, data.body, data.cta].filter(Boolean).join('\n\n')
          setScript(text)
          return
        }
      }
      const saved = localStorage.getItem('teleprompter_script')
      if (saved) { setScript(saved); localStorage.removeItem('teleprompter_script') }
    }
    loadScript()
  }, [])

  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    if (!isPlaying) return
    let id
    const animate = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop += speedRef.current * 0.2
        if (scrollRef.current.scrollTop + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight) {
          setIsPlaying(false)
          return
        }
      }
      id = requestAnimationFrame(animate)
    }
    id = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(id)
  }, [isPlaying])

  const startCamera = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      })
      streamRef.current = stream
      setCameraActive(true)
      setShowControls(false)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 100)
    } catch (err) { alert('Camera access denied.') }
  }

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraActive(false)
    setIsRecording(false)
    setIsPlaying(false)
    setShowControls(true)
  }

  const startRecording = () => {
    let count = 3
    setCountdown(count)
    const timer = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(timer)
        setCountdown(null)
        chunksRef.current = []
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
        recorder.start()
        setIsRecording(true)
        setIsPlaying(true)
      } else { setCountdown(count) }
    }, 1000)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop()
    setIsRecording(false)
    setIsPlaying(false)
  }

  const resetScroll = () => {
    setIsPlaying(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  return (
    <>
      <Head>
        <title>Flow Teleprompter™ — CreatorFlow Studio™</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <style>{`
          body { margin: 0; padding: 0; background: #000; overflow: hidden; }
          html { scroll-behavior: auto !important; }
          ::-webkit-scrollbar { display: none; }
        `}</style>
      </Head>

      <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>

        {/* CAMERA BACKGROUND — fills entire screen */}
        {cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              zIndex: 1
            }}
          />
        )}

        {/* SCRIPT OVERLAY — on top of camera */}
        {cameraActive && (
          <div
            ref={scrollRef}
            style={{
              position: 'absolute', inset: 0,
              overflowY: 'scroll',
              zIndex: 2,
              padding: '15vh 24px 40vh',
              boxSizing: 'border-box',
              scrollbarWidth: 'none',
            }}
          >
            {script ? (
              <p style={{
                fontSize: fontSize + 'px',
                lineHeight: 1.7,
                textAlign: 'center',
                color: 'white',
                fontWeight: '600',
                textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
                maxWidth: '600px',
                margin: '0 auto',
              }}>
                {script}
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <p style={{ color: 'white', fontSize: '18px', textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                  Tap ✕ to go back and load a script
                </p>
              </div>
            )}
          </div>
        )}

        {/* COUNTDOWN OVERLAY */}
        {countdown && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
}
