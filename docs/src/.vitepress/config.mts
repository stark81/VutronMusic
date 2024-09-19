import { generateSidebar } from 'vitepress-sidebar'
import { name, description, repository } from '../../../package.json'
import { defineConfig } from 'vitepress'

const capitalizeFirst = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

export default defineConfig({
  title: capitalizeFirst(name),
  description,
  outDir: '../dist',
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['link', { rel: 'shortcut icon', href: '/favicon.ico' }]
  ],
  cleanUrls: true,
  themeConfig: {
    logo: { src: '/icon.png', width: 24, height: 24 },
    search: {
      provider: 'local'
    },
    sidebar: generateSidebar({
      documentRootPath: 'src',
      collapsed: false,
      useTitleFromFileHeading: true,
      useTitleFromFrontmatter: true,
      sortMenusByFrontmatterOrder: true,
      hyphenToSpace: true,
      capitalizeEachWords: true,
      manualSortFileNameByPriority: [
        'installation-and-build',
        'project-structures',
        'electron-how-to'
      ]
    }),
    socialLinks: [{ icon: 'github', link: repository.url.replace('.git', '') }]
  }
})
