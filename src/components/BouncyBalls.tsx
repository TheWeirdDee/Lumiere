// A few match balls bouncing along the bottom of the hero — plain canvas 2D
// (no WebGL, cannot fail or paint over the page). Gravity + damped bounces,
// gold/ivory/charcoal palette, DPR-aware, honors prefers-reduced-motion.
'use client'

import React, { useEffect, useRef } from 'react'

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  highlight: string
}

const PALETTE: Array<{ color: string; highlight: string }> = [
  { color: '#f5c518', highlight: '#ffe27a' },
  { color: '#e8e6e3', highlight: '#ffffff' },
  { color: '#2a2a30', highlight: '#4a4a52' },
]

const COUNT = 10
const GRAVITY = 1400 // px/s²
const BOUNCE = 0.72
const FRICTION = 0.995

export default function BouncyBalls({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Deterministic pseudo-random so SSR/CSR and reloads look consistent.
    let seed = 42
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }

    const balls: Ball[] = Array.from({ length: COUNT }, (_, i) => {
      const p = PALETTE[i % PALETTE.length]
      return {
        x: 0,
        y: 0,
        vx: (rand() - 0.5) * 160,
        vy: rand() * 80,
        r: 9 + rand() * 13,
        color: p.color,
        highlight: p.highlight,
      }
    })

    const layout = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    layout()
    balls.forEach((b, i) => {
      b.x = ((i + 0.5) / COUNT) * width + (rand() - 0.5) * 30
      b.y = reducedMotion ? height - b.r : rand() * height * 0.4
    })

    const observer = new ResizeObserver(layout)
    observer.observe(canvas)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const b of balls) {
        // Soft contact shadow
        const shadowScale = Math.max(0.25, 1 - (height - b.r - b.y) / (height * 0.9))
        ctx.beginPath()
        ctx.ellipse(b.x, height - 3, b.r * 0.9 * shadowScale, b.r * 0.22 * shadowScale, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fill()

        // Ball with a top-left highlight
        const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.15, b.x, b.y, b.r)
        g.addColorStop(0, b.highlight)
        g.addColorStop(0.35, b.color)
        g.addColorStop(1, 'rgba(0,0,0,0.55)')
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }
    }

    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      for (const b of balls) {
        b.vy += GRAVITY * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.vx *= FRICTION

        const floor = height - b.r
        if (b.y > floor) {
          b.y = floor
          b.vy = -Math.abs(b.vy) * BOUNCE
          // A tired ball gets a fresh nudge so the scene never fully dies.
          if (Math.abs(b.vy) < 40) b.vy = -(220 + rand() * 260)
        }
        if (b.x < b.r) {
          b.x = b.r
          b.vx = Math.abs(b.vx)
        } else if (b.x > width - b.r) {
          b.x = width - b.r
          b.vx = -Math.abs(b.vx)
        }
      }
      draw()
      raf = requestAnimationFrame(step)
    }

    if (reducedMotion) {
      draw()
    } else {
      raf = requestAnimationFrame(step)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else if (!reducedMotion) {
        last = performance.now()
        raf = requestAnimationFrame(step)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', display: 'block' }} />
}
