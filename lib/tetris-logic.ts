import type { CustomRule } from "./supabase"

export const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: "bg-cyan-500 dark:bg-cyan-400",
    shadowColor: "shadow-cyan-500/50",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "bg-blue-500 dark:bg-blue-400",
    shadowColor: "shadow-blue-500/50",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "bg-orange-500 dark:bg-orange-400",
    shadowColor: "shadow-orange-500/50",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-yellow-500 dark:bg-yellow-400",
    shadowColor: "shadow-yellow-500/50",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "bg-green-500 dark:bg-green-400",
    shadowColor: "shadow-green-500/50",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "bg-purple-500 dark:bg-purple-400",
    shadowColor: "shadow-purple-500/50",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "bg-red-500 dark:bg-red-400",
    shadowColor: "shadow-red-500/50",
  },
}

export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const createEmptyBoard = (): number[][] => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))

export const randomTetromino = () => {
  const keys = Object.keys(TETROMINOS) as Array<keyof typeof TETROMINOS>
  const randKey = keys[Math.floor(Math.random() * keys.length)]
  return { type: randKey, ...TETROMINOS[randKey] }
}

export const checkCollision = (board: number[][], x: number, y: number, shape: number[][]): boolean => {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] !== 0) {
        const newX = x + col
        const newY = y + row

        // 境界チェック
        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return true
        }

        // ボード上の既存ブロックとの衝突チェック（Y座標が0以上の場合のみ）
        if (newY >= 0 && board[newY] && board[newY][newX] !== 0) {
          return true
        }
      }
    }
  }
  return false
}

export const rotatePiece = (shape: number[][]): number[][] => {
  return shape[0].map((_, i) => shape.map((row) => row[i]).reverse())
}

export const clearLines = (board: number[][]): { newBoard: number[][]; linesCleared: number } => {
  const newBoard = board.filter((row) => !row.every((cell) => cell !== 0))
  const linesCleared = BOARD_HEIGHT - newBoard.length

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(0))
  }

  return { newBoard, linesCleared }
}

// カスタムルール対応のスコア計算
export const calculateScore = (linesCleared: number, level: number, customRule?: CustomRule): number => {
  if (!customRule) {
    const baseScores = [0, 40, 100, 300, 1200]
    return baseScores[linesCleared] * level
  }

  const scores = [
    0,
    customRule.single_line_score,
    customRule.double_line_score,
    customRule.triple_line_score,
    customRule.tetris_score,
  ]

  return scores[linesCleared] * level
}

// カスタムルール対応のドロップタイム計算
export const getDropTime = (level: number, customRule?: CustomRule): number => {
  if (!customRule) {
    const baseTime = 1000
    const reduction = Math.min(level - 1, 32) * 30
    return Math.max(30, baseTime - reduction)
  }

  const baseTime = customRule.initial_drop_time
  const speedIncrease = Math.pow(customRule.level_speed_increase, level - 1)
  return Math.max(30, Math.floor(baseTime * speedIncrease))
}

// カスタムルール対応のソフトドロップ時間
export const getSoftDropTime = (level: number, customRule?: CustomRule): number => {
  const normalDropTime = getDropTime(level, customRule)
  const multiplier = customRule?.soft_drop_multiplier || 0.05
  return Math.max(10, Math.floor(normalDropTime * multiplier))
}

// レベルアップ判定
export const shouldLevelUp = (linesCleared: number, currentLevel: number, customRule?: CustomRule): boolean => {
  const linesPerLevel = customRule?.lines_per_level || 10
  const maxLevel = customRule?.max_level || 30

  if (currentLevel >= maxLevel) return false

  return Math.floor(linesCleared / linesPerLevel) > currentLevel - 1
}

// ガベージライン生成
export const generateGarbageLines = (count: number): number[][] => {
  const garbageLines: number[][] = []

  for (let i = 0; i < count; i++) {
    const line = Array(BOARD_WIDTH).fill(1)
    // ランダムな位置に穴を開ける
    const holePosition = Math.floor(Math.random() * BOARD_WIDTH)
    line[holePosition] = 0
    garbageLines.push(line)
  }

  return garbageLines
}

// ガベージライン攻撃の計算
export const calculateGarbageAttack = (linesCleared: number): number => {
  switch (linesCleared) {
    case 1:
      return 0 // シングルは攻撃なし
    case 2:
      return 1 // ダブルは1ライン
    case 3:
      return 2 // トリプルは2ライン
    case 4:
      return 4 // テトリスは4ライン
    default:
      return 0
  }
}
