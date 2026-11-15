// Kullanıcı ayarları — notlardan AYRI dosyada (%APPDATA%\Sill\settings.json).
// Ayar dosyası bozulsa bile notlar etkilenmez; sadece varsayılan ayarlara dönülür.
import { isLangPref, type LangPref } from './i18n'

export type ThemeMode = 'system' | 'light' | 'dark'
/** Panelin yaşadığı ekran kenarı. Sol seçilince panel aynalanır (alt başlık sütunu sağa geçer). */
export type PanelSide = 'right' | 'left'

export interface Settings {
  version: 1
  theme: ThemeMode
  /** Görünen panelin genişliği (px). Panelin ekranın ortasına bakan kenarından sürüklenerek de değişir. */
  panelWidth: number
  /** Alt başlık sütununun genişliği (px). Aradaki dikey çizgiden sürüklenir. */
  subtabWidth: number
  /** Tetik bölgesinin boyu: ekran yüksekliğinin ortadaki kesri (0.45 = orta %45). */
  triggerZone: number
  /** Mouse kenarda bu kadar kalınca panel açılır (ms). */
  dwellMs: number
  /** Electron kısayol biçimi, ör. "Control+Alt+N". */
  shortcut: string
  /** Windows açılışında başlat (sadece kurulu sürümde uygulanır). */
  launchAtStartup: boolean
  /** Raptiye: panel açıkken kendiliğinden kapanmasın (mouse çıkınca / dışarı tıklayınca). */
  pinned: boolean
  /** Kurulumdan sonraki "buradayım" gösterimi yapıldı mı? Bir kez olur. */
  introShown: boolean
  /** Ses kaydında kullanılacak mikrofonun kimliği. '' = Windows'un varsayılan mikrofonu. */
  micId: string
  /**
   * YouTube linki yapıştırınca küçük resim ve başlık internetten alınsın mı?
   * Programın internete çıktığı TEK yer; kapalıyken kart resimsiz görünür.
   */
  linkPreviews: boolean
  /** Arayüz dili. 'system' = Windows'un dilini izle (listede yoksa İngilizce). */
  language: LangPref
  /**
   * Önde tam ekran bir program (oyun, tam ekran video) varken dur: kenar tetiği ve kısayol
   * çalışmaz, açık panel kapanır. Tam ekrandan çıkınca kendiliğinden geri gelir.
   */
  pauseInFullscreen: boolean
  /** Soldaki alt başlık sütunu gizli mi (not tam genişlikte görünür). */
  subtabsHidden: boolean
  /** Panel arka planının opaklığı (1 = tam opak). Yazılar ve görseller her zaman net kalır. */
  opacity: number
  /**
   * Ekran kaydında / paylaşımında / ekran görüntüsünde görünme (Windows'un "yakalamadan hariç tut"
   * özelliği). Kamera veya yakalama kartına karşı koruma değildir.
   */
  hideFromCapture: boolean
  /** Panel hangi kenardan açılsın. */
  side: PanelSide
  /**
   * Günde bir kez yeni sürüm var mı diye bakılsın mı (sadece mağaza dışı sürüm). YouTube önizlemesinden
   * sonra programın internete çıktığı ikinci yer; kapatılabilir.
   */
  checkUpdates: boolean
  /** "Bu sürümde yenilikler" en son hangi sürüm için gösterildi. '' = hiç (eski sürümden gelen kullanıcı). */
  lastSeenVersion: string
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: 'system',
  panelWidth: 480,
  subtabWidth: 136,
  triggerZone: 0.45,
  dwellMs: 150,
  shortcut: 'Control+Alt+N',
  launchAtStartup: false,
  pinned: false,
  introShown: false,
  micId: '',
  linkPreviews: true,
  language: 'system',
  pauseInFullscreen: true,
  subtabsHidden: false,
  opacity: 1,
  hideFromCapture: false,
  side: 'right',
  checkUpdates: true,
  lastSeenVersion: ''
}

export const LIMITS = {
  panelWidth: { min: 380, max: 640, step: 10 },
  subtabWidth: { min: 96, max: 280, step: 2 },
  triggerZone: { min: 0.2, max: 0.9, step: 0.05 },
  dwellMs: { min: 0, max: 500, step: 25 },
  opacity: { min: 0.6, max: 1, step: 0.05 }
} as const

export type SettingsResult = { ok: true; settings: Settings } | { ok: false; settings: Settings; error: string }

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/** Ne gelirse gelsin (bozuk dosya, eksik alan, sınır dışı değer) geçerli bir ayar nesnesi döndür. */
export function sanitizeSettings(v: unknown): Settings {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    version: 1,
    theme: o.theme === 'light' || o.theme === 'dark' || o.theme === 'system' ? o.theme : d.theme,
    panelWidth: Math.round(clamp(o.panelWidth, LIMITS.panelWidth.min, LIMITS.panelWidth.max, d.panelWidth)),
    subtabWidth: Math.round(
      clamp(o.subtabWidth, LIMITS.subtabWidth.min, LIMITS.subtabWidth.max, d.subtabWidth)
    ),
    triggerZone: clamp(o.triggerZone, LIMITS.triggerZone.min, LIMITS.triggerZone.max, d.triggerZone),
    dwellMs: Math.round(clamp(o.dwellMs, LIMITS.dwellMs.min, LIMITS.dwellMs.max, d.dwellMs)),
    shortcut:
      typeof o.shortcut === 'string' && o.shortcut.length > 0 && o.shortcut.length <= 40 ? o.shortcut : d.shortcut,
    launchAtStartup: typeof o.launchAtStartup === 'boolean' ? o.launchAtStartup : d.launchAtStartup,
    pinned: typeof o.pinned === 'boolean' ? o.pinned : d.pinned,
    introShown: typeof o.introShown === 'boolean' ? o.introShown : d.introShown,
    micId: typeof o.micId === 'string' && o.micId.length <= 200 ? o.micId : d.micId,
    linkPreviews: typeof o.linkPreviews === 'boolean' ? o.linkPreviews : d.linkPreviews,
    language: isLangPref(o.language) ? o.language : d.language,
    pauseInFullscreen: typeof o.pauseInFullscreen === 'boolean' ? o.pauseInFullscreen : d.pauseInFullscreen,
    subtabsHidden: typeof o.subtabsHidden === 'boolean' ? o.subtabsHidden : d.subtabsHidden,
    // Kaydırıcı adımları kayan noktada 0.8500000001 gibi kalmasın.
    opacity: Math.round(clamp(o.opacity, LIMITS.opacity.min, LIMITS.opacity.max, d.opacity) * 100) / 100,
    hideFromCapture: typeof o.hideFromCapture === 'boolean' ? o.hideFromCapture : d.hideFromCapture,
    side: o.side === 'left' || o.side === 'right' ? o.side : d.side,
    checkUpdates: typeof o.checkUpdates === 'boolean' ? o.checkUpdates : d.checkUpdates,
    lastSeenVersion:
      typeof o.lastSeenVersion === 'string' && o.lastSeenVersion.length <= 20 ? o.lastSeenVersion : d.lastSeenVersion
  }
}

/** "Control+Alt+N" → "Ctrl + Alt + N" (ekranda gösterim için). */
export function formatShortcut(accel: string): string {
  return accel
    .split('+')
    .map((k) => ({ Control: 'Ctrl', CommandOrControl: 'Ctrl', Super: 'Win', Meta: 'Win' })[k] ?? k)
    .join(' + ')
}
