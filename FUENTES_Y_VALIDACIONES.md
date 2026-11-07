# LFA — Informe de auditoría inicial

## Datos aceptados como base oficial
- Ocho franquicias y managers, escudos y estabilidad de propietarios, confirmados por la liga el 7/11/2026.
- 2018 «Nuevos Santos»: **campeonato de prehistoria**, excluido de títulos oficiales.
- Campeones y marcadores de finales 2019–2025: reconstrucción del material histórico LFA previamente aportado.
- Tabla completa de fase regular de 2025: fuente LFA guion maestro. Los resultados están etiquetados «histórico documentado».

## Archivo antiguo recuperado
Origen: `https://github.com/FantasyLFA/FantasyLFA` y la web estática `https://fantasylfa.github.io/FantasyLFA/index.html`.

- `stats.txt`: puntos por equipo y año 2019–2026, win rate, puntos totales. La fuente incluye 2026 **sin fecha de corte**. No sumar esos datos a la temporada actual hasta verificar.
- `paternidades.txt`: 28 cruces únicos con registros de temporada regular y playoffs. La fecha de corte no se puede establecer desde el texto.
- `ranking.txt`: ocho puntuaciones de un ranking legado. Fórmula expuesta en `Ranking.html`: victoria +10; playoffs primeros dos +25, tercero/cuarto +20; final +10; campeonato +30; +1 por 250 PF; terminar 7.º/8.º –15; dividido entre los partidos disputados en fase regular. Se conserva como métrica **legada provisional**, no como ranking estadístico vigente.
- `historialFantasyV3.xlsx` aparece en el repositorio viejo pero **no fue leído ni auditado** en esta ejecución. Puede aportar una buena fuente para recuperar la información semana a semana.

## Inconsistencias y pendientes
1. En los puntos históricos antiguos aparece «Landa»; en el archivo de paternidades aparece «Nehue», y el usuario confirmó a Nehue como manager de Cougars FT. Se mantienen los puntos bajo la etiqueta **Landa**, sin asignar automáticamente a Cougars.
2. Chevito en 2019 y Naki en 2019–2021 figuran con 0 puntos en `stats.txt`. No concluir que no participaban sin comprobar el archivo fuente.
3. El subcampeón 2019 figura como «Mejor no decirlo», que no coincide con las ocho franquicias confirmadas de la liga actual. Se guarda como nombre histórico sin crear una franquicia nueva.
4. «Tiburoncín», «Tiburoncin UH JAJA», «Tiburoncín UH JA JA» se tratan como alias del mismo equipo.
5. «Gaspe» y «Gaspi», «Emily» y «Emilio», «Juany» y «Juani» se tratan como alias de manager para búsquedas, pero **no** implican que cualquier usuario de Sleeper con nombre parecido sea el mismo: se requieren coincidencias inequívocas o un vínculo manual.
6. Los apartados «mejor jugador de cada equipo campeón» del sitio viejo **no se han incluido**.
7. Las estadísticas Sleeper 2026 no pudieron verificarse desde esta máquina. El sitio las solicita en tiempo real en el navegador y muestra «No disponible» si falla la conexión, en vez de llenar tablas con ejemplos ficticios.

## Para certificar el ranking histórico
Se necesitan resultados semanales originales por temporada (o exportación verificable) para recalcular total de partidos, victorias, PF, PA, rachas, paternidades y probabilidades sin doble conteo.

## Versión 3 — cómo se actualiza

- Archivo histórico 2019–2025 y 2018 no profesional: permanece separado del feed de datos de 2026.
- Los resultados de 2026 y sus récords/paternidades se recalculan **solo con semanas ya concluidas antes de la semana vigente en Sleeper**. No cuentan empates como victorias.
- **No se suman** las 28 parejas de `legacy_h2h_review.json` con los cruces de 2026, porque el archivo antiguo no tiene fecha de corte y puede incluir parte de 2026. Este es un bloqueo deliberado para evitar dobles conteos.
- El ranking de 2026 se muestra **parcial**: +10 por victoria, +1 por cada 250 PF, normalizado por partidos jugados. Bonificaciones de playoffs y cierre final de temporada según el archivo antiguo no se aplican hasta auditarlas.
- Sleeper permite datos de ligas, rosters, drafts, picks, partidos, transacciones y estado de jugadores; no ofrece en esa API un servicio de noticias periodísticas verificadas. Las notas generadas derivan únicamente de registros observables y distinguen folklore de hechos.
- El catálogo de jugadores (`/players/nfl`) se actualiza como máximo una vez cada 24 horas desde el proceso automático, siguiendo la documentación de Sleeper.
- GitHub Actions ejecutará `scripts/sync_sleeper.py` cada seis horas **solamente una vez que el código se suba a GitHub con Actions activo y permisos de escritura**. GitHub puede demorar/deshabilitar la tarea; no hay garantía de ejecución puntual. Netlify debe vincularse al repositorio para redesplegar por cada cambio. Sin estas configuraciones, la página consulta directamente Sleeper al abrirse y mientras esté abierta (cada 30 minutos).
- Las cifras 2026 no se consultaron ni validaron contra el ID específico desde el entorno de desarrollo; la API no fue accesible aquí.
