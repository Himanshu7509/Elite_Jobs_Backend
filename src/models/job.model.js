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
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'],
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
    default: 'Other'
  }
}, { timestamps: true });

export default mongoose.model('Job', jobSchema);