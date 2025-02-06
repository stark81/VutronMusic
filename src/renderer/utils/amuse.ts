import { usePlayerStore } from '../store/player'

// import type { AmuseInfo } from '../../main/amuseServer'

export function initAmuseQueryChannel() {
  const player = usePlayerStore()

  window.mainApi!.on('queryAmuseInfo', (_event, echo: string) => {
    window.mainApi!.send('queryAmuseInfoReturn', JSON.stringify(player), echo)
  })
}
