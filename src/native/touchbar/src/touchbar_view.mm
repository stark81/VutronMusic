#import "touchbar_view.h"

@interface TouchbarManager ()
- (NSButton*)createNativeButtonWithType:(ButtonType)type index:(NSInteger)index;
- (void)touchbarButtonClicked:(NSButton*)sender;
@end

// ================ 常量 ================
static const CGFloat kTouchBarHeight = 30;
static const CGFloat kButtonWidth = 44;
static const CGFloat kLyricDefaultWidth = 300;
static const CGFloat kIconSize = 20;

// ================ 按钮路径（与 tray 一致） ================
static CGPathRef MakeButtonPath(ButtonType type, CGFloat size, CGFloat height) {
  CGFloat cx = size / 2, cy = height / 2;
  CGMutablePathRef path = CGPathCreateMutable();
  switch (type) {
    case ButtonTypePrev: { // ◁◁
      CGFloat sz = 5;
      CGPathMoveToPoint(path, NULL, cx - 1, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx - 1, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx - 1 - sz * 0.8, cy);
      CGPathCloseSubpath(path);
      CGPathMoveToPoint(path, NULL, cx + 4, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx + 4, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx + 4 - sz * 0.8, cy);
      CGPathCloseSubpath(path);
      break;
    }
    case ButtonTypePlay: { // ▶
      CGFloat sz = 6;
      CGPathMoveToPoint(path, NULL, cx - 2, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx - 2, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx - 2 + sz * 0.8, cy);
      CGPathCloseSubpath(path);
      break;
    }
    case ButtonTypeNext: { // ▷▷
      CGFloat sz = 5;
      CGPathMoveToPoint(path, NULL, cx - 3, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx - 3, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx - 3 + sz * 0.8, cy);
      CGPathCloseSubpath(path);
      CGPathMoveToPoint(path, NULL, cx + 2, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx + 2, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx + 2 + sz * 0.8, cy);
      CGPathCloseSubpath(path);
      break;
    }
    case ButtonTypeLike: { // ♥
      CGPathMoveToPoint(path, NULL, cx, cy + 5);
      CGPathAddCurveToPoint(path, NULL, cx + 5, cy + 1, cx + 7, cy - 3, cx, cy - 1);
      CGPathAddCurveToPoint(path, NULL, cx - 7, cy - 3, cx - 5, cy + 1, cx, cy + 5);
      CGPathCloseSubpath(path);
      break;
    }
    case ButtonTypeThumbsDown: { // 👎
      CGFloat sz = 5;
      CGPathMoveToPoint(path, NULL, cx - sz, cy - 3);
      CGPathAddLineToPoint(path, NULL, cx + sz, cy - 3);
      CGPathAddLineToPoint(path, NULL, cx + sz, cy + 4);
      CGPathMoveToPoint(path, NULL, cx + sz, cy + 2);
      CGPathAddLineToPoint(path, NULL, cx + sz + 3, cy - 5);
      CGPathAddLineToPoint(path, NULL, cx + sz - 1, cy - 5);
      CGPathAddLineToPoint(path, NULL, cx - 2, cy + 1);
      CGPathMoveToPoint(path, NULL, cx - sz, cy + 4);
      CGPathAddLineToPoint(path, NULL, cx - sz, cy - 3);
      CGPathCloseSubpath(path);
      break;
    }
  }
  return path;
}

// ================ 暂停按钮路径 ================
static CGPathRef MakePausePath(CGFloat width, CGFloat height) {
  CGFloat cx = width / 2, cy = height / 2;
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathAddRoundedRect(path, NULL, CGRectMake(cx - 7, cy - 5, 4, 10), 1, 1);
  CGPathAddRoundedRect(path, NULL, CGRectMake(cx + 3, cy - 5, 4, 10), 1, 1);
  return path;
}

// ================ 颜色辅助 ================
static NSColor* DefaultButtonColor(void) {
  return [NSColor whiteColor];
}

// ================ TouchbarButtonView ================
@interface TouchbarButtonView () {
  CAShapeLayer* _bgLayer;
  CAShapeLayer* _iconLayer;
  CAShapeLayer* _pauseLayer;
  BOOL _isPlaying;
  ButtonType _currentType;
}
@end

