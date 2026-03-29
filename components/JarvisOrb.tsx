'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface JarvisOrbProps {
  state?: OrbState
  size?: number
  onTap?: () => void
  audioLevel?: number // 0-1
}

export default function JarvisOrb({ state = 'idle', size = 220, onTap, audioLevel = 0 }: JarvisOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)
  const touchRef = useRef<{x:number,y:number,pressure:number,ripples:{x:number,y:number,r:number,alpha:number}[]}>(
    {x:0,y:0,pressure:0,ripples:[]}
  )
  const stateRef = useRef(state)
  const audioRef = useRef(audioLevel)
  const [pressed, setPressed] = useState(false)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { audioRef.current = audioLevel }, [audioLevel])

  // Perlin-like noise
  const noise = useCallback((x: number, y: number, t: number) => {
    return Math.sin(x * 2.1 + t) * Math.cos(y * 1.7 + t * 0.7) * 0.5 +
           Math.sin(x * 3.9 + t * 1.3) * Math.sin(y * 2.8 + t) * 0.3 +
           Math.cos(x * 1.1 + y * 0.9 + t * 0.5) * 0.2
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = size * window.devicePixelRatio
    const H = size * window.devicePixelRatio
    canvas.width = W
    canvas.height = H
    const cx = W / 2
    const cy = H / 2
    const r = W * 0.35

    // Particle system
    const particles: {x:number,y:number,vx:number,vy:number,life:number,size:number}[] = []
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = r * (0.7 + Math.random() * 0.6)
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        life: Math.random(),
        size: Math.random() * 2 + 0.5
      })
    }

    const draw = (ts: number) => {
      timeRef.current = ts * 0.001
      const t = timeRef.current
      const s = stateRef.current
      const audio = audioRef.current
      const touch = touchRef.current

      ctx.clearRect(0, 0, W, H)

      // State-based params
      const breathScale = s === 'idle'
        ? 1 + Math.sin(t * 0.8) * 0.02
        : s === 'listening'
        ? 1 + Math.sin(t * 2.5) * 0.04
        : s === 'thinking'
        ? 1 + Math.sin(t * 1.2) * 0.03
        : 1 + audio * 0.12 + Math.sin(t * 4) * 0.02

      const glowIntensity = s === 'idle' ? 0.4
        : s === 'listening' ? 0.7
        : s === 'thinking' ? 0.5
        : 0.85 + audio * 0.15

      // ── BACKGROUND GLOW ──────────────────────────────────
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2)
      bgGlow.addColorStop(0, `rgba(0,100,200,${glowIntensity * 0.15})`)
      bgGlow.addColorStop(0.5, `rgba(0,50,120,${glowIntensity * 0.08})`)
      bgGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, W, H)

      // ── BLOB SHAPE ───────────────────────────────────────
      const segments = 120
      const points: [number, number][] = []

      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        const noiseVal = noise(Math.cos(angle), Math.sin(angle), t * (s === 'speaking' ? 2 : 0.5))
        const audioDistort = s === 'speaking' ? audio * r * 0.15 * Math.abs(Math.sin(angle * 3 + t * 5)) : 0
        const dist = r * breathScale * (1 + noiseVal * 0.08 + audioDistort / r)

        points.push([
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist
        ])
      }

      // Draw multi-layer glow
      for (let layer = 4; layer >= 0; layer--) {
        const expand = layer * 6 * glowIntensity
        const alpha = (0.06 - layer * 0.01) * glowIntensity

        ctx.beginPath()
        ctx.moveTo(points[0][0], points[0][1])
        for (let i = 1; i < points.length; i++) {
          const p = points[i], pp = points[i - 1]
          ctx.quadraticCurveTo(pp[0], pp[1], (pp[0] + p[0]) / 2, (pp[1] + p[1]) / 2)
        }
        ctx.closePath()

        // Expand slightly
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1 + expand / r, 1 + expand / r)
        ctx.translate(-cx, -cy)

        const gc = s === 'thinking'
          ? `rgba(120,80,255,${alpha})`
          : s === 'listening'
          ? `rgba(0,200,100,${alpha})`
          : `rgba(0,150,255,${alpha})`
        ctx.fillStyle = gc
        ctx.fill()
        ctx.restore()
      }

      // ── CORE GRADIENT ────────────────────────────────────
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) {
        const p = points[i], pp = points[i - 1]
        ctx.quadraticCurveTo(pp[0], pp[1], (pp[0] + p[0]) / 2, (pp[1] + p[1]) / 2)
      }
      ctx.closePath()

      // Dynamic gradient based on state
      const angle = t * (s === 'thinking' ? 0.3 : 0.1)
      const gx1 = cx + Math.cos(angle) * r * 0.5
      const gy1 = cy + Math.sin(angle) * r * 0.5
      const coreGrad = ctx.createRadialGradient(gx1, gy1, 0, cx, cy, r * 1.1)

      if (s === 'idle') {
        coreGrad.addColorStop(0, 'rgba(80,180,255,0.95)')
        coreGrad.addColorStop(0.4, 'rgba(20,80,200,0.9)')
        coreGrad.addColorStop(0.8, 'rgba(10,30,120,0.95)')
        coreGrad.addColorStop(1, 'rgba(5,15,80,1)')
      } else if (s === 'listening') {
        coreGrad.addColorStop(0, 'rgba(100,255,150,0.95)')
        coreGrad.addColorStop(0.4, 'rgba(20,180,80,0.9)')
        coreGrad.addColorStop(0.8, 'rgba(10,80,40,0.95)')
        coreGrad.addColorStop(1, 'rgba(5,40,20,1)')
      } else if (s === 'thinking') {
        coreGrad.addColorStop(0, 'rgba(180,120,255,0.95)')
        coreGrad.addColorStop(0.4, 'rgba(120,40,220,0.9)')
        coreGrad.addColorStop(0.8, 'rgba(60,10,140,0.95)')
        coreGrad.addColorStop(1, 'rgba(30,5,80,1)')
      } else { // speaking
        const pulse = 0.7 + audio * 0.3
        coreGrad.addColorStop(0, `rgba(${Math.round(80+audio*100)},200,255,0.95)`)
        coreGrad.addColorStop(0.4, `rgba(20,${Math.round(100+audio*100)},220,${pulse})`)
        coreGrad.addColorStop(0.8, 'rgba(10,40,150,0.95)')
        coreGrad.addColorStop(1, 'rgba(5,15,80,1)')
      }

      ctx.fillStyle = coreGrad
      ctx.fill()

      // ── INNER SHINE ──────────────────────────────────────
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) {
        const p = points[i], pp = points[i - 1]
        ctx.quadraticCurveTo(pp[0], pp[1], (pp[0] + p[0]) / 2, (pp[1] + p[1]) / 2)
      }
      ctx.closePath()
      const shine = ctx.createRadialGradient(cx - r*0.2, cy - r*0.3, 0, cx, cy, r)
      shine.addColorStop(0, 'rgba(255,255,255,0.25)')
      shine.addColorStop(0.4, 'rgba(255,255,255,0.08)')
      shine.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = shine
      ctx.fill()

      // ── MESH DISTORTION LINES (thinking) ────────────────
      if (s === 'thinking') {
        ctx.save()
        ctx.globalAlpha = 0.15
        for (let line = 0; line < 6; line++) {
          const lineAngle = line * Math.PI / 3 + t * 0.2
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(180,120,255,0.6)'
          ctx.lineWidth = 0.5
          for (let pt = 0; pt <= 20; pt++) {
            const frac = pt / 20
            const x = cx + Math.cos(lineAngle) * r * frac + noise(frac, line, t) * 15
            const y = cy + Math.sin(lineAngle) * r * frac + noise(frac + 0.5, line, t) * 15
            if (pt === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        ctx.restore()
      }

      // ── PARTICLES ────────────────────────────────────────
      const particleActive = s !== 'idle'
      particles.forEach(p => {
        // Update
        const dx = p.x - cx, dy = p.y - cy
        const dist = Math.sqrt(dx*dx + dy*dy)
        const targetDist = r * (s === 'speaking' ? 1.1 + audioRef.current * 0.3 : 1.05)
        const force = (targetDist - dist) * 0.003
        p.vx += (dx / dist) * force + (Math.random() - 0.5) * 0.2
        p.vy += (dy / dist) * force + (Math.random() - 0.5) * 0.2
        p.vx *= 0.96; p.vy *= 0.96
        p.x += p.vx; p.y += p.vy
        p.life += 0.008
        if (p.life > 1) p.life = 0

        if (!particleActive && Math.random() > 0.3) return

        const alpha = Math.sin(p.life * Math.PI) * (s === 'speaking' ? 0.9 : 0.5)
        const pColor = s === 'listening' ? `rgba(100,255,150,${alpha})`
          : s === 'thinking' ? `rgba(180,120,255,${alpha})`
          : `rgba(100,200,255,${alpha})`

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (s === 'speaking' ? 1 + audioRef.current : 1), 0, Math.PI * 2)
        ctx.fillStyle = pColor
        ctx.fill()
      })

      // ── RIPPLES (touch) ──────────────────────────────────
      touch.ripples = touch.ripples.filter(rp => rp.alpha > 0.01)
      touch.ripples.forEach(rp => {
        rp.r += 4
        rp.alpha *= 0.92
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,200,255,${rp.alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      })

      // ── CENTER PULSE (speaking) ──────────────────────────
      if (s === 'speaking' && audio > 0.1) {
        const pulseR = audio * r * 0.6
        const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR)
        pulseGrad.addColorStop(0, `rgba(150,230,255,${audio * 0.6})`)
        pulseGrad.addColorStop(1, 'rgba(150,230,255,0)')
        ctx.beginPath()
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
        ctx.fillStyle = pulseGrad
        ctx.fill()
      }

      // ── WAVEFORM RING (speaking/listening) ───────────────
      if (s === 'speaking' || s === 'listening') {
        ctx.beginPath()
        for (let i = 0; i <= segments; i++) {
          const ang = (i / segments) * Math.PI * 2
          const wave = s === 'speaking'
            ? audio * r * 0.12 * Math.sin(ang * 8 + t * 8)
            : r * 0.04 * Math.sin(ang * 6 + t * 3)
          const wR = r * 1.08 + wave
          const x = cx + Math.cos(ang) * wR
          const y = cy + Math.sin(ang) * wR
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = s === 'listening' ? 'rgba(100,255,150,0.4)' : `rgba(0,200,255,${0.2 + audio * 0.5})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [size, noise])

  const handleTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio
    let x: number, y: number
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * dpr
      y = (e.touches[0].clientY - rect.top) * dpr
    } else {
      x = (e.clientX - rect.left) * dpr
      y = (e.clientY - rect.top) * dpr
    }
    touchRef.current.ripples.push({x, y, r: 5, alpha: 0.8})
    if (typeof navigator !== 'undefined') navigator.vibrate?.(30)
    onTap?.()
  }, [onTap])

  const stateColors = {
    idle: '#00d4ff',
    listening: '#22c55e',
    thinking: '#a855f7',
    speaking: '#38bdf8',
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, cursor: 'pointer' }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={(e) => { setPressed(true); handleTouch(e) }}
      onTouchEnd={() => setPressed(false)}
      onClick={handleTouch}>
      <canvas
        ref={canvasRef}
        style={{
          width: size, height: size,
          transform: pressed ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'block',
        }}
      />
      {/* State label */}
      <div style={{
        position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
        color: stateColors[state], fontSize: 11, fontWeight: 600, letterSpacing: 2,
        textTransform: 'uppercase', opacity: 0.8,
      }}>
        {state}
      </div>
    </div>
  )
}
