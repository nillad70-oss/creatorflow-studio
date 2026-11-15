import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '../lib/supabase/client'
import { authFetch } from '../lib/authFetch'
import { CONSENT_VERSION, CONSENT_SCOPE_LABELS, CONSENT_POINTS, CONSENT_STATEMENT } from '../lib/twinConsent'

const AVAILABLE_SCOPES = ['professional', 'fashion_lifestyle'] // video/voice arrive in later phases
const BUCKET = 'twin-references'

function pickRecordingType() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of ['video/webm;codecs=vp9', 'video/webm', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t
  }
  return null
}

export default function AiTwinPage() {
  const [state, setState] = useState({ loading: true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // consent step
  const [scopes, setScopes] = useState(['professional'])
  const [attestSelf, setAttestSelf] = useState(false)
  const [attestAdult, setAttestAdult] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const videoRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)

  // photo step
  const [uploadNotes, setUploadNotes] = useState([])

  const load = useCallback(async () => {
    setError('')
    const res = await authFetch('/api/twin')
    if (res.status === 404) return setState({ loading: false, unavailable: true })
    if (res.status === 401) return setState({ loading: false, signedOut: true })
    const data = await res.json()
    setState({ loading: false, ...data })
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  async function startRecording() {
    setError('')
    const type = pickRecordingType()
    if (!type) return setError('Your browser cannot record video here. Please try Chrome, Edge or Safari.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; await videoRef.current.play() }
      const chunks = []
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000 })
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunks, { type: type.split(';')[0] }))
        stream.getTracks().forEach((t) => t.stop())
        if (videoRef.current) videoRef.current.srcObject = null
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordedBlob(null)
    } catch {
      setError('Camera or microphone access was blocked. Please allow access and try again.')
    }
  }

  function stopRecording() {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop()
    setRecording(false)
  }

  async function submitConsent() {
    if (!attestSelf || !attestAdult || !scopes.length || !recordedBlob) return
    setBusy(true); setError('')
    try {
      const res = await authFetch('/api/twin/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopes, attest_self: true, attest_adult: true,
          consent_version: CONSENT_VERSION, recording_mime_type: recordedBlob.type,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save consent.')

      const { path, token } = data.recording_upload
      const { error: upErr } = await createClient().storage.from(BUCKET).uploadToSignedUrl(path, token, recordedBlob, { contentType: recordedBlob.type })
      if (upErr) throw new Error('The recording upload failed. Please try again.')

      const fin = await authFetch('/api/twin/recording', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
      })
      const finData = await fin.json()
      if (!fin.ok) throw new Error(finData.error || 'Could not save the recording.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadPhotos(files) {
    setBusy(true); setError(''); setUploadNotes([])
    const notes = []
    for (const file of Array.from(files)) {
      try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPEG, PNG or WebP.')
        if (file.size > 10 * 1024 * 1024) throw new Error('Photo is over 10 MB.')
        const u = await authFetch('/api/twin/reference', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload-url', mime_type: file.type }),
        })
        const ud = await u.json()
        if (!u.ok) throw new Error(ud.error)
        const { error: upErr } = await createClient().storage.from(BUCKET).uploadToSignedUrl(ud.path, ud.token, file, { contentType: file.type })
        if (upErr) throw new Error('Upload failed.')
        const f = await authFetch('/api/twin/reference', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'finalize', path: ud.path }),
        })
        const fd = await f.json()
        if (!f.ok) throw new Error(fd.error)
        notes.push(fd.accepted ? { name: file.name, ok: true } : { name: file.name, ok: false, why: fd.reasons.join(' ') })
      } catch (e) {
        notes.push({ name: file.name, ok: false, why: e.message })
      }
      setUploadNotes([...notes])
    }
    await load()
    setBusy(false)
  }

  async function deletePhoto(id) {
    setBusy(true)
    await authFetch('/api/twin/reference', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
    setBusy(false)
  }

  async function deleteTwin() {
    if (!window.confirm('Permanently delete your AI Twin? This removes your photos, your consent recording and anything created from them. This cannot be undone.')) return
    setBusy(true); setError('')
    const res = await authFetch('/api/twin', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Deletion did not complete.')
    else setUploadNotes([{ name: 'Deleted', ok: true, why: `Receipt ${data.receipt?.id || ''}` }])
    await load()
    setBusy(false)
  }

  const twin = state.twin
  const consented = state.consent?.recording_on_file
  const photoCount = state.photos?.length || 0

  return (
    <>
      <Head><title>AI Twin — NillaFlow Studio™</title></Head>
      <div className="min-h-screen bg-void px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="text-tertiary text-sm hover:text-secondary">← Dashboard</Link>
          <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl text-primary font-light mt-4 mb-2">AI Twin™</h1>
          <p className="text-secondary text-sm mb-8">Create consistent, professional AI images of yourself, from your own approved photos.</p>

          {error && <div className="glass rounded-xl px-5 py-4 mb-6 border border-red-500/30 text-sm text-red-300">{error}</div>}

          {state.loading && <p className="text-tertiary text-sm">Loading…</p>}
          {state.unavailable && <div className="glass rounded-2xl p-8 text-center"><p className="text-primary">AI Twin is coming soon.</p></div>}
          {state.signedOut && <p className="text-secondary text-sm">Please <Link href="/login" className="text-electric-glow">sign in</Link>.</p>}

          {!state.loading && !state.unavailable && !state.signedOut && (
            <>
              <div className="glass rounded-2xl px-6 py-4 mb-6 flex items-center justify-between text-sm">
                <span className="text-secondary">Status: <span className="text-primary">{twin ? twin.status : 'not started'}</span></span>
                <span className="text-secondary">Credits: <span className="text-primary">{state.credits ?? 0}</span></span>
              </div>

              {!consented && (
                <section className="glass rounded-2xl p-6 mb-6">
                  <h2 className="text-primary text-lg font-medium mb-1">Step 1 · Consent</h2>
                  <p className="text-tertiary text-xs mb-4">Consent version {CONSENT_VERSION}</p>
                  <ul className="space-y-2 mb-5 list-disc pl-5">
                    {CONSENT_POINTS.map((p) => <li key={p} className="text-secondary text-sm">{p}</li>)}
                  </ul>

                  <p className="text-primary text-sm mb-2">Allowed uses</p>
                  {AVAILABLE_SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-3 text-secondary text-sm mb-2">
                      <input type="checkbox" checked={scopes.includes(s)}
                        onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
                      {CONSENT_SCOPE_LABELS[s]}
                    </label>
                  ))}

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-3 text-secondary text-sm">
                      <input type="checkbox" checked={attestSelf} onChange={(e) => setAttestSelf(e.target.checked)} />
                      The photos and recording are of me.
                    </label>
                    <label className="flex items-center gap-3 text-secondary text-sm">
                      <input type="checkbox" checked={attestAdult} onChange={(e) => setAttestAdult(e.target.checked)} />
                      I am 18 years of age or older.
                    </label>
                  </div>

                  <div className="mt-6">
                    <p className="text-primary text-sm mb-1">Record your consent (about 10 seconds)</p>
                    <p className="text-tertiary text-xs mb-3">Look at the camera and say: “{CONSENT_STATEMENT}”</p>
                    <video ref={videoRef} playsInline className="w-full max-w-sm rounded-xl bg-black/40 mb-3" style={{ display: recording ? 'block' : 'none' }} />
                    {!recording ? (
                      <button onClick={startRecording} disabled={busy} className="btn-ghost px-5 py-2.5 rounded-xl text-sm">
                        {recordedBlob ? 'Record again' : 'Start recording'}
                      </button>
                    ) : (
                      <button onClick={stopRecording} className="btn-electric px-5 py-2.5 rounded-xl text-sm">Stop recording</button>
                    )}
                    {recordedBlob && !recording && <span className="text-success text-xs ml-3">Recording ready ✓</span>}
                  </div>

                  <button onClick={submitConsent}
                    disabled={busy || !attestSelf || !attestAdult || !scopes.length || !recordedBlob}
                    className="btn-electric w-full py-3 rounded-xl text-sm font-medium mt-6 disabled:opacity-50">
                    {busy ? 'Saving…' : 'I agree, save my consent'}
                  </button>
                </section>
              )}

              {consented && (
                <section className="glass rounded-2xl p-6 mb-6">
                  <h2 className="text-primary text-lg font-medium mb-1">Step 2 · Your photos</h2>
                  <p className="text-secondary text-sm mb-4">
                    Upload {state.min_photos}–{state.max_photos} clear photos of just you: good light, face visible, different angles and outfits.
                    {' '}{photoCount}/{state.max_photos} uploaded.
                  </p>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || photoCount >= state.max_photos}
                    onChange={(e) => e.target.files?.length && uploadPhotos(e.target.files)} className="text-secondary text-sm mb-4" />

                  {uploadNotes.length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {uploadNotes.map((n, i) => (
                        <li key={i} className={`text-xs ${n.ok ? 'text-success' : 'text-red-300'}`}>
                          {n.ok ? '✓' : '✕'} {n.name}{n.why ? `: ${n.why}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {(state.photos || []).map((p) => (
                      <div key={p.id} className="relative">
                        {p.preview_url && <img src={p.preview_url} alt="Your reference photo" className="w-full aspect-square object-cover rounded-lg" />}
                        <button onClick={() => deletePhoto(p.id)} disabled={busy}
                          className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1.5">✕</button>
                      </div>
                    ))}
                  </div>

                  {twin?.status === 'ready' && (
                    <p className="text-success text-sm mt-4">Your AI Twin is set up. Image creation arrives in the next update.</p>
                  )}
                </section>
              )}

              {twin && (
                <section className="glass rounded-2xl p-6 border border-red-500/20">
                  <h2 className="text-primary text-base font-medium mb-1">Delete my AI Twin</h2>
                  <p className="text-tertiary text-xs mb-4">Permanently removes your photos, consent recording and anything created from them. Purchased credits are kept.</p>
                  <button onClick={deleteTwin} disabled={busy} className="btn-ghost px-5 py-2.5 rounded-xl text-sm text-red-300">Delete permanently</button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
