
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// DATA STORAGE
// --------------------------------------------------

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]", "utf8");
}

function readHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, "utf8");
        return JSON.parse(data || "[]");
    } catch (error) {
        console.error("History read error:", error);
        return [];
    }
}

function saveHistory(history) {
    fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify(history, null, 2),
        "utf8"
    );
}

// --------------------------------------------------
// GEMINI INITIALIZATION
// --------------------------------------------------

let ai = null;

async function getGemini() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing from .env");
    }

    if (!ai) {
        const { GoogleGenAI } = await import("@google/genai");

        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    return ai;
}

// --------------------------------------------------
// MP3 ENCODER
// --------------------------------------------------

let lameModule = null;

async function getLameEncoder() {
    if (!lameModule) {
        const imported = await import("@breezystack/lamejs");

        if (typeof imported.Mp3Encoder === "function") {
            lameModule = imported;
        } else if (
            imported.default &&
            typeof imported.default.Mp3Encoder === "function"
        ) {
            lameModule = imported.default;
        } else {
            throw new Error(
                "Mp3Encoder was not found in the installed package. " +
                "Check @breezystack/lamejs installation."
            );
        }
    }

    return lameModule.Mp3Encoder;
}

// --------------------------------------------------
// WAV TO MP3 CONVERSION
// --------------------------------------------------

async function wavToMp3(wavBuffer) {
    const Mp3Encoder = await getLameEncoder();

    if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) {
        throw new Error("Invalid WAV audio data received.");
    }

    let offset = 12;
    let sampleRate = 24000;
    let channels = 1;
    let bitsPerSample = 16;
    let audioData = null;

    // Read WAV chunks
    while (offset + 8 <= wavBuffer.length) {
        const chunkId = wavBuffer.toString(
            "ascii",
            offset,
            offset + 4
        );

        const chunkSize = wavBuffer.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;
        const chunkEnd = chunkStart + chunkSize;

        if (chunkEnd > wavBuffer.length) {
            break;
        }

        if (chunkId === "fmt ") {
            channels = wavBuffer.readUInt16LE(chunkStart + 2);
            sampleRate = wavBuffer.readUInt32LE(chunkStart + 4);
            bitsPerSample = wavBuffer.readUInt16LE(chunkStart + 14);
        }

        if (chunkId === "data") {
            audioData = wavBuffer.subarray(
                chunkStart,
                chunkEnd
            );
            break;
        }

        offset = chunkEnd + (chunkSize % 2);
    }

    if (!audioData) {
        throw new Error("WAV audio data not found.");
    }

    if (bitsPerSample !== 16) {
        throw new Error("Only 16-bit PCM WAV audio is supported.");
    }

    if (channels !== 1 && channels !== 2) {
        throw new Error("Only mono and stereo audio are supported.");
    }

    const encoder = new Mp3Encoder(
        channels,
        sampleRate,
        128
    );

    const totalSamples = Math.floor(
        audioData.length / (2 * channels)
    );

    const left = new Int16Array(totalSamples);

    const right = channels === 2
        ? new Int16Array(totalSamples)
        : null;

    // Convert WAV bytes to PCM samples
    for (let i = 0; i < totalSamples; i++) {
        left[i] = audioData.readInt16LE(
            i * channels * 2
        );

        if (channels === 2) {
            right[i] = audioData.readInt16LE(
                i * 4 + 2
            );
        }
    }

    const mp3Chunks = [];
    const blockSize = 1152;

    // Encode PCM samples
    for (let i = 0; i < totalSamples; i += blockSize) {
        const leftBlock = left.subarray(
            i,
            Math.min(i + blockSize, totalSamples)
        );

        let encoded;

        if (channels === 2) {
            const rightBlock = right.subarray(
                i,
                Math.min(i + blockSize, totalSamples)
            );

            encoded = encoder.encodeBuffer(
                leftBlock,
                rightBlock
            );
        } else {
            encoded = encoder.encodeBuffer(leftBlock);
        }

        if (encoded.length > 0) {
            mp3Chunks.push(Buffer.from(encoded));
        }
    }

    // Flush remaining audio
    const finalChunk = encoder.flush();

    if (finalChunk.length > 0) {
        mp3Chunks.push(Buffer.from(finalChunk));
    }

    const result = Buffer.concat(mp3Chunks);

    if (result.length === 0) {
        throw new Error("MP3 conversion produced empty audio.");
    }

    return result;
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        application: "STANDWAVE",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        timestamp: new Date().toISOString()
    });
});

// --------------------------------------------------
// HISTORY ROUTES
// --------------------------------------------------

app.get("/api/history", (req, res) => {
    res.json(readHistory());
});

