-- ゲームルームテーブル
CREATE TABLE game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  max_players INTEGER DEFAULT 2,
  current_players INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プレイヤーテーブル
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_number INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  lines_cleared INTEGER DEFAULT 0,
  is_alive BOOLEAN DEFAULT true,
  board_state JSONB DEFAULT '[]',
  current_piece JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, player_number)
);

-- ゲーム状態テーブル
CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES players(id),
  game_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- リアルタイム更新のためのトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーの作成
CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON game_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_states_updated_at BEFORE UPDATE ON game_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) の有効化
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（すべてのユーザーが読み書き可能）
CREATE POLICY "Enable read access for all users" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON game_rooms FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON game_rooms FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON players FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON players FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON game_states FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON game_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON game_states FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON game_states FOR DELETE USING (true);
