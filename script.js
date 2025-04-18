// Define default directory rules
let directoryRules = {
  CheckpointLoaderSimple: "checkpoints",
  ControlNetLoader: "control_models",
  VAELoader: "vae",
  UpscaleModelLoader: "upscale_models",
  CLIPVisionLoader: "clip_vision",
  LoraLoader: "loras",
  LoraLoaderModelOnly: "loras",
  ImageOnlyCheckpointLoader: "checkpoints",
  QuadrupleCLIPLoader: "text_encoders",
};

// DOM element references
const jsonInput = document.getElementById("jsonInput");
const lineNumbers = document.getElementById("lineNumbers");
const copyBtn = document.getElementById("copyBtn");
const nodesContainer = document.getElementById("nodesContainer");
const directorySettingsContainer = document.getElementById("directorySettings");
const addDirectoryRuleBtn = document.getElementById("addDirectoryRule");
const totalModels = document.getElementById("totalModels");
const validModels = document.getElementById("validModels");
const invalidModels = document.getElementById("invalidModels");
const messageContainer = document.getElementById("message-container");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const saveBtn = document.getElementById("saveBtn");
const errorUrlModels = document.getElementById("errorUrlModels");
const missingUrlModels = document.getElementById("missingUrlModels");
const bulkLinksInput = document.getElementById("bulkLinksInput");
const applyBulkLinks = document.getElementById("applyBulkLinks");
const clearBulkLinks = document.getElementById("clearBulkLinks");

// Store whether auto real-time update is enabled
let autoUpdateEnabled = true;

// Store parsed JSON data
let parsedJson = null;
// Store information of nodes to be modified
let nodesToEdit = [];
// Store node positions in JSON
let nodePositions = {};

// Initialize the page
function initPage() {
  // Set line numbers
  jsonInput.addEventListener("scroll", syncScroll);
  jsonInput.addEventListener("input", updateLineNumbers);

  // Initialize button events
  copyBtn.addEventListener("click", copyUpdatedJson);
  addDirectoryRuleBtn.addEventListener("click", addNewDirectoryRule);

  // Initialize directory rule settings
  renderDirectorySettings();

  // Set initial line numbers
  updateLineNumbers();

  // Add file upload event listener
  fileInput.addEventListener("change", handleFileUpload);

  // Add JSON input event listener - automatically parse when pasting content
  jsonInput.addEventListener("paste", () => {
    setTimeout(() => {
      if (jsonInput.value.trim()) {
        parseJsonData();
        // If pasted, set the file name to "Untitled"
        fileName.value = "Untitled";
      }
    }, 100);
  });

  // Add input event listener - also try to parse when the user manually inputs content
  jsonInput.addEventListener("input", () => {
    // Only attempt to parse when the input contains enough JSON structure
    if (
      jsonInput.value.trim().length > 50 &&
      jsonInput.value.includes("{") &&
      jsonInput.value.includes("}")
    ) {
      parseJsonData();
    }
  });

  // Add save button event listener
  saveBtn.addEventListener("click", saveJsonToFile);

  // Add bulk link related events
  applyBulkLinks.addEventListener("click", processBulkLinks);
  clearBulkLinks.addEventListener("click", () => {
    bulkLinksInput.value = "";
  });
}

// Sync the scroll of the text area and line numbers
function syncScroll() {
  lineNumbers.scrollTop = jsonInput.scrollTop;
}

// Update line numbers
function updateLineNumbers() {
  const lines = jsonInput.value.split("\n");
  lineNumbers.innerHTML = "";

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = document.createElement("div");
    lineNumber.textContent = i + 1;
    lineNumbers.appendChild(lineNumber);
  }
}

// Render directory rule settings
function renderDirectorySettings() {
  directorySettingsContainer.innerHTML = "";

  for (const [nodeType, directory] of Object.entries(directoryRules)) {
    const ruleElement = createDirectoryRuleElement(nodeType, directory);
    directorySettingsContainer.appendChild(ruleElement);
  }
}

// Create a DOM element for a single directory rule
function createDirectoryRuleElement(nodeType, directory) {
  const ruleDiv = document.createElement("div");
  ruleDiv.className = "directory-rule";

  const nodeTypeInput = document.createElement("input");
  nodeTypeInput.type = "text";
  nodeTypeInput.value = nodeType;
  nodeTypeInput.placeholder = "Node Type";
  nodeTypeInput.addEventListener("change", (e) => {
    const oldType = nodeType;
    const newType = e.target.value;

    if (newType && newType !== oldType) {
      directoryRules[newType] = directoryRules[oldType];
      delete directoryRules[oldType];
      nodeType = newType;
    }
  });

  const directoryInput = document.createElement("input");
  directoryInput.type = "text";
  directoryInput.value = directory;
  directoryInput.placeholder = "Storage Directory";
  directoryInput.addEventListener("input", (e) => {
    directoryRules[nodeType] = e.target.value;
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-rule";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    delete directoryRules[nodeType];
    renderDirectorySettings();
  });

  ruleDiv.appendChild(nodeTypeInput);
  ruleDiv.appendChild(directoryInput);
  ruleDiv.appendChild(removeBtn);

  return ruleDiv;
}

