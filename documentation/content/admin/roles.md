---
sidebar_position: 5
---

# Roles & Permissions

The Roles & Permissions module provides a flexible access control system for the AFS Admin Panel.

## Architecture Level

### Module Structure

```
Roles & Permissions Module
├── Backend (server/src/modules/)
│   ├── admin/
│   │   ├── controller.js - getRoles(), createRole(), updateRole(), deleteRole()
│   │   ├── service.js - Role business logic
│   │   └── route.js - API endpoints (/admin/roles/*)
│   └── roles/
│       ├── models/
│       │   ├── role.js - Role model schema
│       │   └── permission.js - Permission model schema
│       └── services/
│           └── permissionService.js - Permission lookup service
│
└── Frontend (web/app/admin/roles/)
    ├── page.tsx - Roles list with management
    └── components/
        └── PermissionEditor.tsx - Permission selection component
```

### Access Control Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│   Role       │────▶│ Permissions  │
│   Request    │     │   Lookup     │     │   Check      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Allow/Deny  │
                     │  Access      │
                     └──────────────┘
```

### Permission Categories

| Category | Description | Permissions |
|----------|-------------|-------------|
| user | User management | user:view, user:create, user:update, user:delete |
| role | Role management | role:view, role:create, role:update, role:delete |
| questionnaire | Questionnaire management | questionnaire:view, questionnaire:create, questionnaire:update, questionnaire:delete |
| memory | Memory management | memory:view, memory:manage |
| system | System settings | system:view, system:edit |
| invitecode | Invite code management | invitecode:view, invitecode:create, invitecode:delete |

## Function Level

### Features

#### 1. List Roles

**Endpoint**: `GET /api/admin/roles`

**Response**:
```typescript
{
  success: true,
  roles: RoleWithPermissions[]
}

