# Firestore Security Rules Setup

## Quick Fix - Deploy via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **studio-581671387-11b89**
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the content from `firestore.rules`
6. Click **Publish**

## Or Use Firebase CLI

If you have Firebase CLI installed:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (choose Firestore only)
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
```

## What These Rules Do

### Users Collection (`/users/{userId}`)
- ✅ Users can read/write their own profile
- ✅ Admins can read all profiles
- ✅ Auto-creation during signup

### Menu Items (`/menu_items/{itemId}`)
- ✅ All authenticated users can read
- ✅ Only admins can create/update/delete

### Tables (`/tables/{tableId}`)
- ✅ All authenticated users can read
- ✅ All authenticated users can update (for POS)
- ✅ Only admins can create/delete

### Orders (`/orders/{orderId}`)
- ✅ All authenticated users can read/create/update
- ✅ Only admins can delete

## Important: First User Setup

Since the rules check for admin role, you need to create your first admin user manually:

1. **Sign up** with email: `admin@gmail.com`
2. Go to **Firebase Console** → **Firestore Database**
3. Find the user document with your UID
4. Manually add/edit the `role` field to `"Admin"`

After that, the rules will work correctly for role-based access.

## Troubleshooting

If you still get permission errors:
1. Make sure you're logged in
2. Check that your user document exists in Firestore
3. Verify the `role` field is set correctly
4. Clear browser cache and reload
