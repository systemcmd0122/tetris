"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"

interface ScoreAnimationProps {
  score: number
  previousScore: number
  position?: { x: number; y: number }
}

export function ScoreAnimation({ score, previousScore, position }: ScoreAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(false)
  const [scoreIncrease, setScoreIncrease] = useState(0)

  useEffect(() => {
    if (score > previousScore) {
      const increase = score - previousScore
      setScoreIncrease(increase)
      setShowAnimation(true)

      const timer = setTimeout(() => {
        setShowAnimation(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [score, previousScore])

  return (
    <AnimatePresence>
      {showAnimation && scoreIncrease > 0 && (
        <motion.div
          className="absolute pointer-events-none z-50"
          style={{
            left: position?.x || "50%",
            top: position?.y || "50%",
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: -100,
            scale: [0.5, 1.2, 1, 0.8],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 2,
            times: [0, 0.1, 0.8, 1],
            ease: "easeOut",
          }}
        >
          <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">+{scoreIncrease.toLocaleString()}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
