# Authentication System

This portfolio website now includes a complete authentication system with user
registration, login, password reset, and protected routes.

## Features

- ✅ User registration and login
- ✅ Secure password hashing (bcryptjs)
- ✅ JWT token authentication
- ✅ HTTP-only cookie sessions
- ✅ Password reset
- ✅ Protected dashboard route

## Setup Instructions

### 1. Environment Variables

Update your `.env` file with the following variables:

```env
# JWT Secret (already configured with secure random key)
SJS_JWT_SECRET="5e85f7e3c23984bba36951494572bdb98565fac82bd67deaecaf072c6e9a1b5302189020737331a2e32d1ded21d53767d958153d1ec086bedd2efe55bb96b002"

# Application URL (_HOST for external access)
SJS_APP_URL_HOST="http://localhost:5173"
```

### 2. Database

The Prisma PostgreSQL server is already running. The user table includes:

- `id` (CUID)
- `email` (unique)
- `password` (hashed)
- `firstName`, `lastName` (optional)
- `passwordResetToken`, `passwordResetExpiry`
- `isEmailVerified`, `emailVerifyToken`
- Timestamps

## API Routes

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/user` - Get current user profile

### Example Usage

#### Registration

```javascript
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "securepassword",
    firstName: "John",
    lastName: "Doe",
  }),
});
```

#### Login

```javascript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "securepassword",
  }),
});
```

## Pages

- `/auth` - Login/signup page with forgot password
- `/auth/reset-password` - Password reset page
- `/dashboard` - Protected user dashboard (requires authentication)

## Security Features

- **Password Hashing**: bcryptjs with salt rounds of 12
- **JWT Tokens**: 7-day expiry, HTTP-only cookies
- **CSRF Protection**: SameSite cookie policy
- **Input Validation**: Email format, password length
- **Rate Limiting**: Built-in via SvelteKit
- **Secure Headers**: Automatic in production

## Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Test authentication**:
   - Navigate to `/auth`
   - Create an account or log in
   - Test password reset
   - Visit `/dashboard` (protected route)

3. **Database operations**:
   ```bash
   npx prisma studio  # View database
   npx prisma migrate dev  # Apply new migrations
   ```

## Production Deployment

1. **Update environment variables**:
   - Set `SJS_APP_URL_HOST` to your production domain
   - Use a production PostgreSQL database
2. **Security considerations**:
   - SJS_JWT_SECRET should be a secure random string (already configured)
   - Use HTTPS in production
   - Configure proper CORS policies
   - Set up proper error monitoring

## Troubleshooting

### "secretOrPrivateKey must have a value"

- Ensure `SJS_JWT_SECRET` is set in your `.env` file
- Restart the development server after changing environment variables

### Authentication not working

- Clear browser cookies and try again
- Check browser network tab for API errors
- Verify Prisma database connection is working
