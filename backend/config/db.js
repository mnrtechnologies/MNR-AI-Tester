const mongoose = require("mongoose");
require("dotenv").config();


const { MONGODB_URL } = process.env;

exports.dbconnect = () => {
  mongoose
    .connect(MONGODB_URL)
    // Must be a callback, not a call: `.then(console.log(...))` runs the log
    // synchronously and reports success before the connection is even open.
    .then(() => console.log(`DB Connection Success`))
    .catch((err) => {
      console.log(`DB Connection Failed`);
      console.log(err);
      process.exit(1);
    });
};
