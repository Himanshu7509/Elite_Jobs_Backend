import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  company: {
    name: {
      type: String,
      required: true
    },
    description: String,
    website: String,
    logo: String
  },
  location: {
    type: String,
    required: true
  },
  jobType: { // Replaced employmentType
    type: String,
    enum: ['Full-time', 'Part-time'],
    required: true
  },
  interviewType: { // New field
    type: String,
    enum: ['Online', 'On-site'],
    required: true
  },
  workType: { // New field
    type: String,
    enum: ['Remote', 'On-site', 'Hybrid'],
    required: true
  },
  minEducation: { // New field
    type: String,
    required: true
  },
  salary: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  requirements: [String],
  responsibilities: [String],
  skills: [String],
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Executive', 'Intern'],
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicationDeadline: Date,
  category: {
    type: String,
    enum: ['IT', 'Sales', 'Finance', 'Marketing', 'HR', 'Operations', 'Engineering', 'Other'],
    required: true
  }
}, { timestamps: true });

export default mongoose.model('Job', jobSchema);