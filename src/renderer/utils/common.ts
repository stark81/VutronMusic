export const splitSoundtrackAlbumTitle = (title: string) => {
  const keywords = [
    'Music from the Original Motion Picture Score',
    'The Original Motion Picture Soundtrack',
    'Original MGM Motion Picture Soundtrack',
    'Complete Original Motion Picture Score',
    'Original Music From The Motion Picture',
    'Music From The Disney+ Original Movie',
    'Original Music From The Netflix Film',
    'Original Score to the Motion Picture',
    'Original Motion Picture Soundtrack',
    'Soundtrack from the Motion Picture',
    'Original Television Soundtrack',
    'Original Motion Picture Score',
    'Music From the Motion Picture',
    'Music From The Motion Picture',
    'Complete Motion Picture Score',
    'Music from the Motion Picture',
    'Original Videogame Soundtrack',
    'La Bande Originale du Film',
    'Music from the Miniseries',
    'Bande Originale du Film',
    'Die Original Filmmusik',
    'Original Soundtrack',
    'Complete Score',
    'Original Score'
  ]
  for (const keyword of keywords) {
    if (title.includes(keyword) === false) continue
    return {
      title: title
        .replace(`(${keyword})`, '')
        .replace(`: ${keyword}`, '')
        .replace(`[${keyword}]`, '')
        .replace(`- ${keyword}`, '')
        .replace(`${keyword}`, ''),
      subtitle: keyword
    }
  }
  return { title, subtitle: '' }
}

export const splitAlbumTitle = (title: string) => {
  const keywords = [
    'Bonus Tracks Edition',
    'Complete Edition',
    'Deluxe Edition',
    'Deluxe Version',
    'Tour Edition'
  ]
  for (const keyword of keywords) {
    if (title.includes(keyword) === false) continue
    return {
      title: title
        .replace(`(${keyword})`, '')
        .replace(`: ${keyword}`, '')
        .replace(`[${keyword}]`, '')
        .replace(`- ${keyword}`, '')
        .replace(`${keyword}`, ''),
      subtitle: keyword
    }
  }
  return { title, subtitle: '' }
}

export const playlistCategories = [
  {
    name: '全部',
    enable: true,
    bigCat: 'static'
  },
  {
    name: '推荐歌单',
    enable: true,
    bigCat: 'static'
  },
  {
    name: '精品歌单',
    enable: true,
    bigCat: 'static'
  },
  {
    name: '官方',
    enable: true,
    bigCat: 'static'
  },
  {
    name: '华语',
    enable: false,
    bigCat: '语种'
  },
  {
    name: '欧美',
    enable: true,
    bigCat: '语种'
  },
  {
    name: '日语',
    enable: false,
    bigCat: '语种'
  },
  {
    name: '韩语',
    enable: false,
    bigCat: '语种'
  },
  {
    name: '粤语',
    enable: false,
    bigCat: '语种'
  },
  {
    name: '流行',
    enable: true,
    bigCat: '风格'
  },
  {
    name: '摇滚',
    enable: true,
    bigCat: '风格'
  },
  {
    name: '民谣',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '电子',
    enable: true,
    bigCat: '风格'
  },
  {
    name: '舞曲',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '说唱',
    enable: true,
    bigCat: '风格'
  },
  {
    name: '轻音乐',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '爵士',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '乡村',
    enable: false,
    bigCat: '风格'
  },
  {
    name: 'R&B/Soul',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '古典',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '民族',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '英伦',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '金属',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '朋克',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '蓝调',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '雷鬼',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '世界音乐',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '拉丁',
    enable: false,
    bigCat: '风格'
  },
  {
    name: 'New Age',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '古风',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '后摇',
    enable: false,
    bigCat: '风格'
  },
  {
    name: 'Bossa Nova',
    enable: false,
    bigCat: '风格'
  },
  {
    name: '清晨',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '夜晚',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '学习',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '工作',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '午休',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '下午茶',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '地铁',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '驾车',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '运动',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '旅行',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '散步',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '酒吧',
    enable: false,
    bigCat: '场景'
  },
  {
    name: '怀旧',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '清新',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '浪漫',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '伤感',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '治愈',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '放松',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '孤独',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '感动',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '兴奋',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '快乐',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '安静',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '思念',
    enable: false,
    bigCat: '情感'
  },
  {
    name: '综艺',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '影视原声',
    enable: false,
    bigCat: '主题'
  },
  {
    name: 'ACG',
    enable: true,
    bigCat: '主题'
  },
  {
    name: '儿童',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '校园',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '游戏',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '70后',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '80后',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '90后',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '网络歌曲',
    enable: false,
    bigCat: '主题'
  },
  {
    name: 'KTV',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '经典',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '翻唱',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '吉他',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '钢琴',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '器乐',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '榜单',
    enable: false,
    bigCat: '主题'
  },
  {
    name: '00后',
    enable: false,
    bigCat: '主题'
  }
]

export const artistCategories = [
  {
    name: '全部',
    code: -1,
    enable: true,
    bigCat: '语种'
  },
  {
    name: '华语',
    code: 7,
    enable: false,
    bigCat: '语种'
  },
  {
    name: '欧美',
    code: 96,
    enable: false,
    bigCat: '语种'
  },
  {
    name: '日本',
    code: 8,
    enable: false,
    bigCat: '语种'
  },
  {
    name: '韩国',
    code: 16,
    enable: false,
    bigCat: '语种'
  },
  {
    name: '其他',
    code: 0,
    enable: false,
    bigCat: '语种'
  },
  {
    name: '全部',
    code: -1,
    enable: true,
    bigCat: '分类'
  },
  {
    name: '男歌手',
    code: 1,
    enable: false,
    bigCat: '分类'
  },
  {
    name: '女歌手',
    code: 2,
    enable: false,
    bigCat: '分类'
  },
  {
    name: '乐队组合',
    code: 3,
    enable: false,
    bigCat: '分类'
  },
  {
    name: '热门',
    code: -1,
    enable: true,
    bigCat: '筛选'
  },
  {
    name: '#',
    code: 0,
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'A',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'B',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'C',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'D',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'E',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'F',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'G',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'H',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'I',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'J',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'K',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'L',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'M',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'N',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'O',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'P',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'Q',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'R',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'S',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'T',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'U',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'V',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'W',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'X',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'Y',
    enable: false,
    bigCat: '筛选'
  },
  {
    name: 'Z',
    enable: false,
    bigCat: '筛选'
  }
]
