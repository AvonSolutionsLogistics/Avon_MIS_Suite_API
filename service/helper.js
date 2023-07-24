const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");
const ExcelJS = require("exceljs");
const xmlJs = require("xml-js");
const fs = require("fs");

module.exports = {
  middle: function (req, res, next) {
    try {
      var cookiearray = req.headers.cookie.split("; ");
      var refresh_token = cookiearray[0].slice(13);
      var access_tokens = cookiearray[1].slice(12);
      const decoded = jwt.decode(refresh_token, { complete: true });
      const expirationTime = decoded.payload.exp;
      // Calculate the remaining time in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      const remainingTime = expirationTime - currentTime;
      console.log(
        "remaining---------------------------------------------->",
        remainingTime
      );
      if (access_tokens.length > 0) {
        jwt.verify(access_tokens, process.env.jwtsecret, function (err) {
          if (err)
            return res.status(403).send({ auth: false, message: err.message });
          else {
            var user = { username: req.body.data.root.session_id };
            res.status(200).cookie(
              "accesstoken",
              jwt.sign(
                user,
                process.env.jwtsecret,
                {
                  expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 24 hours
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
            next();
          }
        });
      } else {
        return res
          .status(403)
          .send({ auth: false, message: "No token provided." });
      }
    } catch (er) {
      console.log("hiii", er);
      return res.status(403).send({ auth: false, message: er });
    }
  },

  genaccesstoken: function (req, res, next) {
    var cookiearray = req.headers.cookie.split("; ");
    var refresh_token = cookiearray[0].slice(13);
    try {
      if (refresh_token.length > 0) {
        jwt.verify(refresh_token, process.env.jwtsecret, function (err) {
          if (err)
            return res.status(403).send({ auth: false, message: err.message });
          else {
            var user = { username: req.body.data.root.session_id };
            res.status(200).cookie(
              "accesstoken",
              jwt.sign(
                user,
                process.env.jwtsecret,
                {
                  expiresIn: process.env.ACCESS_TOKEN_LIFE, // expires in 24 hours
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
            next();
          }
        });
      } else {
        return res
          .status(403)
          .send({ auth: false, message: "No token provided." });
      }
    } catch (er) {
      console.log("hiii", er);
      return res.status(403).send({ auth: false, message: er });
    }
  },

  nativeType: function (value) {
    var nValue = Number(value);
    if (!isNaN(nValue)) {
      return nValue;
    }
    var bValue = value.toLowerCase();
    if (bValue === "true") {
      return true;
    } else if (bValue === "false") {
      return false;
    }
    return value;
  },

  sendMail: async function (
    fromEmail,
    ToEmail,
    ccEmail,
    subject,
    body,
    attachments
  ) {
    var mailConfig = {
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secureConnection: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
      //logger: true,
      //debug: true,
    };

    let transporter = nodemailer.createTransport(mailConfig);
    return transporter
      .sendMail({
        from: fromEmail, //config.Mailfrom,
        to: ToEmail,
        cc: ccEmail,
        subject: subject,
        generateTextFromHTML: true,
        html: body,
        attachments: attachments,
      })
      .then(() => {
        return true;
      })
      .catch((err) => {
        console.log(err);
        return false;
      });
  },

  generatePDF: async function (htmlContent) {
    try {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();

      await page.setContent(htmlContent);
      const pdfBuffer = await page.pdf({ format: "A4" });
      var filename = "pdf" + Date.now() + ".pdf";
      await browser.close();
      const currentDir = path.dirname(__dirname);
      const filePath = path.resolve(currentDir, "public/mail_attachments");
      if (!fs.existsSync(filePath)) {
        console.log("nopath");
        fs.mkdirSync(filePath);
      }
      fs.writeFileSync(filePath + "\\" + filename, pdfBuffer);

      return {
        status: true,
        path: currentDir + "\\public\\mail_attachments\\" + filename,
        filename: filename,
      };
    } catch (err) {
      console.log(err);
      return {
        status: false,
        message: err,
      };
    }
  },

  generateExcel: async function (xmlData, columnHeadings) {
    try {
      var filename = "Excel" + Date.now() + ".xlsx";

      const options = { compact: true, ignoreComment: true, spaces: 4 };
      const jsonData = xmlJs.xml2json(xmlData, options);
      const data = JSON.parse(jsonData).data.item;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data");

      // Set background color for cells with column headings
      const headingRow = worksheet.getRow(1);

      const headingRowStyle = {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "D3D3D3" },
        },
      };

      columnHeadings.forEach((heading, index) => {
        const cell = headingRow.getCell(index + 1);
        cell.value = heading;
        cell.style = headingRowStyle;
        worksheet.getColumn(index + 1).width = 15; // Adjust column width
      });

      data.forEach((item) => {
        const rowData = columnHeadings.map((heading) => {
          const key = heading.toLowerCase();
          return item.hasOwnProperty(key) ? item[key]._text : "";
        });
        worksheet.addRow(rowData);
      });
      worksheet.getRow(1).font = { bold: true };
      const currentDir = path.dirname(__dirname);
      const filePath = path.resolve(currentDir, "public/mail_attachments/");
      if (!fs.existsSync(filePath)) {
        console.log(filePath);
        fs.mkdirSync(filePath);
      }

      await workbook.xlsx.writeFile(filePath + "//" + filename);
      return {
        status: true,
        path: filePath + "\\" + filename,
        filename: filename,
      };
    } catch (error) {
      console.error("Error during Excel file generation:", error);
      return error;
    }
  },
};
