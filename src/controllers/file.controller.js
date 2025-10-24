import User from '../models/auth.model.js';
import s3 from '../config/s3.js';
import { v4 as uuidv4 } from 'uuid';

// Upload file to AWS S3
const uploadToS3 = async (file, folder = 'job-files') => {
  const fileKey = `${folder}/${uuidv4()}-${file.originalname}`;
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const uploaded = await s3.upload(params).promise();
  return uploaded.Location; // Return public URL
};

// Delete file from AWS S3
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract file key from URL
    const key = fileUrl.split(".amazonaws.com/")[1]; // everything after the domain
    
    // Delete file from S3
    await s3
      .deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
      .promise();
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw error;
  }
};

// Upload file to S3
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileUrl = await uploadToS3(req.file);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile with uploaded file
const updateProfileWithFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fileType } = req.body; // 'resume', 'photo', 'companyLogo'
    
    // Handle both single file (from .single()) and field-based file (from .fields())
    const file = req.file || (req.files && Object.values(req.files)[0] && Object.values(req.files)[0][0]);
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // If fileType is not provided in body, try to determine it from field name
    let determinedFileType = fileType;
    if (!determinedFileType && req.files) {
      determinedFileType = Object.keys(req.files)[0];
    }
    
    // Validate file type based on user role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let validFileTypes = [];
    if (user.role === 'jobSeeker') {
      validFileTypes = ['resume', 'photo'];
    } else if (user.role === 'jobHoster') {
      validFileTypes = ['photo', 'companyLogo'];
    }
    
    if (!determinedFileType || !validFileTypes.includes(determinedFileType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type for ${user.role}. Valid types: ${validFileTypes.join(', ')}`
      });
    }
    
    // Validate file type based on field name
    if (determinedFileType === 'resume' && file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF files are allowed for resume'
      });
    }
    
    if ((determinedFileType === 'photo' || determinedFileType === 'companyLogo') && !file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only image files are allowed for photo and company logo'
      });
    }
    
    // Upload file to S3
    let folder = 'job-files';
    if (determinedFileType === 'resume') folder = 'job-files/resumes';
    if (determinedFileType === 'photo') folder = 'job-files/photos';
    if (determinedFileType === 'companyLogo') folder = 'job-files/logos';
    
    const fileUrl = await uploadToS3(file, folder);
    
    // Prepare update object
    const updateData = {};
    updateData[`profile.${determinedFileType}`] = fileUrl;
    
    console.log('Updating profile with data:', updateData);
    
    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log('Updated user:', updatedUser);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Profile ${determinedFileType} updated successfully`,
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile with file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Upload multiple files in a single request
const uploadMultipleFiles = async (req, res) => {
  try {
    const userId = req.user.userId;
    const files = req.files;
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate files based on user role and field names
    const updates = {};
    
    // Process each uploaded file
    for (const [fieldName, fileArray] of Object.entries(files)) {
      const file = fileArray[0]; // Get the first file from the array
      
      // Validate field name based on user role
      let validFields = [];
      if (user.role === 'jobSeeker') {
        validFields = ['resume', 'photo'];
      } else if (user.role === 'jobHoster') {
        validFields = ['photo', 'companyLogo'];
      }
      
      if (!validFields.includes(fieldName)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field name '${fieldName}' for ${user.role}. Valid fields: ${validFields.join(', ')}`
        });
      }
      
      // Validate file type based on field name
      if (fieldName === 'resume' && file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type for resume. Only PDF files are allowed'
        });
      }
      
      if ((fieldName === 'photo' || fieldName === 'companyLogo') && !file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type for ${fieldName}. Only image files are allowed`
        });
      }
      
      // Upload file to appropriate S3 folder
      let folder = 'job-files';
      if (fieldName === 'resume') folder = 'job-files/resumes';
      if (fieldName === 'photo') folder = 'job-files/photos';
      if (fieldName === 'companyLogo') folder = 'job-files/logos';
      
      const fileUrl = await uploadToS3(file, folder);
      updates[`profile.${fieldName}`] = fileUrl;
    }
    
    // Update user profile with all file URLs
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
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
      message: 'Files uploaded successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Upload multiple files error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only image files are allowed for profile picture'
      });
    }
    
    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete old profile picture if exists
    if (user.profile && user.profile.photo) {
      try {
        await deleteFromS3(user.profile.photo);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
      }
    }
    
    // Upload new profile picture
    const fileUrl = await uploadToS3(req.file, 'job-files/photos');
    
    // Update user profile
    const updateData = { 'profile.photo': fileUrl };
    
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
      message: 'Profile picture updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update resume (job seeker only)
const updateResume = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF files are allowed for resume'
      });
    }
    
    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Ensure user is a job seeker
    if (user.role !== 'jobSeeker') {
      return res.status(403).json({
        success: false,
        message: 'Only job seekers can update resumes'
      });
    }
    
    // Delete old resume if exists
    if (user.profile && user.profile.resume) {
      try {
        await deleteFromS3(user.profile.resume);
      } catch (error) {
        console.error('Error deleting old resume:', error);
      }
    }
    
    // Upload new resume
    const fileUrl = await uploadToS3(req.file, 'job-files/resumes');
    
    // Update user profile
    const updateData = { 'profile.resume': fileUrl };
    
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
      message: 'Resume updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update company logo (job hoster only)
const updateCompanyLogo = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only image files are allowed for company logo'
      });
    }
    
    // Get user to check role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Ensure user is a job hoster
    if (user.role !== 'jobHoster') {
      return res.status(403).json({
        success: false,
        message: 'Only job hosters can update company logos'
      });
    }
    
    // Delete old company logo if exists
    if (user.profile && user.profile.companyLogo) {
      try {
        await deleteFromS3(user.profile.companyLogo);
      } catch (error) {
        console.error('Error deleting old company logo:', error);
      }
    }
    
    // Upload new company logo
    const fileUrl = await uploadToS3(req.file, 'job-files/logos');
    
    // Update user profile
    const updateData = { 'profile.companyLogo': fileUrl };
    
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
      message: 'Company logo updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update company logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export { uploadFile, updateProfileWithFile, uploadToS3, deleteFromS3, uploadMultipleFiles, updateProfilePicture, updateResume, updateCompanyLogo };