// Add a new directory rule
function addNewDirectoryRule() {
  const newType = "";
  const newDirectory = "";

  directoryRules[newType] = newDirectory;
  renderDirectorySettings();

  // Focus on the newly created input box
  const inputs = directorySettingsContainer.querySelectorAll("input");
  if (inputs.length >= 2) {
    inputs[inputs.length - 2].focus();
  }
}

// Parse JSON data
function parseJsonData() {
  try {
    const jsonString = jsonInput.value.trim();
    if (!jsonString) {
      showMessage("Please paste or upload JSON data first", "error");
      return;
    }

    parsedJson = JSON.parse(jsonString);
    if (!parsedJson.nodes || !Array.isArray(parsedJson.nodes)) {
      throw new Error("No valid nodes array found in JSON data");
    }

    // Find node positions in JSON
    findNodePositions(jsonString);

    // Find nodes that need editing
    nodesToEdit = findNodesToEdit(parsedJson.nodes);

    // Render node editing interface
    renderNodeEditor();

    // Update statistics
    updateStats();

    showMessage("JSON parsed successfully");
  } catch (error) {
    nodesContainer.innerHTML = `
      <div class="error">
        Failed to parse JSON: ${error.message}
      </div>
    `;
    showMessage(`Failed to parse JSON: ${error.message}`, "error");
  }
}

// Find the starting line number and model property position of each node in JSON
function findNodePositions(jsonString) {
  nodePositions = {};
  const lines = jsonString.split("\n");

  // Regular expressions: used to match the definition of node ID
  const idRegex = /"id":\s*(\d+)/;
  const nameRegex = /"name":\s*"([^"]+)"/;
  const urlRegex = /"url":\s*"([^"]+)"/;
  const modelsRegex = /"models":\s*\[/;
  const propertiesRegex = /"properties":\s*\{/;

  let currentNodeId = null;
  let inModels = false;
  let modelStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if it is the start of a new node
    const idMatch = line.match(idRegex);
    if (idMatch) {
      currentNodeId = parseInt(idMatch[1]);

      // Find the starting position of the node (look up for the opening brace)
      let startLine = i;
      while (startLine > 0 && !lines[startLine].includes("{")) {
        startLine--;
      }

      // Initialize node position information
      nodePositions[currentNodeId] = {
        startLine: startLine,
        idLine: i,
        propertiesLine: -1,
        modelsLine: -1,
        modelEntries: [],
      };
    }

    // If the node ID has been found, check other key fields
    if (currentNodeId !== null) {
      // Check properties position
      if (line.match(propertiesRegex)) {
        nodePositions[currentNodeId].propertiesLine = i;
      }

      // Check models position
      if (line.match(modelsRegex)) {
        nodePositions[currentNodeId].modelsLine = i;
        inModels = true;
        modelStartLine = i + 1; // Model entries start from the next line
      }

      // Check model entry information
      if (inModels) {
        const nameMatch = line.match(nameRegex);
        if (nameMatch) {
          const modelName = nameMatch[1];
          nodePositions[currentNodeId].modelEntries.push({
            name: modelName,
            nameLine: i,
            urlLine: -1, // Initialize to -1, may be found later
          });
        }

        const urlMatch = line.match(urlRegex);
        if (urlMatch && nodePositions[currentNodeId].modelEntries.length > 0) {
          // Associate the URL line number with the most recent model entry
          const lastEntryIndex =
            nodePositions[currentNodeId].modelEntries.length - 1;
          nodePositions[currentNodeId].modelEntries[lastEntryIndex].urlLine = i;
        }

        // Check if exiting the models array
        if (line.includes("]") && !line.includes("[")) {
          inModels = false;
        }
      }

      // Check if exiting the current node
      if (line.includes("}") && !line.includes("{")) {
        // Check if it is the outermost brace (node end)
        let openBraces = 0;
        let closeBraces = 0;

        for (let j = nodePositions[currentNodeId].startLine; j <= i; j++) {
          openBraces += (lines[j].match(/\{/g) || []).length;
          closeBraces += (lines[j].match(/\}/g) || []).length;
        }

        if (openBraces === closeBraces) {
          currentNodeId = null;
          inModels = false;
        }
      }
    }
  }

  return nodePositions;
}

