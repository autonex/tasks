// Zoom/pan for step images
let currentZoom = 1;
const minZoom = 0.25;
let isDragging = false;

// ---------------------------------------------------------------------------
// Performance helpers & debug flag
// ---------------------------------------------------------------------------
// Toggle to true when you actually need verbose console output while working
const DEBUG = false;

// Simple debounce (no external deps). Returns a wrapped function that will
// postpone execution until `delay` ms have elapsed since the last call.
function debounce(fn, delay = 100) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Creates and inserts the step annotation modal HTML into the DOM
 */
function createStepAnnotationModal() {
    const modalHTML = `
        <!-- Annotate Step Modal -->
        <div id="annotate-step-modal" class="modal hidden">
            <div class="modal-content">
                <button class="close" onclick="closeModal('annotate-step-modal')">&times;</button>

                <div class="modal-form-section">
                    <h2>Annotate Step</h2>
                    <label class="modal-section-label">Annotation Type</label>
                    <div class="annotation-type-container">
                        <div class="annotation-type-option">
                            <input type="radio" id="annotation-type-mistake" name="annotation_type" value="MISTAKE"
                                checked />
                            <label for="annotation-type-mistake">MISTAKE</label>
                        </div>
                        <div class="annotation-type-option">
                            <input type="radio" id="annotation-type-followup" name="annotation_type"
                                value="MISTAKE_FOLLOWUP" />
                            <label for="annotation-type-followup">MISTAKE_FOLLOWUP</label>
                        </div>
                    </div>

                    <label class="modal-section-label">Corrected Actions</label>
                    <div id="actions-container" class="actions-container"></div>
                    <button onclick="addActionRow()">+ Add Action</button>

                    <div class="modal-footer">
                        <button id="delete-step-annotation" class="delete-annotation-btn" style="display: none;">
                            Delete Annotation
                        </button>
                        <button class="cancel-btn" onclick="closeModal('annotate-step-modal')">Cancel</button>
                        <button class="save-btn" onclick="saveStepAnnotation()">Save</button>
                    </div>
                </div>

                <div class="modal-image-section">
                    <div id="modal-image-container" class="modal-image-container no-image">
                        No image available
                    </div>


                </div>
            </div>
        </div>
    `;

    // Insert the modal HTML into the document body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function saveStepAnnotation() {
    if (!validateStepAnnotation()) return;

    const annType = document.querySelector('input[name="annotation_type"]:checked')?.value;

    // collect actions
    const actions = [];
    document.querySelectorAll('.action-container').forEach(cont => {
        const type = cont.querySelector('.action-type').value;
        const fields = cont.querySelector('.action-fields');
        const action = { action_type: type };

        // Collect thoughts, grounding instruction, and feedback for each action
        const thoughtsInput = fields.querySelector('.action-thoughts');
        const groundingInput = fields.querySelector('.action-grounding');
        const feedbackInput = fields.querySelector('.action-feedback');
        if (thoughtsInput && thoughtsInput.value.trim()) {
            action.thoughts = thoughtsInput.value.trim();
        }
        if (groundingInput && groundingInput.value.trim()) {
            action.grounding_instruction = groundingInput.value.trim();
        }
        if (feedbackInput && feedbackInput.value.trim()) {
            action.feedback = feedbackInput.value.trim();
        }

        if (type === 'click' || type === 'type') {
            const x1 = parseInt(fields.querySelector('.coordinate-x1').value, 10);
            const y1 = parseInt(fields.querySelector('.coordinate-y1').value, 10);
            const x2 = parseInt(fields.querySelector('.coordinate-x2').value, 10);
            const y2 = parseInt(fields.querySelector('.coordinate-y2').value, 10);
            action.bounding_box = [[x1, y1], [x2, y2]];
        }
        if (type === 'click') {
            const clickCount = parseInt(fields.querySelector('.click-count')?.value || '1', 10);
            if (clickCount > 1) {
                action.click_count = clickCount;
            }
        }
        if (type === 'type') {
            action.rule = fields.querySelector('.rule').value;
            action.text = fields.querySelector('.text').value;
            const pressEnter = fields.querySelector('.press-enter:checked');
            if (pressEnter) {
                action.press_enter_after = (pressEnter.value === 'true');
            }
        }
        if (type === 'scroll') {
            const x1 = parseInt(fields.querySelector('.coordinate-x1').value, 10);
            const y1 = parseInt(fields.querySelector('.coordinate-y1').value, 10);
            const x2 = parseInt(fields.querySelector('.coordinate-x2').value, 10);
            const y2 = parseInt(fields.querySelector('.coordinate-y2').value, 10);
            action.bounding_box = [[x1, y1], [x2, y2]];
            action.direction = fields.querySelector('.direction').value;
            const amount = parseInt(fields.querySelector('.scroll-amount')?.value || '100', 10);
            if (amount !== 100) {
                action.amount = amount;
            }
        }
        if (type === 'stop') {
            action.rule = fields.querySelector('.rule').value;
            action.answer = fields.querySelector('.answer').value;
        }
        if (type === 'extract_content') {
            action.page_content = fields.querySelector('.page-content').value;
        }
        if (type === 'goto_url') {
            action.url = fields.querySelector('.url').value;
        }
        if (type === 'key_press') {
            action.key_combo = fields.querySelector('.key-combo').value;
        }
        actions.push(action);
    });

    // Save locally
    const stepKey = `${selectedAgent}_${selectedAgentStepIndex}`;
    annotations.steps[stepKey] = {
        annotation_type: annType,
        annotated_actions: actions
    };

    // Update UI
    const stepContainer = document.querySelector(`.step-container[data-step-id="${stepKey}"]`);
    if (stepContainer) {
        // Remove existing annotation banner if any
        const existingBanner = stepContainer.querySelector('.annotation-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        // Create new annotation banner
        const banner = document.createElement('div');
        banner.className = 'annotation-banner';

        const bannerHeader = document.createElement('div');
        bannerHeader.className = 'annotation-banner-header';

        const bannerType = document.createElement('div');
        bannerType.className = 'annotation-banner-type';
        bannerType.textContent = annType === 'MISTAKE' ? 'MISTAKE' : 'MISTAKE + FOLLOWUP';
        bannerHeader.appendChild(bannerType);

        banner.appendChild(bannerHeader);

        if (actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'annotation-banner-actions';

            const actionsTitle = document.createElement('div');
            actionsTitle.className = 'annotation-banner-actions-title';
            actionsTitle.textContent = 'Corrected Actions:';
            actionsContainer.appendChild(actionsTitle);

            actions.forEach((action, idx) => {
                const actionDiv = document.createElement('div');
                actionDiv.className = 'annotation-banner-action';

                const number = document.createElement('span');
                number.className = 'annotation-banner-action-number';
                number.textContent = idx + 1;

                const type = document.createElement('span');
                type.className = 'annotation-banner-action-type';
                type.textContent = action.action_type;

                const details = document.createElement('span');
                details.className = 'annotation-banner-action-details';
                details.textContent = formatActionDetails(action);

                actionDiv.appendChild(number);
                actionDiv.appendChild(type);
                actionDiv.appendChild(details);
                actionsContainer.appendChild(actionDiv);
            });

            banner.appendChild(actionsContainer);
        }

        stepContainer.insertBefore(banner, stepContainer.firstChild);
    }

    // Update button text
    const annotateBtn = document.getElementById(`step-btn-${selectedAgent}-${selectedAgentStepIndex}`);
    if (annotateBtn) {
        annotateBtn.textContent = 'Edit Annotation';
        annotateBtn.classList.add('edit-button');
    }

    // Show delete button
    const deleteBtn = document.getElementById('delete-step-annotation');
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
    }

    uploadAnnotations().then(() => {
        renderSideNav();
        updateDownloadButtonState();
        closeModal('annotate-step-modal');

        const annotationsBtn = document.getElementById('view-annotations');
        if (annotationsBtn && annotationsBtn.classList.contains('active')) {
            displayAnnotations();
        }
    }).catch(error => {
        alert('Failed to save annotation: ' + error.message);
        renderSideNav();
        updateDownloadButtonState();
        closeModal('annotate-step-modal');
    });
}

