<template>
  <div class="system-settings" :style="mainStyle" @click="clickOutside">
    <div v-if="user.userId" class="user-info">
      <div class="left">
        <img class="avatar" :src="user.avatarUrl" loading="lazy" />
        <div class="info">
          <div class="nickname">{{ user.nickname }}</div>
          <div class="extra-info">
            <span v-if="user.vipType !== 0" class="vip"
              ><img class="cvip" :src="imageUrl" loading="lazy" />
              <span class="text">黑胶VIP</span>
            </span>
            <span v-else class="text">{{ user.signature }}</span>
          </div>
        </div>
      </div>
      <div class="right">
        <button @click="doLogout">
          <svg-icon icon-class="logout" />
          {{ $t('settings.general.logout') }}
        </button>
      </div>
    </div>
    <div class="slide-container">
      <div class="slideBar">
        <div class="tab slide" :style="{ top: slideTop + 'px' }"><div class="iconfont"></div></div>
        <div class="tab" :class="{ active: tab === 'general' }" @click="updateTab(0)">{{
          $t('settings.nav.general')
        }}</div>
        <div class="tab" :class="{ active: tab === 'lyric' }" @click="updateTab(1)">{{
          $t('settings.nav.lyricSetting')
        }}</div>
        <div class="tab" :class="{ active: tab === 'music' }" @click="updateTab(2)">{{
          $t('settings.nav.music')
        }}</div>
        <div class="tab" :class="{ active: tab === 'unblock' }" @click="updateTab(3)">{{
          $t('settings.nav.unblock')
        }}</div>
        <div class="tab" :class="{ active: tab === 'shortcut' }" @click="updateTab(4)">{{
          $t('settings.nav.shortcut')
        }}</div>
        <div class="tab" :class="{ active: tab === 'update' }" @click="updateTab(5)">{{
          $t('settings.nav.update')
        }}</div>
      </div>
    </div>
    <div class="main-container">
      <div class="container">
        <div v-show="tab === 'general'" key="general">
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.language.text') }}</div>
            </div>
            <div class="right">
              <v-select
                v-model="selectLanguage"
                :items="languageOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="comfortable"
                class="my-vselect"
              />
            </div>
          </div>
          <div v-if="!isMac" class="item">
            <div class="left">
              <div class="title">{{ $t('settings.general.closeAppOption.text') }}</div>
            </div>
            <div class="right">
              <v-select
                v-model="selectOptions"
                :items="closeAppOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="comfortable"
                class="my-vselect"
              />
            </div>
          </div>
          <div class="item">
            <div>{{ $t('settings.nav.appearance') }}：</div>
            <div
              class="appearance"
              :class="{ selected: appearance === 'light' }"
              @click="updateAppearance('light')"
            >
              <img src="../assets/images/light.jpg" />
              {{ $t('settings.theme.light') }}</div
            >
            <div
              class="appearance"
              :class="{ selected: appearance === 'dark' }"
              @click="updateAppearance('dark')"
              ><img src="../assets/images/dark.jpg" /> {{ $t('settings.theme.dark') }}</div
            >
            <div
              class="appearance"
              :class="{ selected: appearance === 'auto' }"
              @click="updateAppearance('auto')"
              ><img src="../assets/images/auto.png" /> {{ $t('settings.theme.auto') }}</div
            >
          </div>
          <div class="item">
            <div>{{ $t('settings.theme.accent') }}：</div>
            <div class="colors">
              <div
                v-for="color of colors.slice(0, 4)"
                :key="color.name"
                class="color theme-color"
                @click="changeColor(color)"
              >
                <div v-show="color.selected" class="selected-icon"></div>
                <div class="theme-color-item" :style="{ backgroundColor: color.color }"></div>
                {{ $t(`settings.theme.${color.name}`) }}
              </div>
              <div class="color theme-color" @click="changeColor(customizeColor)">
                <div v-show="customizeColor.selected" class="selected-icon"></div>
                <pick-colors
                  v-model:value="customizeColor.color"
                  :width="60"
                  :height="60"
                  :theme="currentTheme ?? 'light'"
                  format="rgb"
                />
                {{ $t(`settings.theme.${customizeColor.name}`) }}
              </div>
            </div>
          </div>
        </div>
        <div v-show="tab === 'lyric'" key="lyric">
          <div class="lyric-tab">
            <button
              v-if="isElectron && !isWindows"
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'trayLyric' }"
              @click="lyricTab = 'trayLyric'"
              >{{ $t('settings.nav.trayLyric') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'lyric' }"
              @click="lyricTab = 'lyric'"
              >{{ $t('settings.nav.lyric') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': lyricTab === 'osdLyric' }"
              @click="lyricTab = 'osdLyric'"
              >{{ $t('settings.nav.osdLyric') }}</button
            >
          </div>
          <div v-show="lyricTab === 'osdLyric'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isLock') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="isLock" v-model="isLock" type="checkbox" name="isLock" />
                  <label for="isLock"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isWordByWord') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="isWordByWord"
                    v-model="isWordByWord"
                    type="checkbox"
                    name="isWordByWord"
                  />
                  <label for="isWordByWord"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.osdLyric.fontSize') }} </div>
              </div>
              <div class="right">
                <input
                  v-model="inputFontSizeValue"
                  type="number"
                  class="text-input margin-right-0"
                  @input="inputFontSizeDebounce"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.osdLyric.font') || '字体' }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="osdLyricFont"
                  :items="fontList"
                  item-title="value"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                  :menu-props="{ maxHeight: '300px' }"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.osdLyric.staticTime.text') }} </div>
                <div class="description"> {{ $t('settings.osdLyric.staticTime.desc') }} </div>
              </div>
              <div class="right">
                <input
                  v-model="staticTime"
                  type="number"
                  step="100"
                  class="text-input margin-right-0"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.type.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="type"
                  :items="osdLyricTypeOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.mode.text') }}</div>
                <div class="description">{{ $t('settings.osdLyric.mode.desc') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="mode"
                  :items="osdLyricModeOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.translationMode.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="translationMode"
                  :items="osdLyricTransOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="color">
                <pick-colors
                  v-model:value="backgroundColor"
                  :width="100"
                  :height="100"
                  :theme="currentTheme ?? 'light'"
                  format="rgb"
                  show-alpha
                />
                <div class="text">背景色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="playedLrcColor"
                  :width="100"
                  :height="100"
                  :theme="currentTheme ?? 'light'"
                  format="rgb"
                  show-alpha
                />
                <div class="text">已播放颜色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="unplayLrcColor"
                  :width="100"
                  :height="100"
                  :theme="currentTheme ?? 'light'"
                  format="rgb"
                  show-alpha
                />
                <div class="text">未播放颜色</div>
              </div>
              <div class="color">
                <pick-colors
                  v-model:value="textShadow"
                  :width="100"
                  :height="100"
                  :theme="currentTheme ?? 'light'"
                  format="rgb"
                  show-alpha
                />
                <div class="text">阴影颜色</div>
              </div>
            </div>
          </div>
          <div v-show="lyricTab === 'lyric'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.useMask.text') }}</div>
                <div class="description">{{ $t('settings.osdLyric.useMask.desc') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="useMask" v-model="useMask" type="checkbox" name="useMask" />
                  <label for="useMask"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.isWordByWord') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="isNWordByWord"
                    v-model="isNWordByWord"
                    type="checkbox"
                    name="isNWordByWord"
                  />
                  <label for="isNWordByWord"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.fontSize') }}</div>
              </div>
              <div class="right">
                <input
                  v-model="inputNFontSizeValue"
                  type="number"
                  class="text-input margin-right-0"
                  @input="inputNValue"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.textAlign.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="textAlign"
                  :items="osdLyricAlignOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.osdLyric.translationMode.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="nTranslationMode"
                  :items="nTransOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.general.lyricBackground.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="lyricBackground"
                  :items="lyricBgOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
          </div>
          <div v-if="!isWindows" v-show="lyricTab === 'trayLyric'">
            <div v-if="isMac">
              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.tray.showLyric') }}
                  </div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input id="show-lyric" v-model="showLyric" type="checkbox" name="show-lyric" />
                    <label for="show-lyric"></label>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.tray.showControl') }}
                  </div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="show-control"
                      v-model="showControl"
                      type="checkbox"
                      name="show-control"
                    />
                    <label for="show-control"></label>
                  </div>
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.tray.lyricFrameWidth') }} </div>
                </div>
                <div class="right">
                  <input
                    v-model="inputValue"
                    type="number"
                    class="text-input margin-right-0"
                    @input="inputDebounce()"
                  />
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.tray.lyricScrollFrameRate.text') }} </div>
                  <div class="description">
                    {{ $t('settings.tray.lyricScrollFrameRate.desc') }}</div
                  >
                </div>
                <div class="right">
                  <input
                    v-model="inputRateValue"
                    type="number"
                    class="text-input margin-right-0"
                    @input="inputRateDebounce()"
                  />
                </div>
              </div>
            </div>
            <div v-else-if="isLinux">
              <div class="item">
                <div class="left">
                  <div class="title"
                    >{{ $t('settings.extension.status') }}：{{
                      extensionCheckResult ? '已开启' : '已停用'
                    }}</div
                  >
                  <div class="description"
                    >如果未安装插件，可点击
                    <a @click="openOnBrowser('https://github.com/stark81/media-controls')">此处</a>
                    下载</div
                  >
                </div>
              </div>
              <div class="item">
                <div class="left">
                  <div class="title">{{ $t('settings.extension.showLyric.text') }}</div>
                  <div class="description">{{ $t('settings.extension.showLyric.desc') }}</div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="enable-extension"
                      v-model="enableExtension"
                      type="checkbox"
                      name="enable-extension"
                    />
                    <label for="enable-extension"></label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-show="tab === 'music'" key="music">
          <div class="lyric-tab">
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': musicTab === 'netease' }"
              @click="musicTab = 'netease'"
              >{{ $t('settings.nav.netease') }}</button
            >
            <button
              v-if="isElectron"
              :class="{ 'lyric-button': true, 'lyric-button--selected': musicTab === 'local' }"
              @click="musicTab = 'local'"
              >{{ $t('settings.nav.local') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': musicTab === 'stream' }"
              @click="musicTab = 'stream'"
              >{{ $t('settings.nav.stream') }}</button
            >
            <button
              :class="{ 'lyric-button': true, 'lyric-button--selected': musicTab === 'player' }"
              @click="musicTab = 'player'"
              >{{ $t('settings.nav.player') }}</button
            >
          </div>
          <div v-show="musicTab === 'netease'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.autoCacheTrack.enable') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="autoCacheTrack"
                    v-model="autoCacheTrack.enable"
                    type="checkbox"
                    name="autoCacheTrack"
                  />
                  <label for="autoCacheTrack"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.autoCacheTrack.sizeLimit') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="autoCacheTrack.sizeLimit"
                  :items="cacheSizeOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">{{ $t('settings.general.musicQuality.text') }}</div>
              <div class="right">
                <v-select
                  v-model="musicQuality"
                  :items="musicQualityOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"
                  >{{
                    $t('settings.autoCacheTrack.sizeCached', { song: cacheTracksInfo.length })
                  }}
                  ({{ cacheSize }})</div
                >
              </div>
              <div class="right">
                <button style="width: 150px" @click="deleteCacheTracks">{{
                  $t('settings.autoCacheTrack.clearCache')
                }}</button>
              </div>
            </div>
          </div>
          <div v-if="isElectron" v-show="musicTab === 'local'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('localMusic.enableLocalMusic') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="local-enable" v-model="enble" type="checkbox" name="local-enable" />
                  <label for="local-enable"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('localMusic.localMusicFolderPath') }}: {{ scanDir }}</div>
              </div>
              <div class="right">
                <button @click="chooseDir">{{ scanDir ? '更改' : '选择' }}</button>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('localMusic.clearLocalMusic.text') }}</div>
                <div class="description">{{ $t('localMusic.clearLocalMusic.desc') }}</div>
              </div>
              <div class="right">
                <button @click="deleteLocalMusic">确定</button>
              </div>
            </div>
            <div class="item no-flex">
              <div class="left">
                <div class="title">{{ $t('localMusic.trackInfoOrder.text') }}</div>
                <div class="description">{{ $t('localMusic.trackInfoOrder.desc') }}</div>
              </div>
              <VueDraggable v-model="trackInfoOrder">
                <div v-for="(item, index) in trackInfoOrder" :key="item" class="info-order">{{
                  (index + 1).toString() + ' - ' + $t(`localMusic.trackInfoOrder.${item}`)
                }}</div>
              </VueDraggable>
            </div>
          </div>
          <div v-show="musicTab === 'stream'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.stream.enable') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input id="stream" v-model="enable" type="checkbox" name="stream" />
                  <label for="stream"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div>{{ $t('settings.stream.service') }}：</div>
              <div
                v-for="service of services"
                :key="service.name"
                :title="serviceTitle(service)"
                class="stream-item"
                :class="{ itemSelected: service.selected }"
                @click="handleSelect(service)"
                @click.right="loginOrlogout(service)"
              >
                <img :src="getImagePath(service.name)" />
                <div class="service-name">
                  <div
                    class="service-status"
                    :title="$t(`settings.stream.${service.status}`)"
                    :style="{ background: getStatusColor(service) }"
                  ></div>
                  <div>{{ service.name }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-show="musicTab === 'player'">
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.general.showTimeOrID.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="showTrackInfo"
                  :items="showTrackInfoOptions"
                  item-title="label"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  class="my-vselect"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('player.fade.fadeDuration') }}</div>
                <div class="description">{{ $t('player.fade.fadeDurationDesc') }}</div>
              </div>
              <div class="right">
                <input
                  v-model.number="general.fadeDuration"
                  type="number"
                  step="0.1"
                  class="text-input margin-right-0"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('settings.general.outputDevice.text') }}</div>
              </div>
              <div class="right">
                <v-select
                  v-model="selectedOutputDevice"
                  :items="allOutputDevices"
                  item-title="label"
                  item-value="deviceId"
                  variant="outlined"
                  density="comfortable"
                />
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{ $t('player.resetPlayer') }}</div>
              </div>
              <div class="right">
                <button @click="resetPlayer()">确定</button>
              </div>
            </div>
            <div v-if="isElectron && isLinux" class="item">
              <div class="left">
                <div class="title">{{ $t('settings.general.useCustomTitlebar') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="linux-title-bar"
                    v-model="useCustomTitlebar"
                    type="checkbox"
                    name="linux-title-bar"
                  />
                  <label for="linux-title-bar"></label>
                </div>
              </div>
            </div>
            <div v-if="isElectron" class="item">
              <div class="left">
                <div class="title">{{ $t('settings.general.perventSuspend') }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="pervent-suspend"
                    v-model="general.preventSuspension"
                    type="checkbox"
                    name="pervent-suspend"
                  />
                  <label for="pervent-suspend"></label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isElectron" v-show="tab === 'unblock'" key="unblock">
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.enable') }}</div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="unblock-netease"
                  v-model="unblockNeteaseMusic.enable"
                  type="checkbox"
                  name="unblock-netease"
                />
                <label for="unblock-netease"></label>
              </div>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.enableFlac.text') }}</div>
              <div class="description">{{ $t('settings.unblock.enableFlac.desc') }}</div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="unblock-flac"
                  v-model="unblockNeteaseMusic.enableFlac"
                  type="checkbox"
                  name="unblock-flac"
                />
                <label for="unblock-flac"></label>
              </div>
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.sourceSearchMode.text') }}</div>
            </div>
            <div class="right">
              <v-select
                v-model="unblockNeteaseMusic.orderFirst"
                :items="unblockOrderOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="comfortable"
                class="my-vselect"
              />
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.source.text') }}</div>
              <div class="description">
                <label>{{ $t('settings.unblock.source.desc1') }}</label>
                <a
                  @click="
                    openOnBrowser(
                      'https://github.com/UnblockNeteaseMusic/server#%E9%9F%B3%E6%BA%90%E6%B8%85%E5%8D%95'
                    )
                  "
                >
                  {{ $t('settings.unblock.source.linkText') }}</a
                ><br />
                {{ $t('settings.unblock.source.desc2') }}<br />
                {{ $t('settings.unblock.source.desc3') }}
              </div>
            </div>
            <div class="right">
              <input
                v-model="unblockSource"
                class="text-input margin-right-0"
                placeholder="例 bilibili, kuwo"
                @input="updateUnblockSource"
              />
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.jooxCookie.text') }}</div>
              <div class="description">
                <a
                  @click="
                    openOnBrowser(
                      'https://github.com/UnblockNeteaseMusic/server#%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F'
                    )
                  "
                  >{{ $t('settings.unblock.qqCookie.desc1') }}</a
                >
                <label>, {{ $t('settings.unblock.qqCookie.desc2') }}</label>
              </div>
            </div>
            <div class="right">
              <input
                v-model="unblockNeteaseMusic.jooxCookie"
                class="text-input margin-right-0"
                placeholder="wmid=..; session_key=.."
              />
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.unblock.qqCookie.text') }}</div>
              <div class="description">
                <a
                  @click="
                    openOnBrowser(
                      'https://github.com/UnblockNeteaseMusic/server#%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F'
                    )
                  "
                  >{{ $t('settings.unblock.qqCookie.desc1') }}</a
                >
                <label>, {{ $t('settings.unblock.qqCookie.desc2') }}</label>
              </div>
            </div>
            <div class="right">
              <input
                v-model="unblockNeteaseMusic.qqCookie"
                class="text-input margin-right-0"
                placeholder="uin=..; qm_keyst=..;"
              />
            </div>
          </div>
        </div>
        <div v-if="isElectron" v-show="tab === 'shortcut'" key="shortcut">
          <div class="item">
            <div class="left">
              <div class="title"> {{ $t('settings.shortcut.enableGlobalShortcut') }} </div>
            </div>
            <div class="right">
              <div class="toggle">
                <input
                  id="enable-global-shortcut"
                  v-model="enableGlobalShortcut"
                  type="checkbox"
                  name="enable-global-shortcut"
                />
                <label for="enable-global-shortcut"></label>
              </div>
            </div>
          </div>
          <div
            id="shortcut-table"
            :class="{ 'global-disabled': !enableGlobalShortcut }"
            tabindex="0"
            @keydown="handleShortcutKeydown"
          >
            <div class="row row-head">
              <div class="col">{{ $t('settings.shortcut.function') }}</div>
              <div class="col">{{ $t('settings.shortcut.shortcut') }}</div>
              <div class="col">{{ $t('settings.shortcut.globalShortcut') }}</div>
            </div>
            <div v-for="shortcut in shortcuts" :key="shortcut.id" class="row">
              <div class="col">{{ $t(`settings.shortcut.${shortcut.id}`) }}</div>
              <div class="col">
                <div
                  class="keyboard-input"
                  :class="{
                    active: shortcutInput.id === shortcut.id && shortcutInput.type === 'shortcut'
                  }"
                  @click.stop="readyToRecordShortcut(shortcut.id, 'shortcut')"
                  >{{
                    shortcutInput.id === shortcut.id &&
                    shortcutInput.type === 'shortcut' &&
                    recordedShortcutComputed !== ''
                      ? formatShortcut(recordedShortcutComputed)
                      : formatShortcut(shortcut.shortcut)
                  }}</div
                >
              </div>
              <div class="col">
                <div
                  class="keyboard-input"
                  :class="{
                    active:
                      shortcutInput.id === shortcut.id && shortcutInput.type === 'globalShortcut'
                  }"
                  @click.stop="readyToRecordShortcut(shortcut.id, 'globalShortcut')"
                  >{{
                    shortcutInput.id === shortcut.id &&
                    shortcutInput.type === 'globalShortcut' &&
                    recordedShortcutComputed !== ''
                      ? formatShortcut(recordedShortcutComputed)
                      : formatShortcut(shortcut.globalShortcut)
                  }}</div
                >
              </div>
            </div>
          </div>
          <button class="restore-default-shortcut" @click="restoreDefaultShortcuts">{{
            $t('settings.shortcut.resetShortcut')
          }}</button>
        </div>
        <div v-if="isElectron" v-show="tab === 'update'" key="update">
          <div class="item">
            <div class="left">
              <div class="title"
                >{{ $t('settings.update.currentVersion') + '：' + appVersion }}
                <label v-if="latestVersion?.isUpdateAvailable" class="update-ext">{{
                  $t(isDownloading ? 'settings.update.updating' : 'settings.update.updateAvailable')
                }}</label>
              </div>
            </div>
            <div class="right">
              <button
                :class="{ loading: updateStatus, disabled: isDownloading }"
                @click="handleUpdate"
                >{{
                  latestVersion?.isUpdateAvailable
                    ? $t(isMac ? 'settings.update.goToDownload' : 'settings.update.downloadUpdate')
                    : $t(
                        updateStatus
                          ? 'settings.update.updateChecking'
                          : 'settings.update.updateCheck'
                      )
                }}</button
              >
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{
                $t('settings.update.latestVersion') +
                '：' +
                (latestVersion?.updateInfo?.version || 'unknown')
              }}</div>
            </div>
            <div class="right">
              {{
                Utils.formatDate(
                  latestVersion?.updateInfo?.releaseDate || '',
                  'YYYY-MM-DD HH:mm:ss'
                )
              }}
            </div>
          </div>
          <div class="item">
            <div class="left">
              <div class="title">{{ $t('settings.update.changelog') }}：</div>
            </div>
          </div>
          <LatestVersion />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, computed, inject, onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import pickColors, { Theme } from 'vue-pick-colors'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../store/settings'
import { usePlayerStore } from '../store/player'
import { useLocalMusicStore } from '../store/localMusic'
import { useNormalStateStore } from '../store/state'
import { useOsdLyricStore } from '../store/osdLyric'
import { useStreamMusicStore, serviceName, serviceType } from '../store/streamingMusic'
import { useDataStore } from '../store/data'
import { storeToRefs } from 'pinia'
import { doLogout } from '../utils/auth'
import SvgIcon from '../components/SvgIcon.vue'
import LatestVersion from '../components/LatestVersion.vue'
import Utils from '../utils'
import { VueDraggable } from 'vue-draggable-plus'
// @ts-ignore
import imageUrl from '../utils/settingImg.dataurl?raw'
import { useRouter } from 'vue-router'

const router = useRouter()

const settingsStore = useSettingsStore()
const {
  localMusic,
  general,
  tray,
  theme,
  shortcuts,
  autoCacheTrack,
  unblockNeteaseMusic,
  enableGlobalShortcut,
  normalLyric
} = storeToRefs(settingsStore)
const { scanDir, enble, trackInfoOrder } = toRefs(localMusic.value)
const {
  showTrackTimeOrID,
  useCustomTitlebar,
  language,
  musicQuality,
  closeAppOption,
  lyricBackground
} = toRefs(general.value)
const { appearance, colors } = toRefs(theme.value)
const customizeColor = computed(() => colors.value[4])
const { showLyric, showControl, lyricWidth, scrollRate, enableExtension } = toRefs(tray.value)
const { nFontSize, isNWordByWord, nTranslationMode, textAlign, useMask } = toRefs(normalLyric.value)

const streamMusicStore = useStreamMusicStore()
const { enable, services } = storeToRefs(streamMusicStore)
const { handleStreamLogout } = streamMusicStore

const stateStore = useNormalStateStore()
const { extensionCheckResult, updateStatus, latestVersion, isDownloading } = toRefs(stateStore)
const { showToast, checkUpdate } = stateStore

const dataStore = useDataStore()
const { user } = storeToRefs(dataStore)

const osdLyricStore = useOsdLyricStore()
const osdLyric = osdLyricStore
const {
  isLock,
  type,
  mode,
  isWordByWord,
  translationMode,
  fontSize,
  backgroundColor,
  playedLrcColor,
  unplayLrcColor,
  textShadow,
  staticTime
} = storeToRefs(osdLyric)

const playerStore = usePlayerStore()
const { resetPlayer } = playerStore
const { outputDevice, currentTrack } = storeToRefs(playerStore)

const localMusicStore = useLocalMusicStore()
const { resetLocalMusic } = localMusicStore

const { restoreDefaultShortcuts, updateShortcut } = useSettingsStore()

const cacheTracksInfo = reactive({ length: 0, size: 0 })

const getImagePath = (platform: serviceName) => {
  return new URL(`../assets/images/${platform}.png`, import.meta.url).href
}

const isElectron = window.env?.isElectron || false
const isMac = window.env?.isMac
const isLinux = window.env?.isLinux
const isWindows = window.env?.isWindows

const showTrackInfo = computed({
  get: () => showTrackTimeOrID.value,
  set: (value) => {
    showTrackTimeOrID.value = value
  }
})

const cacheSize = computed(() => {
  const size = cacheTracksInfo.size
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  } else {
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
})

const serviceTitle = (platform: serviceType) => {
  const title = platform.status === 'logout' ? '登陆' : '登出'
  return `单击选择，右击选择并${title}`
}

const handleSelect = (platform: serviceType) => {
  services.value.forEach((s) => {
    if (s.name === platform.name) {
      platform.selected = true
    } else {
      s.selected = false
    }
  })
}

const handleUpdate = () => {
  if (isDownloading.value) return
  if (latestVersion.value?.isUpdateAvailable) {
    if (isMac) {
      const url = `https://github.com/stark81/VutronMusic/releases/tag/${latestVersion.value!.updateInfo.releaseName}`
      openOnBrowser(url)
    } else {
      window.mainApi?.send('downloadUpdate')
    }
  } else {
    checkUpdate()
  }
}

const loginOrlogout = (platform: serviceType) => {
  if (platform.status === 'logout') {
    router.push('/streamLogin')
  } else {
    if (confirm(`确定登出${platform.name}吗？`)) {
      handleStreamLogout()
    }
  }
}

const shortcutInput = ref({
  id: '',
  type: '',
  recording: false
})

const recordedShortcut = ref<any[]>([])

const mainStyle = ref({})

const { locale } = useI18n()
const { t } = useI18n()

const selectLanguage = computed({
  get: () => language.value,
  set: (value) => {
    language.value = value
    locale.value = value
  }
})

const selectOptions = computed({
  get: () => {
    return closeAppOption.value
  },
  set: (value) => {
    closeAppOption.value = value
  }
})

const currentTheme = ref(
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') as Theme
)

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-theme') {
      currentTheme.value = document.body.getAttribute('data-theme') as Theme
    }
  })
})

