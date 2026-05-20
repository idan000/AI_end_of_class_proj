// --- CONFIGURATION ---

// The built-in API key provided by the environment (leave empty string)
const apiKey = "";
// The internal model required for the free built-in key
const internalModelName = "gemini-2.5-flash-preview-09-2025";
// The public model used when a user provides their own key
const publicModelName = "gemini-1.5-flash"; 

// --- STATE MANAGEMENT ---

// Track how many free searches the user has done
let usageCount = parseInt(localStorage.getItem('app_usage_count')) || 0;
// The maximum number of free searches allowed before asking for a key
const FREE_LIMIT = 3;

// We look in the browser's local memory (localStorage) for past searches. 
// If we find them, we parse them from text into a JavaScript array. If not, we start with an empty array [].
let history = JSON.parse(localStorage.getItem('search_history')) || [];

// This object holds all the cheat-sheet topics for the left sidebar based on the language chosen.
const sidebarData = {
    javascript: { "Types": ["Strings", "Arrays"], "Funcs": ["Arrow Functions"], "Logic": ["Loops"] },
    python: { "Types": ["Lists"], "Funcs": ["Def Keyword"], "Logic": ["Indentation"] },
    html: { "Docs": ["Meta Tags"], "Elements": ["Forms"], "Media": ["SVG"] },
    css: { "Layout": ["Flexbox"], "Styling": ["Box Model"], "Effects": ["Animations"] }
};

let availableModels = [];
let availableModelsKey = "";

// --- UI TOGGLES ---

// This function opens or closes a sidebar (either the left "Reference" or right "History" menu).
function toggleSidebar(id) {
    // Find the specific sidebar element we want to move
    const sidebar = document.getElementById(id);
    // Find the dark background overlay element
    const overlay = document.getElementById('sidebarOverlay');
    // Check if we are interacting with the left sidebar
    const isLeft = id === 'sidebar';
    // Determine if the sidebar is currently open by checking its CSS classes
    const isOpen = isLeft ? sidebar.classList.contains('translate-x-0') : sidebar.classList.contains('translate-x-full') === false;

    if (isOpen) {
        // If it's open, slide it off the screen
        isLeft ? sidebar.classList.add('-translate-x-full') : sidebar.classList.add('translate-x-full');
        isLeft ? sidebar.classList.remove('translate-x-0') : sidebar.classList.remove('translate-x-0');
        // Hide the dark background overlay
        overlay.classList.add('hidden');
    } else {
        // If it's closed, first ensure all other sidebars are closed
        closeAllSidebars();
        // Then slide this specific sidebar onto the screen
        isLeft ? sidebar.classList.remove('-translate-x-full') : sidebar.classList.remove('translate-x-full');
        sidebar.classList.add('translate-x-0');
        // Show the dark background overlay
        overlay.classList.remove('hidden');
    }
}

// This function forces both sidebars to hide off-screen
function closeAllSidebars() {
    // Slide left sidebar away
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar').classList.remove('translate-x-0');
    // Slide right sidebar away
    document.getElementById('historySidebar').classList.add('translate-x-full');
    document.getElementById('historySidebar').classList.remove('translate-x-0');
    // Hide the dark background overlay
    document.getElementById('sidebarOverlay').classList.add('hidden');
}

// This function toggles the visibility of popup windows (like the API Key input box)
function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    // Prefill the API key input with any stored key when the key modal opens
    if (id === 'apiKeyModal') {
        const savedKey = localStorage.getItem('user_gemini_api_key') || '';
        const keyInput = document.getElementById('userApiKeyInput');
        if (keyInput) keyInput.value = savedKey;
    }

    // Toggle adds the 'hidden' class if it's missing, or removes it if it's there
    modal.classList.toggle('hidden');
}

// --- CONTENT RENDERING ---

