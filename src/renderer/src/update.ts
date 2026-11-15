import { useEffect, useState } from 'react'
import type { UpdateState } from '../../shared/update'

/** Güncelleme durumunu izle (arka plan her değişimde haber verir). */
export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ mode: 'off', status: 'idle' })
  useEffect(() => {
    let alive = true
    void window.updates.get().then((s) => alive && setState(s))
    const off = window.updates.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
