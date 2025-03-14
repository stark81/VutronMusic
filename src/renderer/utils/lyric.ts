import { randomNum } from '.'

export const lyricParse = (lrc: Record<string, any>) => {
  const lyric = parseyrc(lrc.yrc?.lyric) ?? parseLyricString(lrc.lrc?.lyric)
  const tlyric = parseLyricString(lrc.ytlrc?.lyric) ?? parseLyricString(lrc.tlyric?.lyric)
  const rlyric = parseLyricString(lrc.yromalrc?.lyric) ?? parseLyricString(lrc.romalrc?.lyric)

  return (
    lyric?.map((line) => {
      const translate = tlyric?.find((t) => t.startTime === line.startTime)
      const tw = translate ? translate.words[0].word : ''
      const romanize = rlyric?.find((r) => r.startTime === line.startTime)
      const rw = romanize ? romanize.words[0].word : ''
      return { ...line, translatedLyric: tw, romanLyric: rw }
    }) || []
  )
}

const trimContent = (content: string) => {
  const t = content.trim()
  return t.length < 1 ? content : t
}

const parseLyricString = (lyric: string) => {
  if (!lyric || !lyric.trim()) return
  const parsedLyrics: any[] = []
  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\[(?<min>\d+):(?<sec>\d+)(?:\.|:)*(?<ms>\d+)*\]/g

  const binarySearch = (lyric) => {
    const time = lyric.startTime

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].startTime
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
      const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

      /** @type {ParsedLyric} */
      const parsedLyric = {
        startTime: time * 1000,
        words: [
          {
            startTime: time * 1000,
            endTime: time * 1000,
            word: trimContent(content),
            obscene: false
          }
        ]
      }
      parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
    }
  }
  const result = parsedLyrics.map((l, index) => {
    const nextLine = parsedLyrics[index + 1]
    if (nextLine) {
      l.endTime = nextLine.startTime
    } else {
      l.endTime = l.startTime + 10 * 1000
    }
    return l
  })
  return result
}

const parseyrc = (lyric: string) => {
  if (!lyric || !lyric.trim()) return

  const extractLrcRegex = /^(?<lyricTimestamps>(?:\[.+?\])+)(?!\[)(?<content>.+)$/gm
  const extractTimestampRegex = /\((\d+),(\d+),\d+\)([^(]+)/g
  const timestampRegex = /\[(\d+),(\d+)\]/g
  const parsedLyrics: any[] = []

  const binarySearch = (lyric) => {
    const time = lyric.startTime

    let low = 0
    let high = parsedLyrics.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midTime = parsedLyrics[mid].startTime
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
          return [Number(num1), Number(num2)]
        })
      : []
    if (times.length === 0) break

    // 提取歌词内容中的时间戳
    const matched = content.matchAll(extractTimestampRegex)
    const lineInfo = [...matched].map((match) => {
      const [, start, duration, word] = match
      return {
        startTime: parseInt(start),
        endTime: parseInt(start) + parseInt(duration),
        word,
        obscene: false
      }
    })

    const parsedLyric = {
      startTime: times[0],
      endTime: times[0] + times[1],
      words: lineInfo
    }
    parsedLyrics.splice(binarySearch(parsedLyric), 0, parsedLyric)
  }
  return parsedLyrics
}

export const pickedLyric = (lyric: any[], number = 3) => {
  if (!lyric.length) return []

  const filterWords =
    /(作词|作曲|编曲|和声|混音|录音|词：|曲：|统筹：|OP|SP|MV|吉他|二胡|古筝|曲编|键盘|贝斯|鼓|弦乐|打击乐|混音|制作人|配唱|提琴|海报|特别鸣谢)/i
  const lyricLines = lyric
    .filter((l) => !filterWords.test(l.words.map((w) => w.word).join('')))
    .map((l) => l.words.map((w) => w.word).join(''))

  const lyricsToPick = Math.min(lyricLines.length, number)
  const randomUpperBound = lyricLines.length - lyricsToPick

  const startLyricLineIndex = randomNum(0, randomUpperBound - 1)

  return lyricLines.slice(startLyricLineIndex, startLyricLineIndex + lyricsToPick)
}
