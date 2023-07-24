const express = require("express");
const jwt = require("jsonwebtoken");
const convert = require("xml-js");
const fs = require("fs");
const mime = require("mime");
const cookieParser = require("cookie-parser");
const Router = express();
var cors = require("cors");
const mimeDb = require('mime-db');
//const dbcontext = require("../user/DB");
const dbcontext = require("../service/DBCommon");
var bodyParser = require("body-parser");
Router.use(bodyParser.json({ limit: "10mb", extended: true }));
Router.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
Router.use(cookieParser());
const debug = require("debug")("myapp:server");
const multer = require("multer");
const serveIndex = require("serve-index");
Router.use(cors({ credentials: true, origin: process.env.allowed_sites }));

var helpers = require("../service/helper");
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

Router.post("/reportconfig", helpers.middle, async function (req, res) {
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
      "config.report_configuration",
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

Router.post("/reporttabledata", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var result = await dbcontext.CallSP(
      req.body.root.spname,
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

/*single file upload*/
Router.post(
  "/uploadfile",
  helpers.middle,
  upload.single("file"),
  async function (req, res) {
    res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header(
      "Access-Control-Allow-Methods",
      "PUT, POST, GET, DELETE, OPTIONS"
    );
    try {
      debug(req.file);
      console.log(req.file.path);
      /* console.log(req.query.mobile_number); */
      var fileinfo = req.file;
      var pics = "";
      pics = fileinfo.destination.substring(8) + fileinfo.filename;
      return res.send({ filename: pics });
    } catch (e) {
      res.send(e);
    }
  }
);

Router.post("/uploadbase", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  try {
    console.log(req.body.base64image);
    var matches = req.body.base64image.match(
        /^data:([A-Za-z-+/]+);base64,(.+)$/
      ),
      response = {};

    if (matches.length !== 3) {
      return res.status(400).send({
        success: false,
        message: "Not a valid Base 64 Image",
      });
    }

    response.type = matches[1];
    //response.data = new Buffer(matches[2], 'base64');
    response.data = Buffer.from(matches[2], "base64");

    let decodedImg = response;
    let imageBuffer = decodedImg.data;
    let type = decodedImg.type;
    let extension = mime.getExtension(type);
    let fileName = Date.now() + "." + extension;

    var path = "./public/" + helpers[req.body.foldervar];

    console.log(path);
    if (!fs.existsSync(path)) {
      console.log("nopath");
      fs.mkdirSync(path);
    }
    fs.writeFileSync(path + "/" + fileName, imageBuffer, "utf8");

    res.status(200).send({
      success: true,
      message: "Upload Success...!",
      filename: fileName,
      path:
        req.protocol +
        "://" +
        req.get("host") +
        "/" +
        helpers[req.body.foldervar] +
        "/" +
        fileName,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      success: false,
      message: "Upload Failed...!",
    });
  }
});

Router.post("/spdata", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body.data);
    var result = await dbcontext.CallSP(
      req.body.sp_name,
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

Router.post("/savereportcoloumns", helpers.middle, async function (req, res) {
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
      "config.save_report_columns",
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

module.exports = Router;
