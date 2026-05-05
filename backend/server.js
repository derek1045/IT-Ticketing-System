require("dotenv").config();
const express = require("express");
const pool = require("./db");
const cors = require("cors");
const { initializeSchema, seedDemoData } = require("./schema");
const { registerHttpRoutes } = require("./httpRoutes");

const app = express();

app.use(cors());
app.use(express.json());

registerHttpRoutes(app, pool);

async function bootstrap() {
  await initializeSchema(pool);
  await seedDemoData(pool);
}

if (require.main === module) {
  bootstrap()
    .then(() => {
      app.listen(3000, () => {
        console.log("Server running on http://localhost:3000");
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

module.exports = { app, bootstrap, pool };
