-- プレイヤー統計テーブル
CREATE TABLE player_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL UNIQUE,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  total_lines_cleared INTEGER DEFAULT 0,
  highest_level INTEGER DEFAULT 1,
  total_tetrises INTEGER DEFAULT 0,
  average_game_duration DECIMAL DEFAULT 0,
  win_rate DECIMAL DEFAULT 0,
  fastest_tetris DECIMAL DEFAULT NULL,
  longest_game DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ゲーム履歴テーブル
CREATE TABLE game_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  final_score INTEGER DEFAULT 0,
  final_level INTEGER DEFAULT 1,
  lines_cleared INTEGER DEFAULT 0,
  tetrises INTEGER DEFAULT 0,
  game_duration DECIMAL DEFAULT 0,
  placement INTEGER DEFAULT 1, -- 1位、2位など
  is_winner BOOLEAN DEFAULT false,
  surrendered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プレイヤーアチーブメントテーブル
CREATE TABLE player_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  game_id UUID REFERENCES game_history(id),
  UNIQUE(player_name, achievement_type, achievement_name)
);

-- 統計更新トリガー
CREATE TRIGGER update_player_stats_updated_at 
BEFORE UPDATE ON player_stats 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) の有効化
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（すべてのユーザーが読み書き可能）
CREATE POLICY "Enable read access for all users" ON player_stats FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON player_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON player_stats FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON player_stats FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON game_history FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON game_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON game_history FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON game_history FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON player_achievements FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON player_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON player_achievements FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON player_achievements FOR DELETE USING (true);

-- 統計更新用のストアドプロシージャ
CREATE OR REPLACE FUNCTION update_player_statistics(
  p_player_name TEXT,
  p_final_score INTEGER,
  p_final_level INTEGER,
  p_lines_cleared INTEGER,
  p_tetrises INTEGER,
  p_game_duration DECIMAL,
  p_is_winner BOOLEAN,
  p_surrendered BOOLEAN DEFAULT false
) RETURNS VOID AS $$
DECLARE
  v_total_games INTEGER;
  v_total_score BIGINT;
  v_total_duration DECIMAL;
BEGIN
  -- 統計レコードを挿入または更新
  INSERT INTO player_stats (
    player_name, 
    total_games, 
    wins, 
    losses, 
    total_score, 
    highest_score,
    total_lines_cleared,
    highest_level,
    total_tetrises,
    average_game_duration,
    longest_game
  )
  VALUES (
    p_player_name, 
    1, 
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    CASE WHEN p_is_winner THEN 0 ELSE 1 END,
    p_final_score,
    p_final_score,
    p_lines_cleared,
    p_final_level,
    p_tetrises,
    p_game_duration,
    p_game_duration
  )
  ON CONFLICT (player_name) DO UPDATE SET
    total_games = player_stats.total_games + 1,
    wins = player_stats.wins + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    losses = player_stats.losses + CASE WHEN p_is_winner THEN 0 ELSE 1 END,
    total_score = player_stats.total_score + p_final_score,
    highest_score = GREATEST(player_stats.highest_score, p_final_score),
    total_lines_cleared = player_stats.total_lines_cleared + p_lines_cleared,
    highest_level = GREATEST(player_stats.highest_level, p_final_level),
    total_tetrises = player_stats.total_tetrises + p_tetrises,
    longest_game = GREATEST(player_stats.longest_game, p_game_duration),
    updated_at = NOW();

  -- 平均ゲーム時間と勝率を更新
  SELECT total_games, total_score INTO v_total_games, v_total_score
  FROM player_stats WHERE player_name = p_player_name;

  SELECT AVG(game_duration) INTO v_total_duration
  FROM game_history WHERE player_name = p_player_name;

  UPDATE player_stats SET
    average_game_duration = COALESCE(v_total_duration, 0),
    win_rate = CASE WHEN v_total_games > 0 THEN (wins::DECIMAL / v_total_games) * 100 ELSE 0 END
  WHERE player_name = p_player_name;
END;
$$ LANGUAGE plpgsql;

-- アチーブメント挿入用関数
CREATE OR REPLACE FUNCTION insert_achievement(
  p_player_name TEXT,
  p_achievement_type TEXT,
  p_achievement_name TEXT,
  p_description TEXT,
  p_game_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO player_achievements (player_name, achievement_type, achievement_name, description, game_id)
  VALUES (p_player_name, p_achievement_type, p_achievement_name, p_description, p_game_id)
  ON CONFLICT (player_name, achievement_type, achievement_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
