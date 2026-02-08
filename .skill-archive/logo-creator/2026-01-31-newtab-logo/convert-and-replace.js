const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname, '..', '..', '..', '..', 'images');

async function convertSVGtoPNG(page, svgPath, size) {
  // 读取SVG内容
  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  
  // 创建data URL
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64');
  
  // 使用canvas转换
  const pngData = await page.evaluate(async ({ dataUrl, size }) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }, { dataUrl, size });
  
  // 提取base64数据并保存
  const base64Data = pngData.replace(/^data:image\/png;base64,/, '');
  const pngBuffer = Buffer.from(base64Data, 'base64');
  
  const outputPath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, pngBuffer);
  
  return outputPath;
}

async function main() {
  console.log('='.repeat(60));
  console.log('转换SVG为PNG并替换扩展图标');
  console.log('='.repeat(60));
  console.log();
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 启动浏览器
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 创建一个空白页面用于canvas操作
  await page.setContent('<html><body></body></html>');
  
  try {
    for (const size of sizes) {
      const svgPath = path.join(__dirname, `icon${size}.svg`);
      
      if (!fs.existsSync(svgPath)) {
        console.log(`✗ 未找到: icon${size}.svg`);
        continue;
      }
      
      const outputPath = await convertSVGtoPNG(page, svgPath, size);
      console.log(`✓ 已生成: icon${size}.png (${size}x${size})`);
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('图标替换完成！');
    console.log('='.repeat(60));
    console.log();
    console.log('文件位置:');
    sizes.forEach(size => {
      console.log(`  images/icon${size}.png`);
    });
    
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