function normalizeModelEntry(entry) {
    const name = entry.name || entry.model || entry.id || '';
    const supportedMethods = Array.isArray(entry.supportedMethods)
        ? entry.supportedMethods
        : entry.supportedMethods ? [entry.supportedMethods] : [];
    return { name, supportedMethods };
}

function normalizeModelPath(model) {
    if (!model) return '';
    return model.startsWith('models/') ? model : `models/${model}`;
}

function normalizeModelName(model) {
    if (!model) return '';
    return model.startsWith('models/') ? model.slice(7) : model;
}

async function listSupportedModels(key) {
    try {
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
        const res = await fetch(modelUrl, { method: 'GET' });
        if (!res.ok) {
            throw new Error(`Model list failed: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const models = Array.isArray(json.models) ? json.models.map(normalizeModelEntry) : [];
        return models.filter(m => m.name);
    } catch (error) {
        console.error('listSupportedModels error', error);
        return [];
    }
}

async function resolveModelForKey(key) {
    if (!key) return null;
    if (availableModelsKey !== key || availableModels.length === 0) {
        availableModels = await listSupportedModels(key);
        availableModelsKey = key;
    }
    if (!availableModels.length) return null;

    const supported = availableModels.filter(m =>
        m.supportedMethods.some(method => typeof method === 'string' && method.toLowerCase().includes('generate'))
    );

    const preferred = supported.find(m => normalizeModelName(m.name) === normalizeModelName(publicModelName));
    if (preferred) return preferred.name;
    if (supported.length) return supported[0].name;
    return availableModels[0].name;
}

function getModelEndpoint(model) {
    return normalizeModelPath(model);
}

async function fetchWithRetryModels(key, models, options) {
    let lastError = null;
    for (const model of models) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${getModelEndpoint(model)}:generateContent?key=${encodeURIComponent(key)}`;
        try {
            return await fetchWithRetry(apiUrl, options);
        } catch (error) {
            lastError = error;
            const msg = error && error.message ? error.message : '';
            if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
                console.warn(`Model ${model} unavailable, trying next supported model...`, error);
                continue;
            }
            throw error;
        }
    }
    throw lastError || new Error('All supported models failed.');
}

// This function updates the left sidebar whenever the user changes the language dropdown
function updateSidebarContent() {
    // Find out which language is currently selected in the dropdown
    const lang = document.getElementById('languageSelect').value;
    // Find the container where we put the sidebar links
    const container = document.getElementById('sidebarLinks');
    // Clear out any old links currently in the container
    container.innerHTML = '';
    
    // Get the correct cheat-sheet data for the selected language
    const data = sidebarData[lang];
    
    // Loop through each category (e.g., "Types", "Funcs") in the data
    for (const category in data) {
        // Create a new HTML div for the category section
        const section = document.createElement('div');
        // Add the category title HTML
        section.innerHTML = `<h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">${category}</h3>`;
        // Create a list element to hold the actual clickable links
        const list = document.createElement('ul');
        list.className = "space-y-2";
        
        // Loop through each specific topic in the category (e.g., "Strings", "Arrays")
        data[category].forEach(item => {
            const li = document.createElement('li');
            // Create a button that calls 'applySidebarSearch' when clicked
            li.innerHTML = `<button onclick="applySidebarSearch('${item}')" class="text-sm text-gray-600 hover:text-indigo-600 flex items-center gap-2"><span class="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>${item}</button>`;
            // Add the button to the list
            list.appendChild(li);
        });
        
        // Add the list to the section, and the section to the main container
        section.appendChild(list);
        container.appendChild(section);
    }
}

// This function updates the right sidebar with the user's past questions
function renderHistory() {
    // Find the container where history links go
    const container = document.getElementById('historyLinks');
    
    // If the history array is empty, show a default message
    if (history.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 italic text-center mt-10">No history...</p>';
        return;
    }
    
    // Clear out the container
    container.innerHTML = '';
    
    // Create a copy of the history array, reverse it (newest first), and loop through it
    history.slice().reverse().forEach(item => {
        // Create a button for each past search
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-3 rounded-lg border border-gray-100 hover:bg-indigo-50 text-sm mb-2";
        // When clicked, run the search again using the saved query and language
        btn.onclick = () => applyHistorySearch(item.query, item.lang);
        // Add the text for the query and language tag
        btn.innerHTML = `<span class="font-bold block">${item.query}</span><span class="text-xs text-indigo-500">${item.lang}</span>`;
        // Add the button to the container
        container.appendChild(btn);
    });
}

// --- API & SEARCH LOGIC ---

// A helper function to call the API safely. If the server is busy, it waits and tries again (Exponential Backoff)
async function fetchWithRetry(url, options, retries = 5, backoff = 1000) {
    try {
        // Attempt to send the request to Google's servers
        const response = await fetch(url, options);
        
        // If the response is not OK (e.g., 400 Bad Request, 404 Not Found, 401 Unauthorized)
        if (!response.ok) {
            // Read the error message returned by Google
            const errorText = await response.text();
            
            // If the error is a client error (like a bad API key), fail immediately. Do NOT retry.
            if (response.status >= 400 && response.status <= 404) {
                const err = new Error(`API Error ${response.status}: ${errorText}`);
                err.isClientError = true;
                throw err;
            }
            
            // Otherwise, throw a generic error to trigger a retry
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        // If successful, convert the response into a JSON object and return it
        return await response.json();
        
    } catch (error) {
        // If it's a known client error (like bad API key), stop trying and throw the error up
        if (error.isClientError) {
            throw error;
        }

        // If we still have retries left (e.g., server was just busy)
        if (retries > 0) {
            // Wait for the specified backoff time (1s, then 2s, then 4s, etc.)
            await new Promise(resolve => setTimeout(resolve, backoff));
            // Try the fetch again, reducing the retry count by 1 and doubling the wait time
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        
        // If we run out of retries, give up and throw the error
        throw error;
    }
}

// The main function that handles asking the AI a question
async function handleSearch() {
    // Get the text the user typed into the search box
    const queryInput = document.getElementById('searchInput');
    const query = queryInput.value.trim();
    // Get the currently selected language
    const lang = document.getElementById('languageSelect').value;
    // Get the user's saved API key from the browser's memory
    const userStoredKey = localStorage.getItem('user_gemini_api_key') || "";
    
    // If the search box is empty, do nothing
    if (!query) return;

    // If the user hasn't provided a key and they've hit the free limit, show the popup
    if (!userStoredKey && usageCount >= FREE_LIMIT) {
        toggleModal('apiKeyModal');
        return;
    }

    // Determine which key and model to use
    const activeKey = userStoredKey || apiKey;
    let activeModel = internalModelName;
    if (userStoredKey) {
        activeModel = await resolveModelForKey(activeKey);
        if (!activeModel) {
            alert('No compatible model was found for this API key. Use "Validate Key" to inspect available models.');
            showWelcome();
            document.getElementById('loadingView').classList.add('hidden');
            return;
        }
    }

    // Hide the welcome instructions and the previous results
    document.getElementById('welcomeView').classList.add('hidden');
    document.getElementById('resultView').classList.add('hidden');
    // Show the spinning loading animation
    document.getElementById('loadingView').classList.remove('hidden');

    // Formulate the instruction telling the AI how to act and what to explain
    const systemPrompt = `You are an expert coding tutor. Provide a code snippet and line-by-line explanation for "${query}" in ${lang}.`;

    const requestOptions = {
        method: 'POST', // Send data to the server
        headers: { 'Content-Type': 'application/json' }, // Tell the server we are sending JSON
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: query }] // The user's specific question
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }] // The secret instructions for the AI personality
            },
            generationConfig: {
                // Force the AI to respond strictly in a JSON format so our app doesn't break
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        code: { type: "STRING" }, // Expect the code block as a single string
                        explanation: {
                            type: "ARRAY", // Expect the explanations as an array of line-by-line strings
                            items: { type: "STRING" }
                        }
                    },
                    required: ["code", "explanation"]
                }
            }
        })
    };

    try {
        const result = userStoredKey
            ? await fetchWithRetryModels(activeKey, [
                activeModel,
                ...availableModels
                    .filter(m => m.supportedMethods.some(method => typeof method === 'string' && method.toLowerCase().includes('generate')))
                    .map(m => m.name)
                    .filter(name => name && name !== activeModel)
            ], requestOptions)
            : await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/${getModelEndpoint(activeModel)}:generateContent?key=${encodeURIComponent(activeKey)}`, requestOptions);

        // Check if the AI returned a valid answer. Sometimes safety filters block responses.
        if (!result.candidates || result.candidates.length === 0) {
            throw new Error("No response content generated by AI. It might have been blocked.");
        }

        // Extract and parse the JSON string the AI generated
        const data = JSON.parse(result.candidates[0].content.parts[0].text);

        // If they used a free try, increment the counter and save it
        if (!userStoredKey) {
            usageCount++;
            localStorage.setItem('app_usage_count', usageCount);
            // Update the key icon (it will start shaking if they just hit the limit)
            checkKeyStatus();
        }

        // Add the successful search to the user's history
        addToHistory(query, lang);
        // Update the screen with the AI's code and explanations
        updateUI(query, lang, data);
        
    } catch (error) {
        // Log the error to the developer console for debugging
        console.error('Final Error:', error);
        const msg = error && error.message ? error.message : String(error);
        // Check if the error likely means the API key was rejected or there's a permissions problem
        if (msg.includes("API_KEY_INVALID") || msg.includes("expired") || msg.includes("400") || msg.includes("404") || msg.toLowerCase().includes('unauthor') || msg.toLowerCase().includes('permission')) {
            // Delete the bad key from memory
            localStorage.removeItem('user_gemini_api_key');
            // Update the UI icon so the key shakes again
            checkKeyStatus();
            // Show detailed message and reopen modal so they can re-enter/validate
            const out = `Google rejected this key. Details: ${msg}\n\nOpen API Settings to validate the key or verify it in Google AI Studio.`;
            alert(out);
            toggleModal('apiKeyModal');
        } else if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
            alert(`The selected Gemini model is temporarily unavailable or overloaded. Please try again later, or use 'Validate Key' to check available supported models.`);
            showWelcome();
        } else {
            // Surface detailed error to the user and suggest validation
            alert(`Search failed: ${msg}\n\nTip: Use 'Validate Key' in API Settings to inspect the key, and check the console for more details.`);
            showWelcome();
        }
    } finally {
        // Always hide the loading spinner when finished, whether it succeeded or failed
        document.getElementById('loadingView').classList.add('hidden');
    }
}

// --- HELPER FUNCTIONS ---

// Triggers a search automatically when a user clicks a left sidebar quick-link
function applySidebarSearch(term) {
    document.getElementById('searchInput').value = term;
    closeAllSidebars();
    handleSearch();
}

// Triggers a search automatically when a user clicks a right sidebar history link
function applyHistorySearch(query, lang) {
    document.getElementById('languageSelect').value = lang;
    document.getElementById('searchInput').value = query;
    closeAllSidebars();
    handleSearch();
}

// Saves a new query to the history array and updates local storage
function addToHistory(query, lang) {
    // Prevent duplicate entries. Only add if it's not already in the history.
    if (!history.find(h => h.query.toLowerCase() === query.toLowerCase() && h.lang === lang)) {
        // Push the new search object to the end of the array
        history.push({ query, lang });
        // Save the updated array to the browser's memory
        localStorage.setItem('search_history', JSON.stringify(history));
        // Redraw the history sidebar to show the new item
        renderHistory();
    }
}

// Wipes all history data completely
function clearHistory() {
    // Empty the memory array
    history = [];
    // Delete the saved data from the browser
    localStorage.removeItem('search_history');
    // Redraw the sidebar (which will now show "No history...")
    renderHistory();
}

// --- KEY MANAGEMENT (FIXED SYNTAX ERROR HERE) ---

// Saves the API key that the user pasted into the popup
function saveUserKey() {
    // Get the text from the input box, trimming extra spaces
    const keyInput = document.getElementById('userApiKeyInput').value.trim();
    
    // If the box is empty, do nothing
    if (!keyInput) return;

    // Get the save button to update its text
    const btn = document.getElementById('saveKeyBtn');
    const originalText = btn.innerText;
    
    // Change text to show activity and disable button to prevent double-clicks
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        // Save the key to the browser's local memory
        localStorage.setItem('user_gemini_api_key', keyInput);
        
        // Update the key icon in the header (stop shaking, turn green)
        checkKeyStatus();
        
        // Hide the modal popup
        toggleModal('apiKeyModal');
    } catch (error) {
        // If local storage fails (e.g., privacy mode restrictions)
        console.error('Key Saving Error:', error);
        alert(`Error saving key to browser:\n\n${error.message}`);
    } finally {
        // Restore the button's original state
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Validate the provided API key by listing available models.
async function validateKey() {
    const key = document.getElementById('userApiKeyInput').value.trim();
    const resultEl = document.getElementById('keyValidationResult');
    if (!key) {
        alert('Please enter an API key first.');
        return;
    }
    if (resultEl) resultEl.innerHTML = '<div class="text-sm text-gray-500">Validating key...</div>';
    try {
        const models = await listSupportedModels(key);
        if (!models.length) {
            const msg = 'No models were returned for this key. Ensure the Generative Language API is enabled and the key has access.';
            if (resultEl) resultEl.innerHTML = `<div class="text-sm text-red-600">${msg}</div>`;
            alert(msg);
            return;
        }

        const preferredAvailable = models.some(m => normalizeModelName(m.name) === normalizeModelName(publicModelName));
        const validatedModel = await resolveModelForKey(key);
        const headerText = `Validation succeeded. ${models.length} models found.`;
        const selectedText = `Preferred model ${publicModelName} ${preferredAvailable ? 'is available.' : 'is not available.'}`;
        const activeModelText = `Active model selected: ${validatedModel || 'none'}`;

        const rowsHtml = models.map(m => {
            const valid = m.supportedMethods.some(method => typeof method === 'string' && method.toLowerCase().includes('generate'));
            const icon = valid ? '✅' : '❌';
            return `<tr class="border-t border-gray-200"><td class="px-3 py-2 text-sm text-gray-800 break-words">${m.name}</td><td class="px-3 py-2 text-center text-sm">${icon}</td></tr>`;
        }).join('');

        const tableHtml = `
            <div class="overflow-x-auto rounded-xl border border-gray-200 mt-3">
                <table class="min-w-full text-left text-sm text-gray-700">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 font-semibold">AI Model</th>
                            <th class="px-3 py-2 font-semibold text-center">Valid</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;

        const detailsHtml = `
            <details class="mt-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <summary class="cursor-pointer font-semibold text-gray-800">Show model validation table</summary>
                <div class="mt-4 space-y-2 text-sm text-gray-700">
                    <div>${selectedText}</div>
                    <div>${activeModelText}</div>
                    ${tableHtml}
                </div>
            </details>
        `;

        if (resultEl) {
            resultEl.innerHTML = `
                <div class="space-y-2">
                    <div class="text-sm font-medium text-gray-900">${headerText}</div>
                    <div class="text-sm text-gray-600">${selectedText}</div>
                    <div class="text-sm text-gray-600">${activeModelText}</div>
                    ${detailsHtml}
                </div>
            `;
        }
    } catch (e) {
        const errMsg = `Validation error: ${e.message}`;
        if (resultEl) resultEl.innerHTML = `<div class="text-sm text-red-600">${errMsg}</div>`;
        console.error('validateKey error', e);
        alert(errMsg);
    }
}

