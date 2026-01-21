# Forgot Password Feature - Configuration Guide

This project now includes a complete "Forgot Password" functionality. To enable it fully, you need to configure Supabase email settings.

## What's Been Added

1. **Forgot Password Page** (`/forgot-password`)
   - Allows users to request a password reset email
   - Validates email format
   - Shows success/error messages

2. **Reset Password Page** (`/reset-password`)
   - Allows users to set a new password
   - Validates password match and length
   - Auto-redirects to login after success

3. **Updated Login Page**
   - Added "Forgot your password?" link

## Supabase Configuration Required

To make the forgot password feature work, you need to configure the email settings in your Supabase project:

### Step 1: Configure Redirect URLs

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** > **URL Configuration**
4. Add your site URLs to the redirect URLs:
   - `https://medersub.vercel.app/reset-password`
   - `https://www.medersub.com.ng/reset-password`
   - `http://localhost:3000/reset-password` (for development)

### Step 2: Configure Email Templates (Optional but Recommended)

1. Go to **Authentication** > **Email Templates**
2. Select **Reset Password** template
3. Customize the email subject and body if desired
4. The default template should work fine, but you can brand it with your company name

### Step 3: Test the Flow

1. Go to your deployed site: https://medersub.vercel.app or https://www.medersub.com.ng
2. Navigate to the login page
3. Click "Forgot your password?"
4. Enter your email address
5. Check your email for the reset link
6. Click the link to be redirected to the reset password page
7. Enter and confirm your new password
8. You should be redirected to the login page

## Email Configuration

Make sure your Supabase project has email sending configured:

1. **Development**: Supabase provides a default email service for testing
2. **Production**: Consider configuring a custom SMTP provider for better deliverability:
   - Go to **Project Settings** > **Auth** > **SMTP Settings**
   - Configure your SMTP provider (e.g., SendGrid, AWS SES, Mailgun)

## Security Notes

- Password reset tokens expire after a set time (default is 1 hour in Supabase)
- Users can only reset their password if they have access to their email
- The reset link can only be used once
- Minimum password length is 6 characters

## Troubleshooting

### Email not received
- Check spam/junk folder
- Verify email configuration in Supabase dashboard
- Check Supabase logs for email delivery status

### Invalid/Expired reset link
- Reset links expire after 1 hour
- Links can only be used once
- Request a new reset email

### Redirect not working
- Verify redirect URLs are properly configured in Supabase
- Check that the URLs match exactly (including https://)
- Clear browser cache and try again

## Development Testing

For local development:

```bash
npm run dev
```

Then visit: http://localhost:3000/forgot-password

Note: Make sure your `.env.local` file has the correct configuration:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set `NEXT_PUBLIC_SITE_URL` to your production URL:
- `https://www.medersub.com.ng` or
- `https://medersub.vercel.app`