@implementation TouchbarButtonView

- (instancetype)initWithType:(ButtonType)type index:(NSInteger)index {
  self = [super initWithFrame:NSMakeRect(0, 0, kButtonWidth, kTouchBarHeight)];
  if (!self) return nil;
  _type = type;
  _buttonIndex = index;
  _currentType = type;
  self.wantsLayer = YES;
  self.layer.masksToBounds = NO;
  self.translatesAutoresizingMaskIntoConstraints = NO;

  // 背景层（圆角深色背景 + 边框）
  _bgLayer = [CAShapeLayer layer];
  _bgLayer.backgroundColor = [[NSColor colorWithWhite:1.0 alpha:0.12] CGColor];
  _bgLayer.borderColor = [[NSColor colorWithWhite:1.0 alpha:0.25] CGColor];
  _bgLayer.borderWidth = 0.5;
  _bgLayer.cornerRadius = 4.0;
  _bgLayer.frame = self.bounds;
  [self.layer addSublayer:_bgLayer];

  _iconLayer = [CAShapeLayer layer];
  _iconLayer.fillColor = DefaultButtonColor().CGColor;
  _iconLayer.strokeColor = nil;
  _iconLayer.frame = self.bounds;
  _iconLayer.path = MakeButtonPath(type, kButtonWidth, kTouchBarHeight);
  [self.layer addSublayer:_iconLayer];

  if (type == ButtonTypePlay) {
    _pauseLayer = [CAShapeLayer layer];
    _pauseLayer.fillColor = DefaultButtonColor().CGColor;
    _pauseLayer.strokeColor = nil;
    _pauseLayer.frame = self.bounds;
    _pauseLayer.path = MakePausePath(kButtonWidth, kTouchBarHeight);
    _pauseLayer.hidden = YES;
    [self.layer addSublayer:_pauseLayer];
  }

  return self;
}

- (CGSize)intrinsicContentSize {
  return NSMakeSize(kButtonWidth, kTouchBarHeight);
}

- (void)setButtonType:(ButtonType)type {
  _currentType = type;
  if (type == ButtonTypePlay) {
    // play 和 pause 由 setPlaying: 控制
    return;
  }
  _iconLayer.hidden = NO;
  _iconLayer.path = MakeButtonPath(type, kButtonWidth, kTouchBarHeight);
}

- (void)setPlaying:(BOOL)playing {
  _isPlaying = playing;
  if (_type != ButtonTypePlay) return;
  _iconLayer.hidden = playing;
  _pauseLayer.hidden = !playing;
}

- (void)setSelected:(BOOL)selected {
  _selected = selected;
  if (_type == ButtonTypeLike) {
    if (selected) {
      _iconLayer.fillColor = DefaultButtonColor().CGColor;
      _iconLayer.strokeColor = nil;
    } else {
      _iconLayer.fillColor = [NSColor clearColor].CGColor;
      _iconLayer.strokeColor = DefaultButtonColor().CGColor;
      _iconLayer.lineWidth = 1.2;
    }
  }
}

- (void)updateColor {
  CGColorRef cg = DefaultButtonColor().CGColor;
  _iconLayer.fillColor = cg;
  _pauseLayer.fillColor = cg;
  if (self.isSelected) {
    _iconLayer.fillColor = cg;
    _iconLayer.strokeColor = nil;
  }
}

- (void)layout {
  [super layout];
  _bgLayer.frame = self.bounds;
  _iconLayer.frame = self.bounds;
  _pauseLayer.frame = self.bounds;
  _iconLayer.path = MakeButtonPath(_currentType, self.bounds.size.width, self.bounds.size.height);
  if (_pauseLayer) {
    _pauseLayer.path = MakePausePath(self.bounds.size.width, self.bounds.size.height);
  }
}

// TouchBar 上的点击处理
- (void)mouseDown:(NSEvent *)event {
  if (self.onClick) self.onClick(self.buttonIndex);
}

@end

// ================ TouchbarLyricView ================
@interface TouchbarLyricView () {
  NSFont* _font;
  CGFloat _lyricAreaWidth;
  CGFloat _lastLayoutWidth;

  CATextLayer* _baseText;
  CATextLayer* _highlightText;
  CALayer* _maskLayer;

