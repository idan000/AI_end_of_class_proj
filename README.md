CodeExplainer 🧠💻

CodeExplainer is an AI-powered coding tutor built directly into the browser. It helps developers, students, and enthusiasts understand code snippets line-by-line using the power of Google's Gemini AI.

✨ Features

Instant AI Explanations: Search for any coding concept (e.g., "React Hooks", "Python List Comprehension", "CSS Grid") and receive a complete code snippet.

Line-by-Line Breakdown: The AI doesn't just give you code; it breaks down exactly what each line does in a clean, side-by-side view.

Built-in Cheat Sheets: Quick reference sidebars for JavaScript, Python, HTML, and CSS to inspire your learning.

Search History: A persistent "Book" sidebar that saves your past queries so you can revisit concepts instantly.

100% Client-Side: No backend required. Just HTML, Tailwind CSS, and vanilla JavaScript.

🚀 Getting Started

Since this application runs entirely in the browser and connects directly to the Google Gemini API, you will need to provide your own free API key to enable the AI features.

1. Get your free Google Gemini API Key

To use CodeExplainer, you need an API key from Google AI Studio.

Go to Google AI Studio.

Sign in with your Google Account.

Click on the "Create API Key" button.

Copy the generated key.

2. Run the App

Because this is a single-file application, you can run it immediately:

Clone this repository or download the index.html file.

Double-click the index.html file to open it in any modern web browser.
(Alternatively, you can host it for free on GitHub Pages).

3. Enter your API Key

Click the Key Icon 🔑 in the top right corner of the CodeExplainer app.

Paste your Google AI Studio API key into the input field.

Click "Save Key".

The key icon will turn green, indicating you are ready to start searching!

Note: Your API key is saved securely in your browser's local storage. It is never sent anywhere except directly to Google's API when you perform a search.

🛠️ Tech Stack

HTML5 / CSS3

JavaScript (ES6+)

Tailwind CSS (via CDN for styling)

Google Gemini API (gemini-1.5-flash)

💡 How it works under the hood

The app uses fetch to send a structured prompt to the Gemini API, forcing the AI to respond in a strict JSON format.

{
  "code": "const x = 10;",
  "explanation": [
    "This declares a constant variable named x and assigns it the value 10."
  ]
}


The JavaScript then parses this JSON and dynamically injects the code into the mock-editor and maps the explanations into the UI.
