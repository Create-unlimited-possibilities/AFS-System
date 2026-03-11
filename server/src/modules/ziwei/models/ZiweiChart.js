/**
 * ZiweiChart MongoDB Model
 *
 * Stores the complete natal chart data (本命盘) from iztro astrolabe.
 * Horoscope (运限) is calculated on-demand and NOT stored.
 *
 * Reference: https://github.com/SylarLong/iztro
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';

/**
 * Palace Star Schema - Used for major, minor, and decorative stars
 * Based on iztro Star type: name, type, scope, brightness, mutagen
 */
const starSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String },
  scope: { type: String },      // 星耀范围 (original, borrowed, etc.)
  brightness: { type: String },  // 亮度 (庙旺利陷)
  mutagen: { type: String }     // 四化 (化禄、化权、化科、化忌)
}, { _id: false });

/**
 * Palace Decadal Schema - For 10-year cycles (大限)
 * Actual iztro format: { index, name, heavenlyStem, earthlyBranch, fiveElementsClass }
 */
const decadalSchema = new mongoose.Schema({
  index: { type: Number },
  name: { type: String },
  heavenlyStem: { type: String },
  earthlyBranch: { type: String },
  fiveElementsClass: { type: String }
}, { _id: false });

/**
 * Palace Schema - Represents one of the 12 palaces in the chart
 * Based on actual iztro output format
 */
const palaceSchema = new mongoose.Schema({
  // Basic information
  index: { type: Number, required: true },
  name: { type: String, required: true },
  isBodyPalace: { type: Boolean, default: false },
  isOriginalPalace: { type: Boolean, default: false },

  // Heavenly stem and earthly branch
  heavenlyStem: { type: String },
  earthlyBranch: { type: String },

  // Stars in this palace
  majorStars: [starSchema],
  minorStars: [starSchema],
  adjectiveStars: [starSchema],

  // 12 god stars (iztro returns strings, not objects)
  changsheng12: { type: String },  // 长生12神 - string like "病"
  boshi12: { type: String },       // 博士12神
  jiangqian12: { type: String },   // 将前12神
  suiqian12: { type: String },     // 岁前12神

  // Decadal information
  decadal: decadalSchema,

  // Ages - iztro returns array of numbers [11, 23, 35, ...]
  ages: [{ type: Number }]
}, { _id: false });

/**
 * Raw Dates Schema - Detailed date breakdown from iztro
 * lunarDate: { lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean }
 * chineseDate: { yearly: [天干, 地支], monthly: [...], daily: [...], hourly: [...] }
 */
const rawDatesSchema = new mongoose.Schema({
  lunarDate: {
    lunarYear: { type: Number },
    lunarMonth: { type: Number },
    lunarDay: { type: Number },
    isLeap: { type: Boolean }
  },
  chineseDate: {
    yearly: [{ type: String }],   // Array [天干, 地支]
    monthly: [{ type: String }],
    daily: [{ type: String }],
    hourly: [{ type: String }]
  }
}, { _id: false });

/**
 * Input Parameters Schema - Stores parameters used for chart generation
 */
const inputParamsSchema = new mongoose.Schema({
  gender: { type: String, enum: ['male', 'female', '男', '女'] },
  birthDate: Date,
  birthHour: { type: Number, min: 0, max: 23 },
  isSolar: { type: Boolean, default: true }
}, { _id: false });

/**
 * Main ZiweiChart Schema
 */
const ziweiChartSchema = new mongoose.Schema({
  // User reference (Foreign Key to User)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Birth information from iztro
  gender: {
    type: String,
    enum: ['male', 'female', '男', '女'],
    required: true
  },

  // Date information from iztro astrolabe
  solarDate: { type: String, required: true },
  lunarDate: { type: String, required: true },
  chineseDate: { type: String, required: true },

  // Raw dates with detailed breakdown
  rawDates: rawDatesSchema,

  // Time information
  time: {
    type: String,
    required: true
  },
  timeRange: { type: String },

  // Zodiac and sign
  sign: { type: String, required: true },  // 星座
  zodiac: { type: String, required: true },  // 生肖

  // Soul and body palace positions
  earthlyBranchOfSoulPalace: { type: String },  // 命宫地支
  earthlyBranchOfBodyPalace: { type: String },  // 身宫地支

  // Soul and body stars (iztro returns these as strings, e.g., '巨门', '火星')
  soul: { type: String },
  body: { type: String },

  // Five elements class (命主)
  fiveElementsClass: {
    type: String,
    required: true
  },

  // All 12 palaces with complete data
  palaces: {
    type: [palaceSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length === 12;
      },
      message: 'A ziwei chart must have exactly 12 palaces'
    }
  },

  // Copyright information from iztro
  copyright: {
    type: String
  },

  // Input parameters used for generation (for regeneration)
  inputParams: inputParamsSchema,

  // Metadata
  generatedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
ziweiChartSchema.index({ userId: 1 });
ziweiChartSchema.index({ soul: 1 });
ziweiChartSchema.index({ body: 1 });
ziweiChartSchema.index({ sign: 1 });
ziweiChartSchema.index({ zodiac: 1 });
ziweiChartSchema.index({ generatedAt: -1 });

// Update the updatedAt timestamp before saving
ziweiChartSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Static method: Find chart by userId
 */
ziweiChartSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

/**
 * Static method: Check if user has a chart
 */
ziweiChartSchema.statics.hasChart = function(userId) {
  return this.exists({ userId });
};

/**
 * Instance method: Get palace by name
 */
ziweiChartSchema.methods.getPalaceByName = function(palaceName) {
  return this.palaces.find(p => p.name === palaceName) || null;
};

/**
 * Instance method: Get major stars in a specific palace
 */
ziweiChartSchema.methods.getMajorStarsInPalace = function(palaceName) {
  const palace = this.getPalaceByName(palaceName);
  return palace ? palace.majorStars : [];
};

export default mongoose.model('ZiweiChart', ziweiChartSchema);
