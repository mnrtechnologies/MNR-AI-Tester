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
  /**
   * Number of billable test stories this URL produced.
   *
   * WRITTEN BY THE PYTHON AI ENGINE, not by this service — see
   * MNR_AI_Tester-AI_Backend-Web_Testing/utils/db.py. Both apps share the
   * same MongoDB, so this is how Express gets an authoritative story count
   * without trusting the browser and without any cross-service HTTP.
   *
   * null means "not counted yet" (a sheet written before this field existed,
   * or one whose Excel could not be parsed). creditService prices a null
   * count at the MAX_STORIES_PER_URL ceiling — fail expensive, not free —
   * and flags the estimate as incomplete. The engine backfills it the first
   * time anyone opens Phase Review for that session.
   */
  story_count: {
    type: Number,
    default: null
  },
  phase3_status: {
    // 'cancelled' is written by the engine's terminate/cancel endpoints so the
    // credit reconciler can settle straight away instead of holding the
    // customer's credits hostage until the reservation times out.
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
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

// Credit estimation queries this by (parent_session, user_id) on every Phase
// Review load and on every authorize/settle call.
excelSheetSchema.index({ parent_session: 1, user_id: 1 });

const ExcelSheet = mongoose.model("user_excelsheet", excelSheetSchema);
module.exports = ExcelSheet;