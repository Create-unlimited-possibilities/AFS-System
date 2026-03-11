# 小树洞 (XiaoShuDong) Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new AI chat role "小树洞" (Little Tree Hole) - a psychologist + hidden fortune teller that listens to users, provides comfort, and gives advice based on their natal chart without revealing the fortune-telling aspect.

---

## Architecture Overview (Updated)

### Key Changes from Original Plan
1. **iztro is a JavaScript library** - No Python microservice needed!
2. All natal chart calculations can be done directly in Node.js
3. Horoscope (流年/流月/流日) can be calculated in real-time

### Tech Stack (Updated)
| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Natal Chart | iztro (JavaScript library) |
| LLM (Report) | 8B GGUF model via Ollama |
| Vector DB | ChromaDB |
| Workflow | LangGraph |
| Embedding | BAAI/bge-large-zh-v1.5 |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    XIAOSHUDONG ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input                                                     │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────┐                                            │
│  │  LangGraph      │                                            │
│  │  Workflow       │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│ ┌───────┐   ┌───────────┐                                       │
│ │Emotion│   │  Advice   │                                       │
│ │Branch │   │  Branch   │                                       │
│ └───┬───┘   └─────┬─────┘                                       │
│     │             │                                             │
│     │      ┌──────┴──────┐                                      │
│     │      │             │                                      │
│     │      ▼             ▼                                      │
│     │  ┌────────┐   ┌────────┐                                  │
│     │  │ iztro  │   │ Chroma │                                  │
│     │  │ Chart  │   │  RAG   │                                  │
│     │  └───┬────┘   └───┬────┘                                  │
│     │      │            │                                       │
│     │      └─────┬──────┘                                       │
│     │            ▼                                              │
│     │      ┌───────────┐                                        │
│     │      │ 8B Model  │ (Ollama)                               │
│     │      │ (GGUF)    │                                        │
│     │      └─────┬─────┘                                        │
│     │            │                                              │
│     └─────┬──────┘                                              │
│           │                                                     │
│           ▼                                                     │
│     ┌───────────┐                                               │
│     │  Merge &  │                                               │
│     │  Format   │                                               │
│     └─────┬─────┘                                               │
│           │                                                     │
│           ▼                                                     │
│     User Response                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resources to Migrate

### From ziwei-project (F:\FPY\ziwei-project)

| Resource | Source Path | Destination | Notes |
|----------|-------------|-------------|-------|
| **8B Model** | `models/gguf/DeepSeek-R1-0528-Qwen3-8B-checkpoint-2745_q5_k_m.gguf` | Same location | Already GGUF format |
| **Book Chunks** | `data/rag/chunks/*.jsonl` (5 files, 2,459 chunks) | ChromaDB | Migrate to existing ChromaDB |
| **FAISS Index** | `data/rag/vectorstore/faiss_index/` | - | Reference only, will rebuild in ChromaDB |

### New Dependencies

```json
{
  "iztro": "^2.x.x"
}
```

---

## Phase 1: User Profile Updates

### Task 1.1: Add birthCalendar and birthHourIndex to User Model

**Files:**
- Modify: `server/src/modules/user/model.js`

**Step 1: Add new fields to profile schema**

In `server/src/modules/user/model.js`, add after `birthHour` field:

```javascript
// In profile schema, after birthHour:
birthCalendar: {
  type: String,
  enum: ['solar', 'lunar'],
  default: 'solar'
},
birthHourIndex: {
  type: Number,
  min: 0,
  max: 11,
  default: undefined  // 0-11 时辰索引，由 birthHour 自动计算
},
```

**Step 2: Commit**

```bash
git add server/src/modules/user/model.js
git commit -m "feat(user): add birthCalendar and birthHourIndex fields for ziwei"
```

---

### Task 1.2: Create Time Conversion Utility

**Files:**
- Create: `server/src/core/utils/timeConverter.js`
- Create: `server/tests/unit/timeConverter.test.js`

**Step 1: Write the failing test**

Create `server/tests/unit/timeConverter.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { hourToShichenIndex, shichenIndexToName, getShichenInfo } from '../../src/core/utils/timeConverter.js';

describe('TimeConverter', () => {
  describe('hourToShichenIndex', () => {
    it('should convert 23 to 0 (子时)', () => {
      expect(hourToShichenIndex(23)).toBe(0);
    });
    it('should convert 0 to 0 (子时)', () => {
      expect(hourToShichenIndex(0)).toBe(0);
    });
    it('should convert 1 to 1 (丑时)', () => {
      expect(hourToShichenIndex(1)).toBe(1);
    });
    it('should convert 11 to 6 (午时)', () => {
      expect(hourToShichenIndex(11)).toBe(6);
    });
    it('should convert 12 to 6 (午时)', () => {
      expect(hourToShichenIndex(12)).toBe(6);
    });
    it('should convert 22 to 11 (亥时)', () => {
      expect(hourToShichenIndex(22)).toBe(11);
    });
    it('should throw for invalid hour', () => {
      expect(() => hourToShichenIndex(24)).toThrow('Invalid hour');
      expect(() => hourToShichenIndex(-1)).toThrow('Invalid hour');
    });
  });

  describe('shichenIndexToName', () => {
    it('should return correct Chinese name', () => {
      expect(shichenIndexToName(0)).toBe('子时');
      expect(shichenIndexToName(6)).toBe('午时');
      expect(shichenIndexToName(11)).toBe('亥时');
    });
  });

  describe('getShichenInfo', () => {
    it('should return complete shichen info', () => {
      const info = getShichenInfo(11); // 11:00
      expect(info).toEqual({
        index: 6,
        name: '午时',
        timeRange: '11:00-13:00',
        description: expect.stringContaining('午')
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npm test -- tests/unit/timeConverter.test.js`
Expected: FAIL with "module not found"

**Step 3: Write implementation**

Create `server/src/core/utils/timeConverter.js`:

