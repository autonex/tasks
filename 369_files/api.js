// Autofill and Refine Handlers
async function handleAutofillExtractContent(textArea, container) {
    const feedbackContainer = container.querySelector('.feedback-container');
    const errorDiv = container.querySelector('.error-message') || container.querySelector('.hint-error');
    const loadingOverlay = container.querySelector('.generate-loading-overlay');
    const apiUrl = 'https://yutori--model-in-loop-server-fastapi-app.modal.run/predict_extract_content';
    let responseData = null;
    let requestPayload = null;

    try {
        // Show loading overlay
        loadingOverlay.classList.add('visible');

        // Hide the feedback container while loading
        feedbackContainer.classList.add('hidden');

        // Clear any previous errors
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.classList.remove('visible');
        }

        // Get the current step data and context
        const stepData = getCurrentStepData();
        if (!stepData) {
            throw new Error('Could not get current step data');
        }

        // Process the screenshot to ensure it's in the right format
        const screenshotData = await formatScreenshotData(stepData.screenshot);

        // Prepare request payload with correct format
        requestPayload = {
            prompt: stepData.messages?.[0]?.content || "",
            screenshot: screenshotData,
            observation: (() => {
                const observationMsg = stepData.messages?.find(msg => msg.role === 'observation');
                if (!observationMsg) return "";
                return typeof observationMsg.content === 'string'
                    ? observationMsg.content
                    : observationMsg.content[0]?.text || "";
            })()
        };

        // Make the actual API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.error || responseData?.detail || 'Autofill request failed');
        }

        // Extract the result from the response
        const generatedText = responseData?.result || responseData?.response || 'No content extracted';

        // Update the UI
        textArea.value = generatedText;

        // Show feedback container
        feedbackContainer.classList.remove('hidden');

    } catch (error) {
        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            textArea,
            {
                errorDiv: errorDiv,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('visible');
    }
}

async function handleRefineExtractContent(textArea, generatedTextArea, feedbackInput) {
    const container = feedbackInput.closest('.action-fields');
    const loadingOverlay = container.querySelector('.generate-loading-overlay');
    const errorDiv = container.querySelector('.error-message') || container.querySelector('.hint-error');
    const feedbackContainer = container.querySelector('.feedback-container');
    const feedback = feedbackInput.value.trim();
    const apiUrl = 'https://yutori--model-in-loop-server-fastapi-app.modal.run/predict_extract_content';
    let responseData = null;
    let requestPayload = null;

    if (!feedback) {
        alert('Please provide feedback to refine the generated text');
        return;
    }

    try {
        // Show loading overlay
        loadingOverlay.classList.add('visible');

        // Hide the feedback container while loading
        feedbackContainer.classList.add('hidden');

        // Get the current step data and context
        const stepData = getCurrentStepData();
        if (!stepData) {
            throw new Error('Could not get current step data');
        }

        // Process the screenshot to ensure it's in the right format
        const screenshotData = await formatScreenshotData(stepData.screenshot);

        // Prepare request payload with correct format
        requestPayload = {
            prompt: stepData.messages?.[0]?.content || "",
            screenshot: screenshotData,
            observation: (() => {
                const observationMsg = stepData.messages?.find(msg => msg.role === 'observation');
                if (!observationMsg) return "";
                return typeof observationMsg.content === 'string'
                    ? observationMsg.content
                    : observationMsg.content[0]?.text || "";
            })(),
            feedback: feedback,
            current_generation: textArea.value
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.error || responseData?.detail || 'Refine request failed');
        }

        // Extract the result from the response
        const refinedText = responseData?.result || responseData?.response || 'No content generated';

        // Update the UI
        textArea.value = refinedText;
        feedbackInput.value = ''; // Clear feedback

        // Show feedback container
        feedbackContainer.classList.remove('hidden');

    } catch (error) {
        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            textArea,
            {
                showAlert: true,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('visible');
    }
}

