// Current selections
let selectedPlannerStep = null;
let selectedAgent = null;
let selectedAgentStepIndex = null;

// Global variable to track what we're currently annotating
let currentAnnotationType = null;
let currentAnnotationId = null;

/******************************************************************
 * RENDER SIDE NAV
 ******************************************************************/
function renderSideNav() {
    const container = document.getElementById('side-nav-content');
    container.innerHTML = '';

    const plannerData = data['0'];
    if (!plannerData || plannerData.length <= 1) {
        container.innerHTML = '<p style="padding:10px;">No Planner steps found.</p>';
        return;
    }

    // Add parent Planner item
    const plannerItem = document.createElement('div');
    plannerItem.className = 'step-item parent-step';
    plannerItem.dataset.stepId = 'planner_main';
    plannerItem.innerHTML = `
                <span class="parent-step-icon">▼</span>
                <span class="parent-step-text">Planner</span>
            `;

    plannerItem.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSelections();
        plannerItem.classList.add('selected');
        showAllContent();  // First show all content
        // Scroll main content to top
        document.getElementById('main-content').scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    container.appendChild(plannerItem);

    /******************************************************************
     *  QUEUE AGENTS BY TASK  (run once at the top of renderSideNav)
     ******************************************************************/
    const taskQueues = {};          // { "<taskText>": [ "1", "2", "3", … ] }

    Object.entries(data).forEach(([aid, arr]) => {
        if (aid === '0') return;      // skip the planner-root
        const task = arr?.[0]?.task;
        if (!task) return;

        if (!taskQueues[task]) taskQueues[task] = [];
        taskQueues[task].push(aid);
    });

    /* keep the numeric order you already rely on (1,2,3,…) */
    Object.values(taskQueues).forEach(q =>
        q.sort((a, b) => parseInt(a) - parseInt(b))
    );

    // For each planner step
    for (let i = 1; i < plannerData.length; i++) {
        const stepIndex = i - 1;
        const stepItem = document.createElement('div');
        stepItem.className = 'step-item';
        stepItem.dataset.stepId = stepIndex;
        stepItem.textContent = `Step ${stepIndex}`;

        // Show "Annotated" if we have an annotation
        const annotationKey = `0_${stepIndex}`;
        if (annotations.steps[annotationKey]) {
            const annSpan = document.createElement('span');
            annSpan.className = 'edited-label';
            annSpan.textContent = 'Annotated';
            stepItem.appendChild(annSpan);
        }

        stepItem.addEventListener('click', (e) => {
            e.stopPropagation();
            clearSelections();
            stepItem.classList.add('selected');
            selectedPlannerStep = stepIndex;
            showAllContent();  // First show all content
            setTimeout(() => scrollToContent(`0_${stepIndex}`), 100);  // Small delay to ensure content is rendered
        });

        // Nested sub-agents
        const subAgentList = document.createElement('div');
        subAgentList.className = 'nested-agent-list expanded';

        // Identify sub agents from run_navigator
        const stepData = plannerData[i];
        const navTools = stepData?.response?.tools?.filter(t => t.name === 'run_navigator') || [];

        navTools.forEach(tool => {
            const subtaskTask = tool.arguments?.task;
            const queue = taskQueues[subtaskTask] || [];

            // ≡ pop the *next* agent for this task
            const foundAgentId = queue.length ? queue.shift() : null;
            if (!foundAgentId) return;    // nothing left to show

            const agentItem = document.createElement('div');
            agentItem.className = 'nested-agent-item';
            agentItem.dataset.agentId = foundAgentId;

            const agentDiv = document.createElement('div');
            agentDiv.className = 'agent-content';

            const agentName = document.createElement('span');
            agentName.className = 'agent-name';
            agentName.textContent = `Agent ${foundAgentId}`;
            agentDiv.appendChild(agentName);

            // Subtask annotation?
            if (annotations.subtasks[foundAgentId]) {
                const annSpan = document.createElement('span');
                annSpan.className = 'edited-label';
                annSpan.textContent = 'Annotated';
                agentDiv.appendChild(annSpan);
            }

            agentItem.appendChild(agentDiv);

            agentItem.addEventListener('click', (e) => {
                e.stopPropagation();
                clearSelections();
                stepItem.classList.add('selected');
                agentItem.classList.add('selected');
                selectedAgent = foundAgentId;
                showAllContent();  // First show all content
                setTimeout(() => scrollToContent(`agent_${foundAgentId}`), 100);  // Small delay to ensure content is rendered
            });

            // Nested steps for that agent
            const nestedStepList = document.createElement('div');
            nestedStepList.className = 'nested-step-list expanded';

            const agentData = data[foundAgentId];
            if (agentData && agentData.length > 1) {
                for (let j = 1; j < agentData.length; j++) {
                    const agentStepIndex = j - 1;
                    const agentStepItem = document.createElement('div');
                    agentStepItem.className = 'nested-step-item';
                    agentStepItem.dataset.stepId = `${foundAgentId}_${agentStepIndex}`;
                    agentStepItem.textContent = `Step ${agentStepIndex}`;

                    // Step annotation?
                    const aKey = `${foundAgentId}_${agentStepIndex}`;
                    if (annotations.steps[aKey]) {
                        const annSpan = document.createElement('span');
                        annSpan.className = 'edited-label';
                        annSpan.textContent = 'Annotated';
                        agentStepItem.appendChild(annSpan);
                    }

                    agentStepItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        clearSelections();
                        stepItem.classList.add('selected');
                        agentItem.classList.add('selected');
                        agentStepItem.classList.add('selected');
                        selectedAgent = foundAgentId;
                        selectedAgentStepIndex = agentStepIndex;
                        showAllContent();  // First show all content
                        setTimeout(() => scrollToContent(`${foundAgentId}_${agentStepIndex}`), 100);  // Small delay to ensure content is rendered
                    });

                    nestedStepList.appendChild(agentStepItem);
                }
            }
            agentItem.appendChild(nestedStepList);
            subAgentList.appendChild(agentItem);
        });

        container.appendChild(stepItem);
        container.appendChild(subAgentList);
    }

    // Create status indicator in the side nav footer
    const statusFooter = document.getElementById('side-nav-footer');
    if (statusFooter) {
        // Add task header above the status button
        const taskText = data['0']?.[0]?.task || 'ERROR';
        const executionTimeText = data['0']?.[0]?.timestamp || 'N/A';

        const taskHeader = document.createElement('div');
        taskHeader.className = 'task-floating-info';
        taskHeader.innerHTML = `
            <div class="task-text">Task: "${taskText}"</div>
            <div class="execution-time">Execution Time: ${executionTimeText}</div>
        `;

        const statusBtn = document.createElement('button');
        statusBtn.id = 'status-indicator-btn';
        statusBtn.className = 'status-indicator-btn';
        statusBtn.onclick = function () { editTrajectoryStatus(); };

        statusFooter.innerHTML = ''; // Clear existing content
        statusFooter.appendChild(taskHeader);
        statusFooter.appendChild(statusBtn);

        // Initialize the status
        updateStatusIndicatorButton();
    }

    // Initialize scroll tracking
    setTimeout(initializeScrollTracking, 100);
}

function clearSelections() {
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
}

function addBoundingBoxAnnotation(imageContainer, x1, y1, x2, y2) {
    const originalImg = imageContainer.querySelector('img');
    const computedStyle = window.getComputedStyle(originalImg);

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
                position: relative;
                display: inline-block;
                line-height: 0;
            `;

    // Clone the image
    const img = originalImg.cloneNode(true);

    // Create SVG overlay with same styles as image
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // Copy relevant styles from image to SVG
    ['margin', 'padding', 'display', 'border', 'borderRadius']
        .forEach(style => {
            svg.style[style] = computedStyle[style];
        });

    // Add overlay positioning
    svg.style.cssText += `
                position: absolute;
                top: 0;
                left: 0;
                pointer-events: none;
                z-index: 1;
            `;

    // Create bounding box rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'rgba(77, 159, 255, 0.2)'); // Semi-transparent bright blue fill
    rect.setAttribute('stroke', '#4d9fff'); // Bright blue stroke
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '5,5'); // Dashed line
    rect.setAttribute('filter', 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'); // Add subtle shadow

    // Add a pulsing animation to the stroke
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'stroke-opacity');
    animate.setAttribute('values', '0.8;1;0.8');
    animate.setAttribute('dur', '2s');
    animate.setAttribute('repeatCount', 'indefinite');
    rect.appendChild(animate);

    // Function to update rectangle position
    const updatePosition = () => {
        const imgRect = img.getBoundingClientRect();
        const scale = imgRect.width / img.naturalWidth;

        const scaledX1 = x1 * scale;
        const scaledY1 = y1 * scale;
        const scaledX2 = x2 * scale;
        const scaledY2 = y2 * scale;

        rect.setAttribute('x', scaledX1);
        rect.setAttribute('y', scaledY1);
        rect.setAttribute('width', scaledX2 - scaledX1);
        rect.setAttribute('height', scaledY2 - scaledY1);
        svg.setAttribute('viewBox', `0 0 ${imgRect.width} ${imgRect.height}`);
    };

    // Add elements to DOM
    svg.appendChild(rect);
    wrapper.appendChild(img);
    wrapper.appendChild(svg);
    originalImg.replaceWith(wrapper);

    // Initial position update
    if (img.complete) {
        updatePosition();
    } else {
        img.onload = updatePosition;
    }

    // Handle resizing
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(wrapper);
    resizeObserver.observe(img);

    // Return cleanup function
    return () => {
        resizeObserver.disconnect();
        wrapper.replaceWith(originalImg);
    };
}

// Keep the old function for backward compatibility and legacy data
function addCircleAnnotation(imageContainer, x, y, radius = 8) {
    const originalImg = imageContainer.querySelector('img');
    const computedStyle = window.getComputedStyle(originalImg);

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
                position: relative;
                display: inline-block;
                line-height: 0;
            `;

    // Clone the image
    const img = originalImg.cloneNode(true);

    // Create SVG overlay with same styles as image
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // Copy relevant styles from image to SVG
    ['margin', 'padding', 'display', 'border', 'borderRadius']
        .forEach(style => {
            svg.style[style] = computedStyle[style];
        });

    // Add overlay positioning
    svg.style.cssText += `
                position: absolute;
                top: 0;
                left: 0;
                pointer-events: none;
                z-index: 1;
            `;

    // Create circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('fill', '#4d9fff80'); // Semi-transparent bright blue fill
    circle.setAttribute('stroke', '#ffffff'); // White outer stroke
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('stroke-opacity', '0.8');
    circle.setAttribute('filter', 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'); // Add subtle shadow

    // Add a pulsing animation
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'r');
    animate.setAttribute('values', `${radius};${radius * 1.5};${radius}`);
    animate.setAttribute('dur', '1.5s');
    animate.setAttribute('repeatCount', 'indefinite');
    circle.appendChild(animate);

    // Function to update circle position
    const updatePosition = () => {
        const rect = img.getBoundingClientRect();
        const scale = rect.width / img.naturalWidth;
        circle.setAttribute('cx', x * scale);
        circle.setAttribute('cy', y * scale);
        circle.setAttribute('r', radius * scale);
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        // Update animation values based on scaled radius
        animate.setAttribute('values', `${radius * scale};${radius * 1.5 * scale};${radius * scale}`);
    };

    // Add elements to DOM
    svg.appendChild(circle);
    wrapper.appendChild(img);
    wrapper.appendChild(svg);
    originalImg.replaceWith(wrapper);

    // Initial position update
    if (img.complete) {
        updatePosition();
    } else {
        img.onload = updatePosition;
    }

    // Handle resizing
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(wrapper);
    resizeObserver.observe(img);

    // Return cleanup function
    return () => {
        resizeObserver.disconnect();
        wrapper.replaceWith(originalImg);
    };
}

/**
 * Adds coordinate annotations to an image based on the response data
 * @param {HTMLElement} imageDiv - The container div for the image
 * @param {HTMLElement} img - The image element to annotate
 * @param {Object|Array} responseData - The response data containing coordinates
 */
function addCoordinateAnnotations(imageDiv, img, responseData) {
    if (!responseData) return;

    // Wait for image to load before adding annotations
    img.onload = () => {
        // Handle the new format (array of objects with type field)
        if (Array.isArray(responseData)) {
            responseData.forEach(item => {
                // Handle tool_use type items with coordinates
                if (item.type === "tool_use" && item.input) {
                    if (item.input.bounding_box) {
                        const [[x1, y1], [x2, y2]] = item.input.bounding_box;
                        addBoundingBoxAnnotation(imageDiv, x1, y1, x2, y2);
                    } else if (item.input.coordinate) {
                        const [x, y] = item.input.coordinate;
                        addCircleAnnotation(imageDiv, x, y);
                    }
                }
                // Handle computer_call type items with coordinates
                else if (item.type === "computer_call" && item.action) {
                    if (item.action.bounding_box) {
                        const [[x1, y1], [x2, y2]] = item.action.bounding_box;
                        addBoundingBoxAnnotation(imageDiv, x1, y1, x2, y2);
                    } else if (item.action.x !== undefined && item.action.y !== undefined) {
                        const x = item.action.x;
                        const y = item.action.y;
                        addCircleAnnotation(imageDiv, x, y);
                    }
                }
            });
        }
        // Handle the old format (actions array with coordinates)
        else if (responseData.actions) {
            responseData.actions.forEach(action => {
                if (action.bounding_box) {
                    const [[x1, y1], [x2, y2]] = action.bounding_box;
                    addBoundingBoxAnnotation(imageDiv, x1, y1, x2, y2);
                } else if (action.center_coordinates || action.coordinate || action.coordinates) {
                    const [x, y] = action.center_coordinates || action.coordinate || action.coordinates;
                    addCircleAnnotation(imageDiv, x, y);
                }
            });
        }
    };
}

/******************************************************************
 * SHOW PLANNER STEP => plus all sub-agent data
 ******************************************************************/
