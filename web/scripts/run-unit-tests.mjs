import { build } from 'esbuild'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rootDir = process.cwd()
const testsDir = path.join(rootDir, 'tests')
const outputDir = path.join(rootDir, 'node_modules', '.cache', 'portfolium-tests')

async function findTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return findTestFiles(fullPath)
    if (entry.isFile() && entry.name.endsWith('.test.ts')) return [fullPath]
    return []
  }))

  return nested.flat()
}

const testFiles = await findTestFiles(testsDir)

if (testFiles.length === 0) {
  console.log('No unit tests found.')
  process.exit(0)
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

await build({
  entryPoints: testFiles,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: outputDir,
  outbase: testsDir,
  entryNames: '[dir]/[name]',
  outExtension: { '.js': '.mjs' },
  absWorkingDir: rootDir,
  sourcemap: 'inline',
  logLevel: 'silent',
})

for (const testFile of testFiles) {
  const relative = path.relative(testsDir, testFile)
  const bundled = path.join(outputDir, relative).replace(/\.ts$/, '.mjs')
  await import(pathToFileURL(bundled).href)
}

console.log(`Unit tests passed: ${testFiles.length} file(s).`)
