const admin = require("firebase-admin");
const serviceAccount = require("./recipes.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
