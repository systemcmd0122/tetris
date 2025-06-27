"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { supabase, type GameRoom, type Player, type CustomRule } from "@/lib/supabase"
import { Users, Play, Plus, Clock, Gamepad2, ArrowLeft, Loader2, Settings } from "lucide-react"
import { toast } from "sonner"
import CustomRuleSettings from "@/components/CustomRuleSettings"

interface GameLobbyProps {
  room: GameRoom | null
  playerId: string | null
  playerName: string
  onJoinRoom?: (room: GameRoom, playerId: string) => void
  onStartGame: () => void
  onLeave: () => void
  isLoading?: boolean
  setIsLoading?: (loading: boolean) => void
}

export default function GameLobby({
  room,
  playerId,
  playerName,
  onJoinRoom,
  onStartGame,
  onLeave,
  isLoading = false,
  setIsLoading,
}: GameLobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [newRoomName, setNewRoomName] = useState("")
  const [localLoading, setLocalLoading] = useState(false)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [showCustomRules, setShowCustomRules] = useState(false)
  const [selectedRule, setSelectedRule] = useState<CustomRule | null>(null)

  const loading = isLoading || localLoading

  useEffect(() => {
    if (!room) {
      fetchRooms()
      const roomsSubscription = supabase
        .channel("game_rooms_lobby")
        .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms" }, () => {
          fetchRooms()
        })
        .subscribe()

      return () => {
        roomsSubscription.unsubscribe()
      }
    } else {
      fetchPlayers()
      const playersSubscription = supabase
        .channel("players_lobby")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
          () => {
            fetchPlayers()
          },
        )
        .subscribe()

      const roomSubscription = supabase
        .channel("room_status_lobby")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${room.id}` },
          (payload) => {
            if (payload.new.status === "playing") {
              onStartGame()
            }
          },
        )
        .subscribe()

      return () => {
        playersSubscription.unsubscribe()
        roomSubscription.unsubscribe()
      }
    }
  }, [room])

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: false })

      if (error) {
        // If the table/schema isn’t there yet, surface a helpful message
        if (error.message.includes("does not exist")) {
          setSchemaMissing(true)
          console.warn(
            "Database schema is missing. Run the SQL script in scripts/01-create-tables.sql on your Supabase project.",
          )
          return
        }
        throw error
      }

      setRooms(data ?? [])
      setSchemaMissing(false)
    } catch (err) {
      console.error("Error fetching rooms:", err)
      toast.error("ルーム一覧の取得に失敗しました")
    }
  }

  const fetchPlayers = async () => {
    if (!room) return

    try {
      const { data, error } = await supabase.from("players").select("*").eq("room_id", room.id).order("player_number")

      if (error) throw error
      if (data) setPlayers(data)
    } catch (error) {
      console.error("Error fetching players:", error)
      toast.error("プレイヤー情報の取得に失敗しました")
    }
  }

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("ルーム名を入力してください")
      return
    }

    setLocalLoading(true)
    try {
      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .insert({
          name: newRoomName.trim(),
          current_players: 1,
          custom_rule_id: selectedRule?.id,
        })
        .select()
        .single()

      if (roomError) throw roomError

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: roomData.id,
          player_name: playerName,
          player_number: 1,
          board_state: Array.from({ length: 20 }, () => Array(10).fill(0)),
        })
        .select()
        .single()

      if (playerError) throw playerError

      if (onJoinRoom) {
        onJoinRoom(roomData, playerData.id)
      }
      toast.success("ルームを作成しました")
    } catch (error) {
      console.error("Error creating room:", error)
      toast.error("ルームの作成に失敗しました")
    } finally {
      setLocalLoading(false)
    }
  }

  const joinRoom = async (roomToJoin: GameRoom) => {
    if (roomToJoin.current_players >= roomToJoin.max_players) {
      toast.error("ルームが満員です")
      return
    }

    setLocalLoading(true)
    try {
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: roomToJoin.id,
          player_name: playerName,
          player_number: roomToJoin.current_players + 1,
          board_state: Array.from({ length: 20 }, () => Array(10).fill(0)),
        })
        .select()
        .single()

      if (playerError) throw playerError

      const { error: updateError } = await supabase
        .from("game_rooms")
        .update({ current_players: roomToJoin.current_players + 1 })
        .eq("id", roomToJoin.id)

      if (updateError) throw updateError

      if (onJoinRoom) {
        onJoinRoom(roomToJoin, playerData.id)
      }
      toast.success("ルームに参加しました")
    } catch (error) {
      console.error("Error joining room:", error)
      toast.error("ルームへの参加に失敗しました")
    } finally {
      setLocalLoading(false)
    }
  }

  const startGameForRoom = async () => {
    if (!room || players.length < 2) {
      toast.error("ゲームを開始するには2人のプレイヤーが必要です")
      return
    }

    setLocalLoading(true)
    try {
      const { error } = await supabase.from("game_rooms").update({ status: "playing" }).eq("id", room.id)

      if (error) throw error
      toast.success("ゲームを開始します！")
    } catch (error) {
      console.error("Error starting game:", error)
      toast.error("ゲームの開始に失敗しました")
    } finally {
      setLocalLoading(false)
    }
  }

  const leaveRoom = async () => {
    if (!room || !playerId) return

    setLocalLoading(true)
    try {
      const { error: deleteError } = await supabase.from("players").delete().eq("id", playerId)

      if (deleteError) throw deleteError

      const { error: updateError } = await supabase
        .from("game_rooms")
        .update({ current_players: Math.max(0, room.current_players - 1) })
        .eq("id", room.id)

      if (updateError) throw updateError

      onLeave()
      toast.success("ルームから退出しました")
    } catch (error) {
      console.error("Error leaving room:", error)
      toast.error("ルームからの退出に失敗しました")
    } finally {
      setLocalLoading(false)
    }
  }

  if (!room) {
    return (
      <div className="space-y-6">
        {schemaMissing && (
          <Card className="border-dashed border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 mb-6">
            <CardContent className="py-4 text-center space-y-2">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                Supabase に必須テーブルが見つかりません。
              </p>
              <p className="text-sm text-yellow-800/80 dark:text-yellow-200/80">
                scripts/01-create-tables.sql を Supabase SQL Editor で実行してから 再読み込みしてください。
              </p>
            </CardContent>
          </Card>
        )}
        {/* ルーム作成 */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            新しいルームを作成
          </h3>
          <div className="flex gap-2">
            <Input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="ルーム名を入力"
              className="flex-1"
              maxLength={30}
              onKeyPress={(e) => e.key === "Enter" && createRoom()}
            />
            <Button onClick={() => setShowCustomRules(true)} variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button onClick={createRoom} disabled={loading || !newRoomName.trim()} className="min-w-[80px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "作成"}
            </Button>
          </div>
          {selectedRule && <div className="text-xs text-muted-foreground">ルール: {selectedRule.rule_name}</div>}
        </div>
        {showCustomRules && (
          <CustomRuleSettings
            onRuleSelect={(rule) => {
              setSelectedRule(rule)
              setShowCustomRules(false)
              toast.success(`${rule.rule_name} を選択しました`)
            }}
            onClose={() => setShowCustomRules(false)}
            initialRule={selectedRule || undefined}
          />
        )}

        <Separator />

        {/* ルーム一覧 */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" />
            利用可能なルーム
          </h3>

          {rooms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">利用可能なルームがありません</p>
                <p className="text-sm text-muted-foreground">新しいルームを作成してゲームを始めましょう！</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rooms.map((gameRoom) => (
                <Card key={gameRoom.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{gameRoom.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {gameRoom.status === "waiting" ? "待機中" : "プレイ中"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {gameRoom.current_players}/{gameRoom.max_players}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(gameRoom.created_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => joinRoom(gameRoom)}
                        disabled={loading || gameRoom.current_players >= gameRoom.max_players}
                        size="sm"
                        className="min-w-[60px]"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "参加"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 dark:from-purple-900 dark:via-blue-900 dark:to-cyan-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {room.name}
          </CardTitle>
          <Badge variant="outline" className="mx-auto">
            ルームID: {room.id.slice(0, 8)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* プレイヤー一覧 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              プレイヤー ({players.length}/{room.max_players})
            </h3>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-3 rounded-lg transition-colors ${
                    player.id === playerId ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${index === 0 ? "bg-blue-500" : "bg-green-500"}`} />
                    <span className="font-medium">{player.player_name}</span>
                    {player.id === playerId && (
                      <Badge variant="secondary" className="text-xs">
                        あなた
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    プレイヤー {player.player_number}
                  </Badge>
                </div>
              ))}

              {/* 空きスロット */}
              {Array.from({ length: room.max_players - players.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border-2 border-dashed border-muted-foreground/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                    <span className="text-muted-foreground">待機中...</span>
                  </div>
                  <Badge variant="outline" className="text-xs opacity-50">
                    プレイヤー {players.length + index + 1}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* アクションボタン */}
          <div className="flex gap-3">
            <Button onClick={leaveRoom} variant="outline" className="flex-1" disabled={loading}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              退出
            </Button>
            <Button onClick={startGameForRoom} disabled={players.length < 2 || loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              ゲーム開始
            </Button>
          </div>

          {/* 状態メッセージ */}
          {players.length < 2 && (
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ゲームを開始するには2人のプレイヤーが必要です
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
