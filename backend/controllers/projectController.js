const Session = require("../models/Session"); 

// Force Mongoose to register the model before querying
require("../models/ExcelSheet"); // Adjust the path if your file is named differently

exports.getUserSessions = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: User ID not found in request." 
      });
    }

    const userIdString = userId.toString();

    const projects = await Session.find({ user_id: userIdString })
      .populate({
        path: 'excel_sheet_ids',
        model: 'user_excelsheet', // Mongoose now knows exactly what this is!
        select: 'session_id s3_download_url page_url target_website phase3_status created_at' 
      })
      .sort({ created_at: -1 }) 
      .lean(); 

    return res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });

  } catch (error) {
    console.error("Error fetching user projects:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error: Could not retrieve projects.",
      error: error.message
    });
  }
};