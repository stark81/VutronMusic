import { randomNum } from '.'

export const lyricParse = (lrc: any) => {
  return {
    lyric:  parseyrc(lrc.yrc?.lyric) ?? parseyrc(lrc.lrc?.lyric) ??  parseLyric(lrc.lrc?.lyric),
    tlyric: parseLyric(lrc.ytlrc?.lyric) ?? parseLyric(lrc.tlyric?.lyric),
    rlyric:  parseLyric(lrc.yromalrc?.lyric) ?? parseLyric(lrc.romalrc?.lyric)
  }
}

const trimContent = (content: string) => {
  const t = content.trim()
  return t.length < 1 ? content : t
}

const parseLyric = (lyric: string | string[]) => {
  if (!lyric) return []
  lyric = typeof lyric === 'string' ? lyric : lyric?.join('\n')

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
      const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

      const parsedLyric = { time, content: trimContent(content) }
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
    const lineInfo = [...matched].map((match) => {
      const [, start, duration, word] = match
      return { start: parseInt(start), end: parseInt(start) + parseInt(duration), word }
    })

    const parsedLyric = {
      time: times[0],
      end: times[0] + times[1],
      contentInfo: lineInfo,
      content: lineInfo.map((item) => item.word).join('')
    }
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