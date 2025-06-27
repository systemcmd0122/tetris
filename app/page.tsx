"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Gamepad2, Users, Zap, Trophy, ArrowLeft } from "lucide-react"
import type { GameRoom } from "@/lib/supabase"
import GameLobby from "@/components/GameLobby"
import TetrisGame from "@/components/TetrisGame"
import Leaderboard from "@/components/Leaderboard"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [playerName, setPlayerName] = useState("")
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  useEffect(() => {
    setMounted(true)
    // ローカルストレージからプレイヤー名を復元
    const savedName = localStorage.getItem("tetris-player-name")
    if (savedName) {
      setPlayerName(savedName)
    }
  }, [])

  useEffect(() => {
    // プレイヤー名をローカルストレージに保存
    if (playerName && mounted) {
      localStorage.setItem("tetris-player-name", playerName)
    }
  }, [playerName, mounted])

  const joinRoom = (room: GameRoom, id: string) => {
    setCurrentRoom(room)
    setPlayerId(id)
  }

  const startGame = () => {
    setGameStarted(true)
  }

  const leaveRoom = () => {
    setCurrentRoom(null)
    setGameStarted(false)
    setPlayerId(null)
    setIsLoading(false)
  }

  // Show loading state until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    )
  }

  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 dark:from-purple-900 dark:via-blue-900 dark:to-cyan-900">
        <header className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowLeaderboard(false)}
                variant="outline"
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
              <h1 className="text-2xl font-bold text-white">リーダーボード</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="container mx-auto px-4 pb-8">
          <Leaderboard currentPlayer={playerName.trim() || undefined} />
        </div>
      </div>
    )
  }

  if (gameStarted && currentRoom && playerId) {
    return <TetrisGame room={currentRoom} playerId={playerId} playerName={playerName} onLeave={leaveRoom} />
  }

  if (currentRoom && playerId) {
    return (
      <GameLobby
        room={currentRoom}
        playerId={playerId}
        playerName={playerName}
        onStartGame={startGame}
        onLeave={leaveRoom}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 dark:from-purple-900 dark:via-blue-900 dark:to-cyan-900">
      {/* ヘッダー */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              variant="outline"
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
            >
              <Trophy className="h-4 w-4 mr-2" />
              リーダーボード
            </Button>
            <Gamepad2 className="h-8 w-8 text-white" />
            <h1 className="text-2xl font-bold text-white">オンライン対戦テトリス</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* ヒーローセクション */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">リアルタイム対戦</h2>
            <p className="text-xl text-white/80 mb-8">友達と一緒に、世界中のプレイヤーと対戦しよう！</p>

            {/* 特徴 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
                <Zap className="h-8 w-8 mx-auto mb-3 text-yellow-400" />
                <h3 className="font-semibold mb-2">リアルタイム対戦</h3>
                <p className="text-sm text-white/80">遅延なしの完全リアルタイム対戦</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
                <Users className="h-8 w-8 mx-auto mb-3 text-blue-400" />
                <h3 className="font-semibold mb-2">マルチプレイヤー</h3>
                <p className="text-sm text-white/80">最大2人での白熱した対戦</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
                <Trophy className="h-8 w-8 mx-auto mb-3 text-purple-400" />
                <h3 className="font-semibold mb-2">競技性</h3>
                <p className="text-sm text-white/80">スコアとレベルで実力を競おう</p>
              </div>
            </div>
          </div>

          {/* ゲーム開始セクション */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  ゲームを始める
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">プレイヤー名</label>
                  <Input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="名前を入力してください"
                    className="w-full text-center text-lg font-medium"
                    maxLength={20}
                  />
                  {playerName && (
                    <div className="flex justify-center">
                      <Badge variant="secondary" className="text-xs">
                        {playerName.length}/20文字
                      </Badge>
                    </div>
                  )}
                </div>

                {playerName.trim() && (
                  <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="border-t pt-4">
                      <GameLobby
                        room={null}
                        playerId={null}
                        playerName={playerName}
                        onJoinRoom={joinRoom}
                        onStartGame={() => {}}
                        onLeave={() => {}}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                      />
                    </div>
                  </div>
                )}

                {!playerName.trim() && (
                  <div className="text-center text-sm text-muted-foreground">プレイヤー名を入力してゲームを開始</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 操作説明 */}
          <div className="mt-12 text-center">
            <Card className="max-w-2xl mx-auto bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">操作方法</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white/90">
                  <div className="text-center">
                    <div className="bg-white/20 rounded-lg p-3 mb-2">
                      <kbd className="text-sm font-mono">←</kbd>
                    </div>
                    <p className="text-xs">左移動</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-white/20 rounded-lg p-3 mb-2">
                      <kbd className="text-sm font-mono">→</kbd>
                    </div>
                    <p className="text-xs">右移動</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-white/20 rounded-lg p-3 mb-2">
                      <kbd className="text-sm font-mono">↓</kbd>
                    </div>
                    <p className="text-xs">高速落下</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-white/20 rounded-lg p-3 mb-2">
                      <kbd className="text-sm font-mono">↑</kbd>
                    </div>
                    <p className="text-xs">回転</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
