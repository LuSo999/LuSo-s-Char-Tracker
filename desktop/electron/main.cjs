// LuSo Sheet Tool: the desktop app. Its window shows the web app (LuSo's Char Tracker, always
// the current version) and gives it what a browser can't: AI requests with the API keys kept on
// this computer (encrypted with the OS keychain when available), saving files with a dialog,
// and Google sign-in through the system browser (Google doesn't allow it inside apps).
const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { runners } = require('./ai.cjs')

/** The web app; LUSO_WEB_URL points elsewhere for development (http://localhost:5173/LuSo-s-Char-Tracker/). */
const WEB_URL = process.env.LUSO_WEB_URL || 'https://luso999.github.io/LuSo-s-Char-Tracker/'
const WEB_ORIGIN = new URL(WEB_URL).origin
/** The web app itself: its origin and path (other pages of the same site are not it). */
const WEB_BASE = new URL(WEB_URL).origin + new URL(WEB_URL).pathname
const isWebApp = (url) => {
  try {
    const u = new URL(url)
    return u.origin + u.pathname === WEB_BASE || (u.origin === WEB_ORIGIN && u.pathname.startsWith(WEB_BASE.slice(WEB_ORIGIN.length)))
  } catch {
    return false
  }
}
const OFFLINE_URL = pathToFileURL(path.join(__dirname, 'offline.html')).href
const PROVIDERS = ['claude', 'openai', 'gemini']
const ENV = { claude: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] }
const dataDir = () => app.getPath('userData')
const keyFile = (provider) => path.join(dataDir(), provider === 'claude' ? 'api-key.bin' : `api-key-${provider}.bin`)

/** Only the web app's own pages (main frame) may use the desktop functions. */
const trusted = (e) => !!e.senderFrame && e.senderFrame === e.sender.mainFrame && isWebApp(e.senderFrame.url)
const handle = (channel, fn) =>
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Not allowed')
    return fn(e, ...args)
  })
// The preload asks once, synchronously: whether this page gets the bridge, and the app's version.
ipcMain.on('desktop:info', (e) => {
  e.returnValue = { trusted: trusted(e), offline: e.senderFrame?.url.split(/[?#]/)[0] === OFFLINE_URL, version: app.getVersion() }
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
  // The window shows only the web app (and the offline page); anything else opens in the browser.
  win.webContents.on('will-navigate', (e, url) => {
    if (isWebApp(url) || url.split(/[?#]/)[0] === OFFLINE_URL) return
    e.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })
  win.webContents.on('will-redirect', (e, url) => {
    if (!isWebApp(url)) e.preventDefault()
  })
  // No connection: a small page with a retry button.
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */) return
    void win.loadFile(path.join(__dirname, 'offline.html'))
  })
  void win.loadURL(WEB_URL)
}

app.whenReady().then(() => {
  // The web app needs no camera, microphone, location, notifications… : nothing is granted.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, done) => done(permission === 'clipboard-sanitized-write'))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write')
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
// random state value. The address answers with a redirect to a page without the tokens, takes
// them only once and closes; the window then signs in with them (Firebase signInWithCredential).

let signIn // the sign-in in progress: { promise, url, finish }
const page = (text) =>
  `<!doctype html><meta charset="utf-8"><title>LuSo's Char Tracker</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h2>LuSo's Char Tracker</h2><p>${text}</p></body>`
const DONE = 'Signed in — you can close this tab and go back to the app. / Přihlášeno — tuhle záložku můžeš zavřít a vrátit se do appky.'
const INVALID = 'This sign-in link is not valid any more: start the sign-in again in the app. / Tento odkaz pro přihlášení už neplatí: spusť přihlášení znovu v appce.'

handle('auth:cancel', () => {
  signIn?.finish({ ok: false, error: 'cancelled' })
  return true
})
handle('auth:signIn', () => {
  // Already waiting (a second click): show the same sign-in in the browser again.
  if (signIn) {
    if (signIn.url) void shell.openExternal(signIn.url)
    return signIn.promise
  }
  const state = crypto.randomBytes(24).toString('base64url')
  let used = false
  let done = false
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    res.setHeader('connection', 'close')
    if (url.pathname === '/done') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page(DONE))
      return
    }
    if (url.pathname !== '/callback') {
      res.writeHead(404).end()
      return
    }
    const idToken = url.searchParams.get('id_token')
    if (used || done || url.searchParams.get('state') !== state || !idToken) {
      res.writeHead(400, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page(INVALID))
      return
    }
    used = true
    // Away from the address with the tokens at once (the tab shows /done; the page is kept a moment for it).
    res.writeHead(303, { location: '/done', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }).end()
    finish({ ok: true, idToken, accessToken: url.searchParams.get('access_token') || undefined }, 5000)
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })
  let resolve
  const promise = new Promise((r) => (resolve = r))
  const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), 10 * 60 * 1000)
  /** Ends this sign-in once: the answer to the page, then the address closes (after `linger` ms for the /done page). */
  function finish(result, linger = 0) {
    if (done) return
    done = true
    clearTimeout(timer)
    if (signIn?.promise === promise) signIn = undefined
    setTimeout(() => {
      server.close()
      server.closeAllConnections()
    }, linger)
    resolve(result)
  }
  server.on('error', (err) => finish({ ok: false, error: `sign-in: ${err.message}` }))
  signIn = { promise, url: undefined, finish }
  server.listen(0, '127.0.0.1', () => {
    if (done) return // cancelled before it started
    const { port } = server.address()
    signIn.url = `${WEB_URL}#/desktop-login?port=${port}&state=${state}`
    void shell.openExternal(signIn.url)
  })
  return promise
})
