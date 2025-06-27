"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion, AnimatePresence } from "framer-motion"
import { supabase, type CustomRule } from "@/lib/supabase"
import {
  Settings,
  Zap,
  Trophy,
  Gamepad2,
  X,
  Star,
  Gauge,
  Clock,
  Target,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

interface CustomRuleSettingsProps {
  onRuleSelect: (rule: CustomRule) => void
  onClose: () => void
  initialRule?: CustomRule
}

const defaultRule: Omit<CustomRule, "id" | "created_at" | "updated_at"> = {
  room_id: undefined,
  rule_name: "カスタム",
  initial_drop_time: 1000,
  level_speed_increase: 0.9,
  soft_drop_multiplier: 0.05,
  lines_per_level: 10,
  max_level: 30,
  ghost_piece_enabled: true,
  hold_piece_enabled: false,
  single_line_score: 40,
  double_line_score: 100,
  triple_line_score: 300,
  tetris_score: 1200,
  soft_drop_score: 1,
  hard_drop_score: 2,
  garbage_lines_enabled: false,
  time_limit: undefined,
  sudden_death_enabled: false,
}

const presetInfo = {
  Standard: {
    icon: "⚖️",
    color: "from-blue-500 to-blue-600",
    description: "バランスの取れた標準ルール",
    difficulty: "普通",
  },
  Speed: {
    icon: "⚡",
    color: "from-yellow-500 to-orange-500",
    description: "高速落下で素早い判断が必要",
    difficulty: "難しい",
  },
  Marathon: {
    icon: "🏃",
    color: "from-green-500 to-green-600",
    description: "長時間プレイ向けの耐久ルール",
    difficulty: "普通",
  },
  Blitz: { icon: "💨", color: "from-red-500 to-red-600", description: "超高速で瞬発力を試す", difficulty: "超難しい" },
  Classic: {
    icon: "🎮",
    color: "from-purple-500 to-purple-600",
    description: "昔ながらのシンプルなルール",
    difficulty: "簡単",
  },
}

export default function CustomRuleSettings({ onRuleSelect, onClose, initialRule }: CustomRuleSettingsProps) {
  const [dbPresetRules, setDbPresetRules] = useState<CustomRule[]>([])
  const [currentRule, setCurrentRule] = useState<Omit<CustomRule, "id" | "created_at" | "updated_at">>(
    initialRule || defaultRule,
  )
  const [loading, setLoading] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>("")
  const [step, setStep] = useState<"presets" | "custom">("presets")

  useEffect(() => {
    fetchPresetRules()
  }, [])

  const fetchPresetRules = async () => {
    try {
      const { data, error } = await supabase.from("custom_rules").select("*").is("room_id", null).order("rule_name")

      if (error) throw error
      if (data) setDbPresetRules(data)
    } catch (error) {
      console.error("Error fetching preset rules:", error)
      toast.error("プリセットルールの取得に失敗しました")
    }
  }

  const handlePresetSelect = (preset: CustomRule) => {
    setCurrentRule({
      room_id: preset.room_id,
      rule_name: preset.rule_name,
      initial_drop_time: preset.initial_drop_time,
      level_speed_increase: preset.level_speed_increase,
      soft_drop_multiplier: preset.soft_drop_multiplier,
      lines_per_level: preset.lines_per_level,
      max_level: preset.max_level,
      ghost_piece_enabled: preset.ghost_piece_enabled,
      hold_piece_enabled: preset.hold_piece_enabled,
      single_line_score: preset.single_line_score,
      double_line_score: preset.double_line_score,
      triple_line_score: preset.triple_line_score,
      tetris_score: preset.tetris_score,
      soft_drop_score: preset.soft_drop_score,
      hard_drop_score: preset.hard_drop_score,
      garbage_lines_enabled: preset.garbage_lines_enabled,
      time_limit: preset.time_limit,
      sudden_death_enabled: preset.sudden_death_enabled,
    })
    setSelectedPreset(preset.id)
  }

  const handleApplyRule = () => {
    const ruleWithId: CustomRule = {
      ...currentRule,
      id: selectedPreset || "custom",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onRuleSelect(ruleWithId)
    toast.success(`${currentRule.rule_name} を適用しました`)
  }

  const getDifficultyInfo = () => {
    const speedFactor = 1000 / currentRule.initial_drop_time
    const levelFactor = currentRule.lines_per_level / 10
    const difficulty = speedFactor * (2 - currentRule.level_speed_increase) * levelFactor

    if (difficulty < 0.8)
      return { label: "簡単", color: "bg-green-500", textColor: "text-green-700", bgColor: "bg-green-50" }
    if (difficulty < 1.2)
      return { label: "普通", color: "bg-blue-500", textColor: "text-blue-700", bgColor: "bg-blue-50" }
    if (difficulty < 1.8)
      return { label: "難しい", color: "bg-orange-500", textColor: "text-orange-700", bgColor: "bg-orange-50" }
    return { label: "超難しい", color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50" }
  }

  const getEstimatedTime = () => {
    const avgLinesPerMinute = 20
    const totalLines = currentRule.max_level * currentRule.lines_per_level
    return Math.round(totalLines / avgLinesPerMinute)
  }

  const resetToDefault = () => {
    setCurrentRule(defaultRule)
    setSelectedPreset("")
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* 固定ヘッダー */}
        <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">ゲームルール設定</h2>
                <p className="text-purple-100">お好みのルールでテトリスを楽しもう</p>
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/20 rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center gap-3 mt-4">
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                step === "presets" ? "bg-white/20 text-white" : "bg-white/10 text-white/70"
              }`}
              whileHover={{ scale: 1.05 }}
            >
              <Star className="w-4 h-4" />
              <span>プリセット選択</span>
            </motion.div>
            <ArrowRight className="w-4 h-4 text-white/70" />
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                step === "custom" ? "bg-white/20 text-white" : "bg-white/10 text-white/70"
              }`}
              whileHover={{ scale: 1.05 }}
            >
              <Settings className="w-4 h-4" />
              <span>カスタム設定</span>
            </motion.div>
          </div>
        </div>

        {/* スクロール可能なコンテンツ */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === "presets" && (
                <motion.div
                  key="presets"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">プリセットルールを選択</h3>
                    <p className="text-muted-foreground">用意されたルールから選択してください</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dbPresetRules.map((rule) => {
                      const preset = presetInfo[rule.rule_name as keyof typeof presetInfo] || presetInfo.Standard
                      const isSelected = selectedPreset === rule.id

                      return (
                        <motion.div
                          key={rule.id}
                          className={`relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary shadow-lg scale-[1.02]"
                              : "border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:shadow-md"
                          }`}
                          onClick={() => handlePresetSelect(rule)}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* 背景グラデーション */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${preset.color} opacity-5`} />

                          {/* 選択インジケーター */}
                          {isSelected && (
                            <motion.div
                              className="absolute top-3 right-3 p-1.5 bg-primary text-primary-foreground rounded-full"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </motion.div>
                          )}

                          <div className="relative p-5">
                            {/* アイコンとタイトル */}
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className={`text-2xl p-2 rounded-lg bg-gradient-to-br ${preset.color} text-white shadow-sm`}
                              >
                                {preset.icon}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg">{rule.rule_name}</h4>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    preset.difficulty === "簡単"
                                      ? "border-green-500 text-green-700"
                                      : preset.difficulty === "普通"
                                        ? "border-blue-500 text-blue-700"
                                        : preset.difficulty === "難しい"
                                          ? "border-orange-500 text-orange-700"
                                          : "border-red-500 text-red-700"
                                  }`}
                                >
                                  {preset.difficulty}
                                </Badge>
                              </div>
                            </div>

                            {/* 説明 */}
                            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{preset.description}</p>

                            {/* 設定詳細 */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <span className="text-muted-foreground">初期速度</span>
                                <span className="font-medium">{rule.initial_drop_time}ms</span>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <span className="text-muted-foreground">レベルアップ</span>
                                <span className="font-medium">{rule.lines_per_level}ライン</span>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <span className="text-muted-foreground">最大レベル</span>
                                <span className="font-medium">{rule.max_level}</span>
                              </div>
                              <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <span className="text-muted-foreground">特殊機能</span>
                                <div className="flex gap-1">
                                  {rule.hold_piece_enabled && (
                                    <Badge variant="secondary" className="text-xs px-1 py-0">
                                      H
                                    </Badge>
                                  )}
                                  {rule.ghost_piece_enabled && (
                                    <Badge variant="secondary" className="text-xs px-1 py-0">
                                      G
                                    </Badge>
                                  )}
                                  {rule.garbage_lines_enabled && (
                                    <Badge variant="secondary" className="text-xs px-1 py-0">
                                      A
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {step === "custom" && (
                <motion.div
                  key="custom"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">カスタム設定</h3>
                      <p className="text-muted-foreground">詳細な設定を調整してオリジナルルールを作成</p>
                    </div>
                    <Button onClick={() => setStep("presets")} variant="outline" size="sm">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      戻る
                    </Button>
                  </div>

                  {/* 現在の設定概要 */}
                  <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          現在の設定概要
                        </h4>
                        <div className="flex items-center gap-2">
                          <div
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyInfo().bgColor} ${getDifficultyInfo().textColor}`}
                          >
                            {getDifficultyInfo().label}
                          </div>
                          <div className="text-xs text-muted-foreground">推定: {getEstimatedTime()}分</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
                          <div className="text-lg font-bold text-blue-600">{currentRule.initial_drop_time}ms</div>
                          <div className="text-xs text-muted-foreground">初期速度</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
                          <div className="text-lg font-bold text-green-600">{currentRule.lines_per_level}</div>
                          <div className="text-xs text-muted-foreground">レベルアップ</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
                          <div className="text-lg font-bold text-purple-600">{currentRule.max_level}</div>
                          <div className="text-xs text-muted-foreground">最大レベル</div>
                        </div>
                        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
                          <div className="text-lg font-bold text-orange-600">{currentRule.tetris_score}</div>
                          <div className="text-xs text-muted-foreground">テトリス</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 速度設定 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Gauge className="w-4 h-4 text-blue-600" />
                          速度設定
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm">初期落下時間</Label>
                            <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {currentRule.initial_drop_time}ms
                            </div>
                          </div>
                          <Slider
                            value={[currentRule.initial_drop_time]}
                            onValueChange={([value]) => setCurrentRule({ ...currentRule, initial_drop_time: value })}
                            min={100}
                            max={2000}
                            step={50}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>超高速</span>
                            <span>超低速</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm">レベルアップ時加速率</Label>
                            <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {currentRule.level_speed_increase.toFixed(2)}
                            </div>
                          </div>
                          <Slider
                            value={[currentRule.level_speed_increase]}
                            onValueChange={([value]) => setCurrentRule({ ...currentRule, level_speed_increase: value })}
                            min={0.7}
                            max={0.98}
                            step={0.01}
                            className="w-full"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* ゲームルール */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Gamepad2 className="w-4 h-4 text-green-600" />
                          ゲームルール
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">レベルアップライン数</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[currentRule.lines_per_level]}
                                onValueChange={([value]) => setCurrentRule({ ...currentRule, lines_per_level: value })}
                                min={5}
                                max={30}
                                step={1}
                                className="flex-1"
                              />
                              <div className="text-sm font-mono bg-muted px-2 py-1 rounded w-10 text-center">
                                {currentRule.lines_per_level}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">最大レベル</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[currentRule.max_level]}
                                onValueChange={([value]) => setCurrentRule({ ...currentRule, max_level: value })}
                                min={10}
                                max={100}
                                step={5}
                                className="flex-1"
                              />
                              <div className="text-sm font-mono bg-muted px-2 py-1 rounded w-10 text-center">
                                {currentRule.max_level}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-blue-600" />
                              <div>
                                <Label className="text-sm">ゴーストピース</Label>
                                <p className="text-xs text-muted-foreground">落下予定位置を表示</p>
                              </div>
                            </div>
                            <Switch
                              checked={currentRule.ghost_piece_enabled}
                              onCheckedChange={(checked) =>
                                setCurrentRule({ ...currentRule, ghost_piece_enabled: checked })
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <Gamepad2 className="w-4 h-4 text-purple-600" />
                              <div>
                                <Label className="text-sm">ホールド機能</Label>
                                <p className="text-xs text-muted-foreground">ピースを一時保存</p>
                              </div>
                            </div>
                            <Switch
                              checked={currentRule.hold_piece_enabled}
                              onCheckedChange={(checked) =>
                                setCurrentRule({ ...currentRule, hold_piece_enabled: checked })
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* スコア設定 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Trophy className="w-4 h-4 text-yellow-600" />
                          スコア設定
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "single_line_score", label: "1ライン", color: "bg-blue-500" },
                            { key: "double_line_score", label: "2ライン", color: "bg-green-500" },
                            { key: "triple_line_score", label: "3ライン", color: "bg-orange-500" },
                            { key: "tetris_score", label: "テトリス", color: "bg-red-500" },
                          ].map((item) => (
                            <div key={item.key} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 ${item.color} rounded`} />
                                <Label className="text-xs">{item.label}</Label>
                              </div>
                              <Input
                                type="number"
                                value={currentRule[item.key as keyof typeof currentRule] as number}
                                onChange={(e) =>
                                  setCurrentRule({
                                    ...currentRule,
                                    [item.key]: Number.parseInt(e.target.value) || 0,
                                  })
                                }
                                min="0"
                                step="10"
                                className="text-center text-sm h-8"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 特殊設定 */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Zap className="w-4 h-4 text-orange-600" />
                          特殊設定
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-red-600" />
                            <div>
                              <Label className="text-sm">ガベージライン攻撃</Label>
                              <p className="text-xs text-muted-foreground">相手にガベージラインを送る</p>
                            </div>
                          </div>
                          <Switch
                            checked={currentRule.garbage_lines_enabled}
                            onCheckedChange={(checked) =>
                              setCurrentRule({ ...currentRule, garbage_lines_enabled: checked })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            制限時間 (秒)
                          </Label>
                          <Input
                            type="number"
                            value={currentRule.time_limit || ""}
                            onChange={(e) =>
                              setCurrentRule({
                                ...currentRule,
                                time_limit: e.target.value ? Number.parseInt(e.target.value) : undefined,
                              })
                            }
                            placeholder="制限なし"
                            min="60"
                            max="3600"
                            className="text-sm h-8"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* 固定フッター */}
        <div className="border-t p-4 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          {step === "presets" ? (
            <div className="flex justify-center gap-3">
              <Button onClick={() => setStep("custom")} variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                カスタム設定
              </Button>
              <Button onClick={handleApplyRule} disabled={!selectedPreset} size="default">
                <CheckCircle className="w-4 h-4 mr-2" />
                このルールを適用
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rule-name" className="text-sm">
                    ルール名
                  </Label>
                  <Input
                    id="rule-name"
                    value={currentRule.rule_name}
                    onChange={(e) => setCurrentRule({ ...currentRule, rule_name: e.target.value })}
                    className="w-40 h-8"
                    placeholder="カスタムルール"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getDifficultyInfo().color}`} />
                    {getDifficultyInfo().label} • {getEstimatedTime()}分
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={resetToDefault} variant="outline" size="sm" disabled={loading}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  リセット
                </Button>
                <Button onClick={handleApplyRule} disabled={loading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  適用
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