// Checks if an API key exists and updates the header icon visually
function checkKeyStatus() {
    // Get the key icon button
    const btn = document.getElementById('keyStatusBtn');
    // Check if memory has a key stored (returns true or false)
    const hasKey = !!localStorage.getItem('user_gemini_api_key');
    
    // Remove all specific color and animation classes first to reset it
    btn.classList.remove('shake-attention', 'text-gray-400', 'text-green-500');
    
    if (hasKey) {
        // If a key exists, make the icon solid green
        btn.classList.add('text-green-500');
    } else {
        // If no key exists, check if they hit the limit
        if (usageCount >= FREE_LIMIT) {
            // Wiggle to grab attention
            btn.classList.add('shake-attention');
        } else {
            // Just stay gray if they still have free tries
            btn.classList.add('text-gray-400');
        }
    }
}

// Updates the screen with the code and explanation data returned from the AI
function updateUI(query, lang, data) {
    // Make the result view visible
    document.getElementById('resultView').classList.remove('hidden');
    
    // Set the titles and language tags
    document.getElementById('resultTitle').innerText = query;
    document.getElementById('codeLangTag').innerText = lang;
    
    // Inject the raw code string into the dark code window
    document.getElementById('codeContent').textContent = data.code;
    
    // Find the container for the line-by-line explanations
    const container = document.getElementById('explanationContent');
    // Clear out any old explanations
    container.innerHTML = '';
    
    // Ensure the explanation data exists and is an array
    if (data.explanation && Array.isArray(data.explanation)) {
        // Loop through each line of explanation
        data.explanation.forEach((text, i) => {
            // Create a styled box for each explanation point
            const d = document.createElement('div');
            d.className = "p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-400 text-sm shadow-sm";
            // Add the line number (i+1) and the explanation text
            d.innerHTML = `<strong>${i + 1}:</strong> ${text}`;
            // Attach the box to the container
            container.appendChild(d);
        });
    }
}

