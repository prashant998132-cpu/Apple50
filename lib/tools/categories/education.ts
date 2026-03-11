// categories/education.ts
export { calculate } from '../no-key/index'

// Math solver — extended calculator (no API)
export async function solve_math(args: { expression: string }) {
  const expr = args.expression.trim()
  try {
    // Safe eval via Function (no access to scope)
    const sanitized = expr.replace(/[^0-9+\-*/^().,%\s√πe]/gi, '')
      .replace(/\^/g, '**').replace(/√/g, 'Math.sqrt').replace(/π/g, 'Math.PI').replace(/\be\b/g, 'Math.E')
      .replace(/sin\(/g,'Math.sin(').replace(/cos\(/g,'Math.cos(').replace(/tan\(/g,'Math.tan(')
      .replace(/log\(/g,'Math.log10(').replace(/ln\(/g,'Math.log(').replace(/sqrt\(/g,'Math.sqrt(')
      .replace(/abs\(/g,'Math.abs(').replace(/ceil\(/g,'Math.ceil(').replace(/floor\(/g,'Math.floor(')
    const result = Function(`"use strict"; return (${sanitized})`)()
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('Not a number')
    return { expression: expr, result: Number(result.toFixed(10)).toString(), steps: `${expr} = ${result}` }
  } catch (e: any) {
    return { expression: expr, error: 'Could not solve', hint: 'Try: 2+3, sin(45)*180/PI, sqrt(144), 15% of 2000' }
  }
}

// Periodic table — built-in, zero API
const ELEMENTS: Record<string, any> = {
  'h':  { name:'Hydrogen',   symbol:'H',   no:1,   mass:1.008,   group:'Nonmetal',    config:'1s¹',            period:1 },
  'he': { name:'Helium',     symbol:'He',  no:2,   mass:4.003,   group:'Noble Gas',   config:'1s²',            period:1 },
  'li': { name:'Lithium',    symbol:'Li',  no:3,   mass:6.941,   group:'Alkali Metal',config:'[He]2s¹',        period:2 },
  'c':  { name:'Carbon',     symbol:'C',   no:6,   mass:12.011,  group:'Nonmetal',    config:'[He]2s²2p²',     period:2 },
  'n':  { name:'Nitrogen',   symbol:'N',   no:7,   mass:14.007,  group:'Nonmetal',    config:'[He]2s²2p³',     period:2 },
  'o':  { name:'Oxygen',     symbol:'O',   no:8,   mass:15.999,  group:'Nonmetal',    config:'[He]2s²2p⁴',     period:2 },
  'na': { name:'Sodium',     symbol:'Na',  no:11,  mass:22.990,  group:'Alkali Metal',config:'[Ne]3s¹',        period:3 },
  'mg': { name:'Magnesium',  symbol:'Mg',  no:12,  mass:24.305,  group:'Alkaline',    config:'[Ne]3s²',        period:3 },
  'al': { name:'Aluminium',  symbol:'Al',  no:13,  mass:26.982,  group:'Post-trans',  config:'[Ne]3s²3p¹',     period:3 },
  'si': { name:'Silicon',    symbol:'Si',  no:14,  mass:28.086,  group:'Metalloid',   config:'[Ne]3s²3p²',     period:3 },
  'p':  { name:'Phosphorus', symbol:'P',   no:15,  mass:30.974,  group:'Nonmetal',    config:'[Ne]3s²3p³',     period:3 },
  's':  { name:'Sulfur',     symbol:'S',   no:16,  mass:32.065,  group:'Nonmetal',    config:'[Ne]3s²3p⁴',     period:3 },
  'cl': { name:'Chlorine',   symbol:'Cl',  no:17,  mass:35.453,  group:'Halogen',     config:'[Ne]3s²3p⁵',     period:3 },
  'k':  { name:'Potassium',  symbol:'K',   no:19,  mass:39.098,  group:'Alkali Metal',config:'[Ar]4s¹',        period:4 },
  'ca': { name:'Calcium',    symbol:'Ca',  no:20,  mass:40.078,  group:'Alkaline',    config:'[Ar]4s²',        period:4 },
  'fe': { name:'Iron',       symbol:'Fe',  no:26,  mass:55.845,  group:'Transition',  config:'[Ar]3d⁶4s²',     period:4 },
  'cu': { name:'Copper',     symbol:'Cu',  no:29,  mass:63.546,  group:'Transition',  config:'[Ar]3d¹⁰4s¹',    period:4 },
  'zn': { name:'Zinc',       symbol:'Zn',  no:30,  mass:65.38,   group:'Transition',  config:'[Ar]3d¹⁰4s²',    period:4 },
  'ag': { name:'Silver',     symbol:'Ag',  no:47,  mass:107.87,  group:'Transition',  config:'[Kr]4d¹⁰5s¹',    period:5 },
  'au': { name:'Gold',       symbol:'Au',  no:79,  mass:196.97,  group:'Transition',  config:'[Xe]4f¹⁴5d¹⁰6s¹',period:6 },
  'pb': { name:'Lead',       symbol:'Pb',  no:82,  mass:207.2,   group:'Post-trans',  config:'[Xe]4f¹⁴5d¹⁰6s²6p²',period:6 },
  'u':  { name:'Uranium',    symbol:'U',   no:92,  mass:238.03,  group:'Actinide',    config:'[Rn]5f³6d¹7s²',  period:7 },
}
export async function get_periodic_element(args: { query: string }) {
  const q = args.query.toLowerCase().trim()
  const el = ELEMENTS[q] || Object.values(ELEMENTS).find((e: any) =>
    e.name.toLowerCase() === q || e.symbol.toLowerCase() === q || e.no === parseInt(q)
  ) as any
  if (!el) return { query: args.query, error: 'Element not found', hint: 'Try: H, Carbon, 6, Gold, Fe' }
  return el
}

// Physics constants — built-in NEET/JEE data
const CONSTANTS: Record<string, any> = {
  'speed of light':     { name:'Speed of Light', symbol:'c',  value:'3×10⁸ m/s',         exact:'299,792,458 m/s' },
  'planck':             { name:'Planck Constant', symbol:'h',  value:'6.626×10⁻³⁴ J·s',    unit:'J·s' },
  'boltzmann':          { name:'Boltzmann Constant',symbol:'k', value:'1.38×10⁻²³ J/K',    unit:'J/K' },
  'avogadro':           { name:"Avogadro's Number",symbol:'Nₐ',value:'6.022×10²³ mol⁻¹',  unit:'mol⁻¹' },
  'gravitational':      { name:'Gravitational Constant',symbol:'G',value:'6.674×10⁻¹¹ N·m²/kg²', unit:'N·m²/kg²' },
  'electron charge':    { name:'Elementary Charge', symbol:'e', value:'1.602×10⁻¹⁹ C',    unit:'C' },
  'electron mass':      { name:'Electron Mass',  symbol:'mₑ', value:'9.109×10⁻³¹ kg',     unit:'kg' },
  'proton mass':        { name:'Proton Mass',    symbol:'mₚ', value:'1.673×10⁻²⁷ kg',     unit:'kg' },
  'gas constant':       { name:'Universal Gas Constant',symbol:'R',value:'8.314 J/(mol·K)',unit:'J/(mol·K)' },
  'faraday':            { name:'Faraday Constant', symbol:'F', value:'96,485 C/mol',       unit:'C/mol' },
  'permeability':       { name:'Permeability of Vacuum',symbol:'μ₀',value:'4π×10⁻⁷ H/m', unit:'H/m' },
  'permittivity':       { name:'Permittivity of Vacuum',symbol:'ε₀',value:'8.854×10⁻¹² F/m',unit:'F/m' },
  'stefan boltzmann':   { name:'Stefan-Boltzmann Constant',symbol:'σ',value:'5.67×10⁻⁸ W·m⁻²·K⁻⁴',unit:'W·m⁻²·K⁻⁴' },
  'atomic mass unit':   { name:'Atomic Mass Unit', symbol:'u', value:'1.661×10⁻²⁷ kg',   unit:'kg' },
}
export async function get_physics_constant(args: { name: string }) {
  const q = args.name.toLowerCase()
  const match = Object.keys(CONSTANTS).find(k => q.includes(k) || k.includes(q))
  if (!match) return { query: args.name, available: Object.keys(CONSTANTS).join(', ') }
  return CONSTANTS[match]
}
