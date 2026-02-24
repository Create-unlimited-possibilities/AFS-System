---
sidebar_position: 6
---

# Dashboard & Statistics

The Dashboard provides real-time system monitoring and statistics for the AFS System admin panel.

## Architecture Level

### Dashboard Components

```
Dashboard Module
├── Backend (server/src/modules/admin/)
│   ├── controller.js - getDashboardStats(), getSystemStatus(), etc.
│   ├── service.js - Statistics aggregation, health checks
│   └── route.js - API endpoints (/admin/dashboard/*)
│
└── Frontend (web/app/admin/)
    ├── page.tsx - Main dashboard component
    └── components/
        ├── StatsCard.tsx - Individual stat card
        ├── UserGrowthChart.tsx - Growth visualization
        └── AdminHeader.tsx - Dashboard header
```

### Data Sources

The dashboard aggregates data from multiple sources:

| Source | Data | Integration Method |
|--------|------|-------------------|
| MongoDB | User counts, answers, sessions | Mongoose queries |
| ChromaDB | Vector index status | HTTP health check |
| LLM Service | Model availability | HTTP health check |
| Docker | Container status | `docker ps` command |

## Function Level

### Features

#### 1. Dashboard Statistics

**Endpoint**: `GET /api/admin/dashboard/stats`

**Response**:
```typescript
{
  success: true,
  stats: {
    totalUsers: number,           // Total registered users
    newUsersToday: number,        // Users registered today
    activeUsers: number,          // Users with isActive: true
    totalMemories: number,        // Total answer records
    questionnaireCompletionRate: number, // % of questions answered
    totalConversations: number    // Total chat sessions
  }
}
```

**Calculation Logic**:
- `questionnaireCompletionRate` = (answered questions / total active questions) × 100
- `activeUsers` = Count of users with `isActive: true`

#### 2. System Status (Fast)

**Endpoint**: `GET /api/admin/dashboard/system-status-fast`

**Response**:
```typescript
{
  success: true,
  status: {
    mongodb: {
      connected: boolean,
      containerRunning: boolean
    },
    chromadb: {
      connected: boolean,
      containerRunning: boolean
    },
    llm: {
      connected: boolean,
      provider: 'ollama' | 'openai' | 'other',
      model: string,
      containerRunning: boolean
    },
    vectorStore: {
      status: 'ready' | 'building' | 'error' | 'unknown',
      totalIndexes: number
    },
    checkMethod: 'docker'
  }
}
```

**Performance**: Uses Docker container checks instead of HTTP requests, returns in {"<"}1 second

#### 3. System Status (Full)

**Endpoint**: `GET /api/admin/dashboard/system-status`

**Response**: Same structure as fast endpoint, but includes:
- `latency` field for each service
- Slower response time (~30 seconds due to HTTP timeouts)

#### 4. Recent Activity

**Endpoint**: `GET /api/admin/dashboard/activity?limit=N`

**Response**:
```typescript
{
  success: true,
  activities: RecentActivity[]
}

interface RecentActivity {
  _id: string;
  type: 'user_registered' | 'memory_created' | 'conversation_started' | 'rolecard_generated';
  userId: string;
  userName: string;
  description: string;
  createdAt: string;
}
```

#### 5. User Growth Data

**Endpoint**: `GET /api/admin/dashboard/growth?days=N`

**Response**:
```typescript
{
  success: true,
  data: Array<{
    date: string,      // ISO date string
    count: number,     // New users that day
    cumulative: number // Total users to date
  }>
}
```

### Stats Cards

The dashboard displays the following statistics cards:

| Card | Value | Description |
|------|-------|-------------|
| 总用户数 | `totalUsers` | All registered users |
| 今日新增 | `newUsersToday` | Users registered today |
| 活跃用户 | `activeUsers` | Active user accounts |
| 总对话数 | `totalConversations` | All chat sessions |
| 问卷完成率 | `questionnaireCompletionRate` | % completion |
| 总记忆数 | `totalMemories` | All answer records |

## Code Level

### Backend: Dashboard Stats Service

**File**: `server/src/modules/admin/service.js`

