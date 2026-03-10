const express = require("express");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(cors());

app.get("/", (req, res) => {
    res.send("✅ Node.js PDF Server Working");
});

app.post("/generate", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "No LaTeX content provided" });
        }

        const fileName = `resume-${Date.now()}`;
        const texPath = path.join(os.tmpdir(), `${fileName}.tex`);
        const pdfPath = path.join(os.tmpdir(), `${fileName}.pdf`);

        try {
            fs.writeFileSync(texPath, code);
        } catch (err) {
            console.error("❌ Failed to write .tex:", err);
            return res.status(500).json({ error: "Write failure" });
        }

        await new Promise((resolve, reject) => {
            const cmd = spawn("/usr/local/bin/tectonic", ["--outdir", "/tmp", texPath]);
            cmd.stdout.on("data", data => console.log(data.toString()));
            cmd.stderr.on("data", data => console.error(data.toString()));
            cmd.on("error", err => { console.error("❌ Spawn failed:", err); reject(err); });
            cmd.on("close", exit => {
                if (exit === 0) resolve();
                else reject(new Error("Tectonic failed with exit code " + exit));
            });
        });

        let pdfBuffer;
        try {
            pdfBuffer = fs.readFileSync(pdfPath);
        } catch (err) {
            console.error("❌ Failed to read PDF:", err);
            return res.status(500).json({ error: "PDF read error" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.send(pdfBuffer);

        try { fs.unlinkSync(texPath); } catch { }
        try { fs.unlinkSync(pdfPath); } catch { }

    } catch (err) {
        console.error("❌ SERVER ERROR:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

process.on("uncaughtException", err => console.error("❌ UNCAUGHT:", err));
process.on("unhandledRejection", err => console.error("❌ UNHANDLED:", err));

app.listen(3001, "0.0.0.0", () => {
    console.log("✅ PDF Server running on port 3001");
});