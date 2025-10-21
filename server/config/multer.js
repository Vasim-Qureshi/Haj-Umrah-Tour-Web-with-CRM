// server/config/multer.js
import multer from "multer";
import path from "path";
import fs from "fs-extra";

const uploadDir = path.resolve(process.cwd(), "tmp/uploads");
fs.ensureDirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

export const upload = multer({ storage });
