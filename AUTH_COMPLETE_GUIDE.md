# Complete Authentication Process Guide

## Overview
This document explains the complete signup and login flow in the Compliance Automation application.

---

## System Architecture

### Frontend (React + Redux)
- **Login Component**: [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx)
- **Auth Slice**: [frontend/src/store/slices/authSlice.ts](frontend/src/store/slices/authSlice.ts)
- **API Service**: [frontend/src/services/api.ts](frontend/src/services/api.ts)
- **Protected Routes**: [frontend/src/components/ProtectedRoute.tsx](frontend/src/components/ProtectedRoute.tsx)

### Backend (Node.js + Express)
- **Auth Routes**: [backend/src/routes/auth.ts](backend/src/routes/auth.ts)
- **Auth Middleware**: [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts)
- **Database Schema**: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

---

## Complete Signup Flow

### Step 1: User Navigates to Sign Up
- User clicks on "Sign Up" button or navigates to `/signup` route
- The same Login component is used for both login and signup (conditional rendering based on location)

### Step 2: User Fills Sign Up Form
Form fields:
- **Full Name**: User's complete name
- **Email**: User's email address
- **Password**: Minimum 6 characters

### Step 3: Frontend Validation
```typescript
// Location: frontend/src/components/Login.tsx
if (!email || !password || (isSignup && !fullName)) {
  setLocalError('Please fill all fields');
  return;
}
```

### Step 4: Redux Action Dispatch
```typescript
// Location: frontend/src/store/slices/authSlice.ts
dispatch(signup({ email, password, fullName }))
```

The signup thunk:
- Makes POST request to `http://localhost:5000/api/auth/signup`
- Sends: `{ email, password, fullName }`
- Captures error response for user feedback

### Step 5: Backend Validation
```typescript
// Location: backend/src/routes/auth.ts - POST /signup
1. Check if all fields are provided
2. Validate email format (must be valid email)
3. Validate password length (minimum 6 characters)
4. Check if email already exists in database
5. Hash password using bcryptjs (10 salt rounds)
6. Create user in database with role: 'business_owner'
```

### Step 6: Token Generation
- Backend generates JWT token that lasts 7 days
- Token includes: `{ userId: user.id }`
- Signed with JWT_SECRET from environment variables

### Step 7: Response to Frontend
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "cuid123",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "business_owner"
  }
}
```

### Step 8: Redux Store Update
```typescript
// Location: frontend/src/store/slices/authSlice.ts - signup.fulfilled
state.user = action.payload.user;
state.token = action.payload.token;
```

### Step 9: Token Storage
```typescript
localStorage.setItem('token', response.data.token);
```

### Step 10: Redirect
- Success message displayed for 1.5 seconds
- User redirected to `/dashboard`

---

## Complete Login Flow

### Step 1: User Navigates to Login
- User navigates to `/login` route
- Same Login component displays login form

### Step 2: User Fills Login Form
Form fields:
- **Email**: Registered email address
- **Password**: Account password

### Step 3: Frontend Validation
```typescript
if (!email || !password) {
  setLocalError('Please fill all fields');
  return;
}
```

### Step 4: Redux Action Dispatch
```typescript
dispatch(login({ email, password }))
```

The login thunk:
- Makes POST request to `http://localhost:5000/api/auth/login`
- Sends: `{ email, password }`
- Captures error response for user feedback

### Step 5: Backend Verification
```typescript
// Location: backend/src/routes/auth.ts - POST /login
1. Check if email and password are provided
2. Find user by email in database
3. If not found: return "Invalid email or password"
4. Compare provided password with hashed password using bcryptjs
5. If password doesn't match: return "Invalid email or password"
6. Generate JWT token (7 days expiration)
```

### Step 6: Response to Frontend
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "cuid123",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "business_owner"
  }
}
```

### Step 7: Redux Store Update
```typescript
// Location: frontend/src/store/slices/authSlice.ts - login.fulfilled
state.user = action.payload.user;
state.token = action.payload.token;
```

### Step 8: Token Storage
```typescript
localStorage.setItem('token', response.data.token);
```

### Step 9: Auto-Login Redirect
- Success message displayed
- Automatically redirected to `/dashboard`

---

## API Interceptors

### Request Interceptor
```typescript
// Location: frontend/src/services/api.ts
// Automatically adds Authorization header to every request
Authorization: Bearer <token>
```

### Response Interceptor
```typescript
// Location: frontend/src/services/api.ts
// If 401 Unauthorized:
// 1. Remove token from localStorage
// 2. Redirect to /login
```

---

## Protected Routes

### Route Protection Logic
```typescript
// Location: frontend/src/components/ProtectedRoute.tsx
const { token } = useSelector((state: RootState) => state.auth);
if (!token) {
  return <Navigate to="/login" />;
}
return children; // Render protected page
```

### Protected Routes
- `/dashboard` - Dashboard page
- `/gst` - GST module
- `/tds` - TDS module

### Public Routes
- `/` - Home page
- `/login` - Login page
- `/signup` - Signup page

---

## Error Handling

### Signup Errors
| Scenario | Error Message |
|----------|---------------|
| Missing fields | "Email, password, and full name are required" |
| Invalid email | "Invalid email format" |
| Password too short | "Password must be at least 6 characters" |
| Email already exists | "Email already registered" |
| Server error | "Failed to create account. Please try again." |

### Login Errors
| Scenario | Error Message |
|----------|---------------|
| Missing fields | "Email and password are required" |
| Invalid credentials | "Invalid email or password" |
| Server error | "Login failed. Please try again." |

### Network Errors
- Automatically caught and displayed to user
- Error messages passed from backend or generic fallback

---

## Database Schema

### User Table
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique          // Must be unique
  password  String                    // Hashed with bcryptjs
  fullName  String
  role      String   @default("business_owner")
  companies Company[]                 // Related companies
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Environment Variables

### Backend (.env)
```
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/compliance_db"
JWT_SECRET="ba3c791d2b3d9c603b101f9c2904f1574398fb8e51765cc889f10e8811ec1ab3a21ac851a0a12d65eea766b12955c2fc"
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

