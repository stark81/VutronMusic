<script setup lang="tsx">
import { useI18n } from 'vue-i18n'
// import { useTheme } from 'vuetify'
import { openExternal, openFile } from '../utils'
// import { useCounterStore } from '../store/counter'
// import { storeToRefs } from 'pinia'
import { onMounted, ref, inject, onActivated } from 'vue'

const { locale, availableLocales } = useI18n()
// const { counterIncrease } = useCounterStore()
// const { counter } = storeToRefs(useCounterStore())
// const theme = useTheme()
const languages = ref(['en'])
const appVersion = ref('Unknown')
const selectedFile = ref('')
const isElectron = ref(false)

const restorePosition = inject('restorePosition') as () => void

onActivated(() => {
  restorePosition()
})

onMounted((): void => {
  languages.value = availableLocales

  // Get application version from package.json version string (Using IPC communication)
  getApplicationVersionFromMainProcess()
})

const getApplicationVersionFromMainProcess = (): void => {
  window.mainApi?.invoke('msgRequestGetVersion').then((result: string) => {
    appVersion.value = result
  })
}

isElectron.value = window.env?.isElectron || false

// const handleChangeTheme = (): void => {
//   theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
// }

const handleChangeLanguage = (val): void => {
  locale.value = val
}

const handleOpenDocument = async (): Promise<void> => {
  await openExternal('https://vutron.jooy2.com')
}

const handleOpenGitHub = async (): Promise<void> => {
  await openExternal('https://github.com/jooy2/vutron')
}

// const handleCountIncrease = (): void => {
//   counterIncrease(1)
// }

const handleOpenFile = async () => {
  const dialogResult = await openFile('text')
  if (!dialogResult.canceled) {
    selectedFile.value = dialogResult.filePaths[0]
  }
}
</script>

<template>
  <v-container>
    <v-row no-gutters align="center" class="text-center">
      <v-col cols="12" md="5">
        <img
          data-testid="main-logo"
          alt="logo"
          draggable="false"
          class="ma-auto h-auto w-75"
          src="/images/vutron-logo.webp"
        />
      </v-col>
      <v-col cols="12" md="7">
        <h2 class="my-4">{{ $t('desc.welcome-title') }}</h2>
        <p>{{ $t('desc.welcome-desc') }}</p>
        <p class="my-4">
          App Version: <strong>{{ appVersion }} - {{ isElectron ? 'electron' : 'web' }}</strong>
        </p>
        <p v-if="selectedFile">{{
          $t('desc.selected-file', {
            filePath: selectedFile
          })
        }}</p>
        <v-row class="my-4">
          <!-- <v-col>
            <v-btn icon color="primary" @click="handleChangeTheme">
              <v-icon icon="mdi-brightness-6" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('menu.change-theme') }}
              </v-tooltip>
            </v-btn>
          </v-col> -->
          <v-col>
            <!-- <v-badge data-testid="counter-badge" color="blue" :content="counter">
              <v-btn data-testid="btn-counter" icon color="primary" @click="handleCountIncrease">
                <v-icon icon="mdi-plus-circle" />
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('menu.increase-count') }}
                </v-tooltip>
              </v-btn>
            </v-badge> -->
          </v-col>
          <v-col>
            <v-btn icon color="primary" @click="handleOpenDocument">
              <v-icon icon="mdi-file-document" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('menu.documentation') }}
              </v-tooltip>
            </v-btn>
          </v-col>
          <v-col>
            <v-btn icon color="primary" @click="handleOpenGitHub">
              <v-icon icon="mdi-github" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('menu.github') }}
              </v-tooltip>
            </v-btn>
          </v-col>
          <v-col>
            <v-btn icon color="primary" @click="handleOpenFile">
              <v-icon icon="mdi-folder-open" />
              <v-tooltip activator="parent" location="bottom">
                {{ $t('menu.open-file') }}
              </v-tooltip>
            </v-btn>
          </v-col>
          <v-col cols="12">
            <v-select
              data-testid="select-language"
              :model-value="locale"
              density="compact"
              :label="$t('menu.change-language')"
              :items="languages"
              @update:model-value="handleChangeLanguage"
            >
              {{ $t('menu.change-language') }}
            </v-select>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <div v-for="n in 30" :key="n" style="height: 40px">{{ n }}</div>
  </v-container>
</template>