```javascript
async getDashboardStatsV2() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    newUsersToday,
    activeUsers,
    totalMemories,
    totalQuestions,
    totalConversations,
    answeredQuestionIds
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    User.countDocuments({ isActive: true }),
    Answer.countDocuments(),
    Question.countDocuments({ active: true }),
    ChatSession.countDocuments(),
    Answer.distinct('questionId')
  ]);

  // Count how many unique questions have at least one answer
  const answeredQuestionsCount = answeredQuestionIds.filter(id => id != null).length;

  const completionRate = totalQuestions > 0
    ? (answeredQuestionsCount / totalQuestions) * 100
    : 0;

  return {
    totalUsers,
    newUsersToday,
    activeUsers,
    totalMemories,
    questionnaireCompletionRate: Math.round(completionRate * 10) / 10,
    totalConversations
  };
}
```

### Backend: System Status Fast Service

**File**: `server/src/modules/admin/service.js`

```javascript
/**
 * Check if a Docker container is running
 * Uses docker ps command (much faster than HTTP checks)
 */
async _checkDockerContainer(containerName) {
  try {
    const { execSync } = await import('child_process');
    const result = execSync(
      `docker ps --filter "name=${containerName}" --filter "status=running" -q`,
      { encoding: 'utf-8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return result.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get system status using Docker container checks (instant)
 */
async getSystemStatusFast() {
  const llmBackend = process.env.LLM_BACKEND || 'ollama';

  const status = {
    mongodb: { connected: false, containerRunning: false },
    chromadb: { connected: false, containerRunning: false },
    llm: {
      connected: false,
      provider: llmBackend === 'deepseek' ? 'openai' : 'ollama',
      model: llmBackend === 'deepseek'
        ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
        : (process.env.OLLAMA_MODEL || 'deepseek-r1:14b'),
      containerRunning: false
    },
    vectorStore: { status: 'unknown', totalIndexes: 0 },
    checkMethod: 'docker'
  };

  // Check all Docker containers in parallel (fast - <1 second)
  const [mongoRunning, chromaRunning, ollamaRunning] = await Promise.all([
    this._checkDockerContainer('mongoserver'),
    this._checkDockerContainer('chromaserver'),
    this._checkDockerContainer('modelserver')
  ]);

  status.mongodb.containerRunning = mongoRunning;
  status.mongodb.connected = mongoRunning;

  status.chromadb.containerRunning = chromaRunning;
  status.chromadb.connected = chromaRunning;

  status.llm.containerRunning = ollamaRunning;
  status.llm.connected = ollamaRunning;

  status.vectorStore.status = chromaRunning ? 'ready' : 'error';

  return status;
}
```

### Backend: Recent Activity Service

**File**: `server/src/modules/admin/service.js`

```javascript
async getRecentActivity(limit = 10) {
  const activities = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get recent user registrations
  const recentUsers = await User.find({
    createdAt: { $gte: sevenDaysAgo }
  })
    .select('name uniqueCode createdAt')
    .sort({ createdAt: -1 })
    .limit(Math.ceil(limit / 3))
    .lean();

  for (const user of recentUsers) {
    activities.push({
      _id: `user_${user._id}`,
      type: 'user_registered',
      userId: user._id,
      userName: user.name,
      description: `新用户 ${user.name} 注册`,
      createdAt: user.createdAt
    });
  }

  // Get recent memories created
  const recentMemories = await Answer.find({
    createdAt: { $gte: sevenDaysAgo }
  })
    .populate('targetUserId', 'name')
    .populate('questionId', 'question')
    .sort({ createdAt: -1 })
    .limit(Math.ceil(limit / 3))
    .lean();

  for (const memory of recentMemories) {
    activities.push({
      _id: `memory_${memory._id}`,
      type: 'memory_created',
      userId: memory.targetUserId._id,
      userName: memory.targetUserId.name,
      description: `创建了新记忆`,
      createdAt: memory.createdAt
    });
  }

  // Get recent conversations
  const recentSessions = await ChatSession.find({
    createdAt: { $gte: sevenDaysAgo }
  })
    .populate('targetUserId', 'name')
    .sort({ createdAt: -1 })
    .limit(Math.ceil(limit / 3))
    .lean();

  for (const session of recentSessions) {
    activities.push({
      _id: `session_${session._id}`,
      type: 'conversation_started',
      userId: session.targetUserId._id,
      userName: session.targetUserId.name,
      description: `开始了新对话`,
      createdAt: session.createdAt
    });
  }

  // Sort by date and limit
  activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return activities.slice(0, limit);
}
```

