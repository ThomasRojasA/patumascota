# Pa la mascota — lanzamiento 0.1

**Versión:** 0.1.0  
**Estado:** primera versión pública de demostración funcional  
**Aplicación:** [pa-la-mascota.onrender.com](https://pa-la-mascota.onrender.com)  
**Repositorio:** [ThomasRojasA/patumascota](https://github.com/ThomasRojasA/patumascota)

## 1. Resumen

Pa la mascota es una aplicación web para consultar productos para mascotas y sus precios, mantener un inventario desde un panel privado y preparar cotizaciones. Esta versión publica la aplicación completa: interfaz, API y almacenamiento persistente en PostgreSQL. Las imágenes de productos se cargan a Cloudinary.

La aplicación tiene dos experiencias:

- **Catálogo público:** permite revisar los productos activos, su precio, disponibilidad e imagen.
- **Administración:** requiere una contraseña y permite crear, actualizar y archivar productos, modificar precios y stock, cargar imágenes y preparar cotizaciones.

Esta versión está pensada como primera entrega funcional para demostración y validación del flujo con clientes. No debe interpretarse como una plataforma de comercio electrónico con pagos o pedidos en línea.

## 2. Funcionalidades incluidas

### Catálogo público

- Muestra productos activos con marca, nombre, precio en pesos chilenos (CLP) y unidades disponibles.
- Búsqueda por nombre o marca y filtro de marcas.
- Indicador de stock bajo cuando hay cinco unidades o menos.
- Imagen del producto o una imagen de reemplazo cuando no se ha cargado ninguna.
- Actualización manual del catálogo.

### Panel de administración

- Acceso protegido por contraseña.
- Creación y edición de productos (marca, nombre, precio y stock).
- Archivo de productos para retirarlos del catálogo público sin eliminarlos de la base de datos.
- Carga y vista previa de imágenes JPG, PNG o WebP de hasta 5 MB.
- Ajustes de stock registrados como movimientos en el backend.

### Cotizador

- Selección de productos disponibles y ajuste de cantidades, respetando el stock visible.
- Cálculo de subtotales y total en CLP.
- Campo de cliente y observaciones.
- Copia de la cotización al portapapeles o impresión/guardado como PDF desde el navegador.
- Preparar una cotización desde la interfaz **no descuenta stock**.

## 3. Alcance y límites de la versión 0.1

- El cotizador del panel genera el documento en el navegador. Las cotizaciones creadas desde esa interfaz no se guardan como registros, no se envían por correo y no descuentan inventario.
- La API incluye rutas administrativas para registrar ventas y consultar ventas, pero esas rutas no forman parte del flujo del cotizador de la interfaz en esta versión.
- No incluye carrito de compra público, pagos, pedidos en línea, cuentas de clientes, recuperación de contraseña ni roles administrativos diferenciados.
- El acceso de administración utiliza una contraseña compartida configurada en el servidor.
- La sesión administrativa vive en memoria: se cierra al reiniciar o desplegar el servicio y no está diseñada para múltiples instancias.
- En el plan gratuito de Render, el servicio puede suspenderse tras inactividad y tardar en responder al primer acceso posterior.
- Los productos de ejemplo se crean únicamente cuando la base de datos está vacía. No se recomienda usar la base de demostración para datos comerciales sin una política de respaldo y operación adecuada.

## 4. Arquitectura y tecnologías

| Componente | Tecnología / servicio | Responsabilidad |
|---|---|---|
| Interfaz web | React 18, Vite 6, JavaScript | Catálogo, panel, inventario y cotizador |
| API | Node.js, Express 4 | Autenticación, catálogo y operaciones administrativas |
| Persistencia | Sequelize 6 con PostgreSQL en producción | Productos, movimientos de stock, ventas y sus líneas |
| Base publicada | PostgreSQL administrado en Neon | Almacenamiento persistente para la instancia en Render |
| Imágenes | Cloudinary | Recepción y entrega de imágenes de productos |
| Hosting | Render Web Service (plan gratuito, región Ohio) | Sirve la API y el frontend compilado desde el mismo dominio |
| Código fuente | GitHub | Repositorio y origen del despliegue automático |

En desarrollo local, si `DB_URL` está vacía, el backend usa SQLite en `backend/petshop.sqlite`. En producción, el servidor exige `DB_URL` y PostgreSQL.

## 5. Datos y comportamiento del inventario

El modelo persistente incluye:

- **Productos:** marca, nombre, precio, stock, URL de imagen y estado activo/archivado.
- **Movimientos de stock:** entradas, salidas y ajustes, con cantidad, stock anterior/nuevo y motivo.
- **Ventas y líneas de venta:** admitidas por la API; el registro de una venta descuenta stock y genera movimientos asociados.

El catálogo público solo devuelve productos activos. Las rutas administrativas requieren una sesión válida. Archivar un producto conserva sus datos; no equivale a borrarlo permanentemente.

Los cambios realizados sobre el inventario publicado son compartidos por todos los visitantes. Antes de usar la instancia con información real, revisar y reemplazar los productos de demostración que no correspondan.

## 6. API disponible

Prefijo común: `/api`.

| Ruta | Acceso | Propósito |
|---|---|---|
| `GET /api/health` | Público | Comprobación de disponibilidad del servicio |
| `POST /api/auth/login` | Público, con límite de intentos | Iniciar sesión administrativa |
| `GET /api/auth/me` | Sesión administrativa | Comprobar sesión y obtener token CSRF |
| `POST /api/auth/logout` | Sesión administrativa + CSRF | Cerrar y revocar la sesión |
| `GET /api/products` | Público | Listar productos activos; admite búsqueda y filtro por marca |
| `GET /api/products?includeInactive=true` | Sesión administrativa | Incluir productos archivados |
| `POST /api/products` | Sesión administrativa + CSRF | Crear producto |
| `PUT /api/products/:id` | Sesión administrativa + CSRF | Actualizar producto |
| `POST /api/products/:id/image` | Sesión administrativa + CSRF | Cargar imagen a Cloudinary |
| `DELETE /api/products/:id` | Sesión administrativa + CSRF | Archivar producto |
| `GET /api/movements` | Sesión administrativa | Consultar los últimos movimientos de stock |
| `POST /api/movements` | Sesión administrativa + CSRF | Registrar entrada o salida manual |
| `GET /api/sales` | Sesión administrativa | Consultar ventas registradas |
| `POST /api/sales` | Sesión administrativa + CSRF | Registrar venta y descontar stock |
| `GET /api/dashboard` | Sesión administrativa | Resumen de inventario y ventas |

Las operaciones que modifican datos requieren token CSRF además de la cookie de sesión.

## 7. Configuración de producción

El servicio publicado utiliza las siguientes variables de entorno. Los valores secretos se gestionan directamente en **Render → Environment** y no deben guardarse en el repositorio, archivos de ejemplo, capturas ni conversaciones.

| Variable | Obligatoria | Uso |
|---|---:|---|
| `NODE_ENV` | Sí | `production` en Render |
| `TRUST_PROXY` | Sí | Número de proxies confiables de Render; configurado como `1` |
| `DB_URL` | Sí | URI privada de PostgreSQL |
| `DB_SSL` | Sí | SSL de PostgreSQL; configurado como `true` |
| `ADMIN_PASSWORD` | Sí | Contraseña privada para el panel; debe tener al menos 16 caracteres |
| `CLOUDINARY_CLOUD_NAME` | Sí para imágenes | Nombre de nube de Cloudinary |
| `CLOUDINARY_API_KEY` | Sí para imágenes | Clave API de Cloudinary |
| `CLOUDINARY_API_SECRET` | Sí para imágenes | Secreto API de Cloudinary |

Render configura `PORT` para el proceso. La aplicación calcula el origen HTTPS a partir de la URL pública de Render; no se debe fijar un origen localhost en producción.

### Rotación de la contraseña administrativa

1. Abrir **Render → Environment** del servicio `pa-la-mascota`.
2. Actualizar `ADMIN_PASSWORD` con una contraseña única de al menos 16 caracteres.
3. Guardarla en un gestor de contraseñas y compartirla con el administrador por un canal privado.
4. Guardar los cambios y esperar a que Render termine el reinicio/despliegue.
5. Iniciar sesión de nuevo; las sesiones anteriores quedan invalidadas al cambiar la contraseña o reiniciar el servicio.

### Cloudinary

Las credenciales deben ser de la misma cuenta Cloudinary. Guardar las tres variables con los nombres exactos indicados arriba, sin prefijo `VITE_`. El API Secret solo reside en el backend. La carga acepta JPG, PNG y WebP de hasta 5 MB.

## 8. Ejecución local

### Requisitos

- Node.js 20 o superior (el despliegue fija Node.js 24.14.0).
- npm.

Desde la carpeta raíz del proyecto:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Configurar `backend/.env` a partir de `backend/.env.example`. Para desarrollo local, `DB_URL` puede quedar vacío; se usará SQLite. Definir `ADMIN_PASSWORD` para ingresar al panel. Cloudinary solo es necesario para probar la carga real de imágenes.

Iniciar la aplicación completa:

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Salud: `http://localhost:4000/api/health`

Otros comandos raíz:

```bash
npm test
npm run build
npm start
```

`npm start` inicia el backend. En producción, compilar primero el frontend para que Express sirva `frontend/dist`.

## 9. Despliegue y operación

- Render construye el backend y compila el frontend según `render.yaml`.
- El mismo servicio sirve la API y el frontend; el navegador usa el mismo origen.
- El health check está configurado en `/api/health`.
- Los despliegues se activan al actualizar la rama conectada del repositorio.
- Mantener una sola instancia en esta versión: las sesiones administrativas son locales a la memoria del proceso.
- Revisar el estado del servicio y sus logs en Render. Para un primer acceso después de inactividad, esperar a que el servicio despierte antes de reintentar.
- Conservar las credenciales de Neon, Render y Cloudinary en sus respectivos paneles de secretos; no incluirlas en Git.

## 10. Seguridad implementada

- Panel y operaciones administrativas protegidos en el backend, no solo ocultos en la interfaz.
- Cookie de sesión `HttpOnly`, `Secure` en producción, `SameSite=Strict`, con duración máxima de 12 horas.
- Token CSRF requerido en operaciones que modifican datos.
- Límite de cinco intentos fallidos de inicio de sesión por ventana de 15 minutos.
- Protección HTTP con Helmet y política de contenido que permite imágenes desde Cloudinary.
- Validación de formato/tamaño de imagen y validaciones básicas de precio, stock y cantidades.
- Configuración productiva exige contraseña de al menos 16 caracteres, PostgreSQL, HTTPS y proxy confiable.

La seguridad de la cuenta también depende de mantener privadas las credenciales y de no reutilizar la contraseña administrativa.

## 11. Verificación de la versión

Las verificaciones de desarrollo ejecutadas para esta entrega incluyen:

```bash
npm test
npm run build
```

El backend cuenta con pruebas de autenticación, sesión, CSRF, límite de intentos y rechazo de rutas administrativas sin autenticación. La API publicada responde en `/api/health`; el catálogo público y las imágenes cargadas a Cloudinary fueron comprobados durante la puesta en marcha. El comportamiento del plan gratuito (suspensión por inactividad) es una condición del proveedor, no un fallo de la aplicación.

## 12. Identidad visual

La interfaz usa el nombre **Pa la mascota**, con una presentación cercana y orientada a productos para mascotas. La dirección visual toma como referencia la paleta compartida para el proyecto: azul marino `#001952`, azul brillante `#009DDC`, rojo `#EA2229` para acentos puntuales y fondos blancos. El nombre y la identidad de Pa la mascota son propios del proyecto; no se utiliza el logotipo de Petco.

## 13. Próximos pasos sugeridos

1. Revisar y dejar solo el inventario de demostración que se quiera presentar al cliente.
2. Mantener la contraseña administrativa bajo control y rotarla si se comparte con más personas.
3. Hacer una carga de imagen por producto y verificar su visualización desde el catálogo público.
4. Definir una política de respaldo y recuperación antes de usar datos comerciales reales.
5. Para una versión posterior, evaluar persistencia de cotizaciones, exportación formal, envío al cliente, roles de usuario, monitoreo y un plan de hosting sin suspensión por inactividad.
