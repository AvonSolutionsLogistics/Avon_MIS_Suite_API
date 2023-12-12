require("dotenv").config();
const express = require("express");
const cron = require('node-cron');
const app = new express();
const cookieParser = require("cookie-parser");
const UserRoutes = require("./controller/user");
const MasterRoutes = require("./controller/master");
const ReportRoutes = require("./controller/report");
const DataManagementRoutes= require("./controller/datamanagement");
app.use(function timeLog(req, res, next) {
  console.log("Time: ", Date.now());
  next();
});
app.use(cookieParser());
app.use("/user", UserRoutes);
app.use("/master", MasterRoutes);
app.use("/report", ReportRoutes);
app.use("/datamanagement", DataManagementRoutes);
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname + "/public"));
var router = express.Router();

router.get("/", function (req, res) {
  res.json({ message: "Welcome To Avon Solutions & Logistics Pvt ltd" });
});

app.use("/api", router);

//cron.schedule('*/1 * * * *', MailFunction.sendmail);

app.listen(8080, () => {
  console.log("Server is running on Port : " + process.env.PORT);
});