interface RoleWithPermissions {
  _id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Array<{
    _id: string;
    name: string;
    description: string;
    category: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

#### 2. Get Role by ID

**Endpoint**: `GET /api/admin/roles/:id`

**Response**: Single role with populated permissions

#### 3. Create Role

**Endpoint**: `POST /api/admin/roles`

**Body**:
```typescript
{
  name: string;
  description: string;
  permissionIds: string[]
}
```

**Response**: Created role with populated permissions

#### 4. Update Role

**Endpoint**: `PUT /api/admin/roles/:id`

**Body**: Partial role data (name, description, permissionIds)

**Constraints**:
- System roles (`isSystem: true`) cannot be modified
- Role name must be unique

#### 5. Delete Role

**Endpoint**: `DELETE /api/admin/roles/:id`

**Constraints**:
- System roles cannot be deleted
- Roles assigned to users cannot be deleted

#### 6. List All Permissions

**Endpoint**: `GET /api/admin/permissions`

**Response**:
```typescript
{
  success: true,
  permissions: Permission[]
}

interface Permission {
  _id: string;
  name: string;
  description: string;
  category: 'user' | 'role' | 'system' | 'content' | 'other';
}
```

## Code Level

### Backend: Role Model

**File**: `server/src/modules/roles/models/role.js`

```javascript
const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50,
    description: 'Role name (e.g., admin, moderator, user)'
  },
  description: {
    type: String,
    maxlength: 500,
    description: 'Role description'
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
    description: 'Permissions assigned to this role'
  }],
  isSystem: {
    type: Boolean,
    default: false,
    description: 'System roles cannot be deleted or modified'
  },
  isAdmin: {
    type: Boolean,
    default: false,
    description: 'Admin roles have access to admin panel'
  }
}, {
  timestamps: true
});

// Indexes
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ isAdmin: 1 });

// Virtual: Check if role has specific permission
roleSchema.virtual('hasPermission').get(function() {
  return (permissionName) => {
    return this.permissions.some(p => p.name === permissionName);
  };
});
```

### Backend: Permission Model

**File**: `server/src/modules/roles/models/permission.js`

```javascript
const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: 'Permission name (e.g., user:view)'
  },
  description: {
    type: String,
    required: true,
    description: 'Human-readable permission description'
  },
  category: {
    type: String,
    required: true,
    enum: ['user', 'role', 'questionnaire', 'memory', 'system', 'invitecode', 'other'],
    description: 'Permission category for organization'
  }
}, {
  timestamps: true
});

// Indexes
permissionSchema.index({ name: 1 }, { unique: true });
permissionSchema.index({ category: 1 });

// Static: Get permissions by category
permissionSchema.statics.getByCategory = async function(category) {
  return this.find({ category }).sort({ name: 1 });
};
```

### Backend: Create Role Service

**File**: `server/src/modules/admin/service.js`

```javascript
async createRole({ name, description, permissionIds = [] }) {
  const Role = (await import('../roles/models/role.js')).default;

  if (!name || !name.trim()) {
    throw new Error('角色名称不能为空');
  }

  // Check if role name already exists
  const existingRole = await Role.findOne({ name: name.trim() });
  if (existingRole) {
    throw new Error('角色名称已存在');
  }

  // Validate permission IDs
  if (permissionIds.length > 0) {
    const Permission = (await import('../roles/models/permission.js')).default;
    const validPermissions = await Permission.find({ _id: { $in: permissionIds } });
    if (validPermissions.length !== permissionIds.length) {
      throw new Error('部分权限ID无效');
    }
  }

  const role = await Role.create({
    name: name.trim(),
    description: description || '',
    permissions: permissionIds,
    isSystem: false,
    isAdmin: false
  });

  // Populate permissions before returning
  await role.populate('permissions', 'name description category');

  return role;
}
```

### Backend: Update Role Service

**File**: `server/src/modules/admin/service.js`

```javascript
async updateRole(roleId, { name, description, permissionIds }) {
  const Role = (await import('../roles/models/role.js')).default;
  const Permission = (await import('../roles/models/permission.js')).default;

  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }

  // Prevent modification of system roles
  if (role.isSystem) {
    throw new Error('不能修改系统角色');
  }

  // Update name if provided
  if (name && name.trim()) {
    // Check if new name conflicts with existing role
    const existingRole = await Role.findOne({
      name: name.trim(),
      _id: { $ne: roleId }
    });
    if (existingRole) {
      throw new Error('角色名称已存在');
    }
    role.name = name.trim();
  }

  // Update description if provided
  if (description !== undefined) {
    role.description = description;
  }

  // Update permissions if provided
  if (permissionIds !== undefined) {
    // Validate permission IDs
    const validPermissions = await Permission.find({ _id: { $in: permissionIds } });
    if (validPermissions.length !== permissionIds.length) {
      throw new Error('部分权限ID无效');
    }
    role.permissions = permissionIds;
  }

  await role.save();
  await role.populate('permissions', 'name description category');

  return role;
}
```

### Backend: Delete Role Service

**File**: `server/src/modules/admin/service.js`

```javascript
async deleteRole(roleId) {
  const Role = (await import('../roles/models/role.js')).default;
  const User = (await import('../user/model.js')).default;

  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('角色不存在');
  }

  // Prevent deletion of system roles
  if (role.isSystem) {
    throw new Error('不能删除系统角色');
  }

  // Check if role is assigned to any users
  const userCount = await User.countDocuments({ role: roleId });
  if (userCount > 0) {
    throw new Error(`该角色已分配给 ${userCount} 个用户，无法删除`);
  }

  await Role.findByIdAndDelete(roleId);

  return { success: true, message: '角色已删除' };
}
```

### Frontend: Roles Page

**File**: `web/app/admin/roles/page.tsx`

```typescript
export default function RolesPage() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as string[],
  });

  const loadData = async () => {
    const [rolesResult, permissionsResult] = await Promise.all([
      getRoles(),
      getAllPermissions(),
    ]);
    if (rolesResult.success && rolesResult.roles) {
      setRoles(rolesResult.roles);
    }
    if (permissionsResult.success && permissionsResult.permissions) {
      setPermissions(permissionsResult.permissions);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissionIds: [] });
    setShowDialog(true);
  };

  const handleEdit = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissionIds: role.permissions.map((p) => p._id),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    const result = editingRole
      ? await updateRole(editingRole._id, formData)
      : await createRole(formData);

    if (result.success) {
      setShowDialog(false);
      await loadData();
    }
  };

  const handleDelete = (role: RoleWithPermissions) => {
    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      roleId: role._id,
      roleName: role.name,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">角色管理</h1>
          <p className="text-gray-600">管理系统角色和权限</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          添加角色
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{roles.length}</CardTitle>
            <CardDescription>总角色数</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-blue-600">
              {roles.filter((r) => r.isSystem).length}
            </CardTitle>
            <CardDescription>系统角色</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-green-600">
              {roles.filter((r) => !r.isSystem).length}
            </CardTitle>
            <CardDescription>自定义角色</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Roles List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {roles.map((role) => (
          <Card key={role._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-600" />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {role.name}
                      {role.isSystem && (
                        <Badge variant="secondary">系统角色</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(role)}
                    disabled={role.isSystem}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(role)}
                    disabled={role.isSystem}
                    className="text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((permission) => (
                  <Badge key={permission._id} variant="outline" className="text-xs">
                    {permission.name}
                  </Badge>
                ))}
                {role.permissions.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{role.permissions.length - 5}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                共 {role.permissions.length} 个权限
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? '编辑角色' : '创建角色'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>角色名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={editingRole?.isSystem}
              />
            </div>

            <div className="space-y-2">
              <Label>权限</Label>
              <PermissionEditor
                permissions={permissions}
                selectedPermissionIds={formData.permissionIds}
                onSelectionChange={(ids) => setFormData({ ...formData, permissionIds: ids })}
                disabled={editingRole?.isSystem}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### Frontend: Permission Editor Component

**File**: `web/app/admin/roles/components/PermissionEditor.tsx`

```typescript
interface PermissionEditorProps {
  permissions: Permission[];
  selectedPermissionIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function PermissionEditor({
  permissions,
  selectedPermissionIds,
  onSelectionChange,
  disabled = false
}: PermissionEditorProps) {
  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const categoryNames: Record<string, string> = {
    user: '用户管理',
    role: '角色管理',
    questionnaire: '问卷管理',
    memory: '记忆管理',
    system: '系统设置',
    invitecode: '邀请码管理',
    other: '其他'
  };

  const handleTogglePermission = (permissionId: string) => {
    if (selectedPermissionIds.includes(permissionId)) {
      onSelectionChange(selectedPermissionIds.filter(id => id !== permissionId));
    } else {
      onSelectionChange([...selectedPermissionIds, permissionId]);
    }
  };

  const handleToggleCategory = (category: string) => {
    const categoryPermissionIds = groupedPermissions[category].map(p => p._id);
    const allSelected = categoryPermissionIds.every(id => selectedPermissionIds.includes(id));

    if (allSelected) {
      // Deselect all in category
      onSelectionChange(selectedPermissionIds.filter(id => !categoryPermissionIds.includes(id)));
    } else {
      // Select all in category
      const newIds = [...new Set([...selectedPermissionIds, ...categoryPermissionIds])];
      onSelectionChange(newIds);
    }
  };

  return (
    <div className="space-y-3">
      {Object.entries(groupedPermissions).map(([category, perms]) => {
        const categoryIds = perms.map(p => p._id);
        const allSelected = categoryIds.every(id => selectedPermissionIds.includes(id));
        const someSelected = categoryIds.some(id => selectedPermissionIds.includes(id));

        return (
          <div key={category} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => handleToggleCategory(category)}
                  disabled={disabled}
                />
                <span className="font-medium">
                  {categoryNames[category] || category}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {categoryIds.filter(id => selectedPermissionIds.includes(id)).length} / {categoryIds.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-6">
              {perms.map((permission) => (
                <div key={permission._id} className="flex items-center gap-2">
                  <Checkbox
                    id={permission._id}
                    checked={selectedPermissionIds.includes(permission._id)}
                    onCheckedChange={() => handleTogglePermission(permission._id)}
                    disabled={disabled}
                  />
                  <label
                    htmlFor={permission._id}
                    className="text-sm cursor-pointer flex-1"
                  >
                    <span className="font-medium">{permission.name}</span>
                    <span className="text-gray-500 block text-xs">
                      {permission.description}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [User Management](./user-management) - User role assignment