app.post("/api/history", (req, res) => {
    try {
        const { type, title, content } = req.body;

        if (!type || !content) {
            return res.status(400).json({
                error: "Type and content are required."
            });
        }

        const history = readHistory();

        const entry = {
            id: Date.now().toString(),
            type,
            title: title || "Untitled",
            content,
            date: new Date().toISOString()
        };

        history.unshift(entry);

        saveHistory(history.slice(0, 100));

        res.json({
            success: true,
            entry
        });

    } catch (error) {
        console.error("History save error:", error);

        res.status(500).json({
            error: "Could not save history."
        });
    }
});

app.delete("/api/history", (req, res) => {
    try {
        saveHistory([]);

        res.json({
            success: true,
            message: "History cleared."
        });

    } catch (error) {
        console.error("History delete error:", error);

        res.status(500).json({
            error: "Could not clear history."
        });
    }
});

// --------------------------------------------------
// AI STUDY ASSISTANT
// --------------------------------------------------

app.post("/api/study", async (req, res) => {
    try {
        const { text, task } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Please provide some text."
            });
        }

        const gemini = await getGemini();

        const prompts = {
            summary:
                "Create a clear and easy-to-understand summary of the following text. Preserve the important information.",

            keypoints:
                "Extract the most important key points from the following text. Present them as organized bullet points.",

            quiz:
                "Create a quiz based on the following text. Include 10 questions and their correct answers.",

            flashcards:
                "Create useful study flashcards from the following text. Format each as a question followed by its answer."
        };

        const instruction = prompts[task] || prompts.summary;

        const response = await gemini.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-flash-latest",

            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `${instruction}\n\nTEXT:\n${text}`
                        }
                    ]
                }
            ]
        });

        const result = response.text;

        if (!result) {
            throw new Error("Gemini returned an empty response.");
        }

        res.json({
            success: true,
            result
        });

    } catch (error) {
        console.error("Study assistant error:", error);

        res.status(500).json({
            error: error.message || "Study assistant failed."
        });
    }
});

// --------------------------------------------------
// GEMINI TEXT TO SPEECH - MP3
// --------------------------------------------------

app.post("/api/tts/mp3", async (req, res) => {
    try {
        const { text, language, voice } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Please enter text to convert."
            });
        }

        const gemini = await getGemini();

        const selectedVoice = voice || "Kore";

        const response = await gemini.interactions.create({
            model: process.env.GEMINI_TTS_MODEL ||
                "gemini-3.8-flash-tts",

            input: [
                {
                    type: "user_input",
                    content: [
                        {
                            type: "text",
                            text,
                            annotations: [
                                {
                                    type: "speech_metadata",
                                    style:
                                        `Speak naturally in ${language || "English"}.`
                                }
                            ]
                        }
                    ]
                }
            ],

            response_format: {
                type: "audio"
            },

            generation_config: {
                speech_config: [
                    {
                        voice: selectedVoice
                    }
                ]
            }
        });

        const audioData = response.output_audio?.data;

        if (!audioData) {
            throw new Error(
                "Gemini did not return audio data."
            );
        }

        const wavBuffer = Buffer.from(
            audioData,
            "base64"
        );

        const mp3Buffer = await wavToMp3(wavBuffer);

        res.setHeader(
            "Content-Type",
            "audio/mpeg"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="standwave-speech.mp3"'
        );

        res.setHeader(
            "Content-Length",
            mp3Buffer.length
        );

        res.send(mp3Buffer);

    } catch (error) {
        console.error("MP3 generation error:", error);

        res.status(500).json({
            error: "MP3 generation failed: " + error.message
        });
    }
});

// --------------------------------------------------
// SCRIPT ENHANCER
// --------------------------------------------------

app.post("/api/enhance", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Please provide text to enhance."
            });
        }

        const gemini = await getGemini();

        const response = await gemini.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-flash-latest",

            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text:
                                "Improve the grammar, punctuation, clarity, and flow of the following text. Preserve its original meaning and language. Return only the improved text.\n\n" +
                                text
                        }
                    ]
                }
            ]
        });

        res.json({
            success: true,
            result: response.text || ""
        });

    } catch (error) {
        console.error("Enhancer error:", error);

        res.status(500).json({
            error: error.message || "Text enhancement failed."
        });
    }
});

// --------------------------------------------------
// FRONTEND
// --------------------------------------------------

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// --------------------------------------------------
// SERVER START
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
    console.log("-----------------------------------");
    console.log("       STANDWAVE SERVER");
    console.log("-----------------------------------");

    console.log(
        `Server running at http://localhost:${PORT}`
    );

    console.log(
        `Gemini API: ${
            process.env.GEMINI_API_KEY
                ? "Configured"
                : "Missing API key"
        }`
    );

    console.log("-----------------------------------");
});
