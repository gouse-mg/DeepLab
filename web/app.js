const canvas = document.getElementById("canvas");
const analyseBtn = document.getElementById("analyseBtn");
const moduleIndexSelect = document.getElementById("moduleIndex");
const moduleFields = document.getElementById("moduleFields");

let nodes = {};
let edges = [];
let nodeCount = 0;
let selectedNode = null;
let backend = null;

/* ================= ICON PATHS (YOU ALREADY SET THESE) ================= */
const ICONS = {
    0: "images/ip.png",
    1: "images/linear.png",
    2: "images/conv.png",
    3: "images/custom.png"
};

/* ================= EDGE CREATION STATE ================= */
let isCreatingEdge = false;
let edgeSourceNode = null;
let tempLine = null;

const svg = document.querySelector("svg");

/* ================= QWEBCHANNEL ================= */
new QWebChannel(qt.webChannelTransport, function (channel) {
    backend = channel.objects.backend;
});

/* ================= PALETTE DRAG ================= */
document.querySelectorAll(".palette-node").forEach(p => {
    p.addEventListener("dragstart", e => {
        const moduleIndex = p.dataset.module;

        e.dataTransfer.setData("module", moduleIndex);
        e.dataTransfer.setData("label", p.querySelector("span").innerText);
        e.dataTransfer.setData("icon", ICONS[moduleIndex]);   // 🔴 IMPORTANT FIX
    });
});

canvas.addEventListener("dragover", e => e.preventDefault());

canvas.addEventListener("drop", e => {
    e.preventDefault();

    const moduleIndex = parseInt(e.dataTransfer.getData("module"));
    const label = e.dataTransfer.getData("label");
    const icon = e.dataTransfer.getData("icon");

    createNode(e.offsetX, e.offsetY, moduleIndex, label, icon);
});

/* ================= NODE CREATION ================= */
function createNode(x, y, moduleIndex, label, iconPath) {
    nodeCount++;
    const id = nodeCount.toString();

    const node = document.createElement("div");
    node.className = "node";
    node.dataset.id = id;

    // node.innerHTML = `
    //     <img src="${iconPath}">
    //     <div>${label}</div>
    //     <div class="delete-btn">×</div>
    // `;
    node.innerHTML = `
    <img src="${iconPath}">
    <div class="delete-btn">×</div>
    `;


    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    canvas.appendChild(node);

    nodes[id] = {
        module_index: moduleIndex,
        features: [],
        "user-defined": moduleIndex === 3 ? 1 : 0,
        "IpNode": moduleIndex === 0 ? 1 : 0
    };

    setupNodeEvents(node);
    selectNode(node);
}

/* ================= NODE EVENTS ================= */
function setupNodeEvents(nodeDiv) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    /* delete */
    nodeDiv.querySelector(".delete-btn").addEventListener("click", e => {
        e.stopPropagation();
        deleteNode(nodeDiv.dataset.id);
    });

    /* select */
    nodeDiv.addEventListener("click", e => {
        if (!isCreatingEdge && !isDragging) {
            selectNode(nodeDiv);
        }
    });

    /* start edge */
    nodeDiv.addEventListener("dblclick", e => {
        e.stopPropagation();
        startEdgeCreation(nodeDiv);
    });

    /* drag */
    nodeDiv.addEventListener("mousedown", e => {
        if (e.target.classList.contains("delete-btn")) return;

        isDragging = false;
        offsetX = e.offsetX;
        offsetY = e.offsetY;

        function move(ev) {
            isDragging = true;
            nodeDiv.style.left = `${ev.pageX - canvas.offsetLeft - offsetX}px`;
            nodeDiv.style.top = `${ev.pageY - canvas.offsetTop - offsetY}px`;
            updateEdges();
        }

        function stop() {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        }

        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
    });
}

