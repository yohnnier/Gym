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
 *  muscle          musculo principal (para contar el volumen semanal)
 *  secondary       musculos que tambien trabajan (solo informativo)
 */
const PIERNAS = {
  id: 'piernas', name: 'Piernas',
  exercises: [
    {
      id: 'sentadilla-pendular', name: 'Sentadilla pendular', muscle: 'cuadriceps', secondary: ['gluteos'],
      sets: 3, repMin: 8, repMax: 10, rest: 120, restText: '2 min',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso provisorios: no estaban definidos en la rutina original.'
    },
    {
      id: 'prensa', name: 'Prensa', muscle: 'cuadriceps', secondary: ['gluteos', 'isquios'],
      sets: 3, repMin: 10, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 5, provisional: true,
      notes: 'Rango y descanso provisorios: no estaban definidos en la rutina original.'
    },
    {
      id: 'curl-femoral', name: 'Curl femoral sentado', muscle: 'isquios', secondary: ['pantorrillas'],
      sets: 3, repMin: 10, repMax: 15, rest: 90, restText: '75–90 s',
      unit: 'kg', step: 2.5,
      notes: 'Objetivo: quedar con 0–2 repeticiones en reserva.'
    },
    {
      id: 'hip-thrust', name: 'Hip thrust en máquina', muscle: 'gluteos', secondary: ['isquios'],
      sets: 3, repMin: 10, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg/lado', step: 2.5,
      notes: 'Peso exigente con buena técnica. Pausa de 1 s arriba.'
    },
    {
      id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', muscle: 'cuadriceps',
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 7.5,
      notes: 'Controla especialmente la bajada. La máquina salta de 47,5 a 55 kg.'
    },
    {
      id: 'abductores', name: 'Abductores', muscle: 'gluteos',
      sets: 3, repMin: 15, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg/lado', step: 2.5,
      notes: 'Máquina de discos. Si inclinas el torso un poco hacia adelante cargas más el glúteo.'
    },
    {
      id: 'patada-gluteo', name: 'Patada de glúteo en máquina', muscle: 'gluteos', secondary: ['isquios'],
      sets: 3, setsText: '2–3', repMin: 12, repMax: 15, perLeg: true, rest: 60, restText: '60 s',
      unit: 'kg/pierna', step: 2.5,
      notes: 'Pausa de 1 s arriba, sin arquear la zona lumbar. Anota cada pierna si difieren.'
    },
    {
      id: 'pantorrillas', name: 'Pantorrillas en máquina', muscle: 'pantorrillas',
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
      id: 'press-pecho-maquina', name: 'Press de pecho en máquina', muscle: 'pecho', secondary: ['triceps', 'hombros'],
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Escápulas atrás y abajo, codos a ~45°.'
    },
    {
      id: 'press-inclinado', name: 'Press inclinado con barra', muscle: 'pecho', secondary: ['hombros', 'triceps'],
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 2.5, provisional: true,
      notes: 'Banco inclinado, barra con discos: anota el peso de los discos de un lado. Baja controlado hasta rozar la parte alta del pecho. Usa seguros o un compañero con cargas altas.'
    },
    {
      id: 'aperturas-peck-deck', name: 'Aperturas en peck deck', muscle: 'pecho', secondary: ['hombros'],
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Junta con control, pausa de 1 s al cerrar.'
    },
    {
      id: 'cruce-poleas', name: 'Cruce de poleas', muscle: 'pecho', secondary: ['hombros'],
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Ligera flexión de codos constante.'
    },
    {
      id: 'fondos-asistidos', name: 'Fondos asistidos', muscle: 'pecho', secondary: ['triceps', 'hombros'],
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
      id: 'jalon-pecho', name: 'Jalón al pecho (máquina de discos)', muscle: 'espalda', secondary: ['biceps'], single: true,
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 2.5, provisional: true,
      notes: 'Máquina "Universal Row" de discos: anota el peso de los discos de un lado. Asiento con los muslos bajo los topes. Lleva los codos hacia las costillas, pecho arriba, sin balancear el tronco.'
    },
    {
      id: 'remo-maquina', name: 'Remo sentado (máquina con selector)', muscle: 'espalda', secondary: ['biceps', 'hombros'], single: true,
      sets: 3, repMin: 10, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Ajusta el asiento para que el pecho quede apoyado. Tira llevando los codos hacia atrás, pausa de 1 s al contraer y estira completo al volver. Anota el peso que marca el selector (kg).'
    },
    {
      id: 'remo-mancuerna', name: 'Remo con mancuerna', muscle: 'espalda', secondary: ['biceps', 'hombros'],
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Anota cada lado si difieren.'
    },
    {
      id: 'pullover-polea', name: 'Pullover en polea', muscle: 'espalda', secondary: ['triceps'],
      sets: 3, repMin: 12, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Brazos casi rectos, siente el dorsal.'
    },
    {
      id: 'face-pull', name: 'Face pull', muscle: 'hombros', secondary: ['trapecio', 'espalda'],
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Trabaja deltoides posterior y escápulas.'
    },
    {
      id: 'extension-lumbar', name: 'Extensión lumbar', muscle: 'lumbar', secondary: ['gluteos', 'isquios'],
      sets: 3, repMin: 10, repMax: 15, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin hiperextender arriba.'
    },
    {
      id: 'remo-lineal', name: 'Remo con apoyo de pecho (Linear Row)', muscle: 'espalda', secondary: ['biceps', 'hombros'], single: true,
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 2.5, provisional: true,
      notes: 'Máquina de discos con apoyo de pecho y plataforma para los pies. Pecho apoyado, tira de los mangos llevando los codos atrás y junta los omóplatos. Pausa de 1 s y baja controlado. Anota los discos de un lado.'
    },
    {
      id: 'remo-alto-discos', name: 'Remo alto con discos', muscle: 'espalda', secondary: ['biceps', 'hombros'], single: true,
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg/lado', step: 2.5, provisional: true,
      notes: 'Máquina de discos con apoyo de pecho y brazos articulados. Opción para variar el jalón o el remo. Confirma el movimiento con el cartel de la máquina. Anota los discos de un lado.'
    }
  ]
};

