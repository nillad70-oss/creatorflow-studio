import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase/client'

export default function Teleprompter() {
  const [script, setScript] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [fontSize, setFontSize] = useState(28)
  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef(null)
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const speedRef = useRef(3)

  useEffect(() => {
    const loadScript = async () => {
      const params = new URLSearchParams(window.location.search)
      const scriptId = params.get('script')
      if (scriptId) {
        const supabase = createClient()
        const { data } = await supabase.from('scripts').select('*').eq('id', scriptId).single()
        if (data) {
          setScript([data.hook, data.body, data.cta].filter(Boolean).join('\n\n'))
          return
        }
      }
      const saved = localStorage.getItem('teleprompter_script')
      if (saved) { setScript(saved); localStorage.removeItem('teleprompter_script') }
    }
    loadScript()
  }, [])

  useEffect(() => { speedRef.current = speed }, [speed])

  useEffect(() => {
    if (!isPlaying) return
    let id
    const animate = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop += (speedRef.current * 1.2) + 1
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
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
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
    setCameraActive(false)
    setIsRecording(false)
    setIsPlaying(false)
  }

  const startRecording = () => {
    // Use native camera on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      setIsPlaying(true)
      setIsRecording(true)
      // Open native camera
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'video/*'
      input.capture = 'user'
      input.click()
      input.onchange = () => { setIsRecording(false) }
      return
    }
    // Desktop recording
    let count = 3
    setCountdown(count)
    const timer = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(timer)
        setCountdown(null)
        chunksRef.current = []
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'
        const recorder = new MediaRecorder(streamRef.current, { mimeType })
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = e => chunksRef.current.push(e.data)
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'creatorflow-recording.mp4'
          a.click()
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
        <title>Flow Teleprompter - CreatorFlow Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <style>{`body{margin:0;padding:0;background:#000;overflow:hidden}html{scroll-behavior:auto!important}::-webkit-scrollbar{display:none}`}</style>
      </Head>
      <div style={{position:'fixed',inset:0,background:'#000',overflow:'hidden'}}>
        {cameraActive && (
          <video ref={videoRef} autoPlay muted playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',zIndex:1,pointerEvents:'none'}} />
        )}
        {cameraActive && (
          <div ref={scrollRef} style={{position:'absolute',inset:0,overflowY:'scroll',zIndex:3,padding:'15vh 24px 40vh',WebkitOverflowScrolling:'touch',boxSizing:'border-box',scrollbarWidth:'none'}}>
            {script ? (
              <p style={{fontSize:fontSize+'px',lineHeight:1.7,textAlign:'center',color:'white',fontWeight:'600',textShadow:'0 2px 8px rgba(0,0,0,0.9)',maxWidth:'600px',margin:'0 auto'}}>
                {script}
              </p>
            ) : (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
                <p style={{color:'white',fontSize:'18px',textAlign:'center',textShadow:'0 2px 8px rgba(0,0,0,0.9)'}}>Go back and load a script first</p>
              </div>
            )}
          </div>
        )}
        {countdown && (
          <div style={{position:'absolute',inset:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)'}}>
            <span style={{color:'white',fontSize:'120px',fontWeight:'bold'}}>{countdown}</span>
          </div>
        )}
        {cameraActive && (
          <div style={{position:'absolute',top:0,left:0,right:0,zIndex:5,padding:'48px 20px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)'}}>
            <button onClick={stopCamera} style={{width:'44px',height:'44px',borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.3)',color:'white',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            {isRecording && (
              <div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.5)',borderRadius:'20px',padding:'6px 12px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444'}} />
                <span style={{color:'white',fontSize:'12px',fontWeight:'600'}}>REC</span>
              </div>
            )}
            <button onClick={() => setShowSettings(s => !s)} style={{width:'44px',height:'44px',borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.3)',color:'white',fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>⚙️</button>
          </div>
        )}
        {cameraActive && showSettings && (
          <div style={{position:'absolute',top:'100px',right:'16px',zIndex:8,background:'rgba(0,0,0,0.85)',borderRadius:'16px',padding:'16px',width:'200px',border:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                <span style={{color:'#888',fontSize:'11px',textTransform:'uppercase'}}>Speed</span>
                <span style={{color:'#3b82f6',fontSize:'11px'}}>{speed}</span>
              </div>
              <input type="range" min="1" max="10" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{width:'100%',accentColor:'#3b82f6'}} />
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                <span style={{color:'#888',fontSize:'11px',textTransform:'uppercase'}}>Font</span>
                <span style={{color:'#3b82f6',fontSize:'11px'}}>{fontSize}px</span>
              </div>
              <input type="range" min="16" max="56" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{width:'100%',accentColor:'#3b82f6'}} />
            </div>
          </div>
        )}
        {cameraActive && (
          <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:5,padding:'16px 32px 48px',display:'flex',alignItems:'center',justifyContent:'space-around',background:'linear-gradient(to top,rgba(0,0,0,0.7),transparent)'}}>
            <button onClick={resetScroll} style={{width:'52px',height:'52px',borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.3)',color:'white',fontSize:'20px',cursor:'pointer'}}>↺</button>
            {!isRecording ? (
              <button onClick={startRecording} style={{width:'72px',height:'72px',borderRadius:'50%',background:'#ef4444',border:'4px solid white',cursor:'pointer'}} />
            ) : (
              <button onClick={stopRecording} style={{width:'72px',height:'72px',borderRadius:'50%',background:'#ef4444',border:'4px solid white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:'24px',height:'24px',background:'white',borderRadius:'4px'}} />
              </button>
            )}
            <button onClick={() => setIsPlaying(p => !p)} style={{width:'52px',height:'52px',borderRadius:'50%',background:isPlaying?'rgba(59,130,246,0.8)':'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.3)',color:'white',fontSize:'20px',cursor:'pointer'}}>
              {isPlaying ? '\u23f8' : '\u25b6'}
            </button>
          </div>
        )}
        {!cameraActive && (
          <div style={{position:'absolute',inset:0,zIndex:5,background:'#050505',display:'flex',flexDirection:'column'}}>
            <div style={{background:'#111',borderBottom:'1px solid #222',padding:'12px 16px',display:'flex',alignItems:'center',gap:'16px'}}>
              <Link href="/dashboard" style={{color:'#666',fontSize:'14px',textDecoration:'none'}}>← Back</Link>
              <span style={{color:'white',fontSize:'14px',fontWeight:'500'}}>Flow Teleprompter™</span>
            </div>
            <div style={{flex:1,padding:'24px',display:'flex',flexDirection:'column',gap:'20px',overflowY:'auto'}}>
              <div>
                <label style={{color:'#888',fontSize:'11px',textTransform:'uppercase',letterSpacing:'2px',display:'block',marginBottom:'8px'}}>Your Script</label>
                <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Paste your script here..." rows={8} style={{width:'100%',background:'#1a1a1a',border:'1px solid #333',borderRadius:'12px',padding:'12px',color:'white',fontSize:'14px',resize:'none',boxSizing:'border-box',lineHeight:1.6}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                    <label style={{color:'#888',fontSize:'11px',textTransform:'uppercase'}}>Speed</label>
                    <span style={{color:'#3b82f6',fontSize:'11px'}}>{speed}</span>
                  </div>
                  <input type="range" min="1" max="10" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{width:'100%',accentColor:'#3b82f6'}} />
                </div>
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                    <label style={{color:'#888',fontSize:'11px',textTransform:'uppercase'}}>Font</label>
                    <span style={{color:'#3b82f6',fontSize:'11px'}}>{fontSize}px</span>
                  </div>
                  <input type="range" min="16" max="56" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{width:'100%',accentColor:'#3b82f6'}} />
                </div>
              </div>
              <button onClick={startCamera} style={{width:'100%',padding:'18px',borderRadius:'16px',background:'#3b82f6',border:'none',color:'white',fontSize:'16px',fontWeight:'600',cursor:'pointer',marginTop:'auto'}}>
                Start Camera and Record
              </button>
              <p style={{color:'#555',fontSize:'12px',textAlign:'center'}}>Camera fills your screen. Script overlays on top.</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
