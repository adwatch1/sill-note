import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readdirSync } from 'fs'
import { dirname } from 'path'
import type { AppUpdater } from 'electron-updater'
import type { UpdateMode, UpdateState } from '../shared/update'
import { SITE_URL } from '../shared/app'
import { IS_STORE } from './config'
import { getSettings } from './settings'

// Yeni sürüm denetimi. Programın YouTube önizlemesinden sonra internete çıktığı ikinci yer:
// sadece güncelleme adresi (GitHub'daki son sürümün latest.yml dosyası ve kurulum dosyası).
// Adres kodda değil paketin içindeki app-update.yml'de (package.json → build.publish).
// Notlardan hiçbir şey gönderilmez. Ayarlardan kapatılabilir (checkUpdates).
//
// İndirilen kurulum dosyası, latest.yml'deki SHA-512 özetiyle karşılaştırılır; bozuk ya da
// yarım inmiş dosya kurulmaz.

const DAY_MS = 24 * 60 * 60 * 1000
const FIRST_CHECK_MS = 60 * 1000 // açılışta hemen değil: program yerleşsin, internet bağlansın
const TICK_MS = 60 * 60 * 1000 // saatte bir "24 saat doldu mu?" bak (bilgisayar uykudan uyanınca da yakalar)
const INSTALL_DELAY_MS = 1200 // "Kuruluyor…" yazısı görünsün, sonra kapan

let mode: UpdateMode = 'off'
let state: UpdateState = { mode: 'off', status: 'idle' }
let updater: AppUpdater | null = null
let lastCheck = 0
let flushBeforeInstall: () => Promise<void> = async () => {}

/** Geliştirmede hatayı konsola yaz (kurulu sürüm sessiz kalır). */
const devLog = (e: unknown): void => {
  if (!app.isPackaged) console.error('[update]', e)
}

function detectMode(): UpdateMode {
  if (IS_STORE) return 'off'
  // Geliştirmede sadece test için açılır (SILL_DEV_UPDATE=1 + SILL_UPDATE_CONFIG=<yml yolu>).
  if (!app.isPackaged) return process.env.SILL_DEV_UPDATE === '1' ? 'install' : 'off'
  // Kurulu sürümün klasöründe kaldırma programı ("Uninstall ….exe") durur; taşınabilir ZIP'te yoktur.
  try {
    return readdirSync(dirname(process.execPath)).some((f) => /^Uninstall .*\.exe$/i.test(f)) ? 'install' : 'notify'
  } catch {
    return 'notify'
  }
}

function setState(next: Omit<UpdateState, 'mode'>): void {
  state = { mode, ...next }
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:state', state)
  }
}

