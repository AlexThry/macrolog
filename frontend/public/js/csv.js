// CSV parsing for bulk food import. Columns may be in any order when a header
// row is present (mapped by FR/EN aliases); otherwise positional order is used.

// Column-name aliases (accent/case-insensitive) -> internal field.
const CSV_ALIASES = {
  name: ['nom', 'name', 'aliment', 'libelle', 'food', 'produit'],
  unit: ['unite', 'unit', 'u'],
  kcal: ['kcal', 'calories', 'calorie', 'energie', 'cal', 'kc'],
  protein: ['p', 'prot', 'protein', 'proteins', 'proteine', 'proteines', 'protide', 'protides'],
  carbs: ['g', 'gluc', 'glucide', 'glucides', 'carb', 'carbs', 'carbo', 'carbohydrate', 'carbohydrates'],
  fat: ['l', 'lip', 'lipide', 'lipides', 'fat', 'fats', 'gras', 'graisse', 'graisses'],
};
function normHeader(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function matchCsvField(cell) {
  const c = normHeader(cell);
  for (const [field, aliases] of Object.entries(CSV_ALIASES)) if (aliases.includes(c)) return field;
  return null;
}

// Parse CSV of foods. With a header row (>=2 recognised columns) the order is
// free; without one, falls back to nom,unite,kcal,P,G,L. Delimiter , or ;.
export function parseFoodsCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (line) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
  const num = (s) => {
    let v = (s || '').trim();
    if (delim === ';') v = v.replace(',', '.'); // French decimal comma when ; separates
    return parseFloat(v) || 0;
  };

  const firstCols = split(lines[0]);
  const colOf = {};
  firstCols.forEach((cell, idx) => {
    const f = matchCsvField(cell);
    if (f && colOf[f] === undefined) colOf[f] = idx;
  });
  const hasHeader = Object.keys(colOf).length >= 2;
  const map = hasHeader ? colOf : { name: 0, unit: 1, kcal: 2, protein: 3, carbs: 4, fat: 5 };
  if (map.name === undefined) map.name = 0; // header without a name column -> first col

  const out = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = split(lines[i]);
    const cell = (field) => (map[field] === undefined ? '' : cols[map[field]] || '');
    const name = cell('name').trim();
    if (!name) continue;
    out.push({
      name,
      unit: cell('unit').trim() || 'g',
      kcal: num(cell('kcal')),
      protein: num(cell('protein')),
      carbs: num(cell('carbs')),
      fat: num(cell('fat')),
    });
  }
  return out;
}
