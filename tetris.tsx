import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from 'framer-motion'
import { Music } from 'lucide-react'

const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: 'cyan-500' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: 'blue-500' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: 'orange-500' },
  O: { shape: [[1, 1], [1, 1]], color: 'yellow-500' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: 'green-500' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple-500' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: 'red-500' },
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const INITIAL_DROP_TIME = 800
const SPEED_INCREASE_FACTOR = 0.95

const createEmptyBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))

// 7-bagアルゴリズム：7種類のテトロミノをすべて含む配列をシャッフルして返す
const createTetrominoBag = () => {
  const bag = Object.keys(TETROMINOS)
  // Fisher-Yatesシャッフルアルゴリズムでランダム化
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

const getNextTetromino = (bag, setBag) => {
  if (bag.length === 0) {
    const newBag = createTetrominoBag()
    setBag(newBag.slice(1)) // 最初の要素を除いた残りをセット
    return TETROMINOS[newBag[0]]
  } else {
    const nextKey = bag[0]
    setBag(bag.slice(1)) // 最初の要素を除いた残りをセット
    return TETROMINOS[nextKey]
  }
}

export default function Tetris() {
  const [board, setBoard] = useState(createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [dropTime, setDropTime] = useState(INITIAL_DROP_TIME)
  const [level, setLevel] = useState(1)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const [completedRows, setCompletedRows] = useState([])
  const [tetrominoBag, setTetrominoBag] = useState(() => createTetrominoBag())
  const [nextPiece, setNextPiece] = useState(null)
  const audioRef = useRef(null)
  const dropInterval = useRef(null)

  const checkCollision = (x, y, shape) => {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col] !== 0) {
          const newX = x + col
          const newY = y + row
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && board[newY][newX] !== 0)) {
            return true
          }
        }
      }
    }
    return false
  }

  const isValidMove = (x, y, shape) => !checkCollision(x, y, shape)

  const moveLeft = useCallback(() => {
    if (currentPiece && isValidMove(currentPiece.x - 1, currentPiece.y, currentPiece.tetromino.shape)) {
      setCurrentPiece(prev => ({ ...prev, x: prev.x - 1 }))
    }
  }, [currentPiece, board])

  const moveRight = useCallback(() => {
    if (currentPiece && isValidMove(currentPiece.x + 1, currentPiece.y, currentPiece.tetromino.shape)) {
      setCurrentPiece(prev => ({ ...prev, x: prev.x + 1 }))
    }
  }, [currentPiece, board])

  const moveDown = useCallback(() => {
    if (!currentPiece) return
    if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.tetromino.shape)) {
      setCurrentPiece(prev => ({ ...prev, y: prev.y + 1 }))
    } else {
      placePiece()
    }
  }, [currentPiece, board])

  const rotate = useCallback(() => {
    if (!currentPiece) return
    const rotated = currentPiece.tetromino.shape[0].map((_, i) =>
      currentPiece.tetromino.shape.map(row => row[i]).reverse()
    )
    let newX = currentPiece.x
    let newY = currentPiece.y

    // Try to rotate, if not possible, try to adjust position
    if (!isValidMove(newX, newY, rotated)) {
      // Try to move left
      if (isValidMove(newX - 1, newY, rotated)) {
        newX -= 1
      }
      // Try to move right
      else if (isValidMove(newX + 1, newY, rotated)) {
        newX += 1
      }
      // Try to move up
      else if (isValidMove(newX, newY - 1, rotated)) {
        newY -= 1
      }
      // If still not possible, don't rotate
      else {
        return
      }
    }

    setCurrentPiece(prev => ({
      ...prev,
      x: newX,
      y: newY,
      tetromino: { ...prev.tetromino, shape: rotated }
    }))

    // Continue falling after rotation
    if (isValidMove(newX, newY + 1, rotated) && newY + 1 < BOARD_HEIGHT) {
      setCurrentPiece(prev => ({ ...prev, y: prev.y + 1 }))
    }
  }, [currentPiece, board])

  const placePiece = useCallback(() => {
    if (!currentPiece) return
    const newBoard = board.map(row => [...row])
    currentPiece.tetromino.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = y + currentPiece.y
          const boardX = x + currentPiece.x
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = currentPiece.tetromino.color
          }
        }
      })
    })
    setBoard(newBoard)
    clearLines(newBoard)
    spawnNewPiece()
  }, [currentPiece, board])

  const clearLines = useCallback((newBoard) => {
    let linesCleared = []
    const updatedBoard = newBoard.filter((row, index) => {
      if (row.every(cell => cell !== 0)) {
        linesCleared.push(index)
        return false
      }
      return true
    })
    
    if (linesCleared.length > 0) {
      setCompletedRows(linesCleared)
      setTimeout(() => {
        while (updatedBoard.length < BOARD_HEIGHT) {
          updatedBoard.unshift(Array(BOARD_WIDTH).fill(0))
        }
        setBoard(updatedBoard)
        setCompletedRows([])
        
        const newScore = score + linesCleared.length * 100
        setScore(newScore)
        
        if (Math.floor(newScore / 500) > level - 1) {
          setLevel(prev => prev + 1)
          setDropTime(prev => prev * SPEED_INCREASE_FACTOR)
        }
      }, 500)
    }
  }, [score, level])

  const spawnNewPiece = useCallback(() => {
    // 現在のnextPieceを使用し、新しいnextPieceを生成
    const tetromino = nextPiece || getNextTetromino(tetrominoBag, setTetrominoBag)
    const newNextPiece = getNextTetromino(tetrominoBag, setTetrominoBag)
    
    const newPiece = {
      x: Math.floor(BOARD_WIDTH / 2) - 1,
      y: 0,
      tetromino: tetromino
    }
    
    if (checkCollision(newPiece.x, newPiece.y, newPiece.tetromino.shape)) {
      setGameOver(true)
    } else {
      setCurrentPiece(newPiece)
      setNextPiece(newNextPiece)
    }
  }, [board, tetrominoBag, nextPiece])

  // 初期化時にnextPieceを設定
  useEffect(() => {
    if (!nextPiece) {
      setNextPiece(getNextTetromino(tetrominoBag, setTetrominoBag))
    }
  }, [nextPiece, tetrominoBag])

  useEffect(() => {
    if (!currentPiece && !gameOver && nextPiece) {
      spawnNewPiece()
    }
  }, [currentPiece, gameOver, spawnNewPiece, nextPiece])

  useEffect(() => {
    if (!gameOver) {
      dropInterval.current = setInterval(moveDown, dropTime)
    }
    return () => clearInterval(dropInterval.current)
  }, [moveDown, gameOver, dropTime])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return
      switch (e.key) {
        case 'ArrowLeft':
          moveLeft()
          break
        case 'ArrowRight':
          moveRight()
          break
        case 'ArrowDown':
          moveDown()
          break
        case 'ArrowUp':
          rotate()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [moveLeft, moveRight, moveDown, rotate, gameOver])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5
      audioRef.current.loop = true
      if (!gameOver && isMusicPlaying) {
        audioRef.current.play().catch(error => console.error("Audio playback failed:", error))
      } else {
        audioRef.current.pause()
      }
    }
  }, [gameOver, isMusicPlaying])

  const resetGame = () => {
    setBoard(createEmptyBoard())
    setCurrentPiece(null)
    setScore(0)
    setGameOver(false)
    setDropTime(INITIAL_DROP_TIME)
    setLevel(1)
    setCompletedRows([])
    setTetrominoBag(createTetrominoBag())
    setNextPiece(null)
    clearInterval(dropInterval.current)
  }

  const renderCell = (x, y) => {
    if (
      currentPiece &&
      currentPiece.tetromino.shape[y - currentPiece.y] &&
      currentPiece.tetromino.shape[y - currentPiece.y][x - currentPiece.x]
    ) {
      return currentPiece.tetromino.color
    }
    return board[y][x]
  }

  const toggleMusic = () => {
    setIsMusicPlaying(!isMusicPlaying)
  }

  // Next Pieceのプレビュー用のレンダリング関数
  const renderNextPiece = () => {
    if (!nextPiece) return null
    
    const maxSize = Math.max(nextPiece.shape.length, nextPiece.shape[0]?.length || 0)
    const cellSize = 15 // プレビュー用の小さなセルサイズ
    
    return (
      <div 
        className="grid bg-gray-200 p-2 rounded border"
        style={{
          gridTemplateColumns: `repeat(${maxSize}, 1fr)`,
          width: `${maxSize * cellSize + 16}px`,
          height: `${maxSize * cellSize + 16}px`,
        }}
      >
        {Array.from({ length: maxSize }, (_, y) =>
          Array.from({ length: maxSize }, (_, x) => {
            const hasBlock = nextPiece.shape[y] && nextPiece.shape[y][x]
            return (
              <div
                key={`${y}-${x}`}
                className={`${hasBlock ? `bg-${nextPiece.color}` : 'bg-transparent'}`}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  border: hasBlock ? '1px solid #e5e7eb' : 'none'
                }}
              />
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-4">Tetris</h1>
      
      <div className="flex gap-6 items-start">
        {/* メインゲームボード */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div 
            className="grid bg-gray-300" 
            style={{ 
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
              width: `${BOARD_WIDTH * 20}px`,
              height: `${BOARD_HEIGHT * 20}px`,
              border: '1px solid #e5e7eb'
            }}
          >
            {board.map((row, y) => 
              row.map((_, x) => (
                <AnimatePresence key={`${y}-${x}`}>
                  <motion.div 
                    initial={false}
                    animate={{
                      opacity: completedRows.includes(y) ? 0 : 1,
                      scale: completedRows.includes(y) ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    className={`w-5 h-5 ${renderCell(x, y) ? `bg-${renderCell(x, y)}` : 'bg-gray-100'}`}
                    style={{ border: '1px solid #e5e7eb' }}
                  />
                </AnimatePresence>
              ))
            )}
          </div>
        </div>

        {/* サイドパネル（スコア、レベル、ネクストピース） */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="mb-4">
            <div className="text-xl font-bold mb-2">Score: {score}</div>
            <div className="text-lg mb-4">Level: {level}</div>
          </div>
          
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2">Next:</div>
            {renderNextPiece()}
          </div>
          
          <div className="text-xs text-gray-600 mb-4">
            <div>矢印キー：移動</div>
            <div>↑：回転</div>
            <div>↓：高速落下</div>
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="mt-4 text-2xl font-bold text-red-600">Game Over!</div>
      )}
      
      <div className="flex gap-4 mt-4">
        <Button onClick={resetGame}>
          {gameOver ? 'Play Again' : 'Reset Game'}
        </Button>
        <Button onClick={toggleMusic}>
          <Music className="w-4 h-4 mr-2" />
          {isMusicPlaying ? 'Stop Music' : 'Play Music'}
        </Button>
      </div>
      
      <audio ref={audioRef} src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Tetris-kxnh5j7hpNEcFspAndlU2huV5n6dvk.mp3" />
    </div>
  )
}