---

## Testing the Auth Flow

### Prerequisites
1. Backend running: `npm run dev` (in backend folder)
2. Frontend running: `npm run dev` (in frontend folder)
3. PostgreSQL database running
4. Database migrations applied: `npx prisma migrate deploy`

### Test Signup
1. Navigate to `http://localhost:5173/signup`
2. Fill form with:
   - Full Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
3. Click "Create Account"
4. Should see success message and redirect to dashboard
5. Should be logged in automatically

### Test Login
1. Navigate to `http://localhost:5173/login`
2. Fill form with:
   - Email: "test@example.com"
   - Password: "password123"
3. Click "Login"
4. Should see success message and redirect to dashboard
5. Should be logged in

### Test Protected Routes
1. Logout (if available)
2. Try to navigate to `/dashboard`
3. Should redirect to `/login`
4. Login again
5. Should access dashboard normally

### Test Token Persistence
1. Login and note the URL is now `/dashboard`
2. Refresh the page
3. Should remain logged in (token from localStorage is restored)
4. Close browser and reopen
5. Token still valid (localStorage persists)

---

## Troubleshooting

### Issue: Login/Signup button doesn't respond
**Solution:**
1. Check browser console for errors (F12)
2. Check network tab to see if request is being sent
3. Verify backend is running on port 5000
4. Check VITE_API_URL in frontend .env

### Issue: "Failed to create account" error
**Solution:**
1. Check backend console for detailed error
2. Verify database connection is working
3. Run `npx prisma migrate deploy` to ensure schema is created
4. Check PostgreSQL is running

### Issue: Token not saving
**Solution:**
1. Check browser localStorage (F12 → Application → Storage → localStorage)
2. Verify response from backend includes token
3. Check for CORS issues in browser console
4. Verify Content-Type headers are correct

### Issue: Cannot access dashboard after login
**Solution:**
1. Check if token is in localStorage
2. Check if token is being sent in Authorization header
3. Verify JWT_SECRET matches between backend signup and login
4. Check token expiration (logs might show "Token expired")

### Issue: CORS errors
**Solution:**
1. Verify FRONTEND_URL in backend .env matches frontend URL
2. Check CORS middleware in `backend/src/server.ts`
3. Clear browser cache and cookies
4. Restart backend server

---

## Key Implementation Details

### Password Security
- Passwords are hashed using bcryptjs with 10 salt rounds
- Original passwords are never stored
- Comparison uses timing-safe comparison (built into bcryptjs)

### Token Security
- JWT tokens expire after 7 days
- Tokens are stored in localStorage (accessible via JavaScript)
- Alternative: Use httpOnly cookies for better security (future improvement)

### Email Validation
- Format validated with regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Uniqueness enforced at database level (UNIQUE constraint)
- Duplicate emails return 400 error

### Session Management
- No server-side sessions used
- State managed entirely with JWT tokens
- Logout simply removes token from localStorage

---

## Files Modified for Auth Fix

1. **frontend/src/store/slices/authSlice.ts**
   - Improved error handling with rejectWithValue
   - Token now saved for signup if provided
   - Better error messages

2. **frontend/src/components/Login.tsx**
   - Improved redirect logic
   - Better success messages
   - Proper token-based redirect

3. **backend/src/routes/auth.ts**
   - Enhanced validation
   - Better error messages
   - Signup now returns token for auto-login

---

## Next Steps

### For Production
1. Use httpOnly cookies instead of localStorage
2. Add refresh token mechanism
3. Implement rate limiting on auth endpoints
4. Add email verification
5. Add password reset functionality
6. Implement 2FA (Two-Factor Authentication)

### For Better UX
1. Add "Remember me" functionality
2. Add password strength meter on signup
3. Add social login (Google, GitHub)
4. Add email verification before account activation
5. Add password reset email
6. Add account recovery options

---

## Support & Debugging

For detailed debugging:
1. Check browser console (F12)
2. Check browser network tab for API responses
3. Check backend logs (terminal where server is running)
4. Verify all environment variables are set
5. Check database connection: `curl http://localhost:5000/api/health`

Last Updated: April 29, 2026
