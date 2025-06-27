import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type GameRoom = {
  id: string
  name: string
  status: "waiting" | "playing" | "finished"
  max_players: number
  current_players: number
  custom_rule_id?: string
  created_at: string
  updated_at: string
}

export type Player = {
  id: string
  room_id: string
  player_name: string
  player_number: number
  score: number
  level: number
  lines_cleared: number
  is_alive: boolean
  board_state: number[][]
  current_piece: any
  created_at: string
  updated_at: string
}

export type GameState = {
  id: string
  room_id: string
  winner_id?: string
  game_data: any
  created_at: string
  updated_at: string
}

export type PlayerStats = {
  id: string
  player_name: string
  total_games: number
  wins: number
  losses: number
  total_score: number
  highest_score: number
  total_lines_cleared: number
  highest_level: number
  total_tetrises: number
  average_game_duration: number
  win_rate: number
  fastest_tetris?: number
  longest_game: number
  created_at: string
  updated_at: string
}

export type GameHistory = {
  id: string
  room_id: string
  player_name: string
  final_score: number
  final_level: number
  lines_cleared: number
  tetrises: number
  game_duration: number
  placement: number
  is_winner: boolean
  surrendered: boolean
  created_at: string
}

export type PlayerAchievement = {
  id: string
  player_name: string
  achievement_type: string
  achievement_name: string
  description: string
  achieved_at: string
  game_id?: string
}

export type CustomRule = {
  id: string
  room_id?: string
  rule_name: string
  initial_drop_time: number
  level_speed_increase: number
  soft_drop_multiplier: number
  lines_per_level: number
  max_level: number
  ghost_piece_enabled: boolean
  hold_piece_enabled: boolean
  single_line_score: number
  double_line_score: number
  triple_line_score: number
  tetris_score: number
  soft_drop_score: number
  hard_drop_score: number
  garbage_lines_enabled: boolean
  time_limit?: number
  sudden_death_enabled: boolean
  created_at: string
  updated_at: string
}
