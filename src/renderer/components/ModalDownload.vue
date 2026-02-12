<template>
  <transition name="modal">
    <div v-if="show" class="modal-download">
      <div class="modal-overlay" @click="close"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h2>{{ $t('download.title') }}</h2>
          <button class="close-btn" @click="close">×</button>
        </div>

        <div class="modal-body">
          <div v-if="taskList.length === 0" class="empty-state">
            <div class="empty-icon">↓</div>
            <div class="empty-text">{{ $t('download.noTasks') }}</div>
          </div>

          <div v-else class="task-list">
            <div
              v-for="task in taskList"
              :key="task.taskId"
              class="task-item"
              :class="`task-${task.status}`"
            >
              <div class="task-info">
                <div class="task-name">{{ task.track.name }}</div>
                <div class="task-artist">
                  {{ (task.track.ar || task.track.artists)?.[0]?.name }}
                </div>
              </div>

              <div
                v-if="task.status === 'downloading' || task.status === 'pending'"
                class="task-progress"
              >
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
                </div>
                <div class="progress-text">{{ task.progress }}%</div>
              </div>

              <div v-else class="task-status">
                <span v-if="task.status === 'completed'" class="status-completed">
                  ✓ {{ $t('download.completed') }}
                </span>
                <span v-else-if="task.status === 'error'" class="status-error">
                  ✗ {{ task.error || $t('download.error') }}
                </span>
                <span v-else-if="task.status === 'cancelled'" class="status-cancelled">
                  ✗ {{ $t('download.cancelled') }}
                </span>
              </div>

              <div class="task-actions">
                <button
                  v-if="task.status === 'downloading' || task.status === 'pending'"
                  class="action-btn cancel-btn"
                  @click="cancelTask(task.taskId)"
                >
                  {{ $t('download.cancel') }}
                </button>
                <button
                  v-if="task.status === 'completed' && task.filePath"
                  class="action-btn open-btn"
                  @click="openFolder(task.filePath)"
                >
                  {{ $t('download.openFolder') }}
                </button>
                <button
                  v-if="
                    task.status === 'completed' ||
                    task.status === 'error' ||
                    task.status === 'cancelled'
                  "
                  class="action-btn remove-btn"
                  @click="removeTask(task.taskId)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button v-if="hasCompletedTasks" class="footer-btn" @click="clearCompleted">
            {{ $t('download.clearCompleted') }}
          </button>
          <button v-if="taskList.length > 0" class="footer-btn danger" @click="clearAll">
            {{ $t('download.clearAll') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDownloadStore } from '../store/download'
import type { DownloadTask } from '../store/download'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const downloadStore = useDownloadStore()
const {
  tasks,
  cancelDownload,
  clearCompletedTasks,
  clearAllTasks,
  removeTask,
  getTaskList,
  getCompletedTasks
} = downloadStore

const taskList = computed(() => getTaskList())

const hasCompletedTasks = computed(() => getCompletedTasks().length > 0)

const close = () => {
  emit('close')
}

const cancelTask = (taskId: string) => {
  cancelDownload(taskId)
}

const clearCompleted = () => {
  clearCompletedTasks()
}

const clearAll = () => {
  clearAllTasks()
}

const openFolder = async (filePath: string) => {
  if (filePath) {
    window.mainApi?.send('msgShowInFolder', filePath)
  }
}

onMounted(() => {
  downloadStore.initDownloadListener()
})
</script>

<style scoped lang="scss">
.modal-download {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-container {
  position: relative;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--color-body-bg);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-divider);

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 24px;
    cursor: pointer;
    border-radius: 8px;
    transition: 0.2s;

    &:hover {
      background: var(--color-secondary-bg);
    }
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.download-path-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
  margin-bottom: 16px;

  span {
    font-size: 14px;
    color: var(--color-text);
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 12px;
  }

  .change-btn {
    padding: 6px 12px;
    border: none;
    background: var(--color-primary);
    color: white;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text);
  opacity: 0.5;

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-text {
    font-size: 16px;
  }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
  transition: 0.2s;

  &:hover {
    background: var(--color-primary-bg-for-transparent);
  }
}

.task-info {
  flex: 1;
  min-width: 0;

  .task-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-artist {
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.6;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;

  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--color-divider);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.3s ease;
    }
  }

  .progress-text {
    font-size: 12px;
    color: var(--color-text);
    min-width: 40px;
    text-align: right;
  }
}

.task-status {
  min-width: 100px;
  font-size: 12px;

  .status-completed {
    color: #4caf50;
  }

  .status-error {
    color: #f44336;
  }

  .status-cancelled {
    color: var(--color-text);
    opacity: 0.5;
  }
}

.task-actions {
  display: flex;
  gap: 8px;
  align-items: center;

  .action-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: 0.2s;

    &.cancel-btn {
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;

      &:hover {
        background: rgba(244, 67, 54, 0.2);
      }
    }

    &.open-btn {
      background: var(--color-primary);
      color: white;

      &:hover {
        opacity: 0.9;
      }
    }

    &.remove-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--color-text);
      opacity: 0.5;
      font-size: 16px;

      &:hover {
        background: rgba(0, 0, 0, 0.1);
        opacity: 1;
      }
    }
  }
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-divider);
  justify-content: flex-end;

  .footer-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: 0.2s;
    background: var(--color-secondary-bg);
    color: var(--color-text);

    &:hover {
      background: var(--color-primary-bg-for-transparent);
    }

    &.danger {
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;

      &:hover {
        background: rgba(244, 67, 54, 0.2);
      }
    }
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;

  .modal-container {
    transition:
      transform 0.3s,
      opacity 0.3s;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-container {
    transform: scale(0.9);
    opacity: 0;
  }
}
</style>
