#import "tray_view.h"

// ================ 颜色辅助 ================
static NSColor* UnplayedColor(NSView* view) {
  BOOL isDark = [view.effectiveAppearance
      bestMatchFromAppearancesWithNames:@[NSAppearanceNameDarkAqua, NSAppearanceNameAqua]] == NSAppearanceNameDarkAqua;
  return isDark ? [NSColor colorWithWhite:1 alpha:1] : [NSColor colorWithWhite:0.2 alpha:1];
}

// ================ 测量字符宽度 ================
static CGFloat MeasureWord(NSString* word, NSFont* font) {
  return [word sizeWithAttributes:@{NSFontAttributeName: font}].width;
}

static NSArray<NSNumber*>* MeasureWords(NSArray<NSString*>* words, NSFont* font) {
  NSMutableArray* result = [NSMutableArray arrayWithCapacity:words.count];
  for (NSString* w in words) {
    [result addObject:@(MeasureWord(w, font))];
  }
  return result;
}

static CGFloat TotalWidth(NSArray<NSNumber*>* widths) {
  __block CGFloat sum = 0;
  [widths enumerateObjectsUsingBlock:^(NSNumber* n, NSUInteger idx, BOOL* stop) {
    sum += n.doubleValue;
  }];
  return sum;
}

// ================ 按钮路径 ================
static CGPathRef MakeButtonPath(NSInteger type, CGFloat size, CGFloat height) {
  CGFloat cx = size / 2, cy = height / 2;
  CGMutablePathRef path = CGPathCreateMutable();
  switch (type) {
    case 0: { // prev: ◁◁
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
    case 1: { // play: ▶
      CGFloat sz = 6;
      CGPathMoveToPoint(path, NULL, cx - 2, cy - sz);
      CGPathAddLineToPoint(path, NULL, cx - 2, cy + sz);
      CGPathAddLineToPoint(path, NULL, cx - 2 + sz * 0.85, cy);
      CGPathCloseSubpath(path);
      break;
    }
    case 2: { // next: ▷▷
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
    case 3: { // like: ♥
      CGPathMoveToPoint(path, NULL, cx, cy + 5);
      CGPathAddCurveToPoint(path, NULL, cx + 5, cy + 1, cx + 7, cy - 3, cx, cy - 1);
      CGPathAddCurveToPoint(path, NULL, cx - 7, cy - 3, cx - 5, cy + 1, cx, cy + 5);
      CGPathCloseSubpath(path);
      break;
    }
    case 4: { // thumbsDown: 👎
      CGFloat sz = 5;
      // 手背
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

static CGPathRef MakePausePath(CGFloat width, CGFloat height) {
  CGFloat cx = width / 2, cy = height / 2;
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathAddRoundedRect(path, NULL, CGRectMake(cx - 7, cy - 5, 4, 10), 1, 1);
  CGPathAddRoundedRect(path, NULL, CGRectMake(cx + 3, cy - 5, 4, 10), 1, 1);
  return path;
}

// ================ 常量 ================
static const CGFloat kIconSize = 18;
static const CGFloat kIconPadding = 4;
static const CGFloat kButtonSize = 24;
static const CGFloat kButtonGroupPadding = 4;
static const CGFloat kViewHeight = 22;
static const CGFloat kDefaultFontSize = 14;

@interface NativeTrayView () {
  NSFont* _font;
  CGFloat _iconSize;
  CGFloat _buttonWidth;
  BOOL _showLyric;
  BOOL _showIcon;

  // 歌词动画参数
  double _playbackRate;
  BOOL _hasWordTiming;
}

@property (nonatomic, strong) NSArray<CAShapeLayer*>* buttonLayers;
@end

@implementation NativeTrayView

- (instancetype)initWithStatusItem:(NSStatusItem*)item
                          iconSize:(CGFloat)iconSize
                    lyricAreaWidth:(CGFloat)lyricWidth
                       buttonWidth:(CGFloat)btnWidth {
  NSRect frame = NSMakeRect(0, 0, 10, kViewHeight);
  self = [super initWithFrame:frame];
  if (!self) return nil;

  _statusItem = item;
  _iconSize = iconSize > 0 ? iconSize : kIconSize;
  _lyricAreaWidth = lyricWidth > 0 ? lyricWidth : 180;
  _buttonWidth = btnWidth > 0 ? btnWidth : kButtonSize;
  _font = [NSFont systemFontOfSize:kDefaultFontSize];
  _playbackRate = 1.0;
  _isPlaying = NO;
  _showLyric = YES;
  _showButtons = YES;
  _showIcon = YES;
  _hasWordTiming = YES;

  self.wantsLayer = YES;
  self.layer.masksToBounds = YES;

  _iconLayer = [CALayer layer];
  _iconLayer.contentsGravity = kCAGravityResizeAspect;
  [self.layer addSublayer:_iconLayer];

  _clipLayer = [CALayer layer];
  _clipLayer.backgroundColor = NSColor.clearColor.CGColor;
  _clipLayer.masksToBounds = YES;
  [self.layer addSublayer:_clipLayer];

  _baseText = [CATextLayer layer];
  _baseText.contentsScale = NSScreen.mainScreen.backingScaleFactor;
  [_clipLayer addSublayer:_baseText];

  _highlightText = [CATextLayer layer];
  _highlightText.contentsScale = _baseText.contentsScale;
  [_clipLayer addSublayer:_highlightText];

  _maskLayer = [CALayer layer];
  _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
  _maskLayer.anchorPoint = CGPointMake(0, 0.5);
  _highlightText.mask = _maskLayer;

  [self layoutSubviews];
  [self updateColors];

  // 设置默认歌词文本，启动后立即可见
  CGFloat textH = _font.ascender - _font.descender;
  CGFloat textY = (kViewHeight - textH) / 2 - 2;
  NSString *defaultText = @"听你想听的音乐";
  CGFloat defaultTextWidth = [defaultText sizeWithAttributes:@{NSFontAttributeName: _font}].width;

  NSColor *unplayed = UnplayedColor(self);
  NSDictionary *baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
  _baseText.string = [[NSAttributedString alloc] initWithString:defaultText attributes:baseAttrs];
  _baseText.frame = CGRectMake(0, textY, defaultTextWidth, 20);

  NSColor *playedColor = [NSColor yellowColor];
  NSDictionary *playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: playedColor};
  _highlightText.string = [[NSAttributedString alloc] initWithString:defaultText attributes:playedAttrs];
  _highlightText.frame = _baseText.frame;

  // 初始 mask 全宽，显示完整高亮
  _maskLayer.frame = CGRectMake(0, 0, defaultTextWidth, 20);

  // 延迟到下一个 runloop 创建按钮，确保 NSStatusBarButton 已完成初始布局
  dispatch_async(dispatch_get_main_queue(), ^{
    [self ensureButtonsCreated];
  });

  return self;
}

// MARK: - 布局
- (void)layoutSubviews {
  CGFloat x = 4;

  // 歌词（最左边）
  if (_showLyric) {
    _clipLayer.hidden = NO;
    _clipLayer.frame = CGRectMake(x, 0, _lyricAreaWidth, kViewHeight);
    x += _lyricAreaWidth + kButtonGroupPadding;
  } else {
    _clipLayer.hidden = YES;
  }

  // 按钮（中间）
  if (_showButtons) {
    for (NSInteger i = 0; i < 4; i++) {
      if (!_buttonContainer[i]) continue;
      CGRect btnFrame = CGRectMake(x + i * _buttonWidth, 0, _buttonWidth, kViewHeight);
      _buttonContainer[i].frame = btnFrame;
      _buttonContainer[i].hidden = (i == 1) ? _isPlaying : NO;

      if ([_buttonContainer[i] isKindOfClass:[CAShapeLayer class]]) {
        CAShapeLayer* shape = (CAShapeLayer*)_buttonContainer[i];
        shape.path = MakeButtonPath(i, _buttonWidth, kViewHeight);
      }
    }
    _pauseLayer.frame = CGRectMake(x + 1 * _buttonWidth, 0, _buttonWidth, kViewHeight);
    _pauseLayer.hidden = !_isPlaying;  // 播放时显示暂停
    _pauseLayer.path = MakePausePath(_buttonWidth, kViewHeight);
    x += 4 * _buttonWidth + kIconPadding;
  } else {
    // 隐藏所有按钮和暂停层
    for (NSInteger i = 0; i < 4; i++) {
      if (_buttonContainer[i]) _buttonContainer[i].hidden = YES;
    }
    _pauseLayer.hidden = YES;
  }

  // 图标（最右边）
  if (_showIcon) {
    _iconLayer.hidden = NO;
    _iconLayer.frame = CGRectMake(x, (kViewHeight - _iconSize) / 2, _iconSize, _iconSize);
    x += _iconSize;
  } else {
    _iconLayer.hidden = YES;
  }

  CGFloat totalWidth = x + 4;
  _statusItem.length = totalWidth;
  _statusItem.button.needsLayout = YES;
  self.frame = NSMakeRect(0, 0, totalWidth, kViewHeight);
}

- (NSSize)intrinsicContentSize {
  return NSMakeSize(_statusItem.length, kViewHeight);
}

// MARK: - 首次创建按钮
- (void)ensureButtonsCreated {
  if (_buttonContainer[0]) return;

  CGColorRef color = UnplayedColor(self).CGColor;
  for (NSInteger i = 0; i < 4; i++) {
    CAShapeLayer* layer = [CAShapeLayer layer];
    layer.fillColor = color;
    layer.strokeColor = nil;
    [self.layer addSublayer:layer];
    _buttonContainer[i] = layer;
  }
  _buttonLayers = @[(CAShapeLayer*)_buttonContainer[0],
                    (CAShapeLayer*)_buttonContainer[1],
                    (CAShapeLayer*)_buttonContainer[2],
                    (CAShapeLayer*)_buttonContainer[3]];

  CAShapeLayer* pause = [CAShapeLayer layer];
  pause.fillColor = color;
  pause.strokeColor = nil;
  [self.layer addSublayer:pause];
  _pauseLayer = pause;

  _buttonContainer[1].hidden = YES;  // 初始播放中，隐藏 play
  [self layoutSubviews];
}

// MARK: - 对外接口：图标
- (void)setIconImage:(NSImage*)image {
  _iconLayer.contents = image;
}

// MARK: - 对外接口：歌词更新
- (void)updateLyricWithText:(NSString*)text
                      words:(NSArray<NSDictionary*>*)words
                  lineStartMs:(double)lineStart
                    lineEndMs:(double)lineEnd
               hasWordTiming:(BOOL)hasTiming
                  lyricWidth:(CGFloat)width
                     offset:(double)offsetMs {
  NSLog(@"[Tray] updateLyricWithText called, offsetMs=%f, isPlaying=%d", offsetMs, _isPlaying);
  _hasWordTiming = hasTiming;
  if (width > 0 && width != _lyricAreaWidth) {
    _lyricAreaWidth = width;
    [self layoutSubviews];
  }

  [self ensureButtonsCreated];

  // 测量
  NSMutableArray<NSString*>* wordStrings = [NSMutableArray array];
  for (NSDictionary* w in words) {
    [wordStrings addObject:w[@"word"] ?: @""];
  }
  NSArray<NSNumber*>* spanWidths = MeasureWords(wordStrings, _font);
  CGFloat totalTextWidth = TotalWidth(spanWidths);
  double lineDurationMs = lineEnd - lineStart;

  // ── 2.1 零时长行（fallback 文本）→ 仅显示静态文字，跳过动画 ──
  if (lineDurationMs <= 0) {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [_baseText removeAllAnimations];
    [_highlightText removeAllAnimations];
    [_maskLayer removeAllAnimations];

    CGFloat textH = _font.ascender - _font.descender;
    CGFloat yPos = (kViewHeight - textH) / 2 - 2;
    CGFloat tX = (totalTextWidth <= _lyricAreaWidth) ? (_lyricAreaWidth - totalTextWidth) / 2 : 0;

    NSColor* unplayed = UnplayedColor(self);
    NSDictionary* baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
    NSColor* playedColor = [NSColor yellowColor];
    NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: playedColor};
    _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:baseAttrs];
    _baseText.frame = CGRectMake(tX, yPos, totalTextWidth, 20);
    _baseText.position = CGPointMake(tX + totalTextWidth / 2, yPos + 10);
    _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
    _highlightText.frame = _baseText.frame;
    _highlightText.position = _baseText.position;

    _highlightText.mask = nil;
    _maskLayer = [CALayer layer];
    _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
    _maskLayer.frame = CGRectMake(0, 0, totalTextWidth, 20);
    _highlightText.mask = _maskLayer;
    [CATransaction commit];
    [CATransaction flush];
    return;
  }

  // 垂直居中
  CGFloat textHeight = _font.ascender - _font.descender;
  CGFloat y = (kViewHeight - textHeight) / 2 - 2;

  // 累计宽度
  NSMutableArray<NSNumber*>* cumBefore = [NSMutableArray arrayWithCapacity:words.count];
  __block CGFloat acc = 0;
  for (NSNumber* w in spanWidths) {
    [cumBefore addObject:@(acc)];
    acc += w.doubleValue;
  }

  // 文本图层
  NSColor* unplayed = UnplayedColor(self);
  NSDictionary* baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
  NSColor* playedColor = [NSColor yellowColor];
  if (!hasTiming) playedColor = unplayed;
  NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: playedColor};

  // 清除旧动画——在 CATransaction 中禁用隐式动画，
  // 确保 model layer 立刻回到初始值，不被 fillMode: forwards 污染
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  [_baseText removeAllAnimations];
  [_highlightText removeAllAnimations];
  [_maskLayer removeAllAnimations];
  _baseText.timeOffset = 0; _baseText.beginTime = 0;
  _baseText.speed = 1;
  _highlightText.timeOffset = 0; _highlightText.beginTime = 0;
  _highlightText.speed = 1;
  _maskLayer.timeOffset = 0; _maskLayer.beginTime = 0;
  _maskLayer.speed = 1;

  // 短歌词居中，长歌词左对齐
  CGFloat textX = (totalTextWidth <= _lyricAreaWidth) ? (_lyricAreaWidth - totalTextWidth) / 2 : 0;

  _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:baseAttrs];
  _baseText.frame = CGRectMake(textX, y, totalTextWidth, 20);
  // 显式重置 position，防止上一行 scroll 动画 fillMode:forwards 残留
  _baseText.position = CGPointMake(textX + totalTextWidth / 2, y + 10);

  _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
  _highlightText.frame = _baseText.frame;
  _highlightText.position = _baseText.position;

  // 重建 mask layer，彻底清除上次动画的残留状态
  _highlightText.mask = nil;
  _maskLayer = [CALayer layer];
  _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
  _maskLayer.anchorPoint = CGPointMake(0, 0.5);
  _maskLayer.frame = CGRectMake(0, 0, 0, kViewHeight);
  _maskLayer.position = CGPointMake(0, kViewHeight / 2);
  _highlightText.mask = _maskLayer;
  [CATransaction commit];
  [CATransaction flush];

  // ====== 逐字高亮动画 ======
  if (hasTiming && words.count > 0) {
    NSMutableArray* hKeyTimes = [NSMutableArray array];
    NSMutableArray* hValues = [NSMutableArray array];
    for (NSUInteger i = 0; i < words.count; i++) {
      double start = [words[i][@"start"] doubleValue];
      double offset = MAX(MIN((start - lineStart) / lineDurationMs, 1), 0);
      if (hKeyTimes.count > 0 && offset < [hKeyTimes.lastObject doubleValue]) {
        offset = [hKeyTimes.lastObject doubleValue];
      }
      [hKeyTimes addObject:@(offset)];
      [hValues addObject:@([cumBefore[i] doubleValue])];
    }
    [hKeyTimes addObject:@1.0];
    [hValues addObject:@(totalTextWidth)];

    CAKeyframeAnimation* anim = [CAKeyframeAnimation animationWithKeyPath:@"bounds.size.width"];
    anim.keyTimes = hKeyTimes;
    anim.values = hValues;
    anim.calculationMode = kCAAnimationLinear;
    anim.duration = lineDurationMs / 1000.0;
    anim.removedOnCompletion = NO;
    anim.fillMode = kCAFillModeForwards;
    // ── 2.4 将 offsetMs 限制在 [0, lineDurationMs] 内 ──
    double clampedOffset = MAX(0, MIN(offsetMs, lineDurationMs));
    CFTimeInterval now = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
    // beginTime 须在 layer 本地时间空间：layer.speed = _playbackRate 时本地时间 = 父时间 × rate
    anim.beginTime = now * _playbackRate - (clampedOffset / 1000.0);
    _maskLayer.speed = _playbackRate;
    [_maskLayer addAnimation:anim forKey:@"lyricProgress"];
  } else {
    // 无 timing → mask 全宽，不做高亮动画
    _maskLayer.frame = CGRectMake(0, 0, totalTextWidth, 20);
  }

  // ====== 滚动动画 ======
  if (totalTextWidth > _lyricAreaWidth) {
    CGFloat scrollWidth = totalTextWidth - _lyricAreaWidth;
    CGFloat startX = totalTextWidth / 2;

    NSMutableArray* sKeyTimes = [NSMutableArray array];
    NSMutableArray* sValues = [NSMutableArray array];

    if (hasTiming) {
      [sKeyTimes addObject:@0];
      [sValues addObject:@(startX)];

      __block CGFloat curWidth = 0;
      for (NSUInteger i = 0; i < words.count; i++) {
        curWidth += spanWidths[i].doubleValue;
        if (curWidth <= _lyricAreaWidth / 2) continue;

        CGFloat sWidth = MIN(curWidth - _lyricAreaWidth / 2, scrollWidth);
        double end = [words[i][@"end"] doubleValue];
        double offset = MAX(MIN((end - lineStart) / lineDurationMs, 1), 0);
        if (sKeyTimes.count > 0 && offset < [sKeyTimes.lastObject doubleValue]) {
          offset = [sKeyTimes.lastObject doubleValue];
        }
        [sKeyTimes addObject:@(offset)];
        [sValues addObject:@(startX - sWidth)];

        if (curWidth - _lyricAreaWidth / 2 > scrollWidth) break;
      }
      [sKeyTimes addObject:@1.0];
      [sValues addObject:@(startX - scrollWidth)];
    } else {
      // 非逐字：前 1/2 不滚，中间匀速滚完，末尾停住
      CGFloat p1 = (_lyricAreaWidth / 2) / totalTextWidth;
      CGFloat p2 = scrollWidth / totalTextWidth;
      sKeyTimes = [@[@0, @(p1), @(p1 + p2), @1] mutableCopy];
      sValues = [@[@(startX), @(startX), @(startX - scrollWidth), @(startX - scrollWidth)] mutableCopy];
    }

    CAKeyframeAnimation* scrollAnim = [CAKeyframeAnimation animationWithKeyPath:@"position.x"];
    scrollAnim.keyTimes = sKeyTimes;
    scrollAnim.values = sValues;
    scrollAnim.calculationMode = kCAAnimationLinear;
    scrollAnim.duration = lineDurationMs / 1000.0;
    scrollAnim.removedOnCompletion = NO;
    scrollAnim.fillMode = kCAFillModeForwards;

    // ── 2.4 将 offsetMs 限制在 [0, lineDurationMs] 内 ──
    double clampedOffset = MAX(0, MIN(offsetMs, lineDurationMs));
    CFTimeInterval now = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
    // beginTime 须在 layer 本地时间空间：layer.speed = _playbackRate 时本地时间 = 父时间 × rate
    scrollAnim.beginTime = now * _playbackRate - (clampedOffset / 1000.0);
    _baseText.speed = _playbackRate;
    _highlightText.speed = _playbackRate;
    [_baseText addAnimation:scrollAnim forKey:@"scroll"];
    [_highlightText addAnimation:scrollAnim forKey:@"scroll"];
    // mask 在 _highlightText 本地坐标中，自动跟随文字滚动，无需单独动画
  }

  // 新歌词动画创建后，仅在暂停时冻结动画（播放时动画已通过 beginTime + speed 正确配置）
  if (!_isPlaying) {
    [self setAnimationsPaused:YES];
  }
}