/**
 * Initialize the step annotation modal component
 * Call this function when the page loads to set up the modal
 */
function initStepAnnotationModal() {
    // Only create if it doesn't already exist
    if (!document.getElementById('annotate-step-modal')) {
        createStepAnnotationModal();
    }
}

// Add validation for coordinates
function validateStepAnnotation() {
    // clear errors
    document.querySelectorAll('.error-message').forEach(e => e.remove());
    document.querySelectorAll('.field-error').forEach(e => e.classList.remove('field-error'));

    let isValid = true;
    const annType = document.querySelector('input[name="annotation_type"]:checked');
    if (!annType) {
        const cont = document.querySelector('.annotation-type-container');
        const err = document.createElement('div');
        err.className = 'error-message';
        err.textContent = 'Please pick an annotation type';
        cont.appendChild(err);
        isValid = false;
    }

    document.querySelectorAll('.action-container').forEach(cont => {
        const t = cont.querySelector('.action-type').value;
        const f = cont.querySelector('.action-fields');
        if (t === 'click' || t === 'type') {
            const x1Input = f.querySelector('.coordinate-x1');
            const y1Input = f.querySelector('.coordinate-y1');
            const x2Input = f.querySelector('.coordinate-x2');
            const y2Input = f.querySelector('.coordinate-y2');
            const coordContainer = x1Input.closest('.coordinate-container');

            // Always validate coordinates for click and type actions
            if (!x1Input.value.trim() || !y1Input.value.trim() || !x2Input.value.trim() || !y2Input.value.trim()) {
                coordContainer.classList.add('field-error');
                // Add red outline to individual coordinate inputs
                [x1Input, y1Input, x2Input, y2Input].forEach(input => {
                    if (!input.value.trim()) {
                        input.classList.add('field-error');
                    }
                });
                const err = document.createElement('div');
                err.className = 'error-message';
                err.textContent = 'All bounding box coordinates are required';
                coordContainer.appendChild(err);
                isValid = false;
            } else {
                // Validate that the bounding box makes sense (x1 < x2, y1 < y2)
                const x1 = parseInt(x1Input.value);
                const y1 = parseInt(y1Input.value);
                const x2 = parseInt(x2Input.value);
                const y2 = parseInt(y2Input.value);

                if (x1 >= x2 || y1 >= y2) {
                    coordContainer.classList.add('field-error');
                    [x1Input, y1Input, x2Input, y2Input].forEach(input => {
                        input.classList.add('field-error');
                    });
                    const err = document.createElement('div');
                    err.className = 'error-message';
                    err.textContent = 'Invalid bounding box: top-left must be above and to the left of bottom-right';
                    coordContainer.appendChild(err);
                    isValid = false;
                }
            }
        }
        if (t === 'type') {
            const txt = f.querySelector('.text');
            if (!txt.value.trim()) {
                txt.classList.add('field-error');
                const err = document.createElement('div');
                err.className = 'error-message';
                err.textContent = 'Text is required';
                txt.parentNode.insertBefore(err, txt.nextSibling);
                isValid = false;
            }
        }
        if (t === 'scroll') {
            const x1Input = f.querySelector('.coordinate-x1');
            const y1Input = f.querySelector('.coordinate-y1');
            const x2Input = f.querySelector('.coordinate-x2');
            const y2Input = f.querySelector('.coordinate-y2');
            const coordContainer = x1Input.closest('.coordinate-container');

            // Always validate coordinates for scroll actions
            if (!x1Input.value.trim() || !y1Input.value.trim() || !x2Input.value.trim() || !y2Input.value.trim()) {
                coordContainer.classList.add('field-error');
                // Add red outline to individual coordinate inputs
                [x1Input, y1Input, x2Input, y2Input].forEach(input => {
                    if (!input.value.trim()) {
                        input.classList.add('field-error');
                    }
                });
                const err = document.createElement('div');
                err.className = 'error-message';
                err.textContent = 'All bounding box coordinates are required';
                coordContainer.appendChild(err);
                isValid = false;
            } else {
                // Validate that the bounding box makes sense (x1 < x2, y1 < y2)
                const x1 = parseInt(x1Input.value);
                const y1 = parseInt(y1Input.value);
                const x2 = parseInt(x2Input.value);
                const y2 = parseInt(y2Input.value);

                if (x1 >= x2 || y1 >= y2) {
                    coordContainer.classList.add('field-error');
                    [x1Input, y1Input, x2Input, y2Input].forEach(input => {
                        input.classList.add('field-error');
                    });
                    const err = document.createElement('div');
                    err.className = 'error-message';
                    err.textContent = 'Invalid bounding box: top-left must be above and to the left of bottom-right';
                    coordContainer.appendChild(err);
                    isValid = false;
                }
            }
        }
        if (t === 'stop') {
            const ru = f.querySelector('.rule');
            if (!ru.value) {
                ru.classList.add('field-error');
                const err = document.createElement('div');
                err.className = 'error-message';
                err.textContent = 'Rule is required';
                ru.parentNode.insertBefore(err, ru.nextSibling);
                isValid = false;
            }
        }
        if (t === 'extract_content') {
            const content = f.querySelector('.page-content');
            if (!content.value.trim()) {
                content.classList.add('field-error');
                const err = document.createElement('div');
                err.className = 'error-message';
                err.textContent = 'Page content is required';
                content.parentNode.insertBefore(err, content.nextSibling);
                isValid = false;
            }
        }
    });
    return isValid;
}


