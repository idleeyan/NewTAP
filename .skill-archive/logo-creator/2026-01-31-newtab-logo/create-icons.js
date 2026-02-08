const fs = require('fs');
const path = require('path');

// 创建SVG内容
function createSVG(size) {
  const scale = size / 128;
  const cardSize = Math.floor(44 * scale);
  const gap = Math.floor(8 * scale);
  const startX = Math.floor(16 * scale);
  const startY = Math.floor(16 * scale);
  const strokeWidth = Math.max(1, 2.5 * scale);
  const lineStroke = Math.max(1, 2 * scale);
  
  // 计算位置
  const positions = [
    { x: startX, y: startY },
    { x: startX + cardSize + gap, y: startY },
    { x: startX, y: startY + cardSize + gap },
    { x: startX + cardSize + gap, y: startY + cardSize + gap }
  ];
  
  // 生成卡片
  let cardsSVG = '';
  positions.forEach((pos, i) => {
    const line1Y = pos.y + Math.floor(12 * scale);
    const line2Y = pos.y + Math.floor(20 * scale);
    const line1Width = i % 2 === 0 ? Math.floor(28 * scale) : Math.floor(20 * scale);
    const line2Width = Math.floor(20 * scale);
    
    cardsSVG += `
    <!-- 卡片 ${i + 1} -->
    <rect x="${pos.x}" y="${pos.y}" width="${cardSize}" height="${cardSize}" rx="${Math.floor(8 * scale)}" 
          fill="none" stroke="#667eea" stroke-width="${strokeWidth}"/>
    <line x1="${pos.x + Math.floor(8 * scale)}" y1="${line1Y}" 
          x2="${pos.x + Math.floor(8 * scale) + line1Width}" y2="${line1Y}" 
          stroke="#667eea" stroke-width="${lineStroke}" stroke-linecap="round" opacity="0.8"/>
    <line x1="${pos.x + Math.floor(8 * scale)}" y1="${line2Y}" 
          x2="${pos.x + Math.floor(8 * scale) + line2Width}" y2="${line2Y}" 
          stroke="#667eea" stroke-width="${lineStroke}" stroke-linecap="round" opacity="0.5"/>
    `;
  });
  
  // 书签角标
  const bookmarkX = startX + cardSize + gap + Math.floor(32 * scale);
  const bookmarkY = startY + cardSize + gap + Math.floor(36 * scale);
  const bookmarkSize = Math.floor(12 * scale);
  
  const bookmarkSVG = `
    <!-- 书签角标 -->
    <polygon points="${bookmarkX},${bookmarkY} ${bookmarkX + bookmarkSize},${bookmarkY} 
                     ${bookmarkX + bookmarkSize},${bookmarkY + bookmarkSize} 
                     ${bookmarkX + bookmarkSize / 2},${bookmarkY + bookmarkSize / 2} 
                     ${bookmarkX},${bookmarkY + bookmarkSize}" 
             fill="#667eea"/>
  `;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 背景 -->
  <rect width="${size}" height="${size}" rx="${Math.floor(24 * scale)}" fill="url(#bgGrad)"/>
  
  <!-- 2x2 书签卡片网格 -->
  <g>${cardsSVG}${bookmarkSVG}</g>
</svg>`;
}

// 主函数
function main() {
  const sizes = [16, 48, 128];
  
  console.log('='.repeat(60));
  console.log('生成LOGO图标');
  console.log('='.repeat(60));
  console.log();
  
  sizes.forEach(size => {
    const svg = createSVG(size);
    const filename = `icon${size}.svg`;
    fs.writeFileSync(filename, svg);
    console.log(`✓ 已生成: ${filename} (${size}x${size})`);
  });
  
  console.log();
  console.log('='.repeat(60));
  console.log('生成完成！');
  console.log('='.repeat(60));
  console.log();
  console.log('注意: 生成的SVG文件可以直接使用，');
  console.log('或者使用浏览器/图像工具转换为PNG。');
}

main();
