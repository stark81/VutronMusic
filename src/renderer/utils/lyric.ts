import { randomNum } from '.'

export const lyricParse = (lrc: any) => {
  return {
    lyric:
      parsewBywLrc(lrc?.lrc?.lyric) ?? parseyrc(lrc.yrc?.lyric) ?? parseLyric(lrc.lrc?.lyric) ?? [],
    tlyric: parseLyric(lrc.ytlrc?.lyric) ?? parseLyric(lrc.tlyric?.lyric) ?? [],
    rlyric: parseLyric(lrc.yromalrc?.lyric) ?? parseLyric(lrc.romalrc?.lyric) ?? []
  }
}

const trimContent = (content: string) => {
  const t = content.trim()
  return t.length < 1 ? content : t
}

const parseLyric = (lyric: string | string[]) => {
  if (!lyric || !lyric.length) return
  lyric = typeof lyric === 'string' ? lyric : lyric?.join('\n')

  const parsedLyrics: any[] = []
  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const binarySearch = (lyric) => {
    const time = lyric.start

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].start
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
    const cInfo = content.replace(/\[(\d+):(\d+)(?:\.|:)*(\d+)]/g, '')
    for (const timestamp of lyricTimestamps.matchAll(extractTimestampRegex)) {
      const { min, sec, ms } = timestamp.groups
      const start = Number(min) * 60 + Number(sec) + Number(ms?.padEnd(3, '0') ?? 0) * 0.001
      const parsedLyric = { start, content: trimContent(cInfo) }
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
    }
  }
  return parsedLyrics
}

const parseyrc = (lyric: string) => {
  if (!lyric || !lyric.length) return

  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\((\d+),(\d+),\d+\)([^(]+)/g
  const timestampRegex = /\[(\d+),(\d+)\]/g
  const parsedLyrics: any[] = []

  const binarySearch = (lyric) => {
    const time = lyric.start

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].start
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
    const lineInfo = [...matched].map((match) => {
      const [, start, duration, word] = match
      return { start: parseInt(start), end: parseInt(start) + parseInt(duration), word }
    })

    const parsedLyric = {
      start: times[0],
      end: times[0] + times[1],
      contentInfo: lineInfo,
      content: lineInfo.map((item) => item.word).join('')
    }
    parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
  }
  return parsedLyrics.length ? parsedLyrics : null
}

const parsewBywLrc = (lyric: string[]) => {
  if (!lyric || typeof lyric === 'string') return
  const regex = /(\[\d{2}:\d{2}\.\d{2,3}\])([^[]*?)(?=(\[\d{2}:\d{2}\.\d{2,3}\]))/g
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const parsedLyrics = [] as any[]
  const binarySearch = (lyric: any) => {
    const time = lyric.start

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].start
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

  const switchTime = (str: string, regex: RegExp) => {
    const match = str.matchAll(regex)
    const [, min, sec, ms] = [...match].flat()
    return Math.round(
      (Number(min) * 60 + Number(sec) + Number(ms?.padEnd(3, '0') ?? 0) * 0.001) * 1000
    )
  }

  for (const line of lyric) {
    const words = line.trim().matchAll(regex)
    const ws = [...words]
    if (!ws.length) return
    const contentInfo = ws.map((word) => {
      const start = switchTime(word[1], extractTimestampRegex)
      const end = switchTime(word[3], extractTimestampRegex)
      return { start, end, word: word[2] }
    })
    const start = contentInfo[0].start / 1000
    const end = contentInfo.at(-1)!.end / 1000
    const content = contentInfo.map((item) => item.word).join('')

    const parsedLyric = { start, end, content, contentInfo }

    parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
  }
  return parsedLyrics.length ? parsedLyrics : null
}

export const pickedLyric = (lyric: any[], number = 3) => {
  if (!lyric.length) return []

  const filterWords =
    /(作词|作曲|编曲|和声|混音|录音|词：|曲：|统筹：|OP|SP|MV|吉他|二胡|古筝|曲编|键盘|贝斯|鼓|弦乐|打击乐|混音|制作人|配唱|提琴|海报|特别鸣谢)/i
  const lyricLines = lyric.filter((l) => !filterWords.test(l.content)).map((l) => l.content)

  const lyricsToPick = Math.min(lyricLines.length, number)
  const randomUpperBound = lyricLines.length - lyricsToPick

  const startLyricLineIndex = randomNum(0, randomUpperBound - 1)

  return lyricLines.slice(startLyricLineIndex, startLyricLineIndex + lyricsToPick)
}
