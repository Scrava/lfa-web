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

## Datos en vivo y respaldo semanal
- **En vivo:** cada visitante consulta directamente a Sleeper al abrir la web. Si deja la pestaña visible, el sitio vuelve a consultar automáticamente cada 30 minutos. Estas consultas **no crean un deploy** en Netlify.
- **Respaldo:** GitHub Actions ejecuta `scripts/sync_sleeper.py` **una vez por semana**, los martes a las 12:17 UTC (09:17 de Argentina; GitHub puede retrasar el inicio). Actualiza los JSON de `data/` con datos verificados y hace commit solo si hay cambios; ese commit permite que Netlify vuelva a publicar el sitio.
- **Ejecución manual:** `GitHub → Actions → Actualizar LFA desde Sleeper → Run workflow`. Se puede usar cuando se requiera un respaldo extraordinario.
- **Hosting:** proyecto Netlify existente `fantasylfa`, conectado al repositorio `Scrava/lfa-web`, rama `main`, sin comando de compilación, con carpeta de publicación `.`.

**Importante:** el respaldo semanal no garantiza que las noticias guardadas sean instantáneas si la API de Sleeper falla en el navegador; se muestra la fecha de los datos respaldados. Para minimizar publicaciones, evitamos crear commits o despliegues por cada consulta de Sleeper.

## Lógica editorial
Las noticias automáticas son **resúmenes estructurados** de datos de Sleeper, no reportes periodísticos de NFL. Los estados de lesión se identifican siempre como etiquetas de Sleeper, no como partes médicos confirmados. Las cargadas se basan en resultados reales, no hay noticias ficticias.

## Advertencias sobre récords y paternidades
La página previa carece de fecha de corte en algunas estadísticas 2026. Por eso, `legacy_h2h_review.json` y `legacy_rankings_review.json` siguen en revisión. Para construir un **récord histórico total semanal actualizado**, hay que certificar el historial 2019–2025 y la fecha exacta de cierre de ese archivo. **No sumamos** datos parciales de 2026 que puedan estar duplicados.

Consultá `FUENTES_Y_VALIDACIONES.md` para la auditoría.
