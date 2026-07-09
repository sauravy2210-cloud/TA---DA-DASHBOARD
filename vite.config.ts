import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

const KOENIG_BASE = 'https://api.koenig-solutions.com'

async function koenigToken(userName: string, userPassword: string, userRole: string) {
  const r = await fetch(`${KOENIG_BASE}/api/Kites/Operator/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, userPassword, userRole }),
  })
  if (!r.ok) throw new Error(`Token HTTP ${r.status}`)
  const d = await r.json() as { statuscode: number; message?: string; content: { accessToken: string; deviceToken: string } }
  if (d.statuscode !== 200) throw new Error(d.message || 'Token failed')
  return d.content
}

async function koenigCommon(apikey: number, tok: { accessToken: string; deviceToken: string }, body: unknown) {
  const url = `${KOENIG_BASE}/api/Kites/Operator/common?apikey=${apikey}&accessToken=${encodeURIComponent(tok.accessToken)}&deviceToken=${encodeURIComponent(tok.deviceToken)}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`API ${apikey} HTTP ${r.status}`)
  const d = await r.json() as { statuscode: number; message?: string; content: unknown }
  if (d.statuscode !== 200) throw new Error(d.message || `API ${apikey} error`)
  const raw = typeof d.content === 'string' ? JSON.parse(d.content) : d.content
  return Array.isArray(raw) ? raw : []
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-koenig-api',
        configureServer(server) {
          server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            if (!req.url) { next(); return }
            const url = new URL(req.url, 'http://localhost')

            // ── /api/employee?empCode=... ──────────────────────────────────
            if (url.pathname === '/api/employee') {
              const empCode = (url.searchParams.get('empCode') || '').replace(/^EMP-/i, '').trim()
              if (!empCode) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'empCode required' }))
                return
              }
              try {
                const tok = await koenigToken(
                  env.KOENIG_EMP_USER || 'Saurav_GetEmployeeDeta',
                  env.KOENIG_EMP_PASS || '',
                  'Get Employee Details (PMS)'
                )
                const codeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
                const list = await koenigCommon(236, tok, { emp_code: codeValue })
                if (list.length === 0) {
                  res.writeHead(404, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: 'No employee record found' }))
                  return
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ employee: list[0] }))
              } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
              }
              return
            }

            // ── /api/flights?email=...&empCode=... ────────────────────────
            if (url.pathname === '/api/flights') {
              const email   = (url.searchParams.get('email')   || '').trim()
              const rawCode = (url.searchParams.get('empCode') || '').trim()
              const empCode = rawCode.replace(/^EMP-/i, '').trim()

              let flights: unknown[] = []

              if (email) {
                try {
                  const tok = await koenigToken(
                    env.KOENIG_U1 || 'Saurav_TrainerFlightDe',
                    env.KOENIG_P1 || '',
                    'Trainer Flight Details'
                  )
                  flights = await koenigCommon(108, tok, { email_Address: email })
                } catch { flights = [] }
              }

              if (flights.length === 0 && empCode) {
                try {
                  const code = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
                  const tok = await koenigToken(
                    env.KOENIG_U2 || 'Saurav_GetTrainerFligh',
                    env.KOENIG_P2 || '',
                    'Get Trainer Flight Details'
                  )
                  flights = await koenigCommon(256, tok, { koenig_trainer_emp_code: code })
                } catch { flights = [] }
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ flights }))
              return
            }

            next()
          })
        },
      },
    ],
    server: {
      proxy: {
        '/koenig-api': {
          target: 'https://api.koenig-solutions.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/koenig-api/, ''),
        },
      },
    },
  }
})
