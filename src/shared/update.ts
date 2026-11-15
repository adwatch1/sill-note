// Güncelleme denetimi — arka plan ve arayüz ortak kullanır.

/**
 * Bu kopya nasıl güncellenir?
 *  off     → hiç denetlenmez (mağaza sürümünü mağaza günceller; geliştirme)
 *  install → kurulu .exe: "İndir ve kur" ile indirilir ve kendiliğinden kurulur
 *  notify  → taşınabilir sürüm: sadece haber verilir, düğme siteyi açar (kurulumsuz kopya
 *            sessizce "kurulu" hâle getirilmez)
 */
export type UpdateMode = 'off' | 'install' | 'notify'

export type UpdateStatus =
  | 'idle' // bir şey yok (ya da kullanıcı "Sonra" dedi)
  | 'checking'
  | 'latest' // elle denetlendi, en son sürüm kullanılıyor
  | 'available'
  | 'downloading'
  | 'downloaded' // kurulum başlıyor, program birazdan kapanıp yeniden açılacak
  | 'error'

export interface UpdateState {
  mode: UpdateMode
  status: UpdateStatus
  /** Yeni sürümün numarası (available ve sonrası). */
  version?: string
  /** İndirme yüzdesi (0–100). */
  percent?: number
  /** Hata hangi adımda oldu: denetimde (sadece ayarlarda gösterilir) mi, indirmede mi. */
  errorPhase?: 'check' | 'download'
}