function showPlannerStep(stepIndex) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    const plannerData = data['0'];
    const stepData = plannerData[stepIndex + 1];
    if (!stepData) {
        mainContent.innerHTML = `<h2>Invalid step: ${stepIndex}</h2>`;
        return;
    }

    // Container for the planner step
    const plannerTaskDiv = document.createElement('div');
    plannerTaskDiv.className = 'task';
    plannerTaskDiv.dataset.stepId = `0_${stepIndex}`;

    // Header
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';

    const headerText = document.createElement('div');
    headerText.className = 'task-header-text';
    // Get task text - for step 0, use the initial task, otherwise check request
    const taskText = stepIndex === 0 ?
        plannerData[0]?.task :
        stepData.request?.task || stepData.request?.thoughts?.task || stepData.response?.thoughts || 'Planner Step';
    headerText.innerHTML = `
                <div>Planner Step ${stepIndex}</div>
                ${taskText ? `<div class="task-description">${taskText}</div>` : ''}
            `;
    taskHeader.appendChild(headerText);

    // Annotate button
    const annotationKey = `0_${stepIndex}`;
    const annotateBtn = document.createElement('button');
    annotateBtn.id = `planner-step-btn-${stepIndex}`;
    if (annotations.steps[annotationKey]) {
        annotateBtn.textContent = 'Edit Annotation';
        annotateBtn.classList.add('edit-button');
    } else {
        annotateBtn.textContent = 'Annotate Step';
    }
    annotateBtn.addEventListener('click', () => {
        selectedAgent = '0';
        selectedAgentStepIndex = stepIndex;
        openAnnotateStepModal('0', stepIndex);
        if (annotations.steps[annotationKey]) {
            populateStepModal(annotations.steps[annotationKey]);
        }
    });
    taskHeader.appendChild(annotateBtn);

    plannerTaskDiv.appendChild(taskHeader);

    // Show request/response
    if (stepData.request) {
        plannerTaskDiv.appendChild(createCollapsible('Request', stepData.request));
    }
    if (stepData.response) {
        plannerTaskDiv.appendChild(createCollapsible('Response', stepData.response));
    }

    // Show image if present
    if (stepData.annotated_image) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image';

        const img = document.createElement('img');
        img.src = getImagePath(stepData.annotated_image);
        img.alt = `Planner Step ${stepIndex}`;
        imageDiv.appendChild(img);

        // Check if response exists and has actions with coordinate or center_coordinates
        if (stepData.response) {
            addCoordinateAnnotations(imageDiv, img, stepData.response);
        }

        plannerTaskDiv.appendChild(imageDiv);
    }

    mainContent.appendChild(plannerTaskDiv);

    // Add this before the sub-agents section
    const expandResponses = () => {
        const responseButtons = mainContent.querySelectorAll('.collapsible');
        responseButtons.forEach(btn => {
            if (btn.textContent === 'Response') {
                btn.classList.add('active');
                const content = btn.nextElementSibling;
                if (content) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            }
        });
    };

    setTimeout(expandResponses, 0);

    // Sub-agents
    const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];
    if (navigatorTools.length) {
        const subHeader = document.createElement('h3');
        subHeader.textContent = 'Sub-Agents for this Step';
        subHeader.style.marginTop = '20px';
        subHeader.style.color = '#d2a8ff';
        mainContent.appendChild(subHeader);

        navigatorTools.forEach(tool => {
            const subtaskTask = tool.arguments?.task;
            let foundAgentId = null;
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === subtaskTask) {
                    foundAgentId = aid;
                }
            });
            if (foundAgentId) {
                const agentData = data[foundAgentId];
                const subAgentDiv = buildAgentTaskView(foundAgentId);
                mainContent.appendChild(subAgentDiv);
            }
        });
    }

    setTimeout(initializeScrollTracking, 100);
}

// Return a <div> with the entire sub-agent's steps
function buildAgentTaskView(agentId) {
    const agentData = data[agentId];
    const container = document.createElement('div');
    container.className = 'task';
    container.style.marginTop = '10px';
    container.dataset.stepId = `agent_${agentId}`;

    if (!agentData || !agentData[0]) {
        container.innerHTML = `<p>No data for agent ${agentId}</p>`;
        return container;
    }

    // Add result banner if agent has a result
    const lastStep = agentData[agentData.length - 1];
    if (lastStep?.response?.actions) {
        const stopAction = lastStep.response.actions.find(a => a.action_type === 'stop');
        if (stopAction?.answer) {
            const resultBanner = document.createElement('div');
            resultBanner.className = 'agent-result-banner';
            resultBanner.innerHTML = `
                        <div class="agent-result-content">
                            <div class="agent-result-label">Result:</div>
                            <div class="agent-result-text">${stopAction.answer}</div>
                        </div>
                    `;
            container.appendChild(resultBanner);
        }
    }

    // Add subtask annotation banner if it exists
    if (annotations.subtasks[agentId]) {
        const subtaskAnn = annotations.subtasks[agentId];
        const banner = document.createElement('div');
        banner.className = 'subtask-annotation-banner';

        const bannerHeader = document.createElement('div');
        bannerHeader.className = 'subtask-annotation-banner-header';

        const status = document.createElement('div');
        status.className = 'subtask-annotation-status';
        status.textContent = subtaskAnn.status;
        bannerHeader.appendChild(status);

        banner.appendChild(bannerHeader);

        if (subtaskAnn.notes) {
            const notes = document.createElement('div');
            notes.className = 'subtask-annotation-notes';
            notes.textContent = subtaskAnn.notes;
            banner.appendChild(notes);
        }

        container.appendChild(banner);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'task-header';

    const headerText = document.createElement('div');
    headerText.className = 'task-header-text';

    // Find the task number by looking at the task content
    const taskNumber = parseInt(agentId);
    const taskNumberDisplay = !isNaN(taskNumber) ? `Task ${taskNumber}: ` : '';

    headerText.textContent = `[Agent ${agentId}] ${taskNumberDisplay}${agentData[0].task}`;
    header.appendChild(headerText);

    // Subtask annotation button
    const subtaskBtn = document.createElement('button');
    subtaskBtn.id = `subtask-btn-agent-${agentId}`;
    if (annotations.subtasks[agentId]) {
        subtaskBtn.textContent = 'Edit Annotation';
        subtaskBtn.classList.add('edit-button');
    } else {
        subtaskBtn.textContent = 'Annotate Subtask';
    }
    subtaskBtn.addEventListener('click', () => {
        openAnnotateSubtaskModal(agentId);
    });
    header.appendChild(subtaskBtn);

    container.appendChild(header);

    // Steps
    for (let i = 1; i < agentData.length; i++) {
        const stepContainer = buildStepContainer(agentData[i], agentId, i - 1);
        container.appendChild(stepContainer);
    }

    // Add at the end before returning container
    const expandResponses = () => {
        const responseButtons = container.querySelectorAll('.collapsible');
        responseButtons.forEach(btn => {
            if (btn.textContent === 'Response') {
                btn.classList.add('active');
                const content = btn.nextElementSibling;
                if (content) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            }
        });
    };

    setTimeout(expandResponses, 0);
    return container;
}

/******************************************************************
 * SHOW SUB-AGENT ONLY
 ******************************************************************/
function showSubAgent(agentId) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    const view = buildAgentTaskView(agentId);
    mainContent.appendChild(view);
    setTimeout(initializeScrollTracking, 100);
}

function showSubAgentStep(agentId, stepIndex) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    const agentData = data[agentId];
    if (!agentData || agentData.length <= stepIndex) {
        mainContent.innerHTML = `<h2>Invalid step for Agent ${agentId}, step ${stepIndex}</h2>`;
        return;
    }

    const container = document.createElement('div');
    container.className = 'task';

    // Header
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    const headerText = document.createElement('div');
    headerText.className = 'task-header-text';
    headerText.textContent = `[Agent ${agentId}] Step ${stepIndex}`;
    taskHeader.appendChild(headerText);

    // Subtask annotation
    const subtaskBtn = document.createElement('button');
    subtaskBtn.id = `subtask-btn-agent-${agentId}`;
    if (annotations.subtasks[agentId]) {
        subtaskBtn.textContent = 'Edit Annotation';
        subtaskBtn.classList.add('edit-button');
    } else {
        subtaskBtn.textContent = 'Annotate Subtask';
    }
    subtaskBtn.addEventListener('click', () => {
        openAnnotateSubtaskModal(agentId);
    });
    taskHeader.appendChild(subtaskBtn);

    container.appendChild(taskHeader);

    const stepObj = agentData[stepIndex + 1];
    const stepDiv = buildStepContainer(stepObj, agentId, stepIndex);
    container.appendChild(stepDiv);

    mainContent.appendChild(container);
    setTimeout(initializeScrollTracking, 100);
}

/******************************************************************
 * BUILD STEP CONTAINER
 ******************************************************************/
