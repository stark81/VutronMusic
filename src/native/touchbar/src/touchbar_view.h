#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>

// ================ Button Types ================
typedef NS_ENUM(NSInteger, ButtonType) {
  ButtonTypePrev = 0,      // ◁◁
  ButtonTypePlay = 1,      // ▶
  ButtonTypeNext = 2,      // ▷▷
  ButtonTypeLike = 3,      // ♥
  ButtonTypeThumbsDown = 4 // 👎
};

// ================ 单个触钮视图 ================
@interface TouchbarButtonView : NSView

@property (nonatomic, copy) void (^onClick)(NSInteger index);
@property (nonatomic) NSInteger buttonIndex;
@property (nonatomic) ButtonType type;
@property (nonatomic, getter=isSelected) BOOL selected;

- (instancetype)initWithType:(ButtonType)type index:(NSInteger)index;
- (void)setButtonType:(ButtonType)type;

@end

// ================ 歌词视图（逐字高亮 + 滚动） ================
@interface TouchbarLyricView : NSView

- (void)updateLyricWithText:(NSString*)text
                      words:(NSArray<NSDictionary*>*)words
                  lineStartMs:(double)lineStart
                    lineEndMs:(double)lineEnd
               hasWordTiming:(BOOL)hasTiming
                  lyricWidth:(CGFloat)width
                     offset:(double)offsetMs;

- (void)setPlaying:(BOOL)playing progress:(double)progress;
- (void)setPlaybackRate:(double)rate;
- (void)setWordByWord:(BOOL)wBYw;
- (void)setPlayedColor:(NSColor*)color;
- (void)setPlayedColorLight:(NSColor*)color;

@end

// ================ TouchBar 管理器 ================
@interface TouchbarManager : NSObject <NSTouchBarDelegate>

@property (nonatomic, copy) void (^onButtonClick)(NSInteger index);
@property (nonatomic, strong) NSTouchBar* touchBar;
@property (nonatomic, strong) TouchbarLyricView* lyricView;
@property (nonatomic, strong) NSButton* prevButton;
@property (nonatomic, strong) NSButton* playButton;
@property (nonatomic, strong) NSButton* nextButton;
@property (nonatomic, strong) NSButton* likeButton;
@property (nonatomic) BOOL isFMMode;

- (instancetype)init;
- (void)installOnWindow;
- (void)installOnWindowWithView:(NSView*)view;

// 代理到 lyricView
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
- (void)setFMMode:(BOOL)isFM;
- (void)setWordByWord:(BOOL)wBYw;
- (void)setPlayedColor:(NSColor*)color;
- (void)setPlayedColorLight:(NSColor*)color;

@end