```javascript
/**
 * 时间转换工具
 * 用于将 0-23 小时制转换为紫微斗数时辰索引 (0-11)
 */

const SHICHEN_MAP = [
  { name: '子时', range: '23:00-01:00', hours: [23, 0] },
  { name: '丑时', range: '01:00-03:00', hours: [1, 2] },
  { name: '寅时', range: '03:00-05:00', hours: [3, 4] },
  { name: '卯时', range: '05:00-07:00', hours: [5, 6] },
  { name: '辰时', range: '07:00-09:00', hours: [7, 8] },
  { name: '巳时', range: '09:00-11:00', hours: [9, 10] },
  { name: '午时', range: '11:00-13:00', hours: [11, 12] },
  { name: '未时', range: '13:00-15:00', hours: [13, 14] },
  { name: '申时', range: '15:00-17:00', hours: [15, 16] },
  { name: '酉时', range: '17:00-19:00', hours: [17, 18] },
  { name: '戌时', range: '19:00-21:00', hours: [19, 20] },
  { name: '亥时', range: '21:00-23:00', hours: [21, 22] },
];

/**
 * 将小时 (0-23) 转换为时辰索引 (0-11)
 * @param {number} hour - 小时 (0-23)
 * @returns {number} 时辰索引 (0-11)
 */
export function hourToShichenIndex(hour) {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour)) {
    throw new Error(`Invalid hour: ${hour}. Must be integer 0-23.`);
  }

  // 子时特殊处理: 23点和0点都是子时
  if (hour === 23) return 0;

  // 其他时辰: hour // 2 + 1
  return Math.floor(hour / 2) + 1;
}

/**
 * 将时辰索引转换为时辰名称
 * @param {number} index - 时辰索引 (0-11)
 * @returns {string} 时辰名称
 */
export function shichenIndexToName(index) {
  if (index < 0 || index > 11) {
    throw new Error(`Invalid shichen index: ${index}. Must be 0-11.`);
  }
  return SHICHEN_MAP[index].name;
}

/**
 * 获取完整的时辰信息
 * @param {number} hour - 小时 (0-23)
 * @returns {Object} 时辰信息
 */
export function getShichenInfo(hour) {
  const index = hourToShichenIndex(hour);
  const shichen = SHICHEN_MAP[index];

  return {
    index,
    name: shichen.name,
    timeRange: shichen.range,
    description: `${shichen.name} (${shichen.range})`,
  };
}

/**
 * 将 gender 转换为 iztro 格式
 * @param {string} gender - 数据库中的性别 ('男' | '女' | '其他')
 * @returns {string} iztro 格式 ('male' | 'female')
 */
export function genderToIztroFormat(gender) {
  if (gender === '男') return 'male';
  if (gender === '女') return 'female';
  // '其他' 默认返回 male (iztro 只接受 male/female)
  return 'male';
}

export default {
  hourToShichenIndex,
  shichenIndexToName,
  getShichenInfo,
  genderToIztroFormat,
  SHICHEN_MAP,
};
```

**Step 4: Run test to verify it passes**

Run: `cd server && npm test -- tests/unit/timeConverter.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/core/utils/timeConverter.js server/tests/unit/timeConverter.test.js
git commit -m "feat(utils): add time converter for hour to shichen conversion"
```

---

### Task 1.3: Update User Service to Auto-calculate birthHourIndex

**Files:**
- Modify: `server/src/modules/user/service.js`

**Step 1: Import timeConverter and add pre-save logic**

In `server/src/modules/user/service.js`, add import at top:

```javascript
import { hourToShichenIndex } from '../../core/utils/timeConverter.js';
```

Find the `updateProfile` function and add auto-calculation:

```javascript
// In updateProfile function, before saving:
if (updateData.birthHour !== undefined && updateData.birthHour !== null) {
  updateData.birthHourIndex = hourToShichenIndex(updateData.birthHour);
}
```

**Step 2: Commit**

```bash
git add server/src/modules/user/service.js
git commit -m "feat(user): auto-calculate birthHourIndex on profile update"
```

---

## Phase 2: iztro Integration

### Task 2.1: Install and Configure iztro

**Files:**
- Modify: `server/package.json`
- Create: `server/src/core/ziwei/ziweiService.js`
- Create: `server/tests/unit/ziweiService.test.js`

**Step 1: Install iztro**

```bash
cd server && npm install iztro -S
```

**Step 2: Create ziwei service**

Create `server/src/core/ziwei/ziweiService.js`:

```javascript
/**
 * 紫微斗数服务
 * 基于 iztro 库
 */
import { astro } from 'iztro';

/**
 * 计算本命盘
 * @param {Object} params - 计算参数
 * @param {string} params.birthDate - 出生日期 (YYYY-MM-DD)
 * @param {number} params.hourIndex - 时辰索引 (0-11)
 * @param {string} params.gender - 性别 ('male' | 'female')
 * @param {boolean} params.isSolar - 是否阳历 (default: true)
 * @returns {Object} 星盘数据
 */
export function computeNatalChart({ birthDate, hourIndex, gender, isSolar = true }) {
  try {
    if (isSolar) {
      return astro.bySolar(birthDate, hourIndex, gender, true, 'zh-CN');
    } else {
      return astro.byLunar(birthDate, hourIndex, gender, false, true, 'zh-CN');
    }
  } catch (error) {
    throw new Error(`Failed to compute natal chart: ${error.message}`);
  }
}

/**
 * 计算运限（流年/流月/流日）
 * @param {Object} astrolabe - 本命盘对象
 * @param {string} targetDate - 目标日期 (YYYY-MM-DD)
 * @returns {Object} 运限数据
 */
export function computeHoroscope(astrolabe, targetDate) {
  try {
    return astrolabe.horoscope(targetDate);
  } catch (error) {
    throw new Error(`Failed to compute horoscope: ${error.message}`);
  }
}

/**
 * 获取简化版命盘数据（用于存储）
 * @param {Object} astrolabe - 完整星盘对象
 * @returns {Object} 简化版数据
 */
export function getSimplifiedChartData(astrolabe) {
  return {
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    time: astrolabe.time,
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    palaces: astrolabe.palaces.map(p => ({
      name: p.name,
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      majorStars: p.majorStars.map(s => ({ name: s.name, brightness: s.brightness })),
      minorStars: p.minorStars.map(s => s.name),
    })),
  };
}

export default {
  computeNatalChart,
  computeHoroscope,
  getSimplifiedChartData,
};
```

**Step 3: Commit**

```bash
git add server/package.json server/src/core/ziwei/ziweiService.js
git commit -m "feat(ziwei): add iztro integration for natal chart computation"
```

---

## Phase 3: Book Chunks Migration to ChromaDB

### Task 3.1: Create Migration Script

**Files:**
- Create: `server/scripts/migrateZiweiBooks.js`

**Source Data:**
- Location: `F:\FPY\ziwei-project\data\rag\chunks\`
- Format: JSONL files (5 books, 2,459 chunks total)
- Fields: `content`, `source`, `chunk_id`

**Embedding Strategy:**
- Use existing Ollama embedding service (bge-m3 model)
- Create new ChromaDB collection: `ziwei_books`

**Step 1: Create migration script**

Create `server/scripts/migrateZiweiBooks.js`:

```javascript
/**
 * 迁移 ziwei-project 书籍 chunks 到 ChromaDB
 *
 * Source: F:\FPY\ziwei-project\data\rag\chunks\
 * Target: ChromaDB collection 'ziwei_books'
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ChromaDBService from '../src/core/storage/chroma.js';
import EmbeddingService from '../src/core/storage/embedding.js';
import logger from '../src/core/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ZIWEI_PROJECT_ROOT = 'F:/FPY/ziwei-project';
const CHUNKS_DIR = path.join(ZIWEI_PROJECT_ROOT, 'data/rag/chunks');
const COLLECTION_NAME = 'ziwei_books';
const BATCH_SIZE = 50; // Process in batches to avoid memory issues

/**
 * Load all JSONL chunks from directory
 */
function loadChunks() {
  const chunks = [];
  const files = fs.readdirSync(CHUNKS_DIR).filter(f => f.endsWith('.jsonl'));

  logger.info(`Found ${files.length} JSONL files to process`);

  for (const file of files) {
    const filePath = path.join(CHUNKS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.content && data.content.trim()) {
          chunks.push({
            content: data.content.trim(),
            source: data.source || path.basename(file, '.jsonl'),
            chunk_id: data.chunk_id || 0,
          });
        }
      } catch (e) {
        logger.warn(`Failed to parse line in ${file}: ${e.message}`);
      }
    }

    logger.info(`  Loaded ${lines.length} chunks from ${file}`);
  }

  return chunks;
}

