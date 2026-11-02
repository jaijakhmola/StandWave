const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let selectedMode = "summary";
let recognition = null;
let finalTranscript = "";
let mp3ObjectUrl = null;

// =====================================
// NOTIFICATIONS
// =====================================

function toast(message) {

    const el = $("#toast");

    el.textContent = message;
    el.classList.add("show");

    setTimeout(() => {
        el.classList.remove("show");
    }, 3000);
}

// =====================================
// API HELPER
// =====================================

async function api(url, options = {}) {

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json"
        },
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error || "Something went wrong."
        );
    }

    return data;
}

// =====================================
// HTML ESCAPING
// =====================================

function escapeHtml(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// =====================================
// NAVIGATION
// =====================================

function go(page) {

    $$(".page").forEach(p => {
        p.classList.toggle(
            "active",
            p.id === `page-${page}`
        );
    });

    $$(".nav-link").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    const names = {
        dashboard: "Overview",
        tts: "Text to Speech",
        transcribe: "Live Transcriber",
        study: "AI Study Assistant",
        enhancer: "Script Enhancer",
        history: "History & Logs"
    };

    $("#pageName").textContent = names[page] || page;

    if (page === "history") {
        loadHistory();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

$$(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
        go(button.dataset.page);
    });
});

$$("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        go(button.dataset.go);
    });
});

$$("[data-open]").forEach(button => {
    button.addEventListener("click", () => {
        go(button.dataset.open);
    });
});

// =====================================
// BACKEND STATUS
// =====================================

async function checkBackend() {

    try {

        const health = await api("/api/health");

        $("#apiStatus").textContent =
            health.geminiConfigured
                ? "Gemini ready"
                : "Server online";

        $("#apiStatus").style.color =
            health.geminiConfigured
                ? "#7ce0b2"
                : "#e9bd65";

    } catch {

        $("#apiStatus").textContent = "Offline";
        $("#apiStatus").style.color = "#f58ab7";
    }
}

// =====================================
// ACTIVITY LOGGING
// =====================================

async function log(type, title, detail = "") {

    try {

        await api("/api/history", {
            method: "POST",

            body: JSON.stringify({
                type,
                title,
                detail
            })
        });

    } catch (error) {

        console.warn(
            "Could not save activity:",
            error.message
        );
    }

    loadRecent();
}

