"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { motion, AnimatePresence } from "framer-motion"
import { supabase, type PlayerStats, type GameHistory, type PlayerAchievement } from "@/lib/supabase"
import { Trophy, Target, Zap, Clock, TrendingUp, Award, Medal, Crown, Star, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface LeaderboardProps {
  currentPlayer?: string
}

export default function Leaderboard({ currentPlayer }: LeaderboardProps) {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([])
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchStats(), fetchGameHistory(), fetchAchievements()])
    } catch (error) {
      console.error("Error fetching leaderboard data:", error)
      toast.error("データの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from("player_stats")
      .select("*")
      .order("highest_score", { ascending: false })
      .limit(100)

    if (error) throw error
    if (data) setStats(data)
  }

  const fetchGameHistory = async () => {
    const { data, error } = await supabase
      .from("game_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error
    if (data) setGameHistory(data)
  }

  const fetchAchievements = async () => {
    const { data, error } = await supabase
      .from("player_achievements")
      .select("*")
      .order("achieved_at", { ascending: false })
      .limit(50)

    if (error) throw error
    if (data) setAchievements(data)
  }

  const getPlayerRank = (playerName: string, category: keyof PlayerStats) => {
    const sortedStats = [...stats].sort((a, b) => {
      const aValue = typeof a[category] === "number" ? a[category] : 0
      const bValue = typeof b[category] === "number" ? b[category] : 0
      return (bValue as number) - (aValue as number)
    })
    return sortedStats.findIndex((stat) => stat.player_name === playerName) + 1
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600"
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500"
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600"
      default:
        return "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"
    }
  }

  const PlayerCard = ({ stat, rank }: { stat: PlayerStats; rank: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className={`relative overflow-hidden rounded-lg ${getRankColor(rank)} p-0.5`}
    >
      <Card className="bg-white dark:bg-gray-900 h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">{getRankIcon(rank)}</div>
              <div>
                <h3 className="font-semibold text-lg">{stat.player_name}</h3>
                {stat.player_name === currentPlayer && (
                  <Badge variant="secondary" className="text-xs">
                    あなた
                  </Badge>
                )}
              </div>
            </div>
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {stat.player_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">最高得点:</span>
                <span className="font-semibold">{stat.highest_score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">勝率:</span>
                <span className="font-semibold">{stat.win_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">試合数:</span>
                <span className="font-semibold">{stat.total_games}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">最高レベル:</span>
                <span className="font-semibold">{stat.highest_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">テトリス:</span>
                <span className="font-semibold">{stat.total_tetrises}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">平均時間:</span>
                <span className="font-semibold">{formatDuration(stat.average_game_duration)}</span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => setSelectedPlayer(stat.player_name)}
          >
            詳細を見る
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )

  const CategoryLeaderboard = ({
    title,
    category,
    icon,
    formatter = (value: number) => value.toLocaleString(),
  }: {
    title: string
    category: keyof PlayerStats
    icon: React.ReactNode
    formatter?: (value: number) => string
  }) => {
    const sortedStats = [...stats]
      .filter((stat) => typeof stat[category] === "number" && (stat[category] as number) > 0)
      .sort((a, b) => {
        const aValue = typeof a[category] === "number" ? a[category] : 0
        const bValue = typeof b[category] === "number" ? b[category] : 0
        return (bValue as number) - (aValue as number)
      })
      .slice(0, 10)

    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          {icon}
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedStats.map((stat, index) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center justify-between p-2 rounded-lg ${
                stat.player_name === currentPlayer ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8">{getRankIcon(index + 1)}</div>
                <div>
                  <div className="font-medium">{stat.player_name}</div>
                  {stat.player_name === currentPlayer && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      あなた
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{formatter(stat[category] as number)}</div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          リーダーボード
        </h2>
        <Button onClick={fetchAllData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          更新
        </Button>
      </div>

      <Tabs defaultValue="overall" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overall">総合</TabsTrigger>
          <TabsTrigger value="categories">カテゴリ別</TabsTrigger>
          <TabsTrigger value="recent">最近の試合</TabsTrigger>
          <TabsTrigger value="achievements">実績</TabsTrigger>
        </TabsList>

        <TabsContent value="overall" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.slice(0, 12).map((stat, index) => (
              <PlayerCard key={stat.id} stat={stat} rank={index + 1} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryLeaderboard
              title="最高得点"
              category="highest_score"
              icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            />
            <CategoryLeaderboard
              title="勝率"
              category="win_rate"
              icon={<Target className="w-5 h-5 text-green-500" />}
              formatter={(value) => `${value.toFixed(1)}%`}
            />
            <CategoryLeaderboard
              title="テトリス数"
              category="total_tetrises"
              icon={<Zap className="w-5 h-5 text-blue-500" />}
            />
            <CategoryLeaderboard
              title="最高レベル"
              category="highest_level"
              icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                最近の試合結果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gameHistory.slice(0, 20).map((game, index) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      game.player_name === currentPlayer ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {game.is_winner ? (
                          <Trophy className="w-4 h-4 text-yellow-500" />
                        ) : game.surrendered ? (
                          <span className="text-xs text-red-500">降参</span>
                        ) : (
                          <span className="text-xs text-gray-500">敗北</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{game.player_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(game.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{game.final_score.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        レベル {game.final_level} • {formatDuration(game.game_duration)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                最新の実績
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievements.slice(0, 20).map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      achievement.player_name === currentPlayer
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-muted/30"
                    }`}
                  >
                    <Award className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{achievement.player_name}</div>
                      <div className="text-sm text-muted-foreground">{achievement.achievement_name}</div>
                      <div className="text-xs text-muted-foreground">{achievement.description}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(achievement.achieved_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* プレイヤー詳細モーダル */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPlayer(null)}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const playerStat = stats.find((s) => s.player_name === selectedPlayer)
                const playerHistory = gameHistory.filter((g) => g.player_name === selectedPlayer)
                const playerAchievements = achievements.filter((a) => a.player_name === selectedPlayer)

                return playerStat ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Avatar className="w-20 h-20 mx-auto mb-4">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                          {playerStat.player_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="text-2xl font-bold">{playerStat.player_name}</h3>
                      {playerStat.player_name === currentPlayer && (
                        <Badge variant="secondary" className="mt-2">
                          あなたのプロフィール
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{playerStat.total_games}</div>
                        <div className="text-sm text-muted-foreground">総試合数</div>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{playerStat.wins}</div>
                        <div className="text-sm text-muted-foreground">勝利数</div>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{playerStat.losses}</div>
                        <div className="text-sm text-muted-foreground">敗北数</div>
                      </div>
                      <div className="text-center p-3 bg-muted/30 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{playerStat.win_rate.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">勝率</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">詳細統計</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>最高得点:</span>
                            <span className="font-semibold">{playerStat.highest_score.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>総得点:</span>
                            <span className="font-semibold">{playerStat.total_score.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>最高レベル:</span>
                            <span className="font-semibold">{playerStat.highest_level}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>総ライン消去:</span>
                            <span className="font-semibold">{playerStat.total_lines_cleared.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>テトリス数:</span>
                            <span className="font-semibold">{playerStat.total_tetrises}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>平均ゲーム時間:</span>
                            <span className="font-semibold">{formatDuration(playerStat.average_game_duration)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>最長ゲーム:</span>
                            <span className="font-semibold">{formatDuration(playerStat.longest_game)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">ランキング</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span>最高得点:</span>
                            <div className="flex items-center gap-2">
                              {getRankIcon(getPlayerRank(playerStat.player_name, "highest_score"))}
                              <span className="font-semibold">
                                #{getPlayerRank(playerStat.player_name, "highest_score")}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>勝率:</span>
                            <div className="flex items-center gap-2">
                              {getRankIcon(getPlayerRank(playerStat.player_name, "win_rate"))}
                              <span className="font-semibold">
                                #{getPlayerRank(playerStat.player_name, "win_rate")}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>テトリス数:</span>
                            <div className="flex items-center gap-2">
                              {getRankIcon(getPlayerRank(playerStat.player_name, "total_tetrises"))}
                              <span className="font-semibold">
                                #{getPlayerRank(playerStat.player_name, "total_tetrises")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {playerHistory.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">最近の試合履歴</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {playerHistory.slice(0, 10).map((game) => (
                            <div
                              key={game.id}
                              className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {game.is_winner ? (
                                  <Trophy className="w-4 h-4 text-yellow-500" />
                                ) : (
                                  <span className="text-xs text-gray-500">敗北</span>
                                )}
                                <span>{new Date(game.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{game.final_score.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">Lv.{game.final_level}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {playerAchievements.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">獲得した実績</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {playerAchievements.map((achievement) => (
                            <div
                              key={achievement.id}
                              className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm"
                            >
                              <Award className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium">{achievement.achievement_name}</div>
                                <div className="text-xs text-muted-foreground">{achievement.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={() => setSelectedPlayer(null)}>閉じる</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p>プレイヤー情報が見つかりません</p>
                    <Button onClick={() => setSelectedPlayer(null)} className="mt-4">
                      閉じる
                    </Button>
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
