import type { BoardViewSettings } from '@content-library/shared'

export const boardViewStyle = (view: BoardViewSettings, baseColumns = 7) => {
  const radius = {
    none: '0px',
    small: 'calc(var(--radius) / 2)',
    default: 'var(--radius)',
    large: 'var(--radius-mobile)'
  }[view.radius]
  const gap = {
    none: '0px',
    tight: 'calc(var(--space) / 4)',
    default: 'var(--board-default-gap, var(--space))',
    wide: 'calc(var(--space) * 2)'
  }[view.gap]
  const density = view.columns === 'even-fewer'
    ? -3
    : view.columns === 'fewer'
      ? -1
      : view.columns === 'more'
        ? 1
        : view.columns === 'even-more'
          ? 2
          : typeof view.columns === 'number'
            ? Math.max(-3, Math.min(2, view.columns - baseColumns))
            : 0

  return {
    '--board-column-offset': String(density),
    '--board-radius': radius,
    '--board-gap': gap
  }
}
