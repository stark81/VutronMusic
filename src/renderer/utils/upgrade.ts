import { compare } from 'compare-versions'

/**
 * 版本升级迁移：4.0 重构了播放器 / 缓存机制，3.x 遗留在 localStorage 里的
 * 播放器持久化状态（pinia 的 `player` store）会让新版播放异常。
 *
 * 4.0.0 的发布说明要求用户手动到「设置 → 音乐设置 → 播放器设置」点一次
 * 「重置播放器状态」，但几乎没人会看说明（issue #424）。所以这里在启动时
 * 自己判断：上次运行的版本低于 4.0.0 就自动重置一次。
 *
 * 只做一次：记录上次运行的版本号，4.0.0 之后正常升级不会再触发。
 */

/** 播放器重构的版本基线：低于该版本的持久化播放器状态需要重置 */
export const PLAYER_RESET_BASELINE = '4.0.0'

/** 上次运行的版本号（独立于 pinia 的持久化键，避免被 store 覆盖） */
export const LAST_RUN_VERSION_KEY = 'vutron:lastRunVersion'

export const getLastRunVersion = (): string | null => {
  try {
    return localStorage.getItem(LAST_RUN_VERSION_KEY)
  } catch {
    return null
  }
}

export const setLastRunVersion = (version: string): void => {
  try {
    localStorage.setItem(LAST_RUN_VERSION_KEY, version)
  } catch {
    // localStorage 不可用（隐私模式 / 存储被清理）时忽略：下次启动会再判断一次
  }
}

/**
 * 是否需要因为版本升级重置播放器状态。
 *
 * @param previous 上次运行的版本号；`null` 表示从未记录（首次运行，或从没有该逻辑的旧版本升级上来）
 * @param current  本次运行的版本号
 */
export const shouldResetPlayerForUpgrade = (
  previous: string | null,
  current: string | null | undefined
): boolean => {
  // 拿不到当前版本时不动用户数据
  if (!current || compare(current, PLAYER_RESET_BASELINE, '<')) return false
  // 没有记录 → 视为旧版本（v3 及更早的 localStorage 里没有这个键）
  if (!previous) return true
  return compare(previous, PLAYER_RESET_BASELINE, '<')
}