// Find nodes that need to edit model information
function findNodesToEdit(nodes) {
  const result = [];

  for (const node of nodes) {
    if (!node.widgets_values || !Array.isArray(node.widgets_values)) {
      continue;
    }

    // Check if it is a model loader node - must have "Node name for S&R" property in properties
    const isModelLoaderNode =
      node.properties && node.properties["Node name for S&R"];
    if (!isModelLoaderNode) {
      continue;
    }

    // Check if there are .safetensors or .sft files in widget_values
    const modelFiles = [];
    for (const value of node.widgets_values) {
      if (
        value &&
        typeof value === "string" &&
        (value.includes(".safetensors") || value.includes(".sft"))
      ) {
        modelFiles.push(value);
      }
    }

    if (modelFiles.length > 0) {
      result.push({
        node,
        existingModels:
          node.properties && node.properties.models
            ? [...node.properties.models]
            : [],
        modelFiles: modelFiles, // Store all model files
        fileName: modelFiles[0].split("\\").pop(), // Compatible with old code, keep the first file name
      });
    }
  }

  return result;
}

// Get model file name from widgets_values
function getModelFileName(values) {
  for (const value of values) {
    if (
      value &&
      typeof value === "string" &&
      (value.includes(".safetensors") || value.includes(".sft"))
    ) {
      return value.split("\\").pop();
    }
  }
  return "";
}

// Render node editing interface
function renderNodeEditor() {
  if (nodesToEdit.length === 0) {
    nodesContainer.innerHTML = `
            <div class="empty-message">
                No nodes found that need model information editing
            </div>
        `;
    return;
  }

  nodesContainer.innerHTML = "";

  for (const nodeInfo of nodesToEdit) {
    const nodeCard = createNodeCard(nodeInfo);
    nodesContainer.appendChild(nodeCard);
  }
}

