-- ゲームルーム管理用の関数とトリガーを作成

-- 1. 長時間更新のないルームをクリーンアップする関数
CREATE OR REPLACE FUNCTION cleanup_stale_game_rooms() RETURNS void AS $$
DECLARE
  v_room RECORD;
  v_player_count INTEGER;
BEGIN
  -- 1.1 完了したゲームを削除 (1時間以上経過)
  DELETE FROM game_rooms
  WHERE status = 'finished' 
  AND updated_at < NOW() - INTERVAL '1 hour';

  -- 1.2 放置された待機中のルームを削除 (30分以上更新なし)
  DELETE FROM game_rooms
  WHERE status = 'waiting'
  AND updated_at < NOW() - INTERVAL '30 minutes';

  -- 1.3 各ルームのプレイヤー数を確認して更新
  FOR v_room IN SELECT id FROM game_rooms LOOP
    SELECT COUNT(*) INTO v_player_count
    FROM players
    WHERE room_id = v_room.id;

    IF v_player_count = 0 THEN
      -- プレイヤーがいない場合はルームを削除
      DELETE FROM game_rooms WHERE id = v_room.id;
    ELSE
      -- プレイヤー数を更新
      UPDATE game_rooms
      SET current_players = v_player_count
      WHERE id = v_room.id;
    END IF;
  END LOOP;

  -- 1.4 誤ってプレイ中になっているルームを修正
  UPDATE game_rooms
  SET status = 'finished'
  WHERE status = 'playing'
  AND updated_at < NOW() - INTERVAL '3 hours';

  -- 1.5 ゲーム状態があるルームのステータスを確認
  UPDATE game_rooms gr
  SET status = 'finished'
  FROM game_states gs
  WHERE gr.id = gs.room_id
  AND gr.status = 'playing';
END;
$$ LANGUAGE plpgsql;

-- 2. ルームのプレイヤー数を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_room_player_count() RETURNS TRIGGER AS $$
BEGIN
  -- 2.1 プレイヤーが追加/削除された時にルームのプレイヤー数を更新
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rooms
    SET current_players = (
      SELECT COUNT(*) FROM players WHERE room_id = NEW.room_id
    ),
    updated_at = NOW()
    WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- プレイヤー数を取得
    WITH player_count AS (
      SELECT COUNT(*) as count
      FROM players
      WHERE room_id = OLD.room_id
    )
    UPDATE game_rooms
    SET current_players = COALESCE((
      SELECT count FROM player_count
    ), 0),
    status = CASE 
      WHEN (SELECT count FROM player_count) = 0 THEN 'finished'
      ELSE status
    END,
    updated_at = NOW()
    WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. ゲーム終了時の自動クリーンアップトリガー関数
CREATE OR REPLACE FUNCTION handle_game_completion() RETURNS TRIGGER AS $$
BEGIN
  -- 3.1 ゲーム状態が登録された時にルームのステータスを完了に更新
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rooms
    SET status = 'finished',
        updated_at = NOW()
    WHERE id = NEW.room_id;
    
    -- 3.2 統計情報を更新
    INSERT INTO game_history (
      room_id,
      player_name,
      final_score,
      final_level,
      lines_cleared,
      game_duration,
      is_winner,
      placement
    )
    SELECT 
      NEW.room_id,
      p.player_name,
      p.score,
      p.level,
      p.lines_cleared,
      EXTRACT(EPOCH FROM (NOW() - r.created_at)),
      CASE WHEN p.id = NEW.winner_id THEN true ELSE false END,
      CASE WHEN p.id = NEW.winner_id THEN 1 ELSE 2 END
    FROM players p
    JOIN game_rooms r ON r.id = p.room_id
    WHERE p.room_id = NEW.room_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. ルームの状態監視関数
CREATE OR REPLACE FUNCTION monitor_room_status() RETURNS TRIGGER AS $$
BEGIN
  -- 4.1 ルームの状態が変更された時の処理
  IF TG_OP = 'UPDATE' THEN
    -- プレイ中から完了に変更された場合
    IF OLD.status = 'playing' AND NEW.status = 'finished' THEN
      -- プレイヤーの生存状態をリセット
      UPDATE players
      SET is_alive = false
      WHERE room_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
CREATE TRIGGER update_player_count
AFTER INSERT OR DELETE ON players
FOR EACH ROW
EXECUTE FUNCTION update_room_player_count();

CREATE TRIGGER handle_game_completion
AFTER INSERT ON game_states
FOR EACH ROW
EXECUTE FUNCTION handle_game_completion();

CREATE TRIGGER monitor_room_status
AFTER UPDATE ON game_rooms
FOR EACH ROW
EXECUTE FUNCTION monitor_room_status();

-- インデックスの作成
CREATE INDEX idx_game_rooms_status ON game_rooms (status);
CREATE INDEX idx_game_rooms_updated_at ON game_rooms (updated_at);
CREATE INDEX idx_players_room_id ON players (room_id);
CREATE INDEX idx_game_states_room_id ON game_states (room_id);

-- 統計ビューの作成
CREATE OR REPLACE VIEW room_statistics AS
SELECT 
  r.id AS room_id,
  r.name AS room_name,
  r.status,
  r.current_players,
  r.created_at,
  r.updated_at,
  COUNT(p.id) AS actual_player_count,
  MAX(p.score) AS highest_score,
  AVG(p.score) AS average_score
FROM game_rooms r
LEFT JOIN players p ON p.room_id = r.id
GROUP BY r.id, r.name, r.status, r.current_players, r.created_at, r.updated_at;

-- 定期的なクリーンアップのためのcron job (pgAgent必要)
-- 以下のSQLをpgAgentのジョブとして15分ごとに実行するよう設定
-- SELECT cleanup_stale_game_rooms();