const selectedOutputDevice = computed({
  get: () => {
    const isValidDevice = allOutputDevices.value.find(
      (device) => device.deviceId === outputDevice.value
    )
    if (
      outputDevice.value === undefined ||
      // outputDevice.value === 'default' ||
      isValidDevice === undefined
    )
      return allOutputDevices.value[0]?.deviceId
    return outputDevice.value
  },
  set: (deviceId) => {
    if (deviceId === outputDevice.value || deviceId === undefined) return
    outputDevice.value = deviceId === 'default' ? '' : deviceId
  }
})

const allOutputDevices = ref<MediaDeviceInfo[]>([])
const getAllOutputDevices = () => {
  navigator.mediaDevices.enumerateDevices().then((devices: MediaDeviceInfo[]) => {
    allOutputDevices.value = devices.filter(
      (device: MediaDeviceInfo) => device.kind === 'audiooutput' // && device.deviceId !== 'default'
    )
    if (allOutputDevices.value.length === 0 || allOutputDevices.value[0].label === '') {
      allOutputDevices.value = []
    }
  })
}

const tab = ref('general')
const lyricTab = ref(isWindows ? 'lyric' : 'trayLyric')
const musicTab = ref('netease')
const updateTab = (index: number) => {
  const tabs = ['general', 'lyric', 'music', 'unblock', 'shortcut', 'update'] // 'appearance'
  const tabName = tabs[index]
  tab.value = tabName
  slideTop.value = index * 40
}
const slideTop = ref(0)

