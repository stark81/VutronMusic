import { BrowserWindow, screen } from 'electron'
import store from '../store'
import log from '../log'

/**
 * 界面缩放（issue #432）。
 *
 * 布局是按 1080×720 的窗口设计的。低分辨率屏幕（如 1024×600）上如果窗口最小尺寸
 * 还是 1080×720，最大化 / 全屏 / 普通窗口都会按更大的尺寸排版，界面被裁掉。
 *
 * 因此把「布局基准尺寸」和「界面缩放」拆开：
 *   · 正常情况（缩放 100%）：窗口最小尺寸 = 1080×720，与历史行为一致；
 *   · 用户在设置里把界面缩放调成 80% 时：页面整体缩放到 0.8，
 *     窗口最小尺寸按 1080×720×0.8 = 864×576 走，布局仍保有 1080×720 的 CSS 空间。
 *
 * 最后再按显示器工作区收敛一次：屏幕本身比算出来的最小尺寸还小时（例如 800×480），
 * 以屏幕为准，保证窗口至少能完整显示。
 */

/** 布局设计基准的最小窗口尺寸（CSS px） */
export const BASE_MIN_WIDTH = 1080
export const BASE_MIN_HEIGHT = 720

const UI_SCALE_MIN = 0.5
const UI_SCALE_MAX = 1.5

/** 读取界面缩放比例（渲染层写入 settings.uiScale），非法值一律回落到 100% */
export function getUiScale(): number {
  const raw = Number(store.get('settings.uiScale'))
  if (!Number.isFinite(raw) || raw <= 0) return 1
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw))
}

/** 按缩放比例计算窗口最小尺寸，并按显示器工作区收敛 */
export function getMinWindowSize(
  workArea: { width: number; height: number },
  scale = getUiScale()
): { width: number; height: number } {
  return {
    width: Math.min(Math.round(BASE_MIN_WIDTH * scale), workArea.width),
    height: Math.min(Math.round(BASE_MIN_HEIGHT * scale), workArea.height)
  }
}

/** 把界面缩放应用到窗口（Chromium 页面缩放，CSS px 随比例变化） */
export function applyUiScale(win: BrowserWindow | null, scale = getUiScale()): void {
  if (!win || win.isDestroyed()) return
  win.webContents.setZoomFactor(scale)
}

/**
 * 缩放设置变化后重新应用：页面缩放 + 窗口最小尺寸。
 * 不主动改变当前窗口大小，避免用户调缩放时窗口突然跳动。
 */
export function applyUiScaleToWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return

  const scale = getUiScale()
  applyUiScale(win, scale)

  const { workAreaSize } = screen.getDisplayMatching(win.getBounds())
  const min = getMinWindowSize(workAreaSize, scale)
  win.setMinimumSize(min.width, min.height)
  log.info(`[window] 界面缩放 ${Math.round(scale * 100)}%，窗口最小尺寸 ${min.width}×${min.height}`)
}