// MARK: - 播放/暂停
- (void)setPlaying:(BOOL)playing {
  _isPlaying = playing;
  [self setAnimationsPaused:!playing];
  _buttonContainer[1].hidden = playing;  // 播放时隐藏 play
  _pauseLayer.hidden = !playing;         // 播放时显示 pause
}

- (void)setAnimationsPaused:(BOOL)paused {
  NSArray* layers = @[_baseText, _highlightText, _maskLayer];
  if (paused) {
    for (CALayer* layer in layers) {
      // 逐层转换，确保每层的 timeOffset 在其自身的本地时间空间中
      CFTimeInterval pausedTime = [layer convertTime:CACurrentMediaTime() fromLayer:nil];
      layer.speed = 0;
      layer.timeOffset = pausedTime;
    }
  } else {
    CFTimeInterval refNow = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
    for (CALayer* layer in layers) {
      CFTimeInterval pausedTime = layer.timeOffset;
      layer.speed = _playbackRate;
      layer.timeOffset = 0;
      layer.beginTime = 0;
      // 层本地时间 = (父时间 - beginTime) × speed，需要 pausedTime → 解得 beginTime
      layer.beginTime = refNow - pausedTime / _playbackRate;
    }
  }
}

// MARK: - 倍率
- (void)setPlaybackRate:(double)rate {
  _playbackRate = rate;
  if (!_isPlaying) return;
  NSArray* layers = @[_baseText, _highlightText, _maskLayer];
  CFTimeInterval refNow = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
  for (CALayer* layer in layers) {
    CFTimeInterval currentLayerTime = (refNow - layer.beginTime) * layer.speed;
    layer.speed = rate;
    layer.beginTime = refNow - currentLayerTime / rate;
  }
}

