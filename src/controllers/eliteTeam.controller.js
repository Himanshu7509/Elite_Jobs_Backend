import User from '../models/auth.model.js';
import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';

// Create a job directly (EliteTeam only)
const createJobDirect = async (req, res) => {
  try {
    const {
      title,
      description,
      company, // EliteTeam provides full company details
      location,
      jobType,
      interviewType,
      workType,
      minEducation,
      salary,
      requirements,
      responsibilities,
      skills,
      experienceLevel,
      noticePeriod,
      applicationDeadline,
      category,
      // New fields
      numberOfOpenings,
      yearOfPassing,
      shift,
      walkInDate,
      walkInTime
    } = req.body;

    // Validate required fields
    if (!title || !description || !company || !location || !interviewType || !workType || !experienceLevel || !noticePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, company, location, interviewType, workType, experienceLevel, noticePeriod'
      });
    }

    // Additional validation for location array
    if (location && Array.isArray(location) && location.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one location is required'
      });
    }

    // Additional validation for walk-in interviews
    if (interviewType === 'Walk-in' && (!walkInDate || !walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Walk-in date and time are required for walk-in interviews'
      });
    }

    // Validate company object
    if (!company.name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Create new job with provided company details
    const job = new Job({
      title,
      description,
      company: {
        name: company.name,
        description: company.description || '',
        website: company.website || '',
        logo: company.logo || ''
      },
      location,
      jobType,
      interviewType,
      workType,
      minEducation,
      salary,
      requirements,
      responsibilities,
      skills,
      experienceLevel,
      noticePeriod,
      applicationDeadline,
      category,
      postedBy: req.user.userId, // EliteTeam user ID
      // New fields
      numberOfOpenings,
      yearOfPassing,
      shift,
      walkInDate: interviewType === 'Walk-in' ? walkInDate : undefined,
      walkInTime: interviewType === 'Walk-in' ? walkInTime : undefined
    });

    await job.save();

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create eliteTeam user (Admin only)
const createEliteTeamUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password'
      });
    }

    // Check if user already exists with the same email and role
    const existingUser = await User.findOne({ email, role: 'eliteTeam' });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'eliteTeam user with this email already exists'
      });
    }

    // Create new eliteTeam user
    const userData = {
      name,
      email,
      password,
      role: 'eliteTeam'
    };

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'eliteTeam user created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create eliteTeam user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all eliteTeam users (Admin only)
const getAllEliteTeamUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'eliteTeam' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get eliteTeam users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get eliteTeam user by ID (Admin only)
const getEliteTeamUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password');

    if (!user || user.role !== 'eliteTeam') {
      return res.status(404).json({
        success: false,
        message: 'eliteTeam user not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get eliteTeam user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update eliteTeam user (Admin only)
const updateEliteTeamUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    // Prepare update object
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    // Update user
    const user = await User.findOneAndUpdate(
      { _id: id, role: 'eliteTeam' },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'eliteTeam user not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'eliteTeam user updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update eliteTeam user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete eliteTeam user (Admin only)
const deleteEliteTeamUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user before deletion to access their files
    const user = await User.findById(id);
    if (!user || user.role !== 'eliteTeam') {
      return res.status(404).json({
        success: false,
        message: 'eliteTeam user not found'
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
      // Continue with account deletion even if file deletion fails
    }
    
    // Delete user's jobs and applications to those jobs
    // Find all jobs posted by this user
    const jobs = await Job.find({ postedBy: id });
    
    // Get job IDs
    const jobIds = jobs.map(job => job._id);
    
    // Delete all applications for these jobs
    if (jobIds.length > 0) {
      await Application.deleteMany({ jobId: { $in: jobIds } });
    }
    
    // Delete all jobs posted by this user
    await Job.deleteMany({ postedBy: id });
    
    // Delete the user account
    await User.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'eliteTeam user and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete eliteTeam user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export {
  createJobDirect,
  createEliteTeamUser,
  getAllEliteTeamUsers,
  getEliteTeamUserById,
  updateEliteTeamUser,
  deleteEliteTeamUser
};