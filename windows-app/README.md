# Pa la mascota para Windows

Aplicación de escritorio para Windows que abre el panel web de Pa la mascota y se conecta a la API publicada en Render. Usa el mismo acceso de administrador; la contraseña no está incluida en la aplicación.

## Funciones

- Consulta del catálogo y stock.
- Administración protegida del inventario e imágenes.
- Consulta de ventas registradas.
- Cotizaciones temporales que se pueden copiar o imprimir/guardar como PDF.

Las cotizaciones no se guardan ni descuentan stock. La app requiere conexión a internet; los datos se consultan desde el servicio publicado, no se almacenan localmente.

## Ejecutar en modo desarrollo

Requiere Node.js y npm. Desde la carpeta raíz del proyecto:

```bash
npm install --prefix windows-app
npm run desktop:dev
```

## Generar instalador de Windows

Desde la carpeta raíz:

```bash
npm install --prefix windows-app
npm run desktop:build
```

El instalador x64 se genera en `windows-app/dist`. Instala el archivo `.exe` en Windows y abre Pa la mascota desde el menú Inicio o el acceso directo.

## Seguridad y operación

- La ventana usa aislamiento de contexto, sandbox y Node.js deshabilitado para el contenido web.
- Solo permite navegación dentro del sitio publicado y bloquea ventanas o navegación externas.
- El login y las cookies son administrados por el sitio y el backend existentes.
- La app requiere conexión a internet y que Render esté disponible. El plan gratuito de Render puede tardar en despertar después de períodos sin uso.
- No guardar contraseñas ni secretos en el código fuente ni en archivos de configuración de la app.
