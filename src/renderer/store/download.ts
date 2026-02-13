import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { Track } from '@/types/music'
import { useSettingsStore } from './settings'
import { debug } from 'electron-log'

export interface DownloadTask {
  taskId: string
  track: Track
  progress: number
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'cancelled'
  error?: string
  filePath?: string
}

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<Map<string, DownloadTask>>(new Map())
  const isDownloading = ref(false)

  const initDownloadListener = () => {
    window.mainApi?.on('download-progress-update', (_: any, data: any) => {
      const { type, taskId, progress, data: resultData, error } = data
      const task = tasks.value.get(taskId)

      if (!task) return

      switch (type) {
        case 'download-start':
          task.status = 'downloading'
          task.progress = 0
          isDownloading.value = true
          break
        case 'download-progress':
          task.progress = Math.round(progress)
          break
        case 'download-complete':
          task.status = 'completed'
          task.progress = 100
          task.filePath = resultData.filePath
          isDownloading.value = Array.from(tasks.value.values()).some(
            (t) => t.status === 'downloading'
          )
          break
        case 'download-error':
          task.status = 'error'
          task.error = error || '下载失败'
          isDownloading.value = Array.from(tasks.value.values()).some(
            (t) => t.status === 'downloading'
          )
          break
        case 'download-cancelled':
          task.status = 'cancelled'
          isDownloading.value = Array.from(tasks.value.values()).some(
            (t) => t.status === 'downloading'
          )
          break
      }
    })
  }

  const downloadTrack = async (
    track: Track,
    url: string,
    albumInfo?: { id: number; name: string; picUrl: string; artist?: { id: number; name: string } }
  ) => {
    const taskId = `${track.id}-${Date.now()}`
    const settingsStore = useSettingsStore()
    const downloadPath = settingsStore.localMusic.scanDir || settingsStore.autoCacheTrack.path

    const newTask: DownloadTask = {
      taskId,
      track,
      progress: 0,
      status: 'pending'
    }

    tasks.value.set(taskId, newTask)

    // 将 track 对象转换为普通 JavaScript 对象，避免克隆错误
    const plainTrack = JSON.parse(JSON.stringify(toRaw(track)))
    window.mainApi?.send('download-track', {
      track: plainTrack,
      url,
      taskId,
      downloadPath,
      albumInfo
    })

    return taskId
  }

  const cancelDownload = (taskId: string) => {
    const task = tasks.value.get(taskId)
    if (task && task.status !== 'completed' && task.status !== 'error') {
      window.mainApi?.send('cancel-download', taskId)
    }
  }

  const clearCompletedTasks = () => {
    for (const [taskId, task] of tasks.value.entries()) {
      if (task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') {
        tasks.value.delete(taskId)
      }
    }
  }

  const clearAllTasks = () => {
    tasks.value.clear()
    window.mainApi?.send('clear-download-queue')
    isDownloading.value = false
  }

  const removeTask = (taskId: string) => {
    tasks.value.delete(taskId)
    isDownloading.value = Array.from(tasks.value.values()).some((t) => t.status === 'downloading')
  }

  const getTaskList = () => {
    return Array.from(tasks.value.values())
  }

  const getCompletedTasks = () => {
    return Array.from(tasks.value.values()).filter((task) => task.status === 'completed')
  }

  const getDownloadingTasks = () => {
    return Array.from(tasks.value.values()).filter(
      (task) => task.status === 'downloading' || task.status === 'pending'
    )
  }

  return {
    tasks,
    isDownloading,
    initDownloadListener,
    downloadTrack,
    cancelDownload,
    clearCompletedTasks,
    clearAllTasks,
    removeTask,
    getTaskList,
    getCompletedTasks,
    getDownloadingTasks
  }
})