function buildStepContainer(stepObj, agentId, stepIndex) {
    const container = document.createElement('div');
    container.className = 'step-container';
    container.dataset.stepId = `${agentId}_${stepIndex}`;

    // Add annotation banner if it exists
    const annKey = `${agentId}_${stepIndex}`;
    if (annotations.steps[annKey]) {
        const annotation = annotations.steps[annKey];
        const banner = document.createElement('div');
        banner.className = 'annotation-banner';

        const bannerHeader = document.createElement('div');
        bannerHeader.className = 'annotation-banner-header';

        const bannerType = document.createElement('div');
        bannerType.className = 'annotation-banner-type';
        bannerType.textContent = annotation.annotation_type === 'MISTAKE' ? 'MISTAKE' : 'MISTAKE + FOLLOWUP';
        bannerHeader.appendChild(bannerType);

        banner.appendChild(bannerHeader);

        if (annotation.annotated_actions && annotation.annotated_actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'annotation-banner-actions';

            const actionsTitle = document.createElement('div');
            actionsTitle.className = 'annotation-banner-actions-title';
            actionsTitle.textContent = 'Corrected Actions:';
            actionsContainer.appendChild(actionsTitle);

            annotation.annotated_actions.forEach((action, idx) => {
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

        container.appendChild(banner);
    }

    const header = document.createElement('div');
    header.className = 'step-header';
    header.textContent = `Step ${stepIndex}`;
    container.appendChild(header);

    if (stepObj.request) {
        container.appendChild(createCollapsible('Request', stepObj.request));
    }
    if (stepObj.response) {
        container.appendChild(createCollapsible('Response', stepObj.response));
    }
    if (stepObj.annotated_image) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image';

        const img = document.createElement('img');
        img.src = getImagePath(stepObj.annotated_image);
        img.alt = `Step ${stepIndex}`;
        imageDiv.appendChild(img);

        // Check if response exists and has actions with coordinate or center_coordinates
        if (stepObj.response) {
            addCoordinateAnnotations(imageDiv, img, stepObj.response);
        }

        container.appendChild(imageDiv);
    }

    // Annotate step
    const stepButtons = document.createElement('div');
    stepButtons.className = 'step-buttons';

    const annotateBtn = document.createElement('button');
    annotateBtn.id = `step-btn-${agentId}-${stepIndex}`;
    if (annotations.steps[annKey]) {
        annotateBtn.textContent = 'Edit Annotation';
        annotateBtn.classList.add('edit-button');
    } else {
        annotateBtn.textContent = 'Annotate Step';
    }
    annotateBtn.addEventListener('click', () => {
        openAnnotateStepModal(agentId, stepIndex);
        if (annotations.steps[annKey]) {
            populateStepModal(annotations.steps[annKey]);
        }
    });

    stepButtons.appendChild(annotateBtn);
    container.appendChild(stepButtons);

    return container;
}

/******************************************************************
 * COLLAPSIBLE HELPER
 ******************************************************************/
function createCollapsible(label, dataObj) {
    const wrap = document.createElement('div');

    const btn = document.createElement('button');
    btn.className = 'collapsible';
    btn.textContent = label;

    const content = document.createElement('div');
    content.className = 'content';

    const dataDiv = document.createElement('div');
    dataDiv.className = 'step-content';
    dataDiv.innerHTML = formatJSONContent(dataObj);

    content.appendChild(dataDiv);
    wrap.appendChild(btn);
    wrap.appendChild(content);

    btn.addEventListener('click', function () {
        this.classList.toggle('active');
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });

    // Auto-expand response sections
    if (label === 'Response') {
        btn.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
    }

    return wrap;
}

/******************************************************************
 * ANNOTATION: SUBTASK
 ******************************************************************/
function openAnnotateSubtaskModal(agentId) {
    openSharedAnnotationModal('subtask', agentId, `Annotate Subtask [Agent ${agentId}]`);
}

function closeModal(mid) {
    document.getElementById(mid).classList.add('hidden');
}

function saveSharedAnnotation() {
    // Validate trajectory annotation if that's what we're saving
    if (currentAnnotationType === 'trajectory') {
        if (typeof validateTrajectoryAnnotation === 'function' && !validateTrajectoryAnnotation()) {
            return; // Don't save if validation fails
        }
    }

    if (currentAnnotationType === 'subtask') {
        // Save subtask annotation
        annotations.subtasks[currentAnnotationId] = {
            subtask_task_status: document.getElementById('subtask-task-status').value,
            subtask_model_status: document.getElementById('subtask-model-status').value,
            notes: document.getElementById('subtask-annotation-notes').value,
            original_subtask_data: data[currentAnnotationId]
        };
    } else if (currentAnnotationType === 'trajectory') {
        // Save trajectory annotation
        annotations.trajectory_task_status = document.getElementById('task-task-status').value;
        const checkedBoxes = document.querySelectorAll('#task-error-categories input[type="checkbox"]:checked');
        annotations.trajectory_error_categories = Array.from(checkedBoxes).map(box => box.value);
        annotations.trajectory_tool_error_notes = document.getElementById('tool-error-notes').value;
        annotations.trajectory_notes = document.getElementById('task-annotation-notes').value;

        // Save step error inputs
        const stepErrorInputs = {};
        document.querySelectorAll('#task-error-categories .error-step-input').forEach(input => {
            const category = input.getAttribute('data-category');
            const stepValue = input.value.trim();
            if (category && stepValue) {
                stepErrorInputs[category] = stepValue;
            }
        });
        annotations.trajectory_step_errors = stepErrorInputs;
    }

    // Upload to server
    uploadAnnotations().then(() => {
        renderSideNav();
        updateDownloadButtonState();

        // Update status indicator button if we're editing trajectory status
        if (currentAnnotationType === 'trajectory') {
            updateStatusIndicatorButton();
        }

        closeModal(`${currentAnnotationType}-annotation-modal`);

        // If we're in annotations view, refresh it
        const annotationsBtn = document.getElementById('view-annotations');
        if (annotationsBtn.classList.contains('active')) {
            displayAnnotations();
        }
    }).catch(error => {
        alert('Failed to save annotation: ' + error.message);
        // Still close modal and update UI since we saved locally
        renderSideNav();
        updateDownloadButtonState();
        closeModal(`${currentAnnotationType}-annotation-modal`);
    });
}



function populateStepModal(ann) {
    // Set annotation type
    if (ann.annotation_type === 'MISTAKE') {
        document.getElementById('annotation-type-mistake').checked = true;
    } else if (ann.annotation_type === 'MISTAKE_FOLLOWUP') {
        document.getElementById('annotation-type-followup').checked = true;
    }

    const actions = ann.annotated_actions || [];
    const container = document.getElementById('actions-container');
    container.innerHTML = '';

    if (!actions.length) {
        addActionRow();
    } else {
        actions.forEach(a => {
            addActionRow();
            const actionContainer = container.querySelector('.action-container:last-child');
            const typeSelect = actionContainer.querySelector('.action-type');
            typeSelect.value = a.action_type;

            const fieldsDiv = actionContainer.querySelector('.action-fields');
            createActionFields(a.action_type, fieldsDiv);

            // Populate fields based on action type
            if (a.action_type === 'click' || a.action_type === 'type') {
                const coordInputs = fieldsDiv.querySelector('.coordinate-inputs');
                if (a.bounding_box) {
                    // New bounding box format
                    fieldsDiv.querySelector('.coordinate-x1').value = a.bounding_box[0][0];
                    fieldsDiv.querySelector('.coordinate-y1').value = a.bounding_box[0][1];
                    fieldsDiv.querySelector('.coordinate-x2').value = a.bounding_box[1][0];
                    fieldsDiv.querySelector('.coordinate-y2').value = a.bounding_box[1][1];
                    // Show coordinate inputs since we have data
                    if (coordInputs) coordInputs.classList.remove('hidden');
                } else if (a.coordinates) {
                    // Legacy single point format - convert to small bounding box
                    const centerX = a.coordinates[0];
                    const centerY = a.coordinates[1];
                    const offset = 5; // Small offset to create a bounding box around the point
                    fieldsDiv.querySelector('.coordinate-x1').value = centerX - offset;
                    fieldsDiv.querySelector('.coordinate-y1').value = centerY - offset;
                    fieldsDiv.querySelector('.coordinate-x2').value = centerX + offset;
                    fieldsDiv.querySelector('.coordinate-y2').value = centerY + offset;
                    // Show coordinate inputs since we have data
                    if (coordInputs) coordInputs.classList.remove('hidden');
                } else if (a.element_id) {
                    // Handle legacy data that still uses element_id
                    fieldsDiv.querySelector('.coordinate-x1').value = '';
                    fieldsDiv.querySelector('.coordinate-y1').value = '';
                    fieldsDiv.querySelector('.coordinate-x2').value = '';
                    fieldsDiv.querySelector('.coordinate-y2').value = '';
                }
            }
            if (a.action_type === 'type') {
                fieldsDiv.querySelector('.rule').value = a.rule || 'contain';
                fieldsDiv.querySelector('.text').value = a.text || '';
                const pressEnter = fieldsDiv.querySelector('input[name^="press-enter"][value="' + (a.press_enter_after ? 'true' : 'false') + '"]');
                if (pressEnter) pressEnter.checked = true;
            }
            if (a.action_type === 'scroll') {
                const coordInputs = fieldsDiv.querySelector('.coordinate-inputs');
                if (a.bounding_box) {
                    // New bounding box format
                    fieldsDiv.querySelector('.coordinate-x1').value = a.bounding_box[0][0];
                    fieldsDiv.querySelector('.coordinate-y1').value = a.bounding_box[0][1];
                    fieldsDiv.querySelector('.coordinate-x2').value = a.bounding_box[1][0];
                    fieldsDiv.querySelector('.coordinate-y2').value = a.bounding_box[1][1];
                    // Show coordinate inputs since we have data
                    if (coordInputs) coordInputs.classList.remove('hidden');
                } else if (a.center_coordinates) {
                    // Legacy center point format - convert to small bounding box
                    const centerX = a.center_coordinates[0];
                    const centerY = a.center_coordinates[1];
                    const offset = 10; // Larger offset for scroll areas
                    fieldsDiv.querySelector('.coordinate-x1').value = centerX - offset;
                    fieldsDiv.querySelector('.coordinate-y1').value = centerY - offset;
                    fieldsDiv.querySelector('.coordinate-x2').value = centerX + offset;
                    fieldsDiv.querySelector('.coordinate-y2').value = centerY + offset;
                    // Show coordinate inputs since we have data
                    if (coordInputs) coordInputs.classList.remove('hidden');
                } else if (a.element_id !== undefined) {
                    // Handle legacy data that still uses element_id
                    fieldsDiv.querySelector('.coordinate-x1').value = '';
                    fieldsDiv.querySelector('.coordinate-y1').value = '';
                    fieldsDiv.querySelector('.coordinate-x2').value = '';
                    fieldsDiv.querySelector('.coordinate-y2').value = '';
                }
                fieldsDiv.querySelector('.direction').value = a.direction || 'down';
            }
            if (a.action_type === 'stop') {
                fieldsDiv.querySelector('.rule').value = a.rule || 'contain';
                fieldsDiv.querySelector('.answer').value = a.answer || '';
            }
            if (a.action_type === 'extract_content') {
                fieldsDiv.querySelector('.page-content').value = a.page_content || '';
            }

            // Populate thoughts, grounding instruction, and feedback
            const thoughtsInput = fieldsDiv.querySelector('.action-thoughts');
            const groundingInput = fieldsDiv.querySelector('.action-grounding');
            const feedbackInput = fieldsDiv.querySelector('.action-feedback');
            if (thoughtsInput) {
                thoughtsInput.value = a.thoughts || '';
            }
            if (groundingInput) {
                groundingInput.value = a.grounding_instruction || '';
            }
            if (feedbackInput) {
                feedbackInput.value = a.feedback || '';
            }
        });
    }
}

function updateTaskNumbers() {
    const all = document.querySelectorAll('.action-container');
    all.forEach((cont, idx) => {
        cont.querySelector('.action-name').textContent = `Task ${idx + 1}`;
    });
}

/******************************************************************
 * UTILS
 ******************************************************************/
function formatJSONContent(obj) {
    // First convert the object to a string with proper spacing, without sorting keys
    let jsonString = JSON.stringify(obj, (key, value) => value, 2);

    // Helper function to try parsing and format embedded JSON in strings
    function formatEmbeddedJson(str) {
        try {
            // Look for potential JSON strings with escaped quotes
            const matches = str.match(/(?<!\\)\"(\\.|[^"\\])*\"/g) || [];

            for (const match of matches) {
                // Remove the outer quotes and try to parse
                const innerContent = match.slice(1, -1);
                try {
                    // Try to parse the content as JSON
                    const parsed = JSON.parse(innerContent);
                    if (typeof parsed === 'object' && parsed !== null) {
                        // If successful, replace with formatted version
                        const formatted = JSON.stringify(parsed, null, 2)
                            .split('\n')
                            .map(line => ' '.repeat(8) + line) // Add consistent indentation
                            .join('\n');
                        str = str.replace(match, `"⤵\n${formatted}\n"`);
                    }
                } catch (e) {
                    // Not valid JSON, continue
                    continue;
                }
            }
            return str;
        } catch (e) {
            return str;
        }
    }

    // Format any embedded JSON in strings
    jsonString = formatEmbeddedJson(jsonString);

    // Replace literal \n with actual newlines while preserving indentation
    jsonString = jsonString.replace(/\\n/g, function (match) {
        // Get the current indentation level by looking at previous newline
        const lastNewline = jsonString.lastIndexOf('\n', arguments[1]) + 1;
        const currentLine = jsonString.slice(lastNewline, arguments[1]);
        const indentation = currentLine.match(/^\s*/)[0];
        return '\n' + indentation;
    });

    // Apply syntax highlighting
    let html = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            function (match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else if (match.includes('class="json-link"')) {
                        // Preserve the link if it's already wrapped in an anchor tag
                        return match;
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        )
        .replace(/\n/g, '<br>')
        .replace(/\s{2}/g, '&nbsp;&nbsp;');

    // handle markdown links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url) {
        // Check if text looks like a URL (domain pattern)
        const textIsUrl = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/.test(text);
        // Check if url looks like a URL
        const urlIsUrl = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/.test(url);

        if (textIsUrl && urlIsUrl) {
            // Both are URLs, make both clickable while preserving markdown format
            const textHref = text.startsWith('http') ? text : `https://${text}`;
            const urlHref = url.startsWith('http') ? url : `https://${url}`;

            /// if they match lets just show the url
            if(textHref === urlHref) {
                // (www.google.com)
                return `(${urlHref})`;
            }
            /// if the urls don't match lets show a small separator so our
            /// bellow formater doesn't join them.
            else {
                // (www.google.com) → (www.google.com/maps)
                return `[${textHref}]` + ` &#8594; ` + `(${urlHref})`;
            }
        } else if (urlIsUrl) {
            // Only URL part is a URL, keep markdown format but make URL clickable
            // [google](www.google.com)
            const urlHref = url.startsWith('http') ? url : `https://${url}`;
            return `[${text}](${urlHref})`;
        } else {
            // Neither is a URL, leave as is
            return match;
        }
    });

    html = html.replace(/(https?:\/\/[^\s<>"']+|(?:^|[\s<>"'])([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"']*)?)/g, function(match) {
        // Avoid double-wrapping if already inside an anchor
        if (match.includes('class="json-link"')) return match;

        // Clean up the match and handle leading whitespace
        const leadingSpace = match.match(/^[\s<>"']/);
        const cleanMatch = match.trim();

        // Skip if it's just a period or doesn't look like a real URL
        if (cleanMatch.length < 4 || cleanMatch === '.') return match;

        // Remove trailing non-word and non-slash characters (like punctuation)
        const urlMatch = cleanMatch.match(/^((?:https?:\/\/)?[^\s<>"']*?)([^\w\/]+)?$/);
        const cleanUrl = urlMatch ? urlMatch[1] : cleanMatch;
        const trailing = urlMatch && urlMatch[2] ? urlMatch[2] : '';

        // Add protocol if missing
        const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;

        return (leadingSpace ? leadingSpace[0] : '') + `<a href="${href}" target="_blank" class="json-link">${cleanUrl}</a>${trailing}`;
    });

    return html;
}

/******************************************************************
 * ANNOTATIONS VIEW + DOWNLOAD
 ******************************************************************/
function displayAnnotations() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = '';

    const header = document.createElement('h2');
    header.textContent = 'Annotated Steps & Subtasks';
    mainContent.appendChild(header);

    // Initialize task queues
    const taskQueues = {};
    Object.entries(data).forEach(([aid, arr]) => {
        if (aid === '0' || !arr?.[0]?.task) return;
        const task = arr[0].task;
        if (!taskQueues[task]) taskQueues[task] = [];
        taskQueues[task].push(aid);
    });

    // Sort queues numerically
    Object.values(taskQueues).forEach(q =>
        q.sort((a, b) => parseInt(a) - parseInt(b))
    );

    // Create a copy for tracking
    const taskQueuesCopy = JSON.parse(JSON.stringify(taskQueues));

    // Add Raw JSON Dropdown
    const rawJsonContainer = document.createElement('div');
    rawJsonContainer.className = 'raw-json-container';

    const rawJsonHeader = document.createElement('div');
    rawJsonHeader.className = 'raw-json-header';
    rawJsonHeader.innerHTML = `
        <button class="raw-json-toggle">
            <span class="toggle-icon">▼</span>
            View Raw JSON
        </button>
    `;

    const rawJsonContent = document.createElement('div');
    rawJsonContent.className = 'raw-json-content';
    rawJsonContent.style.display = 'none';
    rawJsonContent.innerHTML = `<pre>${formatJSONContent(annotations)}</pre>`;

    rawJsonHeader.querySelector('button').addEventListener('click', (e) => {
        const icon = e.currentTarget.querySelector('.toggle-icon');
        const content = rawJsonContent;
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    });

    rawJsonContainer.appendChild(rawJsonHeader);
    rawJsonContainer.appendChild(rawJsonContent);
    mainContent.appendChild(rawJsonContainer);

    if (!Object.keys(annotations.steps).length &&
        !Object.keys(annotations.subtasks).length &&
        !Object.keys(annotations.plan).length &&
        !annotations.trajectory_task_status) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No annotations yet.';
        mainContent.appendChild(empty);
        return;
    }

    // Display trajectory status if it exists
    if (annotations.trajectory_task_status) {
        const trajectorySection = document.createElement('div');
        trajectorySection.className = 'annotation-section';

        const trajectoryHeader = document.createElement('h3');
        trajectoryHeader.textContent = 'Overall Task Status';
        trajectoryHeader.style.color = '#58a6ff';
        trajectoryHeader.style.marginBottom = '20px';
        trajectorySection.appendChild(trajectoryHeader);

        const statusContainer = document.createElement('div');
        statusContainer.className = 'task';

        const statusBanner = document.createElement('div');
        statusBanner.className = 'trajectory-status-banner';

        let statusColor = '#3fb950';
        if (annotations.trajectory_task_status.includes('FAILURE')) {
            statusColor = '#f85149';
        }

        statusBanner.style.borderColor = statusColor;

        let successText = annotations.trajectory_task_status.replace(/_/g, ' ').replace('FAILURE DUE TO', 'FAILURE:');

        statusBanner.innerHTML = `
            <div class="status-content">
                <div class="status-row">
                    <div class="status-label">Task Success:</div>
                    <div class="status-value" style="color: ${statusColor};">${successText}</div>
                </div>
                ${annotations.trajectory_notes ? `
                    <div class="status-row">
                        <div class="status-label">Notes:</div>
                        <div class="status-value notes">${annotations.trajectory_notes}</div>
                    </div>
                ` : ''}
            </div>
            <div class="status-actions">
                <button class="edit-status-btn" onclick="editTrajectoryStatus()">Edit</button>
                <button class="delete-status-btn" onclick="deleteTrajectoryStatus()">Delete</button>
            </div>
        `;

        statusContainer.appendChild(statusBanner);
        trajectorySection.appendChild(statusContainer);
        mainContent.appendChild(trajectorySection);
    }

    // Show step annotations
    const stepAnnotations = Object.entries(annotations.steps)
        .sort((a, b) => {
            // Sort by agent ID first, then by step index
            const [agentA, stepA] = a[0].split('_');
            const [agentB, stepB] = b[0].split('_');
            if (agentA !== agentB) {
                return parseInt(agentA) - parseInt(agentB);
            }
            return parseInt(stepA) - parseInt(stepB);
        });

    if (stepAnnotations.length > 0) {
        const stepSection = document.createElement('div');
        stepSection.className = 'annotation-section';

        const stepHeader = document.createElement('h3');
        stepHeader.textContent = 'Annotated Steps';
        stepHeader.style.color = '#ff7b72';
        stepHeader.style.marginTop = '40px';
        stepHeader.style.marginBottom = '20px';
        stepSection.appendChild(stepHeader);

        stepAnnotations.forEach(([stepKey, annotation]) => {
            const [agentId, stepIndex] = stepKey.split('_');
            const container = document.createElement('div');
            container.className = 'task';
            container.style.marginBottom = '30px';
            container.dataset.stepId = stepKey;

            // Header with agent and step info
            const stepHeader = document.createElement('div');
            stepHeader.className = 'task-header';

            const headerText = document.createElement('div');
            headerText.className = 'task-header-text';

            // Get agent task for context
            const agentData = data[agentId];
            const agentTask = agentData?.[0]?.task || 'Unknown Task';

            headerText.innerHTML = `
                <div>Agent ${agentId} - Step ${stepIndex}</div>
                <div class="task-description">${agentTask}</div>
            `;
            stepHeader.appendChild(headerText);

            // Action buttons
            const actionButtons = document.createElement('div');
            actionButtons.className = 'annotation-banner-header-right';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-annotation-btn';
            editBtn.textContent = 'Edit Annotation';
            editBtn.onclick = () => {
                selectedAgent = agentId;
                selectedAgentStepIndex = parseInt(stepIndex);
                openAnnotateStepModal(agentId, parseInt(stepIndex));
                populateStepModal(annotation);
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-annotation-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => deleteAnnotation(stepKey);

            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            stepHeader.appendChild(actionButtons);
            container.appendChild(stepHeader);

            // Annotation content banner
            const banner = document.createElement('div');
            banner.className = 'annotation-banner';

            const bannerHeader = document.createElement('div');
            bannerHeader.className = 'annotation-banner-header';

            const bannerType = document.createElement('div');
            bannerType.className = 'annotation-banner-type';
            bannerType.textContent = annotation.annotation_type === 'MISTAKE' ? 'MISTAKE' : 'MISTAKE + FOLLOWUP';
            bannerHeader.appendChild(bannerType);

            banner.appendChild(bannerHeader);

            // Show annotated actions if any
            if (annotation.annotated_actions && annotation.annotated_actions.length > 0) {
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'annotation-banner-actions';

                const actionsTitle = document.createElement('div');
                actionsTitle.className = 'annotation-banner-actions-title';
                actionsTitle.textContent = 'Corrected Actions:';
                actionsContainer.appendChild(actionsTitle);

                annotation.annotated_actions.forEach((action, idx) => {
                    const actionDiv = document.createElement('div');
                    actionDiv.className = 'annotation-banner-action';

                    // Action number header
                    const actionHeader = document.createElement('div');
                    actionHeader.className = 'annotation-banner-action-header';

                    const number = document.createElement('span');
                    number.className = 'annotation-banner-action-number';
                    number.textContent = `Action ${idx + 1}`;
                    actionHeader.appendChild(number);
                    actionDiv.appendChild(actionHeader);

                    // Action content container for column layout
                    const actionContent = document.createElement('div');
                    actionContent.className = 'annotation-banner-action-content';

                    // Action type row
                    const typeRow = document.createElement('div');
                    typeRow.className = 'action-field-row';

                    const typeLabel = document.createElement('strong');
                    typeLabel.textContent = 'Type: ';

                    const typeValue = document.createElement('span');
                    typeValue.className = 'annotation-banner-action-type';
                    typeValue.textContent = action.action_type;

                    typeRow.appendChild(typeLabel);
                    typeRow.appendChild(typeValue);
                    actionContent.appendChild(typeRow);

                    // Action details row
                    const detailsText = formatActionDetails(action);
                    if (detailsText && detailsText.trim()) {
                        const detailsRow = document.createElement('div');
                        detailsRow.className = 'action-field-row';
                        detailsRow.innerHTML = `<strong>Details:</strong> ${detailsText}`;
                        actionContent.appendChild(detailsRow);
                    }

                    // Thoughts row
                    if (action.thoughts && action.thoughts.trim()) {
                        const thoughtsRow = document.createElement('div');
                        thoughtsRow.className = 'action-field-row';
                        thoughtsRow.innerHTML = `<strong>Thoughts:</strong> ${action.thoughts}`;
                        actionContent.appendChild(thoughtsRow);
                    }

                    // Grounding instruction row
                    if (action.grounding_instruction && action.grounding_instruction.trim()) {
                        const groundingRow = document.createElement('div');
                        groundingRow.className = 'action-field-row';
                        groundingRow.innerHTML = `<strong>Grounding Instruction:</strong> ${action.grounding_instruction}`;
                        actionContent.appendChild(groundingRow);
                    }

                    // Feedback row
                    if (action.feedback && action.feedback.trim()) {
                        const feedbackRow = document.createElement('div');
                        feedbackRow.className = 'action-field-row';
                        feedbackRow.innerHTML = `<strong>Feedback:</strong> ${action.feedback}`;
                        actionContent.appendChild(feedbackRow);
                    }

                    actionDiv.appendChild(actionContent);
                    actionsContainer.appendChild(actionDiv);
                });

                banner.appendChild(actionsContainer);
            }

            // Show description if it exists
            if (annotation.description) {
                const description = document.createElement('div');
                description.className = 'annotation-description';
                description.innerHTML = `<strong>Description:</strong> ${annotation.description}`;
                banner.appendChild(description);
            }

            container.appendChild(banner);
            stepSection.appendChild(container);
        });

        mainContent.appendChild(stepSection);
    }

    // Show planner annotations first
    const plannerAnnotations = Object.entries(annotations.plan)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (plannerAnnotations.length > 0) {
        const plannerSection = document.createElement('div');
        plannerSection.className = 'annotation-section';

        const plannerHeader = document.createElement('h3');
        plannerHeader.textContent = 'Planner Annotations';
        plannerHeader.style.color = '#62dafc';
        plannerHeader.style.marginBottom = '20px';
        plannerSection.appendChild(plannerHeader);

        plannerAnnotations.forEach(([stepIndex, annotation]) => {
            const container = document.createElement('div');
            container.className = 'task';
            container.style.marginBottom = '30px';
            container.dataset.stepId = `0_${stepIndex}`;

            // Add step header
            const stepHeader = document.createElement('div');
            stepHeader.className = 'task-header';
            stepHeader.innerHTML = `
                <div class="annotation-banner-header-left">
                    <div class="annotation-banner-type">
                        ${annotation.annotation_type === 'MISTAKE' ? 'MISTAKE' : 'MISTAKE + FOLLOWUP'}
                    </div>
                </div>
                <div class="annotation-banner-header-right">
                    <button class="edit-annotation-btn" onclick="openPlannerAnnotationModal('${stepIndex}')">
                        Edit Annotation
                    </button>
                    <button class="delete-annotation-btn" onclick="deleteAnnotation('0_${stepIndex}')">
                        Delete
                    </button>
                </div>
            `;
            container.appendChild(stepHeader);

            // Add new subtasks section if present
            if (annotation.new_subtasks && annotation.new_subtasks.length > 0) {
                const subtasksContainer = document.createElement('div');
                subtasksContainer.className = 'subtasks-container';

                annotation.new_subtasks.forEach(newSubtask => {
                    const subtaskDiv = document.createElement('div');
                    subtaskDiv.className = 'subtask-item';

                    const subtaskHeader = document.createElement('div');
                    subtaskHeader.className = 'subtask-header';

                    const subtaskTitle = document.createElement('div');
                    subtaskTitle.className = 'subtask-title';

                    const task = newSubtask.new_planner_step?.task;
                    const spawnFrom = newSubtask.new_planner_step?.spawn_from;

                    // Find the next available agent ID for this task from the queue
                    const queue = taskQueuesCopy[task] || [];
                    const nextAgentId = queue.length ? queue.shift() : 'New';

                    subtaskTitle.innerHTML = `
                        <div class="agent-header">
                            <div class="agent-name">Agent ${nextAgentId}</div>
                            <div class="task-description">- ${task}</div>
                        </div>
                        ${spawnFrom !== null ? `<div class="spawn-from-label">Spawns from Agent ${spawnFrom}</div>` : ''}
                    `;

                    const newTag = document.createElement('span');
                    newTag.className = 'subtask-tag new-tag';
                    newTag.textContent = 'NEW';
                    subtaskTitle.appendChild(newTag);

                    subtaskHeader.appendChild(subtaskTitle);
                    subtaskDiv.appendChild(subtaskHeader);
                    subtasksContainer.appendChild(subtaskDiv);
                });

                container.appendChild(subtasksContainer);
            }

            plannerSection.appendChild(container);
        });

        mainContent.appendChild(plannerSection);
    }

    // Show agent subtasks with annotations
    const subtaskAnnotations = Object.entries(annotations.subtasks)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (subtaskAnnotations.length > 0) {
        const subtaskSection = document.createElement('div');
        subtaskSection.className = 'annotation-section';

        const subtaskHeader = document.createElement('h3');
        subtaskHeader.textContent = 'Annotated Subtasks';
        subtaskHeader.style.color = '#7ee787';
        subtaskHeader.style.marginTop = '40px';
        subtaskHeader.style.marginBottom = '20px';
        subtaskSection.appendChild(subtaskHeader);

        subtaskAnnotations.forEach(([agentId, annotation]) => {
            const container = document.createElement('div');
            container.className = 'task';
            container.style.marginBottom = '30px';
            container.dataset.stepId = `agent_${agentId}`;

            const agentHeader = document.createElement('div');
            agentHeader.className = 'task-header';
            agentHeader.innerHTML = `
                <div class="annotation-banner-header-left">
                    <div class="annotation-banner-type ${annotation.status.toLowerCase().replace(/_/g, '-')}">
                        ${annotation.status.replace(/_/g, ' ')}
                    </div>
                </div>
                <div class="annotation-banner-header-right">
                    <button class="edit-annotation-btn" onclick="openAnnotateSubtaskModal('${agentId}')">
                        Edit Annotation
                    </button>
                    <button class="delete-annotation-btn" onclick="deleteAnnotation('subtask_${agentId}')">
                        Delete
                    </button>
                </div>
            `;
            container.appendChild(agentHeader);

            const banner = document.createElement('div');
            banner.className = 'subtask-annotation-banner';

            const bannerHeader = document.createElement('div');
            bannerHeader.className = 'subtask-annotation-banner-header';

            const headerLeft = document.createElement('div');
            headerLeft.className = 'annotation-banner-header-left';

            const status = document.createElement('div');
            status.className = 'subtask-annotation-status';
            status.innerHTML = `
                <div class="status-row">
                    <div class="status-label">Task Success:</div>
                    <div class="status-value">${annotation.subtask_task_status.replace(/_/g, ' ')}</div>
                </div>
                <div class="status-row">
                    <div class="status-label">Model Performance:</div>
                    <div class="status-value">${annotation.subtask_model_status.replace(/_/g, ' ')}</div>
                </div>
            `;
            headerLeft.appendChild(status);

            bannerHeader.appendChild(headerLeft);
            banner.appendChild(bannerHeader);

            if (annotation.notes) {
                const notes = document.createElement('div');
                notes.className = 'subtask-annotation-notes';
                notes.textContent = annotation.notes;
                banner.appendChild(notes);
            }

            container.appendChild(banner);
            subtaskSection.appendChild(container);
        });

        mainContent.appendChild(subtaskSection);
    }

    // Initialize scroll tracking
    setTimeout(initializeScrollTracking, 100);
}

function downloadJSON(filename, jsonData) {
    const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonData, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', str);
    anchor.setAttribute('download', filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function updateDownloadButtonState() {
    const btn = document.getElementById('download-all');
    const hasAny = Object.keys(annotations.steps).length ||
        Object.keys(annotations.subtasks).length ||
        Object.keys(annotations.plan).length ||
        annotations.trajectory_task_status;  // Add check for trajectory status
    btn.disabled = !hasAny;
}

/******************************************************************
 * SCROLL TRACKING (SIMPLER APPROACH)
 ******************************************************************/
let scrollTrackingRafId = null;
let lastScrollSelection = null;
const HYSTERESIS_PX = 64; // the "buffer" in pixels to avoid rapid flipping

// Add a debounce function to limit how often we update the URL
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add scroll position tracking to main content
function initializeScrollTracking() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Remove any old scroll listeners or timeouts
    if (window.oldScrollHandler) {
        mainContent.removeEventListener('scroll', window.oldScrollHandler);
        window.removeEventListener('resize', window.oldScrollHandler);
    }

    // Create debounced version of URL update
    const updateScrollParam = debounce((scrollTop) => {
        updateUrlParam('scroll', Math.round(scrollTop));
    }, 100);  // Update URL at most every 100ms

    const scrollHandler = () => {
        if (scrollTrackingRafId) {
            cancelAnimationFrame(scrollTrackingRafId);
        }
        // Update active nav
        scrollTrackingRafId = requestAnimationFrame(updateActiveNav);

        // Update URL with scroll position
        updateScrollParam(mainContent.scrollTop);
    };

    mainContent.addEventListener('scroll', scrollHandler);
    window.addEventListener('resize', scrollHandler);

    // Save reference so we can remove it if needed
    window.oldScrollHandler = scrollHandler;

    // Check if we need to restore scroll position from URL
    const { scroll } = getUrlParams();
    if (scroll) {
        setTimeout(() => {
            mainContent.scrollTo({
                bottom: scroll,
                behavior: 'auto'
            });
        }, 100);
    }

    // Do an initial update
    updateActiveNav();
}

function updateActiveNav() {
    const mainContent = document.getElementById('main-content');
    const sections = mainContent.querySelectorAll('[data-step-id]');
    if (!sections.length) return;

    // 1) Determine the top offset of each section relative to mainContent's scrollTop
    const containerRect = mainContent.getBoundingClientRect();
    let bestId = null;
    let bestDistance = Infinity;

    sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        // Distance from the top of the main-content container
        const offsetTop = rect.top - containerRect.top;

        // We pick whichever is nearest to 0 (the top), but still >= -half the viewport
        const distanceFromTop = Math.abs(offsetTop);
        if (distanceFromTop < bestDistance) {
            bestDistance = distanceFromTop;
            bestId = section.dataset.stepId;
        }
    });

    // 2) Apply hysteresis to avoid flipping rapidly
    // If user is between two sections, we don't want to bounce constantly.
    // If the new section is close enough to the previous highlight, keep the old one.
    if (lastScrollSelection && bestId && bestId !== lastScrollSelection) {
        const lastEl = mainContent.querySelector(`[data-step-id="${lastScrollSelection}"]`);
        if (lastEl) {
            const rect = lastEl.getBoundingClientRect();
            const dist = Math.abs(rect.top - containerRect.top);
            // If the last selection is still within the hysteresis distance, keep it
            if (dist <= HYSTERESIS_PX) {
                bestId = lastScrollSelection;
            }
        }
    }

    // 3) Update the side nav if changed
    if (bestId && bestId !== lastScrollSelection) {
        lastScrollSelection = bestId;
        updateSideNavSelection(bestId);
    }
}

/**
 * Updates the side nav to highlight the item that corresponds to `selectedId`.
 */
function updateSideNavSelection(selectedId) {
    // Clear existing selections in side nav
    document.querySelectorAll('.side-nav .selected, .side-nav .parent-selected')
        .forEach(el => el.classList.remove('selected', 'parent-selected'));

    // Clear existing content selections
    document.querySelectorAll('.content-selected')
        .forEach(el => el.classList.remove('content-selected'));

    // Add content-selected class to the corresponding main content element
    const contentElement = document.querySelector(`[data-step-id="${selectedId}"]`);
    if (contentElement) {
        contentElement.classList.add('content-selected');
    }

    // If it's the top-level planner
    if (selectedId === 'planner_main') {
        document.querySelector('.parent-step')?.classList.add('selected');
        return;
    }

    // If it's an "agent" container
    if (selectedId.startsWith('agent_')) {
        const agentId = selectedId.split('_')[1];
        // highlight the .parent-step plus the agent item
        document.querySelector('.parent-step')?.classList.add('parent-selected');
        const agentItem = document.querySelector(`.nested-agent-item[data-agent-id="${agentId}"]`);
        if (agentItem) {
            const parentStep = agentItem.closest('.nested-agent-list')?.previousElementSibling;
            if (parentStep) {
                parentStep.classList.add('parent-selected');
            }
            agentItem.classList.add('selected');
            ensureVisible(agentItem);
        }
        return;
    }

    // If it's a "step" – either planner (0_x) or agent steps (other_x)
    const [aid, stepIdx] = selectedId.split('_');
    document.querySelector('.parent-step')?.classList.add('parent-selected');

    if (aid === '0') {
        // Planner steps
        const stepItem = document.querySelector(`.step-item[data-step-id="${stepIdx}"]`);
        if (stepItem) {
            stepItem.classList.add('selected');
            ensureVisible(stepItem);
        }
    } else {
        // Agent step
        const stepItem = document.querySelector(`.nested-step-item[data-step-id="${selectedId}"]`);
        const agentItem = document.querySelector(`.nested-agent-item[data-agent-id="${aid}"]`);
        if (stepItem && agentItem) {
            const parentStep = agentItem.closest('.nested-agent-list')?.previousElementSibling;
            if (parentStep) {
                parentStep.classList.add('parent-selected');
            }
            agentItem.classList.add('parent-selected');
            stepItem.classList.add('selected');
            ensureVisible(stepItem);
        }
    }
}

/**
 * Scrolls the side nav so the highlighted item is in view (if it's not).
 */
function ensureVisible(element) {
    const nav = document.querySelector('.side-nav');
    if (!nav || !element) return;
    const navRect = nav.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (elementRect.top < navRect.top || elementRect.bottom > navRect.bottom) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/******************************************************************
 * SHOW ALL CONTENT
 ******************************************************************/
function showAllContent() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return; // Early return if element not found

    mainContent.innerHTML = '';

    const allContentDiv = document.createElement('div');
    allContentDiv.className = 'all-content-container';
    allContentDiv.dataset.stepId = 'planner_main';



    // Initialize task queues at the start
    const taskQueues = {};
    Object.entries(data).forEach(([aid, arr]) => {
        if (aid === '0' || !arr?.[0]?.task) return;
        const task = arr[0].task;
        if (!taskQueues[task]) taskQueues[task] = [];
        taskQueues[task].push(aid);
    });

    // Sort queues numerically
    Object.values(taskQueues).forEach(q =>
        q.sort((a, b) => parseInt(a) - parseInt(b))
    );

    // Create a copy of taskQueues for tracking used agents
    const taskQueuesCopy = JSON.parse(JSON.stringify(taskQueues));

    const plannerData = data['0'];
    if (!plannerData || plannerData.length <= 1) {
        allContentDiv.innerHTML += '<p>No Planner steps found.</p>';
        mainContent.appendChild(allContentDiv);
        return;
    }

    // Rest of the showAllContent function remains the same, but use taskQueuesCopy
    // instead of taskToAgentMap for agent lookups
    for (let i = 1; i < plannerData.length; i++) {
        const stepIndex = i - 1;
        const stepData = plannerData[i];
        const plannerTaskDiv = document.createElement('div');
        plannerTaskDiv.className = 'task';
        plannerTaskDiv.dataset.stepId = `0_${stepIndex}`;

        const taskHeader = document.createElement('div');
        taskHeader.className = 'task-header';
        const headerText = document.createElement('div');
        headerText.className = 'task-header-text';
        // Get task text - for step 0, use the initial task, otherwise check request
        const taskText = stepData.request?.task || stepData.request?.thoughts?.task || stepData.response?.thoughts || '';
        headerText.innerHTML = `
                    <div>Planner Step ${stepIndex}</div>
                    ${taskText ? `<div class="task-description">${taskText}</div>` : ''}
                `;
        taskHeader.appendChild(headerText);

        const annotationKey = `0_${stepIndex}`;
        const annotateBtn = document.createElement('button');
        annotateBtn.id = `planner-step-btn-${stepIndex}`;
        if (annotations.steps[annotationKey]) {
            annotateBtn.textContent = 'Edit Annotation';
            annotateBtn.classList.add('edit-button');
        } else {
            annotateBtn.textContent = 'Annotate Step';
        }
        annotateBtn.addEventListener('click', () => {
            selectedAgent = '0';
            selectedAgentStepIndex = stepIndex;
            openAnnotateStepModal('0', stepIndex);
            if (annotations.steps[annotationKey]) {
                populateStepModal(annotations.steps[annotationKey]);
            }
        });
        taskHeader.appendChild(annotateBtn);
        plannerTaskDiv.appendChild(taskHeader);

        if (stepData.request) {
            plannerTaskDiv.appendChild(createCollapsible('Request', stepData.request));
        }
        if (stepData.response) {
            plannerTaskDiv.appendChild(createCollapsible('Response', stepData.response));
        }
        if (stepData.annotated_image) {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'image';

            const img = document.createElement('img');
            img.src = getImagePath(stepData.annotated_image);
            img.alt = `Planner Step ${stepIndex}`;
            imageDiv.appendChild(img);

            // Check if response exists and has actions with coordinate or center_coordinates
            if (stepData.response) {
                addCoordinateAnnotations(imageDiv, img, stepData.response);
            }

            plannerTaskDiv.appendChild(imageDiv);
        }

        allContentDiv.appendChild(plannerTaskDiv);

        const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];
        if (navigatorTools.length) {
            const subHeader = document.createElement('h3');
            subHeader.textContent = 'Sub-Agents for this Step';
            subHeader.style.marginTop = '20px';
            subHeader.style.color = '#d2a8ff';
            allContentDiv.appendChild(subHeader);

            navigatorTools.forEach(tool => {
                const subtaskTask = tool.arguments?.task;
                const queue = taskQueuesCopy[subtaskTask] || [];
                const foundAgentId = queue.length ? queue.shift() : null;

                if (foundAgentId) {
                    const subAgentDiv = buildAgentTaskView(foundAgentId);
                    if (subAgentDiv) {
                        subAgentDiv.dataset.stepId = `agent_${foundAgentId}`;
                        allContentDiv.appendChild(subAgentDiv);
                    }
                }
            });
        }
    }



    mainContent.appendChild(allContentDiv);

    // Expand responses and initialize scroll tracking with delay
    setTimeout(() => {
        const responseButtons = document.querySelectorAll('.collapsible');
        responseButtons.forEach(btn => {
            if (btn.textContent === 'Response') {
                btn.classList.add('active');
                const content = btn.nextElementSibling;
                if (content) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            }
        });
        initializeScrollTracking();
    }, 100);
}

function scrollToContent(stepId) {
    let element;

    // Handle different types of IDs
    if (stepId.startsWith('agent_')) {
        // For agent containers
        element = document.querySelector(`[data-step-id="${stepId}"]`);
    } else {
        // For steps (both planner and agent steps)
        const [agentId, stepIndex] = stepId.split('_');
        if (agentId === '0') {
            // Planner steps
            element = document.querySelector(`[data-step-id="${stepId}"]`);
        } else {
            // Agent steps - look within the agent container
            const agentContainer = document.querySelector(`[data-step-id="agent_${agentId}"]`);
            if (agentContainer) {
                element = agentContainer.querySelector(`[data-step-id="${stepId}"]`);
            }
        }
    }

    if (!element) {
        console.warn(`Element with step-id ${stepId} not found`);
        return;
    }

    // Get the main content container
    const mainContent = document.getElementById('main-content');

    // Calculate element's position relative to the main content
    let offsetTop = 0;
    let currentElement = element;

    // Sum up all offsets until we reach the main content container
    while (currentElement && currentElement !== mainContent) {
        offsetTop += currentElement.offsetTop;
        currentElement = currentElement.offsetParent;
    }

    // Add a small offset for visual padding (24px from top)
    const scrollOffset = 24;

    // Wait for any response sections to finish expanding
    setTimeout(() => {
        // Recalculate position after responses have expanded
        let finalOffsetTop = 0;
        currentElement = element;
        while (currentElement && currentElement !== mainContent) {
            finalOffsetTop += currentElement.offsetTop;
            currentElement = currentElement.offsetParent;
        }

        const scrollPosition = Math.max(0, finalOffsetTop - scrollOffset);

        // Scroll the main content
        mainContent.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });

        // Update URL with new scroll position
        updateUrlParam('scroll', scrollPosition);
    }, 150);
}

