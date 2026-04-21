const express = require('express');
const { getUserSessions } = require('../controllers/projectController');
const { auth } = require("../middleware/auth");
const router = express.Router();

router.get('/get-user-sessions', auth, getUserSessions);

module.exports = router;