// Shared function to parse response and extract the appropriate text
function parseResponseAndExtractText(responseData) {
    // Try to parse the response if it's a string
    let parsedResponse = responseData;
    if (typeof responseData.response === 'string') {
        try {
            parsedResponse = JSON.parse(responseData.response);
        } catch (e) {
            // If parsing fails, keep the original response
            parsedResponse = responseData;
        }
    }

    // Handle both response formats - either direct response or reasoning+result
    if (parsedResponse.task_summary) {
        // Use task_summary if available
        return parsedResponse.task_summary;
    } else if (parsedResponse.extracted_content_summary) {
        // Fall back to extracted_content_summary if available
        return parsedResponse.extracted_content_summary;
    } else if (parsedResponse.result) {
        // If result is a string, try to parse it as JSON first
        if (typeof parsedResponse.result === 'string') {
            try {
                const parsedResult = JSON.parse(parsedResponse.result);
                if (parsedResult.task_summary) {
                    return parsedResult.task_summary;
                } else if (parsedResult.extracted_content_summary) {
                    return parsedResult.extracted_content_summary;
                } else if (parsedResult.extracted_content) {
                    return parsedResult.extracted_content;
                } else {
                    return parsedResponse.result;
                }
            } catch (e) {
                // If parsing fails, use the string directly
                return parsedResponse.result;
            }
        } else if (typeof parsedResponse.result === 'object') {
            // If result is already an object, try to get task_summary first
            if (parsedResponse.result.task_summary) {
                return parsedResponse.result.task_summary;
            } else if (parsedResponse.result.extracted_content_summary) {
                return parsedResponse.result.extracted_content_summary;
            } else if (parsedResponse.result.extracted_content) {
                return parsedResponse.result.extracted_content;
            } else {
                // If no suitable field found, stringify the entire result
                return JSON.stringify(parsedResponse.result);
            }
        }
    }

    // If we can't find any suitable message, show a default message
    return "No clean message to show...";
}

async function handleAutofillStop(ruleSel, ans, container) {
    const feedbackContainer = container.querySelector('.feedback-container');
    const errorDiv = container.querySelector('.hint-error') || container.querySelector('.error-message');
    const loadingOverlay = container.querySelector('.generate-loading-overlay');
    const apiUrl = 'https://yutori--model-in-loop-server-fastapi-app.modal.run/predict_subtask_outcome_flywheel';
    let responseData = null;
    let requestPayload = null;

    try {
        // Show loading overlay
        loadingOverlay.classList.add('visible');

        // Hide the feedback container while loading
        feedbackContainer.classList.add('hidden');

        // Clear any previous errors
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.classList.remove('visible');
        }

        // Get the current step data and context
        const stepData = getCurrentStepData();
        if (!stepData) {
            throw new Error('Could not get current step data');
        }

        // Process the screenshot to ensure it's in the right format
        const screenshotData = await formatScreenshotData(stepData.screenshot);

        // Prepare request payload with correct format
        requestPayload = {
            prompt: stepData.messages?.[0]?.content || "",
            screenshot: screenshotData,
            history: stepData.messages || []
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.error || 'Failed to generate stop message');
        }

        // Use shared function to parse response and get text
        const generatedText = parseResponseAndExtractText(responseData);

        // Update the UI
        ans.value = generatedText;
        ruleSel.value = 'contain'; // Default to 'contain' rule

        // Show feedback container
        feedbackContainer.classList.remove('hidden');

    } catch (error) {
        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            ans,
            {
                errorDiv: errorDiv,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('visible');
    }
}

async function handleRefineStop(ruleSel, ans, generatedTextArea, feedbackInput) {
    const container = feedbackInput.closest('.action-fields');
    const loadingOverlay = container.querySelector('.generate-loading-overlay');
    const errorDiv = container.querySelector('.hint-error') || container.querySelector('.error-message');
    const feedbackContainer = container.querySelector('.feedback-container');
    const feedback = feedbackInput.value.trim();
    const apiUrl = 'https://yutori--model-in-loop-server-fastapi-app.modal.run/predict_subtask_outcome_flywheel';
    let responseData = null;
    let requestPayload = null;

    if (!feedback) {
        alert('Please provide feedback to refine the generated text');
        return;
    }

    try {
        // Show loading overlay
        loadingOverlay.classList.add('visible');

        // Hide the feedback container while loading
        feedbackContainer.classList.add('hidden');

        // Get the current step data and context
        const stepData = getCurrentStepData();
        if (!stepData) {
            throw new Error('Could not get current step data');
        }

        // Process the screenshot to ensure it's in the right format
        const screenshotData = await formatScreenshotData(stepData.screenshot);

        // Prepare request payload with correct format
        requestPayload = {
            prompt: stepData.messages?.[0]?.content || "",
            screenshot: screenshotData,
            history: stepData.messages || [],
            feedback: feedback,
            current_generation: ans.value
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.error || 'Failed to refine stop message');
        }

        // Use shared function to parse response and get text
        const refinedText = parseResponseAndExtractText(responseData);

        // Update the UI
        ans.value = refinedText;
        feedbackInput.value = ''; // Clear feedback

        // Show feedback container
        feedbackContainer.classList.remove('hidden');

    } catch (error) {
        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            ans,
            {
                showAlert: true,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('visible');
    }
}