document.addEventListener('DOMContentLoaded', () => {
    renderSideNav();
    updateDownloadButtonState();
    showAllContent();
    document.querySelector('.parent-step')?.classList.add('selected');

    setTimeout(() => {
        // If we have annotations, update UI elements
        if (annotationData) {
            // Re-render side nav to show annotation indicators
            renderSideNav();
            updateDownloadButtonState();

            // Find first annotated element and scroll to it
            const firstAnnotatedStep = Object.keys(annotations.steps)[0];
            if (firstAnnotatedStep) {
                setTimeout(() => scrollToContent(firstAnnotatedStep), 100);
            } else {
                // If no step annotations, check for subtask annotations
                const firstAnnotatedSubtask = Object.keys(annotations.subtasks)[0];
                if (firstAnnotatedSubtask) {
                    setTimeout(() => scrollToContent(`agent_${firstAnnotatedSubtask}`), 100);
                }
            }
        }
    }, 250);

    // Add view switching logic with URL parameter handling
    const navigatorBtn = document.getElementById('navigator-view-btn');
    const plannerBtn = document.getElementById('planner-view-btn');
    const navigatorView = document.getElementById('navigator-view');
    const plannerView = document.getElementById('planner-view');
    const annotationsBtn = document.getElementById('view-annotations');

    // Function to switch views
    function switchToView(view) {
        // Clear all active states
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));

        if (view === 'planner') {
            plannerBtn.classList.add('active');
            plannerView.classList.remove('hidden');
            navigatorView.classList.add('hidden');
            renderPlannerView();
            updateUrlParam('view', 'planner');
        } else if (view === 'annotations') {
            annotationsBtn.classList.add('active');
            navigatorView.classList.remove('hidden');
            plannerView.classList.add('hidden');
            displayAnnotations();
            updateUrlParam('view', 'annotations');
        } else {
            navigatorBtn.classList.add('active');
            navigatorView.classList.remove('hidden');
            plannerView.classList.add('hidden');
            showAllContent();
            updateUrlParam('view', null);
        }
    }

    // Add click handlers
    navigatorBtn.addEventListener('click', () => switchToView('navigator'));
    plannerBtn.addEventListener('click', () => switchToView('planner'));
    annotationsBtn.addEventListener('click', () => switchToView('annotations'));

    // Check URL parameters and switch to the correct view
    const { view } = getUrlParams();
    switchToView(view || 'navigator');

    // Add download handler
    document.getElementById('download-all').addEventListener('click', async () => {
        // // upload to srv/shared/dashboard/logs/etc/etc...
        // try {
        //     await uploadAnnotations();
        //     alert('Annotations successfully saved to server');
        // } catch (error) {
        //     alert('Failed to save annotations to server: ' + error.message);
        // }

        // Download locally
        try {
            // Get the second to last path parameter from URL
            const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
            const nameFromPath = pathParts[pathParts.length - 2] || 'unknown';

            // Create filename with path parameter and timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `annotations_${nameFromPath}_${timestamp}.json`;
            downloadJSON(filename, annotations);

        } catch (error) {
            alert('Failed to download annotations locally: ' + error.message);
        }
    });
});


