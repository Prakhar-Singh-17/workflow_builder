import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import chatRouter from "./routes/chat.js";

// .env lives at the project root (shared by both backend/ and frontend/),
// not inside this folder, so it has to be pointed to explicitly — dotenv's
// default only looks in the current working directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple health check route so we know the server is alive.
app.get("/", (req, res) => {
  res.json({ message: "Workflow builder server is running." });
});

app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
