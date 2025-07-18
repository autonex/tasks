// Zoom/pan for step images
let startX, startY, translateX = 0, translateY = 0;

function openBoundingBoxPickerModal(x1Input, y1Input, x2Input, y2Input, coordInputs) {
    // Remove any existing picker modal
    const existingModal = document.getElementById('bounding-box-picker-modal');
    if (existingModal) existingModal.remove();

    // Get the current step's image
    const stepData = data[selectedAgent][selectedAgentStepIndex + 1];
    if (!stepData?.annotated_image) {
        alert('No image available for this step');
        return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'bounding-box-picker-modal';
    modal.className = 'modal bounding-box-picker-modal';

    modal.innerHTML = `
        <div class="bounding-modal-content">
            <div class="modal-header">
                <button class="close-modal-btn" onclick="closeModal('bounding-box-picker-modal')">&times;</button>
                <h3>Draw Bounding Box</h3>
                <div class="instructions">Click and drag to draw a bounding box around the target area</div>
            </div>
            <div class="modal-body">
                <div class="image-container" style="position: relative; display: inline-block;">
                    <img src="${getImagePath(stepData.annotated_image)}"
                         alt="Draw bounding box"
                         style="cursor: crosshair; position: relative; user-select: none;">
                    <div class="bounding-box" style="position: absolute; border: 2px solid #ff4757; background: rgba(255, 71, 87, 0.1); display: none; z-index: 10;"></div>
                    <div class="coordinates-display" style="position: absolute; background: rgba(0,0,0,0.9); color: white; padding: 6px 10px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 11; display: none; white-space: nowrap;"></div>
                </div>
                <div class="modal-footer">
                    <button class="clear-box-btn" onclick="selectEntireImage()" style="margin-right: 10px;">Full Screen Select</button>
                    <button class="clear-box-btn" onclick="clearBoundingBox()" style="margin-right: 10px;">Clear Box</button>
                    <button class="save-box-btn" onclick="saveBoundingBox()" disabled>Save Bounding Box</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup bounding box drawing
    const img = modal.querySelector('img');
    const boundingBox = modal.querySelector('.bounding-box');
    const coordDisplay = modal.querySelector('.coordinates-display');
    const saveBtn = modal.querySelector('.save-box-btn');

    let isDrawing = false;
    let startX, startY, currentBox = null;

    // Store inputs in modal for access by global functions
    modal.x1Input = x1Input;
    modal.y1Input = y1Input;
    modal.x2Input = x2Input;
    modal.y2Input = y2Input;

    img.onload = () => {
        const scaleX = img.naturalWidth / img.clientWidth;
        const scaleY = img.naturalHeight / img.clientHeight;

        // Mouse down - start drawing
        img.onmousedown = (e) => {
            e.preventDefault();
            isDrawing = true;
            const rect = img.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;

            boundingBox.style.left = startX + 'px';
            boundingBox.style.top = startY + 'px';
            boundingBox.style.width = '0px';
            boundingBox.style.height = '0px';
            boundingBox.style.display = 'block';
        };

        // Mouse move - update box size (allow dragging beyond image boundaries)
        document.onmousemove = (e) => {
            const rect = img.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            if (isDrawing) {
                // Allow coordinates beyond image boundaries for easier selection
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                const left = Math.min(currentX, startX);
                const top = Math.min(currentY, startY);

                // Clamp visual box to image boundaries for display
                const clampedLeft = Math.max(0, Math.min(left, img.clientWidth));
                const clampedTop = Math.max(0, Math.min(top, img.clientHeight));
                const clampedRight = Math.max(0, Math.min(left + width, img.clientWidth));
                const clampedBottom = Math.max(0, Math.min(top + height, img.clientHeight));
                const clampedWidth = clampedRight - clampedLeft;
                const clampedHeight = clampedBottom - clampedTop;

                boundingBox.style.left = clampedLeft + 'px';
                boundingBox.style.top = clampedTop + 'px';
                boundingBox.style.width = clampedWidth + 'px';
                boundingBox.style.height = clampedHeight + 'px';

                // Calculate image coordinates (will be clamped on mouseup)
                const x1 = Math.round(left * scaleX);
                const y1 = Math.round(top * scaleY);
                const x2 = Math.round((left + width) * scaleX);
                const y2 = Math.round((top + height) * scaleY);

                // Position coordinate display near cursor; if too close to the
                // right edge of the image, flip it to the left so the container
                // width never grows (avoids image resize/jank).
                coordDisplay.style.display = 'block';
                coordDisplay.textContent = `Box: (${x1}, ${y1}) to (${x2}, ${y2})`;

                // Measure after text is set to get accurate width
                const displayWidth = coordDisplay.offsetWidth;
                let displayX = currentX + 10; // default: to the right of cursor
                if (displayX + displayWidth > img.clientWidth - 10) {
                    displayX = currentX - displayWidth - 10; // flip to left
                }
                displayX = Math.max(10, displayX); // never go off left edge

                const displayY = Math.max(10, currentY - 30);

                coordDisplay.style.left = displayX + 'px';
                coordDisplay.style.top = displayY + 'px';

                // Store current box data (unclamped for now)
                currentBox = { x1, y1, x2, y2 };
            } else if (currentX >= 0 && currentX <= img.clientWidth && currentY >= 0 && currentY <= img.clientHeight) {
                // Only show position when cursor is over the image
                const x = Math.round(currentX * scaleX);
                const y = Math.round(currentY * scaleY);
                coordDisplay.style.display = 'block';
                coordDisplay.textContent = `Position: (${x}, ${y})`;

                // Re-compute width after setting text
                const txtWidth = coordDisplay.offsetWidth;
                let posX = currentX + 10;
                if (posX + txtWidth > img.clientWidth - 10) {
                    posX = currentX - txtWidth - 10;
                }
                posX = Math.max(10, posX);

                coordDisplay.style.left = posX + 'px';
                coordDisplay.style.top = (currentY - 30) + 'px';
            } else {
                // Hide coordinate display when cursor is outside image and not drawing
                coordDisplay.style.display = 'none';
            }
        };

        // Mouse up - finish drawing (works anywhere on document)
        document.onmouseup = (e) => {
            if (isDrawing) {
                isDrawing = false;
                // Don't clean up handlers here - allow multiple selections

                if (currentBox && currentBox.x1 !== currentBox.x2 && currentBox.y1 !== currentBox.y2) {
                    // Ensure coordinates are in correct order (top-left to bottom-right)
                    let normalizedBox = {
                        x1: Math.min(currentBox.x1, currentBox.x2),
                        y1: Math.min(currentBox.y1, currentBox.y2),
                        x2: Math.max(currentBox.x1, currentBox.x2),
                        y2: Math.max(currentBox.y1, currentBox.y2)
                    };

                    // Clamp coordinates to image boundaries
                    normalizedBox = {
                        x1: Math.max(0, Math.min(normalizedBox.x1, img.naturalWidth)),
                        y1: Math.max(0, Math.min(normalizedBox.y1, img.naturalHeight)),
                        x2: Math.max(0, Math.min(normalizedBox.x2, img.naturalWidth)),
                        y2: Math.max(0, Math.min(normalizedBox.y2, img.naturalHeight))
                    };

                    currentBox = normalizedBox;

                    // Update the visual bounding box to match final clamped coordinates
                    const left = normalizedBox.x1 / scaleX;
                    const top = normalizedBox.y1 / scaleY;
                    const width = (normalizedBox.x2 - normalizedBox.x1) / scaleX;
                    const height = (normalizedBox.y2 - normalizedBox.y1) / scaleY;

                    boundingBox.style.left = left + 'px';
                    boundingBox.style.top = top + 'px';
                    boundingBox.style.width = width + 'px';
                    boundingBox.style.height = height + 'px';

                    saveBtn.disabled = false;
                    // Update coordinate display to show final clamped box
                    coordDisplay.textContent = `Box: (${currentBox.x1}, ${currentBox.y1}) to (${currentBox.x2}, ${currentBox.y2})`;
                } else {
                    // Box too small, clear it
                    clearBoundingBox();
                }
            }
        };

        // Mouse leave - hide coordinate display
        img.onmouseleave = () => {
            if (!isDrawing) {
                coordDisplay.style.display = 'none';
            }
        };

        // Load existing bounding box if coordinates are already set
        if (x1Input.value && y1Input.value && x2Input.value && y2Input.value) {
            const x1 = parseInt(x1Input.value);
            const y1 = parseInt(y1Input.value);
            const x2 = parseInt(x2Input.value);
            const y2 = parseInt(y2Input.value);

            // Convert to display coordinates
            const left = x1 / scaleX;
            const top = y1 / scaleY;
            const width = (x2 - x1) / scaleX;
            const height = (y2 - y1) / scaleY;

            boundingBox.style.left = left + 'px';
            boundingBox.style.top = top + 'px';
            boundingBox.style.width = width + 'px';
            boundingBox.style.height = height + 'px';
            boundingBox.style.display = 'block';

            currentBox = { x1, y1, x2, y2 };
            saveBtn.disabled = false;
        }
    };

    // Make functions globally accessible for onclick handlers
    window.clearBoundingBox = () => {
        boundingBox.style.display = 'none';
        coordDisplay.style.display = 'none';
        currentBox = null;
        saveBtn.disabled = true;
        // Reset drawing state but keep handlers active for new selections
        isDrawing = false;
    };

     // Make functions globally accessible for onclick handlers
     window.selectEntireImage = () => {
        // Get the full image dimensions
        const fullWidth = img.naturalWidth;
        const fullHeight = img.naturalHeight;

        currentBox = { x1: 0, y1: 0, x2: fullWidth, y2: fullHeight };

        // Update the visual bounding box to cover the entire image
        boundingBox.style.left = '0px';
        boundingBox.style.top = '0px';
        boundingBox.style.width = img.clientWidth + 'px';
        boundingBox.style.height = img.clientHeight + 'px';
        boundingBox.style.display = 'block';

        // Update coordinate display
        coordDisplay.style.display = 'block';
        coordDisplay.style.left = '10px';
        coordDisplay.style.top = '10px';
        coordDisplay.textContent = `Box: (0, 0) to (${fullWidth}, ${fullHeight})`;

        saveBtn.disabled = false;
    };

    window.saveBoundingBox = () => {
        if (currentBox) {
            // Ensure coordinates are properly clamped to image boundaries before saving
            const clampedBox = {
                x1: Math.max(0, Math.min(currentBox.x1, img.naturalWidth)),
                y1: Math.max(0, Math.min(currentBox.y1, img.naturalHeight)),
                x2: Math.max(0, Math.min(currentBox.x2, img.naturalWidth)),
                y2: Math.max(0, Math.min(currentBox.y2, img.naturalHeight))
            };

            // Ensure coordinates are in correct order (x1 <= x2, y1 <= y2)
            const finalBox = {
                x1: Math.min(clampedBox.x1, clampedBox.x2),
                y1: Math.min(clampedBox.y1, clampedBox.y2),
                x2: Math.max(clampedBox.x1, clampedBox.x2),
                y2: Math.max(clampedBox.y1, clampedBox.y2)
            };

            // Set the properly clamped values
            x1Input.value = finalBox.x1;
            y1Input.value = finalBox.y1;
            x2Input.value = finalBox.x2;
            y2Input.value = finalBox.y2;

            // Trigger change events to clear validation errors
            [x1Input, y1Input, x2Input, y2Input].forEach(input => {
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });

            // Show the coordinate inputs after saving
            if (coordInputs) {
                coordInputs.classList.remove('hidden');
            }

            // Update action overlays if we're in the step annotation modal
            setTimeout(() => {
                if (document.getElementById('annotate-step-modal') && !document.getElementById('annotate-step-modal').classList.contains('hidden')) {
                    updateActionOverlays();
                }
            }, 100);

            closeModal('bounding-box-picker-modal');
        }
    };

    // Add cleanup when modal is closed
    modal.addEventListener('remove', () => {
        // Clean up global event handlers
        document.onmousemove = null;
        document.onmouseup = null;
        isDrawing = false;
    });

    // Override the default close behavior to include cleanup
    const originalCloseModal = window.closeModal;
    window.closeModal = (modalId) => {
        if (modalId === 'bounding-box-picker-modal') {
            // Clean up global event handlers
            document.onmousemove = null;
            document.onmouseup = null;
            isDrawing = false;
        }
        if (originalCloseModal) {
            originalCloseModal(modalId);
        }
    };
}
