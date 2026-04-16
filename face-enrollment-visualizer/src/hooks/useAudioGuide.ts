import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const WARM_VOICE_HINTS = [
  'samantha',
  'aria',
  'zira',
  'ava',
  'karen',
  'moira',
  'allison',
  'emma',
  'female',
  'google uk english female',
]

const findFriendlyVoice = (voices: SpeechSynthesisVoice[]) => {
  if (!voices.length) {
    return null
  }

  const normalize = (value: string) => value.toLowerCase()

  const hinted = voices.find((voice) => {
    const voiceName = normalize(voice.name)
    return voice.lang.startsWith('en') && WARM_VOICE_HINTS.some(hint => voiceName.includes(hint))
  })

  if (hinted) {
    return hinted
  }

  const naturalEnglish = voices.find((voice) => {
    const voiceName = normalize(voice.name)
    return (
      voice.lang.startsWith('en')
      && (
        voiceName.includes('natural')
        || voiceName.includes('neural')
        || voiceName.includes('google')
      )
    )
  })

  if (naturalEnglish) {
    return naturalEnglish
  }

  const localeVoice = voices.find(voice => voice.lang.startsWith((navigator.language || 'en').slice(0, 2)))
  if (localeVoice) {
    return localeVoice
  }

  return voices.find(voice => voice.lang.startsWith('en')) || voices[0]
}

export const useAudioGuide = (text: string | undefined) => {
  const [enabled, setEnabled] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const lastSpokenRef = useRef<string>('')
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const loadVoices = useCallback(() => {
    if (!isSupported) {
      return
    }

    const availableVoices = window.speechSynthesis.getVoices()
    if (availableVoices.length > 0) {
      setVoices(availableVoices)
    }
  }, [isSupported])

  useEffect(() => {
    if (!isSupported) {
      return
    }

    const synth = window.speechSynthesis
    loadVoices()
    synth.onvoiceschanged = loadVoices

    return () => {
      if (synth.onvoiceschanged === loadVoices) {
        synth.onvoiceschanged = null
      }
      synth.cancel()
    }
  }, [isSupported, loadVoices])

  const selectedVoice = useMemo(() => findFriendlyVoice(voices), [voices])

  useEffect(() => {
    if (!isSupported || !enabled) {
      if (isSupported) {
        window.speechSynthesis.cancel()
      }
      setIsSpeaking(false)
      return
    }

    const trimmedText = text?.trim()
    if (!trimmedText || trimmedText === lastSpokenRef.current) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(trimmedText)
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    utterance.lang = selectedVoice?.lang || navigator.language || 'en-US'
    utterance.rate = 0.88
    utterance.pitch = 1.02
    utterance.volume = 0.96

    utterance.onstart = () => setIsSpeaking(true)
    const finishSpeaking = () => setIsSpeaking(false)
    utterance.onend = finishSpeaking
    utterance.onerror = finishSpeaking

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    lastSpokenRef.current = trimmedText

    return () => {
      utterance.onstart = null
      utterance.onend = null
      utterance.onerror = null
    }
  }, [enabled, isSupported, selectedVoice, text])

  return {
    enabled,
    setEnabled,
    isSpeaking,
    isSupported,
    selectedVoiceName: selectedVoice?.name || null,
  }
}