// Create node card
function createNodeCard(nodeInfo) {
  const { node, existingModels, modelFiles, fileName } = nodeInfo;

  const card = document.createElement("div");
  card.className = "node-card";
  card.dataset.nodeId = node.id;

  // Add click event to scroll to the corresponding position in JSON
  card.addEventListener("click", () => {
    scrollToNode(node.id);

    // Remove highlight from other cards
    document.querySelectorAll(".node-card").forEach((card) => {
      card.classList.remove("active");
    });

    // Highlight the current card
    card.classList.add("active");
  });

  // Node header information
  const header = document.createElement("div");
  header.className = "node-header";
  header.innerHTML = `
        <span class="node-type">${node.type}</span>
        <span class="node-id">ID: ${node.id}</span>
    `;

  // Node body content
  const body = document.createElement("div");
  body.className = "node-body";

  // Add empty property warning (if needed)
  const hasEmptyProperties =
    !node.properties ||
    Object.keys(node.properties).length === 1 ||
    (Object.keys(node.properties).length === 1 &&
      node.properties["Node name for S&R"]);

  if (hasEmptyProperties) {
    const warningDiv = document.createElement("div");
    warningDiv.className = "empty-properties-warning";
    warningDiv.innerHTML = `<i>⚠️</i> This node lacks property data, please supplement model information!`;
    body.appendChild(warningDiv);
  }

  // Display all model files
  const fileListDiv = document.createElement("div");
  fileListDiv.className = "file-list";

  if (modelFiles.length > 1) {
    // If there are multiple model files, add a title
    const fileListTitle = document.createElement("div");
    fileListTitle.className = "file-list-title";
    fileListTitle.innerHTML = `<strong>Detected ${modelFiles.length} model files:</strong>`;
    fileListDiv.appendChild(fileListTitle);

    // Add each file
    for (let i = 0; i < modelFiles.length; i++) {
      const fileNameDiv = document.createElement("div");
      fileNameDiv.className = "file-name";
      fileNameDiv.innerHTML = `<span class="file-index">${
        i + 1
      }.</span> ${modelFiles[i].split("\\").pop()}`;
      fileListDiv.appendChild(fileNameDiv);
    }
  } else {
    // Display single file
    const fileNameDiv = document.createElement("div");
    fileNameDiv.className = "file-name";
    fileNameDiv.textContent = fileName;
    fileListDiv.appendChild(fileNameDiv);
  }

  body.appendChild(fileListDiv);

  // Model entry container
  const modelsContainer = document.createElement("div");
  modelsContainer.className = "models-container";
  modelsContainer.dataset.nodeId = node.id;

  // Analyze the matching situation of existing models and files
  if (existingModels.length > 0) {
    // First display existing models
    for (const model of existingModels) {
      const modelEntry = createModelEntry(
        node.id,
        model,
        getClosestFileName(model.name, modelFiles)
      );
      modelsContainer.appendChild(modelEntry);
    }

    // Check for unadded model files
    const existingNames = existingModels.map((model) => model.name);
    const missingFiles = modelFiles
      .map((file) => file.split("\\").pop())
      .filter((file) => !existingNames.some((name) => name === file));

    // Create entries for each unadded model file
    for (const missingFile of missingFiles) {
      const emptyModel = {
        name: missingFile,
        url: "",
        directory: getDirectoryForNode(node.type),
      };
      const modelEntry = createModelEntry(node.id, emptyModel, missingFile);
      modelsContainer.appendChild(modelEntry);
    }
  } else {
    // If there are no existing models, add an empty model entry for each model file
    for (const file of modelFiles) {
      const fileBaseName = file.split("\\").pop();
      const emptyModel = {
        name: fileBaseName,
        url: "",
        directory: getDirectoryForNode(node.type),
      };
      const modelEntry = createModelEntry(node.id, emptyModel, fileBaseName);
      modelsContainer.appendChild(modelEntry);
    }
  }

  body.appendChild(modelsContainer);

  // Add model button
  const addModelBtn = document.createElement("button");
  addModelBtn.className = "add-model";
  addModelBtn.textContent = "Add Model";
  addModelBtn.addEventListener("click", () => {
    const emptyModel = {
      name: "",
      url: "",
      directory: getDirectoryForNode(node.type),
    };
    const modelEntry = createModelEntry(node.id, emptyModel, "");
    modelsContainer.appendChild(modelEntry);
    updateStats(); // Update statistics
  });

  body.appendChild(addModelBtn);

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

// Find the closest matching file name (for displaying validation status)
function getClosestFileName(modelName, modelFiles) {
  if (!modelName || !modelFiles || modelFiles.length === 0) {
    return "";
  }

  // Try exact match
  for (const file of modelFiles) {
    const fileName = file.split("\\").pop();
    if (fileName === modelName) {
      return fileName;
    }
  }

  // Return the first file name as default
  return modelFiles[0].split("\\").pop();
}

// Scroll to the node position in JSON
function scrollToNode(nodeId) {
  const position = nodePositions[nodeId];
  if (!position) return;

  // Get line elements
  const lineElements = lineNumbers.children;
  if (!lineElements || lineElements.length === 0) return;

  // Calculate scroll position - if there are properties, scroll to properties, otherwise scroll to node start
  const targetLine =
    position.propertiesLine > -1 ? position.propertiesLine : position.startLine;
  const lineHeight = lineElements[0].offsetHeight;
  const scrollPosition = targetLine * lineHeight;

  // Scroll to position
  jsonInput.scrollTop = scrollPosition;

  // Highlight the line
  highlightNodeData(nodeId); // Highlight related lines
}

// Highlight lines
function highlightLine(startLine, count) {
  // Remove existing highlights
  const existingHighlights = lineNumbers.querySelectorAll(".highlight-line");
  existingHighlights.forEach((el) => el.classList.remove("highlight-line"));

  // Add new highlights
  for (
    let i = startLine;
    i < startLine + count && i < lineNumbers.children.length;
    i++
  ) {
    lineNumbers.children[i].classList.add("highlight-line");
  }
}

// Highlight node related data
function highlightNodeData(nodeId) {
  const position = nodePositions[nodeId];
  if (!position) return;

  // Remove existing highlights
  const existingHighlights = lineNumbers.querySelectorAll(".highlight-line");
  existingHighlights.forEach((el) => el.classList.remove("highlight-line"));

  // If the models line is found, highlight the models section
  if (position.modelsLine > -1) {
    // Highlight a few lines starting from models
    let startLine = position.modelsLine;
    let endLine = position.modelsLine + 15; // Assume a maximum of 15 lines

    // Adjust the end line to avoid exceeding the node range
    for (let i = startLine; i < lineNumbers.children.length; i++) {
      if (i > startLine + 2 && jsonInput.value.split("\n")[i].includes("]")) {
        endLine = i + 1;
        break;
      }
    }

    for (
      let i = startLine;
      i < endLine && i < lineNumbers.children.length;
      i++
    ) {
      lineNumbers.children[i].classList.add("highlight-line");
    }
  }
  // Otherwise highlight the properties section
  else if (position.propertiesLine > -1) {
    // Highlight properties line and the following few lines
    const startLine = position.propertiesLine;
    const linesCount = 5;

    for (
      let i = startLine;
      i < startLine + linesCount && i < lineNumbers.children.length;
      i++
    ) {
      lineNumbers.children[i].classList.add("highlight-line");
    }
  }
  // If none found, highlight the start of the node
  else {
    const startLine = position.startLine;
    const linesCount = 5;

    for (
      let i = startLine;
      i < startLine + linesCount && i < lineNumbers.children.length;
      i++
    ) {
      lineNumbers.children[i].classList.add("highlight-line");
    }
  }
}

// Create model entry
function createModelEntry(nodeId, model, fileName) {
  const entry = document.createElement("div");
  entry.className = "model-entry";

  // Name input
  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Model Name:";

  const nameValidationDiv = document.createElement("div");
  nameValidationDiv.className = "input-with-validation";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = model.name || "";
  nameInput.placeholder = "Model File Name";

  const nameValidation = document.createElement("div");
  nameValidation.className = "validation-status";
  updateNameValidation(nameInput.value, fileName, nameValidation);

  nameInput.addEventListener("input", () => {
    updateNameValidation(nameInput.value, fileName, nameValidation);
    updateStats(); // Update statistics
    if (autoUpdateEnabled) {
      // Real-time update JSON
      updateJsonData();
    }
  });

  // Add focus event to highlight the corresponding line when editing the name
  nameInput.addEventListener("focus", () => {
    highlightNameField(nodeId, model.name);
  });

  nameValidationDiv.appendChild(nameInput);
  nameValidationDiv.appendChild(nameValidation);

  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameValidationDiv);

  // URL input
  const urlGroup = document.createElement("div");
  urlGroup.className = "form-group";

  const urlLabel = document.createElement("label");
  urlLabel.textContent = "Model URL:";

  const urlValidationDiv = document.createElement("div");
  urlValidationDiv.className = "input-with-validation";

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.value = model.url || "";
  urlInput.placeholder = "Model Download URL";

  const urlValidation = document.createElement("div");
  urlValidation.className = "validation-status";
  validateModelUrl(urlInput.value, model.name, urlValidation);

  urlInput.addEventListener("input", () => {
    validateModelUrl(urlInput.value, model.name, urlValidation);
    updateStats(); // Update statistics
    if (autoUpdateEnabled) {
      // Real-time update JSON
      updateJsonData();
    }
  });

  // Add focus event to highlight the corresponding line when editing the URL
  urlInput.addEventListener("focus", () => {
    highlightUrlField(nodeId, model.name);
  });

  nameInput.addEventListener("input", () => {
    validateModelUrl(urlInput.value, model.name, urlValidation);
  });

  urlValidationDiv.appendChild(urlInput);
  urlValidationDiv.appendChild(urlValidation);

  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlValidationDiv);

  // Directory input
  const dirGroup = document.createElement("div");
  dirGroup.className = "form-group";

  const dirLabel = document.createElement("label");
  dirLabel.textContent = "Storage Directory:";

  const dirInput = document.createElement("input");
  dirInput.type = "text";
  dirInput.value = model.directory || "";
  dirInput.placeholder = "Model Storage Directory";

  // Real-time update when the directory changes
  dirInput.addEventListener("input", () => {
    if (autoUpdateEnabled) {
      // Real-time update JSON
      updateJsonData();
    }
  });

  // Add focus event to highlight the corresponding line when editing the directory
  dirInput.addEventListener("focus", () => {
    highlightDirectoryField(nodeId, model.name);
  });

  dirGroup.appendChild(dirLabel);
  dirGroup.appendChild(dirInput);

  // Delete button
  const actions = document.createElement("div");
  actions.className = "model-actions";

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-rule";
  removeBtn.textContent = "Remove Model";
  removeBtn.addEventListener("click", () => {
    entry.remove();
    updateStats(); // Update statistics
    if (autoUpdateEnabled) {
      // Real-time update JSON
      updateJsonData();
    }
  });

  actions.appendChild(removeBtn);

  // Assemble entry
  entry.appendChild(nameGroup);
  entry.appendChild(urlGroup);
  entry.appendChild(dirGroup);
  entry.appendChild(actions);

  // Data attributes for collecting model information
  entry.dataset.nodeId = nodeId;
  entry.dataset.modelName = model.name;

  return entry;
}

