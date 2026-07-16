import { onUnmounted, ref } from 'vue'

/**
 * Web Speech API helper (TTS). Cross-cutting UI capability — lives in shared.
 *
 * @param {{ storageKey?: string, lang?: string, rate?: number, pitch?: number }} [options]
 */
export function useSpeech(options = {}) {
  const storageKey = options.storageKey || 'app-speech-muted'
  const preferredLang = options.lang || 'es-PE'
  const rate = options.rate ?? 1.05
  const pitch = options.pitch ?? 1

  const muted = ref(
    typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1',
  )
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  /** @type {SpeechSynthesisVoice | null} */
  let preferredVoice = null
  let lastKey = ''
  let lastAt = 0

  function pickVoice() {
    if (!supported) return null
    const voices = window.speechSynthesis.getVoices()
    const langLower = preferredLang.toLowerCase()
    const prefix = langLower.slice(0, 2)
    preferredVoice =
      voices.find((v) => v.lang?.toLowerCase() === langLower)
      || voices.find((v) => v.lang?.toLowerCase().startsWith(langLower))
      || voices.find((v) => v.lang?.toLowerCase().startsWith(`${prefix}-`))
      || voices.find((v) => v.lang?.toLowerCase().startsWith(prefix))
      || null
    return preferredVoice
  }

  function onVoicesChanged() {
    pickVoice()
  }

  if (supported) {
    pickVoice()
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
  }

  function cancel() {
    if (supported) window.speechSynthesis.cancel()
  }

  function setMuted(value) {
    muted.value = !!value
    try {
      localStorage.setItem(storageKey, muted.value ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
    if (muted.value) cancel()
  }

  function toggleMute() {
    setMuted(!muted.value)
  }

  /**
   * @param {string} text
   * @param {{ key?: string, interrupt?: boolean, minGapMs?: number }} [opts]
   */
  function speak(text, opts = {}) {
    if (!supported || muted.value || !text?.trim()) return
    const key = opts.key ?? text
    const interrupt = opts.interrupt !== false
    const minGapMs = opts.minGapMs ?? 0
    const now = Date.now()
    if (minGapMs > 0 && key === lastKey && now - lastAt < minGapMs) return
    lastKey = key
    lastAt = now

    if (interrupt) cancel()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    utterance.lang = preferredVoice?.lang || preferredLang
    utterance.rate = rate
    utterance.pitch = pitch
    const voice = preferredVoice || pickVoice()
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  }

  onUnmounted(() => {
    cancel()
    if (supported) {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
    }
  })

  return { muted, supported, speak, cancel, toggleMute, setMuted }
}
