import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

const getShortCommitHash = () => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)

  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const commitHash = getShortCommitHash()
const pipelineRunNumber = process.env.GITHUB_RUN_NUMBER ?? process.env.VITE_PIPELINE_RUN_NUMBER
const buildVersion = pipelineRunNumber ? `${commitHash} · run ${pipelineRunNumber}` : commitHash
const dateParts = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date())
const buildDate = ['year', 'month', 'day'].map((type) => dateParts.find((part) => part.type === type)?.value).join('-')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/marina-road/',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
