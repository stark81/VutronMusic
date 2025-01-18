export const lyricParse = (lrc: any) => {
  return {
    lyric: lrc.yrc?.lyric?.length ? parseyrc(lrc.yrc.lyric) : parseLyric(lrc.lrc?.lyric),
    tlyric: lrc.ytlrc?.lyric.length ? parseLyric(lrc.ytlrc?.lyric) : parseLyric(lrc.tlyric?.lyric),
    rlyric: lrc.yromalrc?.lyric.length
      ? parseLyric(lrc.yromalrc?.lyric)
      : parseLyric(lrc.romalrc?.lyric)
  }
}

const trimContent = (content: string) => {
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

const parseLyric = (lrc: string | string[]) => {
  if (typeof lrc === 'string') {
    return parseLyricString(lrc)
  } else {
    return parseLyricArray(lrc)
  }
}

const parseyrc = (lyric: string) => {
  if (!lyric.length) return []

  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\((\d+),(\d+),/g // 修改后的正则表达式
  const timestampRegex = /\[(\d+),(\d+)\]/g
  const parsedLyrics: any[] = []

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

  lyric = lyric.toString()
  for (const line of lyric.trim().matchAll(extractLrcRegex)) {
    // @ts-ignore
    const { lyricTimestamps, content } = line.groups

    const startTime = lyricTimestamps.match(timestampRegex)
    const times = startTime
      ? startTime.flatMap((match) => {
          const [, num1, num2] = match.match(/\[(\d+),(\d+)\]/) || []
          return [Number(num1) / 1000, Number(num2) / 1000]
        })
      : []
    if (times.length === 0) break

    // 提取歌词内容中的时间戳
    const matched = content.matchAll(extractTimestampRegex)
    const numbers = matched
      ? Array.from(matched).map((match: any) => [Number(match[1]), Number(match[2])])
      : []

    // 提取歌词内容中的文字，保留空格与相邻字符
    const contentList = content
      .split(/(\(\d+,\d+,0\))/g) // 按时间戳分割
      .filter((part) => !part.startsWith('(')) // 去掉时间戳部分
      // .map((part) => part) // 去掉多余的空格
      .filter((part) => part.length > 0) // 去掉空字符串

    const parsedLyric = {
      time: times[0],
      end: times[0] + times[1],
      contentTimes: numbers, // 时间戳列表
      contentArray: contentList, // 歌词文字内容（保留空格与相邻字符）
      content: contentList.join('')
    }
    parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
  }

  return parsedLyrics
}
