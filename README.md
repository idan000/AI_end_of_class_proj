# CodeExplainer

CodeExplainer is a lightweight, AI-powered educational tool designed to help developers of all levels understand code. By leveraging Google's Gemini AI, the app provides instant, line-by-line breakdowns of coding concepts, syntax, and logic across multiple programming languages.

## Features

* **Line-by-Line Breakdown:** Paste or search for a coding concept, and the AI will generate a clear, numbered explanation corresponding directly to the generated code snippet.
* **Multi-Language Support:** Currently supports JavaScript, Python, HTML, and CSS.
* **Quick Reference Sidebar:** A handy slide-out menu with common concepts and methods for each language to help you start learning immediately.
* **Persistent History:** Your past searches are saved locally in your browser, allowing you to revisit previous explanations at any time.
* **Bring Your Own Key (BYOK):** A secure, local-first architecture that allows users to plug in their own Google Gemini API key to power the AI explanations without requiring a backend server.

## Setup Instructions

To use CodeExplainer, you will need to provide your own free Gemini API key. The app runs completely in your browser, meaning your key is saved locally to your machine and is never sent to a third-party database.

### 1. Get Your Free API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click the **"Create API key"** button.
4. Copy the generated key to your clipboard.

### 2. Add the Key to CodeExplainer
1. Open the CodeExplainer app.
2. Click the **Key Icon** in the top right corner of the navigation bar.
3. Paste your API key into the input field and click **Save Key**.
4. The key icon will turn green, indicating you are ready to start searching!

## Token Usage & API Limits

**Important:** By using your own API key, you are solely responsible for your token usage and any associated costs. 

Google currently provides a very generous **Free Tier** for the `gemini-1.5-flash` model used in this app. As of the current documentation, the free tier includes:
* **15 Requests per minute (RPM)**
* **1 million Tokens per minute (TPM)**
* **1,500 Requests per day (RPD)**

For standard personal and educational use, this free tier is more than enough. However, if you attach a billing account to your Google Cloud / AI Studio project and exceed these limits, you are completely responsible for paying Google for the excess usage. Please monitor your API usage directly in your Google AI Studio dashboard.

## Usage

1. Select your desired programming language from the dropdown menu in the header.
2. Type a coding concept into the search bar (e.g., "Arrow functions" or "List comprehension").
3. Press **Enter** or click **Search**.
4. Review the generated code snippet on the right and read the step-by-step breakdown on the left!

## Copyright

© 2026 Idan Weissman. All rights reserved.
