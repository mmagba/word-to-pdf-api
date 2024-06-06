import express, { Request, Response } from "express";
import multer from "multer";
import fs, { constants } from "fs";
import convertToPdf from "./convertToPdf";
import formatDate from "./dateFormatting";
import cors from "cors";
interface CustomRequest extends Request {
    file?: Express.Multer.File;
    newFilename?: string;
}

const app = express();
const port = 4000;


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = "uploads/";

        fs.access(uploadDir, constants.R_OK | constants.W_OK, (err) => {
            if (err) {
                try {
                    fs.mkdirSync(uploadDir, { recursive: true });
                    cb(null, uploadDir);
                } catch (mkdirErr) {
                    console.error(`Error creating directory: ${uploadDir}`, mkdirErr);

                    if (mkdirErr instanceof Error) {
                        cb(mkdirErr, uploadDir);
                    } else {
                        cb(new Error("Failed to create directory"), uploadDir);
                    }
                }
            } else {
                cb(null, uploadDir);
            }
        });
    },

    filename: function (req: CustomRequest, file, cb) {
        const fileExtensionRegex = /\.[0-9a-z]+$/i;
        const baseName = file.originalname.replace(fileExtensionRegex, "");
        const newFilename = `${baseName} - ${formatDate(new Date())}`;
        req.newFilename = newFilename;
        cb(null, newFilename);
    },
});

const upload = multer({ storage: storage });

const corsOptions = {
    origin: ['https://pdf-tool-ten.vercel.app', 'http://localhost:3000'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.post(
    "/convert",
    upload.single("file"),
    (req: CustomRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).send("No file uploaaaaded.");
        }
        console.log('hello');
        const fileExtension = req.file.originalname.split(".").pop();
        if (fileExtension !== "doc" && fileExtension !== "docx") {
            return res
                .status(400)
                .send("Invalid file type. Please upload a .doc or .docx file.");
        }

        const filePath = req.file.path;

        convertToPdf(filePath, (err, convertedFilePath) => {
            if (err) {
                console.error("Error converting file:", err);
                return res.status(500).send("Error converting file");
            }

            const filename = req.newFilename
                ? `${req.newFilename}.pdf`
                : "default_filename.pdf";

            res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

            if (!convertedFilePath) {
                console.error("Conversion did not return a file path.");
                return res
                    .status(500)
                    .send("File conversion did not return a valid path.");
            }

            console.log("Converted file path:", convertedFilePath);

            if (!req.newFilename) {
                console.error("No new filename set.");
                return res.status(500).send("No new filename set.");
            }

            res.download(convertedFilePath, req.newFilename, (downloadErr) => {
                if (downloadErr) {
                    console.error("Error downloading file:", downloadErr);
                    res.status(500).send("Error downloading file");
                } else {
                    fs.unlinkSync(convertedFilePath);
                }
            });
        });
    }
);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});