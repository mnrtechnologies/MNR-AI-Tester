const mongoose = require("mongoose");

const excelSheetSchema = new mongoose.Schema({
  session_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  parent_session: { 
    type: String, 
    required: true,
    index: true 
  },
user_id: { 
    type: String, 
    required: true 
  },
  auth_file: { 
    type: String, 
    default: null 
  },
  page_url: { 
    type: String, 
    required: true 
  },
  target_website: { 
    type: String, 
    required: true 
  },
  s3_excel_key: { 
    type: String, 
    required: true 
  },
  s3_download_url: { 
    type: String, 
    required: true 
  },
  phase3_status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'failed'], 
    default: 'pending' 
  },
  phase3_error: { 
    type: String, 
    default: null 
  },
  phase3_started_at: { 
    type: Date, 
    default: null 
  },
  phase3_finished_at: { 
    type: Date, 
    default: null 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
}, {
  collection: 'user_excelsheet'
});

const ExcelSheet = mongoose.model("user_excelsheet", excelSheetSchema);
module.exports = ExcelSheet;