function renderPlannerView() {
    const plannerContainer = document.querySelector('.planner-tree');
    if (!plannerContainer) return;

    // Original planner view rendering code
    plannerContainer.innerHTML = '';
    // Add the header here
    const header = document.createElement('h2');
    const taskText = data['0'][0]?.task || 'ERROR';
    header.textContent = `Task: "${taskText}"`;
    plannerContainer.appendChild(header);

    const plannerData = data['0'];
    if (!plannerData || plannerData.length <= 1) {
        plannerContainer.innerHTML = '<div class="empty-state">No planner steps found.</div>';
        return;
    }

    // Create a map of agent IDs to their parent planner steps
    const agentToParentMap = {};

    // First pass - build the relationship map and collect observations
    const stepObservations = {};
    const stepDependencies = {};

    for (let i = 1; i < plannerData.length; i++) {
        const stepIndex = i - 1;
        const stepData = plannerData[i];

        // Store observation from response
        if (stepData.response?.observation) {
            stepObservations[stepIndex] = stepData.response.observation;
        }

        // Track dependencies between steps
        const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];
        navigatorTools.forEach(tool => {
            const subtaskTask = tool.arguments?.task;
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === subtaskTask) {
                    agentToParentMap[aid] = stepIndex;
                    // Initialize dependencies array for this step if it doesn't exist
                    if (!stepDependencies[stepIndex]) {
                        stepDependencies[stepIndex] = [];
                    }
                    stepDependencies[stepIndex].push(aid);
                }
            });
        });
    }

    // Second pass - render with relationships and observations
    for (let i = 1; i < plannerData.length; i++) {
        const stepIndex = i - 1;
        const stepData = plannerData[i];

        const stepDiv = document.createElement('div');
        stepDiv.className = 'planner-step';
        stepDiv.dataset.plannerStep = stepIndex;

        // Header with annotation status
        const header = document.createElement('div');
        header.className = 'planner-step-header';

        const title = document.createElement('div');
        title.className = 'planner-step-title';
        // Remove the task text and only show the step number
        title.innerHTML = `<div>Planner Step ${stepIndex}</div>`;

        // Add annotation indicator if step is annotated
        const annotationKey = `0_${stepIndex}`;
        if (annotations.steps[annotationKey]) {
            const annotationBadge = document.createElement('span');
            annotationBadge.className = 'annotation-badge';
            annotationBadge.textContent = annotations.steps[annotationKey].annotation_type === 'MISTAKE' ? 'Mistake' : 'Follow-up';
            title.appendChild(annotationBadge);
        }

        const annotateBtn = document.createElement('button');
        annotateBtn.className = 'planner-annotate-btn';
        if (annotations.steps[annotationKey]) {
            annotateBtn.textContent = 'Edit Annotation';
            annotateBtn.classList.add('edit-button');
        } else {
            annotateBtn.textContent = 'Annotate Step';
        }
        annotateBtn.onclick = () => openPlannerAnnotationModal(stepIndex);

        header.appendChild(title);
        header.appendChild(annotateBtn);
        stepDiv.appendChild(header);

        // Content section
        const content = document.createElement('div');
        content.className = 'planner-step-content';

        // Show observation if any
        if (stepObservations[stepIndex]) {
            const observation = document.createElement('div');
            observation.className = 'planner-observation';
            observation.innerHTML = `<strong>Observation:</strong> ${stepObservations[stepIndex]}`;
            content.appendChild(observation);
        }

        // Subtasks section with hierarchy
        const subtasks = document.createElement('div');
        subtasks.className = 'planner-subtasks';

        // Get existing subtasks for this step
        const existingSubtasks = stepData.response?.tools
            ?.filter(t => t.name === 'run_navigator')
            .map(t => t.arguments?.task)
            .filter(Boolean) || [];

        const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];
        navigatorTools.forEach((tool, subtaskIndex) => {
            const subtaskTask = tool.arguments?.task;
            let foundAgentId = null;
            let spawnFromAgentId = tool.arguments?.spawn_from;  // Get the spawn_from value

            // Find corresponding agent data
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === subtaskTask) {
                    foundAgentId = aid;
                }
            });

            // Get the annotation data for this step
            const annotationKey = `0_${stepIndex}`;
            const annotation = annotations.steps[annotationKey];

            // Check if this task was modified or is new from the annotation
            const isModified = annotation?.modified_subtasks?.includes(subtaskTask);
            const isNew = annotation?.new_subtasks?.includes(subtaskTask);

            if (foundAgentId || isModified || isNew) {
                const agentData = data[foundAgentId];
                const subtaskDiv = document.createElement('div');
                subtaskDiv.className = 'subtask-item';
                if (foundAgentId) subtaskDiv.dataset.agentId = foundAgentId;
                subtaskDiv.dataset.parentStep = stepIndex;

                const subtaskHeader = document.createElement('div');
                subtaskHeader.className = 'subtask-header';

                const subtaskTitle = document.createElement('div');
                subtaskTitle.className = 'subtask-title';

                // Get spawn information from annotation if it exists
                const subtaskData = annotation?.subtasks_data?.find(s => s.task === subtaskTask);
                const spawnFrom = subtaskData?.arguments?.spawn_from ?? spawnFromAgentId;

                // Find if this subtask has been modified
                const modifiedSubtask = annotation?.modified_subtasks?.find(m =>
                    m.original_planner_step.task === subtaskTask ||
                    m.new_planner_step.task === subtaskTask
                );

                subtaskTitle.innerHTML = `
                            <div class="agent-header">
                                <div class="agent-name">Agent ${foundAgentId || 'New'}</div>
                                <div class="task-description">- ${subtaskTask}</div>
                            </div>
                            ${spawnFrom ? `<div class="spawn-from-label">Spawns from Agent ${spawnFrom}</div>` : ''}
                        `;

                // Add agent result if available
                if (foundAgentId && agentData) {
                    const lastStep = agentData[agentData.length - 1];
                    if (lastStep?.response?.actions) {
                        const stopAction = lastStep.response.actions.find(a => a.action_type === 'stop');
                        if (stopAction?.answer) {
                            const resultDiv = document.createElement('div');
                            resultDiv.className = 'subtask-result';
                            resultDiv.textContent = stopAction.answer;
                            subtaskTitle.appendChild(resultDiv);
                        }
                    }
                }

                // If this subtask was modified, show the changes
                if (modifiedSubtask) {
                    const changeIndicator = document.createElement('div');
                    changeIndicator.className = 'change-indicator';

                    // Show task changes if they differ
                    if (modifiedSubtask.original_planner_step.task !== modifiedSubtask.new_planner_step.task) {
                        changeIndicator.innerHTML += `
                                    <div>
                                        <span class="original">Task: ${modifiedSubtask.original_planner_step.task}</span>
                                        <span class="arrow">→</span>
                                        <span class="new">Task: ${modifiedSubtask.new_planner_step.task}</span>
                                    </div>
                                `;
                    }

                    // Show spawn_from changes if they differ
                    if (modifiedSubtask.original_planner_step.spawn_from !== modifiedSubtask.new_planner_step.spawn_from) {
                        changeIndicator.innerHTML += `
                                    <div>
                                        <span class="original">Spawns from: Agent ${modifiedSubtask.original_planner_step.spawn_from || 'None'}</span>
                                        <span class="arrow">→</span>
                                        <span class="new">Spawns from: Agent ${modifiedSubtask.new_planner_step.spawn_from || 'None'}</span>
                                    </div>
                                `;
                    }

                    subtaskTitle.appendChild(changeIndicator);
                }

                // Add status tags for modified or new subtasks
                if (isModified) {
                    const modifiedTag = document.createElement('span');
                    modifiedTag.className = 'subtask-tag modified-tag';
                    modifiedTag.textContent = 'Modified';
                    subtaskTitle.appendChild(modifiedTag);
                } else if (isNew) {
                    const newTag = document.createElement('span');
                    newTag.className = 'subtask-tag new-tag';
                    newTag.textContent = 'New';
                    subtaskTitle.appendChild(newTag);
                }

                // Add spawn information if available
                if (subtaskData?.arguments?.spawn_from) {
                    const spawnInfo = document.createElement('div');
                    spawnInfo.className = 'spawn-info';
                    spawnInfo.textContent = `Spawns from Agent ${subtaskData.arguments.spawn_from}`;
                    subtaskTitle.appendChild(spawnInfo);
                }

                // Add annotation status for subtask if it exists
                if (foundAgentId && annotations.subtasks[foundAgentId]) {
                    const subtaskStatus = document.createElement('div');
                    subtaskStatus.className = 'subtask-status';
                    subtaskStatus.textContent = annotations.subtasks[foundAgentId].status;
                    subtaskHeader.appendChild(subtaskStatus);
                }

                subtaskHeader.appendChild(subtaskTitle);
                subtaskDiv.appendChild(subtaskHeader);

                subtasks.appendChild(subtaskDiv);
            }
        });

        // After the navigatorTools loop, add any new subtasks from annotations that weren't in the original tools
        const annotation = annotations.steps[`0_${stepIndex}`];
        if (annotation?.new_subtasks) {
            const existingTasks = navigatorTools.map(t => t.arguments?.task);
            annotation.new_subtasks
                .filter(newSubtask => {
                    // Filter based on the new structure
                    const task = newSubtask.new_planner_step?.task;
                    return task && !existingTasks.includes(task);
                })
                .forEach((newSubtask, idx) => {
                    const subtaskDiv = document.createElement('div');
                    subtaskDiv.className = 'subtask-item';
                    subtaskDiv.dataset.parentStep = stepIndex;

                    const subtaskHeader = document.createElement('div');
                    subtaskHeader.className = 'subtask-header';

                    const subtaskTitle = document.createElement('div');
                    subtaskTitle.className = 'subtask-title';

                    // Get task from the new structure
                    const task = newSubtask.new_planner_step.task;
                    const spawnFrom = newSubtask.new_planner_step.spawn_from;

                    subtaskTitle.innerHTML = `
                                ${task}
                            `;

                    const newTag = document.createElement('span');
                    newTag.className = 'subtask-tag new-tag';
                    newTag.textContent = 'New';
                    subtaskTitle.appendChild(newTag);

                    // Add spawn information if available
                    if (spawnFrom !== null) {
                        const spawnInfo = document.createElement('div');
                        spawnInfo.className = 'spawn-info';
                        spawnInfo.textContent = `Spawns from Agent ${spawnFrom}`;
                        subtaskTitle.appendChild(spawnInfo);
                    }

                    subtaskHeader.appendChild(subtaskTitle);
                    subtaskDiv.appendChild(subtaskHeader);
                    subtasks.appendChild(subtaskDiv);
                });
        }

        // Get plan data for this step if it exists
        const planData = annotations.plan[stepIndex];

        // Add any new subtasks from the plan
        if (planData?.new_subtasks) {
            planData.new_subtasks.forEach(newSubtask => {
                const subtaskDiv = document.createElement('div');
                subtaskDiv.className = 'subtask-item';
                subtaskDiv.dataset.parentStep = stepIndex;

                const subtaskHeader = document.createElement('div');
                subtaskHeader.className = 'subtask-header';

                const subtaskTitle = document.createElement('div');
                subtaskTitle.className = 'subtask-title';

                // Get task and spawn_from from the new structure
                const task = newSubtask.new_planner_step?.task;
                const spawnFrom = newSubtask.new_planner_step?.spawn_from;

                subtaskTitle.innerHTML = `
                            <div class="agent-header">
                                <div class="agent-name">New Agent</div>
                                <div class="task-description">- ${task}</div>
                            </div>
                            ${spawnFrom !== null ? `<div class="spawn-from-label">Spawns from Agent ${spawnFrom}</div>` : ''}
                        `;

                // Add NEW tag
                const newTag = document.createElement('span');
                newTag.className = 'subtask-tag new-tag';
                newTag.textContent = 'NEW';
                subtaskTitle.appendChild(newTag);

                subtaskHeader.appendChild(subtaskTitle);
                subtaskDiv.appendChild(subtaskHeader);
                subtasks.appendChild(subtaskDiv);
            });
        }

        content.appendChild(subtasks);
        stepDiv.appendChild(content);
        plannerContainer.appendChild(stepDiv);
    }

    // After rendering the planner tree, generate and render the flowchart
    const flowchart = document.querySelector('flowchart-component');
    if (flowchart) {
        try {
            const flowchartDef = generatePlannerFlowchart();
            flowchart.updateFlowchart(flowchartDef);
        } catch (error) {
            console.error('Flowchart generation error:', error);
        }
    }
}

