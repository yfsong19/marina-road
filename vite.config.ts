import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildNumber = process.env.GITHUB_RUN_NUMBER ?? process.env.VITE_PIPELINE_RUN_NUMBER ?? 'local'
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
    __BUILD_VERSION__: JSON.stringify(buildNumber),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
