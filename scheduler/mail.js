const dbcontext = require("../service/DBCommon");
const helpers = require("../service/helper");
module.exports = {
  sendmail: async function () {
    try {
      var v_status = "";
      var result = await dbcontext.CallMailSP(
        "sch.get_scheduler_definition",
        "<root><session_id>228</session_id><sch_type>Mail</sch_type></root>"
      );

      if (result.length > 0) {
        result.forEach(async (element) => {
          var status = await helpers.sendMail(
            element.from_mail,
            element.to_mail,
            element.cc_mail,
            element.mail_subject,
            element.mail_body
          );
          if (status) {
            v_status = "Success";
          } else {
            v_status = "Failure";
          }
          var xml =
            "<root><session_id>" +
            228 +
            "</session_id><sch_seq_id>" +
            element.sch_seq_id +
            "</sch_seq_id><mail_status>" +
            v_status +
            "</mail_status><mail_responses></mail_responses></root>";
          var result = await dbcontext.CallMailSP(
            "sch.update_scheduler_definition",
            xml
          );
          return result;
        });
      }
    } catch (e) {
      console.log(e);
    }
  },
};
