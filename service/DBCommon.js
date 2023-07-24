var config = require("./config");
const sql = require("mssql");
require('dotenv').config();
var jwt = {
  secret: process.env.jwtsecret,
};

async function CallSP(sp_name, xml) {
  console.log("SP", sp_name);
  console.log("XML", xml);
  let pool = await sql.connect(config.connectionString);
  var data = await pool
    .request()
    .input("SourceXML", sql.Xml, xml)
    .execute(sp_name);
  console.log(data);
  //await pool.close()
  return data.recordset[0].data || data.recordset[0][""];
}

async function CallMailSP(sp_name, xml) {
  console.log("SP", sp_name);
  console.log("XML", xml);
  let pool = await sql.connect(config.connectionString);
  var data = await pool
    .request()
    .input("SourceXML", sql.Xml, xml)
    .execute(sp_name);
  console.log(data);
  //await pool.close()
  return data.recordset;
}
module.exports = {
  CallSP: CallSP,
  CallMailSP: CallMailSP,
  jwt: jwt,
};