  // 动画参数
  double _lineStartMs;
  double _lineEndMs;
  BOOL _hasWordTiming;
  BOOL _wBYw;
  BOOL _isPlaying;
  double _playbackRate;
  double _lastOffsetMs;
  CGFloat _lastTotalTextWidth;
  CGFloat _lastLyricWidth;

  // 上次歌词数据（seek 恢复时重建）
  NSString* _lastText;
  NSArray<NSDictionary*>* _lastWords;
  BOOL _lastHasTiming;

  NSColor* _playedColor;
  NSColor* _playedColorLight;
}
@end

@implementation TouchbarLyricView

- (instancetype)initWithWidth:(CGFloat)width {
  self = [super initWithFrame:NSMakeRect(0, 0, width, kTouchBarHeight)];
  if (!self) return nil;
  _lyricAreaWidth = width;
  _lastLayoutWidth = width;
  _font = [NSFont systemFontOfSize:18 weight:NSFontWeightMedium];
  _playbackRate = 1.0;
  _isPlaying = YES;
  _wBYw = YES;
  _hasWordTiming = YES;

  self.wantsLayer = YES;
  self.layer.masksToBounds = YES;
  self.translatesAutoresizingMaskIntoConstraints = NO;

  _baseText = [CATextLayer layer];
  _baseText.contentsScale = NSScreen.mainScreen.backingScaleFactor;
  _baseText.alignmentMode = kCAAlignmentLeft;
  [self.layer addSublayer:_baseText];

  _highlightText = [CATextLayer layer];
  _highlightText.contentsScale = _baseText.contentsScale;
  _highlightText.alignmentMode = kCAAlignmentLeft;
  [self.layer addSublayer:_highlightText];

  _maskLayer = [CALayer layer];
  _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
  _maskLayer.anchorPoint = CGPointMake(0, 0.5);
  _highlightText.mask = _maskLayer;

  return self;
}

- (CGSize)intrinsicContentSize {
  return NSMakeSize(_lyricAreaWidth, kTouchBarHeight);
}

- (NSColor*)playedColor {
  BOOL isDark = [self.effectiveAppearance
      bestMatchFromAppearancesWithNames:@[NSAppearanceNameDarkAqua, NSAppearanceNameAqua]] == NSAppearanceNameDarkAqua;
  return isDark ? (_playedColor ?: [NSColor yellowColor]) : (_playedColorLight ?: [NSColor systemBlueColor]);
}

