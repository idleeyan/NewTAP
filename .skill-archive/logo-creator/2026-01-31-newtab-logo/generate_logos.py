#!/usr/bin/env python3
"""
生成新标签页扩展LOGO - 书签/门户风格，简约线条设计
"""
import os
import requests
import time
from datetime import datetime

# Recraft API配置
RECRAFT_API_KEY = os.environ.get('RECRAFT_API_KEY', '')
RECRAFT_API_URL = "https://external.api.recraft.ai/v1/images/generations"

# 输出目录
OUTPUT_DIR = "."

# 提示词模板 - 书签/门户风格，简约线条设计
PROMPTS = [
    # 方案1: 书签卡片网格
    "Minimalist bookmark portal icon, clean line art style, multiple rectangular bookmark cards arranged in a 2x2 grid pattern, rounded corners, simple geometric shapes, deep purple (#667eea) gradient on dark blue (#1a1a2e) background, modern flat design, fills the entire square canvas, no margins, professional browser extension icon",
    
    # 方案2: 抽象门户/窗口
    "Minimalist portal window icon, clean line art style, arch-shaped doorway or window frame with subtle grid lines inside, simple geometric portal concept, deep purple (#667eea) to blue gradient on dark navy background, modern flat design, fills entire square, no empty space, professional browser extension icon",
    
    # 方案3: 书签列表+星标
    "Minimalist bookmark star icon, clean line art style, horizontal bookmark list with a prominent star symbol, simple lines and shapes, deep purple (#667eea) accent on dark blue (#1a1a2e) background, modern flat design, fills the square canvas completely, no margins, professional browser extension icon",
    
    # 方案4: 新标签页+加号
    "Minimalist new tab plus icon, clean line art style, browser tab shape with a plus sign, simple geometric design, deep purple (#667eea) gradient on dark blue background, modern flat design, fills entire square icon area, no empty borders, professional browser extension icon",
    
    # 方案5: 收藏夹/文件夹
    "Minimalist bookmark folder icon, clean line art style, folder with bookmark tabs sticking out, simple line geometry, deep purple (#667eea) on dark navy (#1a1a2e) background, modern flat design, fills the complete square canvas, no margins, professional browser extension icon",
    
    # 方案6: 网格布局
    "Minimalist grid layout icon, clean line art style, 3x3 or 2x2 grid of squares representing bookmark grid, simple geometric pattern, deep purple (#667eea) gradient on dark blue background, modern flat design, fills entire square, no empty space, professional browser extension icon",
    
    # 方案7: 主页/房子+书签
    "Minimalist home bookmark icon, clean line art style, simple house shape combined with bookmark ribbon, geometric line art, deep purple (#667eea) on dark navy background, modern flat design, fills the square completely, no margins, professional browser extension icon",
    
    # 方案8: 速度表/快速访问
    "Minimalist speed dial icon, clean line art style, circular dial with bookmark shortcuts around it, simple geometric design, deep purple (#667eea) gradient on dark blue background, modern flat design, fills entire square canvas, no empty borders, professional browser extension icon",
    
    # 方案9: 书签丝带
    "Minimalist bookmark ribbon icon, clean line art style, elegant bookmark ribbon or banner shape, simple flowing lines, deep purple (#667eea) on dark navy (#1a1a2e) background, modern flat design, fills the complete square, no margins, professional browser extension icon",
    
    # 方案10: 窗口分屏
    "Minimalist split window icon, clean line art style, browser window divided into sections representing organized bookmarks, simple geometric lines, deep purple (#667eea) gradient on dark blue background, modern flat design, fills entire square, no empty space, professional browser extension icon",
    
    # 方案11-20: 变体
    "Minimalist bookmark cards icon, clean line art, 4 rounded rectangles in grid, purple gradient on dark blue, fills square, no margins",
    "Minimalist quick access portal icon, clean lines, circular portal with bookmarks, purple on dark navy, fills entire icon",
    "Minimalist bookmark manager icon, clean line art, stacked cards with star, purple gradient, dark background, fills square",
    "Minimalist start page icon, clean lines, browser window with content grid, purple on dark blue, fills entire canvas",
    "Minimalist favorites icon, clean line art, heart combined with bookmark, purple gradient, dark navy, fills square",
    "Minimalist dashboard icon, clean lines, grid dashboard layout, purple on dark blue, fills entire icon area",
    "Minimalist bookmark pin icon, clean line art, location pin with bookmark, purple gradient, dark background, fills square",
    "Minimalist collection icon, clean lines, stacked squares representing bookmarks, purple on navy, fills entire square",
    "Minimalist navigation icon, clean line art, compass combined with bookmarks, purple gradient, dark blue, fills square",
    "Minimalist smart tab icon, clean lines, browser tab with smart grid, purple on dark navy, fills entire icon",
]

def generate_logo(prompt, output_path):
    """使用Recraft API生成LOGO"""
    if not RECRAFT_API_KEY:
        print(f"错误: 未设置 RECRAFT_API_KEY 环境变量")
        return False
    
    headers = {
        "Authorization": f"Bearer {RECRAFT_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": prompt,
        "size": "1024x1024",  # 1:1 正方形
        "style": "digital_illustration"
    }
    
    try:
        response = requests.post(RECRAFT_API_URL, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        result = response.json()
        
        if "data" in result and len(result["data"]) > 0:
            image_url = result["data"][0]["url"]
            # 下载图片
            img_response = requests.get(image_url, timeout=60)
            img_response.raise_for_status()
            
            with open(output_path, "wb") as f:
                f.write(img_response.content)
            
            print(f"✓ 已生成: {output_path}")
            return True
        else:
            print(f"✗ 生成失败: {output_path} - 无图片数据")
            return False
            
    except Exception as e:
        print(f"✗ 生成失败: {output_path} - {str(e)}")
        return False

def main():
    print("=" * 60)
    print("新标签页扩展 LOGO 生成器")
    print("风格: 书签/门户风格，简约线条设计")
    print("=" * 60)
    print()
    
    if not RECRAFT_API_KEY:
        print("⚠️ 警告: 未设置 RECRAFT_API_KEY 环境变量")
        print("请设置环境变量后再运行:")
        print("  $env:RECRAFT_API_KEY = 'your-api-key'")
        print()
        print("你可以从 https://www.recraft.ai/ 获取 API Key")
        return
    
    success_count = 0
    
    for i, prompt in enumerate(PROMPTS, 1):
        output_file = f"logo-{i:02d}.png"
        output_path = os.path.join(OUTPUT_DIR, output_file)
        
        print(f"[{i}/{len(PROMPTS)}] 生成 {output_file}...")
        
        if generate_logo(prompt, output_path):
            success_count += 1
        
        # 避免API速率限制
        if i < len(PROMPTS):
            time.sleep(2)
    
    print()
    print("=" * 60)
    print(f"生成完成: {success_count}/{len(PROMPTS)} 个LOGO")
    print(f"输出目录: {os.path.abspath(OUTPUT_DIR)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
