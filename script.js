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

    // 找出错误的模型文件并显示在顶部
    updateInvalidModelsList();

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

    // 检查是否是模型加载器节点 - 必须在 properties 中有 "Node name for S&R" 属性
    const isModelLoaderNode =
      node.properties && node.properties["Node name for S&R"];
    if (!isModelLoaderNode) {
      continue;
    }

    // 新增: 检查节点类型是否在 directoryRules 中
    const isNodeTypeInRules =
      node.type && directoryRules.hasOwnProperty(node.type);

    // 检查 widget_values 中是否有 .safetensors 或 .sft 文件
    const modelFiles = [];
    for (const value of node.widgets_values) {
      if (value && typeof value === "string") {
        // 检查文件是否有模型文件后缀，或者节点类型在 directoryRules 中
        if (
          value.includes(".safetensors") ||
          value.includes(".sft") ||
          isNodeTypeInRules
        ) {
          modelFiles.push(value);
        }
      }
    }

    // 只要有任何一种情况满足就添加节点
    if (modelFiles.length > 0 || isNodeTypeInRules) {
      // 如果节点类型在规则中但没有找到模型文件，则将所有非空字符串值添加到模型文件中
      if (modelFiles.length === 0 && isNodeTypeInRules) {
        for (const value of node.widgets_values) {
          if (value && typeof value === "string" && value.trim() !== "") {
            modelFiles.push(value);
          }
        }
      }

      // 确保至少有一个值
      if (modelFiles.length === 0 && node.widgets_values.length > 0) {
        // 添加第一个非空值或空字符串
        modelFiles.push(node.widgets_values[0] || "");
      }

      result.push({
        node,
        existingModels:
          node.properties && node.properties.models
            ? [...node.properties.models]
            : [],
        modelFiles: modelFiles,
        fileName:
          modelFiles.length > 0 ? modelFiles[0].split(/[\\\/]/).pop() : "",
        isNodeTypeInRules: isNodeTypeInRules, // 添加这个标志以便后续处理
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

  // 添加可编辑的模型路径容器
  const modelPathContainer = document.createElement("div");
  modelPathContainer.className = "model-path-container";

  // 创建模型路径输入框
  const modelPathInput = document.createElement("input");
  modelPathInput.className = "model-path-input";
  modelPathInput.value = modelFiles[0]; // 使用完整原始路径
  modelPathInput.title = "编辑此路径将更新 JSON 中的 widgets_values";

  // 修改事件监听器，考虑节点类型
  modelPathInput.addEventListener("input", (e) => {
    const newValue = e.target.value;

    // 直接更新状态，无需依赖其他函数
    const hasPath = newValue.includes("/") || newValue.includes("\\");
    const hasValidExtension = isValidModelExtension(newValue, node.type);

    // 移除所有现有指示器
    const existingIndicators =
      modelPathContainer.querySelectorAll(".path-indicator");
    existingIndicators.forEach((indicator) => {
      modelPathContainer.removeChild(indicator);
    });

    // 创建新指示器
    const indicator = document.createElement("span");

    if (!hasValidExtension) {
      indicator.className = "path-indicator invalid-extension";
      indicator.title = hasPath
        ? "无效的文件格式 (应为 .safetensors 或 .sft) 且包含文件夹路径"
        : "无效的文件格式 (应为 .safetensors 或 .sft)";
    } else if (hasPath) {
      indicator.className = "path-indicator path-warning";
      indicator.title = "包含文件夹路径";
    } else {
      indicator.className = "path-indicator valid-extension";
      indicator.title = "有效的模型文件格式";
    }

    modelPathContainer.appendChild(indicator);

    // 更新 widgets_values 和其他状态
    updateWidgetsValue(node.id, modelFiles[0], newValue);
  });

  // 添加 blur 事件，以确保失焦时状态一定会更新
  modelPathInput.addEventListener("blur", (e) => {
    const newValue = e.target.value;
    updatePathWarningStatus(modelPathContainer, newValue, node.type);
  });

  modelPathContainer.appendChild(modelPathInput);

  // 初始状态设置
  updatePathWarningStatus(modelPathContainer, modelFiles[0], node.type);

  // Node body content
  const body = document.createElement("div");
  body.className = "node-body";

  // 添加模型路径容器到卡片头部或正文顶部
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

  // 移除原来的文件列表显示，因为已经有了可编辑的输入框
  // 如果有多个模型文件，仍然保留文件列表，但主文件已在顶部输入框中
  if (modelFiles.length > 1) {
    const fileListDiv = document.createElement("div");
    fileListDiv.className = "file-list";

    const fileListTitle = document.createElement("div");
    fileListTitle.className = "file-list-title";
    fileListTitle.innerHTML = `<strong>其他模型文件 (${
      modelFiles.length - 1
    }):</strong>`;
    fileListDiv.appendChild(fileListTitle);

    // 添加除了主文件以外的其他文件
    for (let i = 1; i < modelFiles.length; i++) {
      const fileNameDiv = document.createElement("div");
      fileNameDiv.className = "file-name";

      const originalPath = modelFiles[i];
      const hasPath = originalPath.includes("/") || originalPath.includes("\\");

      fileNameDiv.innerHTML = `<span class="file-index">${i}.</span> ${originalPath} ${
        hasPath
          ? '<span class="path-warning" title="包含文件夹路径"></span>'
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
  // 清除当前状态
  validationElement.className = "validation-status";

  // 重新检查名称是否有效
  if (!inputValue) {
    validationElement.classList.add("invalid");
    validationElement.title = "模型名称不能为空";
    return false;
  }

  // 检查文件名是否有效
  const isFileNameValid = isValidModelExtension(fileName, null);

  // 如果文件名有效，检查模型名称与基本文件名是否匹配
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
      validationElement.title = "模型名称与文件名匹配";
      return true;
    } else {
      validationElement.classList.add("invalid");
      validationElement.title = "模型名称与文件名不匹配";
      return false;
    }
  } else {
    // 如果文件名无效（没有.safetensors或.sft后缀），名称验证也应为无效
    validationElement.classList.add("invalid");
    validationElement.title = "模型文件格式无效，无法验证名称";
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

// 修改 isValidModelExtension 函数，考虑节点类型
function isValidModelExtension(filePath, nodeType) {
  if (!filePath) return false;

  // 首先检查文件扩展名
  const lowerPath = filePath.toLowerCase();
  const hasValidExtension =
    lowerPath.endsWith(".safetensors") || lowerPath.endsWith(".sft");

  // 如果指定了节点类型且在规则中，即使扩展名不对也视为有效
  if (nodeType && directoryRules.hasOwnProperty(nodeType)) {
    return true;
  }

  return hasValidExtension;
}

// 修改 updatePathWarningStatus 函数，考虑节点类型
function updatePathWarningStatus(container, filePath, nodeType) {
  if (!container) return;

  // 先移除所有现有指示器
  const existingIndicators = container.querySelectorAll(
    ".path-indicator, .path-warning"
  );
  existingIndicators.forEach((indicator) => {
    container.removeChild(indicator);
  });

  // 检查路径和扩展名，考虑节点类型
  const hasPath = filePath.includes("/") || filePath.includes("\\");
  const hasValidExtension = isValidModelExtension(filePath, nodeType);

  // 创建新指示器
  const indicator = document.createElement("span");

  if (!hasValidExtension) {
    // 无效扩展名优先级最高，显示红色
    indicator.className = "path-indicator invalid-extension";
    indicator.title = hasPath
      ? "无效的文件格式 (应为 .safetensors 或 .sft) 且包含文件夹路径"
      : "无效的文件格式 (应为 .safetensors 或 .sft)";
  } else if (hasPath) {
    // 有效扩展名但有路径，显示黄色
    indicator.className = "path-indicator path-warning";
    indicator.title = "包含文件夹路径";
  } else {
    // 有效扩展名且无路径，显示绿色
    indicator.className = "path-indicator valid-extension";
    indicator.title = "有效的模型文件格式";
  }

  container.appendChild(indicator);

  // 更新无效模型列表
  setTimeout(() => {
    updateInvalidModelsList();
  }, 10);
}

// 修改 updateWidgetsValue 函数，确保模型名称验证状态完全更新
function updateWidgetsValue(nodeId, oldValue, newValue) {
  if (!parsedJson) return;

  // 找到对应的节点
  const node = parsedJson.nodes.find((n) => n.id === nodeId);
  if (!node || !node.widgets_values) return;

  // 查找并更新 widgets_values 中的值
  let updated = false;
  for (let i = 0; i < node.widgets_values.length; i++) {
    if (node.widgets_values[i] === oldValue) {
      node.widgets_values[i] = newValue;
      updated = true;
      break;
    }
  }

  // 如果没有实际更新，则返回
  if (!updated) return;

  // 更新 JSON 文本区域
  const formattedJson = JSON.stringify(parsedJson, null, 2);
  jsonInput.value = formattedJson;
  updateLineNumbers();

  // 重新查找节点位置
  findNodePositions(formattedJson);

  // 同步更新编辑区
  const nodeInfo = nodesToEdit.find((info) => info.node.id === nodeId);
  if (nodeInfo) {
    // 更新 modelFiles 数组中对应的值
    const index = nodeInfo.modelFiles.indexOf(oldValue);
    if (index !== -1) {
      nodeInfo.modelFiles[index] = newValue;

      // 更新指示器状态
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

      // 提取新的基本文件名（不含路径）
      const newBaseName = newValue.split(/[\\\/]/).pop();

      // 更新相关的模型条目验证状态
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
            // 强制重新验证 - 不只是更新验证结果
            // 这是关键修复：无论当前状态如何，都强制重新验证
            nameInput.dispatchEvent(new Event("input"));
          }
        });
      }

      // 检查是否需要更新第一个模型条目的名称（如果它是基于文件名创建的）
      if (index === 0) {
        // 如果是主文件被修改
        const firstModelEntry = document.querySelector(
          `.models-container[data-node-id="${nodeId}"] .model-entry:first-child`
        );
        if (firstModelEntry) {
          const nameInput = firstModelEntry.querySelector(
            ".form-group:nth-child(1) input"
          );
          // 如果当前名称与旧的基本文件名相同，则更新为新的文件名
          const oldBaseName = oldValue.split(/[\\\/]/).pop();
          if (nameInput && nameInput.value === oldBaseName) {
            nameInput.value = newBaseName;
            // 触发验证更新
            nameInput.dispatchEvent(new Event("input"));
          }
        }
      }
    }
  }

  // 更新统计信息
  updateStats();

  // 更新错误模型列表
  updateInvalidModelsList();
}

// 修改错误模型列表生成函数
function updateInvalidModelsList() {
  // 查找或创建错误模型面板
  let invalidModelsPanel = document.getElementById("invalidModelsPanel");
  if (!invalidModelsPanel) {
    invalidModelsPanel = document.createElement("div");
    invalidModelsPanel.id = "invalidModelsPanel";
    invalidModelsPanel.className = "invalid-models-panel";

    // 将面板插入到统计面板后面
    const statsPanel = document.getElementById("statsPanel");
    if (statsPanel && statsPanel.parentNode) {
      statsPanel.parentNode.insertBefore(
        invalidModelsPanel,
        statsPanel.nextSibling
      );
    }
  }

  // 收集所有无效模型文件
  const invalidModels = [];
  for (const nodeInfo of nodesToEdit) {
    const { node, modelFiles } = nodeInfo;

    for (const filePath of modelFiles) {
      // 考虑节点类型
      if (!isValidModelExtension(filePath, node.type)) {
        invalidModels.push({ nodeId: node.id, nodeName: node.type, filePath });
      }
    }
  }

  // 更新面板内容
  if (invalidModels.length > 0) {
    invalidModelsPanel.innerHTML = `
      <h3>无效的模型文件 <span class="badge">${invalidModels.length}</span></h3>
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

    // 添加点击事件
    invalidModelsPanel
      .querySelectorAll(".invalid-model-link")
      .forEach((link) => {
        link.addEventListener("click", () => {
          const nodeId = link.dataset.nodeId;
          // 滚动到对应节点
          scrollToNode(nodeId);

          // 高亮对应卡片
          const targetCard = document.querySelector(
            `.node-card[data-node-id="${nodeId}"]`
          );
          if (targetCard) {
            // 移除其他卡片的高亮
            document.querySelectorAll(".node-card").forEach((card) => {
              card.classList.remove("highlight-error");
            });

            // 添加高亮并滚动到视图
            targetCard.classList.add("highlight-error");
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });

            // 稍后移除高亮
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

// Initialize after the page loads
document.addEventListener("DOMContentLoaded", initPage);
