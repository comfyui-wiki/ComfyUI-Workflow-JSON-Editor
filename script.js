// Define default directory rules
let directoryRules = {
  CheckpointLoaderSimple: "checkpoints",
  CheckpointLoader: "checkpoints",
  ControlNetLoader: "controlnet",
  CLIPLoader: "text_encoders",
  CLIPVisionLoader: "clip_vision",
  DiffusersLoader: "diffusers",
  DualCLIPLoader: "text_encoders",
  DiffControlNetLoader: "controlnet",
  GLIGENLoader: "gligen",
  ImageOnlyCheckpointLoader: "checkpoints",
  LoraLoader: "loras",
  LoraLoaderModelOnly: "loras",
  PhotoMakerLoader: "photomaker",
  QuadrupleCLIPLoader: "text_encoders",
  StyleModelLoader: "style_models",
  TripleCLIPLoader: "text_encoders",
  UpscaleModelLoader: "upscale_models",
  unCLIPCheckpointLoader: "checkpoints",
  UNETLoader: "diffusion_models",
  VAELoader: "vae",
  ImageOnlyCheckpointLoader: "checkpoints",
  ModelPatchLoader: "model_patches",
  AudioEncoderLoader: "audio_encoders",
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

// Add global status variables
let validationStatus = {
  hasErrors: false,
  hasWarnings: false,
  missingLinks: 0,
  invalidLinks: 0,
  formatErrors: 0,
  urlMismatch: 0,
};

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

  // Create validation status display area
  const actionsContainer = document.querySelector(".actions");
  if (actionsContainer) {
    const validationInfoElement = document.createElement("div");
    validationInfoElement.id = "validation-info";
    validationInfoElement.className = "validation-info";
    actionsContainer.parentNode.insertBefore(
      validationInfoElement,
      actionsContainer.nextSibling
    );
  }
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

    // Find and display invalid model files at the top
    updateInvalidModelsList();

    // Add: validate all model configurations
    validateAllModels();

    // showMessage("JSON parsed successfully");
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

    // Check if this is a model loader node - must have "Node name for S&R" property
    const isModelLoaderNode =
      node.properties && node.properties["Node name for S&R"];
    if (!isModelLoaderNode) {
      continue;
    }

    // Check if node type is in directoryRules
    const isNodeTypeInRules =
      node.type && directoryRules.hasOwnProperty(node.type);

    // Check if widget_values contains possible model files
    const modelFiles = [];
    for (const value of node.widgets_values) {
      if (value && typeof value === "string") {
        // First check if contains dot - basic requirement for file names
        const containsDot = value.includes(".");

        // Check if has model file suffix
        const hasSafetensorsExt = value.toLowerCase().includes(".safetensors");
        const hasSftExt = value.toLowerCase().includes(".sft");
        const hasValidExt = hasSafetensorsExt || hasSftExt;

        // Check if is valid file name (not "default" or other common config values)
        const isValidFileName =
          containsDot &&
          !/^(default|none|empty|null|undefined|clip|checkpoint|controlnet|diffusers|lora|vae)$/i.test(
            value
          );

        // If has valid model file suffix, add as model file
        if (hasValidExt) {
          modelFiles.push(value);
        }
        // If node type is in known model node list and looks like valid file name, also add
        else if (isNodeTypeInRules && isValidFileName && value.trim() !== "") {
          modelFiles.push(value);
        }
      }
    }

    // Add node if any condition is met
    if (modelFiles.length > 0) {
      result.push({
        node,
        existingModels:
          node.properties && node.properties.models
            ? [...node.properties.models]
            : [],
        modelFiles: modelFiles,
        fileName:
          modelFiles.length > 0 ? modelFiles[0].split(/[\\\/]/).pop() : "",
        isNodeTypeInRules: isNodeTypeInRules,
      });
    }
    // For nodes with no model files found but node type is in rules, also add them but check if first value might be file
    else if (isNodeTypeInRules && node.widgets_values.length > 0) {
      const firstValue = node.widgets_values[0];
      // Only add if first value looks like file name
      if (
        firstValue &&
        typeof firstValue === "string" &&
        firstValue.includes(".") &&
        firstValue.trim() !== ""
      ) {
        modelFiles.push(firstValue);
        result.push({
          node,
          existingModels:
            node.properties && node.properties.models
              ? [...node.properties.models]
              : [],
          modelFiles: [firstValue],
          fileName: firstValue.split(/[\\\/]/).pop(),
          isNodeTypeInRules: isNodeTypeInRules,
        });
      }
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
      return value.split(/[\\\/]/).pop();
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
  const { node, existingModels, modelFiles, fileName, isNodeTypeInRules } =
    nodeInfo;

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

  // Add editable model path container
  const modelPathContainer = document.createElement("div");
  modelPathContainer.className = "model-path-container";

  // Create model path input
  const modelPathInput = document.createElement("input");
  modelPathInput.className = "model-path-input";
  modelPathInput.value = modelFiles[0]; // Use full original path
  modelPathInput.title = "Edit this path to update widgets_values in JSON";

  // Modify event listener to consider node type
  modelPathInput.addEventListener("input", (e) => {
    const newValue = e.target.value;

    // Update status directly without relying on other functions
    const hasPath = newValue.includes("/") || newValue.includes("\\");
    const hasValidExtension = isValidModelExtension(newValue, node.type);

    // Remove all existing indicators
    const existingIndicators =
      modelPathContainer.querySelectorAll(".path-indicator");
    existingIndicators.forEach((indicator) => {
      modelPathContainer.removeChild(indicator);
    });

    // Create new indicator
    const indicator = document.createElement("span");

    if (!hasValidExtension) {
      indicator.className = "path-indicator invalid-extension";
      indicator.title = hasPath
        ? "Invalid file format (should be .safetensors or .sft) and contains folder path"
        : "Invalid file format (should be .safetensors or .sft)";
    } else if (hasPath) {
      indicator.className = "path-indicator path-warning";
      indicator.title = "Contains folder path";
    } else {
      indicator.className = "path-indicator valid-extension";
      indicator.title = "Valid model file format";
    }

    modelPathContainer.appendChild(indicator);

    // Update widgets_values and other states
    updateWidgetsValue(node.id, modelFiles[0], newValue);
  });

  // Add blur event to ensure state updates when focus is lost
  modelPathInput.addEventListener("blur", (e) => {
    const newValue = e.target.value;
    updatePathWarningStatus(modelPathContainer, newValue, node.type);
  });

  modelPathContainer.appendChild(modelPathInput);

  // Set initial state
  updatePathWarningStatus(modelPathContainer, modelFiles[0], node.type);

  // Node body content
  const body = document.createElement("div");
  body.className = "node-body";

  // Add model path container to card header or body top
  body.appendChild(modelPathContainer);

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

  // Remove original file list display since we have editable input
  // If there are multiple model files, keep file list but main file is already in top input
  if (modelFiles.length > 1) {
    const fileListDiv = document.createElement("div");
    fileListDiv.className = "file-list";

    const fileListTitle = document.createElement("div");
    fileListTitle.className = "file-list-title";
    fileListTitle.innerHTML = `<strong>Other Model Files (${
      modelFiles.length - 1
    }):</strong>`;
    fileListDiv.appendChild(fileListTitle);

    // Add other files besides main file
    for (let i = 1; i < modelFiles.length; i++) {
      const fileNameDiv = document.createElement("div");
      fileNameDiv.className = "file-name";

      const originalPath = modelFiles[i];
      const hasPath = originalPath.includes("/") || originalPath.includes("\\");

      fileNameDiv.innerHTML = `<span class="file-index">${i}.</span> ${originalPath} ${
        hasPath
          ? '<span class="path-warning" title="Contains folder path"></span>'
          : ""
      }`;
      fileListDiv.appendChild(fileNameDiv);
    }

    body.appendChild(fileListDiv);
  }

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
      .map((file) => file.split(/[\\\/]/).pop())
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
      const fileBaseName = file.split(/[\\\/]/).pop();
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
    const fileName = file.split(/[\\\/]/).pop();
    if (fileName === modelName) {
      return fileName;
    }
  }

  // Return the first file name as default
  return modelFiles[0].split(/[\\\/]/).pop();
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
function updateNameValidation(inputValue, fileName, validationElement) {
  // Clear current status
  validationElement.className = "validation-status";

  // Re-check if name is valid
  if (!inputValue) {
    validationElement.classList.add("invalid");
    validationElement.title = "Model name cannot be empty";
    return false;
  }

  // Check if file name is valid
  const isFileNameValid = isValidModelExtension(fileName, null);

  // If file name is valid, check if model name matches base file name
  if (isFileNameValid) {
    const baseFileName = fileName.split(/[\\\/]/).pop();
    const normalizedInput = inputValue.toLowerCase().replace(/[-_\.]/g, "");
    const normalizedFileName = baseFileName
      .toLowerCase()
      .replace(/[-_\.]/g, "")
      .replace(/\.safetensors$|\.sft$/i, "");

    if (
      normalizedInput === normalizedFileName ||
      normalizedInput.includes(normalizedFileName) ||
      normalizedFileName.includes(normalizedInput)
    ) {
      validationElement.classList.add("valid");
      validationElement.title = "Model name matches file name";
      return true;
    } else {
      validationElement.classList.add("invalid");
      validationElement.title = "Model name does not match file name";
      return false;
    }
  } else {
    // If file name is invalid (no .safetensors or .sft suffix), name validation should also be invalid
    validationElement.classList.add("invalid");
    validationElement.title = "Model file format is invalid, cannot validate name";
    return false;
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

// Modified isValidModelExtension function, considering node type
function isValidModelExtension(filePath, nodeType) {
  if (!filePath) return false;

  // First check file extension
  const lowerPath = filePath.toLowerCase();
  const hasValidExtension =
    lowerPath.endsWith(".safetensors") || lowerPath.endsWith(".sft");

  // If node type is specified and in rules, consider valid even if extension is wrong
  if (nodeType && directoryRules.hasOwnProperty(nodeType)) {
    return true;
  }

  return hasValidExtension;
}

// Modified updatePathWarningStatus function, considering node type
function updatePathWarningStatus(container, filePath, nodeType) {
  if (!container) return;

  // First remove all existing indicators
  const existingIndicators = container.querySelectorAll(
    ".path-indicator, .path-warning"
  );
  existingIndicators.forEach((indicator) => {
    container.removeChild(indicator);
  });

  // Check path and extension, considering node type
  const hasPath = filePath.includes("/") || filePath.includes("\\");
  const hasValidExtension = isValidModelExtension(filePath, nodeType);

  // Create new indicator
  const indicator = document.createElement("span");

  if (!hasValidExtension) {
    // Invalid extension has highest priority, show red
    indicator.className = "path-indicator invalid-extension";
    indicator.title = hasPath
      ? "Invalid file format (should be .safetensors or .sft) and contains folder path"
      : "Invalid file format (should be .safetensors or .sft)";
  } else if (hasPath) {
    // Valid extension but has path, show yellow
    indicator.className = "path-indicator path-warning";
    indicator.title = "Contains folder path";
  } else {
    // Valid extension and no path, show green
    indicator.className = "path-indicator valid-extension";
    indicator.title = "Valid model file format";
  }

  container.appendChild(indicator);

  // Update invalid models list
  setTimeout(() => {
    updateInvalidModelsList();
  }, 10);
}

// Modified updateWidgetsValue function, ensuring model name validation status is fully updated
function updateWidgetsValue(nodeId, oldValue, newValue) {
  if (!parsedJson) return;

  // Find the corresponding node
  const node = parsedJson.nodes.find((n) => n.id === nodeId);
  if (!node || !node.widgets_values) return;

  // Find and update the value in widgets_values
  let updated = false;
  for (let i = 0; i < node.widgets_values.length; i++) {
    if (node.widgets_values[i] === oldValue) {
      node.widgets_values[i] = newValue;
      updated = true;
      break;
    }
  }

  // If no actual update, return
  if (!updated) return;

  // Update JSON text area
  const formattedJson = JSON.stringify(parsedJson, null, 2);
  jsonInput.value = formattedJson;
  updateLineNumbers();

  // Re-find node positions
  findNodePositions(formattedJson);

  // Synchronously update edit area
  const nodeInfo = nodesToEdit.find((info) => info.node.id === nodeId);
  if (nodeInfo) {
    // Update corresponding value in modelFiles array
    const index = nodeInfo.modelFiles.indexOf(oldValue);
    if (index !== -1) {
      nodeInfo.modelFiles[index] = newValue;

      // Update indicator status
      const modelPathContainer = document.querySelector(
        `.node-card[data-node-id="${nodeId}"] .model-path-container`
      );
      if (modelPathContainer) {
        updatePathWarningStatus(
          modelPathContainer,
          newValue,
          nodeInfo.node.type
        );
      }

      // Extract new base file name (without path)
      const newBaseName = newValue.split(/[\\\/]/).pop();

      // Update related model entry validation status
      const modelsContainer = document.querySelector(
        `.models-container[data-node-id="${nodeId}"]`
      );
      if (modelsContainer) {
        const modelEntries = modelsContainer.querySelectorAll(".model-entry");

        modelEntries.forEach((entry) => {
          const nameInput = entry.querySelector(
            ".form-group:nth-child(1) input"
          );
          const validationElement = entry.querySelector(
            ".form-group:nth-child(1) .validation-status"
          );

          if (nameInput && validationElement) {
            // Force re-validation - not just update validation result
            // This is the key fix: force re-validation regardless of current state
            nameInput.dispatchEvent(new Event("input"));
          }
        });
      }

      // Check if need to update first model entry name (if it was created based on file name)
      if (index === 0) {
        // If main file was modified
        const firstModelEntry = document.querySelector(
          `.models-container[data-node-id="${nodeId}"] .model-entry:first-child`
        );
        if (firstModelEntry) {
          const nameInput = firstModelEntry.querySelector(
            ".form-group:nth-child(1) input"
          );
          // If current name matches old base file name, update to new file name
          const oldBaseName = oldValue.split(/[\\\/]/).pop();
          if (nameInput && nameInput.value === oldBaseName) {
            nameInput.value = newBaseName;
            // Trigger validation update
            nameInput.dispatchEvent(new Event("input"));
          }
        }
      }
    }
  }

  // Update statistics
  updateStats();

  // Update invalid models list
  updateInvalidModelsList();

  // Add: validate all model configurations
  validateAllModels();
}

// Modified invalid models list generation function
function updateInvalidModelsList() {
  // Find or create invalid models panel
  let invalidModelsPanel = document.getElementById("invalidModelsPanel");
  if (!invalidModelsPanel) {
    invalidModelsPanel = document.createElement("div");
    invalidModelsPanel.id = "invalidModelsPanel";
    invalidModelsPanel.className = "invalid-models-panel";

    // Insert panel after stats panel
    const statsPanel = document.getElementById("statsPanel");
    if (statsPanel && statsPanel.parentNode) {
      statsPanel.parentNode.insertBefore(
        invalidModelsPanel,
        statsPanel.nextSibling
      );
    }
  }

  // Collect all invalid model files
  const invalidModels = [];
  for (const nodeInfo of nodesToEdit) {
    const { node, modelFiles } = nodeInfo;

    for (const filePath of modelFiles) {
      // Consider node type
      if (!isValidModelExtension(filePath, node.type)) {
        invalidModels.push({ nodeId: node.id, nodeName: node.type, filePath });
      }
    }
  }

  // Update panel content
  if (invalidModels.length > 0) {
    invalidModelsPanel.innerHTML = `
      <h3>Invalid Model Files <span class="badge">${invalidModels.length}</span></h3>
      <div class="invalid-models-list">
        ${invalidModels
          .map(
            (model) => `
          <div class="invalid-model-link" data-node-id="${model.nodeId}">
            <span class="node-type">${model.nodeName}</span>: ${model.filePath}
          </div>
        `
          )
          .join("")}
      </div>
    `;

    // Add click events
    invalidModelsPanel
      .querySelectorAll(".invalid-model-link")
      .forEach((link) => {
        link.addEventListener("click", () => {
          const nodeId = link.dataset.nodeId;
          // Scroll to corresponding node
          scrollToNode(nodeId);

          // Highlight corresponding card
          const targetCard = document.querySelector(
            `.node-card[data-node-id="${nodeId}"]`
          );
          if (targetCard) {
            // Remove highlight from other cards
            document.querySelectorAll(".node-card").forEach((card) => {
              card.classList.remove("highlight-error");
            });

            // Add highlight and scroll to view
            targetCard.classList.add("highlight-error");
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });

            // Remove highlight later
            setTimeout(() => {
              targetCard.classList.remove("highlight-error");
            }, 2000);
          }
        });
      });

    invalidModelsPanel.style.display = "block";
  } else {
    invalidModelsPanel.style.display = "none";
  }
}

// Modified validateAllModels function, adding name and URL matching check
function validateAllModels() {
  // Reset status
  validationStatus = {
    hasErrors: false,
    hasWarnings: false,
    missingLinks: 0,
    invalidLinks: 0,
    formatErrors: 0,
    urlMismatch: 0,
  };

  if (!parsedJson || !parsedJson.nodes || !Array.isArray(parsedJson.nodes)) {
    return;
  }

  // Iterate through all nodes
  for (const nodeInfo of nodesToEdit) {
    const { node, modelFiles, isNodeTypeInRules } = nodeInfo;

    // Skip non-model nodes
    if (!isNodeTypeInRules) continue;

    // Check if node has model configuration
    const hasModelsProperty =
      node.properties && Array.isArray(node.properties.models);

    // Find files that meet format requirements
    const validModelFiles = modelFiles.filter((file) => {
      return isValidModelExtension(file, null); // Only check file extension, not considering node type
    });

    // 1. Check if model count matches
    if (hasModelsProperty) {
      if (validModelFiles.length !== node.properties.models.length) {
        validationStatus.hasWarnings = true;
        console.warn(
          `Model count mismatch: Node ${node.id} (${node.type}) has ${validModelFiles.length} valid model files, but has ${node.properties.models.length} model configurations`
        );
      }

      // 2. Check each model configuration
      for (const model of node.properties.models) {
        // Check if model name is in widgets_values
        const modelNameInWidgets = modelFiles.some((file) => {
          const fileName = file.split(/[\\\/]/).pop();
          return fileName === model.name || file === model.name;
        });

        if (!modelNameInWidgets) {
          validationStatus.hasWarnings = true;
          console.warn(
            `Model name mismatch: Model "${model.name}" in node ${node.id} (${node.type}) not found in widgets_values`
          );
        }

        // Check model file format
        const hasValidExtension =
          model.name.toLowerCase().endsWith(".safetensors") ||
          model.name.toLowerCase().endsWith(".sft");

        if (!hasValidExtension) {
          validationStatus.hasErrors = true;
          validationStatus.formatErrors++;
          console.error(
            `Model file format error: Model "${model.name}" in node ${node.id} (${node.type}) is not .safetensors or .sft format`
          );
        }

        // Check model URL
        if (!model.url || model.url.trim() === "") {
          validationStatus.hasWarnings = true;
          validationStatus.missingLinks++;
        } else if (!model.url.includes("http")) {
          validationStatus.hasWarnings = true;
          validationStatus.invalidLinks++;
        } else {
          // New: Check if model name is contained in URL
          const modelNameWithoutExt = model.name.replace(
            /\.(safetensors|sft)$/i,
            ""
          );
          const modelNameBase = modelNameWithoutExt.split(/[_\-\.]/)[0]; // Get base name (first part)

          // Decode URL for comparison
          const decodedUrl = decodeURIComponent(model.url);

          // First try full match
          const nameInUrl = decodedUrl.includes(model.name);

          // If full match fails, try base name match
          const baseNameInUrl =
            !nameInUrl &&
            modelNameBase.length > 3 &&
            decodedUrl.includes(modelNameBase);

          if (!nameInUrl && !baseNameInUrl) {
            validationStatus.hasWarnings = true;
            validationStatus.urlMismatch++;
            console.warn(
              `Model name not contained in URL: Model "${model.name}" in node ${node.id} (${node.type}) URL does not contain model name`
            );
          }
        }
      }
    } else if (validModelFiles.length > 0) {
      // 3. If node has valid model files but no model configuration
      validationStatus.hasWarnings = true;
      validationStatus.missingLinks += validModelFiles.length;
      console.warn(
        `Missing model configuration: Node ${node.id} (${node.type}) has ${validModelFiles.length} valid model files, but no model configuration`
      );
    }
  }

  // Update button status
  updateButtonsStatus();
}

// Modified button status update function, directly display validation info
function updateButtonsStatus() {
  // Update copy and save button status
  const copyBtn = document.getElementById("copyBtn");
  const saveBtn = document.getElementById("saveBtn");

  // Get validation info display element
  const validationInfoElement = document.getElementById("validation-info");

  // Remove old status classes
  copyBtn.classList.remove("status-success", "status-warning", "status-error");
  saveBtn.classList.remove("status-success", "status-warning", "status-error");
  validationInfoElement.classList.remove(
    "info-success",
    "info-warning",
    "info-error"
  );

  // Build validation info content
  let validationMessage = "";

  // Add new status classes and info
  if (validationStatus.hasErrors) {
    copyBtn.classList.add("status-error");
    saveBtn.classList.add("status-error");
    validationInfoElement.classList.add("info-error");

    validationMessage = `<span class="validation-icon">❌</span> ${validationStatus.formatErrors} model format errors`;
  } else if (validationStatus.hasWarnings) {
    copyBtn.classList.add("status-warning");
    saveBtn.classList.add("status-warning");
    validationInfoElement.classList.add("info-warning");

    validationMessage = `<span class="validation-icon">⚠️</span> Warning: `;

    const warningItems = [];
    if (validationStatus.missingLinks > 0) {
      warningItems.push(`${validationStatus.missingLinks} missing links`);
    }
    if (validationStatus.invalidLinks > 0) {
      warningItems.push(`${validationStatus.invalidLinks} invalid links`);
    }
    if (validationStatus.urlMismatch > 0) {
      warningItems.push(`${validationStatus.urlMismatch} name-URL mismatches`);
    }

    validationMessage += warningItems.join(", ");
  } else if (parsedJson && nodesToEdit.length > 0) {
    copyBtn.classList.add("status-success");
    saveBtn.classList.add("status-success");
    validationInfoElement.classList.add("info-success");

    validationMessage = `<span class="validation-icon">✅</span> All model configurations valid`;
  } else {
    // No JSON loaded or no model nodes
    validationMessage = ""; // Display no validation info
  }

  // Update validation info display
  validationInfoElement.innerHTML = validationMessage;

  // Still keep title tooltips for more detailed info
  copyBtn.title = validationMessage.replace(/<[^>]*>/g, "");
  saveBtn.title = validationMessage.replace(/<[^>]*>/g, "");
}

// Initialize after the page loads
document.addEventListener("DOMContentLoaded", initPage);
