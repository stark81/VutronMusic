import axios from 'axios'
import type { Album, TongrenluResponse } from '@/types/music'

const BASE_URL = 'http://121.37.183.44/tongrenlu/api/music/search'

export const searchAlbums = async (
  keyword: string = '',
  pageNumber: number = 1,
  pageSize: number = 15
): Promise<{
  code: number
  data: Album[]
  total: number
  current: number
  pages: number
}> => {
  try {
    const url = `${BASE_URL}?keyword=${encodeURIComponent(keyword)}&pageNumber=${pageNumber}&pageSize=${pageSize}`
    const response = await axios.get<TongrenluResponse>(url)

    return {
      code: 200,
      data: response.data.records.map((item) => ({
        id: item.cloudMusicId,
        name: item.cloudMusicName,
        picUrl: item.cloudMusicPicUrl,
        matched: false
      })),
      total: response.data.total,
      current: response.data.current,
      pages: response.data.pages
    }
  } catch (error) {
    console.error('Tongrenlu API error:', error)
    return {
      code: 500,
      data: [],
      total: 0,
      current: pageNumber,
      pages: 0
    }
  }
}
