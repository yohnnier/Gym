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
- **Datos privados:** la app los sincroniza con el repositorio **privado** `yohnnier/gym-datos` (archivo `datos.json`, secciones body, cardio, weight, waist, labs, dose; gana la sección modificada más recientemente), usando el mismo token. Si el token no tiene permiso para ese repositorio, todo sigue funcionando solo en el celular. El repositorio `Gym` (público) **nunca** debe recibir esos datos. Para leerlos desde una sesión hay que añadir `gym-datos` con `add_repo`.
- **Privacidad:** el repositorio es público. Peso, composición corporal, calorías basales, cardio y pulso se guardan solo en el `localStorage` del celular. **No subas datos personales** al repositorio. `data/sessions.json` solo tiene el historial de pesas.
- **Unidades de peso:** cada ejercicio tiene `unit` (`kg`, `kg/lado`, `lb`, `kg adicional`…). La app compara números tal cual; si cambias una unidad, hay que **corregir también los registros ya guardados** o las gráficas mienten (ya pasó con el press de pecho).
- Probar: Playwright está instalado (`NODE_PATH=$(npm root -g) node script.js`) y Chromium viene incluido. Sirve con `python3 -m http.server`. Para cronómetros usa `page.clock`.
- Imágenes de ejercicios: `img/ex/<id>-0.jpg` y `-1.jpg`, 480×320, de free-exercise-db (dominio público: https://github.com/yuhonas/free-exercise-db, carpeta `exercises/`). El usuario prefiere **fotos reales**, no dibujos.

## Dónde está cada cosa
- `js/routine.js`: ejercicios por grupo (`PIERNAS`, `PECHO`…), `PLAN` (días del plan), `MUSCLES`, `ROUTINES`.
- `js/app.js`: toda la lógica, por secciones: progresión por ejercicio, volumen semanal (meta de 10 series por músculo), temporizador y cronómetro, banda de pulso Bluetooth (`hrm*`), intervalos guiados (`hiit*`), nube con GitHub (`gh*`), Mi cuerpo, Cardio, vistas (`renderHome`, `renderGroup`, `renderProg`, …).
- `css/style.css`, `sw.js`, `manifest.webmanifest`, `index.html`, `data/sessions.json`.

## Plan actual (6 días, pesas y cardio intercalados)
1 Empuje (+ crunch en polea) · 2 Cardio intervalos guiados + pantorrillas · 3 Tirón (+ laterales en polea) · 4 Cardio zona 2 + core (silla romana, rollout, leñador; sin intervalos: es la víspera de piernas) · 5 Piernas (con hiperextensión 45° como bisagra de cadera: al usuario no le gusta el peso muerto) · 6 Cardio suave (sin ejercicios).
- Criterio acordado con el usuario: sin ejercicios redundantes y músculos repartidos según recuperación (pantorrillas días 2 y 5, abdomen 1 y 4, hombro lateral 1 y 3). Series directas por ciclo: pecho 10, espalda 10, hombros 13, bíceps 8, tríceps 6, cuádriceps 9, isquios 8 (meta propia 8), glúteos 7, pantorrillas 8, abdomen 12.
- A futuro (propuesto, no aplicado): esquema torso/pierna con 4 días de pesas para entrenar cada músculo 2 veces por semana. El indicador de recuperación por músculo ya está en el Inicio (`recovery()`/`recoveryCard()`: grandes 72 h, pequeños 48 h, indirecto un día menos).
- "Siguiente" = el día que sigue al último hecho (cuenta pesas y cardio); ver `planNext()`.
- Los ids de día (`dia-empuje`, `dia-cardio-2`, `dia-cardio`, `dia-cardio-3`…) están guardados en los registros: no los renombres.

## Nutrición: se registra desde el chat
El usuario dice lo que comió (p. ej. "desayuno: 3 huevos, 100 g de yogurt griego y un kiwi"). Tú:
1. Estimas kcal, proteína, carbohidratos y grasa por alimento (con gramos) y agregas una entrada a `data/nutrition.json`:
   `{"id": "<único>", "date": "AAAA-MM-DD", "meal": "desayuno|almuerzo|colación|cena", "items": [{"food": "Huevo entero", "g": 150, "kcal": 215, "prot": 19, "carb": 1, "fat": 15}], "kcal": …, "prot": …, "carb": …, "fat": …, "notes": "supuestos: crudo/cocido, aceite…"}`
   (los totales de la entrada son la suma de sus items; redondea a 1 decimal).
2. Commit directo a `main` ("Nutrición: <comida> <fecha>"), igual que las sesiones: `git fetch origin main`, parte de `origin/main`, nunca reescribas historia.
3. Respondes siempre con el **acumulado del día y lo que queda** frente a la meta del día.
- **Zona horaria del usuario: Santiago de Chile (`America/Santiago`).** El servidor está en UTC: para la fecha del registro usa `TZ=America/Santiago date +%F`, no la fecha UTC (de noche en Chile, en UTC ya es el día siguiente).
- **Metas** en `js/routine.js` (`NUTRITION`): pesas (Empuje, Tirón, Piernas) 2.100 kcal · 155 g prot · 230 g carb; descanso o cardio suave (días 4 y 6) 1.950 kcal · 155 g · 170 g; intervalos (día 2) 2.050 kcal · 155 g · 195 g; piernas +150 kcal en carbohidratos; cardio libre extra: la meta sube la mitad de lo quemado (neto, MET−1), en carbohidratos. Grasa = lo que queda. Tipo de día: sesión de pesas registrada ese día; si no hay, el siguiente día del plan (`dayTypeOf()` en `js/app.js`).
- **La app** lee `data/nutrition.json`: "Nutrición de hoy" en el Inicio; "Nutrición · últimos 7 días" y "Evaluación de la semana" (series, proteína, déficit, cardio, peso/grasa, fuerza y sugerencia de ±150 kcal) en Progreso.
- **Alimentos frecuentes (etiquetas):** yogurt griego 100 g = 65 kcal, 8,8 g prot, 5,9 g carb, 0,7 g grasa (200 g = 130 kcal). Pan 2 rebanadas (64 g) = 137 kcal, 7 g prot, 26 g carb, 0,6 g grasa. Proteína vegana Revitta (soya, arveja, arroz) 1 medida (33 g) = 119 kcal, 24 g prot, 2,6 g carb, 1,4 g grasa. **Evita la avena**: le sube el azúcar; no la sugieras.
- **Objetivo:** recomposición (perder grasa y ganar músculo).
- **Datos del cuerpo** (peso, % grasa, basales, peso objetivo): NO están en el repo por privacidad; están en la app (Mi cuerpo). Si los necesitas para calcular, pídeselos al usuario.
- `data/nutrition.json` es público (repositorio público); el usuario lo aceptó al pedir este registro.

## Pendiente / por confirmar con el usuario
1. **Press de pecho del 5 de octubre:** ¿el 80 que se anotó era peso total o por lado? Hoy el ejercicio es `kg/lado` y la gráfica dice "bajaste 20". Según su respuesta, corregir `data/sessions.json` (y que las sesiones locales no lo pisen: la app une por `id` y `updatedAt`).
2. Confirmar si **prensa, hip thrust y abductores** son realmente "por lado".
3. La app **no permite corregir una sesión pasada**: agregar edición de pesos/reps en el Historial.
4. **"Plancha (segundos)"** del grupo Abdomen se trata como repeticiones con "kg adicional": corregir para que sea en segundos, o quitarla.
5. La **banda de pulso Bluetooth** solo se probó con una banda simulada; falta probar con una real (Android/Chrome; en iPhone sirve Bluefy).
6. Ideas: guardar más campos del informe Fitdays (peso objetivo, peso sin grasa, grasa subcutánea), leer el PDF del informe dentro de la app.
