CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  url TEXT NOT NULL,
  type TEXT NOT NULL, -- image | video

  title TEXT,
  description TEXT,

  thumbnail TEXT, -- pour video preview

  visibility TEXT DEFAULT 'private', -- public | private

  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,

  tags TEXT, -- JSON string ou simple string

  created_at INTEGER NOT NULL
);
