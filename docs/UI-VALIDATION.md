# Validación de UI / UX · 5 septiembre 2026

Publicado: https://tataportal.github.io/curwen_arkiv/
Repositorio: https://github.com/tataportal/curwen_arkiv
Build publicado: https://github.com/tataportal/curwen_arkiv/actions/runs/33993424338

## Resultado y estados

- Home: una sola línea de búsqueda. Sin logo, navegación, tarjetas ni información de relleno.
- Transición: al enviar con Enter, la búsqueda sube y aparece automáticamente el mapa detrás. URL compartible y botón Atrás conservan la consulta.
- Red: nodo derivado del texto del usuario; selección, segundo término, controles de zoom/centrado y desplazamiento. Dos términos permanecen sin conectar cuando no hay evidencia.
- Resultados: componentes implementados y pruebas de agrupación superadas. Momentos como evidencia secundaria desplegable, agrupados por episodio sin alterar clusters. No se pudo verificar un resultado real de búsqueda por el fallo actual de la RPC.
- Timestamps: enlaces externos exactos a YouTube y segundos enteros, sin reproductor modal. Verificados en pruebas de componentes.
- Archivo: lista cronológica conectada al catálogo real, filtro por título, orden y paginación. Estado vacío comprobado con una consulta real sin coincidencias.
- Episodio: UI de documento y búsqueda local en transcripción implementadas. La visualización con una transcripción real queda bloqueada por la columna ausente en Supabase.
- Carga y error: indicadores lineales y anuncios accesibles; error separado de un resultado vacío.

## Bloqueos reales anteriores al cambio

Las consultas usan la capa real. No se introdujeron respuestas alternativas ni datos políticos ficticios.

1. Búsqueda: Supabase no encuentra `public.search_archive(page_number, page_size, query_text)`; la API local responde 503.
2. Episodio: `column transcript_chunks.cues does not exist`; la API local responde 503.
3. Red: no existe un servicio de relaciones/evidencia conectado. Las ramas, relaciones, caminos, selección de caminos y su evidencia son arquitectura frontend, no una red de conocimiento terminada.

No se ejecutaron migraciones ni reparaciones de la base.

## Verificación

- `npm run typecheck`: OK.
- `npm run build`: OK.
- `node scripts/build-pages.mjs`: OK, local y GitHub Actions.
- 12 pruebas: 5 frontend, 6 API, 1 reproductor conservado. Todas pasan.
- Hashes anteriores/posteriores coinciden para todos los archivos de `src/lib` y las tres rutas API.
- Navegador: home y flujo de búsqueda en escritorio y móvil (390 px), tanto versión local estática como home público; catálogo público conectado; foco visible al navegar con Tab; Enter envía; cierre del inspector devuelve el foco al nodo.
- `prefers-reduced-motion`: reglas verificadas en el CSS compilado. Desactivan desplazamientos animados, blur y transiciones; no se cambió la preferencia del sistema.
- Navegación pública `/episode/T9ojaSxdyGw?t=1112` llega a la página de episodio conservando ID y timestamp.
- Escaneo de fuentes a publicar y exportación: sin credenciales secretas ni service-role keys.
- La app publicada no contiene corpus local ni instrucciones de ingesta en la UI.

## Conservado y rendimiento

Se conservaron intactos APIs, RPC cliente, agrupación, parser, tipos, funciones de timestamp, ingesta, migraciones y corpus. YouTubeEmbed permanece en el código pero no se monta en los nuevos flujos.

CSS nativo para animación, sin nuevas dependencias. Red cargada después de la búsqueda, límite de 40 nodos. Transcripción renderizada por bloques de 160 filas y contenido diferido. No se midieron Core Web Vitals de campo. En Pages las consultas públicas en curso pueden terminar después de cambiar de búsqueda; se descartan las respuestas obsoletas.

## GitHub Pages

La publicación se hizo desde una copia de código aislada, sin subir el historial local que contiene el corpus. El checkout de publicación está en `/tmp/curwen-publish`; el proyecto original mantiene su historial local.

El build genera una copia estática temporal y usa las mismas funciones de datos con la clave pública de Supabase. Las rutas API del proyecto original siguen intactas. Pages utiliza `/episode/?id=VIDEO_ID` para admitir nuevos capítulos sin reconstruir el sitio. Los enlaces dinámicos entrantes pasan por el 404 de Pages y redirigen conservando parámetros; su primera respuesta HTTP es 404, limitación del hosting estático.

## Archivos modificados o creados por este trabajo

- `src/app/page.tsx`
- `src/components/Navbar.tsx`
- `src/app/layout.tsx`
- `src/components/Pagination.tsx`
- `src/components/ArchivePrimitives.tsx`
- `src/components/archive-client.ts`
- `src/components/SearchResults.tsx`
- `src/components/SearchExperience.tsx`
- `src/components/NetworkExplorer.tsx`
- `src/app/graph/page.tsx`
- `src/app/episodes/page.tsx`
- `src/app/episode/[youtube_id]/page.tsx`
- `src/app/episode/page.tsx`
- `src/components/EpisodeDetail.tsx`
- `src/app/globals.css`
- `scripts/build-pages.mjs`
- `.github/workflows/pages.yml`
- `docs/FRONTEND.md`
- `tests/frontend.test.tsx`
- `docs/UI-VALIDATION.md` (este informe)

Componentes principales: SearchExperience, SearchResults, NetworkExplorer, EpisodeDetail y ArchivePrimitives. Se sustituyó la presentación de Navbar, Pagination y las páginas de archivo/red/detalle.