function dateLabel(date) {

    return new Date(date).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

// =====================================
// RECENT ACTIVITY
// =====================================

async function loadRecent() {

    try {

        const items = await api("/api/history");

        $("#recentList").innerHTML = items
            .slice(0, 4)
            .map(item => `
                <div class="recent-item">
                    <div>
                        <b>${escapeHtml(item.title)}</b>
                        <small>${escapeHtml(item.type)}</small>
                    </div>

                    <small>${dateLabel(item.createdAt)}</small>
                </div>
            `)
            .join("") ||
            '<p class="muted">No activity yet. Start using a module.</p>';

    } catch (error) {
        console.warn(error.message);
    }
}

// =====================================
// COMPLETE HISTORY
// =====================================

async function loadHistory() {

    try {

        const items = await api("/api/history");

        $("#historyList").innerHTML = items
            .map(item => `
                <div class="history-item">

                    <div>
                        <b>${escapeHtml(item.title)}</b>

                        <small>
                            ${escapeHtml(item.type)}
                            ·
                            ${escapeHtml(item.detail || "")}
                        </small>
                    </div>

                    <small>${dateLabel(item.createdAt)}</small>

                </div>
            `)
            .join("") ||
            '<p class="muted">No saved activity yet.</p>';

    } catch (error) {

        $("#historyList").textContent = error.message;
    }
}

// =====================================
// MULTI-LANGUAGE CATALOGUE
// =====================================

const languages = [

    ["af-ZA", "Afrikaans"],
    ["sq-AL", "Albanian"],
    ["am-ET", "Amharic"],
    ["ar-SA", "Arabic"],
    ["hy-AM", "Armenian"],
    ["as-IN", "Assamese"],
    ["az-AZ", "Azerbaijani"],
    ["eu-ES", "Basque"],
    ["be-BY", "Belarusian"],
    ["bn-IN", "Bengali"],
    ["bs-BA", "Bosnian"],
    ["bg-BG", "Bulgarian"],
    ["my-MM", "Burmese"],
    ["ca-ES", "Catalan"],
    ["zh-CN", "Chinese (Simplified)"],
    ["zh-TW", "Chinese (Traditional)"],
    ["hr-HR", "Croatian"],
    ["cs-CZ", "Czech"],
    ["da-DK", "Danish"],
    ["nl-NL", "Dutch"],

    ["en-US", "English (United States)"],
    ["en-GB", "English (United Kingdom)"],
    ["en-IN", "English (India)"],
    ["en-AU", "English (Australia)"],
    ["en-CA", "English (Canada)"],

    ["et-EE", "Estonian"],
    ["fil-PH", "Filipino"],
    ["fi-FI", "Finnish"],
    ["fr-FR", "French"],
    ["fr-CA", "French (Canada)"],
    ["gl-ES", "Galician"],
    ["ka-GE", "Georgian"],
    ["de-DE", "German"],
    ["el-GR", "Greek"],
    ["gu-IN", "Gujarati"],
    ["he-IL", "Hebrew"],
    ["hi-IN", "Hindi"],
    ["hu-HU", "Hungarian"],
    ["is-IS", "Icelandic"],
    ["id-ID", "Indonesian"],
    ["ga-IE", "Irish"],
    ["it-IT", "Italian"],
    ["ja-JP", "Japanese"],
    ["jv-ID", "Javanese"],
    ["kn-IN", "Kannada"],
    ["kk-KZ", "Kazakh"],
    ["km-KH", "Khmer"],
    ["ko-KR", "Korean"],
    ["lo-LA", "Lao"],
    ["lv-LV", "Latvian"],
    ["lt-LT", "Lithuanian"],
    ["mk-MK", "Macedonian"],
    ["ms-MY", "Malay"],
    ["ml-IN", "Malayalam"],
    ["mt-MT", "Maltese"],
    ["mr-IN", "Marathi"],
    ["mn-MN", "Mongolian"],
    ["ne-NP", "Nepali"],
    ["no-NO", "Norwegian"],
    ["or-IN", "Odia"],
    ["ps-AF", "Pashto"],
    ["fa-IR", "Persian"],
    ["pl-PL", "Polish"],
    ["pt-BR", "Portuguese (Brazil)"],
    ["pt-PT", "Portuguese (Portugal)"],
    ["pa-IN", "Punjabi"],
    ["ro-RO", "Romanian"],
    ["ru-RU", "Russian"],
    ["sr-RS", "Serbian"],
    ["si-LK", "Sinhala"],
    ["sk-SK", "Slovak"],
    ["sl-SI", "Slovenian"],
    ["so-SO", "Somali"],
    ["es-ES", "Spanish"],
    ["es-MX", "Spanish (Mexico)"],
    ["sw-KE", "Swahili"],
    ["sv-SE", "Swedish"],
    ["ta-IN", "Tamil"],
    ["te-IN", "Telugu"],
    ["th-TH", "Thai"],
    ["tr-TR", "Turkish"],
    ["uk-UA", "Ukrainian"],
    ["ur-PK", "Urdu"],
    ["uz-UZ", "Uzbek"],
    ["vi-VN", "Vietnamese"],
    ["cy-GB", "Welsh"],
    ["zu-ZA", "Zulu"]
];

// =====================================
// POPULATE LANGUAGE DROPDOWNS
// =====================================

function populateLanguageOptions() {

    const tts = $("#ttsLang");
    const stt = $("#sttLang");

    const previousTts = tts.value || "en-US";
    const previousStt = stt.value || "en-US";

    tts.innerHTML = "";
    stt.innerHTML = "";

    languages.forEach(([code, name]) => {

        const ttsOption = new Option(
            name,
            code
        );

        const sttOption = new Option(
            name,
            code
        );

        tts.add(ttsOption);
        stt.add(sttOption);
    });

    tts.value = languages.some(
        ([code]) => code === previousTts
    ) ? previousTts : "en-US";

    stt.value = languages.some(
        ([code]) => code === previousStt
    ) ? previousStt : "en-US";
}

populateLanguageOptions();

// =====================================
// BROWSER TEXT TO SPEECH
// =====================================

if ("speechSynthesis" in window) {

    function populateVoices() {

        const voices = speechSynthesis.getVoices();

        const lang = $("#ttsLang").value;

        const select = $("#ttsVoice");

        const current = select.value;

        select.innerHTML =
            '<option value="">Default system voice</option>';

        voices
            .filter(voice =>
                voice.lang.toLowerCase().startsWith(
                    lang.slice(0, 2).toLowerCase()
                )
            )
            .forEach(voice => {

                const option = new Option(
                    `${voice.name} (${voice.lang})`,
                    voice.name
                );

                select.add(option);
            });

        if ([...select.options].some(
            option => option.value === current
        )) {
            select.value = current;
        }
    }

    speechSynthesis.onvoiceschanged = populateVoices;

    populateVoices();

    $("#ttsLang").addEventListener(
        "change",
        populateVoices
    );

} else {

    $("#speechMessage").textContent =
        "Speech synthesis is not supported by this browser.";
}

// =====================================
// SPEECH RATE AND PITCH
// =====================================

$("#ttsRate").addEventListener("input", event => {

    $("#rateOut").textContent =
        `${Number(event.target.value).toFixed(1)}×`;
});

$("#ttsPitch").addEventListener("input", event => {

    $("#pitchOut").textContent =
        Number(event.target.value).toFixed(1);
});

// =====================================
// GENERATE BROWSER SPEECH
// =====================================

$("#speakBtn").addEventListener("click", () => {

    const text = $("#ttsText").value.trim();

    if (!text) {
        return toast("Enter some text first.");
    }

    if (!("speechSynthesis" in window)) {
        return toast("Speech synthesis is not supported here.");
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = $("#ttsLang").value;

    utterance.rate = Number($("#ttsRate").value);

    utterance.pitch = Number($("#ttsPitch").value);

    const selectedVoice = speechSynthesis
        .getVoices()
        .find(voice => voice.name === $("#ttsVoice").value);

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {

        $("#speechState").textContent =
            "SPEECH IN PROGRESS";

        $("#speechMessage").textContent =
            "Your browser is speaking the text.";

        $("#wave").classList.add("playing");
    };

    utterance.onend = () => {

        $("#speechState").textContent =
            "PLAYBACK COMPLETE";

        $("#speechMessage").textContent =
            "Ready for your next script.";

        $("#wave").classList.remove("playing");

        log(
            "Text to Speech",
            "Played browser speech",
            `${text.length} characters · ${$("#ttsLang").value}`
        );
    };

    utterance.onerror = () => {

        $("#wave").classList.remove("playing");

        toast("Speech playback could not start.");
    };

    speechSynthesis.speak(utterance);
});

// =====================================
// STOP BROWSER SPEECH
// =====================================

$("#stopSpeak").addEventListener("click", () => {

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    $("#wave").classList.remove("playing");

    $("#speechState").textContent =
        "PLAYBACK STOPPED";
});

// =====================================
// GEMINI MP3 GENERATION
// =====================================

$("#downloadMp3Btn").addEventListener(
    "click",
    async () => {

        const text = $("#ttsText").value.trim();

        if (!text) {
            return toast("Enter some text first.");
        }

        if (text.length > 5000) {
            return toast("Keep MP3 text under 5,000 characters.");
        }

        const button = $("#downloadMp3Btn");

        button.disabled = true;

        button.textContent = "GENERATING MP3...";

        $("#speechState").textContent =
            "GENERATING YOUR MP3";

        $("#speechMessage").textContent =
            "Gemini is creating your audio. Please wait.";

        try {

            const response = await fetch(
                "/api/tts/mp3",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        text,

                        language: $("#ttsLang").value,

                        voice: $("#ttsAiVoice").value
                    })
                }
            );

            if (!response.ok) {

                const error = await response
                    .json()
                    .catch(() => ({}));

                throw new Error(
                    error.error || "MP3 generation failed."
                );
            }

            const blob = await response.blob();

            if (!blob.size || blob.type !== "audio/mpeg") {

                throw new Error(
                    "The server did not return a valid MP3 file."
                );
            }

            if (mp3ObjectUrl) {
                URL.revokeObjectURL(mp3ObjectUrl);
            }

            mp3ObjectUrl = URL.createObjectURL(blob);

            // Show audio preview

            const preview = $("#mp3Preview");

            preview.src = mp3ObjectUrl;

            preview.hidden = false;

            preview.load();

            // Download MP3

            const downloadLink =
                document.createElement("a");

            downloadLink.href = mp3ObjectUrl;

            downloadLink.download =
                "standwave-speech.mp3";

            document.body.appendChild(downloadLink);

            downloadLink.click();

            downloadLink.remove();

            $("#speechState").textContent =
                "MP3 READY";

            $("#speechMessage").textContent =
                "Your MP3 has downloaded. You can preview it below.";

            toast("MP3 downloaded successfully.");

            loadRecent();

        } catch (error) {

            console.error(error);

            $("#speechState").textContent =
                "MP3 GENERATION FAILED";

            $("#speechMessage").textContent =
                error.message;

            toast(error.message);

        } finally {

            button.disabled = false;

            button.textContent =
                "↓ DOWNLOAD MP3";
        }
    }
);

