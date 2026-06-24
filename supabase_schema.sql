-- ============================================================
-- BACHELORAPP — Esquema completo de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: groups
-- Cada despedida/grupo de amigos
-- ============================================================
CREATE TABLE IF NOT EXISTS groups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,        -- Código de 6 letras para unirse
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  groom_name    TEXT,                        -- Nombre del novio
  groom_id      UUID REFERENCES auth.users(id), -- Si el novio está en el grupo
  is_discrete   BOOLEAN DEFAULT FALSE,       -- Modo discreción activo
  countdown_date TIMESTAMPTZ,                -- Fecha de la despedida
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: profiles
-- Perfil extendido de cada usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  avatar_url    TEXT,
  allergies     TEXT,                        -- Alergias o restricciones alimentarias
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: group_members
-- Relación muchos-a-muchos entre usuarios y grupos
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',          -- 'admin' | 'member'
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================================
-- TABLA: events
-- Actividades del calendario
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL,
  description   TEXT,
  location_name TEXT,
  latitude      FLOAT,
  longitude     FLOAT,
  maps_url      TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  notify_before INTEGER DEFAULT 60,          -- Minutos antes para notificar
  is_surprise   BOOLEAN DEFAULT FALSE,       -- Oculto en modo discreción
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: event_confirmations
-- RSVP de cada persona para cada actividad
-- ============================================================
CREATE TABLE IF NOT EXISTS event_confirmations (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status    TEXT DEFAULT 'pending',          -- 'yes' | 'no' | 'pending'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- TABLA: expenses
-- Gastos del grupo
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by     UUID NOT NULL REFERENCES auth.users(id),
  title       TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  is_shared   BOOLEAN DEFAULT TRUE,          -- Compartido vs individual
  split_with  UUID[],                        -- IDs de usuarios que comparten (NULL = todos)
  category    TEXT DEFAULT 'general',        -- 'food' | 'transport' | 'activity' | 'hotel' | 'general'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: photos
-- Fotos del grupo con geolocalización
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploaded_by    UUID NOT NULL REFERENCES auth.users(id),
  storage_path   TEXT NOT NULL,              -- Path en Supabase Storage
  thumbnail_path TEXT,
  caption        TEXT,
  latitude       FLOAT,
  longitude      FLOAT,
  location_name  TEXT,
  taken_at       TIMESTAMPTZ DEFAULT NOW(),  -- Fecha/hora de la foto
  is_capsule     BOOLEAN DEFAULT FALSE,      -- Pertenece a la cápsula del tiempo
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: time_capsule
-- La cápsula del tiempo (una por grupo)
-- ============================================================
CREATE TABLE IF NOT EXISTS time_capsule (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id     UUID UNIQUE NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_locked    BOOLEAN DEFAULT TRUE,
  unlocked_at  TIMESTAMPTZ,                  -- Cuándo se desbloqueó (NULL = aún cerrada)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: documents
-- Documentos de viaje (boarding passes, bonos, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES auth.users(id),
  type          TEXT NOT NULL,               -- 'boarding_pass' | 'hotel' | 'ticket' | 'other'
  title         TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  -- Campos específicos para vuelos
  flight_number TEXT,
  departure_at  TIMESTAMPTZ,
  arrival_at    TIMESTAMPTZ,
  departure_airport TEXT,
  arrival_airport   TEXT,
  -- Campos específicos para hotel
  hotel_name    TEXT,
  checkin_date  DATE,
  checkout_date DATE,
  address       TEXT,
  wifi_password TEXT,
  safe_code     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: polls
-- Votaciones del grupo
-- ============================================================
CREATE TABLE IF NOT EXISTS polls (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  question   TEXT NOT NULL,
  options    JSONB NOT NULL,                 -- [{id, text}]
  is_open    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: poll_votes
-- Votos de cada persona en cada encuesta
-- ============================================================
CREATE TABLE IF NOT EXISTS poll_votes (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id),
  option_id TEXT NOT NULL,
  voted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- ============================================================
-- TABLA: trip_survey
-- Encuesta post-viaje
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_surveys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  overall     INTEGER CHECK (overall BETWEEN 1 AND 5),
  highlights  TEXT,
  suggestions TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================================
-- FUNCIÓN: trigger para crear perfil al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCIÓN: generar código único de grupo (6 letras)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_capsule      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_surveys      ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es el usuario miembro del grupo?
CREATE OR REPLACE FUNCTION is_group_member(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: ¿es el usuario admin del grupo?
CREATE OR REPLACE FUNCTION is_group_admin(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- POLICIES: groups
CREATE POLICY "Ver grupos propios"    ON groups FOR SELECT USING (is_group_member(id));
CREATE POLICY "Crear grupos"          ON groups FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Editar grupo (admin)"  ON groups FOR UPDATE USING (is_group_admin(id));

-- POLICIES: profiles
CREATE POLICY "Ver perfiles del grupo" ON profiles FOR SELECT USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
  )
);
CREATE POLICY "Editar propio perfil" ON profiles FOR UPDATE USING (id = auth.uid());

-- POLICIES: group_members
CREATE POLICY "Ver miembros" ON group_members FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Unirse a grupo" ON group_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Expulsar (admin)" ON group_members FOR DELETE USING (is_group_admin(group_id));

-- POLICIES: events
CREATE POLICY "Ver eventos" ON events FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Crear eventos" ON events FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Editar eventos (admin)" ON events FOR UPDATE USING (is_group_admin(group_id));
CREATE POLICY "Borrar eventos (admin)" ON events FOR DELETE USING (is_group_admin(group_id));

-- POLICIES: event_confirmations
CREATE POLICY "Ver confirmaciones" ON event_confirmations FOR SELECT USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND is_group_member(e.group_id))
);
CREATE POLICY "Confirmar asistencia" ON event_confirmations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Cambiar confirmación" ON event_confirmations FOR UPDATE USING (user_id = auth.uid());

-- POLICIES: expenses, photos, documents, polls, poll_votes, trip_surveys
CREATE POLICY "Ver gastos" ON expenses FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Añadir gasto" ON expenses FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Editar gasto propio" ON expenses FOR UPDATE USING (paid_by = auth.uid());
CREATE POLICY "Borrar gasto propio" ON expenses FOR DELETE USING (paid_by = auth.uid());

CREATE POLICY "Ver fotos" ON photos FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Subir foto" ON photos FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Borrar foto propia" ON photos FOR DELETE USING (uploaded_by = auth.uid());

CREATE POLICY "Ver cápsula" ON time_capsule FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Crear cápsula (admin)" ON time_capsule FOR INSERT WITH CHECK (is_group_admin(group_id));
CREATE POLICY "Abrir cápsula (admin)" ON time_capsule FOR UPDATE USING (is_group_admin(group_id));

CREATE POLICY "Ver docs" ON documents FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Subir doc" ON documents FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Borrar doc propio" ON documents FOR DELETE USING (uploaded_by = auth.uid());

CREATE POLICY "Ver encuestas" ON polls FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Crear encuesta" ON polls FOR INSERT WITH CHECK (is_group_member(group_id));

CREATE POLICY "Ver votos" ON poll_votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM polls p WHERE p.id = poll_id AND is_group_member(p.group_id))
);
CREATE POLICY "Votar" ON poll_votes FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Ver surveys" ON trip_surveys FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Enviar survey" ON trip_surveys FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STORAGE: Crear buckets
-- Ejecutar desde Supabase Dashboard → Storage
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies (ejecutar también desde SQL Editor)
-- CREATE POLICY "Fotos: subir" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
-- CREATE POLICY "Fotos: ver" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
-- CREATE POLICY "Docs: subir" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
-- CREATE POLICY "Docs: ver propios" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
