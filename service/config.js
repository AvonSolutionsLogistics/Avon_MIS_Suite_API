require("dotenv").config();
module.exports = {
  connectionString : {
    server: process.env.SERVER,
    database: process.env.DATABASE,
    pool: {
      max: 100,
      min: 0,
      //idleTimeoutMillis: 50000
    },
    authentication: {
      type: "default",
      options: {
        userName: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
      },
    },
    options: {
      enableArithAbort: false,
      encrypt: true,
      trustServerCertificate: true,
    },
  },
};
