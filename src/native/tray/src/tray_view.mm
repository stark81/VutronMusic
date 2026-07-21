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

// ================ SVG Path 解析器 ================
// 解析 SVG path d 属性中的数字（支持整数、浮点、科学计数法）
static CGFloat ParseSVGNumber(const char** p) {
  const char* s = *p;
  // 跳过前导空白和逗号
  while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r' || *s == ',') s++;
  // 可选正负号
  BOOL negative = NO;
  if (*s == '-') { negative = YES; s++; }
  else if (*s == '+') { s++; }

  // 整数部分
  CGFloat value = 0;
  BOOL hasDigits = NO;
  while (*s >= '0' && *s <= '9') {
    value = value * 10 + (*s - '0');
    s++;
    hasDigits = YES;
  }
  // 小数部分
  if (*s == '.') {
    s++;
    CGFloat fraction = 0.1;
    while (*s >= '0' && *s <= '9') {
      value += (*s - '0') * fraction;
      fraction *= 0.1;
      s++;
      hasDigits = YES;
    }
  }
  if (!hasDigits) {
    // 回退，没有数字可解析
    *p = *p;  // 保持不变
    return 0;
  }
  // 科学计数法（简化处理，支持常见格式）
  if (*s == 'e' || *s == 'E') {
    s++;
    BOOL expNeg = NO;
    if (*s == '-') { expNeg = YES; s++; }
    else if (*s == '+') { s++; }
    int exp = 0;
    while (*s >= '0' && *s <= '9') {
      exp = exp * 10 + (*s - '0');
      s++;
    }
    CGFloat factor = 1;
    for (int i = 0; i < exp; i++) factor *= 10;
    value = expNeg ? value / factor : value * factor;
  }
  *p = s;
  return negative ? -value : value;
}

// 从 SVG path d 属性字符串解析为 CGPath
// 支持命令: M/m, L/l, C/c, Z/z（覆盖项目中所有 SVG 文件的需求）
static CGPathRef CreateCGPathFromSVG(const char* d) {
  CGMutablePathRef path = CGPathCreateMutable();
  const char* p = d;
  char lastCmd = 0;
  CGFloat cx = 0, cy = 0;  // 当前点（用于相对坐标）
  CGFloat sx = 0, sy = 0;  // 子路径起点（用于 Z 回到起点）

  while (*p) {
    // 跳过空白
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
    if (!*p) break;

    // 解析命令字符
    char cmd = *p;
    if ((cmd >= 'A' && cmd <= 'Z') || (cmd >= 'a' && cmd <= 'z')) {
      lastCmd = cmd;
      p++;
    } else {
      // 隐式重复上一个命令（仅对 L/C 有效）
      cmd = lastCmd;
    }

    switch (cmd) {
      case 'M': {
        CGFloat x = ParseSVGNumber(&p);
        CGFloat y = ParseSVGNumber(&p);
        CGPathMoveToPoint(path, NULL, x, y);
        cx = x; cy = y;
        sx = x; sy = y;
        lastCmd = 'L';  // M 后续隐式 L
        break;
      }
      case 'm': {
        CGFloat dx = ParseSVGNumber(&p);
        CGFloat dy = ParseSVGNumber(&p);
        cx += dx; cy += dy;
        CGPathMoveToPoint(path, NULL, cx, cy);
        sx = cx; sy = cy;
        lastCmd = 'l';
        break;
      }
      case 'L': {
        CGFloat x = ParseSVGNumber(&p);
        CGFloat y = ParseSVGNumber(&p);
        CGPathAddLineToPoint(path, NULL, x, y);
        cx = x; cy = y;
        break;
      }
      case 'l': {
        CGFloat dx = ParseSVGNumber(&p);
        CGFloat dy = ParseSVGNumber(&p);
        cx += dx; cy += dy;
        CGPathAddLineToPoint(path, NULL, cx, cy);
        break;
      }
      case 'C': {
        CGFloat x1 = ParseSVGNumber(&p), y1 = ParseSVGNumber(&p);
        CGFloat x2 = ParseSVGNumber(&p), y2 = ParseSVGNumber(&p);
        CGFloat x = ParseSVGNumber(&p), y = ParseSVGNumber(&p);
        CGPathAddCurveToPoint(path, NULL, x1, y1, x2, y2, x, y);
        cx = x; cy = y;
        break;
      }
      case 'c': {
        CGFloat dx1 = ParseSVGNumber(&p), dy1 = ParseSVGNumber(&p);
        CGFloat dx2 = ParseSVGNumber(&p), dy2 = ParseSVGNumber(&p);
        CGFloat dx = ParseSVGNumber(&p), dy = ParseSVGNumber(&p);
        CGPathAddCurveToPoint(path, NULL,
                              cx + dx1, cy + dy1,
                              cx + dx2, cy + dy2,
                              cx + dx, cy + dy);
        cx += dx; cy += dy;
        break;
      }
      case 'Z': case 'z':
        CGPathCloseSubpath(path);
        cx = sx; cy = sy;
        break;
      default:
        // 未知命令，跳过
        p++;
        break;
    }
  }
  return path;
}

