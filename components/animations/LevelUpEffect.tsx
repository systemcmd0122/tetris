"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { Zap } from "lucide-react"

interface LevelUpEffectProps {
  level: number
  previousLevel: number
}

export function LevelUpEffect({ level, previousLevel }: LevelUpEffectProps) {
  const [showEffect, setShowEffect] = useState(false)

  useEffect(() => {
    if (level > previousLevel) {
      setShowEffect(true)
      const timer = setTimeout(() => {
        setShowEffect(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [level, previousLevel])

  return (
    <AnimatePresence>
      {showEffect && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 背景フラッシュ */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, repeat: 2 }}
          />

          {/* メインテキスト */}
          <motion.div
            className="text-center"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 10,
              delay: 0.2,
            }}
          >
            <motion.div
              className="flex items-center justify-center mb-4"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 360, 0],
              }}
              transition={{
                duration: 1,
                repeat: 1,
                delay: 0.5,
              }}
            >
              <Zap className="w-16 h-16 text-yellow-400" />
            </motion.div>

            <motion.h2
              className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              LEVEL UP!
            </motion.h2>

            <motion.p
              className="text-3xl font-bold text-white mt-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              レベル {level}
            </motion.p>
          </motion.div>

          {/* 周囲のパーティクル */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 bg-yellow-400 rounded-full"
              style={{
                left: "50%",
                top: "50%",
              }}
              initial={{
                opacity: 0,
                scale: 0,
                x: 0,
                y: 0,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: Math.cos((i / 20) * Math.PI * 2) * 200,
                y: Math.sin((i / 20) * Math.PI * 2) * 200,
              }}
              transition={{
                duration: 2,
                delay: 0.5 + i * 0.05,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