async function getUpdater(): Promise<AppUpdater> {
  if (updater) return updater
  // Paket sadece gerekince yüklenir (mağaza sürümünde hiç). CommonJS paketi böyle yüklenince
  // `autoUpdater` bir alt katmanda (default) gelebiliyor; ikisine de bak.
  const mod = (await import('electron-updater')) as typeof import('electron-updater') & {
    default?: typeof import('electron-updater')
  }
  const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater
  if (!autoUpdater) throw new Error('electron-updater yüklenemedi')
  autoUpdater.logger = null // kendi günlük dosyasını yazmasın
  autoUpdater.autoDownload = false // önce kullanıcıya sorulur
  autoUpdater.autoInstallOnAppQuit = false // kullanıcı "İndir ve kur" demeden hiçbir şey kurulmaz
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  // Parça parça (fark) indirme eski sürümün haritasını ister; o dosyaları yayınlamıyoruz.
  autoUpdater.disableDifferentialDownload = true
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true
    if (process.env.SILL_UPDATE_CONFIG) autoUpdater.updateConfigPath = process.env.SILL_UPDATE_CONFIG
  }

  autoUpdater.on('download-progress', (p) => {
    setState({ status: 'downloading', version: state.version, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setState({ status: 'downloaded', version: info.version })
    // Geliştirmede (test sunucusundan inen sahte dosya) hiçbir şey çalıştırılmaz.
    if (!app.isPackaged) return
    // Bekleyen not kaydı önce diske yazılır, sonra kurulum başlar ve program kapanır.
    // Kurulum bitince program kendiliğinden yeniden açılır.
    setTimeout(() => {
      void flushBeforeInstall().finally(() => updater?.quitAndInstall(true, true))
    }, INSTALL_DELAY_MS)
  })
  updater = autoUpdater
  return autoUpdater
}

/** Yeni sürüm var mı? `manual`: Ayarlar'daki "Şimdi denetle" (sonucu ve hatayı göster). */
async function check(manual: boolean): Promise<void> {
  if (mode === 'off') return
  if (!manual && !getSettings().checkUpdates) return
  // İndirme sürerken ya da kurulum başlarken yeniden denetleme.
  if (state.status === 'checking' || state.status === 'downloading' || state.status === 'downloaded') return
  lastCheck = Date.now()
  if (manual) setState({ status: 'checking' })
  try {
    const u = await getUpdater()
    const r = await u.checkForUpdates()
    if (r?.isUpdateAvailable && r.updateInfo.version) {
      setState({ status: 'available', version: r.updateInfo.version })
    } else {
      setState({ status: manual ? 'latest' : 'idle' })
    }
  } catch (e) {
    devLog(e)
    // İnternet yokken kendiliğinden yapılan denetim sessizce geçer; bir sonraki gün tekrar denenir.
    setState(manual ? { status: 'error', errorPhase: 'check' } : { status: 'idle' })
  }
}

async function download(): Promise<void> {
  if (state.status !== 'available' && !(state.status === 'error' && state.errorPhase === 'download')) return
  if (mode === 'notify') {
    void shell.openExternal(SITE_URL)
    return
  }
  if (mode !== 'install') return
  const version = state.version
  setState({ status: 'downloading', version, percent: 0 })
  try {
    const u = await getUpdater()
    // İndirme, son denetimin bilgisini kullanır; arada program yeniden başladıysa tazele.
    if (!(await u.checkForUpdates())?.isUpdateAvailable) {
      setState({ status: 'idle' })
      return
    }
    await u.downloadUpdate()
  } catch (e) {
    devLog(e)
    setState({ status: 'error', version, errorPhase: 'download' })
  }
}

/** Açılışta bir kez. `flush`: kurulumdan önce bekleyen not kaydını yazdırır. */
export function initUpdater(opts: { flush: () => Promise<void> }): void {
  flushBeforeInstall = opts.flush
  mode = detectMode()
  state = { mode, status: 'idle' }

  ipcMain.handle('update:get', () => state)
  ipcMain.handle('update:check', () => check(true))
  ipcMain.on('update:download', () => void download())
  // "Sonra": bu sürüm için bir sonraki denetime (24 saat) kadar sus.
  ipcMain.on('update:dismiss', () => {
    if (state.status === 'available' || state.status === 'latest' || state.status === 'error') setState({ status: 'idle' })
  })

  wasEnabled = getSettings().checkUpdates
  if (mode === 'off') return
  setTimeout(() => void check(false), FIRST_CHECK_MS)
  setInterval(() => {
    if (Date.now() - lastCheck >= DAY_MS) void check(false)
  }, TICK_MS)
}

let wasEnabled: boolean | null = null

/** Her ayar değişiminde çağrılır; sadece "Güncellemeleri denetle" değiştiyse bir şey yapar. */
export function onUpdateSettingChanged(): void {
  const enabled = getSettings().checkUpdates
  if (mode === 'off' || enabled === wasEnabled) return
  const first = wasEnabled === null
  wasEnabled = enabled
  if (first) return
  // Yeni açıldı ve bugün hiç bakılmadı: bir gün bekletme, kısa süre sonra bak.
  if (enabled && Date.now() - lastCheck >= DAY_MS) setTimeout(() => void check(false), 5000)
  // Kapatıldı: bekleyen haberi de kaldır.
  if (!enabled && state.status === 'available') setState({ status: 'idle' })
}
