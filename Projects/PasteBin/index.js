import express from "express";
import crypto from "crypto";
import {
    saveTextContentToDatabase,
    getTextContentByShort,
    recordClickInDb
} from "./textService.js";

const app = express();
const PORT = 9000;

app.use(express.json());
app.use(express.static("public"));

function generateShortURL(textContent) {
    const hash = crypto
        .createHash("sha256")
        .update(textContent)
        .digest("hex");

    return hash.slice(0, 8);
}


/*
 * Escape HTML so pasted content is rendered
 * as text and not interpreted as HTML/JavaScript.
 */
function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.post("/api/v1/data", async (req, res) => {
    const { textContent } = req.body;

    if (!textContent) {
        return res.status(400).json({
            error: "No text content provided"
        });
    }

    try {
        const shortURL = generateShortURL(textContent);
        await saveTextContentToDatabase(
            textContent,
            shortURL
        );
        return res.status(201).json({
            shortURL: `http://localhost:${PORT}/${shortURL}`
        });
    } catch (err) {
        console.error("Error creating paste:", err);
        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

app.get("/:shortURL", async (req, res) => {
    const { shortURL } = req.params;
    try {
        const textContent =
            await getTextContentByShort(shortURL);
        if (!textContent) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    >
                    <title>Paste Not Found</title>
                </head>
                <body>
                    <h1>Paste Not Found</h1>
                    <p>
                        The paste you're looking for does not exist.
                    </p>
                </body>
                </html>
            `);
        }

        await recordClickInDb({
            shortURL,
            longURL: textContent,
            req
        });
        const safeContent = escapeHTML(textContent);
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >
                <title>Paste — ${shortURL}</title>
                <style>
                    @import url(
                        'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
                    );
                    :root {
                        --forest-950: #18251f;
                        --forest-900: #1d3027;
                        --forest-800: #274536;
                        --forest-700: #315b45;
                        --forest-600: #416b52;
                        --cream: #f5f1e7;
                        --text: #1c2c24;
                        --text-muted: #627068;
                        --border: rgba(255, 255, 255, 0.58);
                        --shadow:
                            0 30px 80px rgba(25, 42, 33, 0.30),
                            0 8px 30px rgba(25, 42, 33, 0.15);
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: "DM Sans", sans-serif;
                        color: var(--text);
                        background-image:
                            linear-gradient(
                                135deg,
                                rgba(31, 47, 39, 0.20),
                                rgba(31, 47, 39, 0.05) 45%,
                                rgba(20, 35, 28, 0.25)
                            ),
                            url("/img.jpg");
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;
                        background-attachment: fixed;
                        padding: 30px;
                    }
                    body::before {
                        content: "";
                        position: fixed;
                        inset: 0;
                        pointer-events: none;
                        background:
                            radial-gradient(
                                circle at 20% 20%,
                                rgba(255, 245, 220, 0.25),
                                transparent 35%
                            ),
                            radial-gradient(
                                circle at 85% 75%,
                                rgba(54, 91, 68, 0.20),
                                transparent 35%
                            );
                        z-index: -1;
                    }
                    .page {
                        width: 100%;
                        max-width: 1000px;
                        margin: 0 auto;
                    }
                    .container {
                        position: relative;
                        padding: 34px;
                        border-radius: 28px;
                        background:
                            linear-gradient(
                                145deg,
                                rgba(255, 252, 243, 0.72),
                                rgba(236, 233, 220, 0.52)
                            );
                        border: 1px solid var(--border);
                        backdrop-filter: blur(24px) saturate(120%);
                        -webkit-backdrop-filter:
                            blur(24px) saturate(120%);
                        box-shadow: var(--shadow);
                        overflow: hidden;
                        animation:
                            cardIn 0.6s
                            cubic-bezier(.2,.8,.2,1);
                    }
                    .container::before {
                        content: "";
                        position: absolute;
                        top: -120px;
                        left: -120px;
                        width: 280px;
                        height: 280px;
                        border-radius: 50%;
                        background:
                            rgba(255, 255, 255, 0.28);
                        filter: blur(20px);
                        pointer-events: none;
                    }
                    .content {
                        position: relative;
                        z-index: 1;
                    }
                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 20px;
                        margin-bottom: 22px;
                    }
                    .brand {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .logo {
                        width: 42px;
                        height: 42px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 13px;
                        background:
                            var(--forest-800);
                        color: var(--cream);
                        font-size: 16px;
                        font-weight: 700;
                        box-shadow:
                            0 8px 20px
                            rgba(39, 69, 54, 0.28);
                    }
                    .brand-name {
                        color: var(--forest-950);
                        font-size: 17px;
                        font-weight: 700;
                    }
                    .paste-id {
                        color: var(--text-muted);
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .copy-btn {
                        height: 42px;
                        padding: 0 17px;
                        border: 0;
                        border-radius: 12px;
                        background:
                            var(--forest-800);
                        color: white;
                        font-family: inherit;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition:
                            transform 0.2s ease,
                            background 0.2s ease;
                    }
                    .copy-btn:hover {
                        background:
                            var(--forest-900);
                        transform:
                            translateY(-1px);
                    }
                    .paste {
                        position: relative;
                        overflow: auto;
                        min-height: 300px;
                        max-height: 70vh;
                        padding: 24px;
                        border-radius: 18px;
                        background:
                            rgba(24, 37, 31, 0.94);
                        border:
                            1px solid
                            rgba(255, 255, 255, 0.10);
                        box-shadow:
                            inset 0 1px 2px
                            rgba(0, 0, 0, 0.10);
                    }
                    pre {
                        margin: 0;
                        color: #e9eee9;
                        font-family:
                            "SFMono-Regular",
                            Consolas,
                            "Liberation Mono",
                            monospace;
                        font-size: 14px;
                        line-height: 1.65;
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                    }
                    .footer {
                        margin-top: 18px;
                        display: flex;
                        justify-content: space-between;
                        color:
                            rgba(55, 70, 61, 0.62);
                        font-size: 12px;
                    }
                    .footer span {
                        color: var(--forest-700);
                        font-weight: 600;
                    }
                    @keyframes cardIn {
                        from {
                            opacity: 0;
                            transform:
                                translateY(20px)
                                scale(0.98);
                        }
                        to {
                            opacity: 1;
                            transform:
                                translateY(0)
                                scale(1);
                        }
                    }
                    @media (max-width: 600px) {
                        body {
                            padding: 16px;
                        }
                        .container {
                            padding: 20px;
                            border-radius: 22px;
                        }
                        .header {
                            align-items: flex-start;
                        }
                        .copy-btn {
                            flex-shrink: 0;
                        }
                        .paste {
                            padding: 18px;

                            min-height: 240px;
                        }
                        pre {
                            font-size: 13px;
                        }
                        .footer {
                            flex-direction: column;
                            gap: 5px;
                        }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        *,
                        *::before,
                        *::after {
                            animation-duration:
                                0.01ms !important;
                            transition-duration:
                                0.01ms !important;
                        }
                    }
                </style>
            </head>
            <body>
                <main class="page">
                    <section class="container">
                        <div class="content">
                            <header class="header">
                                <div class="brand">
                                    <div class="logo">
                                        &lt;/&gt;
                                    </div>
                                    <div>
                                        <div class="brand-name">
                                            PasteBin
                                        </div>
                                        <div class="paste-id">
                                            ${shortURL}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    class="copy-btn"
                                    id="copyBtn"
                                >
                                    Copy
                                </button>
                            </header>
                            <div class="paste">
                                <pre id="pasteContent">${safeContent}</pre>
                            </div>
                            <footer class="footer">
                                <span>
                                    Simple. Fast.
                                </span>
                                <span>
                                    Shareable.
                                </span>
                            </footer>
                        </div>
                    </section>
                </main>
                <script>
                    const copyBtn =
                        document.getElementById("copyBtn");
                    const pasteContent =
                        document.getElementById("pasteContent");
                    copyBtn.addEventListener(
                        "click",
                        async () => {
                            const text =
                                pasteContent.textContent;
                            try {
                                await navigator.clipboard
                                    .writeText(text);
                            } catch (err) {
                                const range =
                                    document.createRange();
                                range.selectNodeContents(
                                    pasteContent
                                );
                                const selection =
                                    window.getSelection();
                                selection.removeAllRanges();
                                selection.addRange(range);
                                document.execCommand("copy");
                                selection.removeAllRanges();
                            }
                            copyBtn.textContent =
                                "Copied ✓";
                            setTimeout(
                                () => {
                                    copyBtn.textContent =
                                        "Copy";
                                },
                                1800
                            );
                        }
                    );
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error(
            "Error retrieving paste:",
            err
        );
        return res.status(500).send(`
            <!DOCTYPE html>
            <html>
                <body>
                    <h1>Internal Server Error</h1>
                    <p>
                        Unable to retrieve this paste.
                    </p>
                </body>
            </html>
        `);
    }
});

app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}`
    );
});
