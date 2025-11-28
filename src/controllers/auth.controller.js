import User, { 
  GENDER_OPTIONS, 
  NOTICE_PERIOD_OPTIONS, 
  EXPERIENCE_OPTIONS, 
  CATEGORY_OPTIONS, 
  EDUCATION_OPTIONS 
} from '../models/auth.model.js';
import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import resend from '../config/email.js';

console.log('=== LOADING AUTH CONTROLLER ===');

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Get or create admin user
const getOrCreateAdmin = async () => {
  // Check if admin user exists
  let adminUser = await User.findOne({ role: 'admin' });
  
  // If no admin user exists, create one with static credentials from env
  if (!adminUser) {
    adminUser = new User({
      name: 'ADMIN',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin'
    });
    await adminUser.save();
    console.log('Admin user created with email:', process.env.ADMIN_EMAIL);
  } else {
    // If admin user exists, update email from env variables
    // This ensures that if env variables change, the admin credentials are updated
    if (adminUser.email !== process.env.ADMIN_EMAIL) {
      adminUser.email = process.env.ADMIN_EMAIL;
      await adminUser.save();
      console.log('Admin user email updated');
    }
    
    // Update the password to match env variables
    adminUser.password = process.env.ADMIN_PASSWORD;
  }
  
  return adminUser;
};

