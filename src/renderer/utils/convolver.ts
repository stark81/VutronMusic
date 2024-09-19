export const convolutions = [
  { name: 's3_r1_bd', mainGain: 1.8, sendGain: 0.8, source: 's3_r1_bd.wav' },
  {
    name: 'telephone',
    mainGain: 0.0,
    sendGain: 3.0,
    source: 'filter-telephone.wav'
  }, // 电话
  { name: 's2_r4_bd', mainGain: 1.8, sendGain: 0.9, source: 's2_r4_bd.wav' }, // 教堂
  {
    name: 'bright_hall',
    mainGain: 0.8,
    sendGain: 2.4,
    source: 'bright-hall.wav'
  },
  {
    name: 'cinema_diningroom',
    mainGain: 0.6,
    sendGain: 2.3,
    source: 'cinema-diningroom.wav'
  },
  {
    name: 'dining_living_true_stereo',
    mainGain: 0.6,
    sendGain: 1.8,
    source: 'dining-living-true-stereo.wav'
  },
  {
    name: 'living_bedroom_leveled',
    mainGain: 0.6,
    sendGain: 2.1,
    source: 'living-bedroom-leveled.wav'
  },
  {
    name: 'spreader50_65ms',
    mainGain: 1,
    sendGain: 2.5,
    source: 'spreader50-65ms.wav'
  },
  {
    name: 'matrix_1',
    mainGain: 1.5,
    sendGain: 0.9,
    source: 'matrix-reverb1.wav'
  },
  {
    name: 'matrix_2',
    mainGain: 1.3,
    sendGain: 1,
    source: 'matrix-reverb2.wav'
  },
  {
    name: 'cardiod_35_10_spread',
    mainGain: 1.8,
    sendGain: 0.6,
    source: 'cardiod-35-10-spread.wav'
  },
  {
    name: 'tim_omni_35_10_magnetic',
    mainGain: 1,
    sendGain: 0.2,
    source: 'tim-omni-35-10-magnetic.wav'
  },
  {
    name: 'feedback_spring',
    mainGain: 1.8,
    sendGain: 0.8,
    source: 'feedback-spring.wav'
  }
]

export const freqsPreset = [
  {
    name: 'pop',
    31: 6,
    62: 5,
    125: -3,
    250: -2,
    500: 5,
    1000: 4,
    2000: -4,
    4000: -3,
    8000: 6,
    16000: 4
  },
  {
    name: 'dance',
    31: 4,
    62: 3,
    125: -4,
    250: -6,
    500: 0,
    1000: 0,
    2000: 3,
    4000: 4,
    8000: 4,
    16000: 5
  },
  {
    name: 'rock',
    31: 7,
    62: 6,
    125: 2,
    250: 1,
    500: -3,
    1000: -4,
    2000: 2,
    4000: 1,
    8000: 4,
    16000: 5
  },
  {
    name: 'classical',
    31: 6,
    62: 7,
    125: 1,
    250: 2,
    500: -1,
    1000: 1,
    2000: -4,
    4000: -6,
    8000: -7,
    16000: -8
  },
  {
    name: 'vocal',
    31: -5,
    62: -6,
    125: -4,
    250: -3,
    500: 3,
    1000: 4,
    2000: 5,
    4000: 4,
    8000: -3,
    16000: -3
  },
  {
    name: 'slow',
    31: 5,
    62: 4,
    125: 2,
    250: 0,
    500: -2,
    1000: 0,
    2000: 3,
    4000: 6,
    8000: 7,
    16000: 8
  },
  {
    name: 'electronic',
    31: 6,
    62: 5,
    125: 0,
    250: -5,
    500: -4,
    1000: 0,
    2000: 6,
    4000: 8,
    8000: 8,
    16000: 7
  },
  {
    name: 'subwoofer',
    31: 8,
    62: 7,
    125: 5,
    250: 4,
    500: 0,
    1000: 0,
    2000: 0,
    4000: 0,
    8000: 0,
    16000: 0
  },
  {
    name: 'soft',
    31: -5,
    62: -5,
    125: -4,
    250: -4,
    500: 3,
    1000: 2,
    2000: 4,
    4000: 4,
    8000: 0,
    16000: 0
  }
]
export const freqsKeyList = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
