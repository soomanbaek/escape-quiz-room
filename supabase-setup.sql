-- =====================================================================
-- 멀티 디바이스 + QR/사진 문제 기능을 위한 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 1회 실행하세요.
-- =====================================================================

-- 1) questions 테이블에 문제 유형 컬럼 추가 (text / qr / photo)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text';

-- 2) 팀원 접속 추적 테이블 (멀티 디바이스 / 현재 접속 인원 수)
CREATE TABLE IF NOT EXISTS team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  team_id     int  NOT NULL,
  device_id   text NOT NULL,
  nickname    text,
  last_seen   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, team_id, device_id)
);

-- 보안이 중요한 서비스가 아니므로 RLS 비활성화 (기존 테이블과 동일)
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;

-- 활성 인원 집계 쿼리용 인덱스
CREATE INDEX IF NOT EXISTS idx_team_members_active
  ON team_members (session_id, team_id, last_seen);
