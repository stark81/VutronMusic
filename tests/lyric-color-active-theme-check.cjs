const fs = require('fs')

const lyric = fs.readFileSync('src/renderer/components/LyricPage.vue', 'utf8')
const modal = fs.readFileSync('src/renderer/components/ModalPlayerFont.vue', 'utf8')
const creative = fs.readFileSync('src/renderer/components/CreativePlayer.vue', 'utf8')

if (!lyric.includes('const { activeTheme } = storeToRefs(playerThemeStore)')) {
  throw new Error('LyricPage must read activeTheme from playerThemeStore')
}

if (!lyric.includes('activeTheme.value.theme') || !lyric.includes('theme.senses.Classic')) {
  throw new Error('LyricPage must use the active theme Classic lyric settings')
}

if (lyric.includes('themes.value.Classic[0].theme')) {
  throw new Error('LyricPage still reads the built-in Classic theme instead of active theme')
}

if (!modal.includes('activeTheme.value.theme.senses.Classic.lyric.playedColor = value')) {
  throw new Error('ModalPlayerFont must save playedColor to the main lyric settings')
}

if (!creative.includes('const playedColor = computed(() =>')) {
  throw new Error('CreativePlayer must read playedColor for picked lyrics')
}

if (!creative.includes('color: v-bind(playedColor);')) {
  throw new Error('CreativePlayer picked lyrics must use playedColor')
}
