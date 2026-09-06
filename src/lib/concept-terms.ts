/**
 * Explicit lexical vocabulary, not a list of relationships. A label is eligible
 * only when it occurs verbatim (case/accent insensitive) alongside the query in
 * retrieved transcript evidence. No title extraction or semantic inference.
 * Coverage is intentionally limited; absent concepts leave an empty branch.
 */
export const CONCEPT_TERMS = [
  'compra de vacunas', 'comando vacuna', 'vacunación universal', 'vacunación pública',
  'campañas de vacunación', 'ensayo clínico', 'pruebas moleculares', 'salud pública',
  'atención médica primaria', 'pandemia', 'vacunagate', 'Sinofarm', 'COVID', 'placebo',
  'anemia', 'desnutrición', 'medicamentos', 'hospitales',
  'minería ilegal', 'minería informal', 'formalización minera', 'deforestación',
  'crimen organizado', 'extorsión', 'lavado de activos', 'financiamiento ilegal',
  'corrupción', 'colusión', 'cohecho', 'tráfico de influencias',
  'vacancia presidencial', 'vacancia', 'inhabilitación', 'inmunidad parlamentaria',
  'denuncia constitucional', 'prisión preventiva', 'indulto', 'amnistía',
  'derechos humanos', 'esterilizaciones forzadas', 'protestas', 'represión policial',
  'publicidad estatal', 'libertad de expresión', 'fraude electoral', 'segunda vuelta',
  'reforma electoral', 'seguridad ciudadana', 'estado de emergencia',
] as const;