// ================ SVG 图标路径数据（来自 src/native/tray/src/icons/） ================

static const char* kSVGPathSkipPrevious = "M6.1,11 L22,0 L22,22 Z M0,0 L2.1,0 L2.1,22 L0,22 Z";
static const char* kSVGPathPlayArrow = "M19,12 L0,0 L0,24 Z";
static const char* kSVGPathSkipNext = "M19,22 L19,0 L22,0 L22,22 Z M0,0 L15,11 L0,22 Z";
static const char* kSVGPathPause = "M15,24 L15,0 L22,0 L22,24 Z M0,0 L6.1,0 L6.1,24 L0,24 Z";
static const char* kSVGPathHeart =
    "M15,26c-0.21,0-0.42-0.066-0.597-0.198C13.938,25.456,3,17.243,3,11"
    "c0-3.859,3.141-7,7-7c2.358,0,4.062,1.272,5,2.212C15.938,5.272,17.642,4,20,4"
    "c3.859,0,7,3.14,7,7c0,6.243-10.938,14.456-11.403,14.803C15.42,25.934,15.21,26,15,26z";

static const char* kSVGPathThumbsDown = "M312,512c-20.183,0-29.485-39.293-33.931-57.795-5.206-21.666-10.589-44.07-25.393-58.902-32.469-32.524-49.503-73.967-89.117-113.111a11.98,11.98,0,0,1-3.558-8.521V59.901c0-6.541,5.243-11.878,11.783-11.998,15.831-.29,36.694-9.079,52.651-16.178C256.189,17.598,295.709.017,343.995,0h2.844c42.777,0,93.363.413,113.774,29.737,8.392,12.057,10.446,27.034,6.148,44.632,16.312,17.053,25.063,48.863,16.382,74.757,17.544,23.432,19.143,56.132,9.308,79.469l.11.11c11.893,11.949,19.523,31.259,19.439,49.197-.156,30.352-26.157,58.098-59.553,58.098H350.723C358.03,364.34,384,388.132,384,430.548,384,504,336,512,312,512z";

// ================ 按钮路径（SVG 版本） ================
// 基于路径实际 bounds（而非 viewBox）计算缩放和居中，确保图标大小一致且不溢出
static CGPathRef MakeScaledSVGPath(const char* svgD, CGFloat size, CGFloat height, CGFloat scaleAdjust = 1.0, BOOL flipX = NO) {
  CGPathRef rawPath = CreateCGPathFromSVG(svgD);
  if (!rawPath) return CGPathCreateMutable();

  CGRect bounds = CGPathGetPathBoundingBox(rawPath);
  CGFloat pathW = bounds.size.width;
  CGFloat pathH = bounds.size.height;
  if (pathW <= 0 || pathH <= 0) {
    CGPathRelease(rawPath);
    return CGPathCreateMutable();
  }

  // 新增：内边距系数，让 SVG 图标比 SF Symbol 略小一档，视觉对齐
  CGFloat paddingFactor = 0.72;
  CGFloat targetW = size * paddingFactor * scaleAdjust;
  CGFloat targetH = height * paddingFactor * scaleAdjust;

  CGFloat s = MIN(targetW / pathW, targetH / pathH);
  CGFloat offsetX = (size - pathW * s) / 2.0 - bounds.origin.x * s;
  CGFloat centerY = bounds.origin.y + pathH / 2.0;
  CGFloat t_y = height / 2.0 + s * centerY;

  CGFloat sx = flipX ? -s : s;
  CGFloat tx = flipX ? (size - offsetX) : offsetX;
  CGAffineTransform t = CGAffineTransformMake(sx, 0, 0, -s, tx, t_y);
  CGPathRef result = CGPathCreateCopyByTransformingPath(rawPath, &t);
  CGPathRelease(rawPath);
  return result;
}

static CGPathRef MakeButtonPath(NSInteger type, CGFloat size, CGFloat height) {
  const char* svgD = NULL;
  CGFloat scaleAdjust = 1.0;
  BOOL flipX = NO;
  switch (type) {
    case 0: svgD = kSVGPathSkipPrevious; break;
    case 1: svgD = kSVGPathPlayArrow;   break;
    case 2: svgD = kSVGPathSkipNext;     break;
    case 3: svgD = kSVGPathHeart; break;
    case 4: svgD = kSVGPathThumbsDown; flipX = YES; break;
    default: return CGPathCreateMutable();
  }
  return MakeScaledSVGPath(svgD, size, height, scaleAdjust, flipX);
}

static CGPathRef MakePausePath(CGFloat width, CGFloat height) {
  return MakeScaledSVGPath(kSVGPathPause, width, height);
}

