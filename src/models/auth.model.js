import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const jobSeekerProfileSchema = new mongoose.Schema({
  age: Number,
  address: String,
  phone: String, // New field for phone number
  githubUrl: String, // New field for GitHub URL
  linkedinUrl: String, // New field for LinkedIn URL
  education: [{
    degree: String,
    institution: String,
    field: String,
    startDate: Date,
    endDate: Date
  }],
  experience: [{
    position: String,
    company: String,
    startDate: Date,
    endDate: Date,
    description: String
  }],
  skills: [String], // New field for job seeker skills
  photo: String, // URL to S3 uploaded photo
  resume: String,  // URL to S3 uploaded resume
  gender: String, // New field for gender
  noticePeriod: String // New field for notice period
}, { _id: false });

const jobHosterProfileSchema = new mongoose.Schema({
  companyName: String,
  companyDescription: String,
  companyWebsite: String,
  companyEmail: String, // New field
  numberOfEmployees: Number, // New field
  companyPhone: String, // New field
  companyLogo: String, // URL to S3 uploaded company logo
  photo: String, // URL to S3 uploaded personal photo
  phone: String, // New field for phone number
  panCardNumber: String,
  gstNumber: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['jobSeeker', 'jobHoster'],
    required: true
  },
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);