#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>

/// 自定义 NSStatusItem 视图，包含歌词、控制按钮、应用图标
@interface NativeTrayView : NSView {
  NSStatusItem* _statusItem;

  // 应用图标
  CALayer* _iconLayer;

  // 歌词区域
  CALayer* _clipLayer;
  CATextLayer* _baseText;
  CATextLayer* _highlightText;
  CALayer* _maskLayer;

  // 按钮
  CAShapeLayer* _buttonContainer[4];
  CAShapeLayer* _pauseLayer;
  BOOL _isPlaying;
  BOOL _showButtons;
  BOOL _isLiked;

  // 布局常量
  CGFloat _lyricAreaWidth;

  // 上次歌词数据（用于恢复时重建）
  NSString* _lastText;
  NSArray<NSDictionary*>* _lastWords;
  double _lastLineStartMs;
  double _lastLineEndMs;
  BOOL _lastHasTiming;
  CGFloat _lastLyricWidth;
  double _lastProgress;

  // 显示设置
  BOOL _showLyric;
  BOOL _showIcon;
  BOOL _wBYw;          // 逐字高亮
}

- (instancetype)initWithStatusItem:(NSStatusItem*)item
                          iconSize:(CGFloat)iconSize
                    lyricAreaWidth:(CGFloat)lyricWidth
                       buttonWidth:(CGFloat)btnWidth;

- (void)setIconImage:(NSImage*)image;
- (void)handleButtonClick:(id)sender;
- (void)updateLyricWithText:(NSString*)text
                      words:(NSArray<NSDictionary*>*)words
                  lineStartMs:(double)lineStart
                    lineEndMs:(double)lineEnd
               hasWordTiming:(BOOL)hasTiming
                  lyricWidth:(CGFloat)width
                     offset:(double)offsetMs;
- (void)setPlaying:(BOOL)playing progress:(double)progress;
- (void)setPlaybackRate:(double)rate;
- (void)setLikeState:(BOOL)liked;
- (void)setWidth:(CGFloat)width;
- (void)setButtonType:(NSInteger)index type:(NSInteger)type;
- (void)setLyricVisibility:(BOOL)show;
- (void)setButtonVisibility:(BOOL)show;
- (void)setIconVisibility:(BOOL)show;
- (void)setWordByWord:(BOOL)wBYw;
- (void)setPlayedColor:(NSColor*)color;
- (void)setPlayedColorLight:(NSColor*)color;

/// 更新按钮颜色（亮暗模式切换时刷新）
- (void)updateColors;

@property (nonatomic, copy) void (^onButtonClick)(NSInteger index);
@property (nonatomic, copy) void (^onRightClick)(void);
@property (nonatomic, copy) void (^onTrayClick)(void);

@end