// Highlight name field
function highlightNameField(nodeId, modelName) {
  const position = nodePositions[nodeId];
  if (!position) return;

  // Remove existing highlights
  const existingHighlights = lineNumbers.querySelectorAll(".highlight-line");
  existingHighlights.forEach((el) => el.classList.remove("highlight-line"));

  // If there are model entries
  if (position.modelEntries && position.modelEntries.length > 0) {
    // Find the matching model entry
    const modelEntry = position.modelEntries.find(
      (entry) => entry.name === modelName
    );

    if (modelEntry && modelEntry.nameLine > -1) {
      // Highlight the name line and its surrounding lines
      highlightLine(modelEntry.nameLine - 1, 3);
      return;
    }
  }

  // If no specific line found, highlight the models section
  if (position.modelsLine > -1) {
    highlightLine(position.modelsLine, 5);
  } else if (position.propertiesLine > -1) {
    highlightLine(position.propertiesLine, 3);
  }
}

// Highlight URL field
function highlightUrlField(nodeId, modelName) {
  const position = nodePositions[nodeId];
  if (!position) return;

  // Remove existing highlights
  const existingHighlights = lineNumbers.querySelectorAll(".highlight-line");
  existingHighlights.forEach((el) => el.classList.remove("highlight-line"));

  // If there are model entries
  if (position.modelEntries && position.modelEntries.length > 0) {
    // Find the matching model entry
    const modelEntry = position.modelEntries.find(
      (entry) => entry.name === modelName
    );

    if (modelEntry && modelEntry.urlLine > -1) {
      // Highlight the URL line and its surrounding lines
      highlightLine(modelEntry.urlLine - 1, 3);
      return;
    }
  }

  // If no specific line found, highlight the models section
  if (position.modelsLine > -1) {
    highlightLine(position.modelsLine, 5);
  } else if (position.propertiesLine > -1) {
    highlightLine(position.propertiesLine, 3);
  }
}

