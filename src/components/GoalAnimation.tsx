// src/components/GoalAnimation.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'

interface GoalAnimationProps {
  scoringTeam: string
  teamColor?: string
  homeScore: number
  awayScore: number
  onComplete: () => void
}

export default function GoalAnimation({
  scoringTeam,
  teamColor,
  homeScore,
  awayScore,
  onComplete,
}: GoalAnimationProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [showScoreFlip, setShowScoreFlip] = useState(false)

  // Callers pass inline arrows, and the parent re-renders on every odds tick.
  // Keeping onComplete in a ref stops those renders from re-running the effect
  // below — which would tear down and restart the whole animation (and its
  // 2500ms completion timer) forever on a live match.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let animationFrameId: number | null = null
    let disposed = false
    let cleanedUp = false

    const handleResize = () => {
      if (!renderer || !camera) return
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    // Disposes the full Three.js scene (geometries, materials, renderer, DOM
    // node, listeners). Called before onComplete() so nothing outlives the
    // 2500ms window, and again on early unmount as a safety net.
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      disposed = true
      window.removeEventListener('resize', handleResize)
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
      document.body.classList.remove('screen-shake')

      if (renderer) {
        try {
          if (renderer.domElement && mountRef.current) {
            mountRef.current.removeChild(renderer.domElement)
          }
          renderer.dispose()
        } catch {
          // Silent catch — DOM node may already be gone
        }
      }

      if (scene) {
        scene.traverse((obj) => {
          const mesh = obj as Partial<THREE.Mesh>
          mesh.geometry?.dispose()
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose())
            } else {
              mesh.material.dispose()
            }
          }
        })
      }
    }

    // Dynamic import Three.js only when the goal animation is mounted
    import('three').then((THREE) => {
      if (disposed || !mountRef.current) return

      const width = window.innerWidth
      const height = window.innerHeight

      const localScene = new THREE.Scene()
      scene = localScene

      const localCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
      localCamera.position.z = 8
      camera = localCamera

      const localRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      localRenderer.setSize(width, height)
      localRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mountRef.current.appendChild(localRenderer.domElement)
      renderer = localRenderer

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
      localScene.add(ambientLight)

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
      dirLight.position.set(5, 5, 5)
      localScene.add(dirLight)

      // Create Football 3D Mesh
      const ballGeometry = new THREE.SphereGeometry(1.5, 32, 32)
      const ballMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.1,
      })
      const ball = new THREE.Mesh(ballGeometry, ballMaterial)
      localScene.add(ball)

      // Start position off-screen left and bottom
      ball.position.set(-8, -4, -2)

      // Particle Exploded System (Scoring Team Colors)
      const particleCount = 100
      const particleGeometry = new THREE.BufferGeometry()
      const positions = new Float32Array(particleCount * 3)
      const velocities: number[] = []

      const activeColor = new THREE.Color(teamColor || '#f5c518')

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0
        positions[i * 3 + 1] = 1
        positions[i * 3 + 2] = 0

        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 2 - 1)
        const speed = 3 + Math.random() * 7

        velocities.push(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        )
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const particleMaterial = new THREE.PointsMaterial({
        color: activeColor,
        size: 0.18,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      })

      const particles = new THREE.Points(particleGeometry, particleMaterial)
      particles.visible = false
      localScene.add(particles)

      const clock = new THREE.Clock()
      let impactTriggered = false

      const animate = () => {
        if (disposed) return
        animationFrameId = requestAnimationFrame(animate)

        const elapsedTime = clock.getElapsedTime()

        if (elapsedTime < 1.0) {
          const t = elapsedTime / 1.0
          ball.position.x = -8 + t * 8
          ball.position.y = -4 + t * 6 - 2 * t * t
          ball.rotation.x += 0.1
          ball.rotation.y += 0.05
        } else if (!impactTriggered) {
          impactTriggered = true
          ball.visible = false
          particles.visible = true

          document.body.classList.add('screen-shake')
          setTimeout(() => {
            document.body.classList.remove('screen-shake')
          }, 300)

          setShowScoreFlip(true)
        }

        if (impactTriggered) {
          const posArr = particleGeometry.attributes.position.array as Float32Array
          for (let i = 0; i < particleCount; i++) {
            posArr[i * 3] += velocities[i * 3] * 0.016
            posArr[i * 3 + 1] += velocities[i * 3 + 1] * 0.016
            posArr[i * 3 + 2] += velocities[i * 3 + 2] * 0.016

            velocities[i * 3 + 1] -= 0.12
          }
          particleGeometry.attributes.position.needsUpdate = true
          particleMaterial.opacity -= 0.012
        }

        localRenderer.render(localScene, localCamera)
      }

      animate()
    })

    window.addEventListener('resize', handleResize)

    // Wait exactly 2500ms, dispose the scene, then hand control back —
    // onComplete() fires only after cleanup so the goal card underneath
    // never shares a frame with a live Three.js canvas.
    const finishTimer = setTimeout(() => {
      cleanup()
      onCompleteRef.current()
    }, 2500)

    return () => {
      clearTimeout(finishTimer)
      cleanup()
    }
  }, [teamColor])

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none select-none bg-black/60 flex items-center justify-center">
      {/* Dynamic backdrop color burst based on team color */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out opacity-25"
        style={{ backgroundColor: teamColor || '#f5c518' }}
      />

      {/* 3D rendering canvas holder */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Typography Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4">
        <h1 className="text-7xl md:text-9xl font-black font-display tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-500 uppercase animate-pulse select-none filter drop-shadow-[0_5px_15px_rgba(245,197,24,0.4)]">
          GOAL!!!
        </h1>
        <p className="text-lg md:text-2xl font-bold font-display uppercase tracking-widest text-gray-300 mt-3">
          {scoringTeam} scores!
        </p>

        {showScoreFlip && (
          <div className="mt-12 flex gap-6 items-center justify-center select-none" style={{ perspective: '600px' }}>
            <div className="relative w-24 h-32 md:w-28 md:h-36 bg-zinc-950 border border-white/10 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] shadow-[#f5c518]/10 animate-flip">
              <span className="text-6xl md:text-7xl font-black font-mono text-[#f5c518]">{homeScore}</span>
              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/80" />
            </div>

            <span className="text-4xl font-black font-mono text-zinc-600">-</span>

            <div className="relative w-24 h-32 md:w-28 md:h-36 bg-zinc-950 border border-white/10 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] shadow-[#f5c518]/10 animate-flip">
              <span className="text-6xl md:text-7xl font-black font-mono text-[#f5c518]">{awayScore}</span>
              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/80" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
