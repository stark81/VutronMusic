export const lyricParse = (lrc: any) => {
  return {
    lyric:
      typeof lrc.lrc?.lyric === 'string'
        ? parseLyricString(lrc.lrc?.lyric)
        : parseLyricArray(lrc.lrc?.lyric),
    tlyric:
      typeof lrc.tlyric?.lyric === 'string'
        ? parseLyricString(lrc.tlyric?.lyric)
        : parseLyricArray(lrc.tlyric?.lyric),
    rlyric:
      typeof lrc.romalrc?.lyric === 'string'
        ? parseLyricString(lrc.romalrc?.lyric)
        : parseLyricArray(lrc.romalrc?.lyric)
  }
}

const trimContent = (content) => {
  const t = content.trim()
  return t.length < 1 ? content : t
}

const parseLyricArray = (lyric: string[]) => {
  if (!lyric || !lyric.length) return []
  const parsedLyrics: any[] = []
  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const binarySearch = (lyric) => {
    const time = lyric.time

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].time
      if (midTime === time) {
        return mid
      } else if (midTime < time) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return low
  }

  for (const line of lyric) {
    const matches = line.matchAll(extractLrcRegex)
    for (const match of matches) {
      if (!match) continue
      // @ts-ignore
      const { content, lyricTimestamps } = match.groups
      for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
        const { min, sec, ms } = timestamp.groups
        const formattedMs = ms ? ms.padEnd(3, '0') : '000' // 格式化为三位数
        const rawTime = `[${min}:${sec}.${formattedMs}]`
        const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

        /** @type {ParsedLyric} */
        const parsedLyric = { rawTime, time, content: trimContent(content) }
        parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
      }
    }
  }

  return parsedLyrics
}

const parseLyricString = (lyric: string) => {
  const parsedLyrics: any[] = []
  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const binarySearch = (lyric) => {
    const time = lyric.time

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].time
      if (midTime === time) {
        return mid
      } else if (midTime < time) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return low
  }

  for (const line of lyric.trim().matchAll(extractLrcRegex)) {
    // @ts-ignore
    const { lyricTimestamps, content } = line.groups
    for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
      const { min, sec, ms } = timestamp.groups
      const formattedMs = ms ? ms.padEnd(3, '0') : '000' // 格式化为三位数
      const rawTime = `[${min}:${sec}.${formattedMs}]`
      const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

      /** @type {ParsedLyric} */
      const parsedLyric = { rawTime, time, content: trimContent(content) }
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
    }
  }
  return parsedLyrics
}