function openAnnotateStepModal(agentId, stepIndex) {
    selectedAgent = agentId;
    selectedAgentStepIndex = stepIndex;

    // Reset fields
    document.getElementById('annotation-type-mistake').checked = true;
    document.getElementById('annotation-type-followup').checked = false;
    document.getElementById('actions-container').innerHTML = '';
    addActionRow();

    // Step data for request/response in the modal
    const stepData = data[agentId][stepIndex + 1];
    const imageContainer = document.getElementById('modal-image-container');
    imageContainer.classList.remove('no-image');
    imageContainer.innerHTML = `
                <div class="zoom-controls">
                    <button onclick="zoomImage(-0.1)">-</button>
                    <div class="zoom-level">100%</div>
                    <button onclick="zoomImage(0.1)">+</button>
                    <button onclick="resetZoom()">Reset</button>
                    <div class="image-dimensions">Loading...</div>
                </div>
                <div class="image-wrapper">
                    <div class="action-overlays-container"></div>
                </div>
                <div class="zoom-hint">Use mouse wheel to zoom, drag to pan when zoomed</div>
            `;
    if (stepData?.annotated_image) {
        const wrapper = imageContainer.querySelector('.image-wrapper');
        const img = document.createElement('img');
        img.src = getImagePath(stepData.annotated_image);
        img.alt = `Step ${stepIndex} Image`;
        img.style.position = 'relative';
        img.style.zIndex = '1';

        // Insert image before the overlays container
        const overlaysContainer = wrapper.querySelector('.action-overlays-container');
        wrapper.insertBefore(img, overlaysContainer);

        currentZoom = 0.95;
        translateX = 0;
        translateY = 0;
        updateImageTransform();
        updateZoomLevel();
        setupImageInteraction();

        // Initialize action overlays after image loads
        img.onload = () => {
            // Wait a frame to ensure image dimensions are properly calculated
            requestAnimationFrame(() => {
                updateCoordinateConstraints(); // Update input constraints based on image dimensions
                updateImageDimensions(); // Update the image dimensions display
                updateActionOverlays();
            });
        };
    } else {
        imageContainer.innerHTML = 'No image available for this step';
        imageContainer.classList.add('no-image');
    }



    document.getElementById('annotate-step-modal').classList.remove('hidden');

    // Show/hide delete button based on existing annotation
    const deleteBtn = document.getElementById('delete-step-annotation');
    const annotationKey = `${agentId}_${stepIndex}`;
    if (annotations.steps[annotationKey]) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => {
            if (confirm('Are you sure you want to delete this annotation?')) {
                delete annotations.steps[annotationKey];
                // If it's a planner step, also delete from plan
                if (agentId === '0') {
                    delete annotations.plan[stepIndex];
                }
                closeModal('annotate-step-modal');
                renderSideNav();
                updateDownloadButtonState();
                // Upload changes
                uploadAnnotations().catch(error => {
                    console.error('Failed to upload annotations:', error);
                });
            }
        };

        // Populate the modal with existing annotation data
        populateStepModal(annotations.steps[annotationKey]);
    } else {
        deleteBtn.style.display = 'none';
    }
}

/**
 * Updates action overlays on the step annotation modal image
 */
function updateActionOverlays() {
    const overlaysContainer = document.querySelector('#annotate-step-modal .action-overlays-container');
    const img = document.querySelector('#annotate-step-modal .image-wrapper img');

    if (!overlaysContainer || !img) return;

    // Wait for image to be loaded
    if (!img.complete || img.naturalWidth === 0) {
        img.onload = updateActionOverlays;
        return;
    }

    // Clear existing overlays
    overlaysContainer.innerHTML = '';

    // Ensure overlays container matches image dimensions and position
    const imgRect = img.getBoundingClientRect();
    const wrapperRect = img.parentElement.getBoundingClientRect();

    // Use the layout size directly – no division by currentZoom
    const baseWidth = img.offsetWidth;
    const baseHeight = img.offsetHeight;

    // Position the container where the image starts
    overlaysContainer.style.position = 'absolute';
    overlaysContainer.style.left = `${img.offsetLeft}px`;
    overlaysContainer.style.top = `${img.offsetTop}px`;
    overlaysContainer.style.width = `${baseWidth}px`;
    overlaysContainer.style.height = `${baseHeight}px`;

    // Get all action containers with valid bounding box coordinates
    const actionContainers = document.querySelectorAll('#annotate-step-modal .action-container');

    actionContainers.forEach((container, index) => {
        const actionType = container.querySelector('.action-type').value;
        const fieldsDiv = container.querySelector('.action-fields');

        // Only show overlays for actions that use bounding boxes
        if (!fieldsDiv || !['click', 'type', 'scroll'].includes(actionType)) return;

        const x1Input = fieldsDiv.querySelector('.coordinate-x1');
        const y1Input = fieldsDiv.querySelector('.coordinate-y1');
        const x2Input = fieldsDiv.querySelector('.coordinate-x2');
        const y2Input = fieldsDiv.querySelector('.coordinate-y2');

        // Check if all coordinates are filled
        if (!x1Input?.value || !y1Input?.value || !x2Input?.value || !y2Input?.value) return;

        const x1 = parseInt(x1Input.value);
        const y1 = parseInt(y1Input.value);
        const x2 = parseInt(x2Input.value);
        const y2 = parseInt(y2Input.value);

        // Create overlay element
        const overlay = document.createElement('div');
        overlay.className = 'action-overlay';
        overlay.dataset.actionIndex = index;

        // Calculate scale factors from natural image size to base displayed size (before zoom)
        const scaleX = baseWidth / img.naturalWidth;
        const scaleY = baseHeight / img.naturalHeight;

        // Convert coordinates from natural image coordinates to display coordinates
        const left = x1 * scaleX;
        const top = y1 * scaleY;
        const width = (x2 - x1) * scaleX;
        const height = (y2 - y1) * scaleY;

        // Debug logging
        if (DEBUG) console.log(`Action ${index + 1} (${actionType}):`, {
            original: { x1, y1, x2, y2 },
            imageSize: {
                natural: [img.naturalWidth, img.naturalHeight],
                base: [baseWidth, baseHeight],
                offset: [img.offsetWidth, img.offsetHeight],
                client: [img.clientWidth, img.clientHeight]
            },
            scale: { scaleX, scaleY },
            positioned: { left, top, width, height },
            currentZoom,
            currentTranslate: { translateX, translateY }
        });

        overlay.style.cssText = `
            position: absolute;
            left: ${left}px;
            top: ${top}px;
            width: ${width}px;
            height: ${height}px;
            border: 2px solid #4d9fff;
            background: rgba(77, 159, 255, 0.15);
            pointer-events: none;
            z-index: 10;
            transform-origin: top left;
            box-sizing: border-box;
            border-radius: 2px;
        `;

        // Create label
        const label = document.createElement('div');
        label.className = 'action-overlay-label';
        label.textContent = `Action ${index + 1}, ${actionType}`;
        label.style.cssText = `
            position: absolute;
            top: -30px;
            left: 0;
            background: #4d9fff;
            color: white;
            padding: 4px 12px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            min-width: fit-content;
            z-index: 11;
            line-height: 1.2;
        `;

        // Adjust label position if it would go outside the image
        if (top < 30) {
            label.style.top = `${height + 6}px`;
        }

        overlay.appendChild(label);
        overlaysContainer.appendChild(overlay);
    });

    // Apply current zoom and pan transformations
    updateOverlayTransforms(true); // Use immediate update when initially creating overlays
}