/**
 * Generate UUID for ChromaDB
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Migrate chunks to ChromaDB
 */
async function migrateChunks() {
  logger.info('Starting ziwei books migration...');

  // Initialize services
  const chromaService = new ChromaDBService();
  const embeddingService = new EmbeddingService();

  await chromaService.initialize();
  await embeddingService.initialize();

  // Create or get collection
  const collection = await chromaService.getCollection(COLLECTION_NAME, {
    description: 'Ziwei fortune-telling book chunks for RAG'
  });

  logger.info(`Collection '${COLLECTION_NAME}' ready`);

  // Load chunks
  const chunks = loadChunks();
  logger.info(`Total chunks to migrate: ${chunks.length}`);

  if (chunks.length === 0) {
    logger.warn('No chunks found to migrate');
    return;
  }

  // Process in batches
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    try {
      // Generate embeddings
      const texts = batch.map(c => c.content);
      const embeddings = await embeddingService.embedDocuments(texts);

      // Prepare data for ChromaDB
      const ids = batch.map((_, idx) => generateUUID());
      const documents = batch.map(c => c.content);
      const metadatas = batch.map(c => ({
        source: c.source,
        chunk_id: c.chunk_id,
        migrated_at: new Date().toISOString()
      }));

      // Add to collection
      await collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      processed += batch.length;
      logger.info(`Progress: ${processed}/${chunks.length} chunks migrated`);
    } catch (error) {
      failed += batch.length;
      logger.error(`Failed to migrate batch ${i}-${i + BATCH_SIZE}:`, error.message);
    }
  }

  // Verify
  const finalCount = await collection.count();
  logger.info(`\n=== Migration Complete ===`);
  logger.info(`Total chunks: ${chunks.length}`);
  logger.info(`Successfully migrated: ${processed}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Collection count: ${finalCount}`);
}

// Run migration
migrateChunks()
  .then(() => {
    logger.info('Migration script finished');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
```

**Step 2: Run migration**

```bash
cd server
node scripts/migrateZiweiBooks.js
```

**Step 3: Verify migration**

```javascript
// In Node.js console or test file
import ChromaDBService from './src/core/storage/chroma.js';

const chroma = new ChromaDBService();
await chroma.initialize();
const collection = await chroma.getCollection('ziwei_books');
const count = await collection.count();
console.log(`Total chunks in collection: ${count}`);
// Expected: ~2,459
```

**Step 4: Commit**

```bash
git add server/scripts/migrateZiweiBooks.js
git commit -m "feat(scripts): add ziwei books migration script to ChromaDB"
```

---

### Task 3.2: Create Ziwei RAG Service

**Files:**
- Create: `server/src/core/ziwei/ziweiRag.js`

**Step 1: Create RAG service**

Create `server/src/core/ziwei/ziweiRag.js`:

```javascript
/**
 * 紫微斗数 RAG 服务
 * 用于检索相关书籍内容
 */
import ChromaDBService from '../storage/chroma.js';
import EmbeddingService from '../storage/embedding.js';
import logger from '../utils/logger.js';

const COLLECTION_NAME = 'ziwei_books';

class ZiweiRagService {
  constructor() {
    this.chromaService = null;
    this.embeddingService = null;
    this.collection = null;
  }

  async initialize() {
    if (this.collection) return;

    this.chromaService = new ChromaDBService();
    this.embeddingService = new EmbeddingService();

    await this.chromaService.initialize();
    await this.embeddingService.initialize();
    this.collection = await this.chromaService.getCollection(COLLECTION_NAME);

    logger.info('[ZiweiRagService] Initialized');
  }

  /**
   * 检索相关书籍内容
   * @param {string} query - 查询文本
   * @param {number} topK - 返回结果数量
   * @returns {Array} 相关内容列表
   */
  async retrieve(query, topK = 5) {
    await this.initialize();

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embedQuery(query);

    // Search in ChromaDB
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK
    });

    // Format results
    if (!results.documents || !results.documents[0]) {
      return [];
    }

    return results.documents[0].map((doc, idx) => ({
      content: doc,
      source: results.metadatas?.[0]?.[idx]?.source || '未知',
      chunk_id: results.metadatas?.[0]?.[idx]?.chunk_id || 0,
      distance: results.distances?.[0]?.[idx] || 0
    }));
  }

  /**
   * 根据宫位或星曜检索相关内容
   * @param {string} palace - 宫位名称
   * @param {string[]} stars - 星曜列表
   * @param {number} topK - 返回结果数量
   * @returns {Array} 相关内容列表
   */
  async retrieveByPalaceAndStars(palace, stars = [], topK = 5) {
    const queryParts = [];
    if (palace) queryParts.push(`${palace}宫`);
    if (stars.length > 0) queryParts.push(stars.join(' '));

    const query = queryParts.join(' ');
    return this.retrieve(query, topK);
  }
}

// Export singleton
export default new ZiweiRagService();
```

**Step 2: Commit**

```bash
git add server/src/core/ziwei/ziweiRag.js
git commit -m "feat(ziwei): add RAG service for book content retrieval"
```

---

## Phase 4: Ollama 8B Model Integration

### Task 4.1: Configure Ollama for 8B Model

**Prerequisites:**
- Ollama installed and running
- 8B GGUF model at: `models/gguf/DeepSeek-R1-0528-Qwen3-8B-checkpoint-2745_q5_k_m.gguf`

**Step 1: Create Ollama Modelfile**

Create `server/config/ziwei-8b.modelfile`:

```
FROM F:/FPY/ziwei-project/models/gguf/DeepSeek-R1-0528-Qwen3-8B-checkpoint-2745_q5_k_m.gguf

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM 你是一位专业的紫微斗数命理分析师。根据用户的命盘信息，提供专业、详细、有深度的命理分析报告。分析要结合传统紫微斗数理论，语言要通俗易懂但保持专业性。
```

**Step 2: Create model in Ollama**

```bash
ollama create ziwei-8b -f server/config/ziwei-8b.modelfile
```

**Step 3: Test model**

```bash
ollama run ziwei-8b "请分析命宫在午宫，有紫微、天府双星坐守的命盘特点"
```

---

### Task 4.2: Create Ziwei LLM Service

**Files:**
- Create: `server/src/core/ziwei/ziweiLlm.js`

**Step 1: Create LLM service**

Create `server/src/core/ziwei/ziweiLlm.js`:

```javascript
/**
 * 紫微斗数 LLM 服务
 * 使用 Ollama 运行 8B 命理报告生成模型
 */
import logger from '../utils/logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const ZIWEI_MODEL = process.env.ZIWEI_MODEL || 'ziwei-8b';