- (void)updateLyricWithText:(NSString*)text
                      words:(NSArray<NSDictionary*>*)words
                  lineStartMs:(double)lineStart
                    lineEndMs:(double)lineEnd
               hasWordTiming:(BOOL)hasTiming
                  lyricWidth:(CGFloat)width
                     offset:(double)offsetMs {
  _hasWordTiming = hasTiming;
  _lineStartMs = lineStart;
  _lineEndMs = lineEnd;
  _lastOffsetMs = offsetMs;

  if (width > 0 && width != _lyricAreaWidth) {
    _lyricAreaWidth = width;
    _lastLayoutWidth = width;
  }

  // 测量文字宽度
  CGFloat totalTextWidth = [text sizeWithAttributes:@{NSFontAttributeName: _font}].width;
  _lastTotalTextWidth = totalTextWidth;

  // 逐字宽度
  NSMutableArray<NSNumber*>* spanWidths = [NSMutableArray array];
  for (NSDictionary* w in words) {
    NSString* word = w[@"word"] ?: @"";
    CGFloat ww = [word sizeWithAttributes:@{NSFontAttributeName: _font}].width;
    [spanWidths addObject:@(ww)];
  }

  double lineDurationMs = lineEnd - lineStart;

  // 清除旧动画
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  [_baseText removeAllAnimations];
  [_highlightText removeAllAnimations];
  [_maskLayer removeAllAnimations];
  _baseText.speed = 1; _baseText.timeOffset = 0; _baseText.beginTime = 0;
  _highlightText.speed = 1; _highlightText.timeOffset = 0; _highlightText.beginTime = 0;
  _maskLayer.speed = 1; _maskLayer.timeOffset = 0; _maskLayer.beginTime = 0;

  CGFloat textHeight = _font.ascender - _font.descender;
  CGFloat yPos = (kTouchBarHeight - textHeight) / 2.0; 

  // 短歌词居中、长歌词左对齐
  CGFloat textX = (totalTextWidth <= _lyricAreaWidth) ? (_lyricAreaWidth - totalTextWidth) / 2.0 : 0;

  NSColor* unplayed = DefaultButtonColor();
  NSDictionary* baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
  NSColor* played = [self playedColor];
  if (!hasTiming || !_wBYw) played = unplayed;
  NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: played};

  _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:baseAttrs];
  _baseText.frame = CGRectMake(textX, yPos, totalTextWidth, textHeight);
  _highlightText.frame = _baseText.frame;

  if (_wBYw && hasTiming && words.count > 0) {
    _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
    _highlightText.frame = _baseText.frame;
    _highlightText.opacity = 1;

    // 重建 mask
    _highlightText.mask = nil;
    _maskLayer = [CALayer layer];
    _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
    _maskLayer.anchorPoint = CGPointMake(0, 0.5);
    _maskLayer.frame = CGRectMake(0, 0, 0, kTouchBarHeight);
    _maskLayer.position = CGPointMake(0, kTouchBarHeight / 2);
    _highlightText.mask = _maskLayer;
  } else {
    _highlightText.string = nil;
    _highlightText.opacity = 0;
    _highlightText.mask = nil;
  }

  [CATransaction commit];
  [CATransaction flush];

  // 逐字高亮：根据当前 offset 计算 mask 宽度
    // 逐字高亮：使用 Core Animation 驱动 mask 宽度
  if (hasTiming && _wBYw && words.count > 0 && lineDurationMs > 0) {
    NSMutableArray<NSNumber*>* cumWidths = [NSMutableArray array];
    NSMutableArray<NSNumber*>* wordTimes = [NSMutableArray array];
    __block CGFloat acc = 0;
    for (NSUInteger i = 0; i < words.count; i++) {
      double start = [words[i][@"start"] doubleValue];
      double t = MAX(MIN((start - lineStart) / lineDurationMs, 1), 0);
      if (wordTimes.count > 0 && t < [wordTimes.lastObject doubleValue]) {
        t = [wordTimes.lastObject doubleValue];
      }
      [wordTimes addObject:@(t)];
      [cumWidths addObject:@(acc)];
      acc += [spanWidths[i] doubleValue];
    }
    [wordTimes addObject:@1.0];
    [cumWidths addObject:@(totalTextWidth)];

    // 创建关键帧动画
    CAKeyframeAnimation *widthAnim = [CAKeyframeAnimation animationWithKeyPath:@"bounds.size.width"];
    widthAnim.values = cumWidths;
    widthAnim.keyTimes = wordTimes;
    widthAnim.duration = lineDurationMs / 1000.0; // 转换为秒
    widthAnim.calculationMode = kCAAnimationLinear;
    widthAnim.removedOnCompletion = NO;
    widthAnim.fillMode = kCAFillModeForwards;

    // 设置动画从当前进度开始
    double progress = MAX(0, MIN(offsetMs / lineDurationMs, 1.0));
    widthAnim.timeOffset = progress * widthAnim.duration;

    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    _maskLayer.bounds = CGRectMake(0, 0, totalTextWidth, kTouchBarHeight);
    
    [_maskLayer removeAnimationForKey:@"maskWidthAnim"];
    [_maskLayer addAnimation:widthAnim forKey:@"maskWidthAnim"];
    [CATransaction commit];

    _maskLayer.speed = _isPlaying ? _playbackRate : 0.0;

  } else if (lineDurationMs <= 0 || !_wBYw) {
    if (_wBYw) {
      [CATransaction begin];
      [CATransaction setDisableActions:YES];
      _maskLayer.bounds = CGRectMake(0, 0, totalTextWidth, kTouchBarHeight);
      [CATransaction commit];
      [_maskLayer removeAnimationForKey:@"maskWidthAnim"];
    }
  } else {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    _maskLayer.bounds = CGRectMake(0, 0, totalTextWidth, kTouchBarHeight);
    [CATransaction commit];
    [_maskLayer removeAnimationForKey:@"maskWidthAnim"];
  }

    // ====== 滚动动画 ======
  if (totalTextWidth > _lyricAreaWidth) {
    CGFloat scrollWidth = totalTextWidth - _lyricAreaWidth;
    CGFloat startX = totalTextWidth / 2; // 从中心点开始滚动

    NSMutableArray<NSNumber*>* sKeyTimes = [NSMutableArray array];
    NSMutableArray<NSNumber*>* sValues = [NSMutableArray array];

    if (hasTiming) {
      // 逐字滚动：根据每个词的结束时间计算滚动节点
      [sKeyTimes addObject:@0];
      [sValues addObject:@(startX)];

      __block CGFloat curWidth = 0;
      for (NSUInteger i = 0; i < words.count; i++) {
        curWidth += [spanWidths[i] doubleValue];
        if (curWidth <= _lyricAreaWidth / 2) continue; // 前 1/2 不滚动

        CGFloat sWidth = MIN(curWidth - _lyricAreaWidth / 2, scrollWidth);
        double end = [words[i][@"end"] doubleValue];
        double offset = MAX(MIN((end - lineStart) / lineDurationMs, 1), 0);
        if (sKeyTimes.count > 0 && offset < [sKeyTimes.lastObject doubleValue]) {
          offset = [sKeyTimes.lastObject doubleValue];
        }
        [sKeyTimes addObject:@(offset)];
        [sValues addObject:@(startX - sWidth)];

        if (curWidth - _lyricAreaWidth / 2 > scrollWidth) break; // 滚动完成
      }
      [sKeyTimes addObject:@1.0];
      [sValues addObject:@(startX - scrollWidth)]; // 滚动到终点
    } else {
      // 非逐字：前 1/2 静止，中间匀速滚动，末尾停住
      CGFloat p1 = (_lyricAreaWidth / 2) / totalTextWidth;
      CGFloat p2 = scrollWidth / totalTextWidth;
      sKeyTimes = [@[@0, @(p1), @(p1 + p2), @1] mutableCopy];
      sValues = [@[@(startX), @(startX), @(startX - scrollWidth), @(startX - scrollWidth)] mutableCopy];
    }

    // 创建滚动动画
    CAKeyframeAnimation *scrollAnim = [CAKeyframeAnimation animationWithKeyPath:@"position.x"];
    scrollAnim.keyTimes = sKeyTimes;
    scrollAnim.values = sValues;
    scrollAnim.calculationMode = kCAAnimationLinear;
    scrollAnim.duration = lineDurationMs / 1000.0; // 转换为秒
    scrollAnim.removedOnCompletion = NO;
    scrollAnim.fillMode = kCAFillModeForwards;

    // 同步动画进度与播放时间
    double clampedOffset = MAX(0, MIN(offsetMs, lineDurationMs));
    CFTimeInterval now = [self.layer convertTime:CACurrentMediaTime() fromLayer:nil];
    scrollAnim.beginTime = now * _playbackRate - (clampedOffset / 1000.0);
    _baseText.speed = _playbackRate;
    _highlightText.speed = _playbackRate;

    // 添加动画
    [_baseText addAnimation:scrollAnim forKey:@"scroll"];
    [_highlightText addAnimation:scrollAnim forKey:@"scroll"];
  }



  [CATransaction flush];

  // 保存数据供恢复（不在这里暂停动画，由 setPlaying: 统一控制）
  _lastText = text;
  _lastWords = words;
  _lastHasTiming = hasTiming;
  _lastLyricWidth = width;
}

