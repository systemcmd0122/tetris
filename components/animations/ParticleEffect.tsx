"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  velocity: { x: number; y: number }
}

interface ParticleEffectProps {
  trigger: boolean
  x: number
  y: number
  color?: string
  particleCount?: number
  onComplete?: () => void
}

export function ParticleEffect({
  trigger,
  x,
  y,
  color = "bg-yellow-400",
  particleCount = 20,
  onComplete,
}: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (trigger) {
      const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: x,
        y: y,
        color,
        size: Math.random() * 4 + 2,
        velocity: {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200 - 50,
        },
      }))

      setParticles(newParticles)

      setTimeout(() => {
        setParticles([])
        onComplete?.()
      }, 1000)
    }
  }, [trigger, x, y, color, particleCount, onComplete])

  if (!particles.length) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${particle.color}`}
          style={{
            width: particle.size,
            height: particle.size,
            left: particle.x,
            top: particle.y,
          }}
          initial={{ opacity: 1, scale: 1 }}
          animate={{
            x: particle.velocity.x,
            y: particle.velocity.y,
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 1,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}
