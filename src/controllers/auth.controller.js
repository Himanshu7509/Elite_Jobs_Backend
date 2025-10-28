import User from '../models/auth.model.js';
import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';
import jwt from 'jsonwebtoken';

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
    if (!['jobSeeker', 'jobHoster'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either jobSeeker or jobHoster'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
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
        phone: profile?.phone || '', // New field
        githubUrl: profile?.githubUrl || '', // New field
        linkedinUrl: profile?.linkedinUrl || '', // New field
        skills: profile?.skills || [], // New field
        education: profile?.education || [],
        experience: profile?.experience || [],
        photo: profile?.photo || '',
        resume: profile?.resume || '',
        gender: profile?.gender || '', // New field
        noticePeriod: profile?.noticePeriod || '' // New field
      };
    } else if (role === 'jobHoster') {
      userData.profile = {
        companyName: profile?.companyName || '',
        companyDescription: profile?.companyDescription || '',
        companyWebsite: profile?.companyWebsite || '',
        companyEmail: profile?.companyEmail || '', // New field
        numberOfEmployees: profile?.numberOfEmployees || null, // New field
        companyPhone: profile?.companyPhone || '', // New field
        companyLogo: profile?.companyLogo || '',
        photo: profile?.photo || '',
        phone: profile?.phone || '', // New field
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
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
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
      } else if (user.role === 'jobHoster') {
        // Update jobHoster profile fields
        updateData['profile.companyName'] = profile.companyName !== undefined ? profile.companyName : existingProfile.companyName;
        updateData['profile.companyDescription'] = profile.companyDescription !== undefined ? profile.companyDescription : existingProfile.companyDescription;
        updateData['profile.companyWebsite'] = profile.companyWebsite !== undefined ? profile.companyWebsite : existingProfile.companyWebsite;
        updateData['profile.companyEmail'] = profile.companyEmail !== undefined ? profile.companyEmail : existingProfile.companyEmail; // New field
        updateData['profile.numberOfEmployees'] = profile.numberOfEmployees !== undefined ? profile.numberOfEmployees : existingProfile.numberOfEmployees; // New field
        updateData['profile.companyPhone'] = profile.companyPhone !== undefined ? profile.companyPhone : existingProfile.companyPhone; // New field
        updateData['profile.phone'] = profile.phone !== undefined ? profile.phone : existingProfile.phone; // New field
        updateData['profile.panCardNumber'] = profile.panCardNumber !== undefined ? profile.panCardNumber : existingProfile.panCardNumber;
        updateData['profile.gstNumber'] = profile.gstNumber !== undefined ? profile.gstNumber : existingProfile.gstNumber;
        
        // Handle file URLs
        if (profile.companyLogo !== undefined) {
          updateData['profile.companyLogo'] = profile.companyLogo;
        } else if (existingProfile.companyLogo) {
          updateData['profile.companyLogo'] = existingProfile.companyLogo;
        }
        
        if (profile.photo !== undefined) {
          updateData['profile.photo'] = profile.photo;
        } else if (existingProfile.photo) {
          updateData['profile.photo'] = existingProfile.photo;
        }
      }
    }
    
    // Update user
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
      
      // Delete company logo if exists (job hosters)
      if (user.profile && user.profile.companyLogo) {
        await deleteFromS3(user.profile.companyLogo);
      }
    } catch (fileError) {
      console.error('Error deleting user files from S3:', fileError);
      // Continue with profile deletion even if file deletion fails
    }
    
    // Delete user's applications (for job seekers)
    if (user.role === 'jobSeeker') {
      await Application.deleteMany({ applicantId: userId });
    }
    
    // Delete user's jobs and applications to those jobs (for job hosters)
    if (user.role === 'jobHoster') {
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
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export { signup, login, getProfile, updateProfile, deleteProfile };