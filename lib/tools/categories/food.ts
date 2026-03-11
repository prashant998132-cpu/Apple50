// categories/food.ts
import { get_recipe as _gr } from '../no-key/index'
export async function get_recipe(args: { query: string; category?: string }) { return _gr(args) }
