// src/main/utils/cueParser.ts
const FRAMES_PER_SECOND = 75

function cueTimeToMs(time: string): number {
  const [mm, ss, ff] = time.split(':').map(Number)
  return mm * 60000 + ss * 1000 + Math.round(ff * (1000 / FRAMES_PER_SECOND))
}

export type CueTrack = {
  no: number
  title: string
  performer: string
  startMs: number
  durationMs: number
}

export type CueFile = {
  performer: string
  title: string
  file: string
  tracks: CueTrack[]
}

export function parseCue(text: string): CueFile {
  const lines = text.split('\n')
  let globalPerformer = ''
  let globalTitle = ''
  let currentFile = ''
  let currentTrack: Partial<CueTrack> | null = null
  const rawTracks: CueTrack[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('PERFORMER ')) {
      const value = trimmed.slice(10).replace(/^"/, '').replace(/"$/, '')
      if (currentTrack) {
        currentTrack.performer = value
      } else {
        globalPerformer = value
      }
    } else if (trimmed.startsWith('TITLE ')) {
      const value = trimmed.slice(6).replace(/^"/, '').replace(/"$/, '')
      if (currentTrack) {
        currentTrack.title = value
      } else {
        globalTitle = value
      }
    } else if (trimmed.startsWith('FILE ')) {
      const match = trimmed.match(/^FILE "(.+)"/)
      if (match) currentFile = match[1]
    } else if (trimmed.startsWith('TRACK ')) {
      if (currentTrack) {
        rawTracks.push(currentTrack as CueTrack)
      }
      const no = parseInt(trimmed.slice(6, 8), 10)
      currentTrack = { no, performer: globalPerformer, title: '', startMs: 0, durationMs: 0 }
    } else if (trimmed.startsWith('INDEX 01 ')) {
      if (currentTrack) {
        currentTrack.startMs = cueTimeToMs(trimmed.slice(9))
      }
    }
  }
  if (currentTrack) rawTracks.push(currentTrack as CueTrack)

  // 推算每首时长
  for (let i = 0; i < rawTracks.length - 1; i++) {
    rawTracks[i].durationMs = rawTracks[i + 1].startMs - rawTracks[i].startMs
  }

  return {
    performer: globalPerformer,
    title: globalTitle,
    file: currentFile,
    tracks: rawTracks
  }
}

// Module-level setter for last track duration (called externally with FLAC total duration)
export function setLastTrackDuration(cue: CueFile, totalMs: number): void {
  const last = cue.tracks[cue.tracks.length - 1]
  if (last && last.durationMs === 0) {
    last.durationMs = totalMs - last.startMs
  }
}
