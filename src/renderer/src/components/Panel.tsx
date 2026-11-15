import { useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { springPanel } from '../motion'
import { useNotes } from '../store/notesStore'
import { TabBar } from './TabBar'
import { SubtabList } from './SubtabList'
import { NoteView } from './NoteView'
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog'
import { ContextMenuHost } from './ContextMenu'
import { SettingsView } from './SettingsView'
import { Resizer } from './Resizer'
import { UpdateBanner } from './UpdateBanner'
import { WhatsNew } from './WhatsNew'
import { LIMITS, DEFAULT_SETTINGS, type PanelSide, type Settings } from '../../../shared/settings'
import resizerStyles from './Resizer.module.css'
import { isTabColor } from '../../../shared/notes'
import styles from './Panel.module.css'
import { useI18n } from '../i18n'

interface Props {
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
  pinned: boolean
  onTogglePin: () => void
  /** Panel genişliği React durumunda DEĞİL (bkz. App.tsx) — sürükleme başında okunur. */
  getPanelWidth: () => number
  onPanelWidth: (width: number) => void
  onPanelWidthCommit: () => void
  subtabWidth: number
  onSubtabWidth: (width: number) => void
  subtabsHidden: boolean
  onToggleSubtabs: () => void
  /** Zeminin opaklığı (0.6–1). */
  opacity: number
  /** Panelin yaşadığı kenar. Solda her şey aynalanır: kayma yönü, gölge payı, sütun, tutamaklar. */
  side: PanelSide
  /** Güncellemeden sonraki ilk açılış: yenilikler kartı (null = gösterme). */
  whatsNew: { version: string; isStore: boolean } | null
  onWhatsNewDone: () => void
  onSettingsChange: (s: Settings) => void
}

export function Panel({
  settingsOpen,
  onSettingsOpenChange,
  pinned,
  onTogglePin,
  getPanelWidth,
  onPanelWidth,
  onPanelWidthCommit,
  subtabWidth,
  onSubtabWidth,
  subtabsHidden,
  onToggleSubtabs,
  opacity,
  side,
  whatsNew,
  onWhatsNewDone,
  onSettingsChange
}: Props) {
  const { activeTab, actions } = useNotes()
  const { t } = useI18n()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [resizing, setResizing] = useState(false)
  // Her açılışta yeni bir animasyon grubu: seçim hapları önceki panelden kalan konumu
  // hatırlayıp (kapanırken sağa kaymış hâli) ekrana uçarak gelmesin.
  const [layoutGroupId] = useState(() => crypto.randomUUID())
  const panelRef = useRef<HTMLDivElement>(null)
  // Tanınmayan renk (ör. daha yeni bir sürümden) → renksiz göster.
  // Panel ekranın dışına doğru kayar: sağdaysa sağa, soldaysa sola.
  const offX = side === 'left' ? '-108%' : '108%'
  const color = activeTab && isTabColor(activeTab.color) ? activeTab.color : undefined

  return (
    <motion.div
      ref={panelRef}
      className={`${styles.panel} ${settingsOpen ? styles.underSettings : ''}`}
      data-side={side}
      style={{
        ['--subtab-width' as string]: `${subtabWidth}px`,
        ['--panel-alpha' as string]: `${Math.round(opacity * 100)}%`
      }}
      initial={{ x: offX, opacity: 0.4, scale: 0.98 }}
      animate={{
        x: 0,
        opacity: 1,
        scale: 1,
        transition: springPanel
      }}
      exit={{
        x: offX,
        opacity: 0.4,
        scale: 0.98,
        transition: { duration: 0.24, ease: [0.4, 0, 1, 1] }
      }}
    >
      <ContextMenuHost container={panelRef}>
        <LayoutGroup id={layoutGroupId}>
          <TabBar
            /* Genişlik sadece kenardan sürüklenerek değişiyor; rayı dondurmak için tek kaynak bu. */
            resizing={resizing}
            onConfirm={setConfirm}
            onOpenSettings={() => onSettingsOpenChange(true)}
            pinned={pinned}
            onTogglePin={onTogglePin}
            subtabsHidden={subtabsHidden}
            onToggleSubtabs={onToggleSubtabs}
            side={side}
          />

          <div className={styles.updateSlot}>
            <UpdateBanner />
          </div>

          {activeTab ? (
            <div className={styles.body} data-color={color}>
              {/* Sütun gizlenince genişliği yaylanarak sıfıra iner; not alanı boşalan yere yayılır. */}
              <AnimatePresence initial={false}>
                {!subtabsHidden && (
                  <motion.div
                    key="subtabs"
                    className={styles.subtabs}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={springPanel}
                  >
                    <SubtabList key={activeTab.id} tab={activeTab} onConfirm={setConfirm} />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Alt başlık sütunuyla not arasındaki dikey çizgi: sürüklenerek genişler. */}
              {!subtabsHidden && (
                <Resizer
                  className={resizerStyles.columnEdge}
                  title={t('panel.resizeColumn')}
                  getValue={() => subtabWidth}
                  min={LIMITS.subtabWidth.min}
                  max={LIMITS.subtabWidth.max}
                  reset={DEFAULT_SETTINGS.subtabWidth}
                  /* Sütun sağdaysa (aynalı) sola sürükleyince genişler. */
                  invert={side === 'left'}
                  onChange={onSubtabWidth}
                  onDragging={setResizing}
                />
              )}
              <NoteView />
            </div>
          ) : (
            <div className={styles.empty}>
              <p>{t('panel.noTabs')}</p>
              <button className={styles.emptyButton} onClick={() => actions.addTab(t('tabs.new'))}>
                {t('panel.addFirstTab')}
              </button>
            </div>
          )}
        </LayoutGroup>
      </ContextMenuHost>

      {/* Panelin ekranın ortasına bakan kenarı (sağdaysa sol, soldaysa sağ kenar): dışa doğru
          sürükleyince panel genişler, pencere de onunla büyür.
          Ayarlar ekranı açıkken gizli — ekran panelin üstünü kaplıyor, altındaki şeride
          denk gelen sürükleme kafa karıştırırdı. */}
      {!settingsOpen && (
        <Resizer
          className={resizerStyles.panelEdge}
          title={t('panel.resizePanel')}
          getValue={getPanelWidth}
          min={LIMITS.panelWidth.min}
          max={LIMITS.panelWidth.max}
          reset={DEFAULT_SETTINGS.panelWidth}
          invert={side !== 'left'}
          onChange={onPanelWidth}
          onCommit={onPanelWidthCommit}
          onDragging={setResizing}
        />
      )}

      <AnimatePresence>
        {settingsOpen && <SettingsView key="settings" onClose={() => onSettingsOpenChange(false)} onChange={onSettingsChange} />}
      </AnimatePresence>

      <AnimatePresence>
        {whatsNew && !settingsOpen && !confirm && (
          <WhatsNew key="whatsnew" version={whatsNew.version} isStore={whatsNew.isStore} onClose={onWhatsNewDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      </AnimatePresence>
    </motion.div>
  )
}
