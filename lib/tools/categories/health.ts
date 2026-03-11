// categories/health.ts

// BMI — pure math, zero API
export async function calculate_bmi(args: { weight: number; height: number }) {
  const h = args.height / 100   // cm → m
  const bmi = args.weight / (h * h)
  const rounded = Math.round(bmi * 10) / 10
  let category, advice
  if (bmi < 18.5)      { category = 'Underweight'; advice = 'Thoda aur khao! Nutritious diet lo.' }
  else if (bmi < 25)   { category = 'Normal';      advice = 'Bilkul sahi! Keep it up!' }
  else if (bmi < 30)   { category = 'Overweight';  advice = 'Thodi walk aur diet control karo.' }
  else                  { category = 'Obese';       advice = 'Doctor se milna chahiye.' }
  const idealMin = Math.round(18.5 * h * h)
  const idealMax = Math.round(24.9 * h * h)
  return { bmi: rounded, category, weight: args.weight + 'kg', height: args.height + 'cm', ideal_weight: `${idealMin}-${idealMax} kg`, advice }
}

// Open Food Facts — free, no key
export async function get_calorie_info(args: { food: string }) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(args.food)}&search_simple=1&action=process&json=1&page_size=1`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('OpenFoodFacts failed')
    const d = await res.json()
    const p = d.products?.[0]
    if (!p) return { food: args.food, note: 'Not found in database' }
    const n = p.nutriments
    return {
      food: p.product_name || args.food,
      per_100g: {
        calories: n?.['energy-kcal_100g'] || n?.['energy_100g'],
        protein: n?.proteins_100g + 'g',
        carbs:   n?.carbohydrates_100g + 'g',
        fat:     n?.fat_100g + 'g',
        fiber:   n?.fiber_100g + 'g',
      },
      source: 'Open Food Facts',
    }
  } catch {
    return { food: args.food, note: 'Check: https://www.healthifyme.com/blog/calorie-chart/' }
  }
}
