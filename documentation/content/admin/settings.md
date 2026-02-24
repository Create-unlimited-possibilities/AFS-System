---
sidebar_position: 7
---

# Environment Variables & Invite Codes

The Settings module provides tools for managing system configuration and admin registration through invite codes.

## Architecture Level

### Module Structure

```
Settings Module
├── Backend (server/src/modules/admin/)
│   ├── services/
│   │   └── envService.js - Environment variable management
│   ├── models/
│   │   └── inviteCode.js - Invite code model
│   └── route.js - Settings API endpoints
│
└── Frontend (web/app/admin/settings/)
    ├── page.tsx - Settings overview
    ├── invite-codes/
    │   └── page.tsx - Invite code management
    └── env/
        └── page.tsx - Environment variable editor
```

### Environment Variable Categories

| Category | Variables | Editability |
|----------|-----------|-------------|
| LLM | LLM_BACKEND, OLLAMA_MODEL, DEEPSEEK_MODEL, etc. | Editable |
| Embedding | EMBEDDING_BACKEND, EMBEDDING_MODEL | Editable |
| Database | MONGO_URI, CHROMA_URL | Read-only (masked) |
| API Keys | DEEPSEEK_API_KEY, OPENAI_API_KEY | Sensitive (masked) |
| Server | PORT, NODE_ENV | Read-only |

## Function Level

### Invite Code Management

#### 1. List Invite Codes

**Endpoint**: `GET /api/admin/invite-codes`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| status | active/used/unused | Filter by status |

**Response**:
```typescript
{
  success: true,
  codes: InviteCode[],
  pagination: { page, limit, total, totalPages }
}

interface InviteCode {
  _id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  isValid: boolean;
  expiresAt: string | null;
  createdAt: string;
}
```

#### 2. Create Invite Code

**Endpoint**: `POST /api/admin/invite-codes`

**Body**:
```typescript
{
  maxUses: number;      // Maximum times code can be used (default: 1)
  expiresIn?: number;   // Hours until expiration (optional)
}
```

**Behavior**: Generates a unique 12-character alphanumeric code.

#### 3. Delete Invite Code

**Endpoint**: `DELETE /api/admin/invite-codes/:id`

#### 4. Validate Invite Code

**Endpoint**: `GET /api/admin/auth/validate-invite/:code`

**Response**:
```typescript
{
  success: true,
  valid: boolean
}
```

### Environment Variable Management

#### 1. Get Environment Variables

**Endpoint**: `GET /api/admin/settings/env/full`

**Response**:
```typescript
{
  success: true,
  editable: {
    [key: string]: {
      value: string,
      default: string,
      description: string,
      category: string,
      type: 'enum' | 'url' | 'number' | 'string',
      options?: string[],     // For enum type
      min?: number,           // For number type
      max?: number            // For number type
    }
  },
  readOnly: {
    // Same structure, values are masked
  },
  sensitive: {
    // Same structure, values are masked (****)
    isSet: boolean  // Whether value is configured
  }
}
```

#### 2. Update Environment Variables

**Endpoint**: `PUT /api/admin/settings/env`

**Body**:
```typescript
{
  updates: {
    [key: string]: {
      value: string
    }
  },
  backup?: boolean  // Create backup before updating (default: true)
}
```

**Response**:
```typescript
{
  success: true,
  updated: string[],  // List of updated keys
  message: string     // "环境变量已更新，需要重启服务以应用更改"
}
```

**Behavior**:
1. Validates all values against their schema
2. Creates `.env.backup` file
3. Updates `.env` file
4. Updates `process.env` for current process

#### 3. Validate Variable

**Endpoint**: `POST /api/admin/settings/env/validate`

**Body**:
```typescript
{
  key: string,
  value: string
}
```

**Response**: Validation result without applying changes

#### 4. Get Schema

**Endpoint**: `GET /api/admin/settings/env/schema`

**Response**: Full configuration schema with all variable definitions

#### 5. List Backups

**Endpoint**: `GET /api/admin/settings/env/backups`

**Response**: Array of backup file paths with timestamps

#### 6. Restore Backup

**Endpoint**: `POST /api/admin/settings/env/restore`

**Body**:
```typescript
{
  backupPath: string
}
```

## Code Level

### Backend: Invite Code Model

**File**: `server/src/modules/admin/models/inviteCode.js`

