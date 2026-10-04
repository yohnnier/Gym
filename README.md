# Rutinas

Web app instalable (PWA) para registrar tus rutinas del gimnasio por grupo muscular (piernas, pecho, espalda, hombros, bíceps, tríceps y abdomen): peso, repeticiones y dificultad de cada serie, sugerencia de progresión y temporizador de descanso. No tiene dependencias ni paso de compilación.

## Funciones

- **Plan de 3 días** (empuje / tirón + abdomen / piernas), con tres tarjetas en el inicio, editable en `js/routine.js` (`PLAN`). El inicio marca el **siguiente** día según el último que hiciste.
- **Inicio**: saludo, resumen, el plan de 3 días, **meta de la semana**: cuántas series lleva cada músculo de las 10 recomendadas y cuántas le faltan . Los grupos musculares sueltos están en la pestaña Rutinas.
- **Página por grupo** (piernas, pecho, espalda, hombros, bíceps, tríceps y abdomen): cada ejercicio muestra su imagen, tu **último registro** y, al lado, las filas para registrar **hoy**. La fecha se guarda sola.
- **Sugerencia por ejercicio** (doble progresión orientada a hipertrofia):
  - Si completaste el tope de repeticiones en todas las series (o te sobraban, dificultad ≤ 7): **sube el peso** y vuelve al mínimo del rango. Si el salto supera el 15 % del peso (p. ej. mancuernas ligeras), primero pide 3 repeticiones más.
  - **Estancamiento**: 3 sesiones sin superar la anterior → **descarga** (~90 % del peso, 3–4 reps en reserva).
  - Bajo el mínimo **dos sesiones seguidas**: **baja el peso**. Si fue una sola, mantiene el peso.
  - En otro caso: **mantén el peso y suma +1 repetición** por serie.
  - Las filas vienen prellenadas con el peso y las repeticiones sugeridas; durante la sesión se ajustan según la serie anterior.
- **Imágenes de las máquinas**: toca la imagen para verla grande (inicio y final del movimiento) o **cambiarla por una foto de tu gimnasio** (queda guardada en el dispositivo).
- **Cronómetro** en la cabecera (libre, para planchas o tiempo total) con **descansos rápidos** de 45 s a 3 min. El descanso también arranca solo al registrar cada serie, con aviso sonoro y vibración.
- **Progreso** por ejercicio e **Historial** de sesiones, con exportación a Markdown y copia de seguridad en JSON.
- **Funciona sin conexión** una vez abierta (service worker) y se adapta a modo claro u oscuro.

## Registrar desde el chat

El historial publicado está en `data/sessions.json`. La app lo une con lo que registres en el dispositivo.

## Probar en local

Abre `index.html` directamente, o sirve la carpeta (el modo sin conexión e instalación requieren servidor):

```bash
python3 -m http.server 8000
# luego visita http://localhost:8000
```

## Publicar en GitHub Pages

1. Crea un repositorio vacío en GitHub (por ejemplo `rutinas`).
2. Sube el proyecto:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/rutinas.git
   git push -u origin main
   ```

3. En el repositorio, ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. El workflow `.github/workflows/pages.yml` publica la app en cada push a `main`. La URL será `https://TU_USUARIO.github.io/rutinas/`.
5. Ábrela en el celular y usa **Agregar a pantalla de inicio** para instalarla.

## Personalizar la rutina

Edita `js/routine.js`: ejercicios, series, rangos de repeticiones, descansos, unidades y el salto de peso (`step`). Los rangos de **sentadilla pendular** y **prensa** son provisorios (no estaban definidos en la rutina original); ajústalos.

## Datos

Los registros se guardan en el `localStorage` del navegador de cada dispositivo. No hay servidor ni cuentas. Exporta una copia desde la pestaña **Rutina → Datos** de vez en cuando, y úsala para pasar tus datos a otro dispositivo.

## Estructura

```
index.html            página principal
css/style.css         estilos
js/routine.js         datos de la rutina y sesión de ejemplo
js/app.js             lógica: registro, progresión, temporizador, historial
sw.js                 service worker (modo sin conexión)
manifest.webmanifest  instalación como app
icons/icon.svg        icono
img/ex/               imágenes de los ejercicios (inicio y final)
data/sessions.json    historial publicado
.github/workflows/    despliegue a GitHub Pages
```

## Créditos

Imágenes de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), dominio público (Unlicense).

## Nota

La app es una ayuda de registro y no sustituye la guía de un profesional de la salud o del entrenamiento.
