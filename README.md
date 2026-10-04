# Rutinas

Web app instalable (PWA) para registrar tus rutinas del gimnasio por grupo muscular (piernas, pecho, espalda, hombros, bíceps, tríceps y abdomen): peso, repeticiones y dificultad de cada serie, sugerencia de progresión y temporizador de descanso. No tiene dependencias ni paso de compilación.

## Funciones

- **Rutinas precargadas** por grupo muscular (piernas, pecho, espalda, hombros, bíceps, tríceps y abdomen), con rangos de repeticiones y descansos. Las de piernas son las originales; el resto son sugeridas y editables.
- **Registro por serie**: peso, repeticiones y dificultad (1–10), con nota opcional y marca de "técnica incompleta".
- **Sugerencia de progresión** (doble progresión, orientada a hipertrofia con 0–2 repeticiones en reserva):
  - Si no llegas al mínimo de repeticiones, baja el peso.
  - Si te sobraban repeticiones (dificultad ≤ 7) o llegas al tope con dificultad ≤ 8, sube el peso.
  - En otro caso, mantiene el peso.
  - Al abrir un ejercicio, el punto de partida sale de tu última sesión.
- **Temporizador de descanso** automático al registrar cada serie, con aviso sonoro y vibración.
- **Historial** de sesiones, con exportación a Markdown.
- **Copia de seguridad**: exportar e importar todos los datos en JSON.
- **Funciona sin conexión** una vez abierta (service worker).

La primera vez que se abre carga como ejemplo la sesión del 04-10-2026; puedes eliminarla desde el historial.

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
.github/workflows/    despliegue a GitHub Pages
```

## Nota

La app es una ayuda de registro y no sustituye la guía de un profesional de la salud o del entrenamiento.
