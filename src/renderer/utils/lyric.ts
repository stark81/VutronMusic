import { randomNum } from '.'

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
        const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

        /** @type {ParsedLyric} */
        const parsedLyric = { time, content: trimContent(content) }
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
      const time = Number(min) * 60 + Number(sec) + Number(ms ?? 0) * 0.001

      /** @type {ParsedLyric} */
      const parsedLyric = { time, content: trimContent(content) }
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
  return parsedLyrics
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

// export interface CharData {
//   char: string
//   start: number
//   end: number
// }

// export interface LineData {
//   lineStart: number
//   lineEnd: number
//   characters: CharData[]
// }

// export interface MetadataItem {
//   type: string
//   content: Array<{
//     text: string
//     link?: string
//     orpheus?: string
//   }>
// }

// export interface LyricsData {
//   metadata: MetadataItem[]
//   lines: LineData[]
// }

// export const parseLyrics = (lyricsText: string): LyricsData => {
//   const lines = lyricsText.split('\n').filter((line) => line.trim().length > 0)
//   const metadata: MetadataItem[] = []
//   const lyricsLines: LineData[] = []

//   // 解析元数据（如作词、作曲信息）
//   const metadataRegex = /^{.*"t":\d+,"c":\[(.*)\]}$/
//   // 解析逐字时间信息的正则表达式
//   const lineStartRegex = /^\[(\d+),(\d+)\]/
//   const characterRegex = /\((\d+),(\d+),\d+\)([^(]+)/g

//   for (const line of lines) {
//     // 检查是否是元数据行
//     const metadataMatch = line.match(metadataRegex)
//     if (metadataMatch) {
//       try {
//         const jsonContent = JSON.parse(`{"c":[${metadataMatch[1]}]}`)
//         if (jsonContent.c.length > 0) {
//           const type = jsonContent.c[0].tx.replace(/: $/, '')
//           metadata.push({
//             type,
//             content: jsonContent.c.map((item) => ({
//               text: item.tx,
//               link: item.li,
//               orpheus: item.or
//             }))
//           })
//         }
//       } catch (e) {
//         console.error('Failed to parse metadata:', e)
//       }
//       continue
//     }

//     // 解析歌词行
//     const lineStartMatch = line.match(lineStartRegex)
//     if (lineStartMatch) {
//       const lineStart = parseInt(lineStartMatch[1])
//       const lineDuration = parseInt(lineStartMatch[2])
//       const lineEnd = lineStart + lineDuration

//       const characters: CharData[] = []
//       let charMatch

//       // 重置lastIndex以确保从头开始匹配
//       characterRegex.lastIndex = 0

//       while ((charMatch = characterRegex.exec(line)) !== null) {
//         const charStart = parseInt(charMatch[1])
//         const charDuration = parseInt(charMatch[2])
//         const charText = charMatch[3]

//         for (let i = 0; i < charText.length; i++) {
//           const char = charText[i]
//           // 跳过空格
//           if (char === ' ') continue

//           // 计算每个字符的时间
//           // 假设每个字符均分持续时间
//           const charLength = charText.trim().length
//           const singleCharDuration = charDuration / charLength
//           const start = charStart + i * singleCharDuration
//           const end = start + singleCharDuration

//           characters.push({
//             char,
//             start,
//             end
//           })
//         }
//       }

//       // 如果成功解析到字符
//       if (characters.length > 0) {
//         lyricsLines.push({
//           lineStart,
//           lineEnd,
//           characters
//         })
//       }
//     }
//   }

//   return {
//     metadata,
//     lines: lyricsLines
//   }
// }
