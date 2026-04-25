<template>
  <BaseModal
    class="modal-confirm"
    :show="confirmDialog.show"
    :title="confirmDialog.title"
    :close-fn="cancelAction"
    width="calc(min(24rem, 90vw))"
    show-footer
  >
    <template #default>
      <div class="body">{{ confirmDialog.text }}</div>
    </template>
    <template #footer>
      <button class="primary block" @click="confirmAction">确定</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNormalStateStore } from '../store/state'
import BaseModal from './BaseModal.vue'

const stateStore = useNormalStateStore()
const { confirmDialog } = storeToRefs(stateStore)
const { confirmAction, cancelAction } = stateStore
</script>

<style lang="scss" scoped>
.modal-confirm {
  .body {
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
  }
}

.footer {
  padding-top: 16px;
  margin: 16px 24px 24px 24px;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  display: flex;
  justify-content: flex-start;
  margin-bottom: -8px;
  button {
    color: var(--color-text);
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    padding: 6px 16px;
    font-size: 14px;
    margin-left: 12px;
    transition: 0.2s;
    &:active {
      transform: scale(0.94);
    }
  }
  button.primary {
    color: white;
    background: var(--color-primary);
    font-weight: 500;
  }
  button.block {
    width: 100%;
    margin-left: 0;
    &:active {
      transform: scale(0.98);
    }
  }
}
</style>
