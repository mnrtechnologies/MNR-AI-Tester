const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  parent_session: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
user_id: { 
    type: String, 
    required: true 
  },
  excel_sheet_ids: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'user_excelsheet' // Aligned with the exact model name below
  }],
  created_at: { 
    type: Date, 
    default: Date.now 
  }
}, {
  collection: 'user_session' 
});

module.exports = mongoose.model("user_session", SessionSchema);