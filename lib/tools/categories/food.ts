// lib/tools/categories/food.ts -- Food & Recipe Tools v2
// TheMealDB (free, no key) + Open Food Facts (free, no key)
// Fixed: removed broken '../no-key/index' import

export async function get_recipe(args: { query: string; category?: string }) {
  try {
    // TheMealDB search
    const r = await fetch(
      'https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(args.query),
      { signal: AbortSignal.timeout(6000) }
    )
    const d = await r.json()
    const meals = d.meals
    if (!meals || meals.length === 0) {
      // Try random if query not found
      const rr = await fetch('https://www.themealdb.com/api/json/v1/1/random.php', { signal: AbortSignal.timeout(5000) })
      const rd = await rr.json()
      const m = rd.meals?.[0]
      if (!m) return { success: false, error: 'Recipe nahi mili. Try karo: "biryani", "pasta", "butter chicken"' }
      return formatMeal(m, true)
    }
    return formatMeal(meals[0], false)
  } catch (err) {
    return { success: false, error: 'Recipe fetch failed: ' + err }
  }
}

export async function get_random_meal() {
  try {
    const r = await fetch('https://www.themealdb.com/api/json/v1/1/random.php', { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    const m = d.meals?.[0]
    if (!m) return { success: false, error: 'Random meal nahi mila' }
    return formatMeal(m, false)
  } catch (err) {
    return { success: false, error: 'Failed: ' + err }
  }
}

export async function get_meals_by_ingredient(args: { ingredient: string }) {
  try {
    const r = await fetch(
      'https://www.themealdb.com/api/json/v1/1/filter.php?i=' + encodeURIComponent(args.ingredient),
      { signal: AbortSignal.timeout(5000) }
    )
    const d = await r.json()
    const meals = d.meals
    if (!meals) return { success: false, error: args.ingredient + ' se koi recipe nahi mili' }
    const list = meals.slice(0, 5).map((m: any) => '- ' + m.strMeal).join('\n')
    return {
      success: true,
      text: args.ingredient + ' se banne wali dishes:\n' + list + '\n\nKisi ek ka recipe chahiye toh naam batao!',
      data: meals.slice(0, 5),
    }
  } catch (err) {
    return { success: false, error: 'Failed: ' + err }
  }
}

export async function get_meal_categories() {
  try {
    const r = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php', { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    const cats = d.categories?.map((c: any) => c.strCategory).join(', ') || ''
    return {
      success: true,
      text: 'Available food categories: ' + cats,
      data: d.categories,
    }
  } catch (err) {
    return { success: false, error: 'Failed: ' + err }
  }
}

function formatMeal(m: any, isRandom: boolean) {
  // Extract ingredients
  const ingredients: string[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = m['strIngredient' + i]
    const mea = m['strMeasure' + i]
    if (ing && ing.trim()) {
      ingredients.push((mea?.trim() ? mea.trim() + ' ' : '') + ing.trim())
    }
  }

  // Shorten instructions
  const instructions = (m.strInstructions || '').replace(/\r\n/g, '\n').slice(0, 600)

  const text = (isRandom ? '(Query nahi mili, random diya) ' : '') +
    '**' + m.strMeal + '**' +
    ' (' + (m.strArea || '') + (m.strCategory ? ' · ' + m.strCategory : '') + ')' +
    '\n\n**Ingredients (' + ingredients.length + '):**\n' +
    ingredients.slice(0, 10).map((i: string) => '- ' + i).join('\n') +
    (ingredients.length > 10 ? '\n...aur ' + (ingredients.length - 10) + ' aur' : '') +
    '\n\n**Instructions (summary):**\n' +
    instructions + (m.strInstructions?.length > 600 ? '...' : '')

  return {
    success: true,
    text,
    card: {
      title: m.strMeal,
      subtitle: (m.strArea || '') + (m.strCategory ? ' · ' + m.strCategory : ''),
      imageUrl: m.strMealThumb,
      meta: ingredients.length + ' ingredients',
    },
    data: { name: m.strMeal, area: m.strArea, category: m.strCategory, ingredients, source: m.strSource },
  }
}