class ZiweiLlmService {
  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
    this.model = ZIWEI_MODEL;
  }

  /**
   * 生成命理报告
   * @param {Object} chartData - 命盘数据
   * @param {string[]} ragContext - RAG 检索的上下文
   * @param {string} userQuestion - 用户问题
   * @returns {string} 生成的报告
   */
  async generateReport(chartData, ragContext = [], userQuestion = '') {
    const prompt = this.buildPrompt(chartData, ragContext, userQuestion);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 4096
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      logger.error('[ZiweiLlmService] Generate report failed:', error);
      throw error;
    }
  }

  /**
   * 构建提示词
   */
  buildPrompt(chartData, ragContext, userQuestion) {
    let prompt = '以下是用户的紫微斗数命盘信息：\n\n';

    // 添加基本信息
    prompt += `公历：${chartData.solarDate}\n`;
    prompt += `农历：${chartData.lunarDate}\n`;
    prompt += `四柱：${chartData.chineseDate}\n`;
    prompt += `生肖：${chartData.zodiac}\n`;
    prompt += `星座：${chartData.sign}\n\n`;

    // 添加宫位信息
    prompt += '十二宫信息：\n';
    for (const palace of chartData.palaces) {
      const majorStars = palace.majorStars.map(s => s.name).join('、');
      prompt += `- ${palace.name}：${majorStars || '无主星'}\n`;
    }

    // 添加 RAG 上下文
    if (ragContext.length > 0) {
      prompt += '\n参考知识：\n';
      for (const ctx of ragContext.slice(0, 3)) {
        prompt += `${ctx.content}\n\n`;
      }
    }

    // 添加用户问题
    if (userQuestion) {
      prompt += `\n用户问题：${userQuestion}\n`;
    }

    prompt += '\n请根据以上命盘信息，提供专业的命理分析。';

    return prompt;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      const hasModel = data.models?.some(m => m.name.includes(this.model));
      return hasModel;
    } catch {
      return false;
    }
  }
}

export default new ZiweiLlmService();
```

**Step 2: Commit**

```bash
git add server/src/core/ziwei/ziweiLlm.js server/config/ziwei-8b.modelfile
git commit -m "feat(ziwei): add LLM service for fortune report generation"
```

---

## Phase 5: LangGraph Workflow for XiaoShuDong

### Task 5.1: Create XiaoShuDong State Class

**Files:**
- Create: `server/src/modules/xiaoshudong/state/XiaoShuDongState.js`

**Step 1: Create state class**

Create `server/src/modules/xiaoshudong/state/XiaoShuDongState.js`:

```javascript
/**
 * XiaoShuDong (小树洞) Conversation State
 * Extended state for fortune-telling chat role
 */
class XiaoShuDongState {
  constructor(initialData = {}) {
    // Base fields
    this.userId = initialData.userId || '';
    this.userName = initialData.userName || '';
    this.messages = initialData.messages || [];
    this.currentInput = initialData.currentInput || '';
    this.generatedResponse = initialData.generatedResponse || '';

    // Intent classification
    this.intent = {
      isEmotional: false,    // 情感倾诉
      needsAdvice: false,    // 需要建议
      confidence: 0
    };

    // Natal chart data
    this.natalChart = initialData.natalChart || null;
    this.horoscope = initialData.horoscope || null;  // 流年/流月数据

    // RAG context
    this.ragContext = [];

    // 8B model response
    this.fortuneResponse = '';

    // Emotional support response
    this.emotionalResponse = '';

    // Final merged response
    this.finalResponse = '';

    // Metadata
    this.metadata = {
      sessionId: initialData.sessionId || '',
      chartRetrieved: false,
      ragRetrieved: false,
      modelUsed: '',
      processingTime: 0,
      ...initialData.metadata
    };

    this.errors = [];
  }

  setState(updates) {
    Object.assign(this, updates);
    return this;
  }

  addMessage(role, content, metadata = {}) {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    return this;
  }

  addError(error) {
    this.errors.push({
      message: error.message,
      timestamp: new Date()
    });
    return this;
  }

  /**
   * Check if user has complete birth info for chart calculation
   */
  hasBirthInfo() {
    return this.natalChart !== null;
  }

  /**
   * Get intent summary for logging
   */
  getIntentSummary() {
    const intents = [];
    if (this.intent.isEmotional) intents.push('情感倾诉');
    if (this.intent.needsAdvice) intents.push('寻求建议');
    return intents.length > 0 ? intents.join(' + ') : '一般对话';
  }
}

export default XiaoShuDongState;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/state/XiaoShuDongState.js
git commit -m "feat(xiaoshudong): add state class for XiaoShuDong workflow"
```

---

### Task 5.2: Create Intent Classifier Node

**Files:**
- Create: `server/src/modules/xiaoshudong/nodes/intentClassifier.js`

**Step 1: Create intent classifier**

Create `server/src/modules/xiaoshudong/nodes/intentClassifier.js`:

```javascript
/**
 * Intent Classifier Node
 * Classifies user intent: emotional support vs advice seeking
 */
import logger from '../../../core/utils/logger.js';

// Keywords for intent detection
const EMOTIONAL_KEYWORDS = [
  '难过', '伤心', '烦恼', '压力', '焦虑', '担心', '害怕', '孤独',
  '不开心', '郁闷', '烦躁', '累', '疲惫', '迷茫', '无助', '委屈',
  '想哭', '难受', '心累', '崩溃', '绝望', '痛苦', '纠结', '矛盾'
];

const ADVICE_KEYWORDS = [
  '怎么办', '怎么做', '建议', '意见', '帮我', '指点', '看看',
  '运势', '命运', '未来', '事业', '财运', '感情', '婚姻', '健康',
  '为什么', '原因', '分析', '解读', '命理', '星盘'
];

/**
 * Classify user intent based on message content
 * @param {XiaoShuDongState} state - Conversation state
 */
export async function intentClassifierNode(state) {
  const input = state.currentInput.toLowerCase();
  logger.info(`[IntentClassifier] Analyzing: "${input.substring(0, 50)}..."`);

  // Count keyword matches
  let emotionalScore = 0;
  let adviceScore = 0;

  for (const keyword of EMOTIONAL_KEYWORDS) {
    if (input.includes(keyword)) {
      emotionalScore += 1;
    }
  }

  for (const keyword of ADVICE_KEYWORDS) {
    if (input.includes(keyword)) {
      adviceScore += 1;
    }
  }

  // Determine intents
  state.intent.isEmotional = emotionalScore > 0;
  state.intent.needsAdvice = adviceScore > 0;

  // If no clear intent, default to emotional support
  if (!state.intent.isEmotional && !state.intent.needsAdvice) {
    state.intent.isEmotional = true;
  }

  // Calculate confidence
  const totalScore = emotionalScore + adviceScore;
  state.intent.confidence = totalScore > 0 ? Math.min(totalScore / 5, 1) : 0.5;

  logger.info(`[IntentClassifier] Result: ${state.getIntentSummary()} (confidence: ${state.intent.confidence})`);

  return state;
}

export default intentClassifierNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/intentClassifier.js
git commit -m "feat(xiaoshudong): add intent classifier node"
```

---

### Task 5.3: Create Chart Retriever Node

**Files:**
- Create: `server/src/modules/xiaoshudong/nodes/chartRetriever.js`

**Step 1: Create chart retriever**

Create `server/src/modules/xiaoshudong/nodes/chartRetriever.js`:

```javascript
/**
 * Chart Retriever Node
 * Retrieves or computes user's natal chart
 */
