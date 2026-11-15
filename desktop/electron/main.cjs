// LuSo Sheet Tool: the desktop app. Its window shows the web app (LuSo's Char Tracker, always
// the current version) and gives it what a browser can't: AI requests with the API keys kept on
// this computer (encrypted with the OS keychain when available), saving files with a dialog,
// and Google sign-in through the system browser (Google doesn't allow it inside apps).
const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { runners } = require('./ai.cjs')

/** The web app; LUSO_WEB_URL points elsewhere for development (http://localhost:5173/LuSo-s-Char-Tracker/). */
const WEB_URL = process.env.LUSO_WEB_URL || 'https://luso999.github.io/LuSo-s-Char-Tracker/'
const WEB_ORIGIN = new URL(WEB_URL).origin
const PROVIDERS = ['claude', 'openai', 'gemini']
const ENV = { claude: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] }
const dataDir = () => app.getPath('userData')
const keyFile = (provider) => path.join(dataDir(), provider === 'claude' ? 'api-key.bin' : `api-key-${provider}.bin`)

/** Only the web app's own pages may use the desktop functions. */
const trusted = (e) => {
  try {
    return new URL(e.senderFrame.url).origin === WEB_ORIGIN
  } catch {
    return false
  }
}
const handle = (channel, fn) =>
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Not allowed')
    return fn(e, ...args)
  })
// The preload asks once, synchronously: which page gets the bridge, and the app's version.
ipcMain.on('desktop:info', (e) => {
  e.returnValue = { origin: WEB_ORIGIN, version: app.getVersion() }
})

let win
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "LuSo's Char Tracker",
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // Links elsewhere (rules wiki, API consoles, GitHub) open in the browser; the app stays on the web app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return
    if (new URL(url).origin !== WEB_ORIGIN) {
      e.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    }
  })
  // No connection: a small page with a retry button.
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */) return
    void win.loadFile(path.join(__dirname, 'offline.html'))
  })
  void win.loadURL(WEB_URL)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
ipcMain.on('offline:retry', () => void win?.loadURL(WEB_URL))

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
handle('key:status', async () => {
  const out = { encrypted: safeStorage.isEncryptionAvailable() }
  for (const p of PROVIDERS) {
    const saved = await fs.stat(keyFile(p)).then(() => true, () => false)
    out[p] = { has: !!(await readKey(p)), source: saved ? 'saved' : envKey(p) ? 'env' : null }
  }
  return out
})
handle('key:set', async (_e, provider, key) => {
  await fs.mkdir(dataDir(), { recursive: true })
  const k = String(key).trim()
  const data = safeStorage.isEncryptionAvailable() ? Buffer.concat([Buffer.from('E'), safeStorage.encryptString(k)]) : Buffer.concat([Buffer.from('P'), Buffer.from(k, 'utf8')])
  await fs.writeFile(keyFile(providerOf(provider)), data, { mode: 0o600 })
  return true
})
handle('key:clear', async (_e, provider) => {
  await fs.rm(keyFile(providerOf(provider)), { force: true })
  return true
})

// --- Files ---------------------------------------------------------------------------------

handle('file:save', async (e, defaultName, data, filters) => {
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: path.join(app.getPath('documents'), path.basename(String(defaultName))), filters })
  if (r.canceled || !r.filePath) return null
  await fs.writeFile(r.filePath, typeof data === 'string' ? data : Buffer.from(data))
  shell.showItemInFolder(r.filePath)
  return r.filePath
})

// --- AI ----------------------------------------------------------------------------------
// One structured-output request: the page gives the provider, the model, the system prompt,
// the user content (text and base64 images) and the JSON schema; the answer comes back parsed.
// Errors come back as short codes the page translates (no-key, auth, rate-limit, refusal…).

let running // AbortController of the request in progress (one at a time)
handle('ai:cancel', () => {
  running?.abort()
  return true
})
handle('ai:run', async (_e, req) => {
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

// --- Google sign-in through the system browser ----------------------------------------------
// A one-time local address (127.0.0.1, random port) waits for the browser: the web app's
// #/desktop-login page signs in with Google there and comes back with the Google tokens and the
// random state value; the window then signs in with them (Firebase signInWithCredential).

let signIn // { server, finish } of the sign-in in progress
const page = (text) =>
  `<!doctype html><meta charset="utf-8"><title>LuSo's Char Tracker</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h2>LuSo's Char Tracker</h2><p>${text}</p></body>`
handle('auth:cancel', () => {
  signIn?.finish({ ok: false, error: 'cancelled' })
  return true
})
handle('auth:signIn', () => {
  signIn?.finish({ ok: false, error: 'cancelled' })
  return new Promise((resolve) => {
    const state = crypto.randomBytes(24).toString('base64url')
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const ok = url.searchParams.get('state') === state && !!url.searchParams.get('id_token')
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' })
      res.end(
        page(
          ok
            ? 'Signed in — you can close this tab and go back to the app. / Přihlášeno — tuhle záložku můžeš zavřít a vrátit se do appky.'
            : 'This sign-in link is not valid any more. / Tento odkaz pro přihlášení už neplatí.',
        ),
      )
      if (ok) {
        finish({ ok: true, idToken: url.searchParams.get('id_token'), accessToken: url.searchParams.get('access_token') || undefined })
        if (win?.isMinimized()) win.restore()
        win?.focus()
      }
    })
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), 10 * 60 * 1000)
    const finish = (result) => {
      clearTimeout(timer)
      server.close()
      if (signIn?.server === server) signIn = undefined
      resolve(result)
    }
    signIn = { server, finish }
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      void shell.openExternal(`${WEB_URL}#/desktop-login?port=${port}&state=${state}`)
    })
  })
})