- (void)setAnimationsPaused:(BOOL)paused {
  if (paused) {
    if (!_lastText || _lastTotalTextWidth <= 0) return;

    CALayer* maskPres = [_maskLayer presentationLayer];
    CGFloat curMaskW = maskPres ? maskPres.bounds.size.width : _maskLayer.bounds.size.width;
    double lineDurMs = _lineEndMs - _lineStartMs;
    double offsetMs = 0;
    if (_lastTotalTextWidth > 0 && lineDurMs > 0) {
      offsetMs = (curMaskW / _lastTotalTextWidth) * lineDurMs;
      offsetMs = MAX(0, MIN(offsetMs, lineDurMs));
    }
    _lastOffsetMs = offsetMs;

    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [_baseText removeAllAnimations];
    [_highlightText removeAllAnimations];
    [_maskLayer removeAllAnimations];
    _baseText.speed = 1; _baseText.timeOffset = 0; _baseText.beginTime = 0;
    _highlightText.speed = 1; _highlightText.timeOffset = 0; _highlightText.beginTime = 0;
    _maskLayer.speed = 1; _maskLayer.timeOffset = 0; _maskLayer.beginTime = 0;
    if (_wBYw && _hasWordTiming) {
      _maskLayer.bounds = CGRectMake(0, 0, curMaskW, kTouchBarHeight);
    }
    [CATransaction commit];
  } else {
    // 恢复
    if (_lastText && _lastWords) {
      [self updateLyricWithText:_lastText
                          words:_lastWords
                    lineStartMs:_lineStartMs
                      lineEndMs:_lineEndMs
                 hasWordTiming:_lastHasTiming
                    lyricWidth:_lastLyricWidth
                       offset:_lastOffsetMs];
    }
  }
}