// Highlight directory field
function highlightDirectoryField(nodeId, modelName) {
  const position = nodePositions[nodeId];
  if (!position) return;

  // Remove existing highlights
  const existingHighlights = lineNumbers.querySelectorAll(".highlight-line");
  existingHighlights.forEach((el) => el.classList.remove("highlight-line"));

  // If there are model entries, try to locate the directory line (usually after the URL line)
  if (position.modelEntries && position.modelEntries.length > 0) {
    // Find the matching model entry
    const modelEntry = position.modelEntries.find(
      (entry) => entry.name === modelName
    );

    if (modelEntry && modelEntry.urlLine > -1) {
      // Highlight the line after the URL line (which may be the directory line)
      highlightLine(modelEntry.urlLine, 3);
      return;
    }
  }

  // If no specific line found, highlight the models section
  if (position.modelsLine > -1) {
    highlightLine(position.modelsLine, 5);
  } else if (position.propertiesLine > -1) {
    highlightLine(position.propertiesLine, 3);
  }
}

// Validate model name
function updateNameValidation(name, fileName, validationElement) {
  // Do not validate if no file name reference is set
  if (!fileName) {
    validationElement.className = "validation-status";
    validationElement.title = "";
    return;
  }

  // Clean the file name (remove path prefix)
  const cleanFileName = fileName.split("\\").pop();

  if (name === fileName || name === cleanFileName) {
    validationElement.className = "validation-status valid";
    validationElement.title = "Model name matches file name";
  } else {
    validationElement.className = "validation-status invalid";
    validationElement.title = "Model name should match file name";
  }
}

// Validate model URL format
function validateModelUrl(url, name, validationElement) {
  // Check if URL is empty
  if (!url.trim()) {
    validationElement.className = "validation-status invalid";
    validationElement.title = "URL cannot be empty";
    return;
  }

  // Extract file name part from URL
  let urlFileName = "";
  try {
    // Remove query parameters
    const urlWithoutQuery = url.split("?")[0];
    // Get the last part after the last slash as the file name
    const pathParts = urlWithoutQuery.split("/");
    urlFileName = pathParts[pathParts.length - 1];
  } catch (e) {
    urlFileName = "";
  }

  // Check if the URL file name matches the model name
  if (urlFileName === name) {
    validationElement.className = "validation-status valid";
    validationElement.title = "URL file name matches model name";
  } else {
    validationElement.className = "validation-status invalid";
    validationElement.title = "URL file name should match model name";
  }
}

// Update statistics
function updateStats() {
  let total = 0;
  let valid = 0;
  let invalid = 0;
  let errorUrl = 0;
  let missingUrl = 0;

  // Clear all existing error and missing markers
  document.querySelectorAll(".model-entry").forEach((entry) => {
    entry.classList.remove("error-url", "missing-url");
  });

  // Get all model entries
  const modelEntries = document.querySelectorAll(".model-entry");

  modelEntries.forEach((entry) => {
    total++;

    // Check name and URL validation status
    const nameValidation = entry.querySelector(
      ".form-group:nth-child(1) .validation-status"
    );
    const urlValidation = entry.querySelector(
      ".form-group:nth-child(2) .validation-status"
    );

    // Get URL input box
    const urlInput = entry.querySelector(".form-group:nth-child(2) input");
    const urlValue = urlInput ? urlInput.value.trim() : "";

    // Determine if it is a valid model (both name and URL are valid)
    if (
      nameValidation.classList.contains("valid") &&
      urlValidation.classList.contains("valid")
    ) {
      valid++;
    } else {
      invalid++;

      // Check if URL is empty
      if (!urlValue) {
        missingUrl++;
        entry.classList.add("missing-url");
        entry.dataset.errorType = "missing";
      }
      // URL is not empty but invalid
      else if (urlValidation.classList.contains("invalid")) {
        errorUrl++;
        entry.classList.add("error-url");
        entry.dataset.errorType = "error";
      }
    }
  });

  // Update statistics display
  totalModels.textContent = total;
  validModels.textContent = valid;
  invalidModels.textContent = invalid;
  errorUrlModels.textContent = errorUrl;
  missingUrlModels.textContent = missingUrl;

  // Add click events to statistics numbers
  setupStatClicks(errorUrlModels, "error");
  setupStatClicks(missingUrlModels, "missing");
}

