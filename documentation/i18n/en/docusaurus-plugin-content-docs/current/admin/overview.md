---
sidebar_position: 2
---

# Admin Panel

The Admin Panel provides a comprehensive interface for system administration.

## Access

The admin panel is accessible at `/admin` route. To access:

1. Navigate to `/admin/login`
2. Login with admin credentials
3. Admin registration requires a valid invite code

## Features

### Dashboard

The dashboard provides an overview of the system:

- **User Statistics**: Total users, new users today, active users
- **Memory Statistics**: Total memories, questionnaire completion rate
- **System Status**: MongoDB, ChromaDB, and LLM service status
- **User Growth Chart**: Visual representation of user registration over time
- **Recent Activity**: Latest user activities

### User Management

Manage all users in the system:

- **User List**: Paginated list with search and filters
- **User Details**: View user profile and statistics
- **Edit User**: Modify user information and role
- **Toggle Status**: Activate/deactivate users
- **Delete User**: Remove users and their data

### Questionnaire Management

Manage the questionnaire system:

- **Question List**: View all questions with filters
- **CRUD Operations**: Create, read, update, delete questions
- **Question Ordering**: Reorder questions within categories
- **Batch Import**: Import multiple questions via JSON
- **Export**: Export questions to JSON format

### Memory Management

Manage user memories and vector indexes:

- **User Summaries**: View memory count per user
- **Memory Details**: View individual user's memories
- **Vector Status**: Check ChromaDB index status
- **Index Rebuilding**: Rebuild vector indexes
- **Memory Export**: Export user memory data

### Role & Permission Management

Manage roles and permissions:

- **Role List**: View all roles
- **Create Roles**: Define new roles with permissions
- **Edit Roles**: Modify role permissions
- **Delete Roles**: Remove unused roles
- **Permission List**: View all available permissions

### Invite Code System

Manage admin registration:

- **Generate Codes**: Create new invite codes
- **Set Limits**: Configure max uses and expiration
- **Track Usage**: Monitor code usage
- **Delete Codes**: Remove unused codes

### Settings

- **Environment Variables**: View system configuration
- **System Information**: View service status

## Permissions

The admin system uses a permission-based access control:

### User Permissions
- `user:view` - View user list
- `user:create` - Create users
- `user:update` - Update users
- `user:delete` - Delete users

### Role Permissions
- `role:view` - View roles
- `role:create` - Create roles
- `role:update` - Update roles
- `role:delete` - Delete roles

### Questionnaire Permissions
- `questionnaire:view` - View questions
- `questionnaire:create` - Create questions
- `questionnaire:update` - Update questions
- `questionnaire:delete` - Delete questions

### Memory Permissions
- `memory:view` - View memories
- `memory:manage` - Manage vector indexes

### System Permissions
- `system:settings` - View system settings
- `system:env` - Manage environment variables

## Initial Setup

The system creates a default admin on first startup:

```bash
# Environment variables for default admin
ADMIN_EMAIL=admin@afs-system.com
ADMIN_PASSWORD=admin123456
ADMIN_INVITE_CODE=your-secure-admin-invite-code
```

**Important**: Change these credentials in production!

## Architecture

The admin panel consists of:

### Frontend (web/app/admin/)
- `page.tsx` - Dashboard
- `users/` - User management
- `questionnaires/` - Question management
- `memories/` - Memory management
- `roles/` - Role management
- `settings/` - System settings
- `login/` & `register/` - Authentication

### Backend (server/src/modules/admin/)
- `controller.js` - Request handlers
- `service.js` - Business logic
- `route.js` - API routes
- `authRoute.js` - Authentication routes
- `models/` - Data models
- `services/` - Sub-services (env, etc.)
- `scripts/` - Initialization scripts

## API Endpoints

See [Core Overview](/docs/core/overview) for complete API documentation.