// MARK: - 喜欢状态
- (void)setLikeState:(BOOL)liked {
  _isLiked = liked;
  [self updateLikeButtonAppearance];
}

- (void)updateLikeButtonAppearance {
  NSColor* color = UnplayedColor(self);
  CAShapeLayer* likeBtn = _buttonContainer[3];
  if (!likeBtn) return;
  if (_isLiked) {
    likeBtn.fillColor = color.CGColor;
    likeBtn.strokeColor = nil;
  } else {
    likeBtn.fillColor = [NSColor clearColor].CGColor;
    likeBtn.strokeColor = color.CGColor;
    likeBtn.lineWidth = 1.2;
  }
}

// MARK: - 按钮类型
- (void)setButtonType:(NSInteger)index type:(NSInteger)type {
  if (index < 0 || index > 3 || !_buttonContainer[index]) return;
  CAShapeLayer* btn = _buttonContainer[index];
  btn.path = MakeButtonPath(type, _buttonWidth, kViewHeight);
  [self layoutSubviews];
}

// MARK: - 宽度
- (void)setWidth:(CGFloat)width {
  if (width <= 0 || width == _lyricAreaWidth) return;
  _lyricAreaWidth = width;
  [self layoutSubviews];
}

// MARK: - 显隐控制
- (void)setLyricVisibility:(BOOL)show {
  _showLyric = show;
  [self layoutSubviews];
}