const getCacheTracksInfo = () => {
  window.mainApi?.invoke('getCacheTracksInfo').then((res) => {
    cacheTracksInfo.length = res.length
    cacheTracksInfo.size = res.size
  })
}

watch(currentTrack, () => {
  setTimeout(getCacheTracksInfo, 5000)
})

const chooseDir = () => {
  window.mainApi?.invoke('selecteFolder').then((folderPath: string | null) => {
    if (folderPath) scanDir.value = folderPath
  })
}

const updatePadding = inject('updatePadding') as (value: number) => void

const appVersion = ref('Unknown')
const getVersion = () => {
  window.mainApi?.invoke('msgRequestGetVersion').then((result: string) => {
    appVersion.value = `v${result}`
  })
}

const deleteCacheTracks = () => {
  window.mainApi?.invoke('clearCacheTracks').then((res: boolean) => {
    if (res) {
      showToast('清除缓存成功')
      getCacheTracksInfo()
    }
  })
}

const updateAppearance = (mode: string) => {
  appearance.value = mode
  Utils.changeAppearance(mode)
}

const inputValue = ref<number>(lyricWidth.value)
let debounceTimeout
const inputDebounce = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    if (inputValue.value >= 100) lyricWidth.value = inputValue.value
  }, 500)
}

const inputRateValue = ref<number>(scrollRate.value)
let debounceTimeoutRate
const inputRateDebounce = () => {
  if (debounceTimeoutRate) clearTimeout(debounceTimeoutRate)
  debounceTimeoutRate = setTimeout(() => {
    scrollRate.value = inputRateValue.value
  }, 500)
}

