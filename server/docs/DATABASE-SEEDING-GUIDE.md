# Database Seeding Guide

## Overview

This guide covers the database seeding process for the AFS-System, including permissions, roles, and invite codes.

## Seed Script

**Location**: `server/scripts/seed-database.js`

## What Gets Seeded

### 1. Permissions (27 permissions)

| Permission | Description | Category |
|------------|-------------|----------|
| admin:access | Access admin panel | system |
| invite-code:create | Create invitation codes | user |
| invite-code:view | View invitation codes | user |
| invite-code:delete | Delete invitation codes | user |
| invite-code:manage | Manage all invitation codes | user |
| env:view | View environment configuration | system |
| env:update | Update environment configuration | system |
| questionnaire:create | Create questionnaire questions | content |
| questionnaire:update | Update questionnaire questions | content |
| questionnaire:delete | Delete questionnaire questions | content |
| questionnaire:view | View questionnaire data | content |
| memory:view-all | View all user memories | content |
| memory:manage | Manage and moderate memories | content |
| stats:view | View system statistics | system |
| user:create | Create new users | user |
| user:view | View user information | user |
| user:update | Update user information | user |
| user:delete | Delete users | user |
| user:manage | Full user management | user |
| role:create | Create roles | role |
| role:view | View roles | role |
| role:update | Update roles | role |
| role:delete | Delete roles | role |
| role:assign | Assign roles to users | role |
| chat:view-all | View all chat sessions | content |
| chat:moderate | Moderate chat sessions | content |

### 2. Roles (4 roles)

| Role | Description | Permissions |
|------|-------------|-------------|
| superadmin | Full system access with all permissions | All 27 permissions |
| admin | Administrative access | 18 permissions |
| moderator | Content moderation access | 7 permissions |
| user | Standard user | No special permissions |

### 3. Default Admin User

| Field | Value |
|-------|-------|
| Email | admin@afs-system.com |
| Password | Admin123!@# (change on first login) |
| Role | superadmin |
| Unique Code | Auto-generated |

**IMPORTANT**: Change the default password after first login!

### 4. Invite Codes (3 codes)

Three default invite codes are created with the following expiration:
- Initial admin invite code (30 days)
- Beta tester access (60 days)
- Early access code (90 days)

Each code can be used once (maxUses: 1).

## Running the Seed Script

### Prerequisites

1. MongoDB must be running:
   ```bash
   docker-compose up -d mongoserver
   ```

2. Ensure `.env` file is configured with MONGO_URI

### Execute Seed Script

```bash
# From project root
node server/scripts/seed-database.js
```

### Expected Output

```
[timestamp] Starting database seed...
[timestamp] Connecting to MongoDB: mongodb://mongoserver:27017/afs_db
[timestamp] Connected to MongoDB
[timestamp] Seeding permissions...
[timestamp] Created permission: admin:access
[timestamp] Created permission: invite-code:create
...
[timestamp] Permissions seeded: 27 created, 0 updated
[timestamp] Seeding roles...
[timestamp] Created role: superadmin (27 permissions)
[timestamp] Created role: admin (18 permissions)
...
[timestamp] Roles seeded: 4 created, 0 updated
[timestamp] Seeding invite codes...
[timestamp] Created invite code: ABC123XYZ789 - Initial admin invite code
...
[timestamp] Invite codes seeded: 3 created

=== Seed Summary ===
[timestamp] Permissions: 27 created, 0 updated
[timestamp] Roles: 4 created, 0 updated
[timestamp] Invite Codes: 3 created
[timestamp] Seed completed successfully!
```

## Running the Seed Multiple Times

The seed script is idempotent:
- Existing permissions are updated if description/category changed
- Existing roles are updated with latest permissions
- Invite codes are only created if they don't exist (won't create duplicates)

## Invite Code Model

**Location**: `server/src/modules/admin/models/inviteCode.js`

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | String | Yes | Unique invite code (uppercase, 6-32 chars) |
| createdBy | ObjectId | Yes | User who created the code |
| usedBy | ObjectId | No | User who used the code |
| usedAt | Date | No | When the code was used |
| expiresAt | Date | No | Expiration date |
| isActive | Boolean | No | Active status (default: true) |
| maxUses | Number | No | Max usage count (default: 1) |
| useCount | Number | No | Current usage count |
| description | String | No | Code purpose/description |

### Static Methods

- `InviteCode.generateCode(length)` - Generate unique code
- `InviteCode.findActiveCode(code)` - Find active code
- `InviteCode.validateCode(code)` - Validate code for use
- `InviteCode.markAsUsed(code, userId)` - Mark code as used
- `InviteCode.cleanupExpired()` - Deactivate expired codes

### Instance Methods

- `inviteCode.isValid()` - Check if code is usable
- `inviteCode.deactivate()` - Deactivate the code

## Admin API Endpoints

After seeding, the following admin endpoints are available:

### Invite Code Management

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | /api/admin/invite-codes | Create invite code | invite-code:create |
| GET | /api/admin/invite-codes | List invite codes | invite-code:view |
| GET | /api/admin/invite-codes/:id | Get invite code | invite-code:view |
| GET | /api/admin/invite-codes/validate/:code | Validate code | Public |
| POST | /api/admin/invite-codes/:id/deactivate | Deactivate code | invite-code:delete |
| DELETE | /api/admin/invite-codes/:id | Delete code | invite-code:delete |

### System Operations

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | /api/admin/stats | Get system stats | stats:view |
| POST | /api/admin/cleanup | Cleanup expired codes | admin:access |

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Verify MongoDB is running: `docker-compose ps`
2. Check MONGO_URI in .env file
3. Ensure mongoserver container is healthy

### Duplicate Key Errors

The seed script handles duplicates gracefully. If you see duplicate key errors:
1. Check if permissions/roles already exist
2. Run with fresh database: `docker-compose down -v && docker-compose up -d mongoserver`

### Permission Errors

Ensure the script has file execute permissions:
```bash
chmod +x server/scripts/seed-database.js
```

## Security Notes

1. **Change Default Password**: The admin user password should be changed immediately after first login
2. **Environment Variables**: Never commit .env file with real credentials
3. **Invite Codes**: Generate new codes for production use
4. **Role Assignments**: Review role permissions before production deployment

## Database Collections

After seeding, the following collections will be populated:

| Collection | Documents |
|------------|-----------|
| users | 1 (default admin) |
| roles | 4 (superadmin, admin, moderator, user) |
| permissions | 27 |
| invitecodes | 3 |

## Integration with Server

To integrate admin routes with the main server, add to `server/src/server.js`:

```javascript
import adminRoutes from './modules/admin/route.js';

// After other routes
app.use('/api/admin', protect, requirePermission('admin:access'), adminRoutes);
```

## Next Steps

After seeding:

1. Login as admin user
2. Create additional invite codes as needed
3. Assign roles to users
4. Configure environment variables via admin panel
5. Set up questionnaire management

---

For questions or issues, refer to the main documentation or contact the development team.
