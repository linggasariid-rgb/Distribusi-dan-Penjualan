-- Tabel users untuk manajemen akun
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  whp text NOT NULL DEFAULT 'ALL',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed 4 user yang sudah ada
INSERT INTO users (username, password_hash, name, role, whp) VALUES
  ('superadmin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Super Admin', 'super_admin', 'ALL'),
  ('admin', 'becf77f3ec82a43422b7712134d1860e3205c6ce778b08417a7389b43f2b4661', 'Admin', 'admin', 'ALL'),
  ('whp_tasik', 'd557d6e83b48f14f16a6175d1731cd08ed922b937b13d9f4cee50d72426fb5e8', 'Admin WHP Tasikmalaya', 'admin_whp', 'WHP TASIKMALAYA'),
  ('whp_bandung', '078a7c4715356e3c9b325ac65ac5f2257650db2792cf01468f0df684c50451bb', 'Admin WHP Bandung', 'admin_whp', 'WHP BANDUNG')
ON CONFLICT (username) DO NOTHING;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL LEVEL;
