"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"
import { supabase, type GameRoom, type Player } from "@/lib/supabase"
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  createEmptyBoard,
  randomTetromino,
  checkCollision,
  rotatePiece,
  clearLines,
  calculateScore,
  getDropTime,
  getSoftDropTime,
} from "@/lib/tetris-logic"
import { Trophy, Users, ArrowLeft, Pause, Play, RotateCcw, Flag } from "lucide-react"
import { toast } from "sonner"
import { LineClearEffect } from "@/components/animations/LineClearEffect"
import { ScoreAnimation } from "@/components/animations/ScoreAnimation"
import { LevelUpEffect } from "@/components/animations/LevelUpEffect"

interface TetrisGameProps {
  room: GameRoom
  playerId: string
  playerName: string
  onLeave: () => void
}

interface CurrentPiece {
  x: number
  y: number
  shape: number[][]
  color: string
  shadowColor: string
  type: string
}

export default function TetrisGame({ room, playerId, playerName, onLeave }: TetrisGameProps) {
  const [board, setBoard] = useState<number[][]>(createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState<CurrentPiece | null>(null)
  const [nextPiece, setNextPiece] = useState<CurrentPiece | null>(null)
  const [score, setScore] = useState(0)
  const [previousScore, setPreviousScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [previousLevel, setPreviousLevel] = useState(1)
  const [linesCleared, setLinesCleared] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [winner, setWinner] = useState<string | null>(null)
  const [ghostPiece, setGhostPiece] = useState<{ x: number; y: number } | null>(null)
  const [isSoftDropping, setIsSoftDropping] = useState(false)
  const [tetrisCount, setTetrisCount] = useState(0)
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now())
  const [clearedLinesForAnimation, setClearedLinesForAnimation] = useState<number[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [pieceDropAnimation, setPieceDropAnimation] = useState<{ x: number; y: number } | null>(null)
  const [hardDropEffect, setHardDropEffect] = useState(false)

  const dropInterval = useRef<NodeJS.Timeout | null>(null)
  const lastUpdate = useRef<number>(Date.now())
  const gameStartTimeRef = useRef<number>(Date.now())
  const boardRef = useRef<HTMLDivElement>(null)
  const keysPressed = useRef<Set<string>>(new Set())

  // 初期化とクリーンアップ
  useEffect(() => {
    const setupRoom = async () => {
      try {
        // ルームの状態を確認
        const { data: roomData, error: roomError } = await supabase
          .from("game_rooms")
          .select("status, current_players")
          .eq("id", room.id)
          .single()

        if (roomError) throw roomError

        // ルームが存在しないか完了状態の場合は新しいルームを作成
        if (!roomData || roomData.status === "finished") {
          const { error: createError } = await supabase
            .from("game_rooms")
            .insert({
              id: room.id,
              name: room.name,
              status: "waiting",
              current_players: 1,
              updated_at: new Date().toISOString()
            })

          if (createError) throw createError
        }
      } catch (error) {
        console.error("Error setting up room:", error)
        toast.error("ルームのセットアップに失敗しました")
      }
    }

    setupRoom()
    fetchPlayers()
    gameStartTimeRef.current = Date.now()
    setGameStartTime(Date.now())

    // カスタムルールを取得
    const fetchCustomRule = async () => {
      if (room.custom_rule_id) {
        try {
          const { data, error } = await supabase.from("custom_rules").select("*").eq("id", room.custom_rule_id).single()

          if (error) throw error
          if (data) {
            console.log("Custom rule loaded:", data)
          }
        } catch (error) {
          console.error("Error fetching custom rule:", error)
        }
      }
    }

    fetchCustomRule()

    // 最初のピースを生成
    if (!currentPiece) {
      const firstPiece = randomTetromino()
      setCurrentPiece({
        x: Math.floor(BOARD_WIDTH / 2) - 1,
        y: 0,
        shape: firstPiece.shape,
        color: firstPiece.color,
        shadowColor: firstPiece.shadowColor,
        type: firstPiece.type,
      })
      setNextPiece(randomTetromino())
    }

    // サブスクリプションのセットアップ
    const playersSubscription = supabase
      .channel("game_players_active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          fetchPlayers()
          if (payload.eventType === "UPDATE" && payload.new && !payload.new.is_alive && payload.old?.is_alive) {
            const defeatedPlayer = players.find((p) => p.id === payload.new.id)
            if (defeatedPlayer && defeatedPlayer.id !== playerId) {
              toast.success(`${defeatedPlayer.player_name} が敗北しました！`)
            }
          }
        },
      )
      .subscribe()

    const gameStateSubscription = supabase
      .channel("game_state_active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_states", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          if (payload.new && payload.new.winner_id) {
            const winnerName = await fetchWinnerInfo(payload.new.winner_id)
            setWinner(winnerName)

            if (winnerName === playerName) {
              toast.success("🎉 勝利おめでとうございます！ 🎉")
            } else {
              toast.info(`${winnerName} の勝利です`)
            }
          }
        },
      )
      .subscribe()

    // クリーンアップ関数
    return () => {
      playersSubscription.unsubscribe()
      gameStateSubscription.unsubscribe()
      if (dropInterval.current) {
        clearInterval(dropInterval.current)
      }

      const cleanup = async () => {
        try {
          // プレイヤーを削除
          await supabase.from("players").delete().eq("id", playerId)

          // ルームの状態を確認
          const { data: roomData } = await supabase
            .from("game_rooms")
            .select("current_players")
            .eq("id", room.id)
            .single()

          if (roomData && roomData.current_players <= 0) {
            // 全プレイヤーが退出済みの場合はルームを削除
            await supabase.from("game_rooms").delete().eq("id", room.id)
          } else {
            // プレイヤーが残っている場合は更新時刻を更新
            await supabase
              .from("game_rooms")
              .update({
                updated_at: new Date().toISOString()
              })
              .eq("id", room.id)
          }
        } catch (error) {
          console.error("Error cleaning up room:", error)
        }
      }
      cleanup()
    }
  }, [room.id, playerId, room.name, room.custom_rule_id])

  // プレイヤー情報の取得
  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase.from("players").select("*").eq("room_id", room.id).order("player_number")

      if (error) throw error
      if (data) setPlayers(data)
    } catch (error) {
      console.error("Error fetching players:", error)
      toast.error("プレイヤー情報の取得に失敗しました")
    }
  }

  // 勝者情報の取得
  const fetchWinnerInfo = async (winnerId: string) => {
    try {
      const { data, error } = await supabase.from("players").select("player_name").eq("id", winnerId).single()

      if (error) throw error
      return data?.player_name || "不明"
    } catch (error) {
      console.error("Error fetching winner info:", error)
      return "不明"
    }
  }

  // プレイヤー状態の更新
  const updatePlayerState = async () => {
    const now = Date.now()
    if (now - lastUpdate.current < 100) return
    lastUpdate.current = now

    try {
      await supabase
        .from("players")
        .update({
          board_state: board,
          current_piece: currentPiece,
          score,
          level,
          lines_cleared: linesCleared,
          is_alive: !gameOver,
          updated_at: new Date().toISOString()
        })
        .eq("id", playerId)
    } catch (error) {
      console.error("Error updating player state:", error)
    }
  }

  // 新しいピースの生成
  const spawnNewPiece = useCallback(() => {
    if (!nextPiece) return

    const newPiece: CurrentPiece = {
      x: Math.floor(BOARD_WIDTH / 2) - 1,
      y: 0,
      shape: nextPiece.shape,
      color: nextPiece.color,
      shadowColor: nextPiece.shadowColor,
      type: nextPiece.type,
    }

    if (checkCollision(board, newPiece.x, newPiece.y, newPiece.shape)) {
      setGameOver(true)
      checkForWinner()
      toast.error("ゲームオーバー！")
    } else {
      setCurrentPiece(newPiece)
      setNextPiece(randomTetromino())
    }
  }, [board, nextPiece])

  // ゴーストピースの更新
  const updateGhostPiece = () => {
    if (!currentPiece) {
      setGhostPiece(null)
      return
    }

    let ghostY = currentPiece.y
    while (!checkCollision(board, currentPiece.x, ghostY + 1, currentPiece.shape)) {
      ghostY++
    }

    if (ghostY !== currentPiece.y) {
      setGhostPiece({ x: currentPiece.x, y: ghostY })
    } else {
      setGhostPiece(null)
    }
  }

  // 勝者のチェック
  const checkForWinner = async () => {
    try {
      const gameDuration = (Date.now() - gameStartTime) / 1000

      // ゲーム履歴を保存
      const { data: historyData, error: historyError } = await supabase
        .from("game_history")
        .insert({
          room_id: room.id,
          player_name: playerName,
          final_score: score,
          final_level: level,
          lines_cleared: linesCleared,
          tetrises: tetrisCount,
          game_duration: gameDuration,
          placement: 2,
          is_winner: false,
          surrendered: false,
        })
        .select()
        .single()

      if (historyError) throw historyError

      // プレイヤー統計を更新
      const { error: statsError } = await supabase.rpc("update_player_statistics", {
        p_player_name: playerName,
        p_final_score: score,
        p_final_level: level,
        p_lines_cleared: linesCleared,
        p_tetrises: tetrisCount,
        p_game_duration: gameDuration,
        p_is_winner: false,
        p_surrendered: false,
      })

      if (statsError) throw statsError

      // アチーブメントをチェック
      await checkAchievements(historyData.id, score, level, linesCleared, tetrisCount, gameDuration)

      const alivePlayers = players.filter((p) => p.is_alive && p.id !== playerId)
      if (alivePlayers.length === 0) {
        // 勝者の統計も更新
        const opponent = players.find((p) => p.id !== playerId)
        if (opponent) {
          await supabase.rpc("update_player_statistics", {
            p_player_name: opponent.player_name,
            p_final_score: opponent.score,
            p_final_level: opponent.level,
            p_lines_cleared: opponent.lines_cleared,
            p_tetrises: 0,
            p_game_duration: gameDuration,
            p_is_winner: true,
            p_surrendered: false,
          })
        }

        await supabase.from("game_states").insert({
          room_id: room.id,
          winner_id: playerId,
          game_data: {
            final_scores: players.map((p) => ({
              id: p.id,
              name: p.player_name,
              score: p.score,
            })),
            game_duration: gameDuration,
          },
        })
      }
    } catch (error) {
      console.error("Error checking for winner:", error)
    }
  }

  // アチーブメントのチェック
  const checkAchievements = async (
    gameId: string,
    finalScore: number,
    finalLevel: number,
    finalLines: number,
    finalTetrises: number,
    duration: number,
  ) => {
    try {
      if (finalScore >= 100000) {
        await supabase.rpc("insert_achievement", {
          p_player_name: playerName,
          p_achievement_type: "score",
          p_achievement_name: "100K マスター",
          p_description: "100,000点を達成",
          p_game_id: gameId,
        })
      }

      if (finalLevel >= 10) {
        await supabase.rpc("insert_achievement", {
          p_player_name: playerName,
          p_achievement_type: "level",
          p_achievement_name: "レベル10達成",
          p_description: "レベル10に到達",
          p_game_id: gameId,
        })
      }

      if (finalTetrises >= 5) {
        await supabase.rpc("insert_achievement", {
          p_player_name: playerName,
          p_achievement_type: "tetris",
          p_achievement_name: "テトリスマスター",
          p_description: "1ゲームで5回のテトリスを達成",
          p_game_id: gameId,
        })
      }

      if (duration < 60 && finalScore > 10000) {
        await supabase.rpc("insert_achievement", {
          p_player_name: playerName,
          p_achievement_type: "speed",
          p_achievement_name: "スピードマスター",
          p_description: "1分以内に10,000点を達成",
          p_game_id: gameId,
        })
      }
    } catch (error) {
      console.error("Error checking achievements:", error)
    }
  }

  // ピース移動
  const moveLeft = useCallback(() => {
    if (currentPiece && !checkCollision(board, currentPiece.x - 1, currentPiece.y, currentPiece.shape)) {
      setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x - 1 } : null))
    }
  }, [currentPiece, board])

  const moveRight = useCallback(() => {
    if (currentPiece && !checkCollision(board, currentPiece.x + 1, currentPiece.y, currentPiece.shape)) {
      setCurrentPiece((prev) => (prev ? { ...prev, x: prev.x + 1 } : null))
    }
  }, [currentPiece, board])

  const moveDown = useCallback(() => {
    if (!currentPiece) return

    if (!checkCollision(board, currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
      setCurrentPiece((prev) => (prev ? { ...prev, y: prev.y + 1 } : null))
    } else {
      placePiece()
    }
  }, [currentPiece, board])

  const hardDrop = useCallback(() => {
    if (!currentPiece) return

    let dropY = currentPiece.y
    while (!checkCollision(board, currentPiece.x, dropY + 1, currentPiece.shape)) {
      dropY++
    }

    setHardDropEffect(true)
    setCurrentPiece((prev) => (prev ? { ...prev, y: dropY } : null))

    setTimeout(() => {
      setHardDropEffect(false)
      if (currentPiece) {
        const updatedPiece = { ...currentPiece, y: dropY }
        placePieceDirectly(updatedPiece)
      }
    }, 50)
  }, [currentPiece, board])

  // ピースの回転
  const rotate = useCallback(() => {
    if (!currentPiece) return

    const rotated = rotatePiece(currentPiece.shape)
    const newX = currentPiece.x
    const newY = currentPiece.y

    const wallKicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
    ]

    for (const [dx, dy] of wallKicks) {
      if (!checkCollision(board, newX + dx, newY + dy, rotated)) {
        setCurrentPiece((prev) =>
          prev
            ? {
                ...prev,
                x: newX + dx,
                y: newY + dy,
                shape: rotated,
              }
            : null,
        )
        return
      }
    }
  }, [currentPiece, board])

  // ピースの配置
  const placePieceDirectly = useCallback(
    (piece: CurrentPiece) => {
      const newBoard = board.map((row) => [...row])
      piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = y + piece.y
            const boardX = x + piece.x
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              newBoard[boardY][boardX] = 1
            }
          }
        })
      })

      setPieceDropAnimation({ x: piece.x, y: piece.y })
      setTimeout(() => setPieceDropAnimation(null), 300)

      const { newBoard: clearedBoard, linesCleared: cleared } = clearLines(newBoard)

      if (cleared > 0) {
        const linesToClear: number[] = []
        for (let y = 0; y < BOARD_HEIGHT; y++) {
          if (newBoard[y].every((cell) => cell !== 0)) {
            linesToClear.push(y)
          }
        }

        setClearedLinesForAnimation(linesToClear)
        setIsAnimating(true)

        setTimeout(() => {
          setBoard(clearedBoard)
          setCurrentPiece(null)
          setClearedLinesForAnimation([])
          setIsAnimating(false)

          const newScore = score + calculateScore(cleared, level)
          const newLinesCleared = linesCleared + cleared

          setPreviousScore(score)
          setScore(newScore)
          setLinesCleared(newLinesCleared)

          if (Math.floor(newLinesCleared / 10) > level - 1) {
            setPreviousLevel(level)
            setLevel((prev) => prev + 1)
          }

          if (cleared === 4) {
            setTetrisCount((prev) => prev + 1)
            toast.success("🎉 テトリス！ 🎉")
          }

          spawnNewPiece()
        }, 800)
      } else {
        setBoard(clearedBoard)
        setCurrentPiece(null)
        spawnNewPiece()
      }
    },
    [board, score, level, linesCleared, spawnNewPiece],
  )

  const placePiece = useCallback(() => {
    if (!currentPiece) return
    placePieceDirectly(currentPiece)
  }, [currentPiece, placePieceDirectly])

  // ゲーム操作
  const togglePause = () => {
    setIsPaused(!isPaused)
    toast.info(isPaused ? "ゲーム再開" : "ゲーム一時停止")
  }

  const surrender = async () => {
    try {
      await supabase.from("players").update({ is_alive: false }).eq("id", playerId)
      setGameOver(true)

      const opponent = players.find((p) => p.id !== playerId && p.is_alive)
      if (opponent) {
        await supabase.from("game_states").insert({
          room_id: room.id,
          winner_id: opponent.id,
          game_data: {
            final_scores: players.map((p) => ({
              id: p.id,
              name: p.player_name,
              score: p.score,
            })),
            game_duration: Date.now() - gameStartTimeRef.current,
            surrender: true,
          },
        })
      }

      toast.info("降参しました")
    } catch (error) {
      console.error("Error surrendering:", error)
      toast.error("降参に失敗しました")
    }
  }

  const handleLeave = async () => {
    try {
      await supabase.from("players").delete().eq("id", playerId)
      
      const { data: playersData } = await supabase
        .from("players")
        .select("id")
        .eq("room_id", room.id)

      if (!playersData || playersData.length === 0) {
        await supabase.from("game_states").insert({
          room_id: room.id,
          winner_id: null,
          game_data: {
            end_reason: "all_players_left",
            final_scores: players.map(p => ({
              id: p.id,
              name: p.player_name,
              score: p.score
            }))
          }
        })

        await supabase
          .from("game_rooms")
          .update({ 
            status: "finished",
            updated_at: new Date().toISOString()
          })
          .eq("id", room.id)
      }

      onLeave()
      toast.success("ゲームから退出しました")
    } catch (error) {
      console.error("Error leaving game:", error)
      toast.error("退出に失敗しました")
    }
  }

  // 表示関連
  const renderCell = (x: number, y: number) => {
    if (
      currentPiece &&
      y >= currentPiece.y &&
      y < currentPiece.y + currentPiece.shape.length &&
      x >= currentPiece.x &&
      x < currentPiece.x + currentPiece.shape[0].length
    ) {
      const pieceY = y - currentPiece.y
      const pieceX = x - currentPiece.x
      if (currentPiece.shape[pieceY] && currentPiece.shape[pieceY][pieceX]) {
        return `${currentPiece.color} ${currentPiece.shadowColor} shadow-lg transform transition-all duration-75`
      }
    }

    if (
      ghostPiece &&
      currentPiece &&
      y >= ghostPiece.y &&
      y < ghostPiece.y + currentPiece.shape.length &&
      x >= ghostPiece.x &&
      x < ghostPiece.x + currentPiece.shape[0].length
    ) {
      const pieceY = y - ghostPiece.y
      const pieceX = x - ghostPiece.x
      if (currentPiece.shape[pieceY] && currentPiece.shape[pieceY][pieceX]) {
        return "border-2 border-dashed border-gray-400 dark:border-gray-600 bg-gray-200/30 dark:bg-gray-700/30"
      }
    }

    return board[y][x] ? "bg-gray-600 dark:bg-gray-400 shadow-md" : "bg-gray-100 dark:bg-gray-800"
  }

  const renderNextPiece = () => {
    if (!nextPiece) return null

    return (
      <motion.div
        className="grid gap-1 p-2"
        style={{ gridTemplateColumns: `repeat(4, 1fr)` }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {Array.from({ length: 4 }).map((_, y) =>
          Array.from({ length: 4 }).map((_, x) => {
            const hasBlock = nextPiece.shape[y] && nextPiece.shape[y][x]
            return (
              <motion.div
                key={`${y}-${x}`}
                className={`w-4 h-4 rounded-sm transition-all ${hasBlock ? nextPiece.color : "bg-gray-100 dark:bg-gray-800"}`}
                whileHover={hasBlock ? { scale: 1.1 } : {}}
              />
            )
          }),
        )}
      </motion.div>
    )
  }

  const getProgressToNextLevel = () => {
    const currentLevelLines = (level - 1) * 10
    const nextLevelLines = level * 10
    const progress = ((linesCleared - currentLevelLines) / (nextLevelLines - currentLevelLines)) * 100
    return Math.min(100, Math.max(0, progress))
  }

  // エフェクト
  useEffect(() => {
    if (!gameOver && !isPaused && !isAnimating && currentPiece) {
      const dropTime = isSoftDropping ? getSoftDropTime(level) : getDropTime(level)

      if (dropInterval.current) {
        clearInterval(dropInterval.current)
      }

      dropInterval.current = setInterval(() => {
        if (!isAnimating && !hardDropEffect) {
          moveDown()
        }
      }, dropTime)
    }

    return () => {
      if (dropInterval.current) {
        clearInterval(dropInterval.current)
      }
    }
  }, [level, gameOver, isPaused, isAnimating, currentPiece, isSoftDropping, hardDropEffect, moveDown])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || isPaused || isAnimating) return

      if (keysPressed.current.has(e.key)) return
      keysPressed.current.add(e.key)

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          moveLeft()
          break
        case "ArrowRight":
          e.preventDefault()
          moveRight()
          break
        case "ArrowDown":
          e.preventDefault()
          setIsSoftDropping(true)
          break
        case "ArrowUp":
          e.preventDefault()
          rotate()
          break
        case " ":
          e.preventDefault()
          if (!isAnimating) {
            hardDrop()
          }
          break
        case "p":
        case "P":
          e.preventDefault()
          togglePause()
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key)

      if (e.key === "ArrowDown") {
        setIsSoftDropping(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameOver, isPaused, isAnimating, moveLeft, moveRight, rotate, hardDrop])

  useEffect(() => {
    updateGhostPiece()
  }, [currentPiece, board])

  useEffect(() => {
    updatePlayerState()
  }, [board, currentPiece, score, level, linesCleared, gameOver])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 dark:from-purple-900 dark:via-blue-900 dark:to-cyan-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={handleLeave}
            variant="outline"
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            退出
          </Button>
                    <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={togglePause}
              variant="outline"
              size="sm"
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              disabled={gameOver}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button
              onClick={surrender}
              variant="outline"
              size="sm"
              className="bg-red-500/20 backdrop-blur-sm border-red-300/20 text-white hover:bg-red-500/30"
              disabled={gameOver || isPaused}
            >
              <Flag className="w-4 h-4 mr-1" />
              降参
            </Button>
            <Badge variant="secondary" className="bg-white/20 text-white">
              <Users className="w-4 h-4 mr-1" />
              {players.length}人
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* 左サイドバー - 次のピースとスコア */}
          <div className="space-y-4">
            {/* 次のピース */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">次のピース</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-center">{renderNextPiece()}</div>
              </CardContent>
            </Card>

            {/* スコア */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">スコア</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-white">
                    <span>得点:</span>
                    <motion.span
                      className="font-bold"
                      key={score}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    >
                      {score.toLocaleString()}
                    </motion.span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>レベル:</span>
                    <motion.span
                      className="font-bold"
                      key={level}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5 }}
                    >
                      {level}
                    </motion.span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>ライン:</span>
                    <span className="font-bold">{linesCleared}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/80">
                    <span>落下速度:</span>
                    <span>{getDropTime(level)}ms</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>次のレベルまで</span>
                    <span>{level * 10 - linesCleared}ライン</span>
                  </div>
                  <Progress value={getProgressToNextLevel()} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* 操作説明 */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">操作方法</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-xs text-white/90">
                  <div className="flex justify-between">
                    <span>← →</span>
                    <span>移動</span>
                  </div>
                  <div className="flex justify-between">
                    <span>↓</span>
                    <span>ソフトドロップ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>↑</span>
                    <span>回転</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Space</span>
                    <span>ハードドロップ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P</span>
                    <span>一時停止</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* メインゲームボード */}
          <div className="xl:col-span-2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-white">{playerName} のボード</CardTitle>
                <div className="flex justify-center gap-2">
                  <AnimatePresence>
                    {isPaused && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-200">
                          一時停止中
                        </Badge>
                      </motion.div>
                    )}
                    {isSoftDropping && !isPaused && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-200">
                          高速落下中
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="relative" ref={boardRef}>
                  <motion.div
                    className={`grid bg-gray-900/50 backdrop-blur-sm border-2 border-white/20 rounded-lg p-2 transition-all ${
                      isPaused ? "opacity-50" : ""
                    } ${hardDropEffect ? "shadow-2xl shadow-white/50" : ""}`}
                    style={{
                      gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
                      width: `${BOARD_WIDTH * 28}px`,
                      height: `${BOARD_HEIGHT * 28}px`,
                    }}
                    animate={hardDropEffect ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.1 }}
                  >
                    {board.map((row, y) =>
                      row.map((_, x) => (
                        <motion.div
                          key={`${y}-${x}`}
                          className={`w-6 h-6 border border-gray-700/50 rounded-sm transition-all ${renderCell(x, y)}`}
                          animate={
                            pieceDropAnimation &&
                            x >= pieceDropAnimation.x &&
                            x < pieceDropAnimation.x + (currentPiece?.shape[0]?.length || 0) &&
                            y >= pieceDropAnimation.y &&
                            y < pieceDropAnimation.y + (currentPiece?.shape?.length || 0)
                              ? { scale: [1, 1.1, 1] }
                              : {}
                          }
                          transition={{ duration: 0.3 }}
                        />
                      )),
                    )}
                  </motion.div>

                  {/* ライン消去エフェクト */}
                  <LineClearEffect
                    clearedLines={clearedLinesForAnimation}
                    boardWidth={BOARD_WIDTH}
                    cellSize={28}
                    onComplete={() => {}}
                  />

                  {/* 一時停止オーバーレイ */}
                  <AnimatePresence>
                    {isPaused && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="bg-black/80 text-white px-6 py-4 rounded-lg backdrop-blur-sm">
                          <Pause className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-lg font-semibold">一時停止中</p>
                          <p className="text-sm opacity-80">Pキーで再開</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右サイドバー - 対戦相手 */}
          <div className="space-y-4">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm">対戦相手</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {players
                  .filter((p) => p.id !== playerId)
                  .map((player) => (
                    <motion.div
                      key={player.id}
                      className="mb-4 p-3 bg-white/10 rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{player.player_name}</span>
                        <Badge
                          variant={player.is_alive ? "default" : "destructive"}
                          className={player.is_alive ? "bg-green-500/20 text-green-200" : ""}
                        >
                          {player.is_alive ? "生存中" : "敗北"}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-white/80">
                        <div className="flex justify-between">
                          <span>得点:</span>
                          <span>{player.score.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>レベル:</span>
                          <span>{player.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ライン:</span>
                          <span>{player.lines_cleared}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* アニメーションエフェクト */}
        <ScoreAnimation
          score={score}
          previousScore={previousScore}
          position={
            boardRef.current
              ? {
                  x: boardRef.current.offsetLeft + boardRef.current.offsetWidth / 2,
                  y: boardRef.current.offsetTop + boardRef.current.offsetHeight / 2,
                }
              : undefined
          }
        />

        <LevelUpEffect level={level} previousLevel={previousLevel} />

        {/* ゲームオーバー/勝利画面 */}
        <AnimatePresence>
          {(gameOver || winner) && (
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <Card className="w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">
                      {winner ? (
                        <>
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                          >
                            <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                          </motion.div>
                          {winner === playerName ? "🎉 勝利！ 🎉" : `${winner} の勝利！`}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-12 h-12 mx-auto mb-4 text-red-500" />
                          ゲームオーバー
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <motion.div className="bg-muted/50 rounded-lg p-3" whileHover={{ scale: 1.05 }}>
                        <div className="text-2xl font-bold">{score.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">最終得点</div>
                      </motion.div>
                      <motion.div className="bg-muted/50 rounded-lg p-3" whileHover={{ scale: 1.05 }}>
                        <div className="text-2xl font-bold">{linesCleared}</div>
                        <div className="text-sm text-muted-foreground">クリアライン</div>
                      </motion.div>
                      <motion.div className="bg-muted/50 rounded-lg p-3" whileHover={{ scale: 1.05 }}>
                        <div className="text-2xl font-bold">{level}</div>
                        <div className="text-sm text-muted-foreground">到達レベル</div>
                      </motion.div>
                      <motion.div className="bg-muted/50 rounded-lg p-3" whileHover={{ scale: 1.05 }}>
                        <div className="text-2xl font-bold">
                          {Math.floor((Date.now() - gameStartTimeRef.current) / 1000)}s
                        </div>
                        <div className="text-sm text-muted-foreground">プレイ時間</div>
                      </motion.div>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button onClick={handleLeave} className="w-full" size="lg">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        ロビーに戻る
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
