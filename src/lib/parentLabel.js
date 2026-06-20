// Display a parent's label, suffixed with their first name ONLY when the
// family has two same-label parents (two moms / two dads). With one of
// each, the label alone is unambiguous.
//
// All inputs are translated/i18n-ready strings the caller already resolved:
//   label        — already-translated 'dad' | 'mom'
//   callingName  — first name from Google (nullable)
//   collision    — true when the other parent shares the same parent_label
//
// Returns the string to display. Pure function, safe to use anywhere.
export function displayParentName(label, callingName, collision) {
  if (!label) return ''
  if (!collision || !callingName) return label
  return `${label} ${callingName}`
}