const HOMBROS = {
  id: 'hombros', name: 'Hombros',
  exercises: [
    {
      id: 'press-hombro-maquina', name: 'Press de hombros en máquina', muscle: 'hombros', secondary: ['triceps'],
      sets: 3, repMin: 8, repMax: 12, rest: 120, restText: '2 min',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin arquear la zona lumbar.'
    },
    {
      id: 'elevaciones-laterales', name: 'Elevaciones laterales en máquina', muscle: 'hombros', secondary: ['trapecio'],
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg/lado', step: 2.5, provisional: true,
      notes: 'Máquina de discos: anota el peso de los discos de un lado. Sube hasta la altura de los hombros, sin impulso y sin encoger los hombros. Baja lento. La imagen es de referencia: toca la imagen para poner la foto de tu máquina.'
    },
    {
      id: 'elevaciones-laterales-polea', name: 'Elevaciones laterales en polea', muscle: 'hombros', secondary: ['trapecio'],
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 1.25, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Tensión constante durante todo el recorrido.'
    },
    {
      id: 'pajaros', name: 'Pájaros (deltoides posterior)', muscle: 'hombros', secondary: ['espalda', 'trapecio'],
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Peck deck invertido o mancuernas inclinado.'
    },
    {
      id: 'encogimientos', name: 'Encogimientos de trapecio', muscle: 'trapecio',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 2, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sube recto, sin rotar los hombros.'
    },
    {
      id: 'pajaros-polea', name: 'Pájaros en polea (cruce inverso)', muscle: 'hombros', secondary: ['espalda', 'trapecio'],
      sets: 3, repMin: 12, repMax: 20, rest: 60, restText: '60 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Poleas altas cruzadas: con cada mano toma el cable contrario y abre los brazos hacia los lados, con los codos ligeramente flexionados. Trabaja el hombro posterior; peso ligero y sin impulso.'
    }
  ]
};

const BICEPS = {
  id: 'biceps', name: 'Bíceps',
  exercises: [
    {
      id: 'curl-barra', name: 'Curl con barra', muscle: 'biceps',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Codos pegados al torso.'
    },
    {
      id: 'curl-inclinado', name: 'Curl inclinado con mancuernas', muscle: 'biceps',
      sets: 3, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 1, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Mayor estiramiento en la parte baja.'
    },
    {
      id: 'curl-martillo', name: 'Curl martillo', muscle: 'biceps',
      sets: 3, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'kg/mancuerna', step: 1, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Trabaja braquial y braquiorradial.'
    },
    {
      id: 'curl-predicador', name: 'Curl en banco predicador', muscle: 'biceps',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Baja completo sin rebotar.'
    },
    {
      id: 'curl-polea', name: 'Curl en polea baja (barra)', muscle: 'biceps',
      sets: 4, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Polea baja con barra recta o curvada. Codos pegados al cuerpo, sube sin balancear y baja lento: la polea mantiene tensión todo el recorrido.'
    },
    {
      id: 'curl-martillo-polea', name: 'Curl martillo en polea (cuerda)', muscle: 'biceps',
      sets: 4, repMin: 10, repMax: 12, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Polea baja con cuerda, agarre neutro (palmas enfrentadas). Trabaja bíceps y braquial. Codos fijos y control en la bajada.'
    },
    {
      id: 'curl-predicador-polea', name: 'Curl predicador en polea', muscle: 'biceps',
      sets: 2, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'En el banco predicador con la polea baja. Brazos apoyados en la almohadilla, sin despegar los codos. Baja completo sin rebotar.'
    }
  ]
};

