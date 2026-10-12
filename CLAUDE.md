# Rutinas — guía para quien continúe el proyecto

PWA en JavaScript puro (sin dependencias ni compilación) para registrar rutinas de gimnasio y cardio. El dueño la usa en el celular, en el gimnasio. Se publica en GitHub Pages con el workflow `.github/workflows/pages.yml` en **cada push a `main`**.

## Cómo trabajar con el usuario
- Habla **español**, claro y corto. Escribe rápido y con errores de tipeo: interpreta la intención. Valora que le expliques el "porqué" en palabras simples.
- Suele pedir un cambio, lo ve en el celular y lo corrige. Haz el cambio, pruébalo y dile cómo verlo en la app.
- Para que vea un cambio hay que **subirlo a `main`**. Él normalmente lo quiere publicado; avísale siempre cuando lo hagas. No abras pull requests salvo que los pida.
- Después de publicar, dile que cierre la app por completo y la abra con internet (service worker); a veces hay que abrirla dos veces.

## Reglas técnicas importantes
- **Sube la versión del service worker** en `sw.js` (`const CACHE = 'rutinas-vNN'`) en cada cambio, y agrega a su lista `ASSETS` las imágenes nuevas de ejercicios (`<id>-0.jpg`).
- **`main` también recibe commits de la propia app** ("Registro desde la app: …", archivo `data/sessions.json`), porque el usuario conectó la nube. Antes de subir: `git fetch origin main`, parte de `origin/main` y nunca reescribas su historial.
- **Privacidad:** el repositorio es público. Peso, composición corporal, calorías basales, cardio y pulso se guardan solo en el `localStorage` del celular. **No subas datos personales** al repositorio. `data/sessions.json` solo tiene el historial de pesas.
- **Unidades de peso:** cada ejercicio tiene `unit` (`kg`, `kg/lado`, `lb`, `kg adicional`…). La app compara números tal cual; si cambias una unidad, hay que **corregir también los registros ya guardados** o las gráficas mienten (ya pasó con el press de pecho).
- Probar: Playwright está instalado (`NODE_PATH=$(npm root -g) node script.js`) y Chromium viene incluido. Sirve con `python3 -m http.server`. Para cronómetros usa `page.clock`.
- Imágenes de ejercicios: `img/ex/<id>-0.jpg` y `-1.jpg`, 480×320, de free-exercise-db (dominio público: https://github.com/yuhonas/free-exercise-db, carpeta `exercises/`). El usuario prefiere **fotos reales**, no dibujos.

## Dónde está cada cosa
- `js/routine.js`: ejercicios por grupo (`PIERNAS`, `PECHO`…), `PLAN` (días del plan), `MUSCLES`, `ROUTINES`.
- `js/app.js`: toda la lógica, por secciones: progresión por ejercicio, volumen semanal (meta de 10 series por músculo), temporizador y cronómetro, banda de pulso Bluetooth (`hrm*`), intervalos guiados (`hiit*`), nube con GitHub (`gh*`), Mi cuerpo, Cardio, vistas (`renderHome`, `renderGroup`, `renderProg`, …).
- `css/style.css`, `sw.js`, `manifest.webmanifest`, `index.html`, `data/sessions.json`.

## Plan actual (6 días, pesas y cardio intercalados)
1 Empuje · 2 Cardio intervalos (sin ejercicios, sesión guiada) · 3 Tirón · 4 Cardio + abdomen · 5 Piernas · 6 Cardio suave (sin ejercicios).
- "Siguiente" = el día que sigue al último hecho (cuenta pesas y cardio); ver `planNext()`.
- Los ids de día (`dia-empuje`, `dia-cardio-2`, `dia-cardio`, `dia-cardio-3`…) están guardados en los registros: no los renombres.

## Pendiente / por confirmar con el usuario
1. **Press de pecho del 5 de octubre:** ¿el 80 que se anotó era peso total o por lado? Hoy el ejercicio es `kg/lado` y la gráfica dice "bajaste 20". Según su respuesta, corregir `data/sessions.json` (y que las sesiones locales no lo pisen: la app une por `id` y `updatedAt`).
2. Confirmar si **prensa, hip thrust y abductores** son realmente "por lado".
3. La app **no permite corregir una sesión pasada**: agregar edición de pesos/reps en el Historial.
4. **"Plancha (segundos)"** del grupo Abdomen se trata como repeticiones con "kg adicional": corregir para que sea en segundos, o quitarla.
5. La **banda de pulso Bluetooth** solo se probó con una banda simulada; falta probar con una real (Android/Chrome; en iPhone sirve Bluefy).
6. Ideas: guardar más campos del informe Fitdays (peso objetivo, peso sin grasa, grasa subcutánea), leer el PDF del informe dentro de la app.
