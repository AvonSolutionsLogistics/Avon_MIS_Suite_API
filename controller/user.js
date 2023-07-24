const express = require("express");
const jwt = require("jsonwebtoken");
const convert = require("xml-js");
const fs = require("fs");
const mime = require("mime");
const path = require("path");
var bcrypt = require("bcrypt");
const mimeDb = require('mime-db');
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cookieParser = require("cookie-parser");
const Router = express();
var cors = require("cors");
//const dbcontext = require("../user/DB");
const dbcontext = require("../service/DBCommon");
var bodyParser = require("body-parser");
Router.use(bodyParser.json({ limit: "10mb", extended: true }));
Router.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
Router.use(cookieParser());
const debug = require("debug")("myapp:server");
const multer = require("multer");
const serveIndex = require("serve-index");
const procedure = require("../procedures/user");
Router.use(cors({ credentials: true, origin: process.env.allowed_sites }));
Router.options("/download", cors());
var helpers = require("../service/helper");
const { log } = require("console");

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
Router.post("/loginwithjwt", helpers.middle, function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");

  console.log(req.body);
  res.contentType("application/json");

  try {
    return res.status(200).send({
      status: 200,
      code: 1,
      results: "api called",
    });
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

/* Router.post("/login",async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result=await dbcontext.CallSP(
      'com.user_login',
        convert.json2xml(req.body, xml_options));
    
    var finaljson= convert.xml2js(result,json_options).root[0]
    if(finaljson.success==true){  
      console.log(process.env.jwtsecret)
      finaljson.access_token=jwt.sign(
        {username:finaljson.user_name},
        process.env.jwtsecret,
        {
          expiresIn: 1800, // expires in 30 mins
        })
    }
    res.send(finaljson)
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});
 */

Router.post("/login", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header("Access-Control-Allow-Credentials", "true");
  res.contentType("application/json");
  try {
    var request_json = req.body;
    var user_details = [];
    var userhashxml = await dbcontext.CallSP(
      "com.get_verify_user_password",
      convert.json2xml(request_json, xml_options)
    );

    console.log("xml", userhashxml);
    if (userhashxml == undefined) {
      return res.send({ success: false, message: "Invalid Usename Password" });
    }
    user_details = convert.xml2js(userhashxml, json_options).root;

    //console.log(typeof user_details )
    //current salt
    /* 
        const salt = bcrypt.genSaltSync(10);
        console.log("salt",salt)
        const hash = bcrypt.hashSync("admin", salt);*/
    // console.log(request_json.root.password, user_details[0])

    console.log("dev", user_details);

    if (
      user_details != undefined &&
      bcrypt.compareSync(
        request_json.root.password,
        user_details[0].login_password
      )
    ) {
      var loginjson = {
        root: {
          username: request_json.root.username,
          user_id: user_details[0].user_id,
          ip_address: request_json.root.ipaddress,
        },
      };

      var userhxml = await dbcontext.CallSP(
        "com.user_login",
        convert.json2xml(loginjson, xml_options)
      );

      var finaldata = convert.xml2js(userhxml, json_options).root[0];

      const user = { username: request_json.root.username };
      finaldata.token = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_LIFE,
      });
      /*  If there is no Expires or Max-Age parameter set for the cookie, 
      then the browser will treat is as a "session cookie" and will not store the cookie beyond 
      the current browsing session (typically kept only in memory). So, when the browser is closed, the cookie will be gone. */

      /*   res.status(200).cookie('accesstoken', jwt.sign(user, process.env.jwtsecret, 
        {
        expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 24 hours
      },process.env.ACCESS_TOKEN_SECRET),{
        sameSite: 'strict',
        //maxAge:10000000,
        path:"/",
        httpOnly: true,
        //secure:true  //for https web
      }) */

      res.status(200).cookie(
        "refreshtoken",
        jwt.sign(
          user,
          process.env.jwtsecret,
          {
            expiresIn: process.env.REFRESH_TOKEN_LIFE, // expires in 3h hours
          },
          process.env.REFRESH_TOKEN_SECRET
        ),
        {
          sameSite: "strict",
          //maxAge:10000000,
          path: "/",
          httpOnly: true,
          //secure:true  //for https web
        }
      );

      res.status(200).cookie(
        "accesstoken",
        jwt.sign(
          user,
          process.env.jwtsecret,
          {
            expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 15 mins
          },
          process.env.ACCESS_TOKEN_SECRET
        ),
        {
          sameSite: "strict",
          //maxAge:10000000,
          path: "/",
          httpOnly: true,
          //secure:true  //for https web
        }
      );

      res.send(finaldata);
    } else {
      res.send({ success: false, message: "Invalid Usename Password" });
    }
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});
Router.post("/logout", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log("logout called");
    console.log(req.body);
    var result = await dbcontext.CallSP(
      "com.user_logout",
      convert.json2xml(req.body.data, xml_options)
    );

    var finaljson = convert.xml2js(result, json_options).root[0];
    res.status(200).clearCookie("refresh_token");
    res.status(200).clearCookie("acess_token");
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

Router.post("/refreshtoken", helpers.genaccesstoken, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    res.send({ message: "Session Extended" });
  } catch (e) {
    console.log(e);

    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});
