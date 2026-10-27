# Pa la mascota

Aplicación full-stack para catálogo público, administración de inventario y cotizaciones.

## Publicar la aplicación completa en Render

`render.yaml` prepara un servicio Node.js que publica la API y el frontend desde el mismo dominio. El catálogo, el login, los cambios de inventario y las cotizaciones usan el backend real; los cambios se comparten entre visitantes y se almacenan en PostgreSQL.

### Preparación

1. Crea una base de datos PostgreSQL en un proveedor con plan gratuito, por ejemplo Neon. Copia la cadena de conexión PostgreSQL (incluyendo usuario y contraseña); no la pongas en archivos del proyecto ni la compartas por chat.
2. Sube el código del proyecto a un repositorio GitHub. No subas `.env`, `node_modules`, `backend/petshop.sqlite` ni `frontend/dist`.
3. En Render, crea un **Blueprint** y conecta ese repositorio. Render detectará `render.yaml` y propondrá crear el servicio web.
4. Antes de crear el servicio, configura `DB_URL` con la cadena de conexión PostgreSQL. Render generará `ADMIN_PASSWORD`; guarda esa clave en un gestor seguro para compartir el acceso administrativo con tu cliente por un canal privado.
5. Despliega. La aplicación crea las tablas y carga productos de muestra cuando la base está vacía. La URL pública y el estado del servicio aparecen en Render. Comprueba `/api/health`.
6. Para habilitar la carga de imágenes, agrega en **Render → Environment** las variables `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` desde el panel de API Keys de tu cuenta Cloudinary. Guarda los cambios para que Render reinicie el servicio. No compartas el API Secret ni lo guardes en el repositorio.

No se deben migrar datos reales de `backend/petshop.sqlite` a una demo para clientes. Empieza con la base PostgreSQL vacía para que se cargue el inventario de ejemplo.

El plan gratuito de servicios web puede dormir tras un período sin visitas; la primera carga posterior puede tardar. Las sesiones administrativas viven en memoria y se invalidan cuando el servicio se reinicia. Mantén una sola instancia para esta versión.

## Ejecutar la aplicación completa en local

### Requisitos
- Node.js 20 o superior recomendado.
- npm.

Desde la carpeta raíz:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Copia `backend/.env.example` a `backend/.env` y ejecuta:

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api
- Salud de la API: http://localhost:4000/api/health

Al primer inicio se crea `backend/petshop.sqlite` con productos de ejemplo. No borres esa base local si contiene información que quieras conservar.

## Administración

El catálogo es público. Para administrar productos y preparar cotizaciones, configura una contraseña fuerte en `backend/.env`:

```env
ADMIN_PASSWORD=elige-una-contrasena-larga-y-unica
```

Reinicia el backend tras cambiarla. El login usa cookie `HttpOnly`/`SameSite=Strict`, sesiones revocables y límite de intentos fallidos. En producción, sirve la web por HTTPS. Las cotizaciones pueden copiarse o imprimirse/guardarse como PDF y no descuentan stock.

## Imágenes de productos

Las imágenes se guardan en Cloudinary. Configura en `backend/.env` las credenciales de tu cuenta:

```env
CLOUDINARY_CLOUD_NAME=tu_nombre_de_nube
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

Reinicia el backend, abre el panel de administración y carga una imagen JPG, PNG o WebP de hasta 5 MB. La API Secret solo debe estar en el backend; no la publiques ni la configures en variables `VITE_`.

## Verificaciones

```bash
npm test
npm run build
```

## Funciones
- Catálogo público con búsqueda, filtros, stock y precios.
- Administración protegida con alta, edición y archivo de productos.
- Registro de movimientos de inventario.
- Cotizaciones para clientes.
- API con endpoints de ventas y movimientos protegidos por sesión administrativa.