// ================ CGPath 图标渲染 ================
static NSImage* MakePathButtonImage(CGFloat size, CGPathRef path, NSColor* color) {
  CGFloat scale = 2.0;
  NSInteger pixelSize = (NSInteger)(size * scale);

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx = CGBitmapContextCreate(NULL, pixelSize, pixelSize, 8, 0, colorSpace,
                                           kCGImageAlphaPremultipliedLast);
  CGColorSpaceRelease(colorSpace);
  if (!ctx) return nil;

  CGContextScaleCTM(ctx, scale, scale);

  CGContextSetFillColorWithColor(ctx, color.CGColor);
  CGContextAddPath(ctx, path);
  CGContextFillPath(ctx);

  CGImageRef cgImage = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);

  NSSize imageSize = NSMakeSize(size, size);
  NSImage* image = [[NSImage alloc] initWithCGImage:cgImage size:imageSize];
  CGImageRelease(cgImage);
  return image;
}

// CGPath 图标渲染 - 描边版本（用于心形空心状态）
static NSImage* MakePathButtonImageOutline(CGFloat size, CGPathRef path, NSColor* color) {
  CGFloat scale = 2.0;
  NSInteger pixelSize = (NSInteger)(size * scale);

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx = CGBitmapContextCreate(NULL, pixelSize, pixelSize, 8, 0, colorSpace,
                                           kCGImageAlphaPremultipliedLast);
  CGColorSpaceRelease(colorSpace);
  if (!ctx) return nil;

  CGContextScaleCTM(ctx, scale, scale);

  CGContextSetStrokeColorWithColor(ctx, color.CGColor);
  CGContextSetLineWidth(ctx, 1.1);
  CGContextAddPath(ctx, path);
  CGContextStrokePath(ctx);

  CGImageRef cgImage = CGBitmapContextCreateImage(ctx);
  CGContextRelease(ctx);

  NSSize imageSize = NSMakeSize(size, size);
  NSImage* image = [[NSImage alloc] initWithCGImage:cgImage size:imageSize];
  CGImageRelease(cgImage);
  return image;
}

// 创建按钮图标 - 用 CGPath 绘制
static NSImage* MakeButtonImage(NSInteger type, CGFloat size, NSColor* color) {
  CGPathRef path = MakeButtonPath(type, size, size);
  NSImage* image = MakePathButtonImage(size, path, color);
  CGPathRelease(path);
  return image;
}

static NSImage* MakePauseButtonImage(CGFloat size, NSColor* color) {
  CGPathRef path = MakePausePath(size, size);
  NSImage* image = MakePathButtonImage(size, path, color);
  CGPathRelease(path);
  return image;
}

// ================ SF Symbols 图标 ================
// 使用 macOS 11+ 系统符号图标替换自定义 SVG 渲染
static NSString* SFSymbolForButtonType(NSInteger type) {
  switch (type) {
    case 0: return @"skip_previous";
    case 1: return @"play_arrow";
    case 2: return @"skip_next";
    case 3: return @"heart";           // 喜欢/不喜欢通过切换 heart / heart-solid
    case 4: return @"hand.thumbsdown.fill"; // FM 模式
    default: return nil;
  }
}

// 创建 SF Symbols 图标 NSImage，用指定颜色绘制
static NSImage* MakeSFButtonImage(NSString* symbolName, CGFloat size, NSColor* color, BOOL flipX = NO) {
  if (@available(macOS 11.0, *)) {
    NSImage* symbol = [NSImage imageWithSystemSymbolName:symbolName
                                 accessibilityDescription:nil];
    if (!symbol) return nil;

    // 用 SymbolConfiguration 控制点尺寸，保持符号原生宽高比与留白
    NSImageSymbolConfiguration* config =
        [NSImageSymbolConfiguration configurationWithPointSize:size
                                                        weight:NSFontWeightRegular
                                                         scale:NSImageSymbolScaleMedium];
    NSImage* configured = [symbol imageWithSymbolConfiguration:config] ?: symbol;

    // 翻转和上色分开：先翻转（同 touchbar 做法），再上色
    if (flipX) {
      NSSize sz = configured.size;
      NSImage* flipped = [[NSImage alloc] initWithSize:sz];
      [flipped lockFocus];
      NSAffineTransform* transform = [NSAffineTransform transform];
      [transform scaleXBy:-1.0 yBy:1.0];
      [transform concat];
      [configured drawInRect:NSMakeRect(-sz.width, 0, sz.width, sz.height)
                    fromRect:NSZeroRect
                   operation:NSCompositingOperationCopy
                    fraction:1.0];
      [flipped unlockFocus];
      // 不设 template — tray 自定义 tinting 不需要 template flag，
      // 设为 template 会与下方 NSCompositingOperationDestinationIn 产生边框伪影
      configured = flipped;
    }

    // 创建一个指定尺寸的输出画布，把符号居中绘制并上色
    NSImage* tinted = [[NSImage alloc] initWithSize:NSMakeSize(size, size)];
    [tinted lockFocus];
    [NSGraphicsContext currentContext].imageInterpolation = NSImageInterpolationHigh;

    // 先用目标颜色填满，再用符号 alpha 蒙版裁剪（SourceIn 保留交集）
    NSRect fullRect = NSMakeRect(0, 0, size, size);
    [color set];
    NSRectFill(fullRect);

    // 居中绘制符号（保持其自身 size，不再强制拉伸）
    NSSize symSize = configured.size;
    // 若符号比目标大，按比例缩放到 size 内；否则原样居中
    CGFloat maxSide = MAX(symSize.width, symSize.height);
    CGFloat drawScale = (maxSide > size) ? (size / maxSide) : 1.0;
    NSSize drawSize = NSMakeSize(symSize.width * drawScale, symSize.height * drawScale);
    NSRect drawRect = NSMakeRect((size - drawSize.width) / 2.0,
                                 (size - drawSize.height) / 2.0,
                                 drawSize.width, drawSize.height);
    [configured drawInRect:drawRect
                  fromRect:NSZeroRect
                 operation:NSCompositingOperationDestinationIn
                   fraction:1.0];

    [tinted unlockFocus];
    return tinted;
  }
  return nil;
}


