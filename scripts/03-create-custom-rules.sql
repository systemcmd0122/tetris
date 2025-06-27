-- カスタムルールテーブル
CREATE TABLE custom_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL DEFAULT 'Standard',
  
  -- 速度設定
  initial_drop_time INTEGER DEFAULT 1000, -- 初期落下時間（ms）
  level_speed_increase DECIMAL DEFAULT 0.9, -- レベルアップ時の速度倍率
  soft_drop_multiplier DECIMAL DEFAULT 0.05, -- ソフトドロップ速度倍率
  
  -- ゲームルール
  lines_per_level INTEGER DEFAULT 10, -- レベルアップに必要なライン数
  max_level INTEGER DEFAULT 30, -- 最大レベル
  ghost_piece_enabled BOOLEAN DEFAULT true, -- ゴーストピース表示
  hold_piece_enabled BOOLEAN DEFAULT false, -- ホールド機能
  
  -- スコアリング
  single_line_score INTEGER DEFAULT 40, -- 1ライン消去スコア
  double_line_score INTEGER DEFAULT 100, -- 2ライン消去スコア
  triple_line_score INTEGER DEFAULT 300, -- 3ライン消去スコア
  tetris_score INTEGER DEFAULT 1200, -- テトリススコア
  soft_drop_score INTEGER DEFAULT 1, -- ソフトドロップボーナス
  hard_drop_score INTEGER DEFAULT 2, -- ハードドロップボーナス
  
  -- 特殊ルール
  garbage_lines_enabled BOOLEAN DEFAULT false, -- ガベージライン攻撃
  time_limit INTEGER DEFAULT NULL, -- 制限時間（秒）
  sudden_death_enabled BOOLEAN DEFAULT false, -- サドンデス
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プリセットルールの挿入
INSERT INTO custom_rules (rule_name, initial_drop_time, level_speed_increase, lines_per_level, max_level, ghost_piece_enabled, hold_piece_enabled) VALUES
('Standard', 1000, 0.9, 10, 30, true, false),
('Speed', 500, 0.85, 8, 25, true, true),
('Marathon', 1200, 0.95, 15, 50, true, true),
('Blitz', 300, 0.8, 5, 20, false, false),
('Classic', 1500, 0.92, 10, 15, false, false);

-- Row Level Security (RLS) の有効化
ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成
CREATE POLICY "Enable read access for all users" ON custom_rules FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON custom_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON custom_rules FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON custom_rules FOR DELETE USING (true);

-- トリガーの作成
CREATE TRIGGER update_custom_rules_updated_at 
BEFORE UPDATE ON custom_rules 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- game_roomsテーブルにカスタムルールIDを追加
ALTER TABLE game_rooms ADD COLUMN custom_rule_id UUID REFERENCES custom_rules(id);