/* ================= EDGE CREATION ================= */
function startEdgeCreation(sourceNode) {
    isCreatingEdge = true;
    edgeSourceNode = sourceNode;
    sourceNode.classList.add("selected");

    tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tempLine.classList.add("temp-line");
    svg.appendChild(tempLine);

    const r = sourceNode.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const x = r.left - c.left + r.width / 2;
    const y = r.top - c.top + r.height / 2;

    tempLine.setAttribute("x1", x);
    tempLine.setAttribute("y1", y);
    tempLine.setAttribute("x2", x);
    tempLine.setAttribute("y2", y);
}

canvas.addEventListener("mousemove", e => {
    if (isCreatingEdge && tempLine) {
        const c = canvas.getBoundingClientRect();
        tempLine.setAttribute("x2", e.clientX - c.left);
        tempLine.setAttribute("y2", e.clientY - c.top);
    }
});

canvas.addEventListener("mouseup", e => {
    if (!isCreatingEdge) return;

    if (e.target.classList.contains("node") && e.target !== edgeSourceNode) {
        createEdge(edgeSourceNode.dataset.id, e.target.dataset.id);
    }

    if (tempLine) tempLine.remove();
    edgeSourceNode.classList.remove("selected");

    tempLine = null;
    edgeSourceNode = null;
    isCreatingEdge = false;
});

/* ================= GRAPH ================= */
function createEdge(src, dest) {
    if (src === dest) return;
    if (edges.some(e => e.src === src && e.dest === dest)) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("edge-line");
    line.setAttribute("marker-end", "url(#arrowhead)");
    svg.appendChild(line);

    const edge = { src, dest, line };
    edges.push(edge);

    line.addEventListener("click", () => deleteEdge(edge));
    updateEdges();
}

function deleteEdge(edge) {
    edge.line.remove();
    edges = edges.filter(e => e !== edge);
}

function updateEdges() {
    edges.forEach(e => {
        const s = document.querySelector(`.node[data-id='${e.src}']`).getBoundingClientRect();
        const d = document.querySelector(`.node[data-id='${e.dest}']`).getBoundingClientRect();
        const c = canvas.getBoundingClientRect();

        e.line.setAttribute("x1", s.left - c.left + s.width / 2);
        e.line.setAttribute("y1", s.top - c.top + s.height / 2);
        e.line.setAttribute("x2", d.left - c.left + d.width / 2);
        e.line.setAttribute("y2", d.top - c.top + d.height / 2);
    });
}

/* ================= NODE SELECTION ================= */
function selectNode(nodeDiv) {
    document.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));
    nodeDiv.classList.add("selected");
    selectedNode = nodeDiv.dataset.id;
    loadNodeProperties(selectedNode);
}

function deleteNode(id) {
    document.querySelector(`.node[data-id='${id}']`)?.remove();
    delete nodes[id];

    edges = edges.filter(e => {
        if (e.src === id || e.dest === id) {
            e.line.remove();
            return false;
        }
        return true;
    });

    if (selectedNode === id) {
        selectedNode = null;
        moduleIndexSelect.value = "";
        moduleFields.innerHTML = "";
    }
}

/* ================= PROPERTIES ================= */
moduleIndexSelect.addEventListener("change", () => {
    if (!selectedNode) return;
    nodes[selectedNode].module_index = parseInt(moduleIndexSelect.value);
    renderModuleFields(nodes[selectedNode].module_index);
});

function loadNodeProperties(id) {
    const node = nodes[id];
    moduleIndexSelect.value = node.module_index ?? "";
    if (node.module_index !== null) renderModuleFields(node.module_index);
}

