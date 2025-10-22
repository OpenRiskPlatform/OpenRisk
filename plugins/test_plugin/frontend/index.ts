import init, * as wasm from "../backend/pkg/test_plugin.js";

export async function initPlugin(): Promise<HTMLElement> {
  // Initialize WASM backend
  await init();

  console.log("Plugin initialized");

  // Call Rust backend function
  const message = wasm.greet("Custom plugin!");
  console.log(message);

  // Create a DOM element to render
  const container = document.createElement("div");
  container.className = "plugin-container";
  container.innerHTML = `
    <h3>Plugin Loaded!</h3>
    <p>${message}</p>
    <button id="plugin-btn">Click me</button>
  `;

  // Add some interactivity
  container.querySelector("#plugin-btn")?.addEventListener("click", async () => {
    console.log(await wasm.screening_rpo("Filip Duris"));
    alert("Button clicked inside plugin!");
  });

  // Return the DOM element
  return container;
}
