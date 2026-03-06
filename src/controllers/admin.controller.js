import User from '../models/auth.model.js';
import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';

// Create a job directly (Admin only)
const createJobDirect = async (req, res) => {
  try {
    const {
      title,
      description,
      company, // Admin provides full company details
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
      postedBy: req.user.userId, // Admin user ID
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

// Get all applicants with their profile details and job applications (Admin only)
const getAllApplicants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    
    // Build filter object
    let filter = {};
    
    // Add search filter if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add role filter if provided
    if (role && role !== 'all') {
      filter.role = role;
    }
    
    // Get total count for pagination
    const total = await User.countDocuments(filter);
    
    // Find all users with their applications
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get all applications with populated data
    const applications = await Application.find({})
      .populate('applicantId', 'name email role profile')
      .populate('jobId')
      .sort({ appliedAt: -1 });

    // Get all jobs posted by job hosters, recruiters, eliteTeam, and admin users
    const jobs = await Job.find({})
      .populate('postedBy', 'name email role profile')
      .sort({ createdAt: -1 });

    // Group applications by user
    const applicantsMap = {};
    
    // Initialize all users in the map
    users.forEach(user => {
      applicantsMap[user._id.toString()] = {
        user: user,
        applications: [],
        postedJobs: [] // Add postedJobs array
      };
    });

    // Add applications to respective users
    applications.forEach(application => {
      const userId = application.applicantId._id.toString();
      if (applicantsMap[userId]) {
        applicantsMap[userId].applications.push(application);
      }
    });

    // Add posted jobs to respective users
    jobs.forEach(job => {
      const userId = job.postedBy._id.toString();
      if (applicantsMap[userId]) {
        applicantsMap[userId].postedJobs.push(job);
      }
    });

    // Convert map to array
    const applicants = Object.values(applicantsMap);

    res.status(200).json({
      success: true,
      data: {
        applicants,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalApplicants: total
      }
    });
  } catch (error) {
    console.error('Get all applicants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete any user account and all associated data (Admin only)
const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    
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
      
      // Delete company logo if exists (job hosters/recruiters)
      if (user.profile && user.profile.companyLogo) {
        await deleteFromS3(user.profile.companyLogo);
      }
    } catch (fileError) {
      console.error('Error deleting user files from S3:', fileError);
      // Continue with account deletion even if file deletion fails
    }
    
    // Delete user's applications (for job seekers)
    if (user.role === 'jobSeeker') {
      await Application.deleteMany({ applicantId: userId });
    }
    
    // Delete user's jobs and applications to those jobs (for job hosters/recruiters/eliteTeam)
    if (user.role === 'jobHoster' || user.role === 'recruiter' || user.role === 'eliteTeam') {
      // Find all jobs posted by this user
      const jobs = await Job.find({ postedBy: userId });
      
      // Get job IDs
      const jobIds = jobs.map(job => job._id);
      
      // Delete all applications for these jobs
      if (jobIds.length > 0) {
        await Application.deleteMany({ jobId: { $in: jobIds } });
      }
      
      // Delete all jobs posted by this user
      await Job.deleteMany({ postedBy: userId });
    }
    
    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({
      success: true,
      message: 'User account and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete user account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all jobs (Admin can see all jobs)
const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, location, employmentType, experienceLevel, postedByAdmin, postedBy } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'company.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    
    if (employmentType) {
      filter.employmentType = employmentType;
    }
    
    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }
    
    // Filter by admin posted jobs if requested
    if (postedByAdmin === 'true') {
      filter.postedBy = req.user.userId;
    }
    
    // Filter by specific user ID if provided
    if (postedBy) {
      filter.postedBy = postedBy;
    }
    
    // Get jobs with pagination and populate all relevant details for admin
    const jobs = await Job.find(filter)
      .populate({
        path: 'postedBy',
        select: '-password', // Exclude password for security
        populate: {
          path: 'profile' // Populate the entire profile details
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    // Get total count for pagination
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        jobs,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalJobs: total
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get specific job seeker details with their applied jobs (Admin only)
const getJobSeekerWithApplications = async (req, res) => {
  try {
    const { id } = req.params;

    // Find job seeker by ID
    const jobSeeker = await User.findById(id)
      .select('-password');

    if (!jobSeeker || jobSeeker.role !== 'jobSeeker') {
      return res.status(404).json({
        success: false,
        message: 'Job seeker not found'
      });
    }

    // Find all applications for this job seeker and populate job details
    const applications = await Application.find({ applicantId: id })
      .populate({
        path: 'jobId',
        populate: {
          path: 'postedBy',
          select: 'name email profile'
        }
      })
      .sort({ appliedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        jobSeeker,
        applications
      }
    });
  } catch (error) {
    console.error('Get job seeker with applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all job seekers (Admin only)
const getAllJobSeekers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, gender, experienceLevel } = req.query;
    
    // Build filter object for job seekers
    const filter = { role: 'jobSeeker' };
    
    // Add search filter if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add gender filter if provided
    if (gender) {
      filter['profile.gender'] = gender;
    }
    
    // Add experience level filter if provided
    if (experienceLevel) {
      filter['profile.expInWork'] = experienceLevel;
    }
    
    // Get job seekers with pagination
    const jobSeekers = await User.find(filter)
      .select('-password') // Exclude password for security
      .populate('profile') // Populate profile details
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    // Get total count for pagination
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        jobSeekers,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalJobSeekers: total
      }
    });
  } catch (error) {
    console.error('Get all job seekers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user statistics by role (weekly and monthly) for admin dashboard
const getUserStatistics = async (req, res) => {
  try {
    const { role } = req.query; // role: all, jobSeeker, jobHoster, recruiter, eliteTeam
    
    // Calculate date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Build match criteria for weekly data
    const weeklyMatchCriteria = {
      createdAt: {
        $gte: oneWeekAgo,
        $lte: now
      }
    };
    
    // Build match criteria for monthly data
    const monthlyMatchCriteria = {
      createdAt: {
        $gte: oneMonthAgo,
        $lte: now
      }
    };
    
    // Add role filter if specified and not 'all'
    if (role && role !== 'all') {
      weeklyMatchCriteria.role = role;
      monthlyMatchCriteria.role = role;
    }
    
    // Get weekly user registrations grouped by day
    const weeklyStats = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize weekly stats with zero counts
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      weeklyStats[dateString] = {
        count: 0,
        day: dayName
      };
    }
    
    // Get users registered in the last week (filtered by role if specified)
    const weeklyUsers = await User.find(weeklyMatchCriteria);
    
    // Count users by registration day
    weeklyUsers.forEach(user => {
      const date = user.createdAt.toISOString().split('T')[0];
      if (weeklyStats[date] !== undefined) {
        weeklyStats[date].count++;
      }
    });
    
    // Format weekly stats
    const formattedWeeklyStats = Object.keys(weeklyStats).map(date => ({
      date,
      day: weeklyStats[date].day,
      count: weeklyStats[date].count
    }));
    
    // Get monthly user registrations grouped by week
    const monthlyStats = [];
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      
      // Count users in this week (filtered by role if specified)
      const count = await User.countDocuments({
        ...monthlyMatchCriteria,
        createdAt: {
          $gte: weekStart,
          $lte: weekEnd
        }
      });
      
      monthlyStats.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        count
      });
    }
    
    // Get total counts for each role or just the specified role
    let totals = {};
    if (role && role !== 'all') {
      // If a specific role is requested, only show that role's count
      const roleCount = await User.countDocuments({ role });
      totals[role] = roleCount;
    } else {
      // If all roles are requested or no role specified, show all role counts
      const totalUsersAggregation = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);
      
      totals = totalUsersAggregation.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
    }
    
    // Calculate total users (filtered by role if specified)
    let totalFilteredUsers = 0;
    if (role && role !== 'all') {
      totalFilteredUsers = totals[role];
    } else {
      totalFilteredUsers = Object.values(totals).reduce((sum, count) => sum + count, 0);
    }
    
    res.status(200).json({
      success: true,
      data: {
        overallStats: {
          weeklyStats: formattedWeeklyStats,
          monthlyStats,
          totalUsers: totalFilteredUsers
        },
        roleStats: totals
      }
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export {
  createJobDirect,
  getAllApplicants,
  deleteUserAccount,
  getAllJobs,
  getJobSeekerWithApplications,
  getAllJobSeekers,
  getUserStatistics // Add this export
};