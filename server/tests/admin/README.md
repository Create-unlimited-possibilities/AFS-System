# Admin Panel E2E Tests

Comprehensive end-to-end tests for the AFS-System Admin Panel.

## Test Structure

```
server/tests/admin/
├── admin-auth.test.js          # Authentication & authorization tests
├── admin-users.test.js          # User management tests
├── admin-questionnaires.test.js # Questionnaire management tests
├── admin-memories.test.js       # Memory management tests
├── admin-settings.test.js       # Environment variables & settings tests
├── admin-dashboard.test.js      # Dashboard & statistics tests
├── admin-roles.test.js          # Role & permission management tests
└── README.md                    # This file
```

## Test Coverage

### 1. Authentication & Authorization (`admin-auth.test.js`)
- ✅ Admin registration with invite code
- ✅ Admin login flow
- ✅ Permission boundary tests (non-admin access denial)
- ✅ Invite code generation and validation
- ✅ One-time invite code usage

### 2. User Management (`admin-users.test.js`)
- ✅ User list with pagination and filters
- ✅ User details view
- ✅ Create, edit, delete users
- ✅ Toggle user status (activate/deactivate)
- ✅ Bulk operations

### 3. Questionnaire Management (`admin-questionnaires.test.js`)
- ✅ Question list with role/layer filters
- ✅ Create, edit, delete questions
- ✅ Reorder questions
- ✅ Import/export questions

### 4. Memory Management (`admin-memories.test.js`)
- ✅ View user memories
- ✅ Rebuild vector index
- ✅ Export user memories
- ✅ Memory statistics and analytics

### 5. Environment Variables (`admin-settings.test.js`)
- ✅ View environment variables (with masking)
- ✅ Edit editable variables
- ✅ Permission checks for variable editing
- ✅ Invite code management

### 6. Dashboard (`admin-dashboard.test.js`)
- ✅ Overview statistics
- ✅ System status indicators
- ✅ User growth trends
- ✅ Recent activities

### 7. Role Management (`admin-roles.test.js`)
- ✅ Role list and details
- ✅ Create custom roles
- ✅ Update role permissions
- ✅ Delete custom roles
- ✅ Assign roles to users

## Prerequisites

### Environment Setup

1. **Set environment variables**:
```bash
# Required for admin registration tests
ADMIN_INVITE_CODE=test-admin-invite-code-123

# Database
MONGO_URI=mongodb://localhost:27018/afs_test

# API
API_URL=http://localhost:3001
```

2. **Ensure services are running**:
```bash
# MongoDB
docker exec afs-system-mongoserver-1 mongosh

# Backend server
cd server && npm run dev
```

### Dependencies

The tests require:
- `vitest` - Test runner
- `supertest` - HTTP assertion library
- `mongoose` - MongoDB ODM
- `jsonwebtoken` - JWT verification

## Running Tests

### Run all admin tests:
```bash
cd server
npm test admin/
```

### Run specific test file:
```bash
cd server
npm test admin/admin-auth.test.js
```

### Run with coverage:
```bash
cd server
npm run test:coverage -- admin/
```

### Run in watch mode:
```bash
cd server
npm run test:watch -- admin/
```

## Test Results

### Expected Results (Once Admin Panel is Implemented)

When the admin panel functionality is fully implemented, all tests should pass:

```
Test Files  7 passed (7)
     Tests  150+ passed
```

### Current Status

⚠️ **Note**: These tests are designed based on the admin panel specification (`docs/plans/2026-02-22-admin-panel-design.md`). The tests will currently fail because the admin functionality has not been implemented yet.

## Test Data

### Test Admin
- Username: `testadmin` / `questionadmin` / etc.
- Password: `TestAdmin123!`
- Email: `testadmin@afs-system.com`

### Test User
- Username: `testuser` / `memoryuser` / etc.
- Password: `TestUser123!`
- Email: `testuser@afs-system.com`

### Sample Data Created During Tests

- Admin users (with various permissions)
- Regular users (for permission boundary testing)
- Questionnaire entries (elder, family, friend roles)
- Memory entries (various types)
- Custom roles and permissions
- Invite codes

## Cleanup

Tests automatically clean up data created during test execution:
- Database entries are deleted in `afterEach` hooks
- Admin tokens are invalidated after each test suite

## Troubleshooting

### Tests fail with "Cannot connect to database"
- Ensure MongoDB is running: `docker ps | grep mongo`
- Check MONGO_URI in `.env`

### Tests fail with "ADMIN_INVITE_CODE not set"
- Set `ADMIN_INVITE_CODE` in `.env`
- Example: `ADMIN_INVITE_CODE=test-code-12345`

### Tests fail with "401 Unauthorized"
- Ensure backend server is running on port 3001
- Check JWT_SECRET is set in `.env`

### Tests fail with "403 Forbidden"
- Check that admin user has `admin:access` permission
- Verify `requirePermission` middleware is configured

## Development Workflow

1. **Write tests first** (TDD approach)
2. **Implement admin functionality**
3. **Run tests to verify**
4. **Fix any failing tests**
5. **Ensure all tests pass**

## Contributing

When adding new admin features:

1. Create corresponding test file in `server/tests/admin/`
2. Follow the naming convention: `admin-{feature}.test.js`
3. Include tests for:
   - Happy path scenarios
   - Error cases
   - Permission checks
   - Input validation
   - Edge cases

4. Update this README with new test coverage

---

**Author**: AFS Testing Team
**Version**: 1.0.0
**Last Updated**: 2026-02-22
