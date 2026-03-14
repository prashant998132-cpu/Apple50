'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { triggerMacro, triggerIFTTT } from '@/lib/automation/bridge'

const COMMANDS = [
  { icon: '📶', label: 'WiFi ON',     act: 'wifi_on',      payload: {} },
  { icon: '📵', label: 'WiFi OFF',    act: 'wifi_off',     payload: {} },
  { icon: '🔵', label: 'BT ON',       act: 'bluetooth_on', payload: {} },
  { icon: '⭕', label: 'BT OFF',      act: 'bluetooth_off',payload: {} },
  { icon: '🔦', label: 'Torch',       act: 'torch',        payload: { state: 'on' } },
  { icon: '🔊', label: 'Vol Up',      act: 'volume',       payload: { level: 'up' } },
  { icon: '🔇', label: 'Vol Down',    act: 'volume',       payload: { level: 'down' } },
  { icon: '📳', label: 'Vibrate',     act: 'vibrate',      payload: {} },
  { icon: '🔔', label: 'Notify',      act: 'notification', payload: { title: 'JARVIS', body: 'Test!' } },
  { icon: '💬', label: 'WhatsApp',    act: 'open_app',     payload: { app: 'whatsapp' } },
  { icon: '🗺️', label: 'Maps',        act: 'open_app',     payload: { app: 'maps' } },
  { icon: '📷', label: 'Camera',      act: 'open_app',     payload: { app: 'camera' } },
]