// Set click events for statistics numbers
function setupStatClicks(element, errorType) {
  // Remove existing event listeners
  element.removeEventListener("click", element.clickHandler);

  // Create new click handler function
  element.clickHandler = () => {
    // Find the first entry corresponding to the error type
    const firstErrorEntry = document.querySelector(
      `.model-entry[data-error-type="${errorType}"]`
    );
    if (firstErrorEntry) {
      // Scroll to the corresponding entry
      firstErrorEntry.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the entry (temporarily add a highlight class)
      firstErrorEntry.classList.add("highlight-entry");
      setTimeout(() => {
        firstErrorEntry.classList.remove("highlight-entry");
      }, 2000);
    }
  };

  // Add new event listener
  element.addEventListener("click", element.clickHandler);

  // Only show as clickable if there are errors
  if (parseInt(element.textContent) > 0) {
    element.classList.add("clickable");
  } else {
    element.classList.remove("clickable");
  }
}

// Get default directory based on node type
function getDirectoryForNode(nodeType) {
  return directoryRules[nodeType] || "";
}

// Update JSON data
function updateJsonData(isManualUpdate = false) {
  if (!parsedJson) {
    return;
  }

  try {
    // Collect edited model information
    for (const nodeInfo of nodesToEdit) {
      const nodeId = nodeInfo.node.id;
      const modelEntries = document.querySelectorAll(
        `.model-entry[data-node-id="${nodeId}"]`
      );
      const models = [];

      // Collect model information, only add complete models (name, url, and directory are not empty)
      for (const entry of modelEntries) {
        const inputs = entry.querySelectorAll("input");
        const name = inputs[0].value.trim();
        const url = inputs[1].value.trim();
        const directory = inputs[2].value.trim();

        // Only add models when all fields are not empty
        if (name && url && directory) {
          models.push({
            name,
            url,
            directory,
          });
        }
      }

      // Update the node's model information
      const node = parsedJson.nodes.find((n) => n.id === nodeId);
      if (node) {
        if (!node.properties) {
          node.properties = {};
        }

        if (models.length > 0) {
          node.properties.models = models;
        } else {
          // If there are no models, delete the models property
          if (node.properties.models) {
            delete node.properties.models;
          }
        }
      }
    }

    // Format and update display
    const formattedJson = JSON.stringify(parsedJson, null, 2);
    jsonInput.value = formattedJson;
    updateLineNumbers();

    // Re-find node positions
    findNodePositions(formattedJson);

    // Update statistics
    updateStats();
  } catch (error) {
    // Remove manual update error prompt
  }
}

// Copy updated JSON
function copyUpdatedJson() {
  if (!jsonInput.value) {
    showMessage("No content to copy", "error");
    return;
  }

  jsonInput.select();
  document.execCommand("copy");

  showMessage("JSON copied to clipboard");
}

// Show message notification
function showMessage(message, type = "success", duration = 3000) {
  const messageElement = document.createElement("div");
  messageElement.className = `message${type !== "success" ? " " + type : ""}`;
  messageElement.textContent = message;

  messageContainer.appendChild(messageElement);

  // Force reflow to enable enter animation
  messageElement.offsetHeight;

  // Auto disappear
  setTimeout(() => {
    messageElement.classList.add("fade-out");
    setTimeout(() => {
      if (messageContainer.contains(messageElement)) {
        messageContainer.removeChild(messageElement);
      }
    }, 500);
  }, duration);
}

// Handle file upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file || !file.name.endsWith(".json")) {
    showMessage("Please select a valid JSON file", "error");
    return;
  }

  // Set file name (remove .json extension)
  const nameWithoutExt = file.name.replace(/\.json$/, "");
  fileName.value = nameWithoutExt;

  // Read file content
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      jsonInput.value = e.target.result;
      // Automatically parse
      parseJsonData();
    } catch (error) {
      showMessage(`File read failed: ${error.message}`, "error");
    }
  };
  reader.onerror = function () {
    showMessage("File read failed", "error");
  };
  reader.readAsText(file);
}