// ================ 常量 ================
static const CGFloat kIconSize = 8;
static const CGFloat kIconPadding = 8;
static const CGFloat kButtonSize = 16;
static const CGFloat kButtonSpacing = 6;
static const CGFloat kButtonGroupPadding = 4;
static const CGFloat kViewHeight = 22;
static const CGFloat kDefaultFontSize = 14;

@interface NativeTrayView () {
  NSFont* _font;
  CGFloat _iconSize;
  CGFloat _buttonWidth;

  // 歌词动画参数
  double _playbackRate;
  BOOL _hasWordTiming;
  NSColor* _playedColor;
  NSColor* _playedColorLight;
  double _lastOffsetMs;
  CGFloat _lastTotalTextWidth;

  // 按钮类型追踪（用于 updateColors 还原 FM 模式等覆盖）
  NSInteger _buttonTypes[4];
}

@property (nonatomic, strong) NSArray<CALayer*>* buttonLayers;
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
  _font = [NSFont systemFontOfSize:kDefaultFontSize weight:NSFontWeightMedium];
  _playbackRate = 1.0;
  _isPlaying = NO;
  _showLyric = YES;
  _showButtons = YES;
  _showIcon = YES;
  _wBYw = YES;
  _hasWordTiming = YES;
  for (int i = 0; i < 4; i++) _buttonTypes[i] = i;

  self.wantsLayer = YES;
  self.layer.masksToBounds = YES;

  _iconLayer = [CALayer layer];
  _iconLayer.actions = @{@"contents": NSNull.null, @"hidden": NSNull.null};
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

  // 不设置默认文本和图标，等渲染进程 onMounted 后通过 initTrayState 一起绘制

  // 按钮由渲染进程 onMounted 后通过 updateLyricWithText 创建

  return self;
}

// MARK: - 布局
- (void)layoutSubviews {
  [CATransaction begin];
  [CATransaction setDisableActions:YES];

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
      CGFloat btnH = kViewHeight;  // 保持槽位高度，图标用 contentsGravity 居中
      CGRect btnFrame = CGRectMake(x + i * (_buttonWidth + kButtonSpacing), 0, _buttonWidth, btnH);

      _buttonContainer[i].frame = btnFrame;
      _buttonContainer[i].hidden = (i == 1) ? _isPlaying : NO;
    }
    _pauseLayer.frame = CGRectMake(x + 1 * (_buttonWidth + kButtonSpacing), 0, _buttonWidth, kViewHeight);
    _pauseLayer.hidden = !_isPlaying;
    x += 4 * _buttonWidth + 3 * kButtonSpacing + kIconPadding;
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
  [NSAnimationContext beginGrouping];
  [[NSAnimationContext currentContext] setDuration:0];
  _statusItem.length = totalWidth;
  _statusItem.button.needsLayout = YES;
  self.frame = NSMakeRect(0, 0, totalWidth, kViewHeight);
  [NSAnimationContext endGrouping];

  [CATransaction commit];
}

- (NSSize)intrinsicContentSize {
  return NSMakeSize(_statusItem.length, kViewHeight);
}

