# Powered PYQs - Vercel Deployment Guide

## Overview
This document outlines the changes made to support a separate access key generation page on Vercel deployment and verification that all systems are working correctly.

---

## ✅ System Status (VERIFIED)

All critical systems have been tested and verified as working:

| System | Status | Details |
|--------|--------|---------|
| **Database** | ✅ Working | SQLite/PostgreSQL initialized with all required tables |
| **User Registration** | ✅ Working | Users can sign up and receive 24-hour free access |
| **User Login** | ✅ Working | Login authentication with password hashing |
| **Access Keys** | ✅ Working | Key generation, validation, and activation |
| **API Endpoints** | ✅ Working | All API routes responding correctly |

---

## 🔄 New Workflow: Access Key Generation on Vercel

### Previous Workflow (Local/Development)
- User clicks "Claim Free Access"
- Opens external page/tab
- User completes task
- Manually activates key

### New Workflow (Vercel/Production)
```
User clicks "Claim Free Access" 
    ↓
Redirects to /get-access.html (same-domain)
    ↓
Shows task interface with timer
    ↓
User clicks "I Completed the Task"
    ↓
Backend activates access key
    ↓
Redirects back to home (?accessUnlocked=true)
    ↓
Access unlocked for 24 hours
```

---

## 📁 Files Created

### 1. **get-access.html** (NEW)
Complete standalone access key claiming page with:
- Clean, professional UI with gradient background
- 5-minute countdown timer
- Task completion interface
- Real-time validation with backend
- Auto-redirect after successful activation
- Mobile responsive design

**Features:**
- Automatic key generation on page load
- Backend communication for key activation
- Session storage for security
- Error handling and user feedback
- Beautiful loading states and animations

---

## 🔧 Files Modified

### 1. **script.js** - Main Application Logic

**Changes:**
```javascript
// Detects environment (production vs development)
const isProduction = window.location.hostname !== 'localhost' && 
                    !window.location.hostname.startsWith('127.0.0.1') && 
                    !window.location.hostname.startsWith('192.168.');

if (isProduction) {
    // Vercel: Redirect to dedicated page
    window.location.href = `/get-access.html?userId=${state.currentUser.id}`;
} else {
    // Local: Keep existing behavior
    window.open(claimUrl, '_blank');
}
```

**Modified Function:** `setupAccessClaimListener()`
- Automatically detects deployment environment
- Routes to appropriate access flow
- Maintains backward compatibility

**Added URL Param Handler:**
```javascript
else if (urlParams.get('accessUnlocked') === 'true') {
    showToast("🎉 Access Unlocked for 24 Hours! Happy Studying!", "success");
    await checkAccessStatus();
    window.history.replaceState({}, document.title, window.location.pathname);
}
```

### 2. **api/index.py** - Flask Backend

**Changes:**
- Added `get-access.html` to `STATIC_FILES` set
- Ensures Flask serves the new access page
- No API endpoint changes needed (existing endpoints reused)

---

## 🚀 Deployment Steps (Vercel)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add separate access key generation page for Vercel"
git push origin main
```

### Step 2: Deploy to Vercel (if using GitHub integration)
- Vercel automatically deploys on push
- Monitor deployment at https://vercel.com/dashboard

### Step 3: Environment Variables
Ensure these are set in Vercel dashboard:
```
DATABASE_URL=your_postgresql_url  (if using PostgreSQL)
POSTGRES_URL=your_postgresql_url  (alternative)
```

### Step 4: Post-Deployment Testing
1. Visit your Vercel URL
2. Sign up / Login
3. Click "Claim Free Access"
4. Should redirect to `/get-access.html`
5. Complete the task interface
6. Should redirect back to home with success message

---

## 🧪 Test Results

### Test Suite: `test_system.py`
Run locally to verify all systems:

```bash
python test_system.py
```

**Results:**
```
✓ TEST 1 PASSED: Database is ready
✓ TEST 2 PASSED: Signup works correctly
✓ TEST 3 PASSED: Login works correctly
✓ TEST 4 PASSED: Key generation works
✓ TEST 5 PASSED: Key activation works
✓ TEST 6 PASSED: Status check works
✓ TEST 7 PASSED: Questions endpoint works
```

---

## 🔐 Security Considerations

1. **Keys are Single-Use**: Once activated, a key cannot be reused
2. **Automatic Expiry**: Keys expire in 24 hours from activation
3. **Password Hashing**: Using SHA256 hashing (consider upgrading to bcrypt)
4. **CORS Protection**: Enabled for API endpoints
5. **Session Storage**: Uses browser's sessionStorage for temporary key storage during activation

---

## 📊 Database Structure

### access_keys Table
```sql
CREATE TABLE access_keys (
    key TEXT PRIMARY KEY,
    is_used INTEGER DEFAULT 0,
    used_by TEXT,
    used_at TIMESTAMP,
    duration_hours INTEGER DEFAULT 24
)
```

### users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    access_until TIMESTAMP
)
```

---

## 🐛 Troubleshooting

### Issue: "Access page not loading on Vercel"
**Solution:** 
1. Check that `get-access.html` is in project root
2. Verify `STATIC_FILES` in `api/index.py` includes `get-access.html`
3. Redeploy to Vercel

### Issue: "Backend not generating keys"
**Solution:**
1. Check `DATABASE_URL` environment variable on Vercel
2. Verify database connection works with `test_system.py`
3. Check Vercel logs for errors

### Issue: "After completing task, page doesn't redirect"
**Solution:**
1. Check browser console for errors
2. Verify backend is accessible (CORS might be blocking)
3. Check `BASE_API_URL` configuration in `get-access.html`

---

## 🔄 Local Development

To test the new flow locally:

1. **Using Production Behavior:**
   - Modify `setupAccessClaimListener()` to always redirect
   - Or access directly: `http://localhost:5000/get-access.html?userId=YOUR_USER_ID`

2. **Using Development Behavior:**
   - Default behavior opens new tab (existing flow)
   - Complete task and return with key in URL parameters

3. **Start Local Server:**
```bash
python run_backend.bat  # Windows
# or
python -m flask run --host 0.0.0.0 --port 5000
```

---

## 📝 API Endpoints Reference

### User Management
- `POST /api/register` - Create new user
- `POST /api/login` - Authenticate user

### Access System
- `GET /api/access/status` - Check if user has active access
- `POST /api/access/generate-and-link` - Generate new access key
- `POST /api/access/activate` - Activate an access key
- `GET /api/access/claim` - Claim free access (legacy)

### Content
- `GET /api/questions` - Fetch all questions
- `GET /api/user/saved` - Get user's saved questions
- `POST /api/user/saved` - Sync saved questions

---

## 🎯 Next Steps

1. **Deploy to Vercel** - Push changes and monitor deployment
2. **Test Access Flow** - Verify users can generate and claim keys
3. **Monitor Logs** - Check for any errors on Vercel dashboard
4. **User Feedback** - Get feedback from test users
5. **Optimize** - Adjust timer duration, UI, or flow based on feedback

---

## 📞 Support

For deployment issues:
1. Check Vercel logs: `vercel logs`
2. Run local tests: `python test_system.py`
3. Check GitHub Actions for CI/CD issues
4. Review browser console for frontend errors

---

**Last Updated:** June 1, 2026  
**Status:** ✅ Ready for Vercel Deployment
