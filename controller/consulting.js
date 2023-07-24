const express = require("express");
const jwt = require("jsonwebtoken");
const convert = require("xml-js");
const fs = require("fs");
const mime = require("mime");
const mimeDb = require('mime-db');
const cookieParser = require("cookie-parser");
var bcrypt = require("bcrypt");
const Router = express();
var cors = require("cors");
Router.use(cookieParser());
//const dbcontext = require("../user/DB");
const dbcontext = require("../service/DBCommon");
var bodyParser = require("body-parser");
Router.use(bodyParser.json({ limit: "10mb", extended: true }));
Router.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
Router.use(cors({ credentials: true, origin: process.env.allowed_sites }));
const debug = require("debug")("myapp:server");
const multer = require("multer");
const serveIndex = require("serve-index");

var helpers = require("../service/helper");

const procedure = require("../procedures/consulting");
const combo = require("../procedures/combo");
function getExtensionFromMimeType(mimeType) {
  const entry = mimeDb[mimeType.toLowerCase()];
  return entry ? entry.extensions[0] : null;
}
var removeJsonTextAttribute = function (value, parentElement) {
  try {
    var keyNo = Object.keys(parentElement._parent).length;
    var keyName = Object.keys(parentElement._parent)[keyNo - 1];
    parentElement._parent[keyName] = helpers.nativeType(value);
  } catch (e) {}
};
var xml_options = { compact: true, ignoreComment: true, spaces: 4 };

var json_options = {
  compact: true,
  trim: true,
  ignoreDeclaration: true,
  ignoreInstruction: true,
  ignoreAttributes: true,
  ignoreComment: true,
  ignoreCdata: true,
  ignoreDoctype: true,
  alwaysArray: true,
  nativeTypeAttributes: true,
  textFn: removeJsonTextAttribute,
};
Router.get("/", (req, res) => {
  res.send({ message: "User Call Works" });
});

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    var path = "./public/" + req.query.location + "/";
    console.log(path);
    //cb(null, path)
    // var dir = './tmp';
    if (!fs.existsSync(path)) {
      console.log("nopath");
      fs.mkdirSync(path);
    }
    cb(null, path);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now()+"."+getExtensionFromMimeType(file.mimetype) );
  },
});

//will be using this for uplading
const upload = multer({ storage: storage });

Router.use(
  "/ftp",
  express.static("public"),
  serveIndex("public", { icons: true })
);

Router.get("/", (req, res) => {
  res.json({ message: "Hello this is my first api" });
});

//--------------------------ROUTES--------------------------------------

Router.post("/common", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallSP(
      procedure[req.body.tag],
      convert.json2xml(req.body.data, xml_options)
    );

    var finaljson = convert.xml2js(result, json_options).root[0];

    res.send(finaljson);
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

Router.post("/constants", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallSP(
      "combo.constants",
      convert.json2xml(req.body.data, xml_options)
    );

    var finaljson = convert.xml2js(result, json_options).root[0];

    res.send(finaljson);
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});
Router.post("/combo", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallSP(
      combo[req.body.tag],
      convert.json2xml(req.body.data, xml_options)
    );
    var finaljson = convert.xml2js(result, json_options).root[0];

    res.status(200).send(finaljson);
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});
Router.post("/mail", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var result = await dbcontext.CallMailSP(
      procedure[req.body.tag],
      convert.json2xml(req.body.data, xml_options)
    );
    console.log(result);
    for (i = 0; i < result.length; i++)
      helpers.sendMail(
        result[i].mail_from,
        result[i].mail_to,
        result[i].mail_cc,
        result[i].mail_subject,
        result[i].mail_content
      );
    res.status(200).send(finaljson);
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

module.exports = Router;