Router.post("/getmenu", helpers.middle, async function (req, res) {
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
      "com.menu_views",
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
Router.post("/getuserprofile", helpers.middle, async function (req, res) {
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
      "com.get_user_profile",
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

Router.post("/setuserprofile", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var data = req.body.data;
    console.log("hii", data);
    if (data.root.new_password != "") {
      const salt = bcrypt.genSaltSync(10);
      console.log("salt", salt);
      var password = bcrypt.hashSync(data.root.new_password, salt);
      data.root.new_password = password;
      data.root.confirm_password = password;
    }
    var result = await dbcontext.CallSP(
      "com.save_user_profile",
      convert.json2xml(req.body.data, xml_options)
    );

    var finaljson = convert.xml2js(result, json_options).root[0];
    res.send(finaljson);

    res.send();
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

Router.post("/settwofactor", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");

  console.log(convert.json2xml(req.body, xml_options));
  const verified = speakeasy.totp.verify({
    secret: req.body.root.secret_key,
    encoding: "base32",
    token: req.body.root.userToken,
  });
  /* console.log("verified", verified); */
  try {
    if (verified) {
      var data = await dbcontext.CallSP(
        "com.update_user_secret_key",
        convert.json2xml(req.body.data, xml_options)
      );
      var jsondata = convert.xml2js(data, json_options).root[0];

      res.status(200).send(jsondata);
    } else {
      res.status(200).send({ message: "Invalid Token", success: false });
    }
  } catch (e) {
    console.log("error", e);
    res.status(500).send(e);
  }
});

Router.post("/twoFactorgenerateqr", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  try {
    const secret = speakeasy.generateSecret();
    var url = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: "Avon " + req.body.user_name,
      algorithm: "sha512",
    });
    //qrcode.toDataURL(secret.otpauth_url, function (err, qrImage) {
    qrcode.toDataURL(url, function (err, qrImage) {
      if (!err) {
        res.send({ qr: qrImage, secret: secret });
      } else {
        res.send(err);
      }
    });
  } catch (er) {
    console.log(er);
    res.status(500).send(er);
  }
});

Router.post("/validatetwofactor", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  try {
    var body = convert.json2xml(req.body, xml_options);
    var data = await dbcontext.CallSP("com.get_user_secret_key", body);

    if (data != "") {
      var json_data = await convert.xml2js(data, json_options).root[0];
      console.log(
        "json data",
        req.body.root.token,
        json_data.authentication_key
      );
      var valid_token = speakeasy.totp.verify({
        secret: json_data.authentication_key,
        encoding: "base32",
        token: req.body.root.token,
      });
      if (valid_token)
        res
          .status(200)
          .send({ success: valid_token, message: "Two Factor Validated" });
      else
        res
          .status(200)
          .send({ success: valid_token, message: "Invalid Token" });
    } else {
      res.status(200).send({
        success: false,
        message: "Two Factor Not Registered",
      });
    }
  } catch (e) {
    console.log("error", e);
    res.status(500).send(e);
  }

  /*  }); */
});

Router.post("/gentoken", helpers.middle, function (req, res) {
  const user = { username: req.body.username };
  //user.token = jwt.sign(user, dbcommon.jwt.secret);
  user.token = jwt.sign(user, process.env.jwtsecret, {
    expiresIn: 86400, // expires in 24 hours
  });
  //console.log('key s: ' + user.token)
  res.send(user);
});