/******************************************************************
 * IMAGE ZOOM/PAN
 ******************************************************************/
function setupImageInteraction() {
    const imageWrapper = document.querySelector('.image-wrapper');
    const image = imageWrapper?.querySelector('img');
    if (!image) return;

    // Always (re)attach handlers tied to the current image wrapper
    imageWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        zoomImage(delta, e.offsetX, e.offsetY);
    });
    imageWrapper.addEventListener('mousedown', startDragging);

    // But only attach the global drag listeners once
    if (!window.__stepAnnotDragListenersAttached) {
        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', stopDragging);
        window.__stepAnnotDragListenersAttached = true;
    }
}

function startDragging(e) {
    if (currentZoom <= minZoom) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    e.preventDefault();
}
function drag(e) {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateImageTransform();
}
function stopDragging() {
    isDragging = false;
    // Immediately update overlays when dragging stops
    if (document.getElementById('annotate-step-modal') && !document.getElementById('annotate-step-modal').classList.contains('hidden')) {
        updateOverlayTransforms(true);
    }
}
function zoomImage(delta, x = null, y = null) {
    const newZoom = Math.max(minZoom, Math.min(5, currentZoom + delta));
    if (newZoom !== currentZoom) {
        if (x !== null && y !== null) {
            const scale = newZoom / currentZoom;
            translateX = x - (x - translateX) * scale;
            translateY = y - (y - translateY) * scale;
        }
        currentZoom = newZoom;
        updateImageTransform();
        updateZoomLevel();
        // Use debounced overlay refresh to avoid rebuild on every keystroke
        scheduleUpdateActionOverlays();
    }
}
function resetZoom() {
    currentZoom = 0.95; // Reset to initial zoom level, not 1.0
    translateX = 0;
    translateY = 0;
    updateImageTransform();
    updateZoomLevel();
    // Use debounced overlay refresh to avoid rebuild on every keystroke
    scheduleUpdateActionOverlays();
}
function updateImageTransform() {
    const img = document.querySelector('.image-wrapper img');
    if (img) {
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
    }
    // Update overlay transforms as well (immediate if not dragging)
    updateOverlayTransforms(!isDragging);
}
function updateZoomLevel() {
    const zl = document.querySelector('.zoom-level');
    if (zl) {
        zl.textContent = `${Math.round(currentZoom * 100)}%`;
    }
}

/**
 * Updates the image dimensions display
 */
function updateImageDimensions() {
    const img = document.querySelector('#annotate-step-modal .image-wrapper img');
    const dimensionsEl = document.querySelector('#annotate-step-modal .image-dimensions');

    if (img && dimensionsEl && img.complete && img.naturalWidth > 0) {
        dimensionsEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    } else if (dimensionsEl) {
        dimensionsEl.textContent = 'Loading...';
    }
}

function addActionRow() {
    const container = document.getElementById('actions-container');
    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-container';

    const header = document.createElement('div');
    header.className = 'action-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'action-name';
    nameSpan.textContent = `Task ${container.children.length + 1}`;

    // Collapse/expand button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-action-btn';
    collapseBtn.textContent = '▾'; // down arrow when expanded

    // Close (remove) button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-action-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = function () {
        actionContainer.remove();
        updateTaskNumbers();
    };

    // Group right-side buttons to keep flex layout tidy
    const btnGroup = document.createElement('div');
    btnGroup.className = 'action-header-buttons';
    btnGroup.appendChild(collapseBtn);
    btnGroup.appendChild(removeBtn);

    // Toggle collapse/expand behaviour
    collapseBtn.onclick = () => {
        const isCollapsed = actionContainer.classList.toggle('collapsed');
        contentDiv.style.display = isCollapsed ? 'none' : '';
        collapseBtn.textContent = isCollapsed ? '▸' : '▾'; // right arrow when collapsed
    };

    header.appendChild(nameSpan);
    header.appendChild(btnGroup);
    actionContainer.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'action-content';

    const selectEl = document.createElement('select');
    selectEl.className = 'action-type';
    ['click', 'type', 'scroll', 'stop', 'wait', 'refresh', 'extract_content', 'go_back', 'goto_url', 'key_press', 'read_texts_and_links'].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        selectEl.appendChild(o);
    });

    const fieldsDiv = document.createElement('div');
    fieldsDiv.className = 'action-fields';

    selectEl.addEventListener('change', () => {
        createActionFields(selectEl.value, fieldsDiv);
        // Update overlays when action type changes
        scheduleUpdateActionOverlays();
    });

    contentDiv.appendChild(selectEl);
    contentDiv.appendChild(fieldsDiv);
    actionContainer.appendChild(contentDiv);
    container.appendChild(actionContainer);

    // default is "click"
    createActionFields('click', fieldsDiv);

    // Scroll to the bottom so the newly added action is fully visible
    setTimeout(() => {
        const container = document.getElementById('actions-container');
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 0);

    // Update coordinate constraints if image is already loaded
    setTimeout(() => {
        updateCoordinateConstraints();
    }, 100);
}