- (void)setPlaying:(BOOL)playing progress:(double)progress {
  if (_isPlaying == playing) return;
  _isPlaying = playing;
  if (playing && progress > 0 && _lastText) {
    double offsetMs = (progress * 1000 - _lineStartMs) + 50;
    offsetMs = MAX(0, offsetMs);
    [self updateLyricWithText:_lastText
                        words:_lastWords
                  lineStartMs:_lineStartMs
                    lineEndMs:_lineEndMs
               hasWordTiming:_lastHasTiming
                  lyricWidth:_lastLyricWidth
                     offset:offsetMs];
  } else {
    [self setAnimationsPaused:!playing];
  }
}

- (void)setPlaybackRate:(double)rate {
  _playbackRate = rate;
  if (!_isPlaying) return;
  NSArray* layers = @[_baseText, _highlightText, _maskLayer];
  CFTimeInterval refNow = [self.layer convertTime:CACurrentMediaTime() fromLayer:nil];
  for (CALayer* layer in layers) {
    CFTimeInterval currentLayerTime = (refNow - layer.beginTime) * layer.speed;
    layer.speed = rate;
    layer.beginTime = refNow - currentLayerTime / rate;
  }
}

- (void)setWordByWord:(BOOL)wBYw {
  _wBYw = wBYw;
}

- (void)setPlayedColor:(NSColor*)color {
  _playedColor = color;
}

- (void)setPlayedColorLight:(NSColor*)color {
  _playedColorLight = color;
}

- (void)viewDidChangeEffectiveAppearance {
  [self updateColor];
}

- (void)layout {
  [super layout];
  // NSTouchBar 调整宽度后，仅更新 text layer 的宽度（不重置动画）
  CGFloat w = self.bounds.size.width;
  if (w > 0 && w != _lastLayoutWidth) {
    _lastLayoutWidth = w;
    _lyricAreaWidth = w;
    // 如果有歌词数据，重新计算居中位置
    if (_lastText && _lastTotalTextWidth > 0) {
      CGFloat textX = (_lastTotalTextWidth <= w) ? (w - _lastTotalTextWidth) / 2.0 : 0;
      CGFloat textHeight = _font.ascender - _font.descender;
      CGFloat yPos = (kTouchBarHeight - textHeight) / 2.0;
      CGRect textFrame = CGRectMake(textX, yPos, _lastTotalTextWidth, textHeight); 
      _baseText.frame = textFrame;
      _highlightText.frame = textFrame;
    }
  }
}

- (void)updateColor {
  // 更新歌词文字颜色（基础白色 + 高亮色）
  if (_baseText.string && [_baseText.string isKindOfClass:[NSAttributedString class]]) {
    NSAttributedString* attrStr = (NSAttributedString*)_baseText.string;
    NSString* plainText = attrStr.string;
    NSColor* unplayed = DefaultButtonColor(); // 白色
    NSDictionary* baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
    _baseText.string = [[NSAttributedString alloc] initWithString:plainText attributes:baseAttrs];

    NSColor* played = [self playedColor];
    if (!_hasWordTiming || !_wBYw) played = unplayed;
    NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: played};
    _highlightText.string = [[NSAttributedString alloc] initWithString:plainText attributes:playedAttrs];
  }
}