// =====================================
// LIVE TRANSCRIBER
// =====================================

function updateTranscriptCounts() {

    const value = $("#transcript").value.trim();

    $("#wordCount").textContent =
        `${value ? value.split(/\s+/).length : 0} words`;

    $("#charCount").textContent =
        `${$("#transcript").value.length} characters`;
}

$("#transcript").addEventListener(
    "input",
    updateTranscriptCounts
);

// =====================================
// SPEECH RECOGNITION
// =====================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.onresult = event => {

        let interim = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const phrase =
                event.results[i][0].transcript;

            if (event.results[i].isFinal) {

                finalTranscript += phrase + " ";

            } else {

                interim += phrase;
            }
        }

        $("#transcript").value =
            finalTranscript + interim;

        updateTranscriptCounts();
    };

    recognition.onerror = event => {

        toast(`Recognition error: ${event.error}`);

        setRecording(false);
    };

    recognition.onend = () => {
        setRecording(false);
    };

} else {

    $("#startRecord").disabled = true;

    $("#startRecord").title =
        "Speech recognition is not supported by this browser.";

    $("#recordStatus").textContent =
        "BROWSER NOT SUPPORTED";
}

// =====================================
// RECORDING STATUS
// =====================================

function setRecording(active) {

    $("#recordStatus").classList.toggle(
        "recording",
        active
    );

    $("#recordStatus").innerHTML = `
        <i></i>
        ${active ? "LISTENING NOW" : "NOT RECORDING"}
    `;

    $("#startRecord").textContent = active
        ? "● LISTENING..."
        : "● START LISTENING";
}