// Hides everything and goes back to the initial instruction screen
function showWelcome() {
    document.getElementById('welcomeView').classList.remove('hidden');
    document.getElementById('resultView').classList.add('hidden');
    document.getElementById('loadingView').classList.add('hidden');
}

// --- EVENT LISTENERS ---

// Check for a `testKey` URL parameter and apply it to localStorage for quick testing.
function applyTestKeyFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const testKey = params.get('testKey');
        const testSearch = params.get('testSearch');
        if (testKey) {
            localStorage.setItem('user_gemini_api_key', testKey);
            const keyInput = document.getElementById('userApiKeyInput');
            if (keyInput) keyInput.value = testKey;
            checkKeyStatus();
            if (testSearch) {
                // Prefill the search input but do not automatically call the API to avoid unexpected network calls.
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = testSearch;
                alert('Test API key stored. Search box prefilled with test query. Click Search to run the request.');
            } else {
                alert('Test API key stored and UI updated.');
            }
        }
    } catch (e) {
        console.error('applyTestKeyFromUrl error', e);
    }
}

// When the page first finishes loading, run these setup scripts
window.onload = () => {
    // Fill the left sidebar with links
    updateSidebarContent();
    // Fill the right sidebar with history
    renderHistory();
    // Prefill the API key input with any stored key
    const keyInput = document.getElementById('userApiKeyInput');
    if (keyInput) keyInput.value = localStorage.getItem('user_gemini_api_key') || '';
    // Make the API key icon shake if needed
    checkKeyStatus();
    // Apply test key from URL if provided (convenience for testing)
    applyTestKeyFromUrl();
};

// Listen for the user hitting the "Enter" key inside the search box
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    // If the key pressed was 'Enter', trigger the search function automatically
    if (e.key === 'Enter') handleSearch();
});