function openPlannerAnnotationModal(stepIndex) {
    // Get the planner step data to show existing subtasks
    const stepData = data['0'][stepIndex + 1];
    const existingSubtasks = stepData.response?.tools
        ?.filter(t => t.name === 'run_navigator')
        .map((t, idx) => {
            // Find the agent ID for this task
            let foundAgentId = null;
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === t.arguments?.task) {
                    foundAgentId = aid;
                }
            });
            return {
                task: t.arguments?.task,
                number: foundAgentId || 'New',
                spawn_from: t.arguments?.spawn_from || ''
            };
        })
        .filter(t => t.task) || [];

    // Get annotation data if it exists
    const annotationKey = `0_${stepIndex}`;
    const planAnnotation = annotations.plan[stepIndex];

    // Create modal HTML
    const modalHtml = `
                <div id="planner-annotation-modal" class="modal planner-annotation-modal">
                    <div class="modal-content">
                        <button class="close" onclick="closePlannerAnnotationModal()">&times;</button>

                        <div class="modal-section">
                            <h2>Annotate Planner Step ${stepIndex}</h2>

                            <label class="modal-section-label">Annotation Type</label>
                            <div class="annotation-type-container">
                                <div class="annotation-type-option">
                                    <input type="radio" id="planner-type-mistake" name="planner_annotation_type" value="MISTAKE"
                                        ${!planAnnotation || planAnnotation.annotation_type === 'MISTAKE' ? 'checked' : ''} />
                                    <label for="planner-type-mistake">MISTAKE</label>
                                </div>
                                <div class="annotation-type-option">
                                    <input type="radio" id="planner-type-followup" name="planner_annotation_type" value="MISTAKE_FOLLOWUP"
                                        ${planAnnotation?.annotation_type === 'MISTAKE_FOLLOWUP' ? 'checked' : ''} />
                                    <label for="planner-type-followup">MISTAKE_FOLLOWUP</label>
                                </div>
                            </div>

                            <label class="modal-section-label">Current Subtasks</label>
                            <div class="subtask-list" id="current-subtask-list">
                                ${existingSubtasks.map(({ task, number, spawn_from }) => {
        // Get updated data from annotation if it exists
        const subtaskData = planAnnotation?.subtasks_data?.find(s => s.task === task);
        const updatedSpawnFrom = subtaskData?.arguments?.spawn_from ?? spawn_from;

        return `
                                        <div class="subtask-input-group existing-subtask compact">
                                            <div class="subtask-number">${number}</div>
                                            <div class="subtask-input readonly">
                                                <div class="existing-task-text">${task}</div>
                                                ${updatedSpawnFrom ?
                `<div class="spawn-from-text compact">From Agent ${updatedSpawnFrom}</div>` :
                `<div class="spawn-from-text compact">No parent agent</div>`
            }
                                            </div>
                                        </div>
                                    `;
    }).join('')}
                            </div>

                            <label class="modal-section-label">New Subtasks</label>
                            <div class="subtask-list" id="new-subtask-list">
                                ${planAnnotation?.new_subtasks?.map(subtask => {
        const task = subtask.new_planner_step?.task;
        const spawnFrom = subtask.new_planner_step?.spawn_from;

        return `
                                        <div class="subtask-input-group new-subtask">
                                            <div class="subtask-number">New</div>
                                            <div class="subtask-input">
                                                <div class="hint-container">
                                                    <input type="text"
                                                           class="hint-input"
                                                           placeholder="Enter hint (e.g. Add Verve cappuccino to cart)" />
                                                    <button class="generate-subtask-btn" onclick="generateSubtaskSuggestions(this)">
                                                        <span class="spinner"></span>
                                                        <span class="btn-text">Generate Subtask</span>
                                                    </button>
                                                </div>
                                                <div class="hint-error"></div>

                                                <div class="generate-loading-overlay">
                                                    <div class="loading-spinner"></div>
                                                    <div class="loading-text">
                                                        Generating suggestions<span class="loading-dots"></span>
                                                    </div>
                                                </div>

                                                <dropdown-suggestions class="suggestions-dropdown hidden">
                                                    <div class="suggestions-list"></div>
                                                </dropdown-suggestions>

                                                <input type="text"
                                                       value="${task || ''}"
                                                       placeholder="Enter subtask description or select from suggestions"
                                                       data-parent="${stepIndex}" />
                                                <div class="subtask-parent-fields">
                                                    <input type="number"
                                                           class="spawn-from"
                                                           value="${spawnFrom || ''}"
                                                           placeholder="Spawn From Agent ID" />
                                                </div>
                                            </div>
                                            <button class="remove-subtask-btn" onclick="this.parentElement.remove()">×</button>
                                        </div>
                                    `;
    }).join('') || `
                                    <!-- Default empty new subtask input -->
                                    <div class="subtask-input-group new-subtask">
                                        <div class="subtask-number">New</div>
                                        <div class="subtask-input">
                                            <div class="hint-container">
                                                <input type="text"
                                                       class="hint-input"
                                                       placeholder="Enter hint (e.g. Add Verve cappuccino to cart)" />
                                                <button class="generate-subtask-btn" onclick="generateSubtaskSuggestions(this)">
                                                    <span class="spinner"></span>
                                                    <span class="btn-text">Generate Subtask</span>
                                                </button>
                                            </div>
                                            <div class="hint-error"></div>

                                            <div class="generate-loading-overlay">
                                                <div class="loading-spinner"></div>
                                                <div class="loading-text">
                                                    Generating suggestions<span class="loading-dots"></span>
                                                </div>
                                            </div>

                                            <dropdown-suggestions class="suggestions-dropdown hidden">
                                                <div class="suggestions-list"></div>
                                            </dropdown-suggestions>

                                            <input type="text"
                                                   placeholder="Enter subtask description or select from suggestions"
                                                   data-parent="${stepIndex}" />
                                            <div class="subtask-parent-fields">
                                                <input type="number"
                                                       class="spawn-from"
                                                       placeholder="Spawn From Agent ID" />
                                            </div>
                                        </div>
                                        <button class="remove-subtask-btn" onclick="this.parentElement.remove()">×</button>
                                    </div>
                                `}
                            </div>

                            <button class="add-subtask-btn" onclick="addSubtaskInput(${stepIndex})">
                                <span>+ Add Another Subtask</span>
                            </button>
                        </div>

                        <div class="modal-footer">
                            <button class="cancel-btn" onclick="closePlannerAnnotationModal()">Cancel</button>
                            <button class="save-btn" onclick="savePlannerAnnotation(${stepIndex})">Save</button>
                        </div>
                    </div>
                </div>
            `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Update the addSubtaskInput function to include the spawn from field
function addSubtaskInput(parentStepIndex) {
    const container = document.getElementById('new-subtask-list');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'subtask-input-group new-subtask';

    inputGroup.innerHTML = `
                <div class="subtask-number">New</div>
                <div class="subtask-input">
                    <input type="text"
                           placeholder="Enter subtask description"
                           data-parent="${parentStepIndex}" />
                    <div class="subtask-parent-fields">
                        <input type="number"
                               class="spawn-from"
                               placeholder="Spawn From Agent ID" />
                    </div>
                </div>
                <button class="remove-subtask-btn" onclick="this.parentElement.remove()">×</button>
            `;

    container.appendChild(inputGroup);
}

function savePlannerAnnotation(stepIndex) {
    const annotationType = document.querySelector('input[name="planner_annotation_type"]:checked').value;

    // Get the original step data to find existing subtasks
    const stepData = data['0'][stepIndex + 1];
    const existingSubtasks = stepData.response?.tools
        ?.filter(t => t.name === 'run_navigator') || [];

    // Calculate the starting index for new subtasks
    const startingIndex = existingSubtasks.length;

    // Get new subtasks with correct indexing
    const newSubtasks = Array.from(document.querySelectorAll('#new-subtask-list .subtask-input-group'))
        .map((group, idx) => {
            const task = group.querySelector('input[data-parent]').value.trim();
            const spawnFrom = group.querySelector('.spawn-from').value.trim();

            if (!task) return null;

            return {
                subtask_idx: startingIndex + idx, // Add to existing subtask count
                new_planner_step: {
                    task: task,
                    planner_step: stepIndex,
                    spawn_from: spawnFrom ? parseInt(spawnFrom) : null,
                    spawn_method: "duplicate_tab"
                }
            };
        })
        .filter(Boolean);

    // Save to plan with planner-specific data
    annotations.plan[stepIndex] = {
        annotation_type: annotationType,
        modified_subtasks: [], // No more modifications, only new subtasks
        new_subtasks: newSubtasks,
        original_step_data: data['0'][stepIndex + 1],
        timestamp: new Date().toISOString()
    };

    // Remove any existing planner annotation from steps
    const annotationKey = `0_${stepIndex}`;
    if (annotations.steps[annotationKey]) {
        delete annotations.steps[annotationKey];
    }

    // Upload to server first
    uploadAnnotations()
        .then(() => {
            // Only update UI after successful server save
            renderPlannerView();
            updateDownloadButtonState();
            closePlannerAnnotationModal();
        })
        .catch(error => {
            console.error('Failed to upload annotations:', error);
            // Show error to user
            alert('Failed to save annotation to server: ' + error.message);
            // Still keep local changes and update UI
            renderPlannerView();
            updateDownloadButtonState();
            closePlannerAnnotationModal();
        });
}

