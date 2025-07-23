<template>
  <BaseModal
    :show="setConvolverModal"
    :title="$t('player.converlution.title')"
    :show-footer="false"
    :close-fn="closeFn"
  >
    <template #default>
      <div>
        <div class="convolution">
          <CheckBox
            v-for="item in convolutions"
            :id="`convolution_${item.name}`"
            :key="item.name"
            :model-value="convolverParams.fileName"
            :value="item.source"
            :label="$t(`player.converlution.${item.name}`)"
            @update-input="updateConvolution(item.source, $event)"
          />
        </div>
        <div class="mainGain">
          <span style="min-width: 100px">{{ $t('player.converlution.mainGain') }}</span>
          <div class="slider">
            <VueSlider
              v-model="convolverParams.mainGain"
              :min="0.0"
              :max="5.0"
              :interval="0.1"
              :use-keyboard="false"
              :drag-on-click="false"
              :process-style="{ background: 'var(--color-primary)' }"
              :disabled="convolverParams.fileName === ''"
              :duration="0.1"
              tooltip="none"
              :dot-size="12"
              :dot-style="{ display: 'none' }"
              :height="2"
              :silent="true"
            />
          </div>
          <span>{{ Math.round(convolverParams.mainGain * 100) }}%</span>
        </div>
        <div class="mainGain">
          <span style="min-width: 100px">{{ $t('player.converlution.sendGain') }}</span>
          <div class="slider">
            <VueSlider
              v-model="convolverParams.sendGain"
              :min="0.0"
              :max="5.0"
              :interval="0.1"
              :use-keyboard="false"
              :drag-on-click="false"
              :process-style="{ background: 'var(--color-primary)' }"
              :disabled="convolverParams.fileName === ''"
              :duration="0.1"
              tooltip="none"
              :dot-size="12"
              :dot-style="{ display: 'none' }"
              :height="2"
              :silent="true"
            />
          </div>
          <span>{{ Math.round(convolverParams.sendGain * 100) }}%</span>
        </div>
      </div>
      <div class="freqsContainer">
        <div class="title">
          <span style="font-weight: 600">{{ $t('player.frequad.title') }}</span>
          <span class="reset button" style="margin: 0" @click="resetFreqs">{{
            $t('player.frequad.reset')
          }}</span>
        </div>
        <div class="biquadContainer">
          <div v-for="(item, index) in freqsKeyList" :key="item" class="biquader">
            <span style="min-width: 40px">{{ freqLabels[index] }}</span>
            <div class="slider">
              <VueSlider
                v-model="biquadParams[item]"
                :min="-15"
                :max="15"
                :interval="1"
                :duration="1"
                :drag-on-click="false"
                :height="2"
                :silent="true"
                :process-style="{ background: 'var(--color-primary)' }"
                :dot-style="{ display: 'none' }"
                :dot-size="12"
                tooltip="none"
              />
            </div>
            <span v-text="`${biquadParams[item]}db`"></span>
          </div>
        </div>
        <div class="preset">
          <div
            v-for="item in freqsPreset"
            :key="item.name"
            class="button"
            :class="{ active: matchedFreqs(item) }"
            @click="setFreqs(item)"
            >{{ $t(`player.frequad.${item.name}`) }}</div
          >
          <div
            v-for="(item, index) in biquadUser"
            :key="index"
            class="button"
            :class="{ active: matchedFreqs(Object.entries(item)[0][1]) }"
            @click="setFreqs(Object.entries(item)[0][1])"
            @click.right="removeFreqs(item)"
            >{{ Object.entries(item)[0][0] }}</div
          >
          <div v-show="!showInput" class="button" @click="addBiquad">+</div>
          <div v-show="showInput" class="button">
            <input
              ref="inputRef"
              v-model="inputText"
              class="input"
              type="text"
              placeholder="新预设.."
              @blur="giveUpInput"
              @keyup.enter="handleInput"
            />
          </div>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from './BaseModal.vue'
import CheckBox from './CheckBox.vue'
import VueSlider from 'vue-3-slider-component'
import { useNormalStateStore } from '../store/state'
import { usePlayerStore } from '../store/player'
import { convolutions, freqsKeyList, freqsPreset } from '../utils/convolver'

const stateStore = useNormalStateStore()
const { setConvolverModal } = storeToRefs(stateStore)

const playerStore = usePlayerStore()
const { setConvolver } = playerStore
const { convolverParams, biquadParams, biquadUser } = storeToRefs(playerStore)

const showInput = ref(false)
const inputText = ref('')
const inputRef = ref<HTMLInputElement>()

const closeFn = () => {
  setConvolverModal.value = false
}

const freqLabels = freqsKeyList.map((item) => (item < 1000 ? `${item}` : `${item / 1000}k`))

const updateConvolution = (fileName: string, value: boolean) => {
  const target = convolutions.find((item) => item.source === fileName)!
  const empty = { name: '', source: '', mainGain: 1, sendGain: 0 }
  setConvolver(value ? target : empty)
}

const setFreqs = (data: any) => {
  for (const [key, value] of Object.entries(data)) {
    if (key === 'name') continue
    biquadParams.value[key] = value
  }
}

const addBiquad = () => {
  showInput.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const removeFreqs = (data: any) => {
  const name = Object.entries(data)[0][0]
  const index = biquadUser.value.findIndex((item) => item[name])
  biquadUser.value.splice(index, 1)
}

const handleInput = () => {
  const newBiquad = {}
  newBiquad[inputText.value] = { ...biquadParams.value }
  biquadUser.value.push(newBiquad)
  inputText.value = ''
  showInput.value = false
}

const giveUpInput = () => {
  inputText.value = ''
  showInput.value = false
}

const resetFreqs = () => {
  for (const key in biquadParams.value) {
    biquadParams.value[key] = 0
  }
}

const matchedFreqs = (data: any) => {
  let matched = true
  for (const [key, value] of Object.entries(biquadParams.value)) {
    if (data[key] !== value) {
      matched = false
      break
    }
  }
  return matched
}
</script>

<style lang="scss" scoped>
.mainGain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 16px 5px 0;
  .slider {
    width: 100%;
    padding: 0 10px;
    transition: all 0.3s ease;
  }
  span {
    font-size: 15px;
    opacity: 0.78;
    width: 30px;
  }
}

.button {
  display: inline-block;
  background: var(--color-secondary-bg-for-transparent);
  padding: 2px 10px;
  margin: 0 10px 10px 0;
  font-size: 13px;
  border-radius: 4px;
  &:hover {
    cursor: pointer;
  }
  .input {
    background: none !important;
    border: none !important;
    width: 60px;
    color: var(--color-text);
  }
}

.active {
  background: var(--color-primary);
  color: white;
}

.freqsContainer {
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  margin-top: 10px;
  padding-top: 14px;

  .title {
    font-size: 20px;
    margin-bottom: 4px;
  }
}

.biquadContainer {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 20px;

  .biquader {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .slider {
      width: 100%;
      padding: 0 10px;
      transition: all 0.3s ease;
    }
    span {
      font-size: 15px;
      opacity: 0.78;
      width: 30px;
      text-align: center;
    }

    &:nth-child(even) {
      padding-right: 4px;
    }
  }
}

.reset {
  float: right;
}

.preset {
  margin-top: 10px;
  // display: grid;
}
</style>
