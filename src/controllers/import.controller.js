import User from '../models/auth.model.js';
import XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import resend from '../config/email.js';

// Add this import for better error handling
import mongoose from 'mongoose';

// Convert Excel row to user object
export const convertExcelRowToUser = (row) => {
  try {
    // Clean and normalize data
    const cleanValue = (value) => {
      if (value === null || value === undefined || value === '') return '';
      return String(value).trim();
    };

    const email = cleanValue(row['Email']);

    // Validate required fields
    if (!email) {
      throw new Error('Email is required for all job seekers');
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    // Process phone numbers
    const phone = cleanValue(row['Phone No.']);
    const alternatePhone = cleanValue(row['Alternate No.']);

    // Process arrays from Excel cells
    const processArrayField = (value) => {
      if (!value) return [];
      const strValue = cleanValue(value);
      if (!strValue) return [];
      return strValue.split(',').map(item => item.trim()).filter(item => item);
    };

    return {
      name: cleanValue(row['Full Name']) || '',
      email: email.toLowerCase(),
      password: uuidv4().slice(0, 8), // Generate temporary password
      role: 'jobSeeker',
      isImported: true,
      importedFrom: 'excel-import',
      isVerified: false, // Will be verified after first login
      profile: {
        age: row['Age'] ? parseInt(row['Age']) : null,
        gender: cleanValue(row['Gender']),
        phone: phone,
        alternatePhone: alternatePhone,
        address: cleanValue(row['Address']),
        highestEducation: cleanValue(row['Highest Education']),
        certifications: processArrayField(row['Certification']),
        skills: processArrayField(row['Skills']),
        experience: processArrayField(row['Work Experience']),
        designation: cleanValue(row['Applied Post']),
        // Default values for other required fields
        noticePeriod: null,
        preferredLocation: '',
        expInWork: null,
        salaryExpectation: '',
        preferredCategory: null,
        photo: '',
        resume: '',
        githubUrl: '',
        linkedinUrl: '',
        education: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error in convertExcelRowToUser:', error);
    throw error;
  }
};

// Import job seekers from Excel file
export const importJobSeekers = async (req, res) => {
  try {
    console.log('📥 Import job seekers endpoint called');
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Database not connected');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    console.log('📁 Request files:', req.files);
    console.log('📄 Request file:', req.file);
    
    if (!req.file) {
      console.error('❌ No file uploaded in request');
      return res.status(400).json({
        success: false,
        message: 'Please upload an Excel file'
      });
    }

    console.log('🔄 Starting job seeker import...');
    
    // Check if file exists and has buffer
    if (!req.file.buffer) {
      console.error('❌ No file buffer found in request');
      console.error('❌ File object:', req.file);
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file buffer missing'
      });
    }
    
    console.log(`📁 File received: ${req.file.originalname} (${req.file.mimetype})`);
    console.log(`📊 File size: ${req.file.buffer.length} bytes`);
    
    // Read Excel file
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      console.log('✅ Excel file parsed successfully');
    } catch (parseError) {
      console.error('❌ Excel parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid Excel file format',
        error: parseError.message
      });
    }
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      console.error('❌ No worksheets found in Excel file');
      return res.status(400).json({
        success: false,
        message: 'No worksheets found in Excel file'
      });
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log(`📋 Working with sheet: ${sheetName}`);
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${jsonData.length} records in Excel file`);
    console.log(`📋 First row keys:`, Object.keys(jsonData[0] || {}));
    
    if (jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data found in Excel file'
      });
    }

    // Validate required columns
    const requiredColumns = ['Full Name', 'Email'];
    const firstRow = jsonData[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      console.error('❌ Missing required columns:', missingColumns);
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingColumns.join(', ')}`,
        availableColumns: Object.keys(firstRow),
        requiredColumns: requiredColumns
      });
    }
    
    console.log('✅ Required columns found');
    
    // Process each row
    const usersToInsert = [];
    const errors = [];
    let processedRecords = 0;
    
    console.log('🔄 Processing rows...');
    for (let i = 0; i < jsonData.length; i++) {
      try {
        const row = jsonData[i];
        console.log(`📋 Processing row ${i + 1}:`, {
          'Full Name': row['Full Name'],
          'Email': row['Email']
        });
        
        // Skip rows where email is empty
        if (!row['Email'] || row['Email'].toString().trim() === '') {
          errors.push(`Row ${i + 1}: No email provided`);
          console.log(`❌ Row ${i + 1}: Skipping - no email`);
          continue;
        }
        
        const user = convertExcelRowToUser(row);
        console.log(`✅ Row ${i + 1}: User object created`);
        
        // Validate required fields before checking existence
        if (!user.name || !user.email) {
          errors.push(`Row ${i + 1}: Missing required fields (name or email)`);
          console.log(`❌ Row ${i + 1}: Missing required fields`);
          continue;
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: user.email }).lean();
        if (existingUser) {
          errors.push(`Row ${i + 1}: User with email ${user.email} already exists`);
          console.log(`❌ Row ${i + 1}: User already exists`);
          continue;
        }
        
        usersToInsert.push(user);
        processedRecords++;
        console.log(`✅ Row ${i + 1}: Ready for insertion`);
        
      } catch (error) {
        console.error(`❌ Row ${i + 1}: Error -`, error.message);
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }
    
    console.log(`📊 Processing complete: ${processedRecords} records to insert, ${errors.length} errors`);
    
    let insertedCount = 0;
    if (usersToInsert.length > 0) {
      console.log(`💾 Inserting ${usersToInsert.length} users into database...`);
      
      // Insert users in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < usersToInsert.length; i += batchSize) {
        const batch = usersToInsert.slice(i, i + batchSize);
        console.log(`🔄 Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersToInsert.length/batchSize)}`);
        try {
          const result = await User.insertMany(batch, { ordered: false }); // Continue on validation errors
          insertedCount += result.length;
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${result.length} users`);
        } catch (batchError) {
          console.error(`❌ Batch insertion error:`, batchError);
          // Handle duplicate key errors or validation errors
          if (batchError.code === 11000) {
            console.log('🔄 Handling duplicate key errors by individual insert');
            // Handle duplicate key error by inserting one by one
            for (const user of batch) {
              try {
                await User.create(user);
                insertedCount++;
                console.log(`✅ Individual insert successful for ${user.email}`);
              } catch (individualError) {
                if (individualError.code !== 11000) { // Skip duplicates, report other errors
                  console.error(`❌ Individual insert error for ${user.email}:`, individualError.message);
                  errors.push(`Individual insert error for ${user.email}: ${individualError.message}`);
                } else {
                  console.log(`ℹ️  Skipping duplicate for ${user.email}`);
                }
              }
            }
          } else {
            // Re-throw if it's not a duplicate error we can handle
            console.error('❌ Non-duplicate error, re-throwing');
            throw batchError;
          }
        }
      }
      
      console.log(`🎉 Successfully imported ${insertedCount} job seekers!`);
    }
    
    // Send success response
    console.log('📤 Sending success response');
    res.status(200).json({
      success: true,
      message: `Import completed successfully`,
      data: {
        totalRecords: jsonData.length,
        processedRecords: processedRecords,
        insertedRecords: insertedCount,
        skippedRecords: errors.length,
        errors: errors
      }
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error name:', error.name);
    
    res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
      // Include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Get imported job seekers
export const getImportedJobSeekers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    // Build filter for imported users
    let filter = { isImported: true, role: 'jobSeeker' };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalUsers: total
      }
    });
  } catch (error) {
    console.error('Get imported job seekers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Send welcome email to imported users
export const sendWelcomeEmails = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user IDs'
      });
    }
    
    const users = await User.find({
      _id: { $in: userIds },
      isImported: true,
      role: 'jobSeeker'
    });
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No imported users found'
      });
    }
    
    let successCount = 0;
    const errors = [];
    
    for (const user of users) {
      try {
        // Send welcome email with instructions
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@mail.eliteassociate.in',
          to: user.email,
          subject: 'Welcome to Elite Jobs - Set Your Password',
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
                            <p style="margin: 0 0 15px 0;">Welcome to Elite Jobs! Your account has been created with the following details:</p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                              <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${user.email}</p>
                              <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${user.name}</p>
                              <p style="margin: 0;"><strong>Account Status:</strong> Awaiting password setup</p>
                            </div>
                            
                            <p style="margin: 0 0 15px 0;">To complete your registration and start using our platform:</p>
                            
                            <ol style="margin: 20px 0; padding-left: 20px;">
                              <li style="margin-bottom: 10px;">Visit our website at <a href="${process.env.FRONTEND_URL}" style="color: #667eea;">${process.env.FRONTEND_URL}</a></li>
                              <li style="margin-bottom: 10px;">Click on "Forgot Password" on the login page</li>
                              <li style="margin-bottom: 10px;">Enter your email address (${user.email})</li>
                              <li style="margin-bottom: 10px;">You'll receive an OTP to set your password</li>
                              <li style="margin-bottom: 10px;">Create your password and log in</li>
                            </ol>
                            
                            <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                              <p style="margin: 0; color: #856404; font-weight: bold;">Important:</p>
                              <p style="margin: 5px 0 0 0; color: #856404;">Your account will be fully activated once you set your password. You can then update your profile, upload your resume, and start applying for jobs.</p>
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
        
        successCount++;
      } catch (emailError) {
        errors.push(`Failed to send email to ${user.email}: ${emailError.message}`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Welcome emails sent successfully`,
      data: {
        totalUsers: users.length,
        successCount: successCount,
        failedCount: errors.length,
        errors: errors
      }
    });
    
  } catch (error) {
    console.error('Send welcome emails error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get import statistics
export const getImportStatistics = async (req, res) => {
  try {
    const totalImported = await User.countDocuments({ isImported: true, role: 'jobSeeker' });
    const verifiedImported = await User.countDocuments({ isImported: true, role: 'jobSeeker', isVerified: true });
    const unverifiedImported = await User.countDocuments({ isImported: true, role: 'jobSeeker', isVerified: false });
    
    res.status(200).json({
      success: true,
      data: {
        totalImported,
        verifiedImported,
        unverifiedImported,
        verificationRate: totalImported > 0 ? Math.round((verifiedImported / totalImported) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get import statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};