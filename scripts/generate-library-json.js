const dirTree = require("directory-tree");
const fs = require("fs");
const path = require("path");

const libraryPath = path.join(__dirname, "../public/library");
const outputPath = path.join(__dirname, "../public/library.json");

const tree = dirTree(libraryPath, {
  attributes: ["size", "type", "extension"],
  exclude: /\.DS_Store|Thumbs\.db/ // Exclude common system files
});

// Remove the absolute path from the tree structure to make it relative
function makePathsRelative(node, basePath) {
  if (node.path) {
    node.path = path.relative(basePath, node.path).replace(/\\/g, '/'); // Convert to forward slashes
  }
  if (node.children) {
    node.children.forEach(child => makePathsRelative(child, basePath));
  }
}

makePathsRelative(tree, path.dirname(libraryPath)); // Adjust base path for correct relative paths

fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2), "utf8");

console.log("library.json generated successfully at:", outputPath);