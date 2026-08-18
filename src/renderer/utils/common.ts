import type { service } from '@/types/plugin'

export const getImagePath = (platform: string) => {
  return new URL(`../assets/images/${platform}.png`, import.meta.url).href
}

export const getPluginIcon = (plugin: service) => {
  if (plugin.icon?.startsWith('http')) return plugin.icon
  if (plugin.icon) return getImagePath(plugin.icon)
  return getImagePath('vutronmusic-white')
}

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
