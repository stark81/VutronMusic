import { useOsdLyricStore } from '../store/osdLyric'
// import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

const mouseCheckTools = {
  x: 0,
  y: 0,
  preX: 0,
  preY: 0,
  timeout: null,
  handleCheck(setShow: () => void) {
    const xDiff = Math.abs(this.x - this.preX)
    const yDiff = Math.abs(this.y - this.preY)
    if (xDiff > 8) {
      if (this.x > this.preX) {
        if (this.x + xDiff * 1.25 > window.innerWidth - 16) {
          setShow()
          return
        }
      } else {
        if (this.x - xDiff * 1.25 < 8) {
          setShow()
          return
        }
      }
    }
    if (yDiff > 8) {
      if (this.y > this.preY) {
        if (this.y + yDiff * 1.25 > window.innerHeight - 16) {
          setShow()
        }
      } else {
        if (this.y - yDiff * 1.25 < 8) {
          setShow()
        }
      }
    }

    // setShow(false)
  },
  handleMove(x: number, y: number, setShow: () => void) {
    // console.log(x, y, this.x, this.y)
    this.preX = this.x
    this.preY = this.y
    this.x = x
    this.y = y
    this.startTimeout(setShow)
  },
  startTimeout(setShow: () => void) {
    this.stopTimeout()
    // @ts-ignore
    this.timeout = setTimeout(this.handleCheck.bind(this), 200, setShow)
  },
  stopTimeout() {
    if (!this.timeout) return
    clearTimeout(this.timeout)
    this.timeout = null
  }
}

export default () => {
  const settings = useOsdLyricStore()

  const isMouseEnter = ref(false)
  const isHoverHide = computed(() => settings.isLock && settings.isHoverHide)

  const handleMouseEnter = () => {
    if (!isHoverHide.value || isMouseEnter.value) return
    console.log('!!!!!!!!!!enter!!!!!!!!')
    isMouseEnter.value = true
  }

  const handleMouseLeave = () => {
    if (!isHoverHide.value) return
    console.log('==========leave===========')
    isMouseEnter.value = false
    mouseCheckTools.stopTimeout()
  }

  const handleMouseMoveMain = (event: MouseEvent) => {
    if (!isHoverHide.value) return
    handleMouseEnter()
    mouseCheckTools.handleMove(event.clientX, event.clientY, handleMouseLeave)
  }
  return { isMouseEnter, isHoverHide, handleMouseEnter, handleMouseLeave, handleMouseMoveMain }
}
