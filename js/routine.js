/* Datos de la rutina. Edita este archivo para cambiar ejercicios, rangos o descansos.
 *
 * Campos:
 *  id, name        identificador y nombre
 *  sets            numero de series objetivo (setsText: texto si es un rango)
 *  repMin/repMax   rango de repeticiones
 *  rest/restText   descanso en segundos para el temporizador / texto mostrado
 *  unit            unidad del peso (kg, kg/lado, kg/pierna)
 *  step            salto de peso al progresar
 *  perLeg          true si las repeticiones son por pierna
 *  provisional     true si el rango no venia en tu rutina original (ajustalo)
 */
const ROUTINE = {
  name: 'Piernas',
  exercises: [
    {
      id: 'sentadilla-pendular', name: 'Sentadilla pendular',
      sets: 3, repMin: 8, repMax: 10, rest: 120, restText: '2 min',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso provisorios: no estaban definidos en la rutina original.'
    },
    {
      id: 'prensa', name: 'Prensa',
      sets: 3, repMin: 10, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 5, provisional: true,
      notes: 'Rango y descanso provisorios: no estaban definidos en la rutina original.'
    },
    {
      id: 'curl-femoral', name: 'Curl femoral sentado',
      sets: 3, repMin: 10, repMax: 15, rest: 90, restText: '75–90 s',
      unit: 'kg', step: 2.5,
      notes: 'Objetivo: quedar con 0–2 repeticiones en reserva.'
    },
    {
      id: 'hip-thrust', name: 'Hip thrust en máquina',
      sets: 3, repMin: 10, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg/lado', step: 2.5,
      notes: 'Peso exigente con buena técnica. Pausa de 1 s arriba.'
    },
    {
      id: 'extension-cuadriceps', name: 'Extensión de cuádriceps',
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 7.5,
      notes: 'Controla especialmente la bajada. La máquina salta de 47,5 a 55 kg.'
    },
    {
      id: 'abductores', name: 'Abductores',
      sets: 3, repMin: 15, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg/lado', step: 2.5,
      notes: 'Máquina de discos. Si inclinas el torso un poco hacia adelante cargas más el glúteo.'
    },
    {
      id: 'patada-gluteo', name: 'Patada de glúteo en máquina',
      sets: 3, setsText: '2–3', repMin: 12, repMax: 15, perLeg: true, rest: 60, restText: '60 s',
      unit: 'kg/pierna', step: 2.5,
      notes: 'Pausa de 1 s arriba, sin arquear la zona lumbar. Anota cada pierna si difieren.'
    },
    {
      id: 'pantorrillas', name: 'Pantorrillas en máquina',
      sets: 4, repMin: 12, repMax: 20, rest: 90, restText: '60–90 s',
      unit: 'kg', step: 2.5,
      notes: 'Máquina sentada de carga única (discos en un solo lado). Pausa de 1 s abajo, sin rebotar.'
    }
  ]
};

/* Sesion de ejemplo: la del 04-10-2026. Se carga solo la primera vez. */
const SEED_SESSION = {
  id: 'seed-2026-10-04',
  date: '2026-10-04',
  createdAt: 1790000000000,
  entries: [
    { exerciseId: 'sentadilla-pendular', set: 1, weight: 45, reps: 8, rpe: null },
    { exerciseId: 'sentadilla-pendular', set: 2, weight: 45, reps: 8, rpe: null },
    { exerciseId: 'sentadilla-pendular', set: 3, weight: 45, reps: 8, rpe: null },

    { exerciseId: 'prensa', set: 1, weight: 55, reps: 12, rpe: null },
    { exerciseId: 'prensa', set: 2, weight: 70, reps: 12, rpe: null },
    { exerciseId: 'prensa', set: 3, weight: 70, reps: 12, rpe: null },

    { exerciseId: 'curl-femoral', set: 1, weight: null, reps: 12, rpe: 8, note: 'Peso no registrado' },
    { exerciseId: 'curl-femoral', set: 2, weight: 58.5, reps: 12, rpe: 8 },
    { exerciseId: 'curl-femoral', set: 3, weight: 65, reps: 12, rpe: 9 },

    { exerciseId: 'extension-cuadriceps', set: 1, weight: 47.5, reps: 14, rpe: 6, note: 'Dificultad media' },
    { exerciseId: 'extension-cuadriceps', set: 2, weight: 55, reps: 12, rpe: 9, note: '11 limpias + 1 con esfuerzo' },
    { exerciseId: 'extension-cuadriceps', set: 3, weight: 55, reps: 10, rpe: 10 },

    { exerciseId: 'hip-thrust', set: 1, weight: 25, reps: 12, rpe: 7 },
    { exerciseId: 'hip-thrust', set: 2, weight: 30, reps: 12, rpe: 9 },
    { exerciseId: 'hip-thrust', set: 3, weight: 30, reps: 10, rpe: 10 },

    { exerciseId: 'abductores', set: 1, weight: 15, reps: 12, rpe: 9 },
    { exerciseId: 'abductores', set: 2, weight: 10, reps: 18, rpe: 9 },
    { exerciseId: 'abductores', set: 3, weight: 10, reps: 32, rpe: 9, note: 'Con más descanso del indicado' },

    { exerciseId: 'patada-gluteo', set: 1, weight: 5, reps: 15, rpe: 6 },
    { exerciseId: 'patada-gluteo', set: 2, weight: 10, reps: 15, rpe: 8 },
    { exerciseId: 'patada-gluteo', set: 3, weight: 15, reps: 13, rpe: 10, note: 'Sin lograr la pausa de 1 s arriba', badTech: true },

    { exerciseId: 'pantorrillas', set: 1, weight: 30, reps: 15, rpe: 9 },
    { exerciseId: 'pantorrillas', set: 2, weight: 30, reps: 15, rpe: 9 },
    { exerciseId: 'pantorrillas', set: 3, weight: 30, reps: 14, rpe: 10 },
    { exerciseId: 'pantorrillas', set: 4, weight: 30, reps: 9, rpe: 10 }
  ]
};
