#!/usr/bin/env python3
"""
导出LOGO图标为各种尺寸的PNG格式
"""
import subprocess
import sys
import os

# 检查并安装cairosvg
# 使用svglib + reportlab 或者 Pillow + 其他库

# 使用PIL和svglib来渲染SVG
from PIL import Image, ImageDraw
import io

def install_package(package):
    """安装Python包"""
    subprocess.check_call([sys.executable, "-m", "pip", "install", package, "-q"])

try:
    import cairosvg
except ImportError:
    print("正在安装 cairosvg...")
    install_package("cairosvg")
    import cairosvg

def svg_to_png(svg_path, png_path, size):
    """将SVG转换为PNG"""
    try:
        cairosvg.svg2png(
            url=svg_path,
            write_to=png_path,
            output_width=size,
            output_height=size
        )
        print(f"✓ 已生成: {png_path} ({size}x{size})")
        return True
    except Exception as e:
        print(f"✗ 生成失败: {png_path} - {str(e)}")
        return False

def main():
    svg_file = "logo-final.svg"
    
    # 需要生成的尺寸
    sizes = [16, 48, 128]
    
    print("=" * 60)
    print("导出LOGO图标")
    print("=" * 60)
    print()
    
    for size in sizes:
        png_file = f"icon{size}.png"
        svg_to_png(svg_file, png_file, size)
    
    print()
    print("=" * 60)
    print("导出完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
