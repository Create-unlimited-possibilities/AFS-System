---
sidebar_position: 1
---

# Admin Panel Overview

The Admin Panel is a comprehensive web-based administration interface for the AFS System, providing tools for user management, questionnaire configuration, memory oversight, and system monitoring.

## Architecture Level

### System Design

The Admin Panel follows a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│                    (Next.js + React)                        │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │   Users     │Questionnaire│  Memories   │   Roles     │ │
│  │ Management  │ Management  │ Management  │ Management  │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│                  (Express.js Routes)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication Middleware → Authorization Middleware │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                             │
│              (Business Logic + Data Access)                  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ Admin       │ User        │ QA          │ Memory      │ │
│  │ Service     │ Service     │ Service     │ Service     │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

The admin panel uses a **separate authentication system** from regular users:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Login      │────▶│  Validate    │────▶│  Generate    │
│   Request    │     │  Invite Code │     │  JWT Token   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │  Store in    │
                                          │  Separate    │
                                          │  localStorage│
                                          │  (admin_token)│
                                          └──────────────┘
```

### File Structure

```
AFS-System/
├── web/app/admin/              # Frontend pages
│   ├── page.tsx                # Dashboard
│   ├── layout.tsx              # Admin layout wrapper
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── users/                  # User management
│   ├── questionnaires/         # Questionnaire management
│   ├── memories/               # Memory management
│   ├── roles/                  # Role & permission management
│   └── settings/               # System settings
│       ├── invite-codes/       # Invite code management
│       └── env/                # Environment variable editor
│
├── web/components/admin/       # Reusable components
│   ├── AdminSidebar.tsx        # Navigation sidebar
│   ├── AdminHeader.tsx         # Page header
│   ├── DataTable.tsx           # Generic data table
│   ├── StatsCard.tsx           # Statistics card
│   ├── ConfirmDialog.tsx       # Confirmation dialog
│   └── UserGrowthChart.tsx     # Growth chart component
│
├── web/lib/admin-api.ts        # API client functions
├── web/stores/admin-auth.ts    # Admin auth state management
│
└── server/src/modules/admin/   # Backend
    ├── controller.js           # Request handlers
    ├── service.js              # Business logic
    ├── route.js                # API routes
    ├── authRoute.js            # Authentication routes (public)
    ├── middleware.js           # Auth & permission middleware
    ├── models/
    │   └── inviteCode.js       # Invite code model
    ├── services/
    │   └── envService.js       # Environment variable service
    └── scripts/
        └── initAdmin.js        # Admin initialization script
```

## Function Level

### Core Features

#### 1. Dashboard (`/admin`)

**Purpose**: System overview and monitoring

**Features**:
- Real-time statistics (users, memories, conversations)
- System health status (MongoDB, ChromaDB, LLM)
- User growth chart with historical data
- Recent activity feed
- Quick action shortcuts

**API Endpoints**:
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/dashboard/system-status-fast` - Service health (Docker-based, &lt;1s)
- `GET /api/admin/dashboard/activity` - Recent activities
- `GET /api/admin/dashboard/growth` - User growth data

#### 2. User Management (`/admin/users`)

**Purpose**: CRUD operations for system users

**Features**:
- Paginated user list with search and filtering
- User status toggle (active/inactive)
- Role assignment
- User deletion with cascade
- User detail view with statistics

**Filters**:
- Search by name, email, or unique code
- Filter by role
- Filter by active status
- Sort by any column

#### 3. Questionnaire Management (`/admin/questionnaires`)

**Purpose**: Manage system questionnaire questions

**Features**:
- Create, update, delete questions
- Question ordering within role/layer
- Enable/disable individual questions
- Batch import from JSON
- Export questions to JSON

**Question Structure**:
- Role: elder, family, friend
- Layer: basic, emotional
- Type: text, textarea, voice

#### 4. Memory Management (`/admin/memories`)

**Purpose**: Monitor and manage user memory data

**Features**:
- Per-user memory summaries
- Vector index status checking
- Memory data viewing
- Vector index rebuilding
- Memory data export

**Memory Types**:
- Self memories (elder role answers)
- Family memories (family role answers)
- Friend memories (friend role answers)
- Conversation memories (extracted from chats)

#### 5. Role & Permission Management (`/admin/roles`)

**Purpose**: Define access control

**Features**:
- Create custom roles
- Assign permissions to roles
- System role protection
- Permission category organization

