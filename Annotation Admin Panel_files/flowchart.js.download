// Only define the component if it hasn't been defined yet
if (!customElements.get('flowchart-component')) {
    class FlowchartComponent extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });

            // Initialize state
            this.zoom = 1;
            this.MIN_ZOOM = 0.5;
            this.MAX_ZOOM = 3;

            this.render();
        }

        render() {
            // Add styles and HTML structure
            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: block;
                        width: 100%;
                        height: 100%;
                    }

                    .planner-flow-panel {
                        width: 100%;
                        height: 100%;
                        background: var(--bg-surface, #181818);
                        border: 1px solid var(--border-primary, #333333);
                        border-radius: 8px;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }

                    .flow-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px;
                        border-bottom: 1px solid var(--border-primary, #333333);
                    }

                    .flow-header h3 {
                        margin: 0;
                        color: var(--color-purple, #d2a8ff);
                        font-size: 1.1em;
                    }

                    .flow-controls {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 4px;
                        border-radius: 4px;
                    }

                    .flow-controls button {
                        background-color: var(--bg-surface, #181818);
                        color: var(--text-primary, #f0f0f0);
                        border: 1px solid var(--border-muted, #30363d);
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 32px;
                    }

                    .flow-controls button:hover {
                        background-color: var(--bg-hover, #262626);
                        border-color: var(--border-secondary, #444444);
                    }

                    .flow-zoom-level {
                        background-color: var(--bg-elevated, #1e1e1e);
                        color: var(--text-secondary, #aaaaaa);
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.9em;
                        min-width: 64px;
                        text-align: center;
                        border: 1px solid var(--border-muted, #30363d);
                    }

                    .flow-controls button:last-child {
                        background-color: var(--bg-surface, #181818);
                        color: var(--color-primary, #28a94f);
                        border: 1px solid var(--success-border, #238636);
                    }

                    .flow-controls button:last-child:hover {
                        background-color: var(--success-bg, rgba(35, 134, 54, 0.1));
                        border-color: var(--success-hover, #2ea043);
                    }

                    .flow-content {
                        flex: 1;
                        overflow: auto;
                        padding: 16px;
                    }

                    .mermaid {
                        background: var(--bg-surface, #181818);
                        border-radius: 6px;
                        padding: 16px;
                    }

                    .flow-content.loading {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        color: var(--text-muted, #888888);
                        font-style: italic;
                    }

                    .flow-content.error {
                        color: var(--color-error, #ff3b30);
                        padding: 20px;
                        text-align: center;
                        font-style: italic;
                    }

                    .mermaid .node rect {
                        fill: var(--bg-elevated, #1e1e1e) !important;
                        stroke: var(--border-primary, #333333) !important;
                    }

                    .mermaid .node text {
                        fill: var(--text-primary, #f0f0f0) !important;
                    }

                    .mermaid .edgePath .path {
                        stroke: var(--text-primary, #f0f0f0) !important;
                        stroke-width: 2px !important;
                    }

                    .mermaid .arrowheadPath {
                        fill: var(--text-primary, #f0f0f0) !important;
                        stroke: none !important;
                    }

                    .mermaid .cluster rect {
                        fill: var(--bg-elevated, #1e1e1e) !important;
                        stroke: var(--border-primary, #333333) !important;
                    }
                </style>

                <div class="planner-flow-panel">
                    <div class="flow-header">
                        <h3>Execution Flow</h3>
                        <div class="flow-controls">
                            <button class="zoom-out">-</button>
                            <span class="flow-zoom-level">100%</span>
                            <button class="zoom-in">+</button>
                            <button class="reset-zoom">Reset</button>
                        </div>
                    </div>
                    <div class="flow-content">
                        <div class="mermaid"></div>
                    </div>
                </div>
            `;

            // Add event listeners
            this.shadowRoot.querySelector('.zoom-in').addEventListener('click', () => this.zoomFlowchart(0.1));
            this.shadowRoot.querySelector('.zoom-out').addEventListener('click', () => this.zoomFlowchart(-0.1));
            this.shadowRoot.querySelector('.reset-zoom').addEventListener('click', () => this.resetZoom());
        }

        zoomFlowchart(delta) {
            const newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom + delta));
            if (newZoom !== this.zoom) {
                this.zoom = newZoom;
                this.updateZoom();
            }
        }

        resetZoom() {
            this.zoom = 1;
            this.updateZoom();
        }

        updateZoom() {
            const mermaidDiv = this.shadowRoot.querySelector('.mermaid');
            if (mermaidDiv) {
                mermaidDiv.style.transform = `scale(${this.zoom})`;
                mermaidDiv.style.transformOrigin = 'top left';

                // Update zoom level display
                const zoomLevelDisplay = this.shadowRoot.querySelector('.flow-zoom-level');
                if (zoomLevelDisplay) {
                    zoomLevelDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
                }
            }
        }

        // Method to update the flowchart content
        updateFlowchart(definition) {
            const flowContent = this.shadowRoot.querySelector('.flow-content');
            const mermaidDiv = flowContent.querySelector('.mermaid');

            try {
                flowContent.classList.add('loading');
                mermaidDiv.textContent = definition;

                // Render the flowchart using mermaid
                mermaid.render('plannerFlow', definition).then(({ svg }) => {
                    mermaidDiv.innerHTML = svg;
                    flowContent.classList.remove('loading');
                    this.updateZoom(); // Maintain zoom level after update
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
        }
    }

    // Register the component
    customElements.define('flowchart-component', FlowchartComponent);
}
