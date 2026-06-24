# Setup — BachelorApp 🎉

## 1. Requisitos previos

- Node.js 18+
- npm o yarn
- Expo CLI: `npm install -g expo-cli`
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Expo Go en tu móvil (para probar)

---

## 2. Crear el proyecto Expo

```bash
npx create-expo-app@latest BachelorApp --template blank-typescript
cd BachelorApp
```

Copia todos los archivos de este proyecto dentro de la carpeta creada,
reemplazando los que ya existan.

---

## 3. Instalar dependencias

```bash
npm install
```

---

## 4. Configurar Supabase

### 4.1 Crear proyecto
1. Ve a [supabase.com](https://supabase.com) → New Project
2. Dale un nombre (ej. "bachelor-app"), elige región Europe (Frankfurt)
3. Guarda la contraseña de la base de datos

### 4.2 Ejecutar el schema
1. Supabase Dashboard → SQL Editor
2. Pega el contenido de `supabase_schema.sql`
3. Click "Run"

### 4.3 Crear buckets de Storage
En SQL Editor, ejecuta:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Fotos: subir" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "Fotos: ver" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Docs: subir" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Docs: ver" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "Avatars: subir" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Avatars: ver" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
```

### 4.4 Obtener credenciales
Supabase Dashboard → Project Settings → API:
- **Project URL**: `https://xxxx.supabase.co`
- **anon public key**: `eyJhbGci...`

---

## 5. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

> ⚠️ Nunca subas `.env` a Git. Ya está en `.gitignore`.

---

## 6. Configurar Google Maps (para el mapa de fotos)

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un proyecto → Habilita "Maps SDK for Android" y "Maps SDK for iOS"
3. Crea una API Key y añádela al `.env`

---

## 7. Arrancar la app

```bash
npx expo start
```

- Escanea el QR con Expo Go (iOS/Android)
- O pulsa `i` para simulador iOS / `a` para emulador Android

---

## 8. Estructura del proyecto

```
BachelorApp/
├── app/
│   ├── _layout.tsx          # Root layout + NavigationGuard
│   ├── group-setup.tsx      # Crear/unirse a grupo
│   ├── (auth)/
│   │   ├── login.tsx        # Login
│   │   └── register.tsx     # Registro
│   └── (tabs)/
│       ├── _layout.tsx      # Tab navigator
│       ├── index.tsx        # 🏠 Inicio + countdown
│       ├── calendar.tsx     # 📅 Agenda  [FASE 3]
│       ├── expenses.tsx     # 💸 Gastos  [FASE 4]
│       ├── photos.tsx       # 📸 Fotos   [FASE 5]
│       ├── travel.tsx       # ✈️ Viaje   [FASE 6]
│       └── group.tsx        # 👥 Grupo   [FASE 7]
├── components/
│   ├── ui/                  # Componentes reutilizables
│   └── ...
├── lib/
│   ├── supabase.ts          # Cliente Supabase
│   └── auth-context.tsx     # Auth global
├── types/
│   └── database.ts          # Tipos TypeScript
├── constants/
│   └── theme.ts             # Colores, radios, tipografía
├── supabase_schema.sql      # Schema completo de la DB
└── .env                     # Credenciales (no subir a Git)
```

---

## 9. Flujo de la app

```
Abrir app
   ↓
¿Tiene sesión? → No → Login / Registro
   ↓ Sí
¿Tiene grupo? → No → Crear o unirse a grupo (código 6 letras)
   ↓ Sí
Tab Navigator:
  🏠 Inicio    → Countdown + código + stats + próximo evento
  📅 Agenda    → Actividades por hora, RSVP, notificaciones
  💸 Gastos    → Lista + añadir + liquidación automática
  📸 Fotos     → Álbum + mapa + cápsula del tiempo
  ✈️ Viaje     → Boarding passes + hotel + recordatorios
  👥 Grupo     → Miembros + perfiles + votaciones + modo discreción
```

---

## 10. Fases de desarrollo

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | ✅ Completa | Auth, grupos, navegación base, pantalla de inicio |
| 2 | ⏳ Siguiente | Perfiles, modo discreción |
| 3 | ⏳ | Calendario + notificaciones push |
| 4 | ⏳ | Gastos + liquidación |
| 5 | ⏳ | Fotos + mapa + cápsula del tiempo |
| 6 | ⏳ | Documentos de viaje |
| 7 | ⏳ | Votaciones + encuesta + timeline |
| 8 | ⏳ | Collage automático |