@end

// ================ TouchbarManager ================
static NSString* const kLyricItemIdentifier = @"com.vutron.touchbar.lyric";
static NSString* const kButtonItemBaseIdentifier = @"com.vutron.touchbar.button";

@implementation TouchbarManager {
  NSMutableDictionary<NSString*, NSTouchBarItem*>* _itemsByIdentifier;
}

- (instancetype)init {
  self = [super init];
  if (!self) return nil;
  _isFMMode = NO;
  _itemsByIdentifier = [NSMutableDictionary dictionary];
  [self setupTouchBar];
  return self;
}

- (void)setupTouchBar {
  // 创建原生系统按钮（内部已绑定 target-action 到 self）
  _prevButton = [self createNativeButtonWithType:ButtonTypePrev  index:0];
  _playButton = [self createNativeButtonWithType:ButtonTypePlay  index:1];
  _nextButton = [self createNativeButtonWithType:ButtonTypeNext  index:2];
  _likeButton = [self createNativeButtonWithType:ButtonTypeLike  index:3];

  // 创建歌词视图
  _lyricView = [[TouchbarLyricView alloc] initWithWidth:kLyricDefaultWidth];

  [_itemsByIdentifier removeAllObjects];

  // 歌词 item（principal，居中）
  NSCustomTouchBarItem* lyricItem =
      [[NSCustomTouchBarItem alloc] initWithIdentifier:kLyricItemIdentifier];
  lyricItem.view = _lyricView;
  lyricItem.visibilityPriority = NSTouchBarItemPriorityHigh;
  _itemsByIdentifier[kLyricItemIdentifier] = lyricItem;

  // 按钮 items（注意泛型改成 NSButton*）
  NSArray<NSButton*>* buttons = @[_prevButton, _playButton, _nextButton, _likeButton];
  for (NSUInteger i = 0; i < buttons.count; i++) {
    NSString* identifier =
        [NSString stringWithFormat:@"%@.%lu", kButtonItemBaseIdentifier, (unsigned long)i];
    NSCustomTouchBarItem* item =
        [[NSCustomTouchBarItem alloc] initWithIdentifier:identifier];
    item.view = buttons[i];
    _itemsByIdentifier[identifier] = item;
  }

  _touchBar = [[NSTouchBar alloc] init];
  _touchBar.delegate = self;
  _touchBar.defaultItemIdentifiers = @[
    @"com.vutron.touchbar.button.0",
    @"com.vutron.touchbar.button.1",
    @"com.vutron.touchbar.button.2",
    @"com.vutron.touchbar.button.3",
    NSTouchBarItemIdentifierFixedSpaceSmall,
    kLyricItemIdentifier
  ];
  _touchBar.principalItemIdentifier = kLyricItemIdentifier;
}

// === 补全这个方法：创建系统原生按钮 ===
- (NSButton*)createNativeButtonWithType:(ButtonType)type index:(NSInteger)index {
  NSButton *button = [NSButton buttonWithTitle:@"" target:self 
                                         action:@selector(touchbarButtonClicked:)];
  button.bezelStyle = NSBezelStyleRounded; // TouchBar 标准按钮样式
  button.tag = index;
  button.imagePosition = NSImageOnly;
  button.contentTintColor = [NSColor whiteColor];
  
  // 使用 macOS 系统自带的矢量图标 (SF Symbols)
  NSString *iconName = @"";
  switch (type) {
    case ButtonTypePrev:        iconName = @"backward.fill";        break;
    case ButtonTypePlay:        iconName = @"play.fill";            break;
    case ButtonTypeNext:        iconName = @"forward.fill";         break;
    case ButtonTypeLike:        iconName = @"heart";                break;
    case ButtonTypeThumbsDown:  iconName = @"hand.thumbsdown.fill"; break;
  }
  
  if (@available(macOS 11.0, *)) {
    NSImage *image = [NSImage imageWithSystemSymbolName:iconName 
                                accessibilityDescription:nil];
    if (image) {
      NSImageSymbolConfiguration *config = 
          [NSImageSymbolConfiguration configurationWithScale:NSImageSymbolScaleMedium];
      button.image = [image imageWithSymbolConfiguration:config];
    }
  }
  return button;
}

