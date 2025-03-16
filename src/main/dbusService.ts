/* eslint-disable no-unused-vars */

// 本文件为dbus服务端，主动向dbus发送歌词信息
// 第三方插件可监听本服务，获取歌词信息，实现tray歌词显示等功能

import { BrowserWindow } from 'electron'
import type { DBusClient } from '@httptoolkit/dbus-native'
import type { DBusNativeImport } from './dbus'

export interface DBusImpl {}

export enum signalNameEnum {
  currentLrc = 'CurrentLrc',
  updateLikeStatus = 'UpdateLikeStatus'
}

export interface interFace {
  LikeThisTrack: () => void
  emit: (signalName: signalNameEnum, ...args: any) => void
}

const serviceName = 'org.vutronmusic.Lyric'
const objectPath = `/${serviceName.replace(/\./g, '/')}`

class DBus implements DBusImpl {
  private dbus: DBusNativeImport = require('@httptoolkit/dbus-native')
  private sessionBus: DBusClient
  private win: BrowserWindow
  iface: interFace
  constructor(win: BrowserWindow) {
    this.win = win
    this.sessionBus = this.dbus.sessionBus({})

    this.requestName()
  }

  requestName() {
    this.sessionBus
      .requestName(serviceName, 0x4)
      .then((retCode) => {
        if (retCode === 1) this.exportDBus()
      })
      .catch((err) => {
        console.log(err)
      })
  }

  exportDBus() {
    const ifaceDesc = {
      name: serviceName,
      methods: {
        LikeThisTrack: ['', '', [], []]
      },
      signals: {
        CurrentLrc: ['s', 'currentLyric'],
        UpdateLikeStatus: ['b', 'likeStatus']
      }
    }

    this.iface = {
      LikeThisTrack: () => {
        this.win.webContents.send('like')
      },
      emit: function (signalName: signalNameEnum, ...args: any) {}
    }

    this.sessionBus.exportInterface(this.iface, objectPath, ifaceDesc)
  }
}

export const createDBus = (win: BrowserWindow) => {
  return new DBus(win)
}
