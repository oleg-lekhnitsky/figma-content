import { useWebHaptics } from 'web-haptics/vue'

export const useAppHaptics = () => {
  const { trigger } = useWebHaptics()

  return {
    selection: () => { void trigger('selection') },
    success: () => { void trigger('success') },
    error: () => { void trigger('error') },
  }
}