// === 这个方法你已经有，确保它在这附近 ===
- (void)touchbarButtonClicked:(NSButton *)sender {
  if (self.onButtonClick) {
    self.onButtonClick(sender.tag); // 把 index 传给 napi 回调
  }
}

// ================ NSTouchBarDelegate ================
- (NSTouchBarItem*)touchBar:(NSTouchBar*)touchBar makeItemForIdentifier:(NSTouchBarItemIdentifier)identifier {
  // 系统内置标识符（固定空格等）返回 nil，让 NSTouchBar 使用默认实现
  if ([identifier isEqualToString:NSTouchBarItemIdentifierFixedSpaceSmall] ||
      [identifier isEqualToString:NSTouchBarItemIdentifierFixedSpaceLarge] ||
      [identifier isEqualToString:NSTouchBarItemIdentifierFlexibleSpace]) {
    return nil;
  }
  NSTouchBarItem* item = _itemsByIdentifier[identifier];
  return item;
}

- (void)installOnWindow {
  NSWindow* window = [NSApp keyWindow];
  if (!window) {
    for (NSWindow* w in [NSApp windows]) {
      if (w.isVisible) {
        window = w;
        break;
      }
    }
  }
  if (window) {
    window.touchBar = _touchBar;
  }
}

- (void)installOnWindowWithView:(NSView*)view {
  NSWindow* window = [view window];
  if (window) {
    window.touchBar = _touchBar;
  } else {
    [self installOnWindow];
  }
}

- (void)updateLyricWithText:(NSString*)text
                      words:(NSArray<NSDictionary*>*)words
                  lineStartMs:(double)lineStart
                    lineEndMs:(double)lineEnd
               hasWordTiming:(BOOL)hasTiming
                  lyricWidth:(CGFloat)width
                     offset:(double)offsetMs {
  [_lyricView updateLyricWithText:text words:words lineStartMs:lineStart
                        lineEndMs:lineEnd hasWordTiming:hasTiming
                       lyricWidth:width offset:offsetMs];
}

- (void)setPlaying:(BOOL)playing progress:(double)progress {
  [_lyricView setPlaying:playing progress:progress];
  
  // 更新播放按钮图标
  if (_playButton) {
    NSString *iconName = playing ? @"pause.fill" : @"play.fill";
    if (@available(macOS 11.0, *)) {
      NSImage *image = [NSImage imageWithSystemSymbolName:iconName accessibilityDescription:nil];
      NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration configurationWithScale:NSImageSymbolScaleMedium];
      _playButton.image = [image imageWithSymbolConfiguration:config];
    }
  }
}

- (void)setPlaybackRate:(double)rate {
  [_lyricView setPlaybackRate:rate];
}

- (void)setLikeState:(BOOL)liked {
  if (_likeButton) {
    NSString *iconName = liked ? @"heart.fill" : @"heart"; // 实心 vs 空心
    if (@available(macOS 11.0, *)) {
      NSImage *image = [NSImage imageWithSystemSymbolName:iconName accessibilityDescription:nil];
      NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration configurationWithScale:NSImageSymbolScaleMedium];
      _likeButton.image = [image imageWithSymbolConfiguration:config];
    }
  }
}

- (void)setFMMode:(BOOL)isFM {
  _isFMMode = isFM;
  if (_prevButton) {
    NSString *iconName = isFM ? @"hand.thumbsdown.fill" : @"backward.fill";
    if (@available(macOS 11.0, *)) {
      NSImage *image = [NSImage imageWithSystemSymbolName:iconName accessibilityDescription:nil];
      NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration configurationWithScale:NSImageSymbolScaleMedium];
      _prevButton.image = [image imageWithSymbolConfiguration:config];
    }
  }
}

- (void)setWordByWord:(BOOL)wBYw {
  [_lyricView setWordByWord:wBYw];
}

- (void)setPlayedColor:(NSColor*)color {
  [_lyricView setPlayedColor:color];
}

- (void)setPlayedColorLight:(NSColor*)color {
  [_lyricView setPlayedColorLight:color];
}

@end
