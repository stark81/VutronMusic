import { generateSidebar } from 'vitepress-sidebar'
import { name, description, repository } from '../../../package.json'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const capitalizeFirst = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

export default withMermaid(
  defineConfig({
    title: capitalizeFirst(name),
    description,
    outDir: '../dist',
    head: [
      ['link', { rel: 'icon', href: '/icon.png' }],
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
        useFolderTitleFromIndexFile: true,
        useFolderLinkFromIndexFile: true,
        sortMenusByFrontmatterOrder: true,
        hyphenToSpace: true,
        capitalizeEachWords: true,
        manualSortFileNameByPriority: [
          'features',
          'product',
          'spec',
          'adr',
          'troubleshooting',
          'archive'
        ],
        excludeFiles: ['spec/index.md'],
        collapseDepth: 2
      }),
      socialLinks: [{ icon: 'github', link: repository.url.replace('.git', '') }]
    },
    mermaid: {
      theme: 'default'
    }
  })
)
