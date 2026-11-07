# LFA — web deportiva, archivo y sincronización (versión 3)

## Qué incluye
- **Menú superior horizontal** para computadora y celular.
- **Portada limpia**: tabla 2026, fecha actual, últimos movimientos y boletín 2026.
- **Mercado**: altas y bajas por jugador, trades, picks y waiver/FAAB, filtrado por semana y tipo.
- **Draft board**: orden de elección horizontal y **todas** las rondas y picks obtenidos desde Sleeper.
- **Diario LFA** separado de **Hechos históricos**.
- **Récords 2026**, ranking parcial y paternidades 2026 basados en resultados semanales de Sleeper, con archivo histórico heredado aparte para no sumar semanas duplicadas.
- 9 escudos de la liga originales con **fondo transparente**.

## Primera prueba
Abrí `index.html` o subí esta carpeta a Netlify. Recomendado: un hosting web con HTTPS y dominio (no `file://`), ya que el navegador debe acceder a la API de Sleeper. No contiene credenciales personales.

## Activar sincronización de fondo real cada 6 horas
1. Creá un repositorio de GitHub con **el contenido** de esta carpeta en la raíz.
2. Activá **GitHub Actions** y asegurate de habilitar `Settings → Actions → General → Workflow permissions → Read and write permissions` si tu repo no lo tiene.
3. Abrí `Actions → Actualizar LFA desde Sleeper → Run workflow` para realizar la primera captura.
4. Conectá ese repositorio en **Netlify → Add new project → Import existing project**. Publicá desde la raíz (`.`), sin build command.
5. Cada seis horas, GitHub Actions intenta consultar Sleeper, escribir los JSON de `data/` y hacer un commit. Ese commit dispara un nuevo despliegue en Netlify; si no hubo datos válidos o falla la API, no se publica un snapshot inventado.

**Estado actual:** automatización incluida en código, no instalada ni activada en GitHub/Netlify. Al abrir la web se hace consulta directa a Sleeper y una nueva consulta cada 30 minutos si la pestaña está visible.

## Lógica editorial
Las noticias automáticas son **resúmenes estructurados** de datos de Sleeper, no reportes periodísticos de NFL. Los estados de lesión se identifican siempre como etiquetas de Sleeper, no como partes médicos confirmados. Las cargadas se basan en resultados reales, no hay noticias ficticias.

## Advertencias sobre récords y paternidades
La página previa carece de fecha de corte en algunas estadísticas 2026. Por eso, `legacy_h2h_review.json` y `legacy_rankings_review.json` siguen en revisión. Para construir un **récord histórico total semanal actualizado**, hay que certificar el historial 2019–2025 y la fecha exacta de cierre de ese archivo. **No sumamos** datos parciales de 2026 que puedan estar duplicados.

Consultá `FUENTES_Y_VALIDACIONES.md` para la auditoría.