const inputFontSizeValue = ref<number>(fontSize.value)
const inputFontSizeDebounce = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    fontSize.value = inputFontSizeValue.value
  }, 500)
}

const unblockSource = ref(unblockNeteaseMusic.value.source)
const updateUnblockSource = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    unblockNeteaseMusic.value.source = unblockSource.value
  }, 500)
}

const inputNFontSizeValue = ref<number>(nFontSize.value)
const inputNValue = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    nFontSize.value = inputNFontSizeValue.value
  }, 500)
}

const getStatusColor = (platform: serviceType) => {
  const colorMap = {
    login: 'green',
    logout: 'red',
    offline: 'orange'
  }
  return colorMap[platform.status]
}

const deleteLocalMusic = () => {
  resetPlayer()
  resetLocalMusic()
  scanDir.value = ''
  window.mainApi?.send('deleteLocalMusicDB')
}

const openOnBrowser = (url: string) => {
  Utils.openExternal(url)
}

const handleShortcutKeydown = (e: KeyboardEvent) => {
  if (shortcutInput.value.recording === false) return
  e.preventDefault()
  if (recordedShortcut.value.find((s) => s.keyCode === e.keyCode)) return
  recordedShortcut.value.push(e)
  if (
    (e.keyCode >= 65 && e.keyCode <= 90) || // A-Z
    (e.keyCode >= 48 && e.keyCode <= 57) || // 0-9
    (e.keyCode >= 112 && e.keyCode <= 123) || // F1-F12
    e.keyCode === 32 || // Space
    ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key) ||
    ['=', '-', '~', '[', ']', ';', "'", ',', '.', '/'].includes(e.key)
  ) {
    saveShortcut()
  }
}

