import type { BoardLayout } from '@content-library/shared'

export const boardLayoutOptions: ReadonlyArray<{ value: BoardLayout; label: string }> = [
  { value: 'masonry', label: 'Masonry' },
  { value: 'column', label: 'Column' },
  { value: 'grid', label: 'Grid' }
]