function closePlannerAnnotationModal() {
    document.getElementById('planner-annotation-modal').remove();
}

// Add this helper function to format action details
function formatActionDetails(action) {
    switch (action.action_type) {
        case 'click':
            if (action.element_id) {
                return `element_id: ${action.element_id}`;
            } else if (action.bounding_box && Array.isArray(action.bounding_box) && action.bounding_box.length === 2) {
                const [[x1, y1], [x2, y2]] = action.bounding_box;
                return `bounding_box: [(${x1},${y1}), (${x2},${y2})]${action.click_count > 1 ? `, click_count: ${action.click_count}` : ''}`;
            } else if (action.coordinates) {
                return `coordinates: [${action.coordinates[0]}, ${action.coordinates[1]}]${action.click_count > 1 ? `, click_count: ${action.click_count}` : ''}`;
            } else {
                return 'coordinates: not set';
            }
        case 'type':
            if (action.element_id) {
                return `element_id: ${action.element_id}, text: "${action.text}"${action.press_enter_after ? ' + ENTER' : ''}`;
            } else if (action.bounding_box && Array.isArray(action.bounding_box) && action.bounding_box.length === 2) {
                const [[x1, y1], [x2, y2]] = action.bounding_box;
                return `bounding_box: [(${x1},${y1}), (${x2},${y2})], text: "${action.text}"${action.press_enter_after ? ' + ENTER' : ''}`;
            } else if (action.coordinates) {
                return `coordinates: [${action.coordinates[0]}, ${action.coordinates[1]}], text: "${action.text}"${action.press_enter_after ? ' + ENTER' : ''}`;
            } else {
                return `text: "${action.text}"${action.press_enter_after ? ' + ENTER' : ''}`;
            }
        case 'scroll':
            let scrollTarget = '';
            if (action.element_id) {
                scrollTarget = `, element_id: ${action.element_id}`;
            } else if (action.bounding_box && Array.isArray(action.bounding_box) && action.bounding_box.length === 2) {
                const [[x1, y1], [x2, y2]] = action.bounding_box;
                scrollTarget = `, bounding_box: [(${x1},${y1}), (${x2},${y2})]`;
            } else if (action.center_coordinates) {
                scrollTarget = `, center_coordinates: [${action.center_coordinates[0]}, ${action.center_coordinates[1]}]`;
            }
            return `direction: ${action.direction}${action.amount ? `, amount: ${action.amount}` : ''}${scrollTarget}`;
        case 'stop':
            return `rule: ${action.rule}, answer: "${action.answer}"`;
        case 'goto_url':
            return `url: "${action.url}"`;
        case 'key_press':
            return `key_combo: "${action.key_combo}"`;
        case 'read_texts_and_links':
            return 'No parameters';
        default:
            return '';
    }
}

// Update the mermaid initialization
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 50,
        htmlLabels: true
    }
});

