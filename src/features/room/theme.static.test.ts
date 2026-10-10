import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const OLD_HEX = ['#455A64', '#F1F3F4', '#263238', '#546E7A', '#B3261E', '#005FCC']
// Selectors the US-001..US-003 UI contracts promise; US-004 must not remove any of them.
const TEST_IDS = [
  'room-code',
  'players-list',
  'player-vote',
  'phase-heading',
  'room-phase',
  'phase-waiting',
  'vote-cards',
  'vote-status',
  'vote-error',
  'reveal-error',
  'results-panel',
  'results-heading',
  'results-participation',
  'connection-status',
  'form-error',
]
const REMOTE_PATTERNS: [string, RegExp][] = [
  ['@import url(', /@import\s+url\(/i],
  ['Google Fonts', /fonts\.(googleapis|gstatic)\.com/i],
  ['CDN host', /\bcdn\./i],
  ['remote <link>', /<link[^>]+href=["']https?:/i],
  ['remote url()', /url\(\s*["']?https?:/i],
]
const UI_LIBRARIES = ['bootstrap', 'font-awesome', '@fortawesome', 'lucide', 'react-icons', '@heroicons', '@mui', 'antd', 'chakra']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

const sourceFiles = () => walk('src').filter((file) => /\.(ts|tsx|css)$/.test(file) && !/\.test\.tsx?$/.test(file))

// Other themes (US-005) legitimately define their own colours; US-004 only governs the default Vintage tokens.
const withoutOtherThemeBlocks = (css: string) => css.replace(/:root\[data-theme="[a-z]+"\]\s*\{[^}]*\}/g, '')

describe('US-004 static checks', () => {
  it('TC-004-08 source has no pre-US-004 colour, slate/gray/white utility or arbitrary colour class', () => {
    const findings: string[] = []
    for (const file of sourceFiles()) {
      const raw = readFileSync(file, 'utf8')
      const text = file.endsWith('.css') ? withoutOtherThemeBlocks(raw) : raw
      for (const hex of OLD_HEX) if (text.toLowerCase().includes(hex.toLowerCase())) findings.push(`${file}: ${hex}`)
      for (const pattern of [/\bslate-\d/, /\bgray-\d/, /\bbg-white\b/, /\btext-white\b/, /\[#[0-9a-fA-F]{3,8}\]/]) {
        const match = text.match(pattern)
        if (match) findings.push(`${file}: ${match[0]}`)
      }
    }
    expect(findings).toEqual([])
  })

  it('TC-004-14 every US-001..US-003 data-testid still exists in src', () => {
    const source = sourceFiles()
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    const missing = TEST_IDS.filter((id) => !source.includes(`data-testid="${id}"`) && !source.includes(`data-testid='${id}'`))
    expect(missing).toEqual([])
  })

  it('TC-004-30 source and index.html have no remote CSS, font or CDN reference', () => {
    const files = [...sourceFiles(), 'index.html']
    const findings: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const [label, pattern] of REMOTE_PATTERNS) if (pattern.test(text)) findings.push(`${file}: ${label}`)
    }
    expect(findings).toEqual([])
  })

  it.skipIf(!existsSync('dist'))('TC-004-30 built HTML and CSS have no remote reference (needs `npm run build` first)', () => {
    const built = walk('dist').filter((file) => /\.(html|css)$/.test(file))
    expect(built.length).toBeGreaterThan(0)
    const findings: string[] = []
    for (const file of built) {
      const text = readFileSync(file, 'utf8')
      for (const [label, pattern] of REMOTE_PATTERNS) if (pattern.test(text)) findings.push(`${file}: ${label}`)
    }
    expect(findings).toEqual([])
  })

  it('TC-004-31 package.json has no UI, icon or font library', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: object; devDependencies?: object }
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
    const found = names.filter((name) => UI_LIBRARIES.some((lib) => name === lib || name.startsWith(`${lib}/`) || name.includes(lib)))
    expect(found).toEqual([])
  })
})
