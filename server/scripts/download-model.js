import fs from 'fs/promises';
import path from 'path';
import https from 'https';

const MODEL_NAME = 'bge-m3';
const MODEL_FILE = 'bge-m3.gguf';
const TARGET_DIR = path.join(process.cwd(), 'server/models/embedding_model');
const MODEL_PATH = path.join(TARGET_DIR, MODEL_FILE);

const MODEL_SOURCES = [
  'https://modelscope.cn/api/v1/models/BAAI/bge-m3/resolve/download',
  'https://huggingface.co/BAAI/bge-m3-gguf/resolve/main/bge-m3-f16.gguf'
];

async function downloadModel(sourceUrl) {
  return new Promise((resolve, reject) => {
    console.log(`\n尝试从 ${sourceUrl} 下载...`);
    
    const fileStream = fs.createWriteStream(MODEL_PATH);
    
    https.get(sourceUrl, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        fileStream.close();
        fs.unlink(MODEL_PATH).catch(() => {});
        downloadModel(response.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        fileStream.close();
        fs.unlink(MODEL_PATH).catch(() => {});
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.pipe(fileStream);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = totalSize > 0 ? ((downloadedSize / totalSize) * 100).toFixed(1) : 'N/A';
        const downloadedMB = (downloadedSize / 1024 / 1024).toFixed(2);
        const totalMB = totalSize > 0 ? (totalSize / 1024 / 1024).toFixed(2) : 'N/A';
        process.stdout.write(`\r进度: ${progress}% (${downloadedMB}MB / ${totalMB}MB)`);
      });
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (error) => {
        fileStream.close();
        fs.unlink(MODEL_PATH).catch(() => {});
        reject(error);
      });
    }).on('error', (error) => {
      fileStream.close();
      fs.unlink(MODEL_PATH).catch(() => {});
      reject(error);
    });
  });
}

async function getModelStats() {
  const stats = await fs.stat(MODEL_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  return sizeMB;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`  BAAI/bge-m3 模型下载工具`);
  console.log(`========================================`);
  console.log(`模型名称: ${MODEL_NAME}`);
  console.log(`目标路径: ${MODEL_PATH}\n`);
  
  try {
    await fs.mkdir(TARGET_DIR, { recursive: true });
    
    try {
      await fs.access(MODEL_PATH);
      const sizeMB = await getModelStats();
      console.log(`\n模型已存在: ${sizeMB}MB`);
      console.log('如需重新下载，请先删除文件:', MODEL_PATH);
      return;
    } catch {
      console.log('模型文件不存在，开始下载...\n');
    }
    
    let lastError = null;
    for (const source of MODEL_SOURCES) {
      try {
        await downloadModel(source);
        console.log('\n\n✓ 下载成功！');
        
        const sizeMB = await getModelStats();
        console.log(`文件大小: ${sizeMB}MB`);
        console.log(`模型路径: ${MODEL_PATH}`);
        console.log('\n下一步:');
        console.log('1. 确保 Ollama 服务已启动');
        console.log('2. 将模型复制到 Ollama 模型目录');
        console.log('3. 运行: ollama create bge-m3 -f Modelfile');
        return;
      } catch (error) {
        lastError = error;
        console.error(`\n✗ 从 ${source} 下载失败:`, error.message);
        try {
          await fs.unlink(MODEL_PATH);
        } catch {}
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error('\n\n========================================');
    console.error('下载失败:', error.message);
    console.error('========================================');
    console.error('\n提示:');
    console.error('1. 检查网络连接');
    console.error('2. 尝试手动下载:');
    console.error(`   - ${MODEL_SOURCES[0]}`);
    console.error(`   - ${MODEL_SOURCES[1]}`);
    console.error('3. 下载后保存到:', MODEL_PATH);
    process.exit(1);
  }
}

main();