import { computeNatalChart, computeHoroscope, getSimplifiedChartData } from '../../../core/ziwei/ziweiService.js';
import { genderToIztroFormat } from '../../../core/utils/timeConverter.js';
import User from '../../user/model.js';
import logger from '../../../core/utils/logger.js';

/**
 * Retrieve or compute natal chart for user
 * @param {XiaoShuDongState} state - Conversation state
 */
export async function chartRetrieverNode(state) {
  try {
    logger.info(`[ChartRetriever] Fetching chart for user: ${state.userId}`);

    // Get user profile
    const user = await User.findById(state.userId);
    if (!user) {
      logger.warn(`[ChartRetriever] User not found: ${state.userId}`);
      state.metadata.chartRetrieved = false;
      return state;
    }

    const profile = user.profile || {};
    const birthDate = profile.birthDate;
    const birthHour = profile.birthHour;
    const birthHourIndex = profile.birthHourIndex;
    const birthCalendar = profile.birthCalendar || 'solar';
    const gender = genderToIztroFormat(profile.gender);

    // Check if we have all required fields
    if (!birthDate || birthHourIndex === undefined) {
      logger.warn(`[ChartRetriever] Incomplete birth info for user: ${state.userId}`);
      state.metadata.chartRetrieved = false;
      return state;
    }

    // Format date as YYYY-MM-DD
    const dateStr = typeof birthDate === 'string'
      ? birthDate.split('T')[0]
      : new Date(birthDate).toISOString().split('T')[0];

    // Compute natal chart using iztro
    const astrolabe = computeNatalChart({
      birthDate: dateStr,
      hourIndex: birthHourIndex,
      gender,
      isSolar: birthCalendar === 'solar'
    });

    // Get simplified chart data for storage/display
    state.natalChart = getSimplifiedChartData(astrolabe);

    // Compute current horoscope (流年/流月)
    const today = new Date().toISOString().split('T')[0];
    state.horoscope = computeHoroscope(astrolabe, today);

    state.metadata.chartRetrieved = true;
    logger.info(`[ChartRetriever] Chart computed successfully for ${dateStr}`);

    return state;
  } catch (error) {
    logger.error('[ChartRetriever] Failed to compute chart:', error);
    state.addError(error);
    state.metadata.chartRetrieved = false;
    return state;
  }
}

export default chartRetrieverNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/chartRetriever.js
git commit -m "feat(xiaoshudong): add chart retriever node"
```

---

### Task 5.4: Create RAG Retriever Node

**Files:**
- Create: `server/src/modules/xiaoshudong/nodes/ragRetriever.js`

**Step 1: Create RAG retriever**

Create `server/src/modules/xiaoshudong/nodes/ragRetriever.js`:

```javascript
/**
 * RAG Retriever Node for XiaoShuDong
 * Retrieves relevant book content from ChromaDB
 */
import ziweiRag from '../../../core/ziwei/ziweiRag.js';
import logger from '../../../core/utils/logger.js';

/**
 * Retrieve relevant book content based on chart and user input
 * @param {XiaoShuDongState} state - Conversation state
 */
export async function ragRetrieverNode(state) {
  try {
    logger.info(`[RagRetriever] Retrieving context for: "${state.currentInput.substring(0, 50)}..."`);

    // Build query from chart data and user input
    const queryParts = [state.currentInput];

    // Add palace/star context from chart if available
    if (state.natalChart && state.natalChart.palaces) {
      // Find relevant palaces based on user question
      const input = state.currentInput.toLowerCase();

      const palaceKeywords = {
        '事业': '命宫',
        '财运': '财帛宫',
        '感情': '夫妻宫',
        '婚姻': '夫妻宫',
        '健康': '疾厄宫',
        '家庭': '田宅宫',
        '子女': '子女宫',
        '朋友': '交友宫'
      };

      for (const [keyword, palaceName] of Object.entries(palaceKeywords)) {
        if (input.includes(keyword)) {
          const palace = state.natalChart.palaces.find(p => p.name === palaceName);
          if (palace) {
            const stars = palace.majorStars?.map(s => s.name).join(' ') || '';
            queryParts.push(`${palaceName} ${stars}`);
          }
        }
      }
    }

    const query = queryParts.join(' ');

    // Retrieve from ChromaDB
    const results = await ziweiRag.retrieve(query, 5);

    state.ragContext = results;
    state.metadata.ragRetrieved = results.length > 0;

    logger.info(`[RagRetriever] Retrieved ${results.length} relevant chunks`);

    return state;
  } catch (error) {
    logger.error('[RagRetriever] Failed to retrieve:', error);
    state.addError(error);
    state.metadata.ragRetrieved = false;
    return state;
  }
}

export default ragRetrieverNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/ragRetriever.js
git commit -m "feat(xiaoshudong): add RAG retriever node"
```

---

### Task 5.5: Create Fortune Generator Node

**Files:**
- Create: `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js`

**Step 1: Create fortune generator**

Create `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js`:

```javascript
/**
 * Fortune Generator Node
 * Generates fortune-telling response using 8B model
 */
import ziweiLlm from '../../../core/ziwei/ziweiLlm.js';
import logger from '../../../core/utils/logger.js';

/**
 * Generate fortune-telling response
 * @param {XiaoShuDongState} state - Conversation state
 */
export async function fortuneGeneratorNode(state) {
  try {
    if (!state.natalChart) {
      logger.warn('[FortuneGenerator] No chart available, skipping');
      state.fortuneResponse = '';
      return state;
    }

    logger.info('[FortuneGenerator] Generating fortune response...');

    const response = await ziweiLlm.generateReport(
      state.natalChart,
      state.ragContext,
      state.currentInput
    );

    state.fortuneResponse = response;
    state.metadata.modelUsed = 'ziwei-8b';

    logger.info(`[FortuneGenerator] Generated response: ${response.length} chars`);

    return state;
  } catch (error) {
    logger.error('[FortuneGenerator] Failed to generate:', error);
    state.addError(error);
    state.fortuneResponse = '';
    return state;
  }
}

export default fortuneGeneratorNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/fortuneGenerator.js
git commit -m "feat(xiaoshudong): add fortune generator node"
```

---

### Task 5.6: Create Response Merger Node

**Files:**
- Create: `server/src/modules/xiaoshudong/nodes/responseMerger.js`

**Step 1: Create response merger**

Create `server/src/modules/xiaoshudong/nodes/responseMerger.js`:

```javascript
/**
 * Response Merger Node
 * Merges emotional support and fortune-telling responses
 */
import logger from '../../../core/utils/logger.js';

/**
 * Merge emotional and fortune responses
 * @param {XiaoShuDongState} state - Conversation state
 */