// Add this function to generate the flowchart
function generatePlannerFlowchart() {
    const plannerData = data['0'];
    if (!plannerData || plannerData.length <= 1) return '';

    // Switch to erDiagram syntax
    let flowchartDef = 'erDiagram\n';

    // First collect all subtasks and their relationships
    const subtasks = new Map(); // Map to store subtask info
    const relationships = new Set(); // Set to store parent-child relationships

    // Scan through planner steps to collect subtasks and their responses
    for (let i = 1; i < plannerData.length; i++) {
        const stepIndex = i - 1;
        const stepData = plannerData[i];
        const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];

        navigatorTools.forEach(tool => {
            const subtaskTask = tool.arguments?.task;
            const spawnFrom = tool.arguments?.spawn_from;

            // Find agent ID and its final response
            let foundAgentId = null;
            let agentResponse = '';
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === subtaskTask) {
                    foundAgentId = aid;
                    // Get the last step's response
                    const lastStep = arr[arr.length - 1];
                    if (lastStep?.response?.actions) {
                        const stopAction = lastStep.response.actions.find(a => a.action_type === 'stop');
                        if (stopAction?.answer) {
                            agentResponse = stopAction.answer;
                        }
                    }
                }
            });

            if (foundAgentId) {
                // Store subtask info with response
                subtasks.set(foundAgentId, {
                    id: foundAgentId,
                    task: subtaskTask,
                    response: agentResponse,
                    spawn_from: spawnFrom
                });

                // Store relationship
                if (spawnFrom) {
                    relationships.add(`${spawnFrom},${foundAgentId}`);
                }
            }
        });
    }

    // Add entity definitions for each agent
    subtasks.forEach(subtask => {
        // Properly escape and format text for Mermaid compatibility
        const cleanTask = subtask.task
            .replace(/[\n\r]/g, ' ')           // Replace newlines with spaces
            .replace(/['"]/g, '')              // Remove quotes
            .split(' ')                        // Split into words
            .reduce((acc, word, i) => {        // Add line breaks every 5 words
                if (i > 0 && i % 5 === 0) {
                    return acc + '\\n' + word;
                }
                return acc + ' ' + word;
            }, '')
            .trim();

        const cleanResponse = subtask.response
            .replace(/[\n\r]/g, ' ')
            .replace(/['"]/g, '')
            .split(' ')
            .reduce((acc, word, i) => {
                if (i > 0 && i % 5 === 0) {
                    return acc + '\\n' + word;
                }
                return acc + ' ' + word;
            }, '')
            .trim();

        flowchartDef += `    Agent${subtask.id} {\n`;
        flowchartDef += `        String Task "${cleanTask}"\n`;
        flowchartDef += `        String Response "${cleanResponse}"\n`;
        flowchartDef += `    }\n`;
    });

    // Add relationships
    relationships.forEach(rel => {
        const [from, to] = rel.split(',');
        flowchartDef += `    Agent${from} ||--o{ Agent${to} : "spawns"\n`;
    });

    return flowchartDef;
}

// Add event listener for the toggle
document.addEventListener('DOMContentLoaded', () => {
    // ... existing DOMContentLoaded code ...

    // Add toggle event listener
    document.getElementById('simplify-flow').addEventListener('change', () => {
        // Re-render the flowchart when the toggle changes
        const flowContent = document.querySelector('.flow-content');
        const mermaidDiv = flowContent.querySelector('.mermaid');

        try {
            flowContent.classList.add('loading');
            const flowchartDef = generatePlannerFlowchart();
            mermaidDiv.textContent = flowchartDef;

            mermaid.render('plannerFlow', flowchartDef).then(({ svg }) => {
                mermaidDiv.innerHTML = svg;
                flowContent.classList.remove('loading');
            }).catch(error => {
                console.error('Mermaid render error:', error);
                flowContent.classList.add('error');
                flowContent.innerHTML = 'Failed to generate flowchart';
            });
        } catch (error) {
            console.error('Flowchart generation error:', error);
            flowContent.classList.add('error');
            flowContent.innerHTML = 'Failed to generate flowchart';
        }
    });
});

// Add this new function to handle annotation deletion
function deleteAnnotation(key) {
    if (!confirm('Are you sure you want to delete this annotation?')) {
        return;
    }

    if (key.startsWith('subtask_')) {
        // Handle subtask annotation deletion
        const agentId = key.replace('subtask_', '');
        delete annotations.subtasks[agentId];
    } else if (key.startsWith('0_')) {
        // For planner steps, only delete from plan
        const stepIndex = key.split('_')[1];
        delete annotations.plan[stepIndex];
    } else {
        // For navigator steps, delete from steps
        delete annotations.steps[key];
    }

    // Update UI
    renderSideNav();
    updateDownloadButtonState();

    // If we're in the annotations view, refresh it
    const annotationsBtn = document.getElementById('view-annotations');
    if (annotationsBtn.classList.contains('active')) {
        displayAnnotations();
    }

    // Upload changes to server
    uploadAnnotations().catch(error => {
        console.error('Failed to upload annotations:', error);
        // Keep local changes even if upload fails
    });
}

// Add zoom state variables
let flowchartZoom = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

// Function to zoom the flowchart
function zoomFlowchart(delta) {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, flowchartZoom + delta));
    if (newZoom !== flowchartZoom) {
        flowchartZoom = newZoom;
        updateFlowchartZoom();
    }
}

// Function to reset zoom
function resetFlowchartZoom() {
    flowchartZoom = 1;
    updateFlowchartZoom();
}

// Function to update the flowchart zoom
function updateFlowchartZoom() {
    const mermaidDiv = document.querySelector('.mermaid');
    if (mermaidDiv) {
        mermaidDiv.style.transform = `scale(${flowchartZoom})`;
        mermaidDiv.style.transformOrigin = 'top left';

        // Update zoom level display
        const zoomLevelDisplay = document.querySelector('.flow-zoom-level');
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(flowchartZoom * 100)}%`;
        }
    }
}

// Add wheel zoom support
function initFlowchartZoom() {
    const flowContent = document.querySelector('.flow-content');
    if (flowContent) {
        flowContent.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY * -0.01;
                zoomFlowchart(delta);
            }
        });
    }
}

function displaySuggestions(dropdownEl, suggestions) {
    const listEl = dropdownEl.querySelector('.suggestions-list');
    listEl.innerHTML = '';

    // Check if we have a valid subtasks response
    if (suggestions && suggestions.subtasks && Array.isArray(suggestions.subtasks)) {
        // Valid subtasks response - show as clickable options
        suggestions.subtasks.forEach((item, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.innerHTML = `
                        <div class="suggestion-content">
                            <div class="suggestion-text">${item.subtask}</div>
                            ${item.parent_subtask_id !== undefined ?
                    `<div class="suggestion-parent">Parent Task: ${item.parent_subtask_id}</div>` :
                    ''}
                        </div>
                    `;
            // Pass the entire suggestion object instead of just the subtask string
            suggestionItem.onclick = () => selectSuggestion(item, dropdownEl);
            listEl.appendChild(suggestionItem);
        });
    } else {
        // Invalid or error response - show formatted response data
        listEl.innerHTML = `
                    <div class="suggestion-item error-response">
                        <div class="response-header">
                            <div class="response-label">API Response:</div>
                            <div class="response-type ${suggestions?.error ? 'error' : 'unknown'}">
                                ${suggestions?.error ? 'Error' : 'Invalid Response'}
                            </div>
                        </div>
                        <pre class="response-data">${JSON.stringify(suggestions, null, 2)}</pre>
                    </div>
                `;
    }

    dropdownEl.classList.remove('hidden');
}

function selectSuggestion(suggestion, dropdownEl) {
    const container = dropdownEl.closest('.subtask-input-group');
    const subtaskInput = container.querySelector('input[data-parent]');
    const spawnFromInput = container.querySelector('.spawn-from');

    // Check if suggestion is an object with subtask and parent_subtask_id
    if (typeof suggestion === 'object') {
        // Fill the subtask input with the suggestion text
        subtaskInput.value = suggestion.subtask;

        // Set the spawn_from value if parent_subtask_id exists
        if (suggestion.parent_subtask_id !== undefined) {
            spawnFromInput.value = suggestion.parent_subtask_id;
        }
    } else {
        // Handle legacy case where suggestion is just a string
        subtaskInput.value = suggestion;
    }

    // Hide the dropdown
    dropdownEl.classList.add('hidden');

    // Add selected class to the clicked item
    const items = dropdownEl.querySelectorAll('.suggestion-item');
    items.forEach(item => {
        const itemText = item.querySelector('.suggestion-text')?.textContent;
        if (itemText === (typeof suggestion === 'object' ? suggestion.subtask : suggestion)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Helper function to get plan conversation
function getPlanConversation() {
    const plannerData = data['0'];
    const currentStepIndex = selectedPlannerStep + 1;
    const conversation = [];

    // Get the initial user request from step 0
    if (plannerData[0]?.request) {
        conversation.push({
            role: 'user',
            content: plannerData[0].request
        });
    }

    // Collect messages from each planner step up to current
    for (let i = 1; i <= currentStepIndex; i++) {
        const stepData = plannerData[i];
        if (!stepData) continue;

        // Add any observations from previous steps
        if (stepData.request) {
            // Filter out system messages and add other messages
            stepData.request.forEach(msg => {
                if (msg.role !== 'system') {
                    conversation.push(msg);
                }
            });
        }

        // Get agent conversations for this step
        const navigatorTools = stepData.response?.tools?.filter(t => t.name === 'run_navigator') || [];
        for (const tool of navigatorTools) {
            const subtaskTask = tool.arguments?.task;
            let foundAgentId = null;

            // Find the corresponding agent
            Object.entries(data).forEach(([aid, arr]) => {
                if (aid !== '0' && arr[0]?.task === subtaskTask) {
                    foundAgentId = aid;
                }
            });

            // If we found a matching agent, add its conversation
            if (foundAgentId) {
                const agentData = data[foundAgentId];
                if (agentData) {
                    // Add agent's initial task
                    conversation.push({
                        role: 'assistant',
                        content: `Spawned agent ${foundAgentId} for task: ${subtaskTask}`
                    });

                    // Add each step's request and response
                    for (let j = 1; j < agentData.length; j++) {
                        const agentStep = agentData[j];

                        // Add agent's request if it exists
                        if (agentStep.request) {
                            agentStep.request.forEach(msg => {
                                if (msg.role !== 'system') {
                                    // Add agent ID context to the message
                                    const msgWithContext = {
                                        ...msg,
                                        content: `[Agent ${foundAgentId}] ${msg.content}`
                                    };
                                    conversation.push(msgWithContext);
                                }
                            });
                        }

                        // Add agent's response if it exists
                        if (agentStep.response?.actions) {
                            const stopAction = agentStep.response.actions.find(a => a.action_type === 'stop');
                            if (stopAction?.answer) {
                                conversation.push({
                                    role: 'observation',
                                    content: `[Agent ${foundAgentId}] ${stopAction.answer}`
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return {
        plan: conversation,
        current_step: selectedPlannerStep,
        agent_data: Object.entries(data).reduce((acc, [agentId, agentSteps]) => {
            if (agentId !== '0') {
                acc[agentId] = {
                    task: agentSteps[0]?.task,
                    steps: agentSteps.slice(1).map(step => ({
                        request: step.request,
                        response: step.response
                    }))
                };
            }
            return acc;
        }, {})
    };
}

// Update addSubtaskInput to include the hint functionality
function addSubtaskInput(parentStepIndex) {
    const container = document.getElementById('new-subtask-list');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'subtask-input-group new-subtask';

    inputGroup.innerHTML = `
                <div class="subtask-number">New</div>
                <div class="subtask-input">
                    <div class="hint-container">
                        <input type="text"
                               class="hint-input"
                               placeholder="Enter hint (e.g. Add Verve cappuccino to cart)" />
                        <button class="generate-subtask-btn" onclick="generateSubtaskSuggestions(this)">
                            <span class="spinner"></span>
                            <span class="btn-text">Generate Subtask</span>
                        </button>
                    </div>
                    <div class="hint-error"></div>

                    <!-- Add loading overlay -->
                    <div class="generate-loading-overlay">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">
                            Generating suggestions<span class="loading-dots"></span>
                        </div>
                    </div>

                    <dropdown-suggestions class="suggestions-dropdown hidden">
                        <div class="suggestions-list"></div>
                    </dropdown-suggestions>

                    <input type="text"
                           placeholder="Enter subtask description or select from suggestions"
                           data-parent="${parentStepIndex}" />
                    <div class="subtask-parent-fields">
                        <input type="number"
                               class="spawn-from"
                               placeholder="Spawn From Agent ID" />
                    </div>
                </div>
                <button class="remove-subtask-btn" onclick="this.parentElement.remove()">×</button>
            `;

    container.appendChild(inputGroup);
}

// Add helper function to format curl command
function formatCurlCommand(curl) {
    return curl
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\/g, '<span class="curl-continuation">\\</span>\n')
        .replace(/curl/g, '<span class="curl-command">curl</span>')
        .replace(/-X POST/g, '<span class="curl-param">-X</span> <span class="curl-value">POST</span>')
        .replace(/-H /g, '<span class="curl-param">-H</span> ')
        .replace(/-d /g, '<span class="curl-param">-d</span> ')
        .replace(/'([^']+)'/g, '<span class="curl-string">\'$1\'</span>');
}

// Separate function for display formatting only (doesn't affect the actual request)
function formatCurlDisplay(curl) {
    return curl
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\/g, '<span class="curl-continuation">\\</span>\n')
        .replace(/curl/g, '<span class="curl-command">curl</span>')
        .replace(/-X POST/g, '<span class="curl-param">-X</span> <span class="curl-value">POST</span>')
        .replace(/-H /g, '<span class="curl-param">-H</span> ')
        .replace(/-d /g, '<span class="curl-param">-d</span> ')
        .replace(/'([^']+)'/g, (match, p1) => {
            // Don't format the JSON content, just wrap the quotes
            return `<span class="curl-string">'</span>${p1}<span class="curl-string">'</span>`;
        });
}

// Add copy function
function copyCurlCommand(buttonEl) {
    const curlContent = buttonEl.closest('.curl-container').querySelector('.curl-content');
    const textToCopy = curlContent.textContent.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        const copyText = buttonEl.querySelector('.copy-text');
        const originalText = copyText.textContent;
        copyText.textContent = 'Copied!';
        buttonEl.classList.add('copied');

        setTimeout(() => {
            copyText.textContent = originalText;
            buttonEl.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Function to edit trajectory status
function editTrajectoryStatus() {
    openSharedAnnotationModal('trajectory', null, 'Overall Task Status');
}

// Function to delete trajectory status
function deleteTrajectoryStatus() {
    if (confirm('Are you sure you want to delete the overall task status annotation?')) {
        // Clear trajectory fields
        annotations.trajectory_task_status = null;
        annotations.trajectory_error_categories = null;
        annotations.trajectory_error_notes = null;
        annotations.trajectory_notes = null;
        annotations.trajectory_step_errors = {};

        // Upload to server and update UI
        uploadAnnotations().then(() => {
            updateStatusIndicatorButton();
            renderSideNav();
            updateDownloadButtonState();

            // If we're in annotations view, refresh it
            const annotationsBtn = document.getElementById('view-annotations');
            if (annotationsBtn.classList.contains('active')) {
                displayAnnotations();
            }
        }).catch(error => {
            alert('Failed to delete annotation: ' + error.message);
            // Still update UI since we deleted locally
            updateStatusIndicatorButton();
            renderSideNav();
            updateDownloadButtonState();
        });
    }
}

/**
 * Updates the status indicator button to show current trajectory status
 */
function updateStatusIndicatorButton() {
    const statusBtn = document.getElementById('status-indicator-btn');
    if (!statusBtn) return;

    // Reset classes first
    statusBtn.classList.remove('success', 'failure', 'with-status');

    if (annotations.trajectory_task_status) {
        // We have a status, update the button
        statusBtn.classList.add('with-status');

        // Add success/failure class based on model status
        if (annotations.trajectory_task_status.includes('SUCCESS')) {
            statusBtn.classList.add('success');
        } else if (annotations.trajectory_task_status.includes('FAILURE')) {
            statusBtn.classList.add('failure');
        }

        const taskStatus = annotations.trajectory_task_status ? annotations.trajectory_task_status.replace(/_/g, ' ') : '';

        // Update button text
        statusBtn.textContent = taskStatus;
        statusBtn.title = annotations.trajectory_notes || 'Click to edit task status';
    } else {
        // No status, show default text
        statusBtn.textContent = 'Set Overall Task Status';
        statusBtn.title = 'Click to set overall task status';
    }
}

// Helper function to get current step data and context
function getCurrentStepData() {
    // Get the current agent and step being annotated
    if (!selectedAgent || selectedAgentStepIndex === null) {
        return null;
    }

    const agentData = data[selectedAgent];
    if (!agentData || !agentData[selectedAgentStepIndex + 1]) {
        return null;
    }

    const stepData = agentData[selectedAgentStepIndex + 1];
    const messages = [];

    // Add initial task
    if (agentData[0]?.task) {
        messages.push({
            role: 'system',
            content: `Task: ${agentData[0].task}`
        });
    }

    // Add complete history up to current step
    for (let i = 1; i <= selectedAgentStepIndex + 1; i++) {
        const step = agentData[i];
        if (step.request) {
            messages.push(...step.request);
        }
        if (step.response) {
            messages.push({
                role: 'assistant',
                content: JSON.stringify(step.response)
            });
        }
    }

    // Return without processing the screenshot - the API functions will handle that
    return {
        messages: messages,
        screenshot: stepData.annotated_image || null,
        agent_history: {
            agent_id: selectedAgent,
            steps: agentData.slice(1, selectedAgentStepIndex + 2).map(step => ({
                request: step.request,
                response: step.response
            }))
        }
    };
}

/**
 * Standardized API error handling to display detailed error information
 * @param {Error} error - The error object from catch block
 * @param {Object} response - The API response object if available
 * @param {HTMLElement} displayElement - Element to display the error (textarea, div, etc.)
 * @param {Object} options - Additional options like showAlert, errorDiv, etc.
 * @returns {string} - The formatted error message
 */
function handleApiError(error, response, displayElement, options = {}) {
    const {
        showAlert = false,
        errorDiv = null,
        hideLoadingElements = [],
        requestPayload = null,
        apiUrl = null
    } = options;

    console.error('API error:', error);

    // Format the detailed error message
    let errorMessage = 'Error: ' + (error.message || 'Unknown error');
    let detailedMessage = '';

    // If we have response data, show it in detail
    if (response) {
        try {
            const responseData = typeof response === 'string' ?
                JSON.parse(response) : response;

            // Extract specific error details if available
            const specificError = responseData.error ||
                responseData.detail ||
                responseData.message ||
                null;

            if (specificError) {
                errorMessage = `Error: ${specificError}`;
            }

            // Create detailed error information with full response data
            detailedMessage = JSON.stringify(responseData, null, 2);
        } catch (e) {
            // If parsing fails, just use the raw response
            detailedMessage = String(response);
        }
    }

    // Display error in the provided element
    if (displayElement) {
        // For textareas/inputs
        if (displayElement.tagName === 'TEXTAREA' || displayElement.tagName === 'INPUT') {
            displayElement.value = errorMessage;
        }
        // For other elements
        else {
            displayElement.textContent = errorMessage;
        }
    }

    // Show in the error div if provided
    if (errorDiv) {
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('visible');
    }

    // Show alert if requested
    if (showAlert) {
        alert(errorMessage);
    }

    // Hide any loading elements
    hideLoadingElements.forEach(el => {
        if (el) el.classList.remove('visible');
    });

    // If we have request payload and API URL, generate cURL command for debugging
    if (requestPayload && apiUrl) {
        const curlCommand = `curl -X POST '${apiUrl}' \\
-H 'Content-Type: application/json' \\
-d '${JSON.stringify(requestPayload, null, 2)}'`;

        console.log('Debug cURL command:\n', curlCommand);

        // Add curl command to detailed message
        detailedMessage = `${detailedMessage}\n\nDebug Command:\n${curlCommand}`;
    }

    return { errorMessage, detailedMessage };
}

/**
 * Displays a detailed error modal with API response and debug information
 * @param {string} title - Error title
 * @param {string} errorMessage - Short error message
 * @param {string} detailedInfo - Detailed error information and debug commands
 */
function showApiErrorModal(title, errorMessage, detailedInfo) {
    // Remove any existing error modals
    const existingModal = document.getElementById('api-error-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'api-error-modal';
    modalContainer.className = 'modal-container api-error-modal';

    // Create modal HTML
    modalContainer.innerHTML = `
        <div class="modal-content">
            <div class="modal-header error-header">
                <h3>${title || 'API Error'}</h3>
                <button type="button" class="close-modal-btn" onclick="closeModal('api-error-modal')">×</button>
            </div>
            <div class="modal-body">
                <div class="error-message-container">
                    <div class="error-message">${errorMessage}</div>
                </div>
                <div class="error-details-container">
                    <h4>Technical Details</h4>
                    <pre class="error-details">${detailedInfo || 'No additional information available'}</pre>
                </div>
                <div class="error-actions">
                    <button class="copy-details-btn" onclick="copyErrorDetails(this)">
                        <svg class="copy-icon" viewBox="0 0 16 16" width="16" height="16">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                        </svg>
                        Copy Details
                    </button>
                    <button class="close-btn" onclick="closeModal('api-error-modal')">Close</button>
                </div>
            </div>
        </div>
    `;

    // Add to document
    document.body.appendChild(modalContainer);
}

/**
 * Copies error details to clipboard
 */
function copyErrorDetails(buttonEl) {
    const detailsEl = buttonEl.closest('.modal-body').querySelector('.error-details');

    if (detailsEl && detailsEl.textContent) {
        navigator.clipboard.writeText(detailsEl.textContent)
            .then(() => {
                // Show copied feedback
                const originalText = buttonEl.textContent;
                buttonEl.textContent = 'Copied!';
                setTimeout(() => {
                    buttonEl.innerHTML = `
                        <svg class="copy-icon" viewBox="0 0 16 16" width="16" height="16">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                        </svg>
                        Copy Details
                    `;
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text:', err);
            });
    }
}

/**
 * Formats screenshot data to ensure it's in the correct base64 data URL format
 * @param {string} screenshot - The screenshot data
 * @returns {Promise<string|null>} - Properly formatted screenshot data URL or null
 */
async function formatScreenshotData(screenshot) {
    if (!screenshot) return null;

    // Check if screenshot is already in data:image format
    if (screenshot.startsWith('data:image')) {
        return screenshot;
    }
    // Check if it's a file path rather than base64 data
    else if (screenshot.includes('/') || screenshot.match(/\.(png|jpe?g|gif|webp)$/i)) {
        try {
            console.log(`Fetching image from: ${screenshot}`);

            // Add server prefix if it's a relative path missing http(s)
            const imageUrl = screenshot.startsWith('http') ?
                screenshot :
                new URL(screenshot, window.location.origin + window.location.pathname).href;

            // Attempt to fetch the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }

            // Get the blob and convert to base64
            const blob = await response.blob();
            const base64data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            console.log(`Successfully encoded image from ${screenshot} (length: ${base64data.length})`);
            return base64data;
        } catch (error) {
            console.error("Error fetching screenshot:", error);
            // Use a fallback blank image instead of an invalid path
            console.warn("Using fallback blank image instead of:", screenshot);
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }
    }
    else {
        // Assume it's raw base64 data
        return `data:image/png;base64,${screenshot}`;
    }
}
function openSharedAnnotationModal(type, id, title) {
    currentAnnotationType = type;
    currentAnnotationId = id;

    // Get existing annotation if any
    let existingAnnotation = null;
    if (type === 'subtask') {
        existingAnnotation = annotations.subtasks[id];

        // Update modal title
        document.getElementById('subtask-annotation-title').textContent = title;
        // Clear form fields
        document.getElementById('subtask-task-status').value = '';
        document.getElementById('subtask-model-status').value = '';
        document.getElementById('subtask-annotation-notes').value = '';
    } else if (type === 'trajectory') {
        existingAnnotation = annotations.trajectory_task_status ? annotations : null;

        document.getElementById('task-annotation-title').textContent = title;
        document.getElementById('task-task-status').value = '';
        document.querySelectorAll('#task-error-categories input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        document.querySelectorAll('#task-error-categories .error-step-input').forEach(input => {
            input.value = '';
            input.classList.add('hidden'); // Hide all step inputs when clearing
        });
        document.getElementById('tool-error-notes').value = '';
        document.getElementById('task-annotation-notes').value = '';
    }

    // Populate form if we have existing annotation
    if (existingAnnotation) {
        if (type === 'trajectory') {
            document.getElementById('task-task-status').value = existingAnnotation.trajectory_task_status || '';
            if (existingAnnotation.trajectory_error_categories) {
                existingAnnotation.trajectory_error_categories.forEach(status => {
                    const checkbox = document.querySelector(`#task-error-categories input[value="${status}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            document.getElementById('tool-error-notes').value = existingAnnotation.trajectory_tool_error_notes || '';
            document.getElementById('task-annotation-notes').value = existingAnnotation.trajectory_notes || '';

            // Populate step error inputs
            if (existingAnnotation.trajectory_step_errors) {
                Object.entries(existingAnnotation.trajectory_step_errors).forEach(([category, stepValue]) => {
                    const input = document.querySelector(`#task-error-categories .error-step-input[data-category="${category}"]`);
                    if (input) {
                        input.value = stepValue;
                        input.classList.remove('hidden'); // Show the input when we have a value
                    }
                });
            }

            // Show step input fields for all checked checkboxes
            if (typeof showStepInputsForCheckedBoxes === 'function') {
                showStepInputsForCheckedBoxes();
            }
        } else if (type === 'subtask') {
            document.getElementById('subtask-task-status').value = existingAnnotation.subtask_task_status || '';
            document.getElementById('subtask-model-status').value = existingAnnotation.subtask_model_status || '';
            document.getElementById('subtask-annotation-notes').value = existingAnnotation.notes || '';
        }

        // Show delete button
        const deleteBtn = document.getElementById('delete-annotation');
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => deleteSharedAnnotation(type, id);
    } else {
        document.getElementById('delete-annotation').style.display = 'none';
    }

    document.getElementById(`${currentAnnotationType}-annotation-modal`).classList.remove('hidden');
}

// Add migration function to convert old field names to new ones
function migrateAnnotationFields() {
    // Migrate subtask annotations
    for (const key in annotations.subtasks) {
        const annotation = annotations.subtasks[key];
        // Convert old field names to new ones if they exist
        if (annotation.success_status !== undefined) {
            annotation.subtask_task_status = annotation.success_status;
            delete annotation.success_status;
        }
        if (annotation.performance_status !== undefined) {
            annotation.subtask_model_status = annotation.performance_status;
            delete annotation.performance_status;
        }
        if (annotation.status === undefined) {
            annotation.status = annotation.subtask_task_status || 'UNKNOWN';
        }
    }
}
