#!/usr/bin/env python3
"""
使用Python标准库绘制PNG图标
"""
import struct
import zlib
import os

def create_png_chunk(chunk_type, data):
    """创建PNG数据块"""
    chunk = chunk_type + data
    crc = zlib.crc32(chunk) & 0xffffffff
    return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)

def create_png_rgb(width, height, pixels):
    """创建PNG文件数据"""
    # PNG签名
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR块
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # RGBA
    ihdr = create_png_chunk(b'IHDR', ihdr_data)
    
    # IDAT块 (图像数据)
    raw_data = b''
    for row in pixels:
        raw_data += b'\x00'  # 滤波器字节
        for r, g, b, a in row:
            raw_data += bytes([r, g, b, a])
    
    compressed = zlib.compress(raw_data)
    idat = create_png_chunk(b'IDAT', compressed)
    
    # IEND块
    iend = create_png_chunk(b'IEND', b'')
    
    return signature + ihdr + idat + iend

def draw_rounded_rect(pixels, x, y, w, h, radius, color, width=1):
    """绘制圆角矩形边框"""
    r, g, b, a = color
    
    # 简化的矩形绘制（不考虑圆角，因为小尺寸不明显）
    for i in range(width):
        # 上边框
        for dx in range(w):
            px, py = x + dx, y + i
            if 0 <= px < len(pixels[0]) and 0 <= py < len(pixels):
                pixels[py][px] = color
        
        # 下边框
        for dx in range(w):
            px, py = x + dx, y + h - 1 - i
            if 0 <= px < len(pixels[0]) and 0 <= py < len(pixels):
                pixels[py][px] = color
        
        # 左边框
        for dy in range(h):
            px, py = x + i, y + dy
            if 0 <= px < len(pixels[0]) and 0 <= py < len(pixels):
                pixels[py][px] = color
        
        # 右边框
        for dy in range(h):
            px, py = x + w - 1 - i, y + dy
            if 0 <= px < len(pixels[0]) and 0 <= py < len(pixels):
                pixels[py][px] = color

def draw_line(pixels, x1, y1, x2, y2, color, width=1):
    """绘制线段"""
    r, g, b, a = color
    
    # 简化的水平或垂直线绘制
    if y1 == y2:  # 水平线
        for x in range(min(x1, x2), max(x1, x2) + 1):
            for w in range(width):
                if 0 <= x < len(pixels[0]) and 0 <= y1 + w < len(pixels):
                    pixels[y1 + w][x] = color
    elif x1 == x2:  # 垂直线
        for y in range(min(y1, y2), max(y1, y2) + 1):
            for w in range(width):
                if 0 <= x1 + w < len(pixels[0]) and 0 <= y < len(pixels):
                    pixels[y][x1 + w] = color

def draw_polygon(pixels, points, color):
    """绘制填充多边形（简化版）"""
    r, g, b, a = color
    
    # 计算边界框
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    
    # 简单的扫描线填充
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            # 简化的点在多边形内检测
            if 0 <= x < len(pixels[0]) and 0 <= y < len(pixels):
                # 检查是否在三角形内（书签形状）
                pixels[y][x] = color

def create_icon(size):
    """创建图标"""
    # 颜色定义
    bg_color = (26, 26, 46, 255)  # #1a1a2e
    purple = (102, 126, 234, 255)  # #667eea
    purple_light = (102, 126, 234, 128)  # 半透明
    
    # 创建像素数组
    pixels = [[bg_color for _ in range(size)] for _ in range(size)]
    
    # 计算尺寸
    scale = size / 128.0
    card_size = int(44 * scale)
    gap = int(8 * scale)
    start_x = int(16 * scale)
    start_y = int(16 * scale)
    stroke_width = max(1, int(2.5 * scale))
    line_width = max(1, int(2 * scale))
    
    # 四个卡片位置
    positions = [
        (start_x, start_y),
        (start_x + card_size + gap, start_y),
        (start_x, start_y + card_size + gap),
        (start_x + card_size + gap, start_y + card_size + gap)
    ]
    
    # 绘制卡片
    for i, (x, y) in enumerate(positions):
        # 绘制卡片边框
        draw_rounded_rect(pixels, x, y, card_size, card_size, int(8 * scale), purple, stroke_width)
        
        # 绘制内部线条
        line1_y = y + int(12 * scale)
        line2_y = y + int(20 * scale)
        line1_width = int(28 * scale) if i % 2 == 0 else int(20 * scale)
        line2_width = int(20 * scale)
        
        # 第一条线
        line1_color = (102, 126, 234, 204)  # 80% opacity
        draw_line(pixels, x + int(8 * scale), line1_y, 
                  x + int(8 * scale) + line1_width, line1_y, line1_color, line_width)
        
        # 第二条线
        line2_color = (102, 126, 234, 128)  # 50% opacity
        draw_line(pixels, x + int(8 * scale), line2_y,
                  x + int(8 * scale) + line2_width, line2_y, line2_color, line_width)
    
    # 绘制书签角标（简化版小方块）
    bookmark_x = start_x + card_size + gap + int(32 * scale)
    bookmark_y = start_y + card_size + gap + int(36 * scale)
    bookmark_size = max(2, int(12 * scale))
    
    for dy in range(bookmark_size):
        for dx in range(bookmark_size):
            px = bookmark_x + dx
            py = bookmark_y + dy
            if 0 <= px < size and 0 <= py < size:
                pixels[py][px] = purple
    
    return pixels

def main():
    sizes = [16, 48, 128]
    
    print("=" * 60)
    print("生成LOGO图标 (PNG格式)")
    print("=" * 60)
    print()
    
    for size in sizes:
        pixels = create_icon(size)
        png_data = create_png_rgb(size, size, pixels)
        
        filename = f"icon{size}.png"
        with open(filename, 'wb') as f:
            f.write(png_data)
        
        print(f"✓ 已生成: {filename} ({size}x{size})")
    
    print()
    print("=" * 60)
    print("生成完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