**Permission Categories**:
- User: user:view, user:create, user:update, user:delete
- Role: role:view, role:create, role:update, role:delete
- Questionnaire: questionnaire:view, questionnaire:create, etc.
- Memory: memory:view, memory:manage
- System: system:view, system:edit

#### 6. Settings (`/admin/settings`)

**Invite Codes**:
- Generate new invite codes
- Set usage limits
- Set expiration dates
- Track code usage

**Environment Variables**:
- View current configuration
- Edit non-sensitive variables
- Backup/restore functionality
- Validation before saving

### Authentication & Authorization

**Login Flow**:
1. User enters email and password
2. System validates credentials
3. System checks for admin role (`role.isAdmin === true`)
4. System generates JWT token (7-day expiration)
5. Token stored in `localStorage.admin_token`

**Authorization Middleware**:
```javascript
// middleware.js
protect           // Verify JWT token
requireAdmin       // Check admin role
requirePermission  // Check specific permission
canManageUser      // Check if can manage target user
```

## Code Level

### Backend: Admin Service

**File**: `server/src/modules/admin/service.js`

```javascript
/**
 * User Management
 */
async getUsers({ page, limit, search, role, isActive }) {
  const query = {};

  // Build search query
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { uniqueCode: { $regex: search, $options: 'i' } }
    ];
  }

  // Apply filters
  if (role) query.role = role;
  if (isActive !== '') query.isActive = isActive === 'true';

  // Pagination
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('role', 'name description isAdmin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

### Backend: Authentication Middleware

**File**: `server/src/modules/admin/middleware.js`

```javascript
/**
 * Check if user has admin role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // Fetch user with role
    const user = await User.findById(req.user.id).populate('role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    // Check if user has admin role
    const role = await Role.findById(user.role._id);

    if (!role || !role.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '权限检查失败',
      error: error.message
    });
  }
};
```

### Backend: Admin Routes

**File**: `server/src/modules/admin/route.js`

```javascript
// Public routes (no auth)
router.post('/auth/login', ...);
router.post('/auth/register', ...);
router.get('/invite-codes/validate/:code', ...);

// Protected routes (require auth + admin role)
router.use(protect);
router.use(requireAdmin);

// User management
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.get('/users/:id', ...);
router.put('/users/:id', ...);
router.delete('/users/:id', ...);
router.patch('/users/:id/status', ...);

// Questionnaire management
router.get('/questions', ...);
router.post('/questions', ...);
router.put('/questions/:id', ...);
router.delete('/questions/:id', ...);
```

### Frontend: Admin Auth Store

**File**: `web/stores/admin-auth.ts`

```typescript
interface AdminAuthState {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  login: (admin: AdminUser, token: string) => void;
  logout: () => void;
  setAdmin: (admin: AdminUser) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      login: (admin, token) => {
        // Store admin token in separate key
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_token', token);
        }
        set({
          admin,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_token');
        }
        set({
          admin: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      // ... other methods
    }),
    {
      name: 'admin-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Frontend: Admin API Client

**File**: `web/lib/admin-api.ts`

```typescript
// Admin-specific API request function using admin_token
async function adminApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Use admin_token for authentication
  if (!headers['Authorization'] && typeof window !== 'undefined') {
    const token = getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Request failed',
    } as T;
  }

  return data;
}
```

### Frontend: Dashboard Component

**File**: `web/app/admin/page.tsx`

```typescript
export default function AdminDashboardPage() {
  const { admin } = useAdminAuthStore();
  const { can } = usePermissionStore();

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const [statsResult, statusResult, activityResult] = await Promise.all([
      getDashboardStats(),
      getSystemStatus(),
      getRecentActivity(5),
    ]);

    if (statsResult.success) {
      setDashboardStats(statsResult.stats || null);
    }
    // ... handle other results
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
              <CardDescription>{stat.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>系统状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <StatusBadge service="MongoDB" status={systemStatus?.mongodb.connected} />
            <StatusBadge service="ChromaDB" status={systemStatus?.chromadb.connected} />
            <StatusBadge service="LLM" status={systemStatus?.llm.connected} />
            <StatusBadge service="VectorStore" status={systemStatus?.vectorStore.status === 'ready'} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Related Documentation

- [User Management](./user-management) - Detailed user CRUD operations
- [Questionnaire Management](./questionnaire) - Question configuration
- [Memory Management](./memory) - Memory and vector index management
- [Roles & Permissions](./roles) - Access control system
- [Dashboard](./dashboard) - Statistics and monitoring
