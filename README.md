# 📦 Resale Tracker — Amazon Returns

App móvil (PWA) para gestionar tu negocio de paquetes de devoluciones de Amazon.
Conectada a Firebase: login con email/contraseña o Google y datos compartidos en tiempo real entre todos los usuarios.

## Funcionalidades

- Login con email/contraseña o Google
- Datos compartidos en tiempo real (lo que uno añade, todos lo ven al instante)
- Registro de paquetes con coste automático (6€ martes / 3€ miércoles)
- Productos por paquete (divide el coste automáticamente)
- Ventas en Wallapop / Vinted con tracking de quién vendió
- Dashboard con beneficio, ROI, comparativa martes vs miércoles
- Alertas de productos estancados (2, 4 y 6 semanas)
- Internacionalización automática con `i18next` (español por defecto + inglés + búlgaro)
- Se instala en el móvil como app nativa

## Arquitectura

La app está organizada por capas para facilitar mantenimiento y escalabilidad:

- `src/features/*`: módulos funcionales (`auth`, `tracker`)
- `src/components/ui/*`: componentes reutilizables de UI
- `src/hooks/*`: hooks de estado y suscripciones
- `src/constants/*`: constantes de dominio y estilos compartidos
- `src/utils/*`: utilidades puras (formato, métricas, reglas de negocio)
- `src/i18n/*`: configuración y recursos de traducción

## Seguridad e Integridad

- Dependencias auditadas con `npm audit` y sin vulnerabilidades conocidas.
- Sanitización de entrada/salida en cliente para evitar datos corruptos desde formularios o Firestore.
- Reglas de Firestore incluidas en `firestore.rules` con validación de esquema y tipos.
- Configuración Firebase para reglas en `firebase.json`.

---

## Poner en marcha (15 min)

### 1. Instala dependencias

```bash
cd resale-tracker
npm install
```

### 2. Prueba en local

```bash
npm run dev
```

Abre http://localhost:5173 — deberías ver la pantalla de login.

### 3. Activa Google Login en Firebase (1 sola vez)

1. Firebase Console → **Authentication** → **Sign-in method** → **Google**.
2. Activa Google, añade tu correo de soporte y guarda.
3. En **Authentication** → **Settings** → **Authorized domains**, añade:
   - `localhost`
   - tu dominio de Vercel (ej: `tu-app.vercel.app`)

### 4. Sube a GitHub

```bash
git init
git add .
git commit -m "primera version"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/resale-tracker.git
git push -u origin main
```

### 5. Despliega en Vercel (gratis)

1. Ve a vercel.com y regístrate con GitHub
2. "Add New Project" → selecciona resale-tracker
3. Deploy → en 2 min tienes la URL

### 6. Instala en el móvil

1. Abre la URL de Vercel en el navegador del móvil
2. Android: 3 puntos → "Añadir a pantalla de inicio"
3. iPhone: Compartir → "Añadir a pantalla de inicio"

### 7. Crea las cuentas

Cada persona (tú, tu madre, tu padre) abre la app y entra con "Registrarme" (email/contraseña) o "Continuar con Google". Todos veréis los mismos datos.

---

## Subir cambios

```bash
git add .
git commit -m "lo que hayas cambiado"
git push
```

Vercel actualiza automáticamente en 30 segundos.

## Datos

Los datos están en Firebase Firestore. Son privados (solo accesibles con login).
El plan gratuito de Firebase te da más que suficiente para este uso.