function renderModuleFields(index) {
    moduleFields.innerHTML = "";
    if (!selectedNode) return;

    if (index === 0) {
        moduleFields.innerHTML = `<div class="form-group"><label>Input Node</label></div>`;
        nodes[selectedNode].features = [];
        nodes[selectedNode].IpNode = 1;
        nodes[selectedNode]["user-defined"] = 1;
        return;
    }

    nodes[selectedNode].IpNode = 0;
    nodes[selectedNode]["user-defined"] = index === 3 ? 1 : 0;

    if (index === 1) {
        const f = nodes[selectedNode].features;
        moduleFields.innerHTML = `
            <div class="form-group"><label>In Features</label><input id="inFeat" type="number" value="${f[0] || 0}"></div>
            <div class="form-group"><label>Out Features</label><input id="outFeat" type="number" value="${f[1] || 0}"></div>
            <div class="form-group"><label><input type="checkbox" id="bias" ${f[2] ?? 1 ? "checked" : ""}> Bias</label></div>
        `;
    }

    if (index === 2) {
        const f = nodes[selectedNode].features;
        moduleFields.innerHTML = `
            <div class="form-group"><label>In Channels</label><input id="inFilt" type="number" value="${f[0] || 0}"></div>
            <div class="form-group"><label>Out Channels</label><input id="outFilt" type="number" value="${f[1] || 0}"></div>
            <div class="form-group"><label>Kernel</label><input id="kernel" type="number" value="${f[2] || 3}"></div>
            <div class="form-group"><label>Stride</label><input id="stride" type="number" value="${f[3] || 1}"></div>
            <div class="form-group"><label><input type="checkbox" id="padding" ${f[4] ? "checked" : ""}> Padding</label></div>
        `;
    }

    if (index === 3) {
    moduleFields.innerHTML = `
        <div class="form-group">
            <label>Code</label>
            <textarea id="codeEditor"></textarea>
        </div>
    `;

    const editor = CodeMirror.fromTextArea(
        document.getElementById("codeEditor"),
        {
            mode: "python",
            theme: "material-darker",
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            autofocus: true
        }
    );

    editor.setValue(nodes[selectedNode].features[0] || "");

    editor.on("change", () => {
        nodes[selectedNode].features = [
            editor.getValue(),
            2
        ];
    });
}


    moduleFields.querySelectorAll("input, textarea").forEach(el => {
        el.addEventListener("input", saveProperties);
        el.addEventListener("change", saveProperties);
    });

    saveProperties();
}

function saveProperties() {
    if (!selectedNode) return;

    const idx = nodes[selectedNode].module_index;

    /* Linear */
    if (idx === 1) {
        const inFeat = document.getElementById("inFeat");
        const outFeat = document.getElementById("outFeat");
        const bias = document.getElementById("bias");

        if (!inFeat || !outFeat || !bias) return;

        nodes[selectedNode].features = [
            parseInt(inFeat.value) || 0,
            parseInt(outFeat.value) || 0,
            bias.checked ? 1 : 0
        ];
    }

    /* Conv */
    if (idx === 2) {
        const inFilt = document.getElementById("inFilt");
        const outFilt = document.getElementById("outFilt");
        const kernel = document.getElementById("kernel");
        const stride = document.getElementById("stride");
        const padding = document.getElementById("padding");

        if (!inFilt || !outFilt || !kernel || !stride || !padding) return;

        nodes[selectedNode].features = [
            parseInt(inFilt.value) || 0,
            parseInt(outFilt.value) || 0,
            parseInt(kernel.value) || 3,
            parseInt(stride.value) || 1,
            padding.checked ? 1 : 0
        ];
    }

    /* Custom */
    if (idx === 3) {
        return;
    }
}


/* ================= ANALYSE ================= */
function getGraphData() {
    return {
        Nodes: nodes,
        Edges: edges.map(e => ({ src: e.src, dest: e.dest }))
    };
}

analyseBtn.addEventListener("click", () => {
    for (let id in nodes) {
        if (nodes[id].module_index === null) {
            alert(`Node ${id} missing module_index`);
            return;
        }
    }

    const payload = getGraphData();
    console.log(JSON.stringify(payload, null, 2));

    if (!backend) {
        alert("Backend not ready");
        return;
    }

    backend.analyze(JSON.stringify(payload), response => {
        const result = JSON.parse(response);
        alert(result.status === "ok" ? "Analysis complete" : result.message);
    });
});