// Save JSON to file
function saveJsonToFile() {
  if (!jsonInput.value) {
    showMessage("No content to save", "error");
    return;
  }

  try {
    // Ensure the current JSON is valid
    JSON.parse(jsonInput.value);

    // Create blob object
    const blob = new Blob([jsonInput.value], { type: "application/json" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Use user input file name
    let saveFileName = fileName.value.trim() || "Untitled";
    // Ensure it has .json extension
    if (!saveFileName.endsWith(".json")) {
      saveFileName += ".json";
    }

    a.download = saveFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage(`JSON saved as ${saveFileName}`);
  } catch (error) {
    showMessage(`Save failed: ${error.message}`, "error");
  }
}

// Process bulk links function
function processBulkLinks() {
  const text = bulkLinksInput.value.trim();
  if (!text) {
    showMessage("Please enter links first", "info");
    return;
  }

  // Use regular expression to extract URLs
  const urls = extractUrls(text);
  if (urls.length === 0) {
    showMessage("No valid URLs found", "error");
    return;
  }

  // Extract model names from URLs and match fill
  const matchResults = matchAndFillModelLinks(urls);

  // Show processing results
  let message = `Processing complete: found ${urls.length} links, successfully matched ${matchResults.matched} items`;
  if (matchResults.updatedErrors > 0) {
    message += `, fixed ${matchResults.updatedErrors} error links`;
  }

  showMessage(message, matchResults.matched > 0 ? "success" : "info");
}

// Extract URLs from text
function extractUrls(text) {
  // URL regular expression - match http/https links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Match and fill model links
function matchAndFillModelLinks(urls) {
  let matchedCount = 0;
  let updatedErrorCount = 0; // New: record the number of updated error links
  const modelEntries = document.querySelectorAll(".model-entry");
  const modelMap = new Map(); // Used to store the mapping of model names to entries

  // First establish the mapping of all model names to entries
  modelEntries.forEach((entry) => {
    const nameInput = entry.querySelector(".form-group:nth-child(1) input");
    if (nameInput && nameInput.value.trim()) {
      // Use lowercase for case-insensitive matching
      modelMap.set(nameInput.value.trim().toLowerCase(), entry);
    }
  });

  // Process each URL
  for (const url of urls) {
    // Extract file name part from URL
    const fileName = extractFileNameFromUrl(url);
    if (!fileName) continue;

    // Try different matching methods
    const matchedEntry = findMatchingModelEntry(fileName, modelMap);
    if (matchedEntry) {
      // Found a matching entry, update the URL regardless of whether it already has one
      const urlInput = matchedEntry.querySelector(
        ".form-group:nth-child(2) input"
      );

      if (urlInput) {
        // Check if the current URL is empty or incorrect
        const isEmptyUrl = !urlInput.value.trim();
        const urlValidation = matchedEntry.querySelector(
          ".form-group:nth-child(2) .validation-status"
        );
        const isErrorUrl =
          urlValidation && urlValidation.classList.contains("invalid");

        // Only update if the URL is empty, incorrect, or different
        if (isEmptyUrl || isErrorUrl || urlInput.value.trim() !== url) {
          // Count if updating an error link
          if (isErrorUrl) {
            updatedErrorCount++;
          }

          urlInput.value = url;
          urlInput.dispatchEvent(new Event("input")); // Trigger validation and update
          matchedCount++;

          // Add a temporary animation effect to show matched
          matchedEntry.classList.add("link-matched");
          setTimeout(() => {
            matchedEntry.classList.remove("link-matched");
          }, 1500);
        }
      }
    }
  }

  // If there are matches, update JSON
  if (matchedCount > 0) {
    updateJsonData();
  }

  return {
    matched: matchedCount,
    updatedErrors: updatedErrorCount,
  };
}

// Extract file name from URL
function extractFileNameFromUrl(url) {
  try {
    // Remove query parameters and anchors
    const cleanUrl = url.split(/[?#]/)[0];
    // Get the last path part
    const parts = cleanUrl.split("/");
    const lastPart = parts[parts.length - 1];

    // If the file name contains an extension, remove the extension
    return lastPart.replace(/\.[^/.]+$/, "");
  } catch (e) {
    return null;
  }
}

// Find matching model entry
function findMatchingModelEntry(fileName, modelMap) {
  // Clean the file name - remove common prefixes and special characters
  const cleanFileName = fileName
    .toLowerCase()
    .replace(/^(model_|checkpoint_|ckpt_|lora_)/, "")
    .replace(/[-_\.]/g, "");

  // Direct match
  if (modelMap.has(fileName.toLowerCase())) {
    return modelMap.get(fileName.toLowerCase());
  }

  // Try fuzzy matching - compare cleaned strings
  for (const [modelName, entry] of modelMap.entries()) {
    const cleanModelName = modelName.toLowerCase().replace(/[-_\.]/g, "");

    // Exact match of cleaned name
    if (cleanModelName === cleanFileName) {
      return entry;
    }

    // Check if the cleaned file name contains the cleaned model name, or vice versa
    if (
      cleanFileName.includes(cleanModelName) ||
      cleanModelName.includes(cleanFileName)
    ) {
      return entry;
    }
  }

  return null;
}

// Initialize after the page loads
document.addEventListener("DOMContentLoaded", initPage);
