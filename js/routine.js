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
const PIERNAS = {
  id: 'piernas', name: 'Piernas',
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

const PECHO = {
  id: 'pecho', name: 'Pecho',
  exercises: [
    {
      id: 'press-pecho-maquina', name: 'Press de pecho en máquina',
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Escápulas atrás y abajo, codos a ~45°.'
    },
    {
      id: 'press-inclinado', name: 'Press inclinado con mancuernas',
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/mancuerna', step: 2, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Baja controlado hasta estirar el pecho.'
    },
    {
      id: 'aperturas-peck-deck', name: 'Aperturas en peck deck',
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Junta con control, pausa de 1 s al cerrar.'
    },
    {
      id: 'cruce-poleas', name: 'Cruce de poleas',
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Ligera flexión de codos constante.'
    },
    {
      id: 'fondos-asistidos', name: 'Fondos asistidos',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg asistencia', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Torso inclinado hacia adelante para enfatizar el pecho.'
    }
  ]
};

const ESPALDA = {
  id: 'espalda', name: 'Espalda',
  exercises: [
    {
      id: 'jalon-pecho', name: 'Jalón al pecho',
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Lleva los codos hacia las costillas, sin balancear.'
    },
    {
      id: 'remo-maquina', name: 'Remo sentado en máquina',
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Pecho apoyado, pausa de 1 s al contraer.'
    },
    {
      id: 'remo-mancuerna', name: 'Remo con mancuerna',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Anota cada lado si difieren.'
    },
    {
      id: 'pullover-polea', name: 'Pullover en polea',
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Brazos casi rectos, siente el dorsal.'
    },
    {
      id: 'face-pull', name: 'Face pull',
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Trabaja deltoides posterior y escápulas.'
    },
    {
      id: 'extension-lumbar', name: 'Extensión lumbar',
      sets: 3, repMin: 10, repMax: 15, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin hiperextender arriba.'
    }
  ]
};

const HOMBROS = {
  id: 'hombros', name: 'Hombros',
  exercises: [
    {
      id: 'press-hombro-maquina', name: 'Press de hombros en máquina',
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin arquear la zona lumbar.'
    },
    {
      id: 'elevaciones-laterales', name: 'Elevaciones laterales',
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg/mancuerna', step: 1, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Codos ligeramente flexionados, sin impulso.'
    },
    {
      id: 'elevaciones-laterales-polea', name: 'Elevaciones laterales en polea',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 1.25, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Tensión constante durante todo el recorrido.'
    },
    {
      id: 'pajaros', name: 'Pájaros (deltoides posterior)',
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Peck deck invertido o mancuernas inclinado.'
    },
    {
      id: 'encogimientos', name: 'Encogimientos de trapecio',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 2, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sube recto, sin rotar los hombros.'
    }
  ]
};

const BICEPS = {
  id: 'biceps', name: 'Bíceps',
  exercises: [
    {
      id: 'curl-barra', name: 'Curl con barra',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Codos pegados al torso.'
    },
    {
      id: 'curl-inclinado', name: 'Curl inclinado con mancuernas',
      sets: 3, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 1, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Mayor estiramiento en la parte baja.'
    },
    {
      id: 'curl-martillo', name: 'Curl martillo',
      sets: 3, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 1, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Trabaja braquial y braquiorradial.'
    },
    {
      id: 'curl-predicador', name: 'Curl en banco predicador',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Baja completo sin rebotar.'
    }
  ]
};

const TRICEPS = {
  id: 'triceps', name: 'Tríceps',
  exercises: [
    {
      id: 'extension-polea', name: 'Extensión en polea (cuerda)',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Abre la cuerda abajo, codos fijos.'
    },
    {
      id: 'press-frances', name: 'Press francés',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Baja controlado hacia la frente o detrás de la cabeza.'
    },
    {
      id: 'extension-sobre-cabeza', name: 'Extensión sobre la cabeza',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Gran estiramiento de la cabeza larga.'
    },
    {
      id: 'fondos-banco', name: 'Fondos en paralelas o banco',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg adicional', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Torso vertical para enfatizar el tríceps.'
    }
  ]
};

const CORE = {
  id: 'core', name: 'Abdomen / Core',
  exercises: [
    {
      id: 'crunch-maquina', name: 'Crunch en máquina',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Redondea la columna, exhala al contraer.'
    },
    {
      id: 'elevacion-piernas', name: 'Elevación de piernas colgado',
      sets: 3, repMin: 10, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg adicional', step: 0, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin balanceo; inclina la pelvis hacia arriba.'
    },
    {
      id: 'crunch-polea', name: 'Crunch en polea alta',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Caderas fijas, flexiona el tronco.'
    },
    {
      id: 'rotacion-polea', name: 'Rotación en polea (leñador)',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Gira desde el tronco, no los brazos.'
    },
    {
      id: 'plancha', name: 'Plancha (segundos)',
      sets: 3, repMin: 30, repMax: 60, rest: 60, restText: '60 s',
      unit: 'kg adicional', step: 0, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Las "repeticiones" son segundos de mantención.'
    }
  ]
};

const ROUTINES = [PIERNAS, PECHO, ESPALDA, HOMBROS, BICEPS, TRICEPS, CORE];
