const fs = require('fs');
const path = require('path');

// 简单的SVG到PNG转换 - 使用data URL和Canvas API
// 由于Node.js没有原生Canvas，我们创建一个HTML文件然后用浏览器打开

const sizes = [16, 48, 128];

// 创建转换HTML
function createConverterHTML() {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SVG to PNG Converter</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #1a1a2e; color: white; }
    .status { margin: 10px 0; }
    .success { color: #4caf50; }
  </style>
</head>
<body>
  <h2>SVG to PNG 转换器</h2>
  <div id="status"></div>
  <canvas id="canvas"></canvas>
  
  <script>
    const sizes = [16, 48, 128];
    const statusDiv = document.getElementById('status');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    function log(msg, isSuccess) {
      const div = document.createElement('div');
      div.className = 'status ' + (isSuccess ? 'success' : '');
      div.textContent = msg;
      statusDiv.appendChild(div);
    }
    
    async function convertSVG(size) {
      try {
        const svgPath = 'icon' + size + '.svg';
        const response = await fetch(svgPath);
        let svgText = await response.text();
        
        // 确保SVG有正确的命名空间
        if (!svgText.includes('xmlns=')) {
          svgText = svgText.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        
        // 创建Blob和URL
        const blob = new Blob([svgText], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // 创建图片
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        
        // 绘制到canvas
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        
        // 转换为PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');
        
        // 保存文件（通过创建下载链接）
        const link = document.createElement('a');
        link.download = 'icon' + size + '.png';
        link.href = pngDataUrl;
        link.click();
        
        URL.revokeObjectURL(url);
        
        log('✓ 已生成: icon' + size + '.png (' + size + 'x' + size + ')', true);
      } catch (err) {
        log('✗ 失败: icon' + size + '.png - ' + err.message, false);
      }
    }
    
    async function main() {
      log('开始转换...');
      for (const size of sizes) {
        await convertSVG(size);
        await new Promise(r => setTimeout(r, 100));
      }
      log('');
      log('转换完成！', true);
    }
    
    main();
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync('converter.html', html);
  console.log('✓ 已创建转换器: converter.html');
  console.log('');
  console.log('请用浏览器打开 converter.html 文件来生成PNG图标');
  console.log('或者使用在线SVG转PNG工具转换生成的SVG文件');
}

// 也创建一个简单的PNG数据生成器（使用base64编码的简单PNG）
// 这里我们创建一个可以直接复制到扩展的SVG文件
function copySVGToExtension() {
  const extImagesDir = path.join(__dirname, '..', '..', '..', '..', 'images');
  
  // 确保images目录存在
  if (!fs.existsSync(extImagesDir)) {
    fs.mkdirSync(extImagesDir, { recursive: true });
  }
  
  // 复制SVG文件到images目录
  sizes.forEach(size => {
    const srcFile = path.join(__dirname, 'icon' + size + '.svg');
    const destFile = path.join(extImagesDir, 'icon' + size + '.svg');
    
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`✓ 已复制: icon${size}.svg -> images/`);
    }
  });
  
  console.log('');
  console.log('SVG图标已复制到 images/ 目录');
  console.log('注意: 扩展需要使用PNG格式，请手动转换或使用支持SVG的浏览器');
}

console.log('='.repeat(60));
console.log('SVG图标生成完成');
console.log('='.repeat(60));
console.log('');

sizes.forEach(size => {
  console.log(`✓ icon${size}.svg (${size}x${size})`);
});

console.log('');
console.log('='.repeat(60));
console.log('');

createConverterHTML();