// MARK: - 首次创建按钮
- (void)ensureButtonsCreated {
  if (_buttonContainer[0]) return;

  CGFloat screenScale = NSScreen.mainScreen.backingScaleFactor;
  NSColor* color = UnplayedColor(self);
  for (NSInteger i = 0; i < 4; i++) {
    CALayer* layer = [CALayer layer];
    layer.actions = @{@"hidden": NSNull.null, @"contents": NSNull.null};
    layer.contentsScale = screenScale;
    layer.contentsGravity = kCAGravityCenter;
    // 优先使用 SF Symbols，回退到 SVG 渲染
    NSString* sym = SFSymbolForButtonType(i);
    NSImage* img = sym ? MakeSFButtonImage(sym, kIconSize, color) : nil;
    layer.contents = img ?: MakeButtonImage(i, kIconSize, color);
    [self.layer addSublayer:layer];
    _buttonContainer[i] = layer;
  }
  _buttonLayers = @[_buttonContainer[0], _buttonContainer[1],
                    _buttonContainer[2], _buttonContainer[3]];

  CALayer* pause = [CALayer layer];
  pause.actions = @{@"hidden": NSNull.null, @"contents": NSNull.null};
  pause.contentsScale = screenScale;
  pause.contentsGravity = kCAGravityCenter;
  NSImage* pauseImg = MakeSFButtonImage(@"pause", kIconSize, color);
  pause.contents = MakePauseButtonImage(kIconSize, color);
  pause.hidden = YES;
  [self.layer addSublayer:pause];
  _pauseLayer = pause;

  _buttonContainer[1].hidden = YES;
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
  // 无逐字数据时直接测量整段文字宽度
  if (totalTextWidth <= 0 && text.length > 0) {
    totalTextWidth = [text sizeWithAttributes:@{NSFontAttributeName: _font}].width;
    // 补齐 spanWidths 用于后续滚动计算（用一个"整段文字"的宽度填充）
    if (spanWidths.count == 0) {
      spanWidths = @[@(totalTextWidth)];
    }
  }
  double lineDurationMs = lineEnd - lineStart;

  // 计算有效动画时长（匹配 LyricLine.vue buildWordKeyFrame 逻辑）：
  // - 有逐字时间时：首个字 start → 最后一个字 end（裁剪到 line 边界）
  // - 无逐字时间时：回退到 lineStart → lineEnd（行为不变）
  double effectiveStartMs = lineStart;
  double effectiveEndMs = lineEnd;
  if (hasTiming && words.count > 0) {
    double firstWordStart = [words[0][@"start"] doubleValue];
    double lastWordEnd = [words[words.count - 1][@"end"] doubleValue];
    if (firstWordStart > 0) effectiveStartMs = firstWordStart;
    effectiveEndMs = MIN(lastWordEnd, lineEnd);
  }
  double effectiveDurationMs = MAX(effectiveEndMs - effectiveStartMs, 1);

  // ── 2.1 零时长行（fallback 文本）→ 仅显示静态文字，跳过动画 ──
  if (lineDurationMs <= 0) {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [_baseText removeAllAnimations];
    [_highlightText removeAllAnimations];
    [_maskLayer removeAllAnimations];

    CGFloat textH = _font.ascender - _font.descender;
    CGFloat yPos = (kViewHeight - textH) / 2 - 3;
    CGFloat tX = (totalTextWidth <= _lyricAreaWidth) ? (_lyricAreaWidth - totalTextWidth) / 2 : 0;

    NSColor* unplayed = UnplayedColor(self);
    NSDictionary* baseAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: unplayed};
    NSColor* playedColor = [self playedColor];
    if (!hasTiming || !_wBYw) playedColor = unplayed;
    NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: playedColor};
    _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:baseAttrs];
    _baseText.frame = CGRectMake(tX, yPos, totalTextWidth, 20);
    _baseText.position = CGPointMake(tX + totalTextWidth / 2, yPos + 10);
    if (_wBYw) {
      _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
      _highlightText.frame = _baseText.frame;
      _highlightText.position = _baseText.position;
      _highlightText.mask = nil;
      _maskLayer = [CALayer layer];
      _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
      _maskLayer.frame = CGRectMake(0, 0, totalTextWidth, 20);
      _highlightText.mask = _maskLayer;
      _highlightText.opacity = 1;
    } else {
      _highlightText.string = nil;
      _highlightText.opacity = 0;
      _highlightText.mask = nil;
    }
    [CATransaction commit];
    [CATransaction flush];
    return;
  }

  // 垂直居中
  CGFloat textHeight = _font.ascender - _font.descender;
  CGFloat y = (kViewHeight - textHeight) / 2 - 3;

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
  NSColor* playedColor = [self playedColor];
  if (!hasTiming || !_wBYw) playedColor = unplayed;
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

  if (_wBYw && hasTiming) {
    _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
    _highlightText.frame = _baseText.frame;
    _highlightText.position = _baseText.position;
    _highlightText.opacity = 1;
  } else {
    _highlightText.string = nil;
    _highlightText.opacity = 0;
  }

  // 重建 mask layer，彻底清除上次动画的残留状态
  if (_wBYw) {
    _highlightText.mask = nil;
    _maskLayer = [CALayer layer];
    _maskLayer.backgroundColor = NSColor.blackColor.CGColor;
    _maskLayer.anchorPoint = CGPointMake(0, 0.5);
    _maskLayer.frame = CGRectMake(0, 0, 0, kViewHeight);
    _maskLayer.position = CGPointMake(0, kViewHeight / 2);
    _highlightText.mask = _maskLayer;
  }
  [CATransaction commit];
  [CATransaction flush];

  // ====== 逐字高亮动画 ======
  if (hasTiming && _wBYw && words.count > 0) {
    NSMutableArray* hKeyTimes = [NSMutableArray array];
    NSMutableArray* hValues = [NSMutableArray array];
    for (NSUInteger i = 0; i < words.count; i++) {
      double start = [words[i][@"start"] doubleValue];
      double offset = MAX(MIN((start - effectiveStartMs) / effectiveDurationMs, 1), 0);
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
    anim.duration = effectiveDurationMs / 1000.0;
    anim.removedOnCompletion = NO;
    anim.fillMode = kCAFillModeForwards;
    // ── 将 offsetMs 转换为 effective 时间系的 offset ──
    double effectiveOffset = MAX(0, MIN(offsetMs - (effectiveStartMs - lineStart), effectiveDurationMs));
    // 用 _clipLayer 时间系计算 beginTime，暂停时 _clipLayer.speed=0 会返回冻结时间，
    // 恢复时再通过 setPlaying:progress: 中的 _clipLayer 时序恢复来对齐
    CFTimeInterval now = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
    anim.beginTime = now * _playbackRate - (effectiveOffset / 1000.0);
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
        double offset = MAX(MIN((end - effectiveStartMs) / effectiveDurationMs, 1), 0);
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
    scrollAnim.duration = effectiveDurationMs / 1000.0;
    scrollAnim.removedOnCompletion = NO;
    scrollAnim.fillMode = kCAFillModeForwards;

    // ── 将 offsetMs 转换为 effective 时间系的 offset ──
    double effectiveOffset = MAX(0, MIN(offsetMs - (effectiveStartMs - lineStart), effectiveDurationMs));
    CFTimeInterval now = [_clipLayer convertTime:CACurrentMediaTime() fromLayer:nil];
    // beginTime 须在 layer 本地时间空间：layer.speed = _playbackRate 时本地时间 = 父时间 × rate
    scrollAnim.beginTime = now * _playbackRate - (effectiveOffset / 1000.0);
    _baseText.speed = _playbackRate;
    _highlightText.speed = _playbackRate;
    [_baseText addAnimation:scrollAnim forKey:@"scroll"];
    [_highlightText addAnimation:scrollAnim forKey:@"scroll"];
    // mask 在 _highlightText 本地坐标中，自动跟随文字滚动，无需单独动画
  }

  // 确保 presentation layer 反映最新动画，供后续 setAnimationsPaused: 录制
  [CATransaction flush];

  // 保存最后一次歌词数据，供 seek 恢复时重建动画
  _lastText = text;
  _lastWords = words;
  _lastLineStartMs = lineStart;
  _lastLineEndMs = lineEnd;
  _lastHasTiming = hasTiming;
  _lastLyricWidth = width;
  _lastOffsetMs = offsetMs;
  _lastTotalTextWidth = totalTextWidth;

  // 暂停时立即冻结动画，避免 setProgress: 等后续调用重新激活
  if (!_isPlaying) {
    [self setAnimationsPaused:YES];
  }
}