const recordedShortcutComputed = computed(() => {
  let shortcut: string[] = []
  recordedShortcut.value.map((e) => {
    if (e.keyCode >= 65 && e.keyCode <= 90) {
      shortcut.push(e.code.replace('Key', ''))
    } else if (e.key === 'Meta') {
      shortcut.push('Command')
    } else if (['Alt', 'Control', 'Shift'].includes(e.key)) {
      shortcut.push(e.key)
    } else if (e.keyCode >= 48 && e.keyCode <= 57) {
      shortcut.push(e.code.replace('Digit', ''))
    } else if (e.keyCode >= 112 && e.keyCode <= 123) {
      shortcut.push(e.code)
    } else if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      shortcut.push(e.code.replace('Arrow', ''))
    } else if (e.keyCode === 32) {
      shortcut.push('Space')
    } else if (['=', '-', '~', '[', ']', ';', "'", ',', '.', '/'].includes(e.key)) {
      shortcut.push(e.key)
    }
  })
  const sortTable = {
    Control: 1,
    Shift: 2,
    Alt: 3,
    Command: 4
  }
  shortcut = shortcut.sort((a, b) => {
    if (!sortTable[a] || !sortTable[b]) return 0
    if (sortTable[a] - sortTable[b] <= -1) {
      return -1
    } else if (sortTable[a] - sortTable[b] >= 1) {
      return 1
    } else {
      return 0
    }
  })
  return shortcut.join('+')
})

