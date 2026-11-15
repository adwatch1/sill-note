import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Key } from '../../../shared/i18n'
import confirmStyles from './ConfirmDialog.module.css'
import styles from './WhatsNew.module.css'

// Bu sürümün yenilikleri. Her yeni sürümde bu liste ve sözlükteki whatsNew.* yazıları değişir.
const ITEMS: { key: Key; exeOnly?: boolean }[] = [
  { key: 'whatsNew.checklist' },
  { key: 'whatsNew.leftEdge' },
  // Mağaza sürümünü mağaza günceller; bu madde orada anlamsız.
  { key: 'whatsNew.autoUpdate', exeOnly: true }
]

interface Props {
  version: string
  isStore: boolean
  onClose: () => void
}

/** Güncellemeden sonraki ilk açılışta bir kez: "Sill Note X ile gelenler" (onay penceresiyle aynı dil). */
export function WhatsNew({ version, isStore, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    // Esc ve Enter sadece bu kartı kapatsın, paneli değil.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <motion.div
      className={confirmStyles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onClose}
    >
      <motion.div
        className={`${confirmStyles.card} ${styles.card}`}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 600, damping: 34 } }}
        exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.12 } }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Sparkles size={22} strokeWidth={1.7} className={styles.icon} />
        <div className={`${confirmStyles.title} ${styles.title}`}>{t('whatsNew.title', { version })}</div>
        <ul className={styles.list}>
          {ITEMS.filter((i) => !(i.exeOnly && isStore)).map((i) => {
            // "Başlık: açıklama" → başlık kalın. (Japonca/Çince tam genişlikli iki nokta da sayılır.)
            const text = t(i.key)
            const m = text.match(/^([^:：]+)[:：]\s*(.*)$/)
            return (
              <li key={i.key}>
                {m ? (
                  <>
                    <b>{m[1]}</b> {m[2]}
                  </>
                ) : (
                  text
                )}
              </li>
            )
          })}
        </ul>
        <div className={confirmStyles.buttons}>
          <button className={`${confirmStyles.button} ${styles.ok}`} onClick={onClose} autoFocus>
            {t('whatsNew.ok')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