```javascript
const inviteCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 32,
    description: 'Unique invitation code'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'User who created the invite code'
  },
  maxUses: {
    type: Number,
    default: 1,
    min: 1,
    description: 'Maximum number of times this code can be used'
  },
  useCount: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Number of times this code has been used'
  },
  expiresAt: {
    type: Date,
    description: 'Expiration date for the code'
  },
  isActive: {
    type: Boolean,
    default: true,
    description: 'Whether the code is active'
  }
}, {
  timestamps: true
});

// Virtual: Check if code is usable
inviteCodeSchema.virtual('isUsable').get(function() {
  return this.isActive &&
         !this.isExpired &&
         (this.maxUses === null || this.useCount < this.maxUses);
});

// Static: Generate unique code
inviteCodeSchema.statics.generateCode = async function(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await this.findOne({ code });
    exists = !!existing;
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique code after ' + maxAttempts + ' attempts');
  }

  return code;
};
```

### Backend: Create Invite Code Service

**File**: `server/src/modules/admin/service.js`

```javascript
async createInviteCode({ maxUses = 1, createdBy, expiresAt }) {
  const code = await InviteCode.generateCode();

  const inviteCode = await InviteCode.create({
    code,
    maxUses,
    createdBy,
    expiresAt
  });

  return inviteCode;
}
```

### Backend: Environment Variable Service

**File**: `server/src/modules/admin/services/envService.js`

