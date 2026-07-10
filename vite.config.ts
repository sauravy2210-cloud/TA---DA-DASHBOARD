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

            // ── /api/accommodation?empCode=... ───────────────────────────
            if (url.pathname === '/api/accommodation') {
              const empCode = (url.searchParams.get('empCode') || '').replace(/^EMP-/i, '').trim()
              if (!empCode) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'empCode required' }))
                return
              }
              const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
              try {
                const tok = await koenigToken(
                  env.KOENIG_ACCOM_USER || '',
                  env.KOENIG_ACCOM_PASS || '',
                  'Get Trainer Accommodation Details'
                )
                const data = await koenigCommon(257, tok, { koenig_trainer_emp_code: empCodeValue })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ accommodation: data }))
              } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
              }
              return
            }

            // ── /api/countries ────────────────────────────────────────────
            if (url.pathname === '/api/countries') {
              try {
                const tok = await koenigToken(
                  env.KOENIG_CTRY_USER || '',
                  env.KOENIG_CTRY_PASS || '',
                  'Get Country List'
                )
                const data = await koenigCommon(223, tok, { CountryName: '' })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ countries: data.filter((c: { CountryName: string | null }) => c.CountryName) }))
              } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
              }
              return
            }

            // ── /api/advances?empCode=... ─────────────────────────────────
            if (url.pathname === '/api/advances') {
              const empCode = (url.searchParams.get('empCode') || '').replace(/^EMP-/i, '').trim()
              if (!empCode) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'empCode required' }))
                return
              }
              const empIdValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
              try {
                const tok = await koenigToken(
                  env.KOENIG_ADV_USER || '',
                  env.KOENIG_ADV_PASS || '',
                  'Get Employee Advance List'
                )
                const data = await koenigCommon(259, tok, { EmpID: empIdValue })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ advances: data }))
              } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
              }
              return
            }

            // ── /api/assignments?empCode=...&from=...&to=... ─────────────
            if (url.pathname === '/api/assignments') {
              const empCode  = (url.searchParams.get('empCode') || '').replace(/^EMP-/i, '').trim()
              const fromDate = (url.searchParams.get('from') || '').trim()
              const toDate   = (url.searchParams.get('to')   || '').trim()
              if (!empCode) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'empCode required' }))
                return
              }
              const asgnUser    = env.KOENIG_ASGN_USER    || ''
              const asgn258Pass = env.KOENIG_ASGN258_PASS || ''
              const asgn208Pass = env.KOENIG_ASGN208_PASS || ''
              const empCodeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
              let err258 = ''
              try {
                const tok = await koenigToken(asgnUser, asgn258Pass, 'Get Trainer Assignment Details')
                const data = await koenigCommon(258, tok, { koenig_trainer_emp_code: empCodeValue })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ assignments: data, source: '258' }))
                return
              } catch (e) {
                err258 = e instanceof Error ? e.message : String(e)
              }
              if (!fromDate || !toDate) {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ assignments: [], source: 'none', error: `API 258: ${err258}` }))
                return
              }
              try {
                const tok = await koenigToken(asgnUser, asgn208Pass, 'Get Trainer Assignment')
                const data = await koenigCommon(208, tok, { Startdate: fromDate, Enddate: toDate })
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ assignments: data, source: '208' }))
              } catch (e) {
                const err208 = e instanceof Error ? e.message : String(e)
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: `API 258: ${err258} | API 208: ${err208}` }))
              }
              return
            }

            // ── /api/leaves?empCode=... ───────────────────────────────────
            if (url.pathname === '/api/leaves') {
              const empCode = (url.searchParams.get('empCode') || '').replace(/^EMP-/i, '').trim()
              if (!empCode) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'empCode required' }))
                return
              }
              try {
                const tok = await koenigToken(
                  env.KOENIG_LEAVE_USER || '',
                  env.KOENIG_LEAVE_PASS || '',
                  'Get Employee Leave Details'
                )
                const codeValue = /^\d+$/.test(empCode) ? parseInt(empCode, 10) : empCode
                let leaves: unknown[] = []
                try {
                  leaves = await koenigCommon(237, tok, { emp_code: codeValue })
                } catch {
                  leaves = []
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ leaves }))
              } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
              }
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