// Get enum options for job seeker profile
const getProfileEnumOptions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        gender: GENDER_OPTIONS,
        noticePeriod: NOTICE_PERIOD_OPTIONS,
        experience: EXPERIENCE_OPTIONS,
        category: CATEGORY_OPTIONS,
        education: EDUCATION_OPTIONS
      }
    });
  } catch (error) {
    console.error('Get profile enum options error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Forgot password - send OTP
const forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;

    // Validate required fields
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and role'
      });
    }

    // Validate role - only allow jobSeeker, jobHoster, and recruiter
    if (!['jobSeeker', 'jobHoster', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, or recruiter'
      });
    }

    // Find user by email and role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email and role'
      });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration time (15 minutes from now)
    const otpExpires = Date.now() + 15 * 60 * 1000;

    // Save OTP and expiration to user document
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save();

    // Send OTP via email using Resend with enhanced template
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@mail.eliteassociate.in',
        to: email,
        subject: 'Password Reset OTP - Elite Jobs',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 20px 0;">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px; text-align: center;">Elite Jobs</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; text-align: center; font-size: 16px;">Job Portal Platform</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Hello ${user.name},</h2>
                        
                        <div style="color: #555; line-height: 1.6; font-size: 16px;">
                          <p style="margin: 0 0 15px 0;">You have requested to reset your password for your Elite Jobs account.</p>
                          <p style="margin: 0 0 15px 0;">Please use the following One-Time Password (OTP) to proceed with resetting your password:</p>
                          
                          <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; padding: 15px 25px; background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px;">
                              <h3 style="color: #667eea; margin: 0; font-size: 24px; letter-spacing: 3px;">${otp}</h3>
                            </div>
                          </div>
                          
                          <p style="margin: 0 0 15px 0;">This OTP will expire in <strong>15 minutes</strong>. If you did not request this password reset, please ignore this email or contact our support team.</p>
                          
                          <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                            <p style="margin: 0; color: #856404; font-weight: bold;">Security Notice:</p>
                            <p style="margin: 5px 0 0 0; color: #856404;">Never share this OTP with anyone. Elite Jobs support will never ask for your OTP.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                        <div style="text-align: center; color: #666; font-size: 14px;">
                          <p style="margin: 0 0 10px 0;">
                            <strong>Need Help?</strong> Contact our support team at info@eliteindiajobs.com
                          </p>
                          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                          <p style="margin: 0;">
                            © ${new Date().getFullYear()} Elite Jobs. All rights reserved.
                          </p>
                          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                            This email was sent to ${email} regarding your Elite Jobs account.
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email address'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, role, otp } = req.body;

    // Validate required fields
    if (!email || !role || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, role, and OTP'
      });
    }

    // Validate role - only allow jobSeeker, jobHoster, and recruiter
    if (!['jobSeeker', 'jobHoster', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, or recruiter'
      });
    }

    // Find user by email and role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email and role'
      });
    }

    // Check if OTP is valid and not expired
    if (user.resetPasswordToken !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, role, otp, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!email || !role || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: email, role, OTP, new password, and confirm password'
      });
    }

    // Validate role - only allow jobSeeker, jobHoster, and recruiter
    if (!['jobSeeker', 'jobHoster', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, or recruiter'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    // Check password strength (at least 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by email and role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email and role'
      });
    }

    // Check if OTP is valid and not expired
    if (user.resetPasswordToken !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email, role } = req.body;

    // Validate required fields
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and role'
      });
    }

    // Validate role - only allow jobSeeker, jobHoster, and recruiter
    if (!['jobSeeker', 'jobHoster', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, or recruiter'
      });
    }

    // Find user by email and role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email and role'
      });
    }

    // Check if user has a recent OTP that hasn't expired yet (within last 5 minutes)
    if (user.resetPasswordToken && user.resetPasswordExpires) {
      const timeSinceLastOTP = Date.now() - (user.resetPasswordExpires - 15 * 60 * 1000);
      // If less than 5 minutes since last OTP, don't allow resend
      if (timeSinceLastOTP < 5 * 60 * 1000) {
        const minutesLeft = Math.ceil((5 * 60 * 1000 - timeSinceLastOTP) / (60 * 1000));
        return res.status(400).json({
          success: false,
          message: `Please wait ${minutesLeft} minute(s) before requesting a new OTP`
        });
      }
    }

    // Generate a new random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration time (15 minutes from now)
    const otpExpires = Date.now() + 15 * 60 * 1000;

    // Save OTP and expiration to user document
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save();

    // Send OTP via email using Resend with enhanced template
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@mail.eliteassociate.in',
        to: email,
        subject: 'Password Reset OTP - Elite Jobs (Resent)',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 20px 0;">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 24px; text-align: center;">Elite Jobs</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; text-align: center; font-size: 16px;">Job Portal Platform</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Hello ${user.name},</h2>
                        
                        <div style="color: #555; line-height: 1.6; font-size: 16px;">
                          <p style="margin: 0 0 15px 0;">You have requested to resend the OTP for resetting your password for your Elite Jobs account.</p>
                          <p style="margin: 0 0 15px 0;">Please use the following One-Time Password (OTP) to proceed with resetting your password:</p>
                          
                          <div style="text-align: center; margin: 30px 0;">
                            <div style="display: inline-block; padding: 15px 25px; background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px;">
                              <h3 style="color: #667eea; margin: 0; font-size: 24px; letter-spacing: 3px;">${otp}</h3>
                            </div>
                          </div>
                          
                          <p style="margin: 0 0 15px 0;">This OTP will expire in <strong>15 minutes</strong>. If you did not request this password reset, please ignore this email or contact our support team.</p>
                          
                          <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                            <p style="margin: 0; color: #856404; font-weight: bold;">Security Notice:</p>
                            <p style="margin: 5px 0 0 0; color: #856404;">Never share this OTP with anyone. Elite Jobs support will never ask for your OTP.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                        <div style="text-align: center; color: #666; font-size: 14px;">
                          <p style="margin: 0 0 10px 0;">
                            <strong>Need Help?</strong> Contact our support team at info@eliteindiajobs.com
                          </p>
                          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                          <p style="margin: 0;">
                            © ${new Date().getFullYear()} Elite Jobs. All rights reserved.
                          </p>
                          <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                            This email was sent to ${email} regarding your Elite Jobs account.
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });

      res.status(200).json({
        success: true,
        message: 'OTP resent to your email address'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Google signup - complete signup for new Google users
const googleSignup = async (req, res) => {
  console.log('=== GOOGLE SIGNUP ENDPOINT HIT ===');
  console.log('Request received at:', new Date().toISOString());
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('Full request body:', JSON.stringify(req.body, null, 2));
  
  try {
    console.log('Starting google signup process...');
    const { googleId, email, name, role, profile } = req.body;
    console.log('Google signup request body:', req.body);
    console.log('Extracted data:', { googleId, email, name, role, profile });
    
    // Validate required fields
    console.log('Validating required fields...');
    if (!googleId || !email || !name || !role) {
      console.log('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: googleId, email, name, and role are required'
      });
    }
    
    // Validate role
    console.log('Validating role...');
    const validRoles = ['jobSeeker', 'jobHoster', 'recruiter'];
    if (!validRoles.includes(role)) {
      console.log('Invalid role:', role);
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either jobSeeker, jobHoster, or recruiter'
      });
    }
    
    // Check if user already exists with this Google ID
    console.log('Checking for existing user with Google ID:', googleId);
    const existingUserByGoogleId = await User.findOne({ 'google.id': googleId });
    if (existingUserByGoogleId) {
      console.log('User already exists with this Google ID');
      return res.status(400).json({
        success: false,
        message: 'User already exists with this Google account'
      });
    }
    
    // Check if user already exists with this email and role combination
    console.log('Checking for existing user with email and role:', email, role);
    const existingUserByEmailAndRole = await User.findOne({ email, role });
    if (existingUserByEmailAndRole) {
      console.log('User already exists with this email and role');
      return res.status(400).json({
        success: false,
        message: `A ${role} account with this email already exists`
      });
    }
    
    // Additional check for jobSeeker role - email should be unique
    if (role === 'jobSeeker') {
      console.log('Performing additional jobSeeker email check...');
      const existingJobSeeker = await User.findOne({ email, role: 'jobSeeker' });
      if (existingJobSeeker) {
        console.log('JobSeeker already exists with this email');
        return res.status(400).json({
          success: false,
          message: 'A job seeker account with this email already exists'
        });
      }
    }
    
    // Create user data object
    console.log('Creating user data object...');
    const userData = {
      name,
      email,
      role,
      isVerified: true, // Google users are automatically verified
      google: {
        id: googleId,
        token: '' // We don't store the token for security reasons
      }
    };
    
    // Set up profile data based on role
    console.log('Setting up profile data for role:', role);
    if (role === 'jobSeeker') {
      userData.profile = {
        age: profile?.age || null,
        address: profile?.address || '',
        phone: profile?.phone || '',
        githubUrl: profile?.githubUrl || '',
        linkedinUrl: profile?.linkedinUrl || '',
        skills: profile?.skills || [],
        education: profile?.education || [],
        experience: profile?.experience || [],
        photo: profile?.photo || '',
        resume: profile?.resume || '',
        gender: profile?.gender || '',
        noticePeriod: profile?.noticePeriod || '',
        preferredLocation: profile?.preferredLocation || '',
        designation: profile?.designation || '',
        expInWork: profile?.expInWork || '',
        salaryExpectation: profile?.salaryExpectation || '',
        preferredCategory: profile?.preferredCategory || '',
        highestEducation: profile?.highestEducation || ''
      };
    } else if (role === 'jobHoster') {
      userData.profile = {
        companyName: profile?.companyName || '',
        companyDescription: profile?.companyDescription || '',
        companyWebsite: profile?.companyWebsite || '',
        companyEmail: profile?.companyEmail || '',
        numberOfEmployees: profile?.numberOfEmployees || null,
        companyPhone: profile?.companyPhone || '',
        companyLogo: profile?.companyLogo || '',
        companyDocument: profile?.companyDocument || [],
        photo: profile?.photo || '',
        phone: profile?.phone || '',
        panCardNumber: profile?.panCardNumber || '',
        gstNumber: profile?.gstNumber || ''
      };
    } else if (role === 'recruiter') {
      userData.profile = {
        companyName: profile?.companyName || '',
        companyAddress: profile?.companyAddress || '',
        companyPhone: profile?.companyPhone || '',
        companyWebsite: profile?.companyWebsite || '',
        companyLogo: profile?.companyLogo || '',
        companyDescription: profile?.companyDescription || '',
        contactPerson: profile?.contactPerson || '',
        designation: profile?.designation || '',
        companyDocuments: profile?.companyDocuments || [],
        companySize: profile?.companySize || '',
        industry: profile?.industry || '',
        establishedYear: profile?.establishedYear || null,
        companyType: profile?.companyType || '',
        linkedinUrl: profile?.linkedinUrl || ''
      };
    }
    
    // Create the user without a password for Google users
    console.log('Creating user with data:', JSON.stringify(userData, null, 2));
    const user = new User(userData);
    await user.save();
    
    console.log('User created successfully:', user._id);
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('Token generated for user');
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Google signup successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('=== GOOGLE SIGNUP ERROR ===');
    console.error('Google signup error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // Send error response
    res.status(500).json({
      success: false,
      message: 'Internal server error during Google signup',
      error: 'An internal server error occurred'
    });
  }
};