// =====================================
// START TRANSCRIPTION
// =====================================

$("#startRecord").addEventListener("click", () => {

    if (!recognition) {
        return toast("Speech recognition is unavailable in this browser.");
    }

    finalTranscript = $("#transcript").value.trim()
        ? $("#transcript").value.trim() + " "
        : "";

    recognition.lang = $("#sttLang").value;

    try {

        recognition.start();

        setRecording(true);

    } catch {

        toast("Recognition is already running.");
    }
});

// =====================================
// STOP TRANSCRIPTION
// =====================================

$("#stopRecord").addEventListener("click", () => {

    if (recognition) {
        recognition.stop();
    }

    setRecording(false);

    log(
        "Transcription",
        "Stopped live transcription",
        `${$("#transcript").value.length} characters`
    );
});

// =====================================
// COPY TRANSCRIPT
// =====================================

$("#copyTranscript").addEventListener(
    "click",
    async () => {

        const text = $("#transcript").value;

        if (!text) {
            return toast("There is no transcript to copy.");
        }

        try {

            await navigator.clipboard.writeText(text);

            toast("Transcript copied.");

        } catch {

            toast("Clipboard access was blocked by the browser.");
        }
    }
);

// =====================================
// DOWNLOAD TRANSCRIPT
// =====================================