const TRICEPS = {
  id: 'triceps', name: 'Tríceps',
  exercises: [
    {
      id: 'extension-polea', name: 'Extensión en polea (cuerda)', muscle: 'triceps',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Abre la cuerda abajo, codos fijos.'
    },
    {
      id: 'press-frances', name: 'Press francés', muscle: 'triceps',
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Baja controlado hacia la frente o detrás de la cabeza.'
    },
    {
      id: 'extension-sobre-cabeza', name: 'Extensión sobre la cabeza', muscle: 'triceps',
      sets: 3, repMin: 10, repMax: 15, rest: 75, restText: '60–75 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Gran estiramiento de la cabeza larga.'
    },
    {
      id: 'fondos-banco', name: 'Fondos en paralelas o banco', muscle: 'triceps', secondary: ['pecho', 'hombros'],
      sets: 3, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg adicional', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Torso vertical para enfatizar el tríceps.'
    },
    {
      id: 'fondos-maquina', name: 'Fondos en máquina', muscle: 'triceps', secondary: ['pecho', 'hombros'],
      sets: 2, repMin: 8, repMax: 12, rest: 90, restText: '90 s',
      unit: 'kg', step: 5, provisional: true,
      notes: 'Máquina sentada con selector de pesas. Espalda apoyada, agarra los mangos y empuja hacia abajo hasta extender los codos sin bloquearlos. Sube controlado, con los codos cerca del cuerpo y los hombros relajados.'
    }
  ]
};

const CORE = {
  id: 'core', name: 'Abdomen / Core',
  exercises: [
    {
      id: 'crunch-maquina', name: 'Crunch en máquina', muscle: 'abdomen',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Redondea la columna, exhala al contraer.'
    },
    {
      id: 'elevacion-piernas', name: 'Elevación de piernas colgado', muscle: 'abdomen',
      sets: 3, repMin: 10, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg adicional', step: 0, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Sin balanceo; inclina la pelvis hacia arriba.'
    },
    {
      id: 'crunch-polea', name: 'Crunch en polea alta', muscle: 'abdomen',
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'lb', step: 5, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Caderas fijas, flexiona el tronco.'
    },
    {
      id: 'rotacion-polea', name: 'Rotación en polea (leñador)', muscle: 'abdomen', secondary: ['hombros'],
      sets: 3, repMin: 12, repMax: 15, rest: 60, restText: '60 s',
      unit: 'kg', step: 2.5, provisional: true, perLeg: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Gira desde el tronco, no los brazos.'
    },
    {
      id: 'plancha', name: 'Plancha (segundos)', muscle: 'abdomen', secondary: ['hombros'],
      sets: 3, repMin: 30, repMax: 60, rest: 60, restText: '60 s',
      unit: 'kg adicional', step: 0, provisional: true,
      notes: 'Rango y descanso sugeridos: ajústalos a tu rutina. Las "repeticiones" son segundos de mantención.'
    }
  ]
};

/* Plan de 3 dias por semana (empuje / tiron / piernas). Cada dia junta ejercicios de varios grupos.
 * sets: series para ese dia (si se omite, usa las del ejercicio). */
const PLAN = {
  name: 'Plan de 3 días',
  days: [
    {
      id: 'dia-empuje', name: 'Día 1 · Empuje', focus: 'Pecho · Hombros · Tríceps',
      exercises: [
        { id: 'press-pecho-maquina', sets: 4 }, { id: 'press-inclinado' }, { id: 'aperturas-peck-deck' },
        { id: 'press-hombro-maquina' }, { id: 'elevaciones-laterales', sets: 4 },
        { id: 'extension-polea', sets: 4 }, { id: 'extension-sobre-cabeza', sets: 4 }, { id: 'fondos-maquina', sets: 2 }
      ]
    },
    {
      id: 'dia-tiron', name: 'Día 2 · Tirón', focus: 'Espalda · Bíceps · Hombro posterior · Abdomen',
      exercises: [
        { id: 'jalon-pecho', sets: 4 }, { id: 'remo-lineal' }, { id: 'remo-maquina' },
        { id: 'face-pull' }, { id: 'pajaros-polea' },
        { id: 'curl-polea', sets: 4 }, { id: 'curl-martillo-polea', sets: 4 }, { id: 'curl-predicador-polea', sets: 2 },
        { id: 'crunch-polea' }
      ]
    },
    {
      id: 'dia-piernas', name: 'Día 3 · Piernas', focus: 'Cuádriceps · Glúteos · Isquios · Pantorrillas',
      exercises: [
        { id: 'sentadilla-pendular' }, { id: 'prensa' }, { id: 'curl-femoral', sets: 4 }, { id: 'hip-thrust', sets: 4 },
        { id: 'extension-cuadriceps', sets: 4 }, { id: 'abductores' }, { id: 'patada-gluteo' }, { id: 'pantorrillas' }
      ]
    }
  ]
};

/* Nombres de los musculos para el volumen semanal (series directas por semana). */
const MUSCLES = {
  cuadriceps: 'Cuádriceps', isquios: 'Isquiotibiales', gluteos: 'Glúteos', pantorrillas: 'Pantorrillas',
  pecho: 'Pecho', espalda: 'Espalda', lumbar: 'Lumbar', hombros: 'Hombros', trapecio: 'Trapecio',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdomen'
};

const ROUTINES = [PIERNAS, PECHO, ESPALDA, HOMBROS, BICEPS, TRICEPS, CORE];
