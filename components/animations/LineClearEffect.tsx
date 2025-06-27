"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"

interface LineClearEffectProps {
  clearedLines: number[]
  boardWidth: number
  cellSize: number
  onComplete: () => void
}

export function LineClearEffect({ clearedLines, boardWidth, cellSize, onComplete }: LineClearEffectProps) {
  const [showEffect, setShowEffect] = useState(true)

  useEffect(() => {
    if (clearedLines.length > 0) {
      const timer = setTimeout(() => {
        setShowEffect(false)
        onComplete()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [clearedLines, onComplete])

  if (clearedLines.length === 0) return null

  return (
    <AnimatePresence>
      {showEffect && (
        <div className="absolute inset-0 pointer-events-none">
          {clearedLines.map((lineIndex, i) => (
            <motion.div
              key={lineIndex}
              className="absolute"
              style={{
                top: lineIndex * cellSize,
                left: 0,
                width: boardWidth * cellSize,
                height: cellSize,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* 光るエフェクト */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent"
                initial={{ x: -boardWidth * cellSize }}
                animate={{ x: boardWidth * cellSize }}
                transition={{
                  duration: 0.3,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
                style={{ opacity: 0.8 }}
              />

              {/* 色付きオーバーレイ */}
              <motion.div
                className={`absolute inset-0 ${
                  clearedLines.length === 4
                    ? "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
                    : "bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500"
                }`}
                initial={{ opacity: 0, scaleY: 1 }}
                animate={{
                  opacity: [0, 0.8, 0.8, 0],
                  scaleY: [1, 1.2, 1.2, 0.8],
                }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.05,
                  times: [0, 0.2, 0.8, 1],
                }}
              />

              {/* パーティクル効果 */}
              {Array.from({ length: 8 }).map((_, particleIndex) => (
                <motion.div
                  key={particleIndex}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    left: (particleIndex * boardWidth * cellSize) / 8,
                    top: cellSize / 2,
                  }}
                  initial={{ opacity: 1, scale: 1, y: 0 }}
                  animate={{
                    opacity: 0,
                    scale: 0,
                    y: Math.random() > 0.5 ? -50 : 50,
                    x: (Math.random() - 0.5) * 100,
                  }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.1 + particleIndex * 0.05,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          ))}

          {/* テトリス時の特別エフェクト */}
          {clearedLines.length === 4 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="text-4xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
              >
                TETRIS!
              </motion.div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  )
}
