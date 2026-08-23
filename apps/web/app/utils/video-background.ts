import type { VideoComposerSettings } from '~/types/video-composer'

export type VideoBackgroundSettings = Pick<VideoComposerSettings,
  'backgroundType' | 'backgroundColor' | 'backgroundGradientColor' | 'backgroundGradientAngle'>

export const defaultVideoBackground: VideoBackgroundSettings = {
  backgroundType: 'solid',
  backgroundColor: '#000000',
  backgroundGradientColor: '#111111',
  backgroundGradientAngle: 180
}

export const videoBackgroundStorageKey = 'figma-library:video-background:v1'

const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export const readStoredVideoBackground = (): VideoBackgroundSettings | undefined => {
  try {
    const value = JSON.parse(localStorage.getItem(videoBackgroundStorageKey) || 'null') as Partial<VideoBackgroundSettings> | null
    if (!value || (value.backgroundType !== 'solid' && value.backgroundType !== 'gradient')) return
    if (!isHexColor(value.backgroundColor) || !isHexColor(value.backgroundGradientColor)) return
    if (!Number.isFinite(value.backgroundGradientAngle)) return
    return {
      backgroundType: value.backgroundType,
      backgroundColor: value.backgroundColor,
      backgroundGradientColor: value.backgroundGradientColor,
      backgroundGradientAngle: Math.max(0, Math.min(360, Number(value.backgroundGradientAngle)))
    }
  } catch {
    return
  }
}

export const storeVideoBackground = (background: VideoBackgroundSettings) => {
  try {
    localStorage.setItem(videoBackgroundStorageKey, JSON.stringify(background))
  } catch {
    // Storage can be unavailable in private browsing or an embedded preview.
  }
}
