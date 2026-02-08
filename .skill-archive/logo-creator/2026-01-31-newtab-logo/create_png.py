#!/usr/bin/env python3
"""
使用PIL创建LOGO的PNG图标
"""
from PIL import Image, ImageDraw

def create_icon(size):
    """创建指定尺寸的图标"""
    img = Image.new('RGBA', (size, size), (26, 26, 46, 255))  # #1a1a2e
    draw = ImageDraw.Draw(img)
    
    # 计算缩放比例
    scale = size / 128.0
    
    # 绘制圆角矩形背景（稍微深一点的渐变效果）
    corner_radius = int(24 * scale)
    
    # 绘制2x2网格的书签卡片
    card_size = int(44 * scale)
    gap = int(8 * scale)
    start_x = int(16 * scale)
    start_y = int(16 * scale)
    
    # 定义颜色
    purple = (102, 126, 234, 255)  # #667eea
    purple_light = (118, 75, 162, 255)  # #764ba2
    
    # 绘制四个卡片
    positions = [
        (start_x, start_y),
        (start_x + card_size + gap, start_y),
        (start_x, start_y + card_size + gap),
        (start_x + card_size + gap, start_y + card_size + gap)
    ]
    
    for i, (x, y) in enumerate(positions):
        # 绘制卡片外框
        draw.rounded_rectangle(
            [x, y, x + card_size, y + card_size],
            radius=int(8 * scale),
            outline=purple,
            width=max(1, int(2.5 * scale))
        )
        
        # 绘制内部线条（模拟文字）
        line1_y = y + int(12 * scale)
        line2_y = y + int(20 * scale)
        line_width1 = int(28 * scale) if i % 2 == 0 else int(20 * scale)
        line_width2 = int(20 * scale) if i % 2 == 0 else int(20 * scale)
        
        # 第一条线
        draw.line(
            [(x + int(8 * scale), line1_y), (x + int(8 * scale) + line_width1, line1_y)],
            fill=(*purple[:3], int(255 * 0.8)),
            width=max(1, int(2 * scale))
        )
        
        # 第二条线
        draw.line(
            [(x + int(8 * scale), line2_y), (x + int(8 * scale) + line_width2, line2_y)],
            fill=(*purple[:3], int(255 * 0.5)),
            width=max(1, int(2 * scale))
        )
    
    # 右下角书签角标
    bookmark_x = start_x + card_size + gap + int(32 * scale)
    bookmark_y = start_y + card_size + gap + int(36 * scale)
    bookmark_size = int(12 * scale)
    
    # 绘制书签形状
    draw.polygon([
        (bookmark_x, bookmark_y),
        (bookmark_x + bookmark_size, bookmark_y),
        (bookmark_x + bookmark_size, bookmark_y + bookmark_size),
        (bookmark_x + bookmark_size // 2, bookmark_y + bookmark_size // 2),
        (bookmark_x, bookmark_y + bookmark_size)
    ], fill=purple)
    
    return img

def main():
    sizes = [16, 48, 128]
    
    print("=" * 60)
    print("生成LOGO图标")
    print("=" * 60)
    print()
    
    for size in sizes:
        img = create_icon(size)
        filename = f"icon{size}.png"
        img.save(filename, 'PNG')
        print(f"✓ 已生成: {filename} ({size}x{size})")
    
    print()
    print("=" * 60)
    print("生成完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
