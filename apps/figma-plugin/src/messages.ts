export interface SelectedFrame { id: string; name: string; width: number; height: number; pageName: string; fileKey: string | null; figmaUrl: string | null; assetId: string | null; videoHash: string | null; preview?: Uint8Array }
export interface ExportSettings { format: 'PNG' | 'JPG' | 'MP4'; scale: 1 | 2 | 3; jpgQuality: number }
export type ControllerMessage =
  | { type: 'selection'; frames: SelectedFrame[] }
  | { type: 'export-result'; requestId: string; nodeId: string; bytes?: Uint8Array; error?: string }
  | { type: 'stored-state'; value: unknown; sessionToken: string | null }
export type UiMessage =
  | { type: 'refresh-selection' }
  | { type: 'set-file-key'; fileKey: string }
  | { type: 'clear-file-key' }
  | { type: 'export'; requestId: string; nodeId: string; settings: ExportSettings }
  | { type: 'load-state' }
  | { type: 'save-state'; value: unknown }
  | { type: 'save-session'; token: string | null }
  | { type: 'open-external'; url: string }
  | { type: 'resize'; width: number; height: number }