export async function responseMergerNode(state) {
  try {
    logger.info(`[ResponseMerger] Merging responses - Intent: ${state.getIntentSummary()}`);

    const parts = [];

    // If emotional intent, add empathetic opening
    if (state.intent.isEmotional) {
      const emotionalOpenings = [
        '我理解你的感受，',
        '我听到了你的心声，',
        '谢谢你愿意和我分享这些，',
        '我能感受到你现在的心情，'
      ];
      const opening = emotionalOpenings[Math.floor(Math.random() * emotionalOpenings.length)];
      parts.push(opening);
    }

    // If advice intent and we have fortune response
    if (state.intent.needsAdvice && state.fortuneResponse) {
      if (parts.length > 0) {
        parts.push('\n\n');
      }
      parts.push(state.fortuneResponse);
    }

    // If emotional only with no fortune, add supportive closing
    if (state.intent.isEmotional && !state.intent.needsAdvice) {
      const supportiveClosings = [
        '无论遇到什么困难，都要相信一切都会好起来的。',
        '你的感受是真实的，给自己一些时间和空间。',
        '记住，你并不孤单，我一直在这里陪伴你。'
      ];
      parts.push(supportiveClosings[Math.floor(Math.random() * supportiveClosings.length)]);
    }

    state.finalResponse = parts.join('').trim();

    // Fallback if empty
    if (!state.finalResponse) {
      state.finalResponse = '我在这里倾听你的心声。有什么想和我分享的吗？';
    }

    logger.info(`[ResponseMerger] Final response: ${state.finalResponse.length} chars`);

    return state;
  } catch (error) {
    logger.error('[ResponseMerger] Failed to merge:', error);
    state.addError(error);
    state.finalResponse = '抱歉，我暂时无法回应。请稍后再试。';
    return state;
  }
}

export default responseMergerNode;
```

**Step 2: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/responseMerger.js
git commit -m "feat(xiaoshudong): add response merger node"
```

---

### Task 5.7: Create XiaoShuDong Orchestrator

**Files:**
- Create: `server/src/modules/xiaoshudong/orchestrator.js`
- Create: `server/src/modules/xiaoshudong/edges.js`

**Step 1: Create edges configuration**

Create `server/src/modules/xiaoshudong/edges.js`:

```javascript
/**
 * Edge definitions for XiaoShuDong workflow
 */

// Default edge flow
export const edges = {
  'intent_classifier': 'chart_retriever',
  'chart_retriever': 'rag_retriever',
  'rag_retriever': 'fortune_generator',
  'fortune_generator': 'response_merger',
  'response_merger': 'output'
};

/**
 * Conditional edges based on intent
 */
export function getNextNode(currentNode, state) {
  // After intent classification, decide which branches to run
  if (currentNode === 'intent_classifier') {
    // If needs advice, run chart/rag/fortune pipeline
    if (state.intent.needsAdvice) {
      return 'chart_retriever';
    }
    // If only emotional, skip to response merger
    if (state.intent.isEmotional && !state.intent.needsAdvice) {
      return 'response_merger';
    }
    return 'chart_retriever';
  }

  // After chart retriever, check if we got chart
  if (currentNode === 'chart_retriever') {
    if (!state.metadata.chartRetrieved) {
      // No chart, skip to response merger
      return 'response_merger';
    }
    return 'rag_retriever';
  }

  // Default flow
  return edges[currentNode] || 'output';
}

export default { edges, getNextNode };
```

**Step 2: Create orchestrator**

Create `server/src/modules/xiaoshudong/orchestrator.js`:

```javascript
/**
 * XiaoShuDong Orchestrator
 * Manages the LangGraph workflow for XiaoShuDong chat
 */
import XiaoShuDongState from './state/XiaoShuDongState.js';
import { intentClassifierNode } from './nodes/intentClassifier.js';
import { chartRetrieverNode } from './nodes/chartRetriever.js';
import { ragRetrieverNode } from './nodes/ragRetriever.js';
import { fortuneGeneratorNode } from './nodes/fortuneGenerator.js';
import { responseMergerNode } from './nodes/responseMergerNode.js';
import { getNextNode } from './edges.js';
import logger from '../../core/utils/logger.js';

class XiaoShuDongOrchestrator {
  constructor() {
    this.nodes = {
      'intent_classifier': intentClassifierNode,
      'chart_retriever': chartRetrieverNode,
      'rag_retriever': ragRetrieverNode,
      'fortune_generator': fortuneGeneratorNode,
      'response_merger': responseMergerNode
    };

    this.activeSessions = new Map();
  }

  /**
   * Process a message through the workflow
   * @param {string} userId - User ID
   * @param {string} message - User message
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response
   */
  async processMessage(userId, message, options = {}) {
    const startTime = Date.now();

    try {
      logger.info(`[XiaoShuDong] Processing message for user: ${userId}`);

      // Get or create session state
      let state = this.activeSessions.get(userId);
      if (!state) {
        state = new XiaoShuDongState({
          userId,
          sessionId: `xsd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        });
      }

      state.currentInput = message;
      state.metadata.processingTime = 0;

      // Execute workflow
      let currentNode = 'intent_classifier';

      while (currentNode && currentNode !== 'output') {
        const nodeFunction = this.nodes[currentNode];
        if (!nodeFunction) {
          throw new Error(`Node not found: ${currentNode}`);
        }

        logger.info(`[XiaoShuDong] Executing node: ${currentNode}`);
        await nodeFunction(state);

        currentNode = getNextNode(currentNode, state);
      }

      // Calculate processing time
      state.metadata.processingTime = Date.now() - startTime;

      // Add message to history
      state.addMessage('user', message);
      state.addMessage('assistant', state.finalResponse);

      // Cache state
      this.activeSessions.set(userId, state);

      logger.info(`[XiaoShuDong] Completed in ${state.metadata.processingTime}ms`);

      return {
        success: true,
        response: state.finalResponse,
        intent: state.getIntentSummary(),
        metadata: state.metadata
      };

    } catch (error) {
      logger.error('[XiaoShuDong] Processing failed:', error);
      return {
        success: false,
        error: error.message,
        response: '抱歉，我现在有点累了，请稍后再和我聊天吧。'
      };
    }
  }

  /**
   * End session for user
   */
  endSession(userId) {
    this.activeSessions.delete(userId);
    logger.info(`[XiaoShuDong] Session ended for user: ${userId}`);
  }
}

// Export singleton
export default new XiaoShuDongOrchestrator();
```

**Step 3: Commit**

```bash
git add server/src/modules/xiaoshudong/orchestrator.js server/src/modules/xiaoshudong/edges.js
git commit -m "feat(xiaoshudong): add orchestrator and edge definitions"
```

---

## Phase 6: API & Frontend Integration

### Task 6.1: Create XiaoShuDong Routes

**Files:**
- Create: `server/src/modules/xiaoshudong/route.js`
- Create: `server/src/modules/xiaoshudong/controller.js`

**Step 1: Create controller**

Create `server/src/modules/xiaoshudong/controller.js`:

```javascript
/**
 * XiaoShuDong Controller
 */
import orchestrator from './orchestrator.js';
import logger from '../../core/utils/logger.js';

class XiaoShuDongController {
  /**
   * Send message to XiaoShuDong
   */
  async sendMessage(req, res) {
    try {
      const userId = req.user?.id;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: '消息不能为空'
        });
      }

      const result = await orchestrator.processMessage(userId, message.trim());

      return res.json({
        success: result.success,
        response: result.response,
        intent: result.intent,
        metadata: result.metadata
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] sendMessage error:', error);
      return res.status(500).json({
        success: false,
        error: '发送消息失败'
      });
    }
  }

  /**
   * End XiaoShuDong session
   */
  async endSession(req, res) {
    try {
      const userId = req.user?.id;
      orchestrator.endSession(userId);

      return res.json({
        success: true,
        message: '会话已结束'
      });

    } catch (error) {
      logger.error('[XiaoShuDongController] endSession error:', error);
      return res.status(500).json({
        success: false,
        error: '结束会话失败'
      });
    }
  }
}

