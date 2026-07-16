import { onUnmounted, ref } from 'vue'

/**
 * Web Speech API helper (TTS). Cross-cutting UI capability — lives in shared.
 *
 * @param {{
 *   storageKey?: string,
 *   voiceStorageKey?: string,
 *   lang?: string,
 *   rate?: number,
 *   pitch?: number,
 * }} [options]
 */
export function useSpeech(options = {}) {
  const storageKey = options.storageKey || 'app-speech-muted'
  const voiceStorageKey = options.voiceStorageKey || `${storageKey.replace(/-muted$/, '')}-uri`
  const preferredLang = options.lang || 'es-PE'
  const rate = options.rate ?? 1.05
  const pitch = options.pitch ?? 1

  const muted = ref(
    typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1',
  )
  const selectedVoiceUri = ref(
    typeof localStorage !== 'undefined' ? (localStorage.getItem(voiceStorageKey) || '') : '',
  )
  /** @type {import('vue').Ref<Array<{ uri: string, name: string, lang: string, label: string }>>} */
  const voices = ref([])
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  /** @type {SpeechSynthesisVoice | null} */
  let activeVoice = null
  let lastKey = ''
  let lastAt = 0

  function readStoredVoiceUri() {
    try {
      return localStorage.getItem(voiceStorageKey) || ''
    } catch {
      return ''
    }
  }

  function persistVoiceUri(uri) {
    try {
      if (uri) localStorage.setItem(voiceStorageKey, uri)
      else localStorage.removeItem(voiceStorageKey)
    } catch {
      /* ignore quota / private mode */
    }
  }

  function autoPickVoice(list) {
    const langLower = preferredLang.toLowerCase()
    const prefix = langLower.slice(0, 2)
    return (
      list.find((v) => v.lang?.toLowerCase() === langLower)
      || list.find((v) => v.lang?.toLowerCase().startsWith(langLower))
      || list.find((v) => v.lang?.toLowerCase().startsWith(`${prefix}-`))
      || list.find((v) => v.lang?.toLowerCase().startsWith(prefix))
      || list[0]
      || null
    )
  }

  function resolveActiveVoice(all) {
    if (selectedVoiceUri.value) {
      const chosen = all.find((v) => v.voiceURI === selectedVoiceUri.value)
      if (chosen) {
        activeVoice = chosen
        return
      }
    }
    activeVoice = autoPickVoice(all)
    if (activeVoice && !selectedVoiceUri.value) {
      selectedVoiceUri.value = activeVoice.voiceURI
    }
  }

  function refreshVoices() {
    if (!supported) {
      voices.value = []
      activeVoice = null
      return
    }
    const all = window.speechSynthesis.getVoices()
    const prefix = preferredLang.slice(0, 2).toLowerCase()
    const matching = all.filter((v) => v.lang?.toLowerCase().startsWith(prefix))
    const pool = matching.length ? matching : all
    voices.value = pool.map((v) => ({
      uri: v.voiceURI,
      name: v.name,
      lang: v.lang,
      label: `${v.name} (${v.lang})`,
    }))
    resolveActiveVoice(all)
  }

  function onVoicesChanged() {
    refreshVoices()
  }

  if (supported) {
    selectedVoiceUri.value = readStoredVoiceUri()
    refreshVoices()
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
      /* ignore */
    }
    if (muted.value) cancel()
  }

  function toggleMute() {
    setMuted(!muted.value)
  }

  /**
   * @param {string} uri voiceURI from SpeechSynthesisVoice
   * @param {{ preview?: boolean }} [opts]
   */
  function setVoice(uri, opts = {}) {
    if (!uri) return
    selectedVoiceUri.value = uri
    persistVoiceUri(uri)
    if (supported) resolveActiveVoice(window.speechSynthesis.getVoices())
    if (opts.preview !== false) {
      speak('Así suena esta voz.', { key: `voice-preview-${uri}`, interrupt: true })
    }
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
    if (!activeVoice) refreshVoices()

    const utterance = new SpeechSynthesisUtterance(text.trim())
    utterance.lang = activeVoice?.lang || preferredLang
    utterance.rate = rate
    utterance.pitch = pitch
    if (activeVoice) utterance.voice = activeVoice
    window.speechSynthesis.speak(utterance)
  }

  onUnmounted(() => {
    cancel()
    if (supported) {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
    }
  })

  return {
    muted,
    supported,
    voices,
    selectedVoiceUri,
    speak,
    cancel,
    toggleMute,
    setMuted,
    setVoice,
  }
}
