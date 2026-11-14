// LuSo Sheet Tool: the Electron main process. Opens the window, serves the built renderer on
// app://, keeps the AI API keys (Claude, ChatGPT, Gemini; encrypted with the OS keychain when
// available) and the saved templates in the user data folder, saves files and calls the AI.
const { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { runners } = require('./ai.cjs')

const PROVIDERS = ['claude', 'openai', 'gemini']
const ENV = { claude: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] }
const DEV = process.env.LUSO_DEV === '1'
const dist = path.join(__dirname, '..', 'dist')
const dataDir = () => app.getPath('userData')
const templatesDir = () => path.join(dataDir(), 'templates')
const keyFile = (provider) => path.join(dataDir(), provider === 'claude' ? 'api-key.bin' : `api-key-${provider}.bin`)

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'LuSo Sheet Tool',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // Links (the web app, the Anthropic console) open in the browser, not in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  void win.loadURL(DEV ? 'http://localhost:5299' : 'app://local/index.html')
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.normalize(path.join(dist, rel))
    if (!file.startsWith(dist)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())

// --- API keys (one per provider) ----------------------------------------------------------

const providerOf = (p) => (PROVIDERS.includes(p) ? p : 'claude')
const envKey = (provider) => ENV[provider].map((n) => process.env[n]).find(Boolean) || ''
async function readKey(provider) {
  try {
    const buf = await fs.readFile(keyFile(provider))
    if (buf[0] === 0x45 /* E */) return safeStorage.decryptString(buf.subarray(1))
    return buf.subarray(1).toString('utf8')
  } catch {
    return envKey(provider)
  }
}
ipcMain.handle('key:status', async () => {
  const out = { encrypted: safeStorage.isEncryptionAvailable() }
  for (const p of PROVIDERS) {
    const saved = await fs.stat(keyFile(p)).then(() => true, () => false)
    out[p] = { has: !!(await readKey(p)), source: saved ? 'saved' : envKey(p) ? 'env' : null }
  }
  return out
})
ipcMain.handle('key:set', async (_e, provider, key) => {
  await fs.mkdir(dataDir(), { recursive: true })
  const k = String(key).trim()
  const data = safeStorage.isEncryptionAvailable() ? Buffer.concat([Buffer.from('E'), safeStorage.encryptString(k)]) : Buffer.concat([Buffer.from('P'), Buffer.from(k, 'utf8')])
  await fs.writeFile(keyFile(providerOf(provider)), data, { mode: 0o600 })
  return true
})
ipcMain.handle('key:clear', async (_e, provider) => {
  await fs.rm(keyFile(providerOf(provider)), { force: true })
  return true
})

// --- Templates (one JSON + the sheet's PDF each) ------------------------------------------

const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '_')
ipcMain.handle('templates:list', async () => {
  try {
    const names = (await fs.readdir(templatesDir())).filter((n) => n.endsWith('.json'))
    const out = []
    for (const n of names) {
      try {
        out.push(JSON.parse(await fs.readFile(path.join(templatesDir(), n), 'utf8')))
      } catch {
        // a broken file: skip it
      }
    }
    return out
  } catch {
    return []
  }
})
ipcMain.handle('templates:save', async (_e, template, pdf) => {
  await fs.mkdir(templatesDir(), { recursive: true })
  const id = safeId(template.id)
  await fs.writeFile(path.join(templatesDir(), `${id}.json`), JSON.stringify(template, null, 1))
  if (pdf) await fs.writeFile(path.join(templatesDir(), `${id}.pdf`), Buffer.from(pdf))
  return true
})
ipcMain.handle('templates:delete', async (_e, id) => {
  for (const ext of ['json', 'pdf']) await fs.rm(path.join(templatesDir(), `${safeId(id)}.${ext}`), { force: true })
  return true
})
ipcMain.handle('templates:pdf', async (_e, id) => {
  try {
    return new Uint8Array(await fs.readFile(path.join(templatesDir(), `${safeId(id)}.pdf`)))
  } catch {
    return null
  }
})

// --- Files ---------------------------------------------------------------------------------

ipcMain.handle('file:save', async (e, defaultName, data, filters) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), defaultName), filters })
  if (r.canceled || !r.filePath) return null
  await fs.writeFile(r.filePath, typeof data === 'string' ? data : Buffer.from(data))
  shell.showItemInFolder(r.filePath)
  return r.filePath
})

// --- AI ----------------------------------------------------------------------------------
// One structured-output request: the renderer gives the provider, the model, the system prompt,
// the user content (text and base64 images) and the JSON schema; the answer comes back parsed.
// Errors come back as short codes the page translates (no-key, auth, rate-limit, refusal…).

let running // AbortController of the request in progress (one at a time)
ipcMain.handle('ai:cancel', () => {
  running?.abort()
  return true
})


ipcMain.handle('ai:run', async (_e, req) => {
  const provider = providerOf(req.provider)
  const apiKey = await readKey(provider)
  if (!apiKey) return { ok: false, error: 'no-key' }
  const controller = new AbortController()
  running = controller
  try {
    // baseURL is for tests only: the page can't redirect a key elsewhere.
    return await runners[provider](apiKey, { maxTokens: 64000, effort: 'high', ...req, baseURL: undefined }, controller.signal)
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) }
  } finally {
    if (running === controller) running = undefined
  }
})