export default new XiaoShuDongController();
```

**Step 2: Create routes**

Create `server/src/modules/xiaoshudong/route.js`:

```javascript
/**
 * XiaoShuDong Routes
 */
import express from 'express';
import controller from './controller.js';
import authMiddleware from '../auth/middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.requireAuth);

// Send message to XiaoShuDong
router.post('/message', controller.sendMessage.bind(controller));

// End session
router.post('/end', controller.endSession.bind(controller));

export default router;
```

**Step 3: Register routes in server.js**

In `server/src/server.js`, add:

```javascript
import xiaoshudongRoutes from './modules/xiaoshudong/route.js';
// ... other imports

// Register routes
app.use('/api/xiaoshudong', xiaoshudongRoutes);
```

**Step 4: Commit**

```bash
git add server/src/modules/xiaoshudong/route.js server/src/modules/xiaoshudong/controller.js server/src/server.js
git commit -m "feat(xiaoshudong): add API routes and controller"
```

---

## Summary

### Implementation Order

1. **Phase 1**: User Profile Updates (Tasks 1.1-1.3)
2. **Phase 2**: iztro Integration (Task 2.1)
3. **Phase 3**: Book Chunks Migration (Tasks 3.1-3.2)
4. **Phase 4**: Ollama 8B Model Integration (Tasks 4.1-4.2)
5. **Phase 5**: LangGraph Workflow (Tasks 5.1-5.7)
6. **Phase 6**: API & Frontend (Task 6.1)

### Testing Checklist

- [ ] Time conversion utility tests pass
- [ ] iztro natal chart computation works
- [ ] Book chunks migrated to ChromaDB (2,459 items)
- [ ] Ollama ziwei-8b model responds correctly
- [ ] Intent classifier correctly identifies emotional vs advice intents
- [ ] Full workflow processes messages end-to-end
- [ ] API endpoints respond correctly

### Dependencies

```json
{
  "iztro": "^2.x.x"
}
```

### Environment Variables

```env
# Ziwei 8B Model
ZIWEI_MODEL=ziwei-8b
OLLAMA_BASE_URL=http://localhost:11434

# ChromaDB
CHROMA_URL=http://localhost:8000

# Embedding
EMBEDDING_BACKEND=ollama
EMBEDDING_MODEL=bge-m3
```

---

## CRITICAL UPDATE: Two-Phase Workflow Design (IMPORTANT)

> ⚠️ **This section supersedes the original Phase 5 design**

### Design Philosophy

**The user's inner voice must emerge BEFORE giving any advice.**

1. **Phase 1 (倾听阶段)**: User shares feelings, AI responds with empathy only. NO immediate advice.
2. **Phase 2 (探索方向)**: Only triggered when user asks for advice or their inner voice emerges.

### Two-Phase Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    XIAOSHUDONG TWO-PHASE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 1: LISTENING (倾听阶段)                        │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │   User Input                                                          │ │
│  │       │                                                               │ │
│  │       ▼                                                               │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ Emotion         │                                                 │ │
│  │   │ Classifier      │                                                 │ │
│  │   └────────┬────────┘                                                 │ │
│  │            │                                                          │ │
│  │            ▼                                                          │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ Empathy         │◄────────────────────────────────────┐           │ │
│  │   │ Response        │  (Continue listening, NO advice)    │           │ │
│  │   │ Generator       │                                     │           │ │
│  │   └────────┬────────┘                                     │           │ │
│  │            │                                               │           │ │
│  │            ▼                                               │           │ │
│  │   ┌─────────────────────────────────────────────────┐     │           │ │
│  │   │ Phase Transition Check:                          │     │           │ │
│  │   │ - User explicitly asks "what should I do?"       │     │           │ │
│  │   │ - User's inner voice emerges (情绪稳定后开始思考) │     │           │ │
│  │   │ - User requests guidance                         │     │           │ │
│  │   └────────┬────────────────────────────────────────┘     │           │ │
│  │            │                                               │           │ │
│  │     NO     │ (Still listening)                             │           │ │
│  │     └──────┼───────────────────────────────────────────────┘           │ │
│  │            │ YES (Ready for Phase 2)                                    │ │
│  │            │                                                            │ │
│  └────────────┼────────────────────────────────────────────────────────────┘ │
│               │                                                              │
│               ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    PHASE 2: EXPLORATION (探索方向)                      │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ Chart Retriever │ (iztro - natal chart)                          │ │
│  │   └────────┬────────┘                                                 │ │
│  │            │                                                          │ │
│  │            ▼                                                          │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ RAG Retriever   │ (ChromaDB - book chunks)                       │ │
│  │   └────────┬────────┘                                                 │ │
│  │            │                                                          │ │
│  │            ▼                                                          │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ 8B Model        │ (Ollama - generate guidance)                   │ │
│  │   │ (Internal Only) │                                                 │ │
│  │   └────────┬────────┘                                                 │ │
│  │            │                                                          │ │
│  │            ▼                                                          │ │
│  │   ┌─────────────────────────────────────────────────────────────┐     │ │
│  │   │              RESPONSE POLISHER (润色节点) ★ CRITICAL ★        │     │ │
│  │   ├─────────────────────────────────────────────────────────────┤     │ │
│  │   │  PURPOSE: Hide ALL fortune-telling keywords                  │     │ │
│  │   │                                                               │     │ │
│  │   │  Language Transformations:                                    │     │ │
│  │   │  ┌──────────────────┬───────────────────────────────────┐     │     │ │
│  │   │  │ Fortune Term     │ Psychologist Term                  │     │     │ │
│  │   │  ├──────────────────┼───────────────────────────────────┤     │     │ │
│  │   │  │ 命理             │ 心理                               │     │     │ │
│  │   │  │ 运势             │ 状态                               │     │     │ │
│  │   │  │ 星盘/命盘        │ (removed)                          │     │     │ │
│  │   │  │ 命宫             │ 内心核心                           │     │     │ │
│  │   │  │ 流年             │ 当前阶段                           │     │     │ │
│  │   │  │ 宫位             │ 人生领域                           │     │     │ │
│  │   │  │ 星曜             │ (removed or transformed)           │     │     │ │
│  │   │  │ 四化             │ 转变                               │     │     │ │
│  │   │  └──────────────────┴───────────────────────────────────┘     │     │ │
│  │   │                                                               │     │ │
│  │   │  System Prompt for Polisher:                                  │     │ │
│  │   │  "You are a warm, empathetic psychologist. Transform the      │     │ │
│  │   │   following internal guidance into natural, supportive        │     │ │
│  │   │   language. NEVER use fortune-telling terms."                 │     │ │
│  │   └────────┬────────────────────────────────────────────────────┘     │ │
│  │            │                                                          │ │
│  │            ▼                                                          │ │
│  │   ┌─────────────────┐                                                 │ │
│  │   │ Output to User  │                                                 │ │
│  │   └─────────────────┘                                                 │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│        USER ONLY SEES:                                                      │
│        "I understand how you're feeling. Based on what you've shared,       │
│         here's what might help you move forward..."                         │
│        (No fortune-telling keywords visible)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### State Tracking for Phase Transition

```javascript
// In XiaoShuDongState, add:
this.phase = 'listening';  // 'listening' | 'exploration'
this.emotionalTurns = 0;   // Count of pure emotional exchanges
this.innerVoiceDetected = false;  // Set when user starts asking "why" or "how"
```

### Phase Transition Conditions

```javascript
function shouldTransitionToExploration(state) {
  // Condition 1: User explicitly asks for advice
  const advicePhrases = ['怎么办', '怎么做', '给我建议', '帮我看看', '有什么办法'];
  if (advicePhrases.some(p => state.currentInput.includes(p))) {
    return true;
  }

  // Condition 2: Emotional turns threshold reached AND user starts reflecting
  if (state.emotionalTurns >= 3 && state.innerVoiceDetected) {
    return true;
  }

  // Condition 3: User explicitly asks about future/direction
  const directionPhrases = ['接下来', '未来', '方向', '怎么走'];
  if (directionPhrases.some(p => state.currentInput.includes(p))) {
    return true;
  }

  return false;
}
```

---

## Phase 7: Frontend Integration

### Task 7.1: Add XiaoShuDong Entry to AI Chat List

**Files:**
- Modify: `web/app/chat/components/UserList.tsx` (or equivalent)
- Modify: `web/app/chat/page.tsx`

**Requirements:**
1. No avatar display for XiaoShuDong
2. Entry appears at top of chat list (置顶)
3. Special UI style to distinguish from other roles
4. Welcome message on new conversation: "HI，{username}，今天有什么心事要和我分享吗？"

**Step 1: Add XiaoShuDong to chat list**

```typescript
// In UserList.tsx or equivalent
const XIAOSHUDONG_ENTRY = {
  id: 'xiaoshudong',
  name: '小树洞',
  type: 'system_role',
  isPinned: true,
  description: '一个愿意倾听你心声的树洞',
  noAvatar: true
};
```

**Step 2: Special styling**

```css
/* XiaoShuDong special styling */
.xiaoshudong-entry {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  border-left: 3px solid #8b9dc3;
}