$("#downloadTranscript").addEventListener("click", () => {

    const text = $("#transcript").value;

    if (!text) {
        return toast("There is no transcript to download.");
    }

    const url = URL.createObjectURL(
        new Blob(
            [text],
            { type: "text/plain;charset=utf-8" }
        )
    );

    const link = document.createElement("a");

    link.href = url;

    link.download = "standwave-transcript.txt";

    link.click();

    URL.revokeObjectURL(url);

    log(
        "Transcription",
        "Exported transcript",
        "TXT file"
    );
});

// =====================================
// AI STUDY ASSISTANT MODES
// =====================================

$$(".mode-btn").forEach(button => {

    button.addEventListener("click", () => {

        $$(".mode-btn").forEach(item => {
            item.classList.remove("selected");
        });

        button.classList.add("selected");

        selectedMode = button.dataset.mode;
    });
});

// =====================================
// GENERATE STUDY MATERIAL
// =====================================

$("#studyBtn").addEventListener(
    "click",
    async () => {

        const text = $("#studyText").value.trim();

        if (text.length < 30) {
            return toast("Please enter at least 30 characters of notes.");
        }

        const button = $("#studyBtn");

        button.disabled = true;

        button.textContent = "GENERATING...";

        try {

            const data = await api(
                "/api/study",
                {
                    method: "POST",

                    body: JSON.stringify({
                        text,
                        mode: selectedMode
                    })
                }
            );

            $("#studyResult").classList.remove(
                "empty-result"
            );

            $("#studyResult").innerHTML = `
                <h3>${escapeHtml(data.heading)}</h3>

                <div class="ai-answer">
                    ${escapeHtml(data.content)}
                </div>

                <p class="hint">
                    ${escapeHtml(data.note || "Review the generated material before your exam.")}
                </p>
            `;

            toast("Study material generated.");

        } catch (error) {

            toast(error.message);

        } finally {

            button.disabled = false;

            button.textContent =
                "✧ GENERATE STUDY MATERIAL";
        }
    }
);

// =====================================
// SCRIPT ENHANCER
// =====================================

$("#enhanceBtn").addEventListener(
    "click",
    async () => {

        const text = $("#enhanceInput").value.trim();

        if (!text) {
            return toast("Enter a script first.");
        }

        const button = $("#enhanceBtn");

        button.disabled = true;

        try {

            const data = await api(
                "/api/enhance",
                {
                    method: "POST",

                    body: JSON.stringify({ text })
                }
            );

            $("#enhancedOutput").textContent =
                data.enhanced;

            toast("Script refined.");

        } catch (error) {

            toast(error.message);

        } finally {

            button.disabled = false;
        }
    }
);

// =====================================
// COPY ENHANCED SCRIPT
// =====================================

$("#copyEnhanced").addEventListener(
    "click",
    async () => {

        const text =
            $("#enhancedOutput").textContent;

        if (
            !text ||
            text.startsWith("Your refined")
        ) {
            return toast("Nothing to copy.");
        }

        try {

            await navigator.clipboard.writeText(text);

            toast("Enhanced script copied.");

        } catch {

            toast("Clipboard access was blocked.");
        }
    }
);

// =====================================
// SEND SCRIPT TO TEXT TO SPEECH
// =====================================

$("#useEnhanced").addEventListener("click", () => {

    const text =
        $("#enhancedOutput").textContent;

    if (
        !text ||
        text.startsWith("Your refined")
    ) {
        return toast("Enhance a script first.");
    }

    $("#ttsText").value = text;

    go("tts");

    toast("Script moved to Text to Speech.");
});

// =====================================
// CLEAR HISTORY
// =====================================

$("#clearHistory").addEventListener(
    "click",
    async () => {

        if (!confirm("Clear all saved activity history?")) {
            return;
        }

        try {

            await api(
                "/api/history",
                { method: "DELETE" }
            );

            await loadHistory();

            await loadRecent();

            toast("History cleared.");

        } catch (error) {

            toast(error.message);
        }
    }
);

// =====================================
// INITIALIZE APPLICATION
// =====================================

checkBackend();

loadRecent();