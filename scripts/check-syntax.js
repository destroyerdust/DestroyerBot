const { readdirSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const sourceDirectories = ['commands', 'events', 'models', 'utils']
const sourceFiles = ['index.js', 'deploy-commands.js', 'logger.js']

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(path)
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [path] : []
  })
}

for (const directory of sourceDirectories) {
  sourceFiles.push(...collectJavaScriptFiles(directory))
}

for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