### Backend: User Growth Data Service

**File**: `server/src/modules/admin/service.js`

```javascript
async getUserGrowthData(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const dailyData = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Calculate cumulative total and format response
  let cumulative = 0;
  return dailyData.map(d => ({
    date: d._id,
    count: d.count,
    cumulative: (cumulative += d.count)
  }));
}
```

### Frontend: Dashboard Page

**File**: `web/app/admin/page.tsx`

```typescript
export default function AdminDashboardPage() {
  const { admin } = useAdminAuthStore();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const [statsResult, statusResult, activityResult] = await Promise.all([
      getDashboardStats(),
      getSystemStatusFast(),
      getRecentActivity(5),
    ]);

    if (statsResult.success) {
      setDashboardStats(statsResult.stats || null);
    }
    if (statusResult.success) {
      setSystemStatus(statusResult.status || null);
    }
    if (activityResult.success) {
      setRecentActivities(activityResult.activities || []);
    }
  };

  const statsCards = [
    {
      title: '总用户数',
      value: dashboardStats?.totalUsers || 0,
      description: '注册用户总数',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: '今日新增',
      value: dashboardStats?.newUsersToday || 0,
      description: '今天新注册用户',
      icon: UserPlus,
      color: 'from-green-500 to-green-600',
    },
    {
      title: '活跃用户',
      value: dashboardStats?.activeUsers || 0,
      description: '最近7天活跃用户',
      icon: Activity,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: '总对话数',
      value: dashboardStats?.totalConversations || 0,
      description: 'AI对话总数',
      icon: MessageSquare,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          欢迎回来，{admin?.name || '管理员'}！
        </h1>
        <p className="text-orange-100">
          这是您的管理后台仪表盘。在这里您可以查看系统概览和管理各项功能。
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-2xl">{stat.value}</CardTitle>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* User Growth Chart */}
      <UserGrowthChart />

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>系统状态</CardTitle>
          <CardDescription>各服务组件运行状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ServiceStatusBadge name="MongoDB" status={systemStatus?.mongodb.connected} />
            <ServiceStatusBadge name="ChromaDB" status={systemStatus?.chromadb.connected} />
            <ServiceStatusBadge
              name={`LLM (${systemStatus?.llm.provider === 'ollama' ? 'Ollama' : 'Other'})`}
              status={systemStatus?.llm.connected}
            />
            <ServiceStatusBadge
              name="向量存储"
              status={systemStatus?.vectorStore.status === 'ready'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>系统中的最新操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <ActivityItem key={activity._id} activity={activity} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Frontend: Stats Card Component

**File**: `web/components/admin/StatsCard.tsx`

```typescript
interface StatsCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'from-blue-500 to-blue-600',
  trend
}: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <Badge
              variant={trend.isPositive ? 'default' : 'destructive'}
              className={trend.isPositive ? 'bg-green-100 text-green-700' : ''}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
```

### Frontend: User Growth Chart Component

**File**: `web/components/admin/UserGrowthChart.tsx`

```typescript
export function UserGrowthChart() {
  const [data, setData] = useState<Array<{ date: string; count: number; cumulative: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGrowthData();
  }, []);

  const loadGrowthData = async () => {
    const result = await getUserGrowthData(30);
    if (result.success && result.data) {
      setData(result.data);
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户增长趋势</CardTitle>
        <CardDescription>过去30天的用户注册情况</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString('zh-CN')}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'count' ? '新增用户' : '累计用户'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.3}
                  name="新增用户"
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  name="累计用户"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [User Management](./user-management) - User statistics details
- [Memory Management](./memory) - Memory statistics details