const clickOutside = () => {
  exitRecordShortcut()
}

const exitRecordShortcut = () => {
  if (shortcutInput.value.recording === false) return
  shortcutInput.value = { id: '', type: '', recording: false }
  recordedShortcut.value = []
}

const saveShortcut = () => {
  const { id, type } = shortcutInput.value
  const payload = {
    id,
    type,
    shortcut: recordedShortcutComputed.value
  }
  updateShortcut(payload)
}

const readyToRecordShortcut = (id: string, type: string) => {
  if (type === 'globalShortcut' && !enableGlobalShortcut.value) return
  shortcutInput.value = {
    id,
    type,
    recording: true
  }
  recordedShortcut.value = []
}

const formatShortcut = (shortcut: string) => {
  shortcut = shortcut
    .replaceAll('+', ' + ')
    .replace('Up', '↑')
    .replace('Down', '↓')
    .replace('Left', '←')
    .replace('Right', '→')
  if (language.value === 'zh') {
    shortcut = shortcut.replace('Space', '空格')
  }
  if (isMac) {
    return shortcut
      .replace('CommandOrControl', '⌘')
      .replace('Command', '⌘')
      .replace('Alt', '⌥')
      .replace('Shift', '⇧')
      .replace('Control', '⌃')
  }
  return shortcut.replace('CommandOrControl', 'Ctrl').replace('Control', 'Ctrl')
}

const changeColor = (color: { name: string }) => {
  colors.value.forEach((c) => {
    c.selected = false
  })
  const colorObj = colors.value.find((c) => c.name === color.name)!
  colorObj.selected = true
}

const languageOptions = computed(() => [
  { value: 'zh', label: t('settings.general.language.zhHans') },
  { value: 'zht', label: t('settings.general.language.zhHant') },
  { value: 'en', label: t('settings.general.language.en') }
])

const closeAppOptions = computed(() => [
  { value: 'ask', label: t('settings.general.closeAppOption.ask') },
  { value: 'minimizeToTray', label: t('settings.general.closeAppOption.minimizeToTray') },
  { value: 'exit', label: t('settings.general.closeAppOption.exit') }
])

const osdLyricTypeOptions = computed(() => [
  { value: 'small', label: t('settings.osdLyric.type.small') },
  { value: 'normal', label: t('settings.osdLyric.type.normal') }
])

const osdLyricModeOptions = computed(() => [
  { value: 'oneLine', label: t('settings.osdLyric.mode.oneLine') },
  { value: 'twoLines', label: t('settings.osdLyric.mode.twoLines') }
])

const osdLyricTransOptions = computed(() => [
  { value: 'none', label: t('settings.osdLyric.translationMode.none') },
  { value: 'tlyric', label: t('settings.osdLyric.translationMode.tlyric') },
  { value: 'rlyric', label: t('settings.osdLyric.translationMode.romalrc') }
])

const osdLyricAlignOptions = computed(() => [
  { value: 'start', label: t('settings.osdLyric.textAlign.start') },
  { value: 'center', label: t('settings.osdLyric.textAlign.center') },
  { value: 'end', label: t('settings.osdLyric.textAlign.end') }
])

const nTransOptions = computed(() => [
  { value: 'none', label: t('settings.osdLyric.translationMode.none') },
  { value: 'tlyric', label: t('settings.osdLyric.translationMode.tlyric') },
  { value: 'rlyric', label: t('settings.osdLyric.translationMode.romalrc') }
])

