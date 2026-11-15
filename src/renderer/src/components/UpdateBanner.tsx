import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownCircle } from 'lucide-react'
import { springPanel } from '../motion'
import { useUpdateState } from '../update'
import { useI18n } from '../i18n'
import styles from './UpdateBanner.module.css'

/**
 * Tab çubuğunun altındaki ince şerit: yeni sürüm çıktı → "Sonra" / "İndir ve kur".
 * İndirme sürerken ilerleme çubuğu, bitince "Kuruluyor…" (program kapanıp yeniden açılır).
 * Denetim hataları burada gösterilmez (sessiz); sadece indirme hatası.
 */
export function UpdateBanner() {
  const u = useUpdateState()
  const { t, locale } = useI18n()
  const show =
    u.status === 'available' ||
    u.status === 'downloading' ||
    u.status === 'downloaded' ||
    (u.status === 'error' && u.errorPhase === 'download')
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format((u.percent ?? 0) / 100)

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="update"
          className={styles.wrap}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springPanel}
        >
          <div className={styles.banner}>
            <ArrowDownCircle size={16} strokeWidth={1.9} className={styles.icon} />
            <div className={styles.text}>
              {u.status === 'available' && t('update.available', { version: u.version ?? '' })}
              {u.status === 'downloading' && t('update.downloading', { percent })}
              {u.status === 'downloaded' && t('update.installing')}
              {u.status === 'error' && t('update.failed')}
              {u.status === 'downloading' && (
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${u.percent ?? 0}%` }} />
                </div>
              )}
            </div>
            {(u.status === 'available' || u.status === 'error') && (
              <>
                <button className={styles.later} onClick={() => window.updates.dismiss()}>
                  {t('update.later')}
                </button>
                <button className={styles.primary} onClick={() => window.updates.download()}>
                  {u.status === 'error'
                    ? t('update.retry')
                    : u.mode === 'notify'
                      ? t('update.download')
                      : t('update.install')}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