function createActionFields(actionType, container) {
    container.innerHTML = '';

    if (actionType === 'click' || actionType === 'type') {
        const coordContainer = document.createElement('div');
        coordContainer.className = 'coordinate-container';

        // Create inputs but initially hide them
        const coordInputs = document.createElement('div');
        coordInputs.className = 'coordinate-inputs bounding-box-inputs hidden';

        // Top-left coordinates
        const tlContainer = document.createElement('div');
        tlContainer.className = 'coord-pair-container';

        const tlLabel = document.createElement('div');
        tlLabel.className = 'coord-pair-label';
        tlLabel.textContent = 'Top-Left';

        const tlInputs = document.createElement('div');
        tlInputs.className = 'coord-pair-inputs';

        const x1Input = document.createElement('input');
        x1Input.type = 'number';
        x1Input.className = 'coordinate-x1';
        x1Input.placeholder = 'X';
        x1Input.min = '0';
        setupCoordinateInput(x1Input, true); // true for X coordinate

        const y1Input = document.createElement('input');
        y1Input.type = 'number';
        y1Input.className = 'coordinate-y1';
        y1Input.placeholder = 'Y';
        y1Input.min = '0';
        setupCoordinateInput(y1Input, false); // false for Y coordinate

        tlInputs.appendChild(x1Input);
        tlInputs.appendChild(y1Input);
        tlContainer.appendChild(tlLabel);
        tlContainer.appendChild(tlInputs);

        // Bottom-right coordinates
        const brContainer = document.createElement('div');
        brContainer.className = 'coord-pair-container';

        const brLabel = document.createElement('div');
        brLabel.className = 'coord-pair-label';
        brLabel.textContent = 'Bottom-Right';

        const brInputs = document.createElement('div');
        brInputs.className = 'coord-pair-inputs';

        const x2Input = document.createElement('input');
        x2Input.type = 'number';
        x2Input.className = 'coordinate-x2';
        x2Input.placeholder = 'X';
        x2Input.min = '0';
        setupCoordinateInput(x2Input, true); // true for X coordinate

        const y2Input = document.createElement('input');
        y2Input.type = 'number';
        y2Input.className = 'coordinate-y2';
        y2Input.placeholder = 'Y';
        y2Input.min = '0';
        setupCoordinateInput(y2Input, false); // false for Y coordinate

        brInputs.appendChild(x2Input);
        brInputs.appendChild(y2Input);
        brContainer.appendChild(brLabel);
        brContainer.appendChild(brInputs);

        coordInputs.appendChild(tlContainer);
        coordInputs.appendChild(brContainer);

        const locateBtn = document.createElement('button');
        locateBtn.className = 'locate-coordinates-btn';
        locateBtn.textContent = 'Draw Bounding Box';
        locateBtn.onclick = () => {
            openBoundingBoxPickerModal(x1Input, y1Input, x2Input, y2Input, coordInputs);

            // Additional safety: listen for when the modal is closed and clear errors if coordinates are filled
            const checkAndClearErrors = () => {
                setTimeout(() => {
                    if (x1Input.value.trim() && y1Input.value.trim() && x2Input.value.trim() && y2Input.value.trim()) {
                        const coordContainer = x1Input.closest('.coordinate-container');
                        clearCoordinateValidationErrors(coordContainer);
                    }
                }, 200);
            };

            // Listen for modal closure
            setTimeout(() => {
                const pickerModal = document.getElementById('bounding-box-picker-modal');
                if (pickerModal) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                                for (let node of mutation.removedNodes) {
                                    if (node.id === 'bounding-box-picker-modal') {
                                        checkAndClearErrors();
                                        observer.disconnect();
                                        break;
                                    }
                                }
                            }
                        });
                    });
                    observer.observe(document.body, { childList: true });
                }
            }, 100);
        };

        coordContainer.appendChild(locateBtn);
        coordContainer.appendChild(coordInputs);
        container.appendChild(coordContainer);

        // Add click_count field for click action
        if (actionType === 'click') {
            const clickCountLabel = document.createElement('label');
            clickCountLabel.textContent = 'Click Count';
            clickCountLabel.className = 'coord-label';
            clickCountLabel.style.marginTop = '8px';
            const clickCountInput = document.createElement('input');
            clickCountInput.type = 'number';
            clickCountInput.className = 'click-count';
            clickCountInput.placeholder = 'Click count (default: 1)';
            clickCountInput.min = '1';
            clickCountInput.value = '1';
            const clickCountInputId = 'click-count-' + Date.now();
            clickCountInput.id = clickCountInputId;
            clickCountLabel.htmlFor = clickCountInputId;

            container.appendChild(clickCountLabel);
            container.appendChild(clickCountInput);
        }
    }

    if (actionType === 'type') {
        const ruleSel = document.createElement('select');
        ruleSel.className = 'rule';
        ['is', 'contain', 'not contain'].forEach(r => {
            const o = document.createElement('option');
            o.value = r;
            o.textContent = r;
            ruleSel.appendChild(o);
        });
        // Add validation clearing event listener
        ruleSel.addEventListener('change', () => {
            ruleSel.classList.remove('field-error');
            const errorMessage = ruleSel.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
        container.appendChild(ruleSel);

        const txt = document.createElement('input');
        txt.type = 'text';
        txt.className = 'text';
        txt.placeholder = 'Text to type';
        // Add validation clearing event listener
        txt.addEventListener('input', () => {
            txt.classList.remove('field-error');
            const errorMessage = txt.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
        container.appendChild(txt);

        const enterDiv = document.createElement('div');
        enterDiv.style.marginTop = '5px';
        const label = document.createElement('div');
        label.textContent = 'Press Enter after typing:';
        label.style.marginBottom = '5px';
        enterDiv.appendChild(label);

        const radioGroup = document.createElement('div');
        const r1 = document.createElement('input');
        r1.type = 'radio';
        r1.name = 'press-enter-' + Date.now();
        r1.value = 'true';
        r1.className = 'press-enter';
        const r1id = 'r1-' + Date.now();
        r1.id = r1id;

        const r1Label = document.createElement('label');
        r1Label.htmlFor = r1id;
        r1Label.textContent = 'Yes';
        r1Label.style.marginLeft = '5px';
        r1Label.style.marginRight = '15px';

        const r2 = document.createElement('input');
        r2.type = 'radio';
        r2.name = r1.name;
        r2.value = 'false';
        r2.className = 'press-enter';
        r2.checked = true;
        const r2id = 'r2-' + Date.now();
        r2.id = r2id;

        const r2Label = document.createElement('label');
        r2Label.htmlFor = r2id;
        r2Label.textContent = 'No';
        r2Label.style.marginLeft = '5px';

        radioGroup.appendChild(r1);
        radioGroup.appendChild(r1Label);
        radioGroup.appendChild(r2);
        radioGroup.appendChild(r2Label);

        enterDiv.appendChild(radioGroup);
        container.appendChild(enterDiv);
    }

    if (actionType === 'scroll') {
        const coordContainer = document.createElement('div');
        coordContainer.className = 'coordinate-container';

        // Create inputs but initially hide them
        const coordInputs = document.createElement('div');
        coordInputs.className = 'coordinate-inputs bounding-box-inputs hidden';

        // Top-left coordinates
        const tlContainer = document.createElement('div');
        tlContainer.className = 'coord-pair-container';

        const tlLabel = document.createElement('div');
        tlLabel.className = 'coord-pair-label';
        tlLabel.textContent = 'Top-Left';

        const tlInputs = document.createElement('div');
        tlInputs.className = 'coord-pair-inputs';

        const x1Input = document.createElement('input');
        x1Input.type = 'number';
        x1Input.className = 'coordinate-x1';
        x1Input.placeholder = 'X';
        x1Input.min = '0';
        setupCoordinateInput(x1Input, true); // true for X coordinate

        const y1Input = document.createElement('input');
        y1Input.type = 'number';
        y1Input.className = 'coordinate-y1';
        y1Input.placeholder = 'Y';
        y1Input.min = '0';
        setupCoordinateInput(y1Input, false); // false for Y coordinate

        tlInputs.appendChild(x1Input);
        tlInputs.appendChild(y1Input);
        tlContainer.appendChild(tlLabel);
        tlContainer.appendChild(tlInputs);

        // Bottom-right coordinates
        const brContainer = document.createElement('div');
        brContainer.className = 'coord-pair-container';

        const brLabel = document.createElement('div');
        brLabel.className = 'coord-pair-label';
        brLabel.textContent = 'Bottom-Right';

        const brInputs = document.createElement('div');
        brInputs.className = 'coord-pair-inputs';

        const x2Input = document.createElement('input');
        x2Input.type = 'number';
        x2Input.className = 'coordinate-x2';
        x2Input.placeholder = 'X';
        x2Input.min = '0';
        setupCoordinateInput(x2Input, true); // true for X coordinate

        const y2Input = document.createElement('input');
        y2Input.type = 'number';
        y2Input.className = 'coordinate-y2';
        y2Input.placeholder = 'Y';
        y2Input.min = '0';
        setupCoordinateInput(y2Input, false); // false for Y coordinate

        brInputs.appendChild(x2Input);
        brInputs.appendChild(y2Input);
        brContainer.appendChild(brLabel);
        brContainer.appendChild(brInputs);

        coordInputs.appendChild(tlContainer);
        coordInputs.appendChild(brContainer);

        const locateBtn = document.createElement('button');
        locateBtn.className = 'locate-coordinates-btn';
        locateBtn.textContent = 'Draw Bounding Box';
        locateBtn.onclick = () => {
            openBoundingBoxPickerModal(x1Input, y1Input, x2Input, y2Input, coordInputs);

            // Additional safety: listen for when the modal is closed and clear errors if coordinates are filled
            const checkAndClearErrors = () => {
                setTimeout(() => {
                    if (x1Input.value.trim() && y1Input.value.trim() && x2Input.value.trim() && y2Input.value.trim()) {
                        const coordContainer = x1Input.closest('.coordinate-container');
                        clearCoordinateValidationErrors(coordContainer);
                    }
                }, 200);
            };

            // Listen for modal closure
            setTimeout(() => {
                const pickerModal = document.getElementById('bounding-box-picker-modal');
                if (pickerModal) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                                for (let node of mutation.removedNodes) {
                                    if (node.id === 'bounding-box-picker-modal') {
                                        checkAndClearErrors();
                                        observer.disconnect();
                                        break;
                                    }
                                }
                            }
                        });
                    });
                    observer.observe(document.body, { childList: true });
                }
            }, 100);
        };

        coordContainer.appendChild(locateBtn);
        coordContainer.appendChild(coordInputs);
        container.appendChild(coordContainer);

        const dirSel = document.createElement('select');
        dirSel.className = 'direction';
        ['down', 'up'].forEach(d => {
            const o = document.createElement('option');
            o.value = d;
            o.textContent = d;
            dirSel.appendChild(o);
        });
        container.appendChild(dirSel);

        // Add amount field for scroll action
        const amountContainer = document.createElement('div');
        amountContainer.style.marginTop = '5px';

        const amountLabel = document.createElement('div');
        amountLabel.textContent = 'Scroll amount:';
        amountLabel.style.marginBottom = '5px';
        amountContainer.appendChild(amountLabel);

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.className = 'scroll-amount';
        amountInput.placeholder = 'Scroll amount';
        amountInput.value = '10';
        amountInput.min = '0';
        amountContainer.appendChild(amountInput);

        container.appendChild(amountContainer);
    }

    if (actionType === 'goto_url') {
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'url';
        urlInput.placeholder = 'Enter URL';
        container.appendChild(urlInput);
    }

    if (actionType === 'key_press') {
        const keyComboInput = document.createElement('input');
        keyComboInput.type = 'text';
        keyComboInput.className = 'key-combo';
        keyComboInput.placeholder = 'Enter key combination (e.g., Ctrl+A)';
        container.appendChild(keyComboInput);
    }

    if (actionType === 'stop') {
        const ruleSel = document.createElement('select');
        ruleSel.className = 'rule';
        ['is', 'contain', 'not contain'].forEach(r => {
            const o = document.createElement('option');
            o.value = r;
            o.textContent = r;
            ruleSel.appendChild(o);
        });
        // Add validation clearing event listener
        ruleSel.addEventListener('change', () => {
            ruleSel.classList.remove('field-error');
            const errorMessage = ruleSel.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
        container.appendChild(ruleSel);

        // Create input row container
        const inputRow = document.createElement('div');
        inputRow.className = 'input-row';
        container.appendChild(inputRow);

        const ans = document.createElement('textarea');
        ans.className = 'answer';
        ans.placeholder = 'Stop answer';
        ans.rows = 4;
        ans.style.width = '100%';
        // Add validation clearing event listener
        ans.addEventListener('input', () => {
            ans.classList.remove('field-error');
            const errorMessage = ans.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
        inputRow.appendChild(ans);

        // Add autofill button for stop action
        const autofillStopBtn = document.createElement('button');
        autofillStopBtn.textContent = 'Autofill';
        autofillStopBtn.className = 'autofill-btn';
        autofillStopBtn.onclick = () => handleAutofillStop(ruleSel, ans, container);
        inputRow.appendChild(autofillStopBtn);

        // Add loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'generate-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">
                Generating<span class="loading-dots"></span>
            </div>
        `;
        inputRow.appendChild(loadingOverlay);

        // Add feedback container (initially hidden)
        const feedbackContainer = document.createElement('div');
        feedbackContainer.className = 'feedback-container hidden';

        const feedbackInput = document.createElement('input');
        feedbackInput.type = 'text';
        feedbackInput.className = 'autofill-feedback-input';
        feedbackInput.placeholder = 'Provide feedback to refine the generated text...';

        const refineBtn = document.createElement('button');
        refineBtn.textContent = 'Refine with Feedback';
        refineBtn.className = 'refine-autofill-btn';
        refineBtn.onclick = () => handleRefineStop(ruleSel, ans, ans, feedbackInput);

        feedbackContainer.appendChild(feedbackInput);
        feedbackContainer.appendChild(refineBtn);
        container.appendChild(feedbackContainer);
    }

    if (actionType === 'extract_content') {
        // Create input row container
        const inputRow = document.createElement('div');
        inputRow.className = 'input-row';
        container.appendChild(inputRow);

        const textArea = document.createElement('textarea');
        textArea.className = 'page-content';
        textArea.placeholder = 'Page content to extract';
        textArea.rows = 4;
        textArea.style.width = '100%';
        // Add validation clearing event listener
        textArea.addEventListener('input', () => {
            textArea.classList.remove('field-error');
            const errorMessage = textArea.parentNode.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
        inputRow.appendChild(textArea);

        // Add autofill button for extract content
        const autofillBtn = document.createElement('button');
        autofillBtn.textContent = 'Autofill';
        autofillBtn.className = 'autofill-btn';
        autofillBtn.onclick = () => handleAutofillExtractContent(textArea, container);
        inputRow.appendChild(autofillBtn);

        // Add loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'generate-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">
                Generating<span class="loading-dots"></span>
            </div>
        `;
        inputRow.appendChild(loadingOverlay);

        // Add feedback container (initially hidden)
        const feedbackContainer = document.createElement('div');
        feedbackContainer.className = 'feedback-container hidden';

        const feedbackInput = document.createElement('input');
        feedbackInput.type = 'text';
        feedbackInput.className = 'autofill-feedback-input';
        feedbackInput.placeholder = 'Provide feedback to refine the generated text...';

        const refineBtn = document.createElement('button');
        refineBtn.textContent = 'Refine with Feedback';
        refineBtn.className = 'refine-autofill-btn';
        refineBtn.onclick = () => handleRefineExtractContent(textArea, textArea, feedbackInput);

        feedbackContainer.appendChild(feedbackInput);
        feedbackContainer.appendChild(refineBtn);
        container.appendChild(feedbackContainer);
    }

    // Add thoughts and grounding instruction fields for all action types
    const thoughtsContainer = document.createElement('div');
    thoughtsContainer.style.display = 'flex';
    thoughtsContainer.style.justifyContent = 'space-between';
    thoughtsContainer.style.alignItems = 'center';
    thoughtsContainer.style.marginTop = '12px';

    const thoughtsLabel = document.createElement('label');
    thoughtsLabel.textContent = 'Thoughts';
    thoughtsLabel.className = 'coord-label';

    const generateThoughtsBtn = document.createElement('button');
    generateThoughtsBtn.textContent = 'Generate Thoughts';
    generateThoughtsBtn.className = 'generate-thoughts-btn';
    generateThoughtsBtn.title = 'Needs Implementing';
    generateThoughtsBtn.onclick = () => {
        // TODO: Implement generate thoughts functionality
        //       Currently waiting on endpoint to be implemented.
    };

    thoughtsContainer.appendChild(thoughtsLabel);
    thoughtsContainer.appendChild(generateThoughtsBtn);

    const thoughtsInput = document.createElement('textarea');
    thoughtsInput.className = 'action-thoughts';
    thoughtsInput.rows = 2;
    thoughtsInput.placeholder = 'Step thoughts...';
    const thoughtsInputId = 'thoughts-' + Date.now() + '-' + Math.random();
    thoughtsInput.id = thoughtsInputId;
    thoughtsLabel.htmlFor = thoughtsInputId;

    const groundingLabel = document.createElement('label');
    groundingLabel.textContent = 'Single-step grounding instruction';
    groundingLabel.className = 'coord-label';
    groundingLabel.style.marginTop = '8px';

    const groundingInput = document.createElement('textarea');
    groundingInput.className = 'action-grounding';
    groundingInput.rows = 2;
    groundingInput.placeholder = 'Step grounding instruction...';
    const groundingInputId = 'grounding-' + Date.now() + '-' + Math.random();
    groundingInput.id = groundingInputId;
    groundingLabel.htmlFor = groundingInputId;

    const feedbackLabel = document.createElement('label');
    feedbackLabel.textContent = 'Feedback';
    feedbackLabel.className = 'coord-label';
    feedbackLabel.style.marginTop = '8px';

    const feedbackInput = document.createElement('textarea');
    feedbackInput.className = 'action-feedback';
    feedbackInput.rows = 2;
    feedbackInput.placeholder = 'Optional feedback...';
    const feedbackInputId = 'feedback-' + Date.now() + '-' + Math.random();
    feedbackInput.id = feedbackInputId;
    feedbackLabel.htmlFor = feedbackInputId;

    container.appendChild(thoughtsContainer);
    container.appendChild(thoughtsInput);
    container.appendChild(groundingLabel);
    container.appendChild(groundingInput);
    container.appendChild(feedbackLabel);
    container.appendChild(feedbackInput);

    // Event listeners are now handled by setupCoordinateInput function
}

// Debounce overlay updates during dragging
let overlayUpdateTimeout = null;

/**
 * Updates the transform of action overlays to match image zoom/pan
 */
function updateOverlayTransforms(immediate = false) {
    const overlaysContainer = document.querySelector('#annotate-step-modal .action-overlays-container');

    if (!overlaysContainer) return;

    const doUpdate = () => {
        // Apply the same transform to the entire overlays container as the image
        overlaysContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
        overlaysContainer.style.transformOrigin = 'top left';

        // Debug logging for transform
        if (DEBUG) console.log('Updating overlay transforms:', {
            translateX,
            translateY,
            currentZoom,
            transform: `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`
        });
    };

    if (immediate || !isDragging) {
        // Clear any pending timeout
        if (overlayUpdateTimeout) {
            clearTimeout(overlayUpdateTimeout);
            overlayUpdateTimeout = null;
        }
        doUpdate();
    } else {
        // Debounce updates during dragging
        if (overlayUpdateTimeout) {
            clearTimeout(overlayUpdateTimeout);
        }
        overlayUpdateTimeout = setTimeout(doUpdate, 16); // ~60fps
    }
}

/**
 * Manually clears validation errors for a coordinate container
 */
function clearCoordinateValidationErrors(coordContainer) {
    if (!coordContainer) return;

    // Remove field-error class from container
    coordContainer.classList.remove('field-error');

    // Remove field-error class from all coordinate inputs in this container
    const allInputs = coordContainer.querySelectorAll('.coordinate-x1, .coordinate-y1, .coordinate-x2, .coordinate-y2');
    allInputs.forEach(input => input.classList.remove('field-error'));

    // Remove any error messages in this container
    const errorMessages = coordContainer.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
}

/**
 * Sets up event listeners for coordinate inputs to clear validation errors on focus
 */
function setupCoordinateInput(input) {
    // Ensure no negative numbers are allowed at the browser level
    if (input.type === 'number' && (input.min === '' || Number(input.min) < 0)) {
        input.min = '0';
    }
    // Clear validation errors when user starts typing or pasting
    const clearValidationErrors = () => {
        input.classList.remove('field-error');
        const coordContainer = input.closest('.coordinate-container');
        if (coordContainer) {
            // Check if all coordinate inputs in this container are now valid
            const allInputs = coordContainer.querySelectorAll('.coordinate-x1, .coordinate-y1, .coordinate-x2, .coordinate-y2');
            const hasEmptyInputs = Array.from(allInputs).some(inp => !inp.value.trim());

            if (!hasEmptyInputs) {
                // Remove field-error class from container and all inputs
                coordContainer.classList.remove('field-error');
                allInputs.forEach(inp => inp.classList.remove('field-error'));

                // Remove any error messages in this container
                const errorMessages = coordContainer.querySelectorAll('.error-message');
                errorMessages.forEach(msg => msg.remove());
            }
        }
    };

    const enforceConstraints = () => {
        if (input.value.trim() === '') return;

        const value = Number(input.value);
        const min   = Number(input.min) || 0;                          // clamp floor
        const max   = input.max !== '' ? Number(input.max) : Infinity; // clamp ceiling

        // clamp value into [min, max]
        const clamped = Math.min(Math.max(value, min), max);
        if (clamped !== value) {
            input.value = clamped;
        }

        // Use debounced overlay refresh to avoid rebuild on every keystroke
        scheduleUpdateActionOverlays();
    };
    input.addEventListener('input', () => {
        clearValidationErrors();
        // Add a small delay to let the user finish typing
        setTimeout(enforceConstraints, 100);
    });
    input.addEventListener('paste', () => {
        // Use setTimeout to wait for paste to complete
        setTimeout(() => {
            clearValidationErrors();
            enforceConstraints();
        }, 10);
    });
    input.addEventListener('change', () => {
        clearValidationErrors();
        enforceConstraints();
    });
    input.addEventListener('blur', enforceConstraints);
}

/**
 * Updates coordinate input constraints based on loaded image dimensions
 */
function updateCoordinateConstraints() {
    const img = document.querySelector('#annotate-step-modal .image-wrapper img');
    if (!img || !img.complete || img.naturalWidth === 0) return;

    // Update min/max constraints for all coordinate inputs
    const xInputs = document.querySelectorAll('#annotate-step-modal .coordinate-x1, #annotate-step-modal .coordinate-x2');
    const yInputs = document.querySelectorAll('#annotate-step-modal .coordinate-y1, #annotate-step-modal .coordinate-y2');

    xInputs.forEach(input => {
        input.min = '0';
        input.max = img.naturalWidth.toString();

        /* NEW: immediately clamp any pre-existing value */
        if (input.value.trim() !== '') {
            const v = Number(input.value);
            const clamped = Math.min(Math.max(v, 0), img.naturalWidth);
            if (clamped !== v) input.value = clamped;
        }
    });

    yInputs.forEach(input => {
        input.min = '0';
        input.max = img.naturalHeight.toString();

        /* NEW: immediately clamp any pre-existing value */
        if (input.value.trim() !== '') {
            const v = Number(input.value);
            const clamped = Math.min(Math.max(v, 0), img.naturalHeight);
            if (clamped !== v) input.value = clamped;
        }
    });
}

/**
 * Updates task numbers after removing an action
 */
function updateTaskNumbers() {
    const actionContainers = document.querySelectorAll('#actions-container .action-container');
    actionContainers.forEach((container, index) => {
        const nameSpan = container.querySelector('.action-name');
        if (nameSpan) {
            nameSpan.textContent = `Task ${index + 1}`;
        }
    });
}

// Auto-initialize when the script loads (if DOM is ready)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStepAnnotationModal);
} else {
    // DOM is already loaded
    initStepAnnotationModal();
}

// Debounced wrapper to avoid rebuilding overlays too often when typing/scrolling
const scheduleUpdateActionOverlays = debounce(() => {
    const modal = document.getElementById('annotate-step-modal');
    if (modal && !modal.classList.contains('hidden')) {
        updateActionOverlays();
    }
}, 120);
