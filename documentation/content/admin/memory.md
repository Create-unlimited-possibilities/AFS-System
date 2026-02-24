---
sidebar_position: 4
---

# Memory Management

The Memory Management module provides tools for monitoring and managing user memory data and vector indexes in the AFS System.

## Architecture Level

### Module Structure

```
Memory Management Module
├── Backend (server/src/modules/admin/)
│   ├── controller.js - getUserMemories(), rebuildUserVectorIndex(), etc.
│   ├── service.js - Memory aggregation, vector index operations
│   └── route.js - API endpoints (/admin/memories/*)
│
└── Frontend (web/app/admin/memories/)
    ├── page.tsx - User memory summaries list
    └── components/
        ├── UserMemoryList.tsx - List of users with memory stats
        └── MemoryDetail.tsx - Individual user's memory detail view
```

### Memory Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Questionnaire  │────▶│     Answer      │────▶│   Memory Store  │
│     Answers     │     │    Records      │     │   (MongoDB)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │  Vector Index   │
                                                  │  (ChromaDB)     │
                                                  │  Collection:    │
                                                  │  user_{userId}  │
                                                  └─────────────────┘
```

### Memory Types

The system tracks multiple types of memories:

| Category | Source | Description |
|----------|--------|-------------|
| self | Elder role answers | Information about the user themselves |
| family | Family role answers | Information about family members |
| friend | Friend role answers | Information about friends |
| conversation | Chat extraction | Memories extracted from conversations |

## Function Level

### Features

#### 1. User Memory Summaries

**Endpoint**: `GET /api/admin/memories/user-summaries`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| search | string | Search by name, email, or uniqueCode |
| hasVectorIndex | boolean | Filter by vector index existence |

**Response**:
```typescript
{
  success: true,
  users: UserMemorySummary[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

interface UserMemorySummary {
  _id: string;
  name: string;
  uniqueCode: string;
  email: string;
  memoryCount: number;
  vectorIndexExists: boolean;
  lastMemoryUpdate?: string;
  roleCardGenerated?: boolean;
}
```

#### 2. Get User Memories

**Endpoint**: `GET /api/admin/memories/:userId`

**Response**:
```typescript
{
  success: true,
  memories: UserMemory[],
  vectorIndex: {
    exists: boolean,
    memoryCount: number,
    hasRoleCard: boolean,
    canBuild: boolean,
    totalDocuments: number,
    collectionName: string,
    lastBuildTime?: string
  }
}

interface UserMemory {
  _id: string;
  userId: string;
  category: 'self' | 'family' | 'friend' | 'conversation';
  content: string;
  sourceType: 'answer' | 'manual' | 'imported' | 'conversation';
  tags?: string[];
  partnerId?: string;  // For conversation memories
  indexed?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### 3. Vector Index Status

**Endpoint**: `GET /api/admin/memories/:userId/vector-status`

**Response**:
```typescript
{
  success: true,
  status: {
    exists: boolean,
    memoryCount: number,
    hasRoleCard: boolean,
    canBuild: boolean,
    totalDocuments: number,
    collectionName: string,
    lastBuildTime?: string
  }
}
```

#### 4. Rebuild Vector Index

**Endpoint**: `POST /api/admin/memories/:userId/rebuild-index`

**Behavior**:
1. Clears existing vector index for the user
2. Re-embeds all memory data
3. Creates new ChromaDB collection
4. Updates index metadata

**Response**:
```typescript
{
  success: true,
  message: '向量索引重建成功'
}
```

#### 5. Export User Memories

**Endpoint**: `GET /api/admin/memories/:userId/export`

**Response**:
```typescript
{
  success: true,
  data: {
    user: {
      id: string,
      name: string,
      email: string,
      uniqueCode: string,
      createdAt: string
    },
    memories: UserMemory[],
    vectorStatus: object,
    exportDate: string
  }
}
```

#### 6. Delete Memory

**Endpoint**: `DELETE /api/admin/memories/:userId/memories/:memoryId`

**Behavior**: Deletes a specific memory record. Note: This does NOT automatically rebuild the vector index.

## Code Level

### Backend: Get User Memory Summaries

**File**: `server/src/modules/admin/service.js`

```javascript
async getUserMemorySummaries({ page = 1, limit = 20, search = '' }) {
  const query = {};

  // Search by name, email, or uniqueCode
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { uniqueCode: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  // Get users with pagination
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  // Get memory counts and vector index status for each user
  const VectorIndexService = (await import('../../core/storage/vector.js')).default;
  const vectorService = new VectorIndexService();

  const userSummaries = await Promise.all(
    users.map(async (user) => {
      // Count memories (Answer records where targetUserId = user._id)
      const memoryCount = await Answer.countDocuments({ targetUserId: user._id });

      // Get last memory update time
      const lastMemory = await Answer.findOne({ targetUserId: user._id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();

      // Check if vector index exists
      let vectorIndexExists = false;
      try {
        vectorIndexExists = await vectorService.indexExists(String(user._id));
      } catch (error) {
        logger.warn(`[AdminService] Failed to check vector index for user ${user._id}`);
      }

      // Check if roleCard is generated
      const roleCardGenerated = !!(user.companionChat?.roleCard &&
        (user.companionChat.roleCard.personality ||
         user.companionChat.roleCard.background ||
         user.companionChat.roleCard.generatedAt));

      return {
        _id: String(user._id),
        id: String(user._id),
        name: user.name,
        uniqueCode: user.uniqueCode,
        email: user.email,
        memoryCount,
        vectorIndexExists,
        lastMemoryUpdate: lastMemory?.createdAt?.toISOString() || null,
        roleCardGenerated
      };
    })
  );

  return {
    users: userSummaries,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

### Backend: Get User Memories

**File**: `server/src/modules/admin/service.js`

```javascript
async getUserMemories(userId) {
  // Validate user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const memories = [];

  // 1. Get questionnaire answers for this user
  const answers = await Answer.find({ targetUserId: userId })
    .populate('userId', 'name email uniqueCode')
    .populate('questionId', 'question role layer')
    .sort({ createdAt: -1 })
    .lean();

  // Transform Answer documents to UserMemory format
  for (const answer of answers) {
    const roleToCategory = {
      'elder': 'self',
      'family': 'family',
      'friend': 'friend'
    };
    const role = answer.questionId?.role || 'elder';
    const category = roleToCategory[role] || 'self';

    memories.push({
      _id: String(answer._id),
      userId: String(answer.targetUserId?._id || answer.targetUserId),
      category: category,
      content: answer.answer || answer.content || '',
      sourceType: 'answer',
      tags: answer.tags || [],
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt || answer.createdAt
    });
  }

  // 2. Get conversation memories from MemoryStore
  try {
    const MemoryStore = (await import('../memory/MemoryStore.js')).default;
    const memoryStore = new MemoryStore();
    const conversationMemories = await memoryStore.loadUserMemories(userId);

    for (const [partnerId, partnerMemories] of Object.entries(conversationMemories)) {
      for (const mem of partnerMemories) {
        let content = '';
        if (mem.content?.processed?.summary) {
          content = mem.content.processed.summary;
        } else if (mem.content?.processed?.keyTopics?.length > 0) {
          content = `话题: ${mem.content.processed.keyTopics.join(', ')}`;
        } else if (mem.content?.raw) {
          content = mem.content.raw.substring(0, 200) + '...';
        }

        memories.push({
          _id: mem.memoryId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: String(userId),
          category: 'conversation',
          content: content || '(对话记忆)',
          sourceType: 'conversation',
          tags: mem.tags || [],
          partnerId: partnerId,
          indexed: mem.vectorIndex?.indexed || false,
          createdAt: mem.meta?.createdAt || new Date().toISOString(),
          updatedAt: mem.meta?.compressedAt || mem.meta?.createdAt || new Date().toISOString()
        });
      }
    }
  } catch (error) {
    logger.debug('[AdminService] No conversation memories found for user:', userId);
  }

  // Sort all memories by createdAt descending
  memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Get vector index status
  let vectorIndex = null;
  try {
    const VectorIndexService = (await import('../../core/storage/vector.js')).default;
    const vectorService = new VectorIndexService();
    const stats = await vectorService.getStats(userId);
    const indexExists = await vectorService.indexExists(userId);

    vectorIndex = {
      exists: indexExists,
      memoryCount: stats.totalDocuments || 0,
      hasRoleCard: hasRoleCard,
      canBuild: memoryCount > 0,
      totalDocuments: stats.totalDocuments || 0,
      collectionName: stats.collectionName || `user_${userId}`,
      lastBuildTime: memories.length > 0 ? memories[0].createdAt : null
    };
  } catch (error) {
    logger.warn('[AdminService] Failed to get vector index status:', error.message);
  }

  return {
    memories,
    vectorIndex
  };
}
```

### Backend: Rebuild Vector Index

**File**: `server/src/modules/admin/service.js`

```javascript
async rebuildUserVectorIndex(userId) {
  // Validate user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  try {
    const VectorIndexService = (await import('../../core/storage/vector.js')).default;
    const vectorService = new VectorIndexService();

    // Rebuild the index
    const result = await vectorService.rebuildIndex(userId);

    return {
      message: '向量索引重建成功',
      ...result
    };
  } catch (error) {
    logger.error('[AdminService] Failed to rebuild vector index:', error);
    throw new Error(`向量索引重建失败: ${error.message}`);
  }
}
```

### Frontend: Memories Page

**File**: `web/app/admin/memories/page.tsx`

```typescript
export default function MemoriesPage() {
  const [userSummaries, setUserSummaries] = useState<UserMemorySummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMemories: 0,
    indexedUsers: 0,
    roleCardGenerated: 0,
  });

  const loadUserSummaries = async () => {
    const result = await getUserMemories({ search: searchQuery || undefined });
    if (result.success && result.users) {
      setUserSummaries(result.users);
      setStats({
        totalUsers: result.pagination?.total ?? result.users.length,
        totalMemories: result.users.reduce((sum, u) => sum + u.memoryCount, 0),
        indexedUsers: result.users.filter(u => u.vectorIndexExists).length,
        roleCardGenerated: result.users.filter(u => u.roleCardGenerated).length,
      });
    }
  };

  const handleSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    // User details will be loaded by MemoryDetail component
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
            <CardDescription>总用户数</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{stats.totalMemories}</CardTitle>
            <CardDescription>总记忆数</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-blue-600">{stats.indexedUsers}</CardTitle>
            <CardDescription>已建索引</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-green-600">{stats.roleCardGenerated}</CardTitle>
            <CardDescription>角色卡已生成</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* User List or Detail View */}
      {selectedUserId ? (
        <MemoryDetail
          userId={selectedUserId}
          onBack={() => setSelectedUserId(null)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>选择用户查看记忆数据</CardDescription>
          </CardHeader>
          <CardContent>
            <UserMemoryList
              users={userSummaries}
              onSelectUser={handleSelectUser}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Frontend: Memory Detail Component

**File**: `web/app/admin/memories/components/MemoryDetail.tsx`

```typescript
interface MemoryDetailProps {
  userId: string;
  user?: AdminUser | null;
  onBack: () => void;
  onRefresh?: () => void;
}

export function MemoryDetail({ userId, user, onBack, onRefresh }: MemoryDetailProps) {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [vectorStatus, setVectorStatus] = useState<VectorIndexStatus | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [userId]);

  const loadMemories = async () => {
    const result = await getUserMemoryData(userId);
    if (result.success) {
      setMemories(result.memories || []);
      setVectorStatus(result.vectorIndex || null);
    }
  };

  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    const result = await rebuildVectorIndex(userId);
    if (result.success) {
      await loadMemories();
      onRefresh?.();
    }
    setIsRebuilding(false);
  };

  const handleExport = async () => {
    const result = await exportUserMemories(userId);
    if (result.success && result.data) {
      const dataStr = JSON.stringify(result.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memories-${userId}-${Date.now()}.json`;
      a.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>记忆详情 - {user?.name}</CardTitle>
            <CardDescription>
              共 {memories.length} 条记忆
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              返回列表
            </Button>
            <Button variant="outline" onClick={handleExport}>
              导出数据
            </Button>
            <Button
              onClick={handleRebuildIndex}
              disabled={isRebuilding || !vectorStatus?.canBuild}
            >
              {isRebuilding ? '重建中...' : '重建索引'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Vector Index Status */}
        {vectorStatus && (
          <div className="mb-6 p-4 rounded-lg border">
            <h3 className="font-medium mb-2">向量索引状态</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">状态:</span>
                <Badge className={vectorStatus.exists ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>
                  {vectorStatus.exists ? '已创建' : '未创建'}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">文档数:</span>
                <span className="font-medium">{vectorStatus.totalDocuments}</span>
              </div>
              <div>
                <span className="text-gray-500">集合名:</span>
                <code className="text-xs">{vectorStatus.collectionName}</code>
              </div>
              <div>
                <span className="text-gray-500">角色卡:</span>
                <Badge className={vectorStatus.hasRoleCard ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>
                  {vectorStatus.hasRoleCard ? '已生成' : '未生成'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Memories List */}
        <div className="space-y-3">
          {memories.map((memory) => (
            <div key={memory._id} className="p-3 rounded border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{memory.category}</Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(memory.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-sm">{memory.content}</p>
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {memory.tags.map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [User Management](./user-management) - User CRUD operations
- [Memory Module](../core/memory/overview) - Core memory system documentation