const lyricBgOptions = computed(() => [
  { value: 'none', label: t('settings.general.lyricBackground.close') },
  { value: 'true', label: t('settings.general.lyricBackground.true') },
  { value: 'blur', label: t('settings.general.lyricBackground.blur') },
  { value: 'dynamic', label: t('settings.general.lyricBackground.dynamic') }
])

const cacheSizeOptions = computed(() => [
  { value: false, label: t('settings.autoCacheTrack.noLimit') },
  { value: 512, label: '500M' },
  { value: 1024, label: '1G' },
  { value: 2048, label: '2G' },
  { value: 4096, label: '4G' },
  { value: 8192, label: '8G' }
])

const musicQualityOptions = computed(() => [
  { value: 128000, label: t('settings.general.musicQuality.low') + ' - 128Kbps' },
  { value: 192000, label: t('settings.general.musicQuality.medium') + ' - 192Kbps' },
  { value: 320000, label: t('settings.general.musicQuality.high') + ' - 320Kbps' },
  { value: 'flac', label: t('settings.general.musicQuality.lossless') + ' - FLAC' },
  { value: 999000, label: 'Hi-Res' }
])

const showTrackInfoOptions = computed(() => [
  { value: 'time', label: t('settings.general.showTimeOrID.time') },
  { value: 'ID', label: t('settings.general.showTimeOrID.ID') }
])

const unblockOrderOptions = computed(() => [
  { value: true, label: t('settings.unblock.sourceSearchMode.orderFirst') },
  { value: false, label: t('settings.unblock.sourceSearchMode.speedFirst') }
])

const fontList = ref<string[]>([])
const osdLyricFont = computed({
  get: () => osdLyric.font,
  set: (val: string) => {
    osdLyric.font = val
  }
})

onMounted(async () => {
  mainStyle.value = {
    marginTop: isMac || !useCustomTitlebar.value ? '20px' : '0'
  }
  getCacheTracksInfo()
  updatePadding(64)
  getAllOutputDevices()
  getVersion()
  if (isElectron && window.mainApi) {
    fontList.value = await window.mainApi.invoke('getFontList')
  }
  // 开始监听 body 元素的属性变化
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
  // 动态注入 v-overlay 跟随 theme 的样式
  const style = document.createElement('style')
  style.innerHTML = `
    body[data-theme='dark'] .v-overlay__content .v-list,
    body[data-theme='light'] .v-overlay__content .v-list {
      background: var(--color-secondary-bg) !important;
      color: var(--color-text) !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 24px 0 rgba(0,0,0,0.18) !important;
    }
    body[data-theme='dark'] .v-overlay__content .v-list .v-list-item-title,
    body[data-theme='light'] .v-overlay__content .v-list .v-list-item-title {
      color: var(--color-text) !important;
    }
    body[data-theme='dark'] .v-overlay__content .v-list .v-list-item--active,
    body[data-theme='light'] .v-overlay__content .v-list .v-list-item--active {
      background: color-mix(in oklab, var(--color-primary) 12%, var(--color-secondary-bg)) !important;
      color: var(--color-primary) !important;
    }
  `
  style.setAttribute('data-vuetify-overlay-theme', 'true')
  document.head.appendChild(style)
})
onBeforeUnmount(() => {
  updatePadding(96)
  observer.disconnect()
})
</script>