Router.post("/validatetoken", helpers.middle, function (req, res) {
  //res.send("jwt working")
  //return dbcontext.sqltest();
  var data = dbcontext.sqltest();
  console.log(data);
  res.send(dbcontext.sqltest());
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

Router.post("/uploadbase", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  try {
    var data = req.body.data.root;
    console.log(data.base64image);
    var matches = data.base64image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/),
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

    var path = "./public/" + helpers[data.foldervar];

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
        helpers[data.foldervar] +
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

Router.post("/getallnotifications", helpers.middle, async function (req, res) {
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
      "com.get_notifications",
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

Router.post(
  "/getnotificationunreadcount",
  helpers.middle,
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
    res.contentType("application/json");
    try {
      console.log(req.body);
      var result = await dbcontext.CallSP(
        "com.get_notification_unread_count",
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
  }
);

Router.post(
  "/getnotificationsunread",
  helpers.middle,
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
    res.contentType("application/json");
    try {
      console.log(req.body);
      var result = await dbcontext.CallSP(
        "com.get_unread_notifications",
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
  }
);

Router.post(
  "/updatereadnotifications",
  helpers.middle,
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
    res.contentType("application/json");
    try {
      console.log(req.body);
      var result = await dbcontext.CallSP(
        "com.update_notifications",
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
  }
);

Router.post("/getswitchbranch", helpers.middle, async function (req, res) {
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
      "combo.switch_branch",
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

Router.post("/switchbranch", helpers.middle, async function (req, res) {
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
      "com.update_switch_branch",
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

Router.post("/dashboardconfig", helpers.middle, async function (req, res) {
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
      "dash.dashboard_config",
      convert.json2xml(req.body.data, xml_options)
    );
    /* var token= jwt.sign("admin", process.env.jwtsecret, 
    {
    expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 24 hours
  },process.env.ACCESS_TOKEN_SECRET); */

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

Router.post("/getdashboard", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header("Access-Control-Allow-Credentials", "true");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallSP(
      "dash.dashboards",
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
Router.post("/activtyalert", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header("Access-Control-Allow-Credentials", "true");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallSP(
      "config.get_activity_alert",
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

Router.post("/savecustomer", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var data = req.body;
    console.log("data", data);
    if (data.root.password != "") {
      const salt = bcrypt.genSaltSync(10);
      console.log("salt", salt);
      var password = bcrypt.hashSync(data.root.password, salt);
      data.root.password = password;
      data.root.confirm_password = password;
    }

    var result = await dbcontext.CallSP(
      "cusptl.save_customer_portal",
      convert.json2xml(data, xml_options)
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

Router.post("/sendotp", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var result1 = [];
    var finaljson = [];
    var mobile_no = req.body.data.root.mobile_no;
    console.log("mobile_number", mobile_no);
    var result = await dbcontext.CallSP(
      "cusptl.get_verify_customer_mobile_no",
      convert.json2xml(req.body.data, xml_options)
    );
    console.log("result", result);
    var resultjson = convert.xml2js(result, json_options).root[0];
    console.log(resultjson.success);
    if (resultjson.success) {
      var otp = Math.floor(1000 + Math.random() * 9000);
      console.log("OTP================>", otp);
      result1 = await dbcontext.CallSP(
        "cusptl.save_customer_portal",
        convert.json2xml(
          {
            root: {
              mobile_no: mobile_no,
              reg_otp: otp,
            },
          },
          xml_options
        )
      );
      finaljson = convert.xml2js(result1, json_options).root[0];
    } else {
      finaljson = resultjson;
    }

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

Router.post("/sendforgetotp", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var result1 = [];
    var finaljson = [];
    var mobile_no = req.body.data.root.mobile_no;
    console.log("mobile_number", mobile_no);
    var result = await dbcontext.CallSP(
      "cusptl.get_verify_fgtpwd_cust_mobile_no",
      convert.json2xml(req.body.data, xml_options)
    );
    console.log("result", result);
    var resultjson = convert.xml2js(result, json_options).root[0];
    console.log(resultjson.success);
    if (resultjson.success) {
      var otp = Math.floor(1000 + Math.random() * 9000);
      console.log("OTP================>", otp);
      result1 = await dbcontext.CallSP(
        "cusptl.save_customer_otp",
        convert.json2xml(
          {
            root: {
              mobile_no: mobile_no,
              reg_otp: otp,
            },
          },
          xml_options
        )
      );
      finaljson = convert.xml2js(result1, json_options).root[0];
    } else {
      finaljson = resultjson;
    }
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

Router.post("/verifyotp", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log("otp_xml", convert.json2xml(req.body.data, xml_options));
    var result = await dbcontext.CallSP(
      "cusptl.get_verify_customer_otp",
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

Router.post("/customerlogin", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var request_json = req.body;
    var user_details = [];
    var userhashxml = await dbcontext.CallSP(
      "cusptl.get_verify_password",
      convert.json2xml(request_json, xml_options)
    );
    user_details = convert.xml2js(userhashxml, json_options).root;

    //console.log(typeof user_details )
    //current salt
    /* 
        const salt = bcrypt.genSaltSync(10);
        console.log("salt",salt)
        const hash = bcrypt.hashSync("admin", salt);*/
    // console.log(request_json.root.password, user_details[0])

    console.log("login password", user_details[0].password);

    if (
      user_details != undefined &&
      bcrypt.compareSync(request_json.root.password, user_details[0].password)
    ) {
      var loginjson = {
        root: {
          mobile_no: user_details[0].mobile_no,
          ip_address: request_json.root.ipaddress,
        },
      };

      var userhxml = await dbcontext.CallSP(
        "cusptl.customer_login",
        convert.json2xml(loginjson, xml_options)
      );
      const user = { username: request_json.root.mobile_no };
      res.status(200).cookie(
        "refreshtoken",
        jwt.sign(
          user,
          process.env.jwtsecret,
          {
            expiresIn: process.env.REFRESH_TOKEN_LIFE, // expires in 3h hours
          },
          process.env.REFRESH_TOKEN_SECRET
        ),
        {
          sameSite: "strict",
          //maxAge:10000000,
          path: "/",
          httpOnly: true,
          //secure:true  //for https web
        }
      );

      res.status(200).cookie(
        "accesstoken",
        jwt.sign(
          user,
          process.env.jwtsecret,
          {
            expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 15 mins
          },
          process.env.ACCESS_TOKEN_SECRET
        ),
        {
          sameSite: "strict",
          //maxAge:10000000,
          path: "/",
          httpOnly: true,
          //secure:true  //for https web
        }
      );

      res.send(convert.xml2js(userhxml, json_options).root[0]);
    } else {
      res.send({ success: false, message: "Invalid Usename Password" });
    }
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

Router.post("/sendemail", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    helpers.sendMail(
      "devops@avonsolutionsindia.com",
      "gowtham@avonsolutionsindia.com",
      "",
      "hii",
      "hii"
    );
    res.send("emailsent");
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

Router.post("/sendemailwithattachments", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  var mail_attachemnts = [];
  try {
    // PDF Generation
    const htmlContent =
      "<html><body><h1>Hello, PDF Generation in Node.js!</h1></body></html>";
    await helpers
      .generatePDF(htmlContent)
      .then((data) => {
        if (data.status) {
          mail_attachemnts.push({
            filename: data.filename,
            path: data.path,
          });
        } else {
          res.send({ success: false, message: "error while creating excel" });
        }
      })
      .catch((error) => {
        console.error("Error generating PDF:", error);
      });

    const xmlData = `
  <data>
    <item>
      <name>John</name>
      <age>25</age>
      <color>Red</color>
    </item>
    <item>
      <name>Alice</name>
      <age>30</age>
      <color>Green</color>
    </item>
    <item>
      <name>Bob</name>
      <age>22</age>
      <color>Blue</color>
    </item>
  </data>
`;

    const columnHeadings = ["Name", "Age", "Color"];
    await helpers.generateExcel(xmlData, columnHeadings).then((data) => {
      mail_attachemnts.push({
        filename: data.filename,
        path: data.path,
      });
    });

    console.log(mail_attachemnts);

    helpers.sendMail(
      "devops@avonsolutionsindia.com",
      "gowtham@avonsolutionsindia.com",
      "",
      "hii",
      "hii",
      mail_attachemnts
    );
    return res.status(200).send({
      status: 200,
      results: [{ message: "Mail Sent Success" }],
    });
  } catch (e) {
    console.log(e);
    return res.status(400).send({
      status: 400,
      code: -1,
      results: [{ exception: e }],
    });
  }
});

Router.post("/resetcustomerpassword", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    var data = req.body;
    console.log("data", data);
    if (data.root.password != "") {
      const salt = bcrypt.genSaltSync(10);
      console.log("salt", salt);
      var password = bcrypt.hashSync(data.root.password, salt);
      data.root.password = password;
      data.root.confirm_password = password;
    }

    var result = await dbcontext.CallSP(
      "cusptl.save_customer_reset_pwd",
      convert.json2xml(data, xml_options)
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

Router.get("/download", async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    const filename = req.query.filename;
    const currentDir = path.dirname(__dirname);
    const filePath = path.resolve(
      currentDir,
      "public/" + req.query.location,
      filename
    );

    res.download(filePath, (err) => {
      if (err) {
        // Handle the error
        console.error(err);
        res.status(500).send("Error downloading file");
      }
    });
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
Router.post("/upload", upload.single("file"), function (req, res, next) {
  var fileinfo = req.body.file;
  var title = req.body.title;
  console.log(title);
  res.send(fileinfo);
});

/*multiple files upload*/
Router.post(
  "/multipleuploads",
  upload.array("file", 10),
  function (req, res, next) {
    var fileinfo = req.files;

    res.send({
      fileinfo: fileinfo,
      filename: fileinfo[0].filename,
      path:
        req.protocol + "://" + req.get("host") + "/" + req.query.location + "/",
    });
  }
);

Router.post("/getrawdata", helpers.middle, async function (req, res) {
  res.header("Access-Control-Allow-Origin", process.env.allowed_sites);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");
  res.contentType("application/json");
  try {
    console.log(req.body);
    var result = await dbcontext.CallMailSP(
      procedure[req.body.tag],
      convert.json2xml(req.body.data, xml_options)
    );

    res.status(200).send(result);
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