// Google login - login with Google account
const googleLogin = async (req, res) => {
  try {
    const { googleId, role } = req.body;
    console.log('Google login request body:', req.body);

    // Validate required fields
    if (!googleId || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide googleId and role'
      });
    }

    // Validate role - only allow jobSeeker, jobHoster, and recruiter
    if (!['jobSeeker', 'jobHoster', 'recruiter'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, or recruiter'
      });
    }

    // Find user by Google ID and role
    const user = await User.findOne({ 'google.id': googleId, role });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Google account not found. Please sign up first.'
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully with Google',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // More detailed error response
    res.status(500).json({
      success: false,
      message: 'Internal server error during Google login',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'An internal server error occurred'
    });
  }
};

// Signup controller
const signup = async (req, res) => {
  try {
    const { name, email, password, role, profile } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, role'
      });
    }

    // Validate role
    if (!['jobSeeker', 'jobHoster', 'recruiter', 'admin', 'eliteTeam'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, recruiter, admin, or eliteTeam'
      });
    }

    // Check if user already exists with the same email and role
    const existingUser = await User.findOne({ email, role });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email and role already exists'
      });
    }

    // Additional check for jobSeeker - ensure email is unique across all users
    if (role === 'jobSeeker') {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered with another account'
        });
      }
    }
    
    // Prevent eliteTeam users from signing up directly
    if (role === 'eliteTeam') {
      return res.status(400).json({
        success: false,
        message: 'eliteTeam accounts can only be created by admin'
      });
    }

    // Create new user with appropriate profile structure
    const userData = {
      name,
      email,
      password,
      role
    };

    // Add profile based on role
    if (role === 'jobSeeker') {
      userData.profile = {
        age: profile?.age || null,
        address: profile?.address || '',
        phone: profile?.phone || '',
        githubUrl: profile?.githubUrl || '',
        linkedinUrl: profile?.linkedinUrl || '',
        skills: profile?.skills || [],
        education: profile?.education || [],
        experience: profile?.experience || [],
        photo: profile?.photo || '',
        resume: profile?.resume || '',
        gender: profile?.gender || '',
        noticePeriod: profile?.noticePeriod || '',
        preferredLocation: profile?.preferredLocation || '',
        designation: profile?.designation || '',
        expInWork: profile?.expInWork || '',
        salaryExpectation: profile?.salaryExpectation || '',
        preferredCategory: profile?.preferredCategory || '',
        highestEducation: profile?.highestEducation || ''
      };
    } else if (role === 'jobHoster' || role === 'recruiter') {
      userData.profile = {
        companyName: profile?.companyName || '',
        companyDescription: profile?.companyDescription || '',
        companyWebsite: profile?.companyWebsite || '',
        companyEmail: profile?.companyEmail || '',
        numberOfEmployees: profile?.numberOfEmployees || null,
        companyPhone: profile?.companyPhone || '',
        companyLogo: profile?.companyLogo || '',
        photo: profile?.photo || '',
        phone: profile?.phone || '',
        panCardNumber: profile?.panCardNumber || '',
        gstNumber: profile?.gstNumber || ''
      };
    }

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Login controller
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and role'
      });
    }

    // Validate role
    if (!['jobSeeker', 'jobHoster', 'recruiter', 'admin', 'eliteTeam'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker, jobHoster, recruiter, admin, or eliteTeam'
      });
    }

    let user;
    
    // Special handling for admin role
    if (role === 'admin') {
      // Get or create admin user
      user = await getOrCreateAdmin();
      
      // For admin, we directly compare with env variables (not hashed)
      if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
          success: false,
          message: 'Invalid admin credentials'
        });
      }
    } else if (role === 'eliteTeam') {
      // For eliteTeam, find user by email and role
      user = await User.findOne({ email, role });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // For eliteTeam, we directly compare password (not hashed)
      if (password !== user.password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    } else {
      // Find user by email and role for non-admin roles
      user = await User.findOne({ email, role });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    console.log('Retrieved user profile:', user);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile with partial updates
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, profile } = req.body;
    
    // Prepare update object
    const updateData = {};
    if (name) updateData.name = name;
    
    // Handle partial profile updates
    if (profile) {
      // First, get the current user to merge profiles
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Merge the existing profile with the new profile data based on role
      const existingProfile = user.profile || {};
      
      if (user.role === 'jobSeeker') {
        // Update jobSeeker profile fields
        updateData['profile.age'] = profile.age !== undefined ? profile.age : existingProfile.age;
        updateData['profile.address'] = profile.address !== undefined ? profile.address : existingProfile.address;
        updateData['profile.phone'] = profile.phone !== undefined ? profile.phone : existingProfile.phone; // New field
        updateData['profile.githubUrl'] = profile.githubUrl !== undefined ? profile.githubUrl : existingProfile.githubUrl; // New field
        updateData['profile.linkedinUrl'] = profile.linkedinUrl !== undefined ? profile.linkedinUrl : existingProfile.linkedinUrl; // New field
        updateData['profile.skills'] = profile.skills !== undefined ? profile.skills : existingProfile.skills; // New field
        updateData['profile.gender'] = profile.gender !== undefined ? profile.gender : existingProfile.gender; // New field
        updateData['profile.noticePeriod'] = profile.noticePeriod !== undefined ? profile.noticePeriod : existingProfile.noticePeriod; // New field
        updateData['profile.preferredLocation'] = profile.preferredLocation !== undefined ? profile.preferredLocation : existingProfile.preferredLocation; // New field
        updateData['profile.designation'] = profile.designation !== undefined ? profile.designation : existingProfile.designation; // New field
        updateData['profile.expInWork'] = profile.expInWork !== undefined ? profile.expInWork : existingProfile.expInWork; // New field
        updateData['profile.salaryExpectation'] = profile.salaryExpectation !== undefined ? profile.salaryExpectation : existingProfile.salaryExpectation; // New field
        updateData['profile.preferredCategory'] = profile.preferredCategory !== undefined ? profile.preferredCategory : existingProfile.preferredCategory; // New field
        updateData['profile.highestEducation'] = profile.highestEducation !== undefined ? profile.highestEducation : existingProfile.highestEducation; // New field
        
        // Handle arrays
        if (profile.education !== undefined) {
          updateData['profile.education'] = profile.education;
        } else if (existingProfile.education) {
          updateData['profile.education'] = existingProfile.education;
        }
        
        if (profile.experience !== undefined) {
          updateData['profile.experience'] = profile.experience;
        } else if (existingProfile.experience) {
          updateData['profile.experience'] = existingProfile.experience;
        }
        
        // Handle file URLs
        if (profile.photo !== undefined) {
          updateData['profile.photo'] = profile.photo;
        } else if (existingProfile.photo) {
          updateData['profile.photo'] = existingProfile.photo;
        }
        
        if (profile.resume !== undefined) {
          updateData['profile.resume'] = profile.resume;
        } else if (existingProfile.resume) {
          updateData['profile.resume'] = existingProfile.resume;
        }
      } else if (user.role === 'jobHoster' || user.role === 'recruiter') {
        // Update jobHoster/recruiter profile fields
        updateData['profile.companyName'] = profile.companyName !== undefined ? profile.companyName : existingProfile.companyName;
        updateData['profile.companyDescription'] = profile.companyDescription !== undefined ? profile.companyDescription : existingProfile.companyDescription;
        updateData['profile.companyWebsite'] = profile.companyWebsite !== undefined ? profile.companyWebsite : existingProfile.companyWebsite;
        updateData['profile.companyEmail'] = profile.companyEmail !== undefined ? profile.companyEmail : existingProfile.companyEmail;
        updateData['profile.numberOfEmployees'] = profile.numberOfEmployees !== undefined ? profile.numberOfEmployees : existingProfile.numberOfEmployees;
        updateData['profile.companyPhone'] = profile.companyPhone !== undefined ? profile.companyPhone : existingProfile.companyPhone;
        updateData['profile.companyLogo'] = profile.companyLogo !== undefined ? profile.companyLogo : existingProfile.companyLogo;
        updateData['profile.photo'] = profile.photo !== undefined ? profile.photo : existingProfile.photo;
        updateData['profile.phone'] = profile.phone !== undefined ? profile.phone : existingProfile.phone;
        updateData['profile.panCardNumber'] = profile.panCardNumber !== undefined ? profile.panCardNumber : existingProfile.panCardNumber;
        updateData['profile.gstNumber'] = profile.gstNumber !== undefined ? profile.gstNumber : existingProfile.gstNumber;
        
        // Handle company documents array
        if (profile.companyDocument !== undefined) {
          updateData['profile.companyDocument'] = profile.companyDocument;
        } else if (existingProfile.companyDocument) {
          updateData['profile.companyDocument'] = existingProfile.companyDocument;
        }
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete user profile
const deleteProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user before deletion to access their files
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete user's files from S3
    try {
      // Delete profile photo if exists
      if (user.profile && user.profile.photo) {
        await deleteFromS3(user.profile.photo);
      }
      
      // Delete resume if exists (job seekers)
      if (user.profile && user.profile.resume) {
        await deleteFromS3(user.profile.resume);
      }
      
      // Delete company logo if exists (job hosters and recruiters)
      if (user.profile && user.profile.companyLogo) {
        await deleteFromS3(user.profile.companyLogo);
      }
      
      // Delete company documents if exist (job hosters and recruiters)
      if (user.profile && user.profile.companyDocument && Array.isArray(user.profile.companyDocument)) {
        for (const docUrl of user.profile.companyDocument) {
          await deleteFromS3(docUrl);
        }
      }
    } catch (fileError) {
      console.error('Error deleting user files from S3:', fileError);
      // Continue with account deletion even if file deletion fails
    }
    
    // Delete user's applications (for job seekers)
    if (user.role === 'jobSeeker') {
      await Application.deleteMany({ applicantId: userId });
    }
    
    // Delete user's jobs and applications to those jobs (for job hosters and recruiters)
    if (user.role === 'jobHoster' || user.role === 'recruiter') {
      // Find all jobs posted by this hoster
      const jobs = await Job.find({ postedBy: userId });
      
      // Get job IDs
      const jobIds = jobs.map(job => job._id);
      
      // Delete all applications for these jobs
      if (jobIds.length > 0) {
        await Application.deleteMany({ jobId: { $in: jobIds } });
      }
      
      // Delete all jobs posted by this hoster
      await Job.deleteMany({ postedBy: userId });
    }
    
    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export {
  signup,
  login,
  getProfile,
  updateProfile,
  deleteProfile,
  getProfileEnumOptions,
  forgotPassword,
  verifyOTP,
  resetPassword,
  resendOTP,
  googleSignup,
  googleLogin
};