// MARK: - 播放/暂停
- (void)setPlaying:(BOOL)playing {
  if (_isPlaying == playing) return;
  _isPlaying = playing;

  if (playing && _lastProgress > 0 && _lastText) {
    // 恢复播放：用 _lastProgress 重建动画
    double offsetMs = (_lastProgress * 1000 - _lastLineStartMs) + 50;
    offsetMs = MAX(0, offsetMs);
    [self updateLyricWithText:_lastText
                        words:_lastWords
                  lineStartMs:_lastLineStartMs
                    lineEndMs:_lastLineEndMs
               hasWordTiming:_lastHasTiming
                  lyricWidth:_lastLyricWidth
                     offset:offsetMs];
  } else if (!playing) {
    [self setAnimationsPaused:YES];
  } else {
    // playing=YES 但 progress=0 或无歌词 → 仅恢复动画
    [self setAnimationsPaused:NO];
  }
  _buttonContainer[1].hidden = playing;  // 播放时隐藏 play
  _pauseLayer.hidden = !playing;         // 播放时显示 pause
}

// MARK: - 播放进度
- (void)setProgress:(double)progress {
  _lastProgress = progress;

  if (progress > 0 && _lastText) {
    double offsetMs = (progress * 1000 - _lastLineStartMs) + 50;
    offsetMs = MAX(0, offsetMs);
    [self updateLyricWithText:_lastText
                        words:_lastWords
                  lineStartMs:_lastLineStartMs
                    lineEndMs:_lastLineEndMs
               hasWordTiming:_lastHasTiming
                  lyricWidth:_lastLyricWidth
                     offset:offsetMs];
  }
}