<style scoped lang="scss">
.system-settings {
  width: 100%;
}
.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  padding: 16px 20px;
  border-radius: 16px;
  margin-top: 20px;
  img.avatar {
    border-radius: 50%;
    height: 64px;
    width: 64px;
  }
  img.cvip {
    height: 13px;
    margin-right: 4px;
  }
  .left {
    display: flex;
    align-items: center;
    .info {
      margin-left: 24px;
    }
    .nickname {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .extra-info {
      font-size: 13px;
      .text {
        opacity: 0.68;
      }
      .vip {
        display: flex;
        align-items: center;
      }
    }
  }
  .right {
    .svg-icon {
      height: 18px;
      width: 18px;
      margin-right: 4px;
    }
    button {
      display: flex;
      align-items: center;
      font-size: 18px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 10px;
      padding: 8px 12px;
      opacity: 0.68;
      color: var(--color-text);
      transition: 0.2s;
      margin: {
        right: 12px;
        left: 12px;
      }
      &:hover {
        opacity: 1;
        background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
        color: var(--color-primary);
      }
      &:active {
        opacity: 1;
        transform: scale(0.92);
        transition: 0.2s;
      }
    }
  }
}
.slide-container {
  position: relative;
  z-index: 1;
}
.main-container {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0 30px 0 180px;
  transition: all 0.3s;
  margin-bottom: 32px;
  .container {
    width: 100%;
    padding-top: 30px;
    min-height: 200px;
    height: 100%;

    .appearance {
      width: 160px;
      border-radius: 14px;
      text-align: center;
      img {
        width: 100%;
        border-radius: 14px;
        border: 2px solid var(--color-secondary-bg);
      }
    }

    .selected {
      img {
        border: 2px solid var(--color-primary);
      }
    }

    .lyric-tab {
      margin-bottom: 10px;
    }
  }
}
.iconfont {
  width: 100%;
  height: 16px;
  background-color: var(--color-primary);
}
.slideBar {
  max-width: 120px;
  position: absolute;
  left: 30px;
  top: 30px;
  font-size: 16px;
  font-weight: 600;
  .tab {
    height: 40px;
    display: flex;
    align-items: center;
    margin-left: 0px;
    transition: all, 0.3s;
    // font-size: 14px;
    opacity: 0.7;
    cursor: pointer;
    &:hover {
      opacity: 1;
      color: var(--color-primary);
    }
  }
  .slide {
    position: absolute;
    width: 4px;
    border-radius: 1px;
    transition: all 0.3s;
  }
  .active {
    opacity: 1;
    color: var(--color-primary);
    margin-left: 10px;
    transition: margin 0.3s;
  }
}
#shortcut-table {
  font-size: 14px;
  /* border: 1px solid black; */
  user-select: none;
  color: var(--color-text);
  margin-bottom: 20px;
  .row {
    display: flex;
  }
  .row.row-head {
    opacity: 0.58;
    font-size: 13px;
    font-weight: 500;
  }
  .col {
    min-width: 192px;
    padding: 8px;
    display: flex;
    align-items: center;
    /* border: 1px solid red; */
    &:first-of-type {
      padding-left: 0;
      min-width: 128px;
    }
  }
  .keyboard-input {
    font-weight: 600;
    background-color: var(--color-secondary-bg);
    padding: 8px 12px 8px 12px;
    border-radius: 0.5rem;
    min-width: 146px;
    min-height: 34px;
    box-sizing: border-box;
    &.active {
      color: var(--color-primary);
      background: color-mix(in oklab, var(--color-primary) var(--bg-alpha), white);
    }
  }
  .restore-default-shortcut {
    margin-top: 12px;
  }
  &.global-disabled {
    .row .col:last-child {
      opacity: 0.48;
    }
    .row.row-head .col:last-child {
      opacity: 1;
    }
  }
  &:focus {
    outline: none;
  }
}
.item.no-flex {
  display: unset;
}
.item {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);
  padding-bottom: 10px;
  .left {
    padding-right: 6vw;
  }
  .info-order {
    margin-top: 12px;
    display: inline-block;
    margin-right: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 2px var(--color-primary) solid;
    cursor: move;

    &:last-child {
      margin-right: unset;
    }
  }
  .title {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.78;

    .update-ext {
      margin-left: 20px;
      font-size: 14px;
      color: red;
    }
  }
  .description {
    font-size: 14px;
    opacity: 0.7;
  }
  .colors {
    display: flex;
    width: 90%;
    justify-content: space-between;
  }
  .color {
    margin-top: 10px;
    text-align: center;
    .text {
      margin-top: 6px;
    }
  }
  .theme-color {
    display: flex;
    flex-direction: column;
    margin-left: 20px;
    position: relative;

    .theme-color-item {
      height: 60px;
      width: 60px;
      border-radius: 5px;
      margin: 5px;
    }
    .selected-icon {
      position: absolute;
      top: 25px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: #dddddd;
    }
  }
  .stream-item {
    height: 200px;
    width: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 12px;

    .service-name {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      .service-status {
        height: 18px;
        width: 18px;
        margin-right: 6px;
        border-radius: 50%;
      }
    }

    img {
      width: 100px;
    }
  }
  .itemSelected {
    border: 4px solid var(--color-primary);
  }
}
button {
  position: relative;
  color: var(--color-text);
  background: var(--color-secondary-bg);
  padding: 8px 12px 8px 12px;
  font-weight: 600;
  border-radius: 8px;
  transition: 0.2s;
}
button.lyric-button {
  color: var(--color-text);
  background: unset;
  border-radius: 8px;
  padding: 6px 8px;
  margin-bottom: 12px;
  margin-right: 10px;
  transition: 0.2s;
  opacity: 0.68;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    opacity: 1;
    background: var(--color-secondary-bg);
  }
}
button.lyric-button--selected {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  opacity: 1;
  font-weight: 700;
}
button.loading {
  padding-left: 42px;
}
button.disabled {
  cursor: not-allowed;
}
button.loading::before {
  content: '';
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: var(--color-text);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
select {
  font-weight: 600;
  border: none;
  min-width: 150px;
  text-align: center;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  background-color: var(--color-secondary-bg);
  appearance: none;
  color: var(--color-text);
  outline: none;
}

.toggle {
  margin: auto;
}
.toggle input {
  opacity: 0;
  position: absolute;
}
.toggle input + label {
  position: relative;
  display: inline-block;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-transition: 0.4s ease;
  transition: 0.4s ease;
  height: 32px;
  width: 52px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
}
.toggle input + label:before {
  content: '';
  position: absolute;
  display: block;
  -webkit-transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  height: 32px;
  width: 52px;
  top: 0;
  left: 0;
  border-radius: 8px;
}

.toggle input + label:after {
  content: '';
  position: absolute;
  display: block;
  box-shadow:
    0 0 0 1px hsla(0, 0%, 0%, 0.02),
    0 4px 0px 0 hsla(0, 0%, 0%, 0.01),
    0 4px 9px hsla(0, 0%, 0%, 0.08),
    0 3px 3px hsla(0, 0%, 0%, 0.03);
  -webkit-transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  background: #fff;
  height: 20px;
  width: 20px;
  top: 6px;
  left: 6px;
  border-radius: 6px;
}
.toggle input:checked + label:before {
  background: var(--color-primary);
  -webkit-transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
  transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
}
.toggle input:checked + label:after {
  left: 26px;
}

input.text-input.margin-right-0 {
  margin-right: 0;
}

input.text-input {
  background: var(--color-secondary-bg);
  border: none;
  margin-right: 22px;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  color: var(--color-text);
  font-weight: 600;
  font-size: 16px;
  width: 150px;
  text-align: center;
}

.version-info {
  text-align: center;
  color: var(--color-text);
  font-weight: 600;
  .author {
    font-size: 0.9rem;
  }
  .version {
    font-size: 0.88rem;
    opacity: 0.58;
  }
}

@keyframes spin {
  0% {
    transform: translateY(-50%) rotate(0deg);
  }
  100% {
    transform: translateY(-50%) rotate(360deg);
  }
}
.my-vselect .v-field__input,
.my-vselect .v-field {
  background: var(--color-secondary-bg) !important;
  color: var(--color-text) !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

:deep(.v-overlay__content .v-list) {
  background: var(--color-secondary-bg) !important;
  color: var(--color-text) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.18) !important;
}
:deep(.v-overlay__content .v-list .v-list-item-title) {
  color: var(--color-text) !important;
}
:deep(.v-overlay__content .v-list .v-list-item--active) {
  background: color-mix(in oklab, var(--color-primary) 12%, var(--color-secondary-bg)) !important;
  color: var(--color-primary) !important;
}
</style>
