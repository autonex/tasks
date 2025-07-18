// Task Status Modal JavaScript

// Function to toggle step input visibility based on checkbox state
function toggleStepInput(checkbox) {
    const container = checkbox.parentElement;
    const stepInput = container.querySelector('.error-step-input');

    if (checkbox.checked) {
        stepInput.classList.remove('hidden');
    } else {
        stepInput.classList.add('hidden');
        stepInput.value = ''; // Clear the value when hiding
    }
}

// Function to show all step inputs for checked checkboxes (used when loading existing data)
function showStepInputsForCheckedBoxes() {
    const checkboxes = document.querySelectorAll('#task-error-categories input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            toggleStepInput(checkbox);
        }
    });
}

// Function to create the task status modal HTML
function createTaskStatusModal() {
    const modalHTML = `
    <div id="trajectory-annotation-modal" class="modal hidden">
        <div class="modal-content">
            <button class="close" onclick="closeModal('trajectory-annotation-modal')">&times;</button>

            <div class="modal-form-section">
                <h2 id="task-annotation-title">Annotate</h2>

                <label class="modal-section-label">Task Status</label>
                <select id="task-task-status" required>
                    <option value="" disabled selected>Select an option</option>
                    <option value="SUCCESS">Success</option>
                    <option value="ACCIDENTAL_SUCCESS">Accidental success</option>
                    <option value="FAILURE">Failure</option>
                    <option value="CANNOT_BE_DETERMINED">Cannot be determined</option>
                </select>

                <label class="modal-section-label">Error Categorizations (Select all that apply)</label>
                <div id="task-error-categories" class="annotation-error-categories">
                    <!-- Infrastructure Errors -->
                    <div class="error-category-header">
                        Infrastructure Errors
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="RUN_CRASHES" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Run crashes</span>
                        <input type="text" class="error-step-input hidden" data-category="RUN_CRASHES" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="BOT_DETECTION" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Bot detection / Captcha issues / proxy issues</span>
                        <input type="text" class="error-step-input hidden" data-category="BOT_DETECTION" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="AUTH_ISSUES" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Authentication/login issues</span>
                        <input type="text" class="error-step-input hidden" data-category="AUTH_ISSUES" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>

                    <!-- Prompt Errors -->
                    <div class="error-category-header">
                        Prompt Errors
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="BAD_PROMPTS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Bad prompts</span>
                        <input type="text" class="error-step-input hidden" data-category="BAD_PROMPTS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>

                    <!-- Trajectory Model Errors -->
                    <div class="error-category-header">
                        Trajectory Model Errors
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="NOT_USING_UI_ELEMENTS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Not using UI elements e.g. filters / search, or using them incorrectly</span>
                        <input type="text" class="error-step-input hidden" data-category="NOT_USING_UI_ELEMENTS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="MISSING_EXTRACTION_STEP" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Missing info extraction tool call</span>
                        <input type="text" class="error-step-input hidden" data-category="MISSING_EXTRACTION_STEP" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="EARLY_STOPPING_ASSUMED_SATISFACTION" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Early stopping - prematurely assuming task satisfaction (default)</span>
                        <input type="text" class="error-step-input hidden" data-category="EARLY_STOPPING_ASSUMED_SATISFACTION" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="EARLY_STOPPING_PERSISTENCE" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Early stopping - insufficient persistence / giving up too easily</span>
                        <input type="text" class="error-step-input hidden" data-category="EARLY_STOPPING_PERSISTENCE" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="VERIFICATION_ERRORS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Verification errors - ignoring previous action failures / looping over failed steps</span>
                        <input type="text" class="error-step-input hidden" data-category="VERIFICATION_ERRORS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="UNREASONABLE_STEPS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Taking unreasonable steps (excluding loops) that don't make progress accomplishing the task</span>
                        <input type="text" class="error-step-input hidden" data-category="UNREASONABLE_STEPS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="UI_GROUNDING_ERRORS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">UI Grounding errors</span>
                        <input type="text" class="error-step-input hidden" data-category="UI_GROUNDING_ERRORS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="DYNAMIC_EVENTS" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Failing to handle dynamic events, e.g., cookie setting, ads popups</span>
                        <input type="text" class="error-step-input hidden" data-category="DYNAMIC_EVENTS" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="HALLUCINATION" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Information hallucination / corruption</span>
                        <input type="text" class="error-step-input hidden" data-category="HALLUCINATION" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>

                    <!-- Non-Trajectory Model Errors -->
                    <div class="error-category-header">
                        Non-Trajectory Model Errors
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="PROMPT_MISUNDERSTANDING" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Model misunderstands prompt / prompt intent / neglects key requirements <i>before</i> beginning task</span>
                        <input type="text" class="error-step-input hidden" data-category="PROMPT_MISUNDERSTANDING" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="OUTPUT_STEP" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Model output step is problematic</span>
                        <input type="text" class="error-step-input hidden" data-category="OUTPUT_STEP" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="TEMPORAL_MISUNDERSTANDING" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Model misunderstands current date and/or does relative datetime calculations wrongly</span>
                        <input type="text" class="error-step-input hidden" data-category="TEMPORAL_UNDERSTANDING" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="NAVIGATOR_STOP" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Navigator was asked to call stop, but it did not summarize its progress</span>
                        <input type="text" class="error-step-input hidden" data-category="NAVIGATOR_STOP" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>

                    <!-- Tool Errors -->
                    <div class="error-category-header">
                        Tool Errors
                    </div>
                    <div class="error-category-option">
                        <input type="checkbox" value="TOOL_INCORRECT" onchange="toggleStepInput(this)">
                        <span class="error-category-text">Tool returns incorrect / outdated info or broken / generic / inappropriate links</span>
                        <input type="text" class="error-step-input hidden" data-category="TOOL_INCORRECT" placeholder="Step # (e.g., 1, 5, 6, 32)">
                    </div>
                    <label class="modal-subsection-label">
                        Tool Error Notes - <em>Enumerate All Erroneous Tool Outputs [tool1: output1, tool2: output2, etc.]</em>
                    </label>
                    <textarea id="tool-error-notes" rows="3"></textarea>
                </div>

                <label class="modal-section-label">Notes - <em>Fill in if Task Status is Not "Success" or if any Error Categorizations were Selected</em></label>
                <textarea id="task-annotation-notes" rows="3"></textarea>

                <div class="modal-footer">
                    <div id="trajectory-validation-error" class="validation-error-message hidden">
                        Please select a Task Status before saving.
                    </div>
                    <div class="modal-footer-buttons">
                        <button id="delete-annotation" class="delete-annotation-btn" style="display: none;">
                            Delete Annotation
                        </button>
                        <button class="cancel-btn" onclick="closeModal('trajectory-annotation-modal')">Cancel</button>
                        <button class="save-btn" onclick="saveSharedAnnotation()">Save</button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Inject the modal HTML into the document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to validate trajectory annotation
function validateTrajectoryAnnotation() {
    const taskStatus = document.getElementById('task-task-status').value;
    const errorMessage = document.getElementById('trajectory-validation-error');

    if (!taskStatus) {
        // Show error message
        if (errorMessage) {
            errorMessage.classList.remove('hidden');
        }
        return false; // Validation failed
    } else {
        // Hide error message if validation passes
        if (errorMessage) {
            errorMessage.classList.add('hidden');
        }
        return true; // Validation passed
    }
}

// Initialize the task status modal when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    createTaskStatusModal();
});