// Add new function to handle uploads
async function uploadAnnotations() {
    const apiUrl = '/upload_annotation';
    let responseData = null;
    let requestPayload = null;

    try {
        requestPayload = {
            ...annotations,
            dashboard_url: window.location.href
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
            credentials: 'same-origin' // Include credentials for authentication
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.detail || responseData?.error || 'Upload failed');
        }

        return responseData;
    } catch (error) {
        console.error('Error uploading annotations:', error);

        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            null,
            {
                showAlert: true,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );

        throw error;
    }
}

async function generateSubtaskSuggestions(buttonEl) {
    const container = buttonEl.closest('.subtask-input-group');
    const hintInput = container.querySelector('.hint-input');
    const generateBtn = container.querySelector('.generate-subtask-btn');
    const errorDiv = container.querySelector('.hint-error');
    const suggestionsDropdown = container.querySelector('dropdown-suggestions');
    const loadingOverlay = container.querySelector('.generate-loading-overlay');
    const apiUrl = 'https://yutori--model-in-loop-server-fastapi-app.modal.run/predict_subtask_flywheel';
    let responseData = null;
    let requestPayload = null;

    const hint = hintInput.value.trim();

    if (!hint) {
        errorDiv.textContent = 'Please enter a hint first';
        errorDiv.classList.add('visible');
        return;
    }

    // Get the conversation history from all previous steps
    const planData = getPlanConversation();

    // Create request payload matching the test endpoint format
    requestPayload = {
        hint: hint,
        plan: planData
    };

    // Clear previous error if any
    errorDiv.classList.remove('visible');

    // Show loading overlay with animation
    loadingOverlay.classList.add('visible');
    generateBtn.disabled = true;

    try {
        // Call the backend endpoint with properly formatted data
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });

        responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData?.error || responseData?.detail || 'Failed to generate suggestions');
        }

        // If the response indicates an error or is invalid, show the curl command and detailed error
        if (!responseData?.subtasks || !Array.isArray(responseData.subtasks)) {
            // Create curl command for error cases
            const curlCommand = `curl -X POST '${apiUrl}' \\
-H 'Content-Type: application/json' \\
-d '${JSON.stringify(requestPayload, null, 2)}'`;

            // Show error response with curl command
            const listEl = suggestionsDropdown.querySelector('.suggestions-list');
            listEl.innerHTML = `
                <div class="suggestion-item error-response">
                    <div class="response-header">
                        <div class="response-label">API Response:</div>
                        <div class="response-type ${responseData?.error ? 'error' : 'unknown'}">
                            ${responseData?.error ? 'Error' : 'Invalid Response'}
                        </div>
                    </div>
                    <div class="curl-container">
                        <div class="curl-content single-line">
                            ${curlCommand}
                        </div>
                        <button class="copy-curl-btn" onclick="copyCurlCommand(this)">
                            <svg class="copy-icon" viewBox="0 0 16 16" width="16" height="16">
                                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                            </svg>
                            <span class="copy-text">Copy</span>
                        </button>
                    </div>
                    <pre class="response-data">${JSON.stringify(responseData, null, 2)}</pre>
                </div>
            `;
        } else {
            // Show successful suggestions as clickable options
            displaySuggestions(suggestionsDropdown, responseData);
        }

        suggestionsDropdown.classList.remove('hidden');

    } catch (error) {
        // Use our new error handling function
        const { errorMessage, detailedMessage } = handleApiError(
            error,
            responseData,
            null,
            {
                errorDiv: errorDiv,
                requestPayload: requestPayload,
                apiUrl: apiUrl
            }
        );
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('visible');
        generateBtn.disabled = false;
    }
}

// Add new function to format screenshot data
async function formatScreenshotData(screenshot) {
    if (!screenshot) return null;

    // If already "data:image/..." we do nothing:
    if (screenshot.startsWith('data:image')) {
        return screenshot;
    }
    // If it's a relative path or something like "http://example.com/foo.png"
    else if (screenshot.includes('/') || screenshot.match(/\.(png|jpe?g|gif|webp)$/i)) {
        try {
            console.log(`Fetching image from: ${screenshot}`);

            // Handle relative URLs by prepending origin if needed
            const imageUrl = screenshot.startsWith('http')
                ? screenshot
                : new URL(screenshot, window.location.origin + window.location.pathname).href;

            // Fetch the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
            }

            // Convert to blob
            const blob = await response.blob();

            // Convert blob to base64
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

        } catch (error) {
            console.error('Error converting image to base64:', error);
            // Return a 1x1 transparent PNG as fallback
            return 'data:image/png;base64,iVBORaw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }
    }
    // If it's base64 without a prefix:
    else {
        return `data:image/png;base64,${screenshot}`;
    }
}
