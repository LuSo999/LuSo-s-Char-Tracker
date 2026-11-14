// LuSo Sheet Tool: the Electron main process. Opens the window, serves the built renderer on
// app://, keeps the Claude API key (encrypted with the OS keychain when available) and the
// saved templates in the user data folder, saves files and calls the Claude API.
const { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const Anthropic = require('@anthropic-ai/sdk').default

const MODEL = 'claude-opus-5-5'
const DEV = process.env.LUSO_DEV === '1'
const dist = path.join(__dirname, '..', 'dist')
const dataDir = () => app.getPath('userData')
const templatesDir = () => path.join(dataDir(), 'templates')
const keyFile = () => path.join(dataDir(), 'api-key.bin')

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

// --- API key -------------------------------------------------------------------------------

async function readKey() {
  try {
    const buf = await fs.readFile(keyFile())
    if (buf[0] === 0x45 /* E */) return safeStorage.decryptString(buf.subarray(1))
    return buf.subarray(1).toString('utf8')
  } catch {
    return process.env.ANTHROPIC_API_KEY || ''
  }
}
ipcMain.handle('key:status', async () => {
  const saved = await fs.stat(keyFile()).then(() => true, () => false)
  return { has: !!(await readKey()), source: saved ? 'saved' : process.env.ANTHROPIC_API_KEY ? 'env' : null, encrypted: safeStorage.isEncryptionAvailable() }
})
ipcMain.handle('key:set', async (_e, key) => {
  await fs.mkdir(dataDir(), { recursive: true })
  const k = String(key).trim()
  const data = safeStorage.isEncryptionAvailable() ? Buffer.concat([Buffer.from('E'), safeStorage.encryptString(k)]) : Buffer.concat([Buffer.from('P'), Buffer.from(k, 'utf8')])
  await fs.writeFile(keyFile(), data, { mode: 0o600 })
  return true
})
ipcMain.handle('key:clear', async () => {
  await fs.rm(keyFile(), { force: true })
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

// --- Claude --------------------------------------------------------------------------------

let running // the stream in progress (one at a time)
ipcMain.handle('claude:cancel', () => {
  running?.abort()
  return true
})
/**
 * One structured-output request: the renderer gives the system prompt, the user content (text
 * and base64 images) and the JSON schema; the answer comes back parsed.
 */
ipcMain.handle('claude:run', async (_e, { system, content, schema, maxTokens = 64000, effort = 'high' }) => {
  const apiKey = await readKey()
  if (!apiKey) return { ok: false, error: 'no-key' }
  const client = new Anthropic({ apiKey })
  try {
    running = client.beta.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      // If a safety classifier declines, Anthropic's recommended fallback model answers instead.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort, format: { type: 'json_schema', schema } },
    })
    const msg = await running.finalMessage()
    const usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens }
    if (msg.stop_reason === 'refusal') return { ok: false, error: 'refusal', usage }
    if (msg.stop_reason === 'max_tokens') return { ok: false, error: 'max-tokens', usage }
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    try {
      return { ok: true, data: JSON.parse(text), usage }
    } catch {
      return { ok: false, error: 'bad-json', usage }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return { ok: false, error: 'cancelled' }
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: 'auth' }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'rate-limit' }
    if (err instanceof Anthropic.APIError) return { ok: false, error: `api ${err.status ?? ''}: ${err.message}` }
    return { ok: false, error: String(err?.message ?? err) }
  } finally {
    running = undefined
  }
})