- (void)setAnimationsPaused:(BOOL)paused {
  if (paused) {
    // 录制-移除模式：从 presentation layer 读当前动画位置，移除动画，model 层匹配
    if (!_lastText || _lastTotalTextWidth <= 0) return;

    CALayer* maskPres = [_maskLayer presentationLayer];
    CGFloat curMaskW = maskPres ? maskPres.bounds.size.width : _maskLayer.bounds.size.width;

    CALayer* basePres = [_baseText presentationLayer];
    CGFloat curScrollX = basePres ? basePres.position.x : _baseText.position.x;

    // 从 mask 宽度估算当前 offset（近似值，恢复时跳到最近的词边界可接受）
    double lineDurMs = _lastLineEndMs - _lastLineStartMs;
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

    _baseText.position = CGPointMake(curScrollX, _baseText.position.y);
    _highlightText.position = CGPointMake(curScrollX, _highlightText.position.y);
    if (_hasWordTiming && _wBYw) {
      _maskLayer.bounds = CGRectMake(0, 0, curMaskW, kViewHeight);
    }

    [CATransaction commit];
  } else {
    // 恢复：用录制位置重建动画
    if (_lastText && _lastWords) {
      [self updateLyricWithText:_lastText
                          words:_lastWords
                    lineStartMs:_lastLineStartMs
                      lineEndMs:_lastLineEndMs
                 hasWordTiming:_lastHasTiming
                    lyricWidth:_lastLyricWidth
                       offset:_lastOffsetMs];
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

// MARK: - 显示设置
- (void)setWordByWord:(BOOL)wBYw {
  _wBYw = wBYw;
}

- (void)setPlayedColor:(NSColor*)color {
  _playedColor = color;
  [self updateColors];
}

- (NSColor*)playedColor {
  BOOL isDark = [self.effectiveAppearance
      bestMatchFromAppearancesWithNames:@[NSAppearanceNameDarkAqua, NSAppearanceNameAqua]] == NSAppearanceNameDarkAqua;
  return isDark ? (_playedColor ?: [NSColor yellowColor]) : (_playedColorLight ?: [NSColor yellowColor]);
}

- (void)setPlayedColorLight:(NSColor*)color {
  _playedColorLight = color;
  [self updateColors];
}

// MARK: - 喜欢状态
- (void)setLikeState:(BOOL)liked {
  _isLiked = liked;
  [self updateLikeButtonAppearance];
}

- (void)updateLikeButtonAppearance {
  NSColor* color = UnplayedColor(self);
  CALayer* likeBtn = _buttonContainer[3];
  if (!likeBtn) return;

  CGPathRef path = MakeButtonPath(3, kIconSize, kIconSize);
  if (_isLiked) {
    // 已赞：实心心形（对应 heart-solid.svg 的 path）
    likeBtn.contents = MakePathButtonImage(kIconSize, path, color);
  } else {
    // 未赞：描边心形（对应 heart.svg 的轮廓效果）
    likeBtn.contents = MakePathButtonImageOutline(kIconSize, path, color);
  }
  CGPathRelease(path);
}

// MARK: - 按钮类型
- (void)setButtonType:(NSInteger)index type:(NSInteger)type {
  if (index < 0 || index > 3 || !_buttonContainer[index]) return;
  _buttonTypes[index] = type;
  NSColor* color = UnplayedColor(self);
  NSString* sym = SFSymbolForButtonType(type);
  BOOL isThumbsDown = (type == 4);
  CGFloat iconSize = isThumbsDown ? kIconSize * 1.5 : kIconSize; // thumbdown 细节多，加大显示

  if (isThumbsDown && sym) {
    if (@available(macOS 11.0, *)) {
      NSImage* symbol = [NSImage imageWithSystemSymbolName:sym
                                       accessibilityDescription:nil];
      NSImageSymbolConfiguration* cfg =
          [NSImageSymbolConfiguration configurationWithPointSize:iconSize
                                                          weight:NSFontWeightRegular
                                                           scale:NSImageSymbolScaleMedium];
      NSImage* configured = [symbol imageWithSymbolConfiguration:cfg];

      NSImage* tinted = [[NSImage alloc] initWithSize:NSMakeSize(iconSize, iconSize)];
      [tinted lockFocus];
      
      CGContextRef ctx = [[NSGraphicsContext currentContext] CGContext];
      NSRect proposedRect = NSMakeRect(0, 0, iconSize, iconSize);
      CGImageRef cgMask = [configured CGImageForProposedRect:&proposedRect context:nil hints:nil];
      
      if (cgMask) {
        CGContextClipToMask(ctx, CGRectMake(0, 0, iconSize, iconSize), cgMask);
        CGContextSetFillColorWithColor(ctx, color.CGColor);
        CGContextFillRect(ctx, CGRectMake(0, 0, iconSize, iconSize));
      } else {
        [configured drawInRect:NSMakeRect(0, 0, iconSize, iconSize)
                      fromRect:NSZeroRect
                     operation:NSCompositingOperationSourceOver
                      fraction:1.0];
      }
      
      [tinted unlockFocus];
      _buttonContainer[index].contents = tinted;  // 这里使用 index
    }
  } else {
    NSImage* img = sym ? MakeSFButtonImage(sym, iconSize, color) : nil;
    _buttonContainer[index].contents = img ?: MakeButtonImage(type, iconSize, color);  // 这里使用 index
  }
  
  _buttonContainer[index].transform = isThumbsDown
      ? CATransform3DMakeScale(-1, 1, 1)
      : CATransform3DIdentity;
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
  for (NSInteger i = 0; i < 4; i++) {
    NSInteger type = _buttonTypes[i];
    NSString* sym = SFSymbolForButtonType(type);
    BOOL isThumbsDown = (type == 4);
    CGFloat iconSize = isThumbsDown ? kIconSize * 1.5 : kIconSize;

    if (isThumbsDown && sym) {
      if (@available(macOS 11.0, *)) {
        NSImage* symbol = [NSImage imageWithSystemSymbolName:sym
                                         accessibilityDescription:nil];
        NSImageSymbolConfiguration* cfg =
            [NSImageSymbolConfiguration configurationWithPointSize:iconSize
                                                            weight:NSFontWeightRegular
                                                             scale:NSImageSymbolScaleMedium];
        NSImage* configured = [symbol imageWithSymbolConfiguration:cfg];

        NSImage* tinted = [[NSImage alloc] initWithSize:NSMakeSize(iconSize, iconSize)];
        [tinted lockFocus];
        
        CGContextRef ctx = [[NSGraphicsContext currentContext] CGContext];
        NSRect proposedRect = NSMakeRect(0, 0, iconSize, iconSize);
        CGImageRef cgMask = [configured CGImageForProposedRect:&proposedRect context:nil hints:nil];
        
        if (cgMask) {
          CGContextClipToMask(ctx, CGRectMake(0, 0, iconSize, iconSize), cgMask);
          CGContextSetFillColorWithColor(ctx, color.CGColor);
          CGContextFillRect(ctx, CGRectMake(0, 0, iconSize, iconSize));
        } else {
          [configured drawInRect:NSMakeRect(0, 0, iconSize, iconSize)
                        fromRect:NSZeroRect
                       operation:NSCompositingOperationSourceOver
                        fraction:1.0];
        }
        
        [tinted unlockFocus];
        _buttonContainer[i].contents = tinted;
      }
    } else {
      NSImage* img = sym ? MakeSFButtonImage(sym, iconSize, color) : nil;
      _buttonContainer[i].contents = img ?: MakeButtonImage(type, iconSize, color);
    }
  }
  
  // 移除无用的 pauseImg 变量声明
  _pauseLayer.contents = MakePauseButtonImage(kIconSize, color);

  // 重建文字层颜色
  [self updateLikeButtonAppearance];

  if (_baseText.string) {
    NSString* text = [(NSAttributedString*)_baseText.string string];
    NSDictionary* attrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: color};
    _baseText.string = [[NSAttributedString alloc] initWithString:text attributes:attrs];
  }
  if (_highlightText.string) {
    NSString* text = [(NSAttributedString*)_highlightText.string string];
    NSColor* played = [self playedColor];
    NSDictionary* playedAttrs = @{NSFontAttributeName: _font, NSForegroundColorAttributeName: played};
    _highlightText.string = [[NSAttributedString alloc] initWithString:text attributes:playedAttrs];
  }
}


- (void)viewDidChangeEffectiveAppearance {
  [self updateColors];
}

- (void)viewDidMoveToWindow {
  [super viewDidMoveToWindow];
  CGFloat scale = self.window ? self.window.backingScaleFactor : NSScreen.mainScreen.backingScaleFactor;
  _baseText.contentsScale = scale;
  _highlightText.contentsScale = scale;
}

// MARK: - 鼠标事件
- (void)handleClickWithEvent:(NSEvent*)event {
  NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];

  // 纯图标模式（无歌词、无按钮）：点击弹出菜单
  if (!_showLyric && !_showButtons) {
    if (self.onRightClick) self.onRightClick();
    return;
  }

  if (_showButtons) {
    CGFloat bx = 4 + (_showLyric ? _lyricAreaWidth + kButtonGroupPadding : 0);
    for (NSInteger i = 0; i < 4; i++) {
      CGRect btnRect = CGRectMake(bx + i * (_buttonWidth + kButtonSpacing), 0, _buttonWidth, kViewHeight);
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

// MARK: - 鼠标事件/菜单位置
- (void)storeClickPosition:(NSEvent*)event {
  self.lastClickEvent = event;
}

- (void)showContextMenu:(NSMenu*)menu {
  [NSMenu popUpContextMenu:menu withEvent:self.lastClickEvent forView:self];
  self.lastClickEvent = nil;
}

- (void)cleanup {
  // 移出状态栏（AppKit 会自动清理关联的菜单）
  if (_statusItem) {
    [[NSStatusBar systemStatusBar] removeStatusItem:_statusItem];
    _statusItem = nil;
  }
}

- (void)mouseDown:(NSEvent*)event {
  [self storeClickPosition:event];
  [self handleClickWithEvent:event];
}

- (void)rightMouseDown:(NSEvent*)event {
  [self storeClickPosition:event];
  if (self.onRightClick) self.onRightClick();
}

// MARK: - 原生菜单响应
- (IBAction)menuItemClicked:(id)sender {
  if (self.onMenuItemClicked) {
    self.onMenuItemClicked(((NSMenuItem*)sender).tag);
  }
}

@end
