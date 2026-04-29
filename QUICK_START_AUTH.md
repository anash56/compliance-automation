# Quick Start - Authentication Testing

## Prerequisites
- Node.js installed
- PostgreSQL running
- Both backend and frontend dependencies installed

## Start Services

### Terminal 1 - Backend
```bash
cd backend
npm run dev
# Should show: Server running on port 5000
# Should show: Database connected
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
# Should show: Local: http://localhost:5173
```

## Test Accounts

### Demo Account (Pre-created)
- Email: `demo@example.com`
- Password: `demo123`

### Test New Signup
1. Go to `http://localhost:5173/signup`
2. Fill form:
   - Full Name: `John Doe`
   - Email: `john@example.com`
   - Password: `password123`
3. Click "Create Account"
4. Should see success message and auto-redirect to dashboard

## Test Login
1. Go to `http://localhost:5173/login`
2. Use any created account:
   - Email: `john@example.com`
   - Password: `password123`
3. Click "Login"
4. Should redirect to dashboard

## Test Error Cases

### Invalid Email
1. Go to signup
2. Enter: `invalidemail` (no @)
3. Should show: "Invalid email format"

### Password Too Short
1. Go to signup
2. Password: `123` (less than 6 chars)
3. Should show: "Password must be at least 6 characters"

### Email Already Exists
1. Go to signup
2. Email: `demo@example.com` (existing)
3. Should show: "Email already registered"

### Wrong Password
1. Go to login
2. Email: `demo@example.com`
3. Password: `wrongpassword`
4. Should show: "Invalid email or password"

## Browser DevTools Checks

### Check Token Storage
1. Press F12 (Open DevTools)
2. Go to "Application" or "Storage"
3. Click "localStorage"
4. After login, you should see `token: "eyJ..."`

### Check Network Requests
1. Press F12
2. Go to "Network" tab
3. Perform login
4. Click on `auth/login` POST request
5. Check "Response" tab shows token

### Check for Errors
1. Press F12
2. Go to "Console" tab
3. Look for any red error messages
4. Check if API URL is correct

## Expected Flow

```
User navigates to /signup
        ↓
Fills form and clicks "Create Account"
        ↓
Frontend validates input
        ↓
Sends POST to /api/auth/signup
        ↓
Backend validates and creates user
        ↓
Generates JWT token
        ↓
Returns token and user data
        ↓
Frontend saves token to localStorage
        ↓
Stores user in Redux state
        ↓
Shows success message
        ↓
Auto-redirects to /dashboard
```

## Common Issues & Fixes

### Backend won't start
```bash
# Check PostgreSQL is running
# Check DATABASE_URL in backend/.env is correct
# Try: npx prisma migrate deploy
```

### Frontend won't connect to backend
```bash
# Check VITE_API_URL in frontend/.env
# Should be: http://localhost:5000/api
# Check backend is running on port 5000
```

### Login fails with "Invalid email or password"
```bash
# Check you entered the correct email
# Check you entered the correct password
# Try the demo account first
```

### Token not saving
```bash
# Check localStorage in DevTools
# Clear localStorage and try again
# Check browser allows localStorage
```

### Redirects not working
```bash
# Check browser console for errors
# Check if token exists in localStorage
# Clear browser cache and try again
```

## Architecture Summary

```
Frontend (React + Redux)
    ↓
API Service (axios with interceptors)
    ↓
Backend (Express)
    ↓
PostgreSQL Database
```

## Key Features Implemented

✅ User signup with validation
✅ User login with password verification
✅ JWT token generation and storage
✅ Auto-login after signup
✅ Protected routes with token check
✅ Token auto-refresh in API calls
✅ Auto-logout on 401 error
✅ Error message display
✅ Success message display
✅ Loading states during auth

## Files to Review if Issues Persist

1. [backend/src/routes/auth.ts](backend/src/routes/auth.ts) - Auth endpoints
2. [frontend/src/store/slices/authSlice.ts](frontend/src/store/slices/authSlice.ts) - Redux state
3. [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx) - Login UI
4. [backend/.env](backend/.env) - Database connection
5. [frontend/.env](frontend/.env) - API URL

See [AUTH_COMPLETE_GUIDE.md](AUTH_COMPLETE_GUIDE.md) for detailed documentation.