export default function PhoneControlPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'macrodroid'|'ifttt'>('macrodroid')
  const [ip, setIp] = useState('')
  const [port, setPort] = useState('8022')
  const [iftttKey, setIftttKey] = useState('')
  const [testing, setTesting] = useState('')
  const [log, setLog] = useState<{msg:string;ok:boolean}[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIp(localStorage.getItem('jarvis_device_ip') || '')
    setPort(localStorage.getItem('jarvis_md_port') || '8022')
    setIftttKey(localStorage.getItem('jarvis_ifttt_key') || '')
  }, [])

  const save = () => {
    if (typeof window === 'undefined') return
    localStorage.setItem('jarvis_device_ip', ip)
    localStorage.setItem('jarvis_md_port', port)
    localStorage.setItem('jarvis_ifttt_key', iftttKey)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const addLog = (msg: string, ok: boolean) => setLog(p => [{msg, ok}, ...p].slice(0, 10))

  const testCmd = async (cmd: typeof COMMANDS[0]) => {
    setTesting(cmd.act)
    try {
      const res = await triggerMacro({ type: cmd.act as any, payload: cmd.payload })
      addLog(cmd.label + ': ' + res.msg, res.ok)
    } catch (e: any) {
      addLog(cmd.label + ': error', false)
    }
    setTesting('')
  }

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>⚡ Phone Control</div>
          <div style={{ color: '#555', fontSize: 11 }}>MacroDroid • IFTTT • Browser</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[{k:'macrodroid',l:'📱 MacroDroid'},{k:'ifttt',l:'⚡ IFTTT'}].map(m => (
            <button key={m.k} onClick={() => setMode(m.k as any)}
              style={{ flex:1, background: mode===m.k ? 'rgba(0,212,255,0.12)' : '#111118', border: `1px solid ${mode===m.k?'#00d4ff':'#1e1e2e'}`, borderRadius:10, padding:10, cursor:'pointer', color: mode===m.k?'#00d4ff':'#666', fontSize:13, fontWeight:600 }}>
              {m.l}
            </button>
          ))}
        </div>

        {/* MacroDroid config */}
        {mode === 'macrodroid' && (
          <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ color: '#00d4ff', fontWeight: 600, marginBottom: 8 }}>Setup — 5 min</div>
            <div style={{ background: '#111', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: '#888', lineHeight: 2.2 }}>
              <b style={{color:'#fff'}}>1.</b> Play Store → <b style={{color:'#00d4ff'}}>MacroDroid</b> install<br/>
              <b style={{color:'#fff'}}>2.</b> Templates tab → <b style={{color:'#00d4ff'}}>"HTTP Server"</b> search → import<br/>
              <b style={{color:'#fff'}}>3.</b> Permissions allow karo<br/>
              <b style={{color:'#fff'}}>4.</b> Phone IP daalo neeche (Settings → WiFi → (i) pe milega)
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input value={ip} onChange={e=>setIp(e.target.value)} placeholder="192.168.1.x"
                style={{ flex:2, background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'9px 12px', color:'#e0e0ff', fontSize:13, outline:'none' }} />
              <input value={port} onChange={e=>setPort(e.target.value)} placeholder="8022"
                style={{ flex:1, background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'9px 12px', color:'#e0e0ff', fontSize:13, outline:'none' }} />
            </div>
            <button onClick={save} style={{ width:'100%', background: saved?'#22c55e':'#00d4ff', border:'none', borderRadius:8, color:'#000', padding:10, cursor:'pointer', fontWeight:700 }}>
              {saved ? '✅ Saved!' : 'Save IP'}
            </button>
          </div>
        )}

        {/* IFTTT config */}
        {mode === 'ifttt' && (
          <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ color: '#00d4ff', fontWeight: 600, marginBottom: 8 }}>Setup — 5 min</div>
            <div style={{ background: '#111', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: '#888', lineHeight: 2.2 }}>
              <b style={{color:'#fff'}}>1.</b> <b style={{color:'#00d4ff'}}>ifttt.com</b> → free account<br/>
              <b style={{color:'#fff'}}>2.</b> Search: <b style={{color:'#00d4ff'}}>Webhooks</b> → Connect<br/>
              <b style={{color:'#fff'}}>3.</b> Documentation → key copy karo<br/>
              <b style={{color:'#fff'}}>4.</b> Neeche paste karo
            </div>
            <input value={iftttKey} onChange={e=>setIftttKey(e.target.value)} placeholder="IFTTT webhook key..." type="password"
              style={{ width:'100%', background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'9px 12px', color:'#e0e0ff', fontSize:13, outline:'none', marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={save} style={{ flex:1, background: saved?'#22c55e':'#00d4ff', border:'none', borderRadius:8, color:'#000', padding:10, cursor:'pointer', fontWeight:700 }}>
                {saved?'✅ Saved!':'Save Key'}
              </button>
              <a href="https://ifttt.com/maker_webhooks" target="_blank" rel="noopener noreferrer"
                style={{ flex:1, textAlign:'center', background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, color:'#888', padding:10, fontSize:12, textDecoration:'none', display:'block' }}>
                🔗 ifttt.com
              </a>
            </div>
          </div>
        )}

        {/* Command buttons */}
        <div style={{ color:'#555', fontSize:11, marginBottom:8, fontWeight:600 }}>COMMANDS — TAP TO TEST</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
          {COMMANDS.map(cmd => (
            <button key={cmd.act} onClick={() => testCmd(cmd)} disabled={testing===cmd.act}
              style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:12, padding:'12px 6px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <span style={{ fontSize: testing===cmd.act ? 18 : 22 }}>{testing===cmd.act ? '⏳' : cmd.icon}</span>
              <span style={{ color:'#666', fontSize:10, textAlign:'center' }}>{cmd.label}</span>
            </button>
          ))}
        </div>

        {/* Zero setup section */}
        <div style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:12, padding:12, marginBottom:14 }}>
          <div style={{ color:'#22c55e', fontWeight:600, fontSize:12, marginBottom:8 }}>✅ Zero Setup — Abhi Kaam Karta Hai</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {[
              {l:'📳 Vibrate', fn:()=>navigator.vibrate?.([300,100,300])},
              {l:'🔔 Notify',  fn:async()=>{ const p=await Notification.requestPermission(); if(p==='granted') new Notification('JARVIS ✅',{body:'Kaam kar raha hun!'}) }},
              {l:'💬 WhatsApp',fn:()=>{window.location.href='whatsapp://'}},
              {l:'📞 Call',    fn:()=>{window.location.href='tel:'}},
              {l:'🗺️ Maps',    fn:()=>{window.location.href='geo:0,0'}},
            ].map(b => (
              <button key={b.l} onClick={b.fn}
                style={{ background:'#111', border:'1px solid #22c55e33', borderRadius:8, color:'#22c55e', padding:'8px 12px', cursor:'pointer', fontSize:12 }}>
                {b.l}
              </button>
            ))}
          </div>
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div>
            <div style={{ color:'#555', fontSize:11, marginBottom:6 }}>RESULTS</div>
            {log.map((l,i) => (
              <div key={i} style={{ color: l.ok ? '#22c55e' : '#ef4444', fontSize:12, padding:'3px 0' }}>
                {l.ok ? '✅' : '❌'} {l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