```javascript
class EnvVarService {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.backupPath = path.join(process.cwd(), '.env.backup');
  }

  /**
   * Read and parse .env file
   */
  async readEnvFile() {
    try {
      const content = await fs.readFile(this.envPath, 'utf-8');
      return this.parseEnvFile(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { envVars: {}, comments: {} };
      }
      throw error;
    }
  }

  /**
   * Create backup of .env file
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.backupPath}.${timestamp}`;

    await fs.copyFile(this.envPath, backupPath);

    // Clean up old backups (keep last 5)
    await this.cleanupOldBackups();

    return backupPath;
  }

  /**
   * Get all environment variables with metadata
   */
  async getEnvironmentVariables() {
    const { envVars } = await this.readEnvFile();

    const result = {
      editable: {},
      readOnly: {},
      sensitive: {}
    };

    // Process editable variables
    for (const [key, config] of Object.entries(ENV_CONFIG.editable)) {
      result.editable[key] = {
        value: envVars[key] || config.default,
        default: config.default,
        description: config.description,
        category: config.category,
        type: config.type,
        ...(config.type === 'enum' && { options: config.values }),
        ...(config.type === 'number' && { min: config.min, max: config.max })
      };
    }

    // Process sensitive variables (masked)
    for (const [key, config] of Object.entries(ENV_CONFIG.sensitive)) {
      const value = envVars[key];
      result.sensitive[key] = {
        value: value ? this.maskValue(value) : '',
        isSet: !!value,
        description: config.description,
        category: config.category
      };
    }

    return result;
  }

  /**
   * Update environment variables
   */
  async updateEnvironmentVariables(updates, options = {}) {
    const { backup = true } = options;

    // Read current .env file
    const { envVars, comments } = await this.readEnvFile();

    // Validate all updates
    const errors = [];
    const validatedUpdates = {};

    for (const [key, { value }] of Object.entries(updates)) {
      const config = ENV_CONFIG.editable[key] || ENV_CONFIG.sensitive[key];

      if (!config) {
        errors.push({ key, error: '不可编辑的变量' });
        continue;
      }

      // Validate value
      const validation = this.validateVariable(key, value, config);
      if (!validation.valid) {
        errors.push({ key, error: validation.error });
        continue;
      }

      validatedUpdates[key] = value;
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Create backup if requested
    if (backup) {
      await this.createBackup();
    }

    // Apply updates
    for (const [key, value] of Object.entries(validatedUpdates)) {
      envVars[key] = value;
    }

    // Write back to .env file
    const newContent = this.buildEnvFile(envVars, comments);
    await fs.writeFile(this.envPath, newContent, 'utf-8');

    // Update process.env for current process
    for (const [key, value] of Object.entries(validatedUpdates)) {
      process.env[key] = value;
    }

    return {
      success: true,
      updated: Object.keys(validatedUpdates),
      message: '环境变量已更新，需要重启服务以应用更改'
    };
  }

  /**
   * Mask sensitive value for display
   */
  maskValue(value) {
    if (!value || value.length <= 8) {
      return '****';
    }
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  }
}
```

### Frontend: Invite Codes Page

**File**: `web/app/admin/settings/invite-codes/page.tsx`

```typescript
export default function InviteCodesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    maxUses: 1,
    expiresIn: 24
  });

  const loadCodes = async () => {
    const result = await getInviteCodes();
    if (result.success && result.codes) {
      setCodes(result.codes);
    }
  };

  const handleCreate = async () => {
    const result = await createInviteCode({
      maxUses: formData.maxUses,
      expiresIn: formData.expiresIn
    });

    if (result.success) {
      setShowCreateDialog(false);
      await loadCodes();
    }
  };

  const handleDelete = async (codeId: string) => {
    const result = await deleteInviteCode(codeId);
    if (result.success) {
      await loadCodes();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">邀请码管理</h1>
          <p className="text-gray-600">生成和管理管理员注册邀请码</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          生成邀请码
        </Button>
      </div>

      <Card>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>邀请码</TableHead>
            <TableHead>创建者</TableHead>
            <TableHead>使用情况</TableHead>
            <TableHead>过期时间</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((code) => (
            <TableRow key={code._id}>
              <TableCell>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {code.code}
                </code>
              </TableCell>
              <TableCell>{code.createdBy.name}</TableCell>
              <TableCell>
                {code.usedCount} / {code.maxUses}
              </TableCell>
              <TableCell>
                {code.expiresAt
                  ? new Date(code.expiresAt).toLocaleDateString('zh-CN')
                  : '永不过期'}
              </TableCell>
              <TableCell>
                <Badge className={code.isValid ? 'bg-green-100 text-green-700' : 'bg-gray-100'}>
                  {code.isValid ? '有效' : '无效'}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(code._id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>

    {/* Create Dialog */}
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生成邀请码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>最大使用次数</Label>
            <Input
              type="number"
              value={formData.maxUses}
              onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) })}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>有效期（小时）</Label>
            <Input
              type="number"
              value={formData.expiresIn}
              onChange={(e) => setFormData({ ...formData, expiresIn: parseInt(e.target.value) })}
              min={1}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
            取消
          </Button>
          <Button onClick={handleCreate}>
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
}
```

### Frontend: Environment Variables Page

**File**: `web/app/admin/settings/env/page.tsx`

```typescript
export default function EnvVarsPage() {
  const [envVars, setEnvVars] = useState<{
    editable: Record<string, EnvVar>;
    readOnly: Record<string, EnvVar>;
    sensitive: Record<string, EnvVar & { isSet: boolean }>;
  }>({ editable: {}, readOnly: {}, sensitive: {} });

  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const loadEnvVars = async () => {
    const result = await getEnvVars();
    if (result.success && result.vars) {
      setEnvVars(result.vars as any);
    }
  };

  const handleChange = (key: string, value: string) => {
    setPendingChanges({ ...pendingChanges, [key]: value });
    setValidationErrors({ ...validationErrors, [key]: '' });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = Object.entries(pendingChanges).reduce((acc, [key, value]) => {
      acc[key] = { value };
      return acc;
    }, {});

    const result = await updateEnvVar('', JSON.stringify(updates));
    if (result.success) {
      setPendingChanges({});
      await loadEnvVars();
    } else {
      // Handle validation errors
      if (result.errors) {
        const errors = result.errors.reduce((acc, err) => {
          acc[err.key] = err.error;
          return acc;
        }, {});
        setValidationErrors(errors);
      }
    }
    setIsSaving(false);
  };

  const categories = {
    llm: 'LLM 配置',
    embedding: 'Embedding 配置',
    database: '数据库配置',
    api: 'API 密钥',
    server: '服务器配置'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">环境变量</h1>
          <p className="text-gray-600">管理系统配置参数</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || Object.keys(pendingChanges).length === 0}
        >
          {isSaving ? '保存中...' : '保存更改'}
        </Button>
      </div>

      {Object.entries(categories).map(([catKey, catName]) => (
        <Card key={catKey}>
          <CardHeader>
            <CardTitle>{catName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(envVars.editable)
              .filter(([key, conf]) => conf.category === catKey)
              .map(([key, conf]) => (
                <div key={key} className="grid grid-cols-3 gap-4">
                  <div className="font-medium">{key}</div>
                  <div className="col-span-2">
                    {conf.type === 'enum' ? (
                      <Select
                        value={pendingChanges[key] ?? conf.value}
                        onValueChange={(v) => handleChange(key, v)}
                      >
                        {conf.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={conf.type === 'number' ? 'number' : 'text'}
                        value={pendingChanges[key] ?? conf.value}
                        onChange={(e) => handleChange(key, e.target.value)}
                        min={conf.min}
                        max={conf.max}
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">{conf.description}</p>
                    {validationErrors[key] && (
                      <p className="text-xs text-red-500">{validationErrors[key]}</p>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [Roles & Permissions](./roles) - Admin role configuration
- [User Management](./user-management) - User role assignment
