---
sidebar_position: 2
---

# User Management

The User Management module provides comprehensive CRUD operations for managing all users in the AFS System.

## Architecture Level

### Module Structure

```
User Management Module
├── Backend (server/src/modules/admin/)
│   ├── controller.js - getUsers(), getUserById(), updateUser(), deleteUser()
│   ├── service.js - Business logic for user operations
│   ├── route.js - API endpoints (/admin/users/*)
│   └── middleware.js - Authorization checks
│
└── Frontend (web/app/admin/users/)
    ├── page.tsx - User list with filtering
    ├── [id]/page.tsx - User detail view
    └── [id]/edit/page.tsx - User edit form
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  API Layer      │────▶│  Service Layer  │
│  (users/page)   │     │  (route.js)     │     │  (service.js)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │  Database       │
                                                  │  (User Model)   │
                                                  └─────────────────┘
```

## Function Level

### Features

#### 1. User List

**Endpoint**: `GET /api/admin/users`

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| page | number | Page number | 1 |
| limit | number | Items per page | 10 |
| search | string | Search by name, email, uniqueCode | - |
| role | string | Filter by role ID | - |
| isActive | boolean | Filter by active status | - |
| sortBy | string | Sort field | createdAt |
| sortOrder | asc/desc | Sort direction | desc |

**Response**:
```typescript
{
  success: true,
  users: AdminUser[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

#### 2. User Detail

**Endpoint**: `GET /api/admin/users/:id`

**Response**:
```typescript
{
  success: true,
  user: {
    _id: string,
    uniqueCode: string,
    email: string,
    name: string,
    isActive: boolean,
    role: {
      _id: string,
      name: string,
      permissions: Array<{ name: string }>
    },
    createdAt: string,
    lastLogin?: string,
    stats: {
      answerCount: number,
      sessionCount: number,
      relationCount: number
    }
  }
}
```

#### 3. Update User

**Endpoint**: `PUT /api/admin/users/:id`

**Body**:
```typescript
{
  name?: string,
  email?: string,
  isActive?: boolean,
  roleId?: string
}
```

#### 4. Delete User

**Endpoint**: `DELETE /api/admin/users/:id`

**Behavior**: Cascade deletion of related data:
- Answers (questionnaire responses)
- Chat sessions
- Assist relations

#### 5. Toggle User Status

**Endpoint**: `PATCH /api/admin/users/:id/status`

**Body**:
```typescript
{
  isActive: boolean
}
```

### Filtering & Search

**Search Fields** (case-insensitive):
- User name
- Email address
- Unique code

**Status Filters**:
- All users
- Active users only
- Inactive users only

**Sorting Options**:
- Created date (default)
- Name
- Email
- Last login
- Status

## Code Level

### Backend: Get Users Service

**File**: `server/src/modules/admin/service.js`

```javascript
async getUsers({ page = 1, limit = 20, search = '', role = '', isActive = '' }) {
  const query = {};

  // Search by name, email, or uniqueCode
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { uniqueCode: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by role
  if (role) {
    query.role = role;
  }

  // Filter by active status
  if (isActive !== '') {
    query.isActive = isActive === 'true';
  }

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

### Backend: Get User by ID

**File**: `server/src/modules/admin/service.js`

```javascript
async getUserById(userId) {
  const user = await User.findById(userId)
    .select('-password')
    .populate('role', 'name description isAdmin permissions')
    .lean();

  if (!user) {
    throw new Error('用户不存在');
  }

  // Get additional stats
  const [answerCount, sessionCount, relationCount] = await Promise.all([
    Answer.countDocuments({ targetUserId: userId }),
    ChatSession.countDocuments({ targetUserId: userId }),
    AssistRelation.countDocuments({
      $or: [{ targetId: userId }, { assistantId: userId }]
    })
  ]);

  return {
    ...user,
    stats: {
      answerCount,
      sessionCount,
      relationCount
    }
  };
}
```

### Backend: Update User

**File**: `server/src/modules/admin/service.js`

```javascript
async updateUser(userId, updateData) {
  const allowedUpdates = ['name', 'email', 'role', 'isActive', 'profile'];
  const filteredData = {};

  for (const key of allowedUpdates) {
    if (updateData[key] !== undefined) {
      filteredData[key] = updateData[key];
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    filteredData,
    { new: true, runValidators: true }
  ).select('-password').populate('role', 'name description');

  if (!user) {
    throw new Error('用户不存在');
  }

  return user;
}
```

### Backend: Delete User

**File**: `server/src/modules/admin/service.js`

```javascript
async deleteUser(userId) {
  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  // Delete related data in parallel
  await Promise.all([
    Answer.deleteMany({ $or: [{ userId }, { targetUserId: userId }] }),
    ChatSession.deleteMany({
      $or: [{ targetUserId: userId }, { interlocutorUserId: userId }]
    }),
    AssistRelation.deleteMany({
      $or: [{ targetId: userId }, { assistantId: userId }]
    })
  ]);

  await User.findByIdAndDelete(userId);

  return { success: true, message: '用户已删除' };
}
```

### Frontend: Users Page

**File**: `web/app/admin/users/page.tsx`

```typescript
export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const loadUsers = async () => {
    const result = await getUsers(filters);
    if (result.success && result.users) {
      setUsers(result.users);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    }
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    const result = await toggleUserStatus(userId, isActive);
    if (result.success) {
      setUsers(users.map(u =>
        u._id === userId ? { ...u, isActive } : u
      ));
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      title: '用户',
      sortable: true,
      render: (user) => (
        <div>
          <div className="font-medium">{user.name}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      title: '角色',
      sortable: true,
      render: (user) => (
        <Badge>{user.role?.name || '普通用户'}</Badge>
      ),
    },
    {
      key: 'isActive',
      title: '状态',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-1">
          {user.isActive ? (
            <><CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600">激活</span></>
          ) : (
            <><Ban className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-600">禁用</span></>
          )}
        </div>
      ),
    },
    // ... more columns
  ];

  return (
    <div className="space-y-6">
      <DataTable
        data={users}
        columns={columns}
        pagination={pagination}
        onPageChange={handlePageChange}
        onSearchChange={handleSearch}
        onSortChange={handleSort}
      />
    </div>
  );
}
```

### Frontend: API Client

**File**: `web/lib/admin-api.ts`

```typescript
export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean | null;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getUsers(filters: UserFilters = {}): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.role) params.append('role', filters.role);
  if (filters.isActive !== null && filters.isActive !== undefined) {
    params.append('isActive', String(filters.isActive));
  }
  params.append('page', String(filters.page || 1));
  params.append('limit', String(filters.limit || 10));
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  return adminApiRequest(`/admin/users?${params.toString()}`);
}

export async function toggleUserStatus(userId: string, isActive: boolean): Promise<{
  success: boolean;
  user?: AdminUser;
  error?: string;
}> {
  return adminApiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [Roles & Permissions](./roles) - Role-based access control
- [Memory Management](./memory) - User memory data management
