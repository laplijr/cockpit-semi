interface Allowances {
  running: boolean
  cycling: boolean
  upperBodyStrength: boolean
  legStrength: boolean
}

export function allowanceRows(pause: { allowances: Allowances }) {
  const { allowances } = pause
  return [
    { label: 'Course à pied', allowed: allowances.running },
    { label: 'Vélo', allowed: allowances.cycling },
    { label: 'Muscu haut du corps', allowed: allowances.upperBodyStrength },
    { label: 'Muscu jambes', allowed: allowances.legStrength },
  ]
}