- (void)setButtonVisibility:(BOOL)show {
  _showButtons = show;
  [self layoutSubviews];
}

- (void)setIconVisibility:(BOOL)show {
  _showIcon = show;
  [self layoutSubviews];
}

// MARK: - 颜色刷新
- (void)updateColors {
  NSColor* color = UnplayedColor(self);
  CGColorRef cg = color.CGColor;
  for (CAShapeLayer* layer in self.buttonLayers) {
    layer.fillColor = cg;
  }
  _pauseLayer.fillColor = cg;

  // 重建文字层颜色
  [self updateLikeButtonAppearance];

  if (_baseText.string) {
    NSString* text = [(NSAttributedString*)_baseText.string string];
    NSDictionary* attrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: color};
    _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:attrs];
  }
}

- (void)viewDidChangeEffectiveAppearance {
  [self updateColors];
}

// MARK: - 鼠标事件
- (void)handleClickWithEvent:(NSEvent*)event {
  NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];

  if (_showButtons) {
    CGFloat bx = 4 + (_showLyric ? _lyricAreaWidth + kButtonGroupPadding : 0);
    for (NSInteger i = 0; i < 4; i++) {
      CGRect btnRect = CGRectMake(bx + i * _buttonWidth, 0, _buttonWidth, kViewHeight);
      if (CGRectContainsPoint(btnRect, point)) {
        if (self.onButtonClick) self.onButtonClick(i);
        return;
      }
    }
  }

  if (self.onTrayClick) self.onTrayClick();
}

- (void)handleButtonClick:(id)sender {
  [self handleClickWithEvent:[NSApp currentEvent]];
}

- (NSView *)hitTest:(NSPoint)point {
  if ([self mouse:point inRect:self.bounds]) {
    return self;
  }
  return [super hitTest:point];
}

- (BOOL)acceptsFirstMouse:(NSEvent*)event {
  return YES;
}

- (void)mouseDown:(NSEvent*)event {
  [self handleClickWithEvent:event];
}

- (void)rightMouseDown:(NSEvent*)event {
  if (self.onRightClick) self.onRightClick();
}

@end
