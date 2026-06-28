# MonkeyMoney

Sitio web de educación financiera — juegos, biblioteca y comunidad.
© Beken Bauher Marin. Todos los derechos reservados.

## Estructura del proyecto

```
monkeymoney/
├── index.html          → Página de inicio (cifras del balance son dinámicas)
├── juegos.html         → Sala de juegos (tarjetas generadas desde data/games.json)
├── biblioteca.html     → Biblioteca (tarjetas generadas desde data/library.json)
├── comunidad.html      → Comentarios (Giscus, pendiente de activar)
├── game-player.html    → Carga cualquier juego .html dentro de un iframe
├── reader.html         → Lector de PDF en línea (PDF.js, sin descarga)
├── admin.html          → Panel local para organizar el catálogo (ver más abajo)
├── data/
│   ├── games.json      → Catálogo de juegos (lo edita admin.html)
│   └── library.json    → Catálogo de biblioteca (lo edita admin.html)
├── games/               → Aquí van tus archivos .html de juegos
│   └── presupuesto-express.html  → Juego funcional + plantilla de ejemplo
├── library/pdfs/         → Aquí van tus archivos .pdf de libros/guías/artículos
├── css/style.css
├── js/
│   ├── i18n.js              → Motor de traducción ES/EN
│   ├── main.js                → Menú móvil
│   ├── comments.js             → Carga Giscus cuando esté configurado
│   ├── games-render.js          → Dibuja las tarjetas de juegos
│   ├── library-render.js         → Dibuja las tarjetas de biblioteca
│   ├── home-stats.js              → Cifras dinámicas del balance en el home
│   └── vendor/pdfjs/               → PDF.js empaquetado localmente (sin CDN externo)
└── locales/
    ├── es.json
    └── en.json
```

## Cómo agregar o quitar un juego o un libro (panel admin)

Abre `admin.html` en tu navegador (con el sitio corriendo en un servidor local
o ya publicado). La clave por defecto es **monkeymoney** — cámbiala editando
la constante `ADMIN_PASSPHRASE` cerca del final de `admin.html` antes de
publicar el sitio. Esto **no es seguridad real** (no protege tu repositorio
de GitHub), solo evita que alguien entre por accidente. El panel no se
conecta a GitHub ni publica nada por sí mismo.

Flujo de trabajo:

1. En la pestaña **Juegos** o **Biblioteca**, llena el formulario y selecciona
   tu archivo `.html` o `.pdf` (el panel solo lee el nombre del archivo).
2. Pulsa **Agregar a la lista**. Para quitar algo, pulsa **Eliminar** en su fila.
3. Cuando la lista quede como quieres, pulsa **Descargar games.json /
   library.json actualizado**.
4. Reemplaza ese archivo dentro de la carpeta `data/` de tu repositorio.
5. Coloca el archivo real (`.html` o `.pdf`) en `games/` o `library/pdfs/`,
   con el mismo nombre que aparece en la columna "Archivo" del panel.
   Si vas a quitar algo, borra también su archivo real de esa carpeta.
6. Sube los cambios a GitHub (commit + push). El sitio se actualiza solo.

### Cómo preparar tus propios juegos .html

Cada juego es un archivo `.html` independiente y autocontenido (su propio
`<style>` y `<script>`, sin depender de archivos externos del sitio) que se
carga dentro de un iframe. Usa `games/presupuesto-express.html` como
plantilla: cópialo, cambia el contenido y la lógica, y guárdalo con un
nombre nuevo en la carpeta `games/`.

### Sobre los PDF de la biblioteca

Los PDF se muestran con un lector propio (`reader.html`, basado en PDF.js)
que dibuja cada página en un lienzo (`canvas`), por lo que no aparece botón
de descarga ni el visor nativo del navegador. Mantenlos livianos (menos de
5 MB) para que carguen rápido. Los dos PDF que vienen en `library/pdfs/`
son **de ejemplo** — reemplázalos por tus archivos reales con el mismo
nombre, o usa el panel para registrar el nombre de tus archivos nuevos.

## Cómo verlo en tu computadora antes de subirlo

Los textos y catálogos se cargan con `fetch`, así que **no funciona abriendo
`index.html` directamente con doble clic** (los navegadores bloquean esas
peticiones en archivos locales). Necesitas un servidor local muy simple. Si
tienes Python instalado:

```bash
cd monkeymoney
python3 -m http.server 8080
```

Y abres `http://localhost:8080` en tu navegador.

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `monkeymoney`).
2. Sube todo el contenido de esta carpeta a la raíz del repositorio.
3. Ve a **Settings → Pages**.
4. En "Source" selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda. En unos minutos tu sitio estará disponible en:
   `https://TU-USUARIO.github.io/monkeymoney/`

## Cómo activar los comentarios (Giscus)

Giscus usa GitHub Discussions como backend: es gratis, no tiene anuncios
y no rastrea a tus visitantes.

1. En tu repositorio, ve a **Settings → General → Features** y activa
   **Discussions**.
2. Entra a [https://giscus.app](https://giscus.app) y sigue los pasos:
   conecta el repositorio, elige la categoría de discusión (por ejemplo
   "General") y deja el mapeo en "pathname".
3. Esa página te dará 4 valores: `data-repo`, `data-repo-id`,
   `data-category` y `data-category-id`.
4. Abre `comunidad.html`, busca el bloque `<div id="giscus-comments" ...>`
   y reemplaza los valores de ejemplo por los tuyos.
5. Sube los cambios. El aviso de "comentarios próximamente" desaparece
   solo y los comentarios reales aparecen en su lugar.

## Cómo agregar idiomas o textos nuevos

Cada texto fijo de la interfaz (no los juegos/libros, que viven en sus
catálogos) tiene una "clave" (por ejemplo `hero.title.part1`) que aparece
como `data-i18n="hero.title.part1"` en el HTML, y su traducción vive en
`locales/es.json` y `locales/en.json`. Para agregar un idioma nuevo, crea
`locales/xx.json` con las mismas claves y agrégalo a la lista `SUPPORTED`
en `js/i18n.js`.

## Próximos pasos sugeridos

- Agregar los 3 juegos restantes (`La Trampa del Interés`, `Flujo de
  Caja`, `Riesgo y Paciencia`) con el panel admin y `games/` como guía.
- Reemplazar los 2 PDF de ejemplo por tus libros/artículos reales.
- Sustituir el dominio de GitHub Pages por un dominio propio
  (monkeymoney.com, por ejemplo) cuando estés listo — GitHub Pages lo
  permite gratis con un archivo `CNAME`.