.xiaoshudong-entry::before {
  content: '🤍';
  margin-right: 8px;
}
```

---

### Task 7.2: Chat Interface for XiaoShuDong

**Files:**
- Create: `web/app/chat/xiaoshudong/page.tsx`
- Create: `web/components/chat/XiaoShuDongChat.tsx`

**Requirements:**
1. Reuse existing ChatPanel component
2. Add "正在思考..." status indicator (no typing animation)
3. Welcome message on first entry
4. Pinned at top

**Step 1: Create XiaoShuDong chat component**

```typescript
// web/components/chat/XiaoShuDongChat.tsx
'use client';

import { useState, useEffect } from 'react';
import ChatPanel from './ChatPanel';
import { useAuth } from '@/hooks/useAuth';

export default function XiaoShuDongChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(true);

  // Welcome message on first load
  useEffect(() => {
    if (isNewConversation && user?.name) {
      const welcomeMessage = {
        role: 'assistant',
        content: `HI，${user.name}，今天有什么心事要和我分享吗？`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      setIsNewConversation(false);
    }
  }, [user?.name, isNewConversation]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage = { role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);

    // Show thinking status
    setIsThinking(true);

    try {
      const response = await fetch('/api/xiaoshudong/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      });

      const data = await response.json();

      // Add assistant message
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="xiaoshudong-chat">
      {/* Thinking indicator */}
      {isThinking && (
        <div className="thinking-indicator">
          正在思考...
        </div>
      )}

      {/* Reuse ChatPanel */}
      <ChatPanel
        messages={messages}
        onSendMessage={handleSendMessage}
        disabled={isThinking}
      />
    </div>
  );
}
```

**Step 2: Thinking indicator styles**

```css
.thinking-indicator {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  z-index: 100;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
```

---

### Task 7.3: Profile Page - Birth Calendar Field

**Files:**
- Modify: `web/app/profile/page.tsx`

**Requirements:**
1. Add `birthCalendar` selector (阳历/农历)
2. Show friendly time display (birthHourIndex → 时辰名)

**Step 1: Add calendar selector**

```typescript
// In profile form
<FormItem label="历法类型">
  <Select
    value={profile.birthCalendar || 'solar'}
    onValueChange={(value) => setProfile({ ...profile, birthCalendar: value })}
  >
    <SelectItem value="solar">阳历</SelectItem>
    <SelectItem value="lunar">农历</SelectItem>
  </Select>
</FormItem>
```

**Step 2: Display shichen name**

```typescript
// Convert birthHourIndex to shichen name
const SHICHEN_NAMES = [
  '子时 (23:00-01:00)', '丑时 (01:00-03:00)', '寅时 (03:00-05:00)',
  '卯时 (05:00-07:00)', '辰时 (07:00-09:00)', '巳时 (09:00-11:00)',
  '午时 (11:00-13:00)', '未时 (13:00-15:00)', '申时 (15:00-17:00)',
  '酉时 (17:00-19:00)', '戌时 (19:00-21:00)', '亥时 (21:00-23:00)'
];

const displayShichen = profile.birthHourIndex !== undefined
  ? SHICHEN_NAMES[profile.birthHourIndex]
  : '未设置';
```

---

### Task 7.4: Birth Info Check on XiaoShuDong Entry

**Files:**
- Modify: `web/app/chat/xiaoshudong/page.tsx`

**Requirements:**
1. Check if user has complete birth info
2. If not, allow chat but show gentle reminder
3. Link to profile page

**Step 1: Birth info check**

```typescript
// On component mount
useEffect(() => {
  const checkBirthInfo = async () => {
    const response = await fetch('/api/user/profile');
    const profile = await response.json();

    const hasCompleteInfo = profile.birthDate &&
                            profile.birthHour !== undefined &&
                            profile.birthCalendar;

    setHasBirthInfo(hasCompleteInfo);
  };

  checkBirthInfo();
}, []);

// Render reminder if no birth info
{!hasBirthInfo && (
  <div className="birth-info-reminder">
    <p>完善出生信息后，我可以给你更个性化的建议 💡</p>
    <Link href="/profile">去完善</Link>
  </div>
)}
```

---

## Updated Summary

### Implementation Order (Final)

1. **Phase 1**: User Profile Updates (Tasks 1.1-1.3)
2. **Phase 2**: iztro Integration (Task 2.1)
3. **Phase 3**: Book Chunks Migration (Tasks 3.1-3.2)
4. **Phase 4**: Ollama 8B Model Integration (Tasks 4.1-4.2)
5. **Phase 5**: LangGraph Workflow (Tasks 5.1-5.7) - **USE TWO-PHASE DESIGN**
6. **Phase 6**: API Routes (Task 6.1)
7. **Phase 7**: Frontend Integration (Tasks 7.1-7.4)

### Key Design Principle

> **Fortune-telling is 100% HIDDEN**
>
> User NEVER sees: 命理, 占卜, 星盘, 运势, 命宫, 流年, etc.
>
> User ONLY sees: A warm psychologist giving supportive advice
