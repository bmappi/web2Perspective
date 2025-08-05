(function () {
  function camelToKebab(str) {
    return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
  }

  function rgbToHex(rgb) {
    if (typeof rgb !== "string") return rgb;
    const rgbMatch = rgb.match(
      /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
    );
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    const rgbaMatch = rgb.match(
      /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i,
    );
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1], 10);
      const g = parseInt(rgbaMatch[2], 10);
      const b = parseInt(rgbaMatch[3], 10);
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    return rgb;
  }

  // --- Helper function to check if basis value is "roundish" or reasonable ---
  function isValidBasisValue(value) {
    // Check if it's a pixel value
    const pixelMatch = value.match(/^([\d.]+)px$/);
    if (pixelMatch) {
      const numValue = parseFloat(pixelMatch[1]);
      // Check if it's a whole number, a simple decimal (.5, .25, .75), or within range
      // Allow up to two decimal places, and check if the value modulo 0.25 is effectively 0
      // Using a small epsilon for floating point comparison
      if (numValue > 800) return false; // Too big
      const modValue = numValue % 0.25;
      return (modValue < 0.0001 || modValue > 0.2499); // Essentially 0 or 0.25
    }
    // Allow 'auto', percentages, or other non-pixel values if they come from flex-basis directly
    return true;
  }
  // -------------------------------------------------------------------------

  const defaultValues = {
    "background-color": "rgba(0, 0, 0, 0)",
    "color": "rgb(0, 0, 0)",
    "font-size": "16px",
    "font-weight": "400",
    "text-align": "start",
    "padding": "0px",
    "margin": "0px",
    "border": "0px none rgb(0, 0, 0)",
    "border-color": "rgb(0, 0, 0)",
    "border-width": "0px",
    "border-style": "none",
    "border-radius": "0px",
    "width": "auto",
    "height": "auto",
    "display": "block",
    "flex-direction": "row",
    "justify-content": "normal",
    "align-items": "normal", // Default for align-items
    "gap": "normal",
    "flex-grow": "0",
    "flex-shrink": "1", // Default is shrinkable
    "flex-basis": "auto",
    "flex-wrap": "nowrap",
    "align-content": "normal",
    "float": "none",
    "max-height": "none",
    "min-height": "0px",
    "max-width": "none",
    "min-width": "0px",
    "overflow": "visible",
    "transform": "none", // Default for transform
  };

  // SVG presentation attributes to extract
  const svgPresentationAttrs = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "vector-effect",
    "paint-order",
  ];

  const styleProperties = Object.keys(defaultValues).map(camelToKebab);

  function getElementStyles(element) {
    const computedStyle = window.getComputedStyle(element);
    const style = {};

    // Extract regular CSS styles
    styleProperties.forEach((prop) => {
      let value = computedStyle.getPropertyValue(prop).trim();
      const defaultValue = defaultValues[prop];

      // --- Specific filtering for min-width/height ---
      if ((prop === "min-width" || prop === "min-height") && value === "auto") {
        return; // Ignore auto min-width/height
      }
      // --- End specific filtering ---

      // --- Specific handling for transform ---
      if (prop === "transform" && value !== "none") {
        // Include transform if it's not 'none'
        style.transform = value;
        return;
      }
      // --- End transform handling ---

      if (
        !value ||
        value === defaultValue ||
        value === "initial" ||
        value === "normal" ||
        value === "0px" ||
        value === "0" ||
        (prop === "max-height" && value === "none") ||
        (prop === "max-width" && value === "none")
      ) return;

      // Special handling
      if (prop === "background-color" && value === "rgba(0, 0, 0, 0)") return;
      if (prop === "color" && value === "rgba(0, 0, 0, 0)") return;
      if (prop === "border" && value === "none") return;
      if (prop === "border-color" && value === "rgb(0, 0, 0)") return;

      const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

      if (
        prop === "background-color" || prop === "color" ||
        prop === "border-color"
      ) {
        style[camelProp] = rgbToHex(value);
      } else {
        // --- Apply isValidBasisValue filter to width and height ---
        if (
          (prop === "width" || prop === "height") && !isValidBasisValue(value)
        ) {
          return; // Ignore invalid width/height
        }
        style[camelProp] = value;
      }
    });

    // Extract inline SVG attributes (if SVG element or descendant)
    // Check if the element itself is an SVG or if it's inside an SVG
    if (
      element instanceof SVGElement // Covers <svg>, <path>, <polyline>, etc.
    ) {
      const attrs = element.attributes;
      for (const attr of attrs) {
        const name = attr.name;
        const value = attr.value.trim();
        if (
          svgPresentationAttrs.includes(name) && value && value !== "none" &&
          value !== "currentColor"
        ) {
          const camelName = name.replace(
            /-([a-z])/g,
            (g) => g[1].toUpperCase(),
          );
          // Apply filter to SVG width/height as well
          if (
            (name === "width" || name === "height") && !isValidBasisValue(value)
          ) {
            continue; // Ignore invalid SVG width/height
          }
          style[camelName] = value;
        } else if (name === "fill" && value === "none") {
          style.fill = "none";
        } else if (name === "stroke" && value === "currentColor") {
          style.stroke = "currentColor";
        }
      }
    }

    return Object.keys(style).length > 0 ? style : undefined;
  }

  function generateName(element) {
    if (element.id) return element.id;
    const classNames =
      element.className && typeof element.className === "string"
        ? element.className.split(" ").filter((c) => c)
        : [];
    if (classNames.length > 0) return classNames[0];
    const tag = element.tagName.toLowerCase();
    switch (tag) {
      case "div":
        return "FlexContainer";
      case "span":
        return "Text";
      case "p":
        return "Paragraph";
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return `Heading${tag[1]}`;
      case "img":
        return "Image";
      case "button":
        return "Button";
      case "a":
        return "Link";
      case "svg":
        return "SvgGraphic";
      default:
        return tag.charAt(0).toUpperCase() + tag.slice(1);
    }
  }

  function generatePosition(element) {
    const computedStyle = window.getComputedStyle(element);
    const position = {};

    // --- Special handling for display: grid ---
    const display = computedStyle.getPropertyValue("display").trim();
    if (display === "grid") {
      // If display is grid, set grow and shrink to 1
      position.grow = 1;
      position.shrink = 1;
      position.display = true; // Ensure display is true
      return position; // Early return for grid
    }
    // --- End display: grid handling ---

    // Flex Grow
    const flexGrow = computedStyle.getPropertyValue("flex-grow").trim();
    if (
      flexGrow && flexGrow !== "0" && flexGrow !== defaultValues["flex-grow"]
    ) {
      position.grow = parseInt(flexGrow, 10);
    }

    // Flex Shrink — set to 1 if not 0 (default is shrinkable)
    const flexShrink = computedStyle.getPropertyValue("flex-shrink").trim();

    // --- Correctly handle flex-shrink default ---
    // By default, flex items are shrinkable (flex-shrink: 1)
    // Only add shrink property if it's not the default OR if it's explicitly set to 0
    if (flexShrink !== defaultValues["flex-shrink"]) { // If not "1"
      if (flexShrink === "0") {
        position.shrink = 0; // Explicitly not shrinkable
      } else if (flexShrink !== "1") { // If it's some other non-default value
        position.shrink = parseInt(flexShrink, 10);
      }
      // If flexShrink is "1", we omit the 'shrink' property as it's the default
    }
    // --- End flex-shrink handling ---

    // --- Basis logic: Only use flex-basis or flex shorthand ---
    let basisValue = null;
    const flexBasis = computedStyle.getPropertyValue("flex-basis").trim();
    if (
      flexBasis && flexBasis !== "auto" && flexBasis !== "0px" &&
      flexBasis !== defaultValues["flex-basis"]
    ) {
      basisValue = flexBasis;
    } else {
      const flex = computedStyle.getPropertyValue("flex").trim();
      if (flex && flex !== "0 1 auto") {
        const parts = flex.split(/\s+/); // Split by one or more spaces
        if (parts.length >= 3) {
          // Use the basis part from flex shorthand (parts[2])
          const potentialBasis = parts[2];
          if (
            potentialBasis !== "auto" &&
            potentialBasis !== defaultValues["flex-basis"]
          ) {
            basisValue = potentialBasis;
          }
          // Handle flex: '1' -> '1 1 0px' or flex: '2' -> '2 1 0px' if needed,
          // but the primary focus is the 3-part shorthand for basis.
        }
      }
      // Do NOT fall back to computed width/height anymore
    }

    // --- Apply refined basis value ---
    if (basisValue) {
      if (isValidBasisValue(basisValue)) {
        position.basis = basisValue;
      } else {
        position.basis = "auto"; // Set to auto if not valid
      }
    }
    // --- End basis logic ---

    // Display (for non-grid elements)
    position.display = display !== "none";
    return position;
  }

  function shouldIgnoreElement(element) {
    const computedStyle = window.getComputedStyle(element);
    const display = computedStyle.getPropertyValue("display");
    if (
      element.tagName.toLowerCase() === "div" &&
      display === "none" &&
      !element.children.length &&
      !element.textContent.trim()
    ) return true;
    return false;
  }

  function isIconElement(element) {
    if (element.id && element.id.includes("icon")) return true;
    const classNames =
      element.className && typeof element.className === "string"
        ? element.className.split(" ").filter((c) => c)
        : [];
    return classNames.some((className) => className.includes("icon"));
  }

  function createIconElement(element) {
    const styles = getElementStyles(element);
    const iconStyles = {};
    // Apply filter to width/height even when extracting for icons
    if (styles) {
      ["width", "height", "color"].forEach((prop) => {
        if (
          styles[prop] && (prop === "color" || isValidBasisValue(styles[prop]))
        ) {
          iconStyles[prop] = styles[prop];
        }
      });
    }
    // Ensure basis is handled by generatePosition for icons too, if needed
    const position = generatePosition(element);
    return {
      type: "ia.display.icon",
      version: 0,
      props: {
        path: "material/insert_emoticon",
        color: iconStyles.color || "#000000",
        style: iconStyles,
      },
      meta: {
        name: generateName(element),
        ...(element.id && { domId: element.id }),
      },
      position: position, // Use generatePosition for consistency
      custom: {},
    };
  }

  function createLabelElement(element) {
    const styles = getElementStyles(element);
    const position = generatePosition(element);
    const text = (element.textContent || element.innerText || "Label").trim();
    return {
      type: "ia.display.label",
      version: 0,
      props: { text, ...(styles && { style: styles }) },
      meta: {
        name: generateName(element),
        ...(element.id && { domId: element.id }),
      },
      position,
      custom: {},
    };
  }

  function isTextOnlyDiv(element) {
    if (element.tagName.toLowerCase() !== "div") return false;
    if (element.children.length > 0) return false;
    return element.textContent.trim().length > 0;
  }

  // SVG Parser
  function parseSvgElement(svg) {
    const children = Array.from(svg.children);
    const elements = [];

    for (const child of children) {
      const el = {};
      el.type = child.tagName.toLowerCase();
      el.name = child.tagName.toLowerCase();

      // Copy all attributes
      for (const attr of child.attributes) {
        const name = attr.name;
        let value = attr.value.trim();

        // Handle fill="url(...)"
        if (name === "fill" && value.startsWith("url")) {
          value = { url: value };
        }

        const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        el[camelName] = value;
      }

      // Recurse for nested elements (defs, gradients, etc.)
      const childChildren = Array.from(child.children);
      if (childChildren.length > 0) {
        el.elements = childChildren.map(parseSvgElementNode);
      }

      elements.push(el);
    }

    const props = { elements };

    // Add viewBox, width, height if present
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) props.viewBox = viewBox;

    const width = svg.getAttribute("width");
    const height = svg.getAttribute("height");
    // Apply filter to SVG width/height attributes as well
    if (width && !width.endsWith("%") && isValidBasisValue(width)) {
      props.width = width;
    }
    if (height && !height.endsWith("%") && isValidBasisValue(height)) {
      props.height = height;
    }

    // Extract inline SVG styles (fill, stroke, etc.) from the <svg> element itself
    const svgStyles = getElementStyles(svg);
    if (svgStyles) {
      props.style = svgStyles;
    }

    return {
      type: "ia.shapes.svg",
      version: 0,
      props,
      meta: { name: generateName(svg), ...(svg.id && { domId: svg.id }) },
      position: generatePosition(svg),
      custom: {},
    };
  }

  function parseSvgElementNode(node) {
    const el = {};
    el.type = node.tagName.toLowerCase();
    el.name = node.tagName.toLowerCase();

    for (const attr of node.attributes) {
      const name = attr.name;
      let value = attr.value.trim();
      if (name === "fill" && value.startsWith("url")) {
        value = { url: value };
      }
      const camelName = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      el[camelName] = value;
    }

    const children = Array.from(node.children);
    if (children.length > 0) {
      el.elements = children.map(parseSvgElementNode);
    }

    return el;
  }

  function htmlToJson(element) {
    if (shouldIgnoreElement(element)) return null;
    if (isIconElement(element)) return createIconElement(element);

    // Handle SVG
    if (element.tagName.toLowerCase() === "svg") {
      return parseSvgElement(element);
    }

    const textElements = ["A", "SPAN", "P", "H1", "H2", "H3", "H4", "H5", "H6"];
    if (textElements.includes(element.tagName) || isTextOnlyDiv(element)) {
      return createLabelElement(element);
    }

    const styles = getElementStyles(element);
    const position = generatePosition(element);

    const jsonObj = {
      type: "ia.container.flex",
      version: 0,
      props: {},
      meta: {
        name: generateName(element),
        ...(element.id && { domId: element.id }),
      },
      position,
      custom: {},
    };

    const computedStyle = window.getComputedStyle(element);
    const displayCheck = computedStyle.getPropertyValue("display").trim(); // Check display again if needed elsewhere

    // Default to flex with column direction if display is block (and not overridden)
    let flexDirection = computedStyle.getPropertyValue("flex-direction").trim();
    if (displayCheck === "block" && flexDirection === "row") {
      // Override to column
      jsonObj.props.direction = "column";
    } else if (
      flexDirection && flexDirection !== "row" &&
      flexDirection !== defaultValues["flex-direction"]
    ) {
      jsonObj.props.direction = flexDirection;
    }

    // --- Add align-items to props ---
    const alignItems = computedStyle.getPropertyValue("align-items").trim();
    if (
      alignItems &&
      alignItems !== "normal" && // 'normal' computes to 'stretch' for flex, but let's treat it as default-ish
      alignItems !== "stretch" && // Default align-items for flex
      alignItems !== defaultValues["align-items"]
    ) {
      // Convert kebab-case to camelCase if needed (though align-items is already kebab)
      const camelAlignItems = alignItems.replace(
        /-([a-z])/g,
        (g) => g[1].toUpperCase(),
      );
      jsonObj.props.alignItems = camelAlignItems;
    }
    // --- End align-items handling ---

    const flexWrap = computedStyle.getPropertyValue("flex-wrap").trim();
    if (
      flexWrap && flexWrap !== "nowrap" &&
      flexWrap !== defaultValues["flex-wrap"]
    ) {
      jsonObj.props.wrap = flexWrap;
    }

    const justifyContent = computedStyle.getPropertyValue("justify-content")
      .trim();
    if (
      justifyContent &&
      justifyContent !== "normal" &&
      justifyContent !== "flex-start" &&
      justifyContent !== defaultValues["justify-content"]
    ) {
      jsonObj.props.justify = justifyContent;
    }

    const alignContent = computedStyle.getPropertyValue("align-content").trim();
    if (
      alignContent &&
      alignContent !== "normal" &&
      alignContent !== "stretch" &&
      alignContent !== defaultValues["align-content"]
    ) {
      jsonObj.props.alignContent = alignContent;
    }

    // Apply styles (filtered)
    if (styles) {
      const filteredStyles = { ...styles };
      delete filteredStyles.display;
      delete filteredStyles.flexDirection;
      delete filteredStyles.flexWrap;
      delete filteredStyles.justifyContent;
      delete filteredStyles.alignContent;
      delete filteredStyles.alignItems; // Remove from styles as it's in props
      if (Object.keys(filteredStyles).length > 0) {
        jsonObj.props.style = filteredStyles;
      }
    }

    // Children
    const children = Array.from(element.children)
      .map(htmlToJson)
      .filter((child) => child !== null);

    if (children.length > 0) {
      jsonObj.children = children;
    }

    return jsonObj;
  }

  // --- Wrap return value in an array ---
  window.generateJsonDom = function (selectorOrElement) {
    let element;
    if (typeof selectorOrElement === "string") {
      element = document.querySelector(selectorOrElement);
    } else if (selectorOrElement instanceof Element) {
      element = selectorOrElement;
    } else {
      console.error("Please provide a valid CSS selector or DOM element");
      return null;
    }
    if (!element) {
      console.error("Element not found");
      return null;
    }
    const result = htmlToJson(element);
    return result ? [result] : []; // Return array, empty if null
  };

  window.generateJsonFromSelected = function () {
    const selected = typeof $0 !== "undefined" ? $0 : null;
    if (selected) return window.generateJsonDom(selected);
    else {
      console.error(
        "No element selected in DevTools. Please select an element first.",
      );
      return null;
    }
  };
  // --- End wrap return value ---

  console.log("Enhanced JSON DOM Generator loaded!");
  console.log("Usage:");
  console.log(
    '1. generateJsonDom("#myElement") - Generate JSON from CSS selector',
  );
  console.log(
    '2. generateJsonDom(document.getElementById("myElement")) - Generate JSON from element',
  );
  console.log(
    "3. generateJsonFromSelected() - Generate JSON from currently selected element in DevTools (select element first)",
  );
})();
