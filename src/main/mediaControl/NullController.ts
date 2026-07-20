import { MediaController } from './types'

/** 空实现——在不支持的平台上静默降级 */
export class NullController implements MediaController {
  setMetadata() {}
  updateInfo() {}
  destroy